import { CAMPAIGN, soldierName, type RosterSoldier } from '../campaign';
import type { Loadout } from '../loadout';
import { addStash, capStash, lootFrom } from '../loot';
import { emptyStash, nextStash, stashOf, type Stash } from '../stash';
import { seededRandom } from '../rng';
import type { GameState } from '../types';
import { RANKS } from '../ranks';
import { BASE_RULES, levelsOf } from './base';
import { autoSquad, deployed } from './barracks';
import { DAYS, DIFFICULTIES, type DifficultyId } from './difficulty';
import {
  CAPITAL_GATES, CAPITAL_REGION, CAPITAL_UNLOCK, PLANET_VERSION, REGIONS, missionDifficulty,
} from './planet';

export type Holder = 'enemy' | 'player' | 'allied' | 'neutral' | 'wild';

/** The saved, changing part of one region (names, links and maps live in `REGIONS`). */
export interface RegionState {
  holder: Holder;
  garrison: number;
  visited: boolean;
  /** How many times the squad has fought here; feeds the mission seed. */
  attempts: number;
}

export type WorldStatus = 'active' | 'won' | 'lost';

/** A soldier in the barracks. `trained` is rank-only training; `daysLeft` is 0 when ready. */
export interface PoolSoldier {
  name: string;
  kills: number;
  trained: number;
  status: 'ready' | 'training' | 'wounded';
  daysLeft: number;
}

export interface World {
  planetVersion: number;
  seed: number;
  difficulty: DifficultyId;
  day: number;
  status: WorldStatus;
  regions: RegionState[];
  /** The credit stockpile: income arrives daily, kit, research and hiring spend it. */
  credits: number;
  /** Finished research ids, and the one project in progress (one at a time). */
  research: { done: string[]; active: { node: string; daysLeft: number } | null };
  /** Everyone in the barracks, including those training or wounded. */
  soldiers: PoolSoldier[];
  /** The names picked for the next mission (at most four, all ready); loaned mercenaries fill the rest. */
  squad: string[];
  fallen: RosterSoldier[];
  namesUsed: number;
  stash: Stash;
}

/** What the tactical game needs to play one region fight. */
export interface MissionSpec {
  region: number;
  type: number;
  variation: number;
  difficulty: number;
  enemyLevel: number;
  seed: number;
}

/** A deterministic positive 31-bit seed from numbers (world seed, region, attempt). */
export function missionSeed(...parts: number[]): number {
  let h = 0x9e3779b1;
  for (const p of parts) h = Math.imul(h ^ (p | 0), 0x85ebca6b) ^ (h >>> 13);
  return (h >>> 1) || 1;
}

const HOLDER_AT_START = { start: 'player', enemy: 'enemy', neutral: 'neutral', wild: 'wild' } as const;

export function newWorld(seed: number, difficulty: DifficultyId): World {
  return {
    planetVersion: PLANET_VERSION,
    seed,
    difficulty,
    day: 0,
    status: 'active',
    regions: REGIONS.map((r) => ({ holder: HOLDER_AT_START[r.kind], garrison: r.garrison, visited: false, attempts: 0 })),
    credits: BASE_RULES.startCredits,
    research: { done: [], active: null },
    soldiers: Array.from({ length: CAMPAIGN.rosterSize }, (_, i) => ({
      name: soldierName(i), kills: 0, trained: 0, status: 'ready' as const, daysLeft: 0,
    })),
    squad: Array.from({ length: CAMPAIGN.rosterSize }, (_, i) => soldierName(i)),
    fallen: [],
    namesUsed: CAMPAIGN.rosterSize,
    stash: emptyStash(),
  };
}

const count = (w: World, ...holders: Holder[]): number => w.regions.filter((r) => holders.includes(r.holder)).length;

/** Regions the squad holds. */
export const regionsHeld = (w: World): number => count(w, 'player');

/** Regions that pay income: held and allied. */
export const incomeRegions = (w: World): number => count(w, 'player', 'allied');

/** Credits earned per day: every held or allied region pays the preset's rate plus one per supply-contracts level. */
export const incomePerDay = (w: World): number =>
  incomeRegions(w) * (DIFFICULTIES[w.difficulty].income + levelsOf(w.research.done).contracts);

export const capitalOpen = (w: World): boolean =>
  CAPITAL_GATES.filter((g) => w.regions[g].holder === 'player').length >= CAPITAL_UNLOCK;

const valid = (id: number): boolean => Number.isInteger(id) && id >= 0 && id < REGIONS.length;

