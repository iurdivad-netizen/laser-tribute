import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { cheapLoadout, defaultLoadout, loadoutCost, validateLoadout } from '../src/core/loadout';
import { createMission } from '../src/core/missions';
import { emptyStash } from '../src/core/stash';
import type { GameState } from '../src/core/types';
import { BASE_RULES, storyGearRules } from '../src/core/world/base';
import { autoSquad, deployed, kitBudget, setSquad } from '../src/core/world/barracks';
import { DAYS } from '../src/core/world/difficulty';
import {
  advance, attackable, incomePerDay, missionFor, newWorld, resolve, type MissionSpec, type PoolSoldier, type World,
} from '../src/core/world/world';

const withSoldiers = (w: World, patch: Partial<PoolSoldier>[]): World => ({
  ...w,
  soldiers: w.soldiers.map((s, i) => ({ ...s, ...(patch[i] ?? {}) })),
});

/** A finished fight for the deployed squad: `dead` and `kills` by unit index. */
function finished(w: World, spec: MissionSpec, status: 'won' | 'lost', dead: number[] = [], kills: number[] = []): GameState {
  const def = generateMission(spec.type, spec.variation, spec.difficulty);
  const rules = storyGearRules(w.research.done);
  const s = createMission(def, spec.seed, deployed(w).roster, defaultLoadout(), 999, w.stash, rules, spec.enemyLevel);
  s.units.filter((u) => u.side === 'player').forEach((u, i) => {
    u.alive = !dead.includes(i);
    u.kills = kills[i] ?? 0;
  });
  s.status = status;
  return s;
}
const kitCost = (w: World) => loadoutCost(defaultLoadout(), emptyStash(), storyGearRules(w.research.done));

describe('a new story world', () => {
  const w = newWorld(1, 'calm');

  it('starts with credits, four ready rookies, a squad and no research', () => {
    expect(w.credits).toBe(BASE_RULES.startCredits);
    expect(w.soldiers.map((s) => s.name)).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(w.soldiers.every((s) => s.status === 'ready' && s.kills === 0 && s.trained === 0 && s.daysLeft === 0)).toBe(true);
    expect(w.squad).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(w.research).toEqual({ done: [], active: null });
    expect(w.namesUsed).toBe(4);
  });
});

describe('income and time', () => {
  it('pays credits per held and allied region per day', () => {
    const w = newWorld(1, 'calm');
    expect(incomePerDay(w)).toBe(4);
    const allied = { ...w, regions: w.regions.map((r, i) => (i === 5 ? { ...r, holder: 'allied' as const } : r)) };
    expect(incomePerDay(allied)).toBe(8);
    expect(incomePerDay({ ...allied, research: { done: ['contracts1'], active: null } })).toBe(10);
    expect(advance(w, 3).credits).toBe(150 + 12);
  });

  it('finishes research on its last day and not before', () => {
    const w = { ...newWorld(1, 'calm'), research: { done: [], active: { node: 'shotgun', daysLeft: 2 } } };
    expect(advance(w, 1).research.active).toEqual({ node: 'shotgun', daysLeft: 1 });
    const done = advance(w, 2);
    expect(done.research).toEqual({ done: ['shotgun'], active: null });
  });

  it('returns training and wounded soldiers to ready when their days run out', () => {
    const w = withSoldiers(newWorld(1, 'calm'), [
      { status: 'training', daysLeft: 1 }, { status: 'wounded', daysLeft: 2 },
    ]);
    const next = advance(w, 1);
    expect(next.soldiers[0]).toMatchObject({ status: 'ready', daysLeft: 0 });
    expect(next.soldiers[1]).toMatchObject({ status: 'wounded', daysLeft: 1 });
    expect(advance(w, 2).soldiers[1]).toMatchObject({ status: 'ready', daysLeft: 0 });
  });

  it('still returns an equal world for 0 days', () => {
    const w = newWorld(1, 'pressure');
    expect(advance(w, 0)).toEqual(w);
  });
});

