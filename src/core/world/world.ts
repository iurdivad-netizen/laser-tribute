import { CAMPAIGN, soldierName, type RosterSoldier } from '../campaign';
import { emptyStash, type Stash } from '../stash';
import { DIFFICULTIES, type DifficultyId } from './difficulty';
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

export interface World {
  planetVersion: number;
  seed: number;
  difficulty: DifficultyId;
  day: number;
  status: WorldStatus;
  regions: RegionState[];
  roster: RosterSoldier[];
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
    roster: Array.from({ length: CAMPAIGN.rosterSize }, (_, i) => ({ name: soldierName(i), kills: 0 })),
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

/** The equipment budget: 120 plus income per region plus 5 per kill of a living soldier. Not stockpiled. */
export function storyBudget(w: World): number {
  const kills = w.roster.reduce((sum, r) => sum + r.kills, 0);
  return CAMPAIGN.baseBudget + DIFFICULTIES[w.difficulty].income * incomeRegions(w) + CAMPAIGN.killBonus * kills;
}

/** The player's gear level: 1 plus a level for every three enemy regions taken, at most 10. */
export function gearLevel(w: World): number {
  const taken = REGIONS.filter((r) => r.kind === 'enemy' && w.regions[r.id].holder === 'player').length;
  return Math.min(10, 1 + Math.floor(taken / 3));
}

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