const touchesFriendly = (w: World, id: number): boolean =>
  REGIONS[id].links.some((l) => w.regions[l].holder === 'player' || w.regions[l].holder === 'allied');

export function canAttack(w: World, id: number): boolean {
  if (w.status !== 'active' || !valid(id)) return false;
  if (w.regions[id].holder !== 'enemy' || !touchesFriendly(w, id)) return false;
  return id !== CAPITAL_REGION || capitalOpen(w);
}

export function canVisit(w: World, id: number): boolean {
  if (w.status !== 'active' || !valid(id)) return false;
  const s = w.regions[id];
  return (s.holder === 'neutral' || (s.holder === 'wild' && !s.visited)) && touchesFriendly(w, id);
}

/** Region ids the squad can attack now, ascending. */
export const attackable = (w: World): number[] => REGIONS.filter((r) => canAttack(w, r.id)).map((r) => r.id);

/** The fight for a region. Throws if the region cannot be attacked now. */
export function missionFor(w: World, id: number): MissionSpec {
  if (!canAttack(w, id)) throw new Error(`cannot attack region ${id}`);
  const r = REGIONS[id];
  const s = w.regions[id];
  return {
    region: id,
    type: r.type,
    variation: r.variation,
    difficulty: missionDifficulty(r, s.garrison),
    enemyLevel: r.type + 1,
    seed: missionSeed(w.seed, id, s.attempts),
  };
}

/**
 * Moves the calendar on day by day. On a growth day every enemy garrison below its cap gains one; on a counterattack
 * day (PRESSURE) the enemy may retake a liberated region, decided by a roll from the world seed and the day.
 */
export function advance(w: World, days: number): World {
  if (!Number.isInteger(days) || days < 0) throw new RangeError(`cannot advance ${days} days`);
  const rules = DIFFICULTIES[w.difficulty];
  let next = clone(w);
  for (let d = w.day + 1; d <= w.day + days; d++) {
    next.credits += incomePerDay(next);
    const project = next.research.active;
    if (project) {
      project.daysLeft -= 1;
      if (project.daysLeft <= 0) {
        next.research.done.push(project.node);
        next.research.active = null;
      }
    }
    for (const soldier of next.soldiers) {
      if (soldier.status === 'ready') continue;
      soldier.daysLeft -= 1;
      if (soldier.daysLeft > 0) continue;
      if (soldier.status === 'training') raiseByTraining(soldier, levelsOf(next.research.done).training);
      soldier.status = 'ready';
      soldier.daysLeft = 0;
    }
    if (rules.growthEvery !== null && d % rules.growthEvery === 0) {
      for (const r of REGIONS) {
        const s = next.regions[r.id];
        if (s.holder === 'enemy' && s.garrison < r.garrison + rules.growthCap) s.garrison += 1;
      }
    }
    if (rules.counterEvery !== null && d % rules.counterEvery === 0 && next.status === 'active') {
      next = counterattack(next, seededRandom(missionSeed(w.seed, 1000 + d))());
    }
  }
  next.day = w.day + days;
  return next;
}

/**
 * The enemy tries to retake the weakest liberated region that touches enemy ground (lowest base garrison, then lowest
 * id). It succeeds when `roll` is below attackers / (attackers + defenders), kept between 0.1 and 0.9. A region that
 * falls goes back to the enemy with its base garrison (at least 1). Losing the last held region loses the game.
 */
export function counterattack(w: World, roll: number): World {
  const enemyNeighbours = (id: number) => REGIONS[id].links.filter((l) => w.regions[l].holder === 'enemy');
  const targets = REGIONS
    .filter((r) => w.regions[r.id].holder === 'player' && enemyNeighbours(r.id).length > 0)
    .sort((a, b) => a.garrison - b.garrison || a.id - b.id);
  if (targets.length === 0) return w;
  const target = targets[0];
  const attackers = Math.max(...enemyNeighbours(target.id).map((l) => w.regions[l].garrison));
  const chance = Math.min(0.9, Math.max(0.1, attackers / (attackers + target.garrison + 1)));
  if (roll >= chance) return w;
  const next = clone(w);
  next.regions[target.id] = { ...next.regions[target.id], holder: 'enemy', garrison: Math.max(1, target.garrison) };
  if (regionsHeld(next) === 0) next.status = 'lost';
  return next;
}