describe('squad and loans', () => {
  it('tops a short squad up with loaned mercenaries', () => {
    const w = { ...newWorld(1, 'calm'), squad: ['Alvarez', 'Brandt', 'Chen'] };
    const d = deployed(w);
    expect(d.roster).toHaveLength(4);
    expect(d.mercs).toBe(1);
    expect(d.roster[3]).toEqual({ name: 'Loan 1', kills: 0 });
    expect(d.roster[0]).toEqual({ name: 'Alvarez', kills: 0, trained: 0 });
  });

  it('fields four mercenaries when nobody is available', () => {
    const w = { ...newWorld(1, 'calm'), soldiers: [], squad: [] };
    const d = deployed(w);
    expect(d.mercs).toBe(4);
    expect(d.roster.map((r) => r.name)).toEqual(['Loan 1', 'Loan 2', 'Loan 3', 'Loan 4']);
  });

  it('skips a soldier who is training', () => {
    const w = withSoldiers(newWorld(1, 'calm'), [{ status: 'training', daysLeft: 3 }]);
    const d = deployed(w);
    expect(d.roster.map((r) => r.name)).toEqual(['Brandt', 'Chen', 'Dubois', 'Loan 1']);
    expect(d.mercs).toBe(1);
  });

  it('picks the four best ready soldiers automatically', () => {
    const w = withSoldiers(newWorld(1, 'calm'), [{ kills: 1 }, { kills: 5 }, { kills: 0, trained: 3 }, { kills: 0 }]);
    const six = { ...w, soldiers: [...w.soldiers, { name: 'Eriksen', kills: 4, trained: 0, status: 'ready' as const, daysLeft: 0 }, { name: 'Fontaine', kills: 0, trained: 0, status: 'ready' as const, daysLeft: 0 }] };
    expect(autoSquad(six)).toEqual(['Brandt', 'Eriksen', 'Chen', 'Alvarez']);
  });

  it('rejects an invalid squad', () => {
    const w = withSoldiers(newWorld(1, 'calm'), [{ status: 'wounded', daysLeft: 2 }]);
    expect(() => setSquad(w, ['Brandt', 'Chen', 'Dubois', 'Brandt'])).toThrow();
    expect(() => setSquad(w, ['Alvarez'])).toThrow(); // wounded
    expect(() => setSquad(w, ['Nobody'])).toThrow();
    expect(() => setSquad(w, ['Brandt', 'Chen', 'Dubois', 'X', 'Y'])).toThrow();
    expect(setSquad(w, ['Chen', 'Brandt']).squad).toEqual(['Chen', 'Brandt']);
  });

  it('subtracts loan fees from the kit budget', () => {
    const w = { ...newWorld(1, 'calm'), squad: ['Alvarez', 'Brandt'] };
    expect(kitBudget(w)).toBe(150 - 2 * BASE_RULES.mercFee);
  });

  it('always leaves enough to field the cheapest kit, so a broke player can still fight', () => {
    const cheap = loadoutCost(cheapLoadout());
    const broke = { ...newWorld(1, 'calm'), credits: 0, squad: [] as string[] };
    expect(kitBudget(broke)).toBe(cheap);
    expect(validateLoadout(cheapLoadout(), kitBudget(broke), emptyStash(), storyGearRules([]))).toBeNull();
    expect(validateLoadout(defaultLoadout(), kitBudget(broke), emptyStash(), storyGearRules([]))).not.toBeNull();
  });
});

describe('resolve', () => {
  const target = (w: World) => attackable(w)[0];

  it('pays the bounty and the kit, folds kills into the pool and spends days', () => {
    const w = newWorld(1, 'calm');
    const spec = missionFor(w, target(w));
    const next = resolve(w, spec, finished(w, spec, 'won', [], [2, 1]), defaultLoadout(), kitCost(w));
    // two regions are held while the 3 days pass: income 2 * 4 per day
    expect(next.credits).toBe(150 - kitCost(w) + 5 * 3 + 2 * 4 * DAYS.attack);
    expect(next.soldiers.map((s) => s.kills)).toEqual([2, 1, 0, 0]);
    expect(next.regions[spec.region].holder).toBe('player');
    expect(next.day).toBe(DAYS.attack);
    expect(next.squad).toEqual(autoSquad(next));
  });

  it('moves a dead soldier to the fallen and gives no free replacement', () => {
    const w = newWorld(1, 'calm');
    const spec = missionFor(w, target(w));
    const next = resolve(w, spec, finished(w, spec, 'won', [1], [0, 3]), defaultLoadout(), kitCost(w));
    expect(next.soldiers.map((s) => s.name)).toEqual(['Alvarez', 'Chen', 'Dubois']);
    expect(next.fallen).toEqual([{ name: 'Brandt', kills: 3, trained: 0 }]);
    expect(next.namesUsed).toBe(4);
  });

  it('leaves an empty pool and squad after a wiped squad, and the world keeps going', () => {
    const w = newWorld(1, 'calm');
    const spec = missionFor(w, target(w));
    const next = resolve(w, spec, finished(w, spec, 'lost', [0, 1, 2, 3]), defaultLoadout(), kitCost(w));
    expect(next.soldiers).toEqual([]);
    expect(next.squad).toEqual([]);
    expect(next.fallen).toHaveLength(4);
    expect(next.status).toBe('active');
    expect(next.regions[spec.region].holder).toBe('enemy');
    expect(next.day).toBe(DAYS.attack + DAYS.lossPenalty);
    expect(deployed(next).mercs).toBe(4);
  });

  it('never takes credits below zero for the kit and loan fees', () => {
    const w = { ...newWorld(1, 'calm'), credits: 3, squad: [] as string[] };
    const spec = missionFor(w, target(w));
    const next = resolve(w, spec, finished(w, spec, 'lost', [0, 1, 2, 3]), defaultLoadout(), kitCost(w));
    expect(next.credits).toBeGreaterThanOrEqual(0);
  });

  it('does not credit loaned mercenaries with kills in the pool', () => {
    const w = { ...newWorld(1, 'calm'), squad: ['Alvarez', 'Brandt', 'Chen'] };
    const spec = missionFor(w, target(w));
    const next = resolve(w, spec, finished(w, spec, 'won', [], [0, 0, 0, 4]), defaultLoadout(), kitCost(w));
    expect(next.soldiers.map((s) => s.kills)).toEqual([0, 0, 0, 0]);
    expect(next.credits).toBeGreaterThan(w.credits - kitCost(w) - BASE_RULES.mercFee); // the bounty still pays
  });
});