/** A finished training stint lifts rank (kills plus training) to the next rank step, never past the facility level's cap. */
function raiseByTraining(s: PoolSoldier, level: number): void {
  const cap = level >= 1 ? BASE_RULES.trainCaps[level - 1] : 0;
  const effective = s.kills + s.trained;
  const step = RANKS.map((r) => r.minKills).find((m) => m > effective);
  if (step === undefined) return;
  s.trained += Math.max(0, Math.min(step, cap) - effective);
}

const clone = (w: World): World => ({
  ...w,
  regions: w.regions.map((r) => ({ ...r })),
  research: { done: [...w.research.done], active: w.research.active ? { ...w.research.active } : null },
  soldiers: w.soldiers.map((r) => ({ ...r })),
  squad: [...w.squad],
  fallen: w.fallen.map((r) => ({ ...r })),
  stash: { ...w.stash },
});

const LOOT_BY_REGION = ['rifle', 'pistol', 'clip'] as const;

/** A neutral settlement becomes an ally; a wilderness yields one stash item, once. Costs days. */
export function visit(w: World, id: number): World {
  if (!canVisit(w, id)) throw new Error(`cannot visit region ${id}`);
  const next = clone(w);
  const s = next.regions[id];
  if (s.holder === 'neutral') {
    s.holder = 'allied';
  } else {
    s.visited = true;
    next.stash = capStash(addStash(next.stash, stashOf({ [LOOT_BY_REGION[id % 3]]: 1 })));
  }
  return advance(next, DAYS.visit);
}

/**
 * Folds a finished fight into the world. The deployed soldiers' kills go to the pool; a dead soldier is gone for good
 * (a free replacement no longer exists: hire or borrow). The kit and loan fees are paid, the squad's kills pay a bounty,
 * a win takes the region (and the game when it is the capital), a loss costs extra days. The game is lost when no region
 * is held.
 */
export function resolve(w: World, spec: MissionSpec, finished: GameState, used: Loadout, kitCost: number): World {
  if (w.status !== 'active') throw new Error('the story is over');
  if (finished.status === 'playing') throw new Error('The mission is not finished');
  const won = finished.status === 'won';
  const { roster, mercs } = deployed(w);
  const players = finished.units.filter((u) => u.side === 'player');
  const next = clone(w);
  let bounty = 0;
  const dead: string[] = [];
  roster.forEach((r, i) => {
    const unit = players[i];
    if (!unit) return;
    bounty += BASE_RULES.bounty * unit.kills;
    if (i >= roster.length - mercs) return; // a loaned mercenary leaves no record
    const soldier = next.soldiers.find((x) => x.name === r.name);
    if (!soldier) return;
    soldier.kills += unit.kills;
    if (!unit.alive) dead.push(r.name);
  });
  // The field hospital: after a win, each dead soldier may be recovered wounded instead of lost.
  const chance = BASE_RULES.hospitalChance[levelsOf(w.research.done).hospital];
  const roll = seededRandom(missionSeed(w.seed, spec.region, w.regions[spec.region].attempts, 77));
  roll();
  roll();
  roll(); // the first values of nearby seeds are alike
  for (const name of dead) {
    const at = next.soldiers.findIndex((x) => x.name === name);
    if (won && roll() < chance) {
      next.soldiers[at].status = 'wounded';
      next.soldiers[at].daysLeft = BASE_RULES.woundedDays;
      continue;
    }
    const [gone] = next.soldiers.splice(at, 1);
    next.fallen.push({ name: gone.name, kills: gone.kills, trained: gone.trained });
  }
  next.credits = Math.max(0, next.credits - kitCost - BASE_RULES.mercFee * mercs) + bounty;
  if (won) next.stash = capStash(addStash(nextStash(w.stash, used, finished), lootFrom(finished)));
  next.squad = autoSquad(next);
  const region = next.regions[spec.region];
  region.attempts += 1;
  if (won) {
    region.holder = 'player';
    region.garrison = 0;
    if (spec.region === CAPITAL_REGION) next.status = 'won';
  }
  const advanced = advance(next, DAYS.attack + (won ? 0 : DAYS.lossPenalty));
  if (advanced.status === 'active' && regionsHeld(advanced) === 0) advanced.status = 'lost';
  return advanced;
}

/** Spends 1 or 3 days doing nothing: income, research, training and healing run, and so do the garrisons and counterattacks. */
export function wait(w: World, days: number): World {
  if (w.status !== 'active') throw new Error('the story is over');
  if (!(BASE_RULES.waitOptions as readonly number[]).includes(days)) throw new RangeError(`cannot wait ${days} days`);
  return advance(w, days);
}
