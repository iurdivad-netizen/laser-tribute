import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { CAPITAL_GATES, CAPITAL_REGION, REGIONS, START_REGION } from '../src/core/world/planet';
import {
  attackable, canAttack, canVisit, capitalOpen, incomePerDay, incomeRegions, missionFor, newWorld, regionsHeld,
  type Holder, type World,
} from '../src/core/world/world';

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});
const enemyIds = REGIONS.filter((r) => r.kind === 'enemy').map((r) => r.id);
const firstGate = CAPITAL_GATES[0];

describe('newWorld', () => {
  const w = newWorld(1, 'calm');

  it('starts on day 0 holding only the landing zone with four rookies', () => {
    expect(w.day).toBe(0);
    expect(w.status).toBe('active');
    expect(w.regions[START_REGION].holder).toBe('player');
    expect(regionsHeld(w)).toBe(1);
    expect(w.soldiers.map((r) => r.name)).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(w.namesUsed).toBe(4);
    expect(w.fallen).toEqual([]);
  });

  it('sets holders and base garrisons from the planet', () => {
    for (const r of REGIONS) {
      const s = w.regions[r.id];
      expect(s.garrison).toBe(r.garrison);
      expect(s.holder).toBe({ start: 'player', enemy: 'enemy', neutral: 'neutral', wild: 'wild' }[r.kind]);
      expect(s.visited).toBe(false);
      expect(s.attempts).toBe(0);
    }
  });

  it('starts with 150 credits and a daily income per preset', () => {
    expect(w.credits).toBe(150);
    expect(incomePerDay(w)).toBe(4);
    expect(incomePerDay(newWorld(1, 'standard'))).toBe(3);
    expect(incomePerDay(newWorld(1, 'pressure'))).toBe(2);
  });

  it('can attack only the enemy regions linked to held ground', () => {
    const expected = REGIONS[START_REGION].links.filter((l) => REGIONS[l].kind === 'enemy').sort((a, b) => a - b);
    expect(attackable(w)).toEqual(expected);
    expect(capitalOpen(w)).toBe(false);
  });
});

describe('queries', () => {
  it('counts allied regions for income but not as held', () => {
    const w = hold(newWorld(1, 'calm'), [5], 'allied');
    expect(regionsHeld(w)).toBe(1);
    expect(incomeRegions(w)).toBe(2);
    expect(incomePerDay(w)).toBe(8);
  });

  it('opens the capital once two gates are held', () => {
    const base = newWorld(1, 'calm');
    expect(capitalOpen(hold(base, [firstGate]))).toBe(false);
    expect(capitalOpen(hold(base, CAPITAL_GATES.slice(0, 2)))).toBe(true);
  });

  it('lets the capital be attacked only when open and linked to held ground', () => {
    const base = newWorld(1, 'calm');
    expect(canAttack(hold(base, CAPITAL_GATES.slice(0, 2)), CAPITAL_REGION)).toBe(true);
    expect(canAttack(base, CAPITAL_REGION)).toBe(false);
  });

  it('can visit a neutral region linked to held ground and nothing else', () => {
    const w = newWorld(1, 'calm');
    expect(canVisit(w, 5)).toBe(true);
    expect(canVisit(w, 1)).toBe(false); // enemy
    expect(canVisit(w, 27)).toBe(false); // neutral but not linked to held ground
    expect(canVisit(w, START_REGION)).toBe(false); // held
    expect(canVisit({ ...w, status: 'won' }, 5)).toBe(false);
  });
});

describe('missionFor', () => {
  const w = newWorld(7, 'standard');
  const id = attackable(w)[0];

  it('describes the region fight deterministically', () => {
    const spec = missionFor(w, id);
    const r = REGIONS[id];
    expect(spec).toMatchObject({ region: id, type: r.type, variation: r.variation, difficulty: r.type + 1, enemyLevel: r.type + 1 });
    expect(spec.seed).toBeGreaterThan(0);
    expect(missionFor(w, id).seed).toBe(spec.seed);
    const again = { ...w, regions: w.regions.map((s, i) => (i === id ? { ...s, attempts: 1 } : s)) };
    expect(missionFor(again, id).seed).not.toBe(spec.seed);
    expect(() => generateMission(spec.type, spec.variation, spec.difficulty)).not.toThrow();
  });

  it('follows the garrison into the difficulty', () => {
    const grown = { ...w, regions: w.regions.map((s, i) => (i === id ? { ...s, garrison: s.garrison + 2 } : s)) };
    expect(missionFor(grown, id).difficulty).toBe(REGIONS[id].type + 3);
  });

  it('rejects illegal targets and leaves the world untouched', () => {
    const before = JSON.parse(JSON.stringify(w));
    const unlinked = enemyIds.find((e) => !canAttack(w, e) && e !== CAPITAL_REGION)!;
    for (const bad of [CAPITAL_REGION, unlinked, START_REGION, 5, 27, -1, 30, 1.5]) {
      expect(canAttack(w, bad)).toBe(false);
      expect(() => missionFor(w, bad)).toThrow();
    }
    expect(JSON.parse(JSON.stringify(w))).toEqual(before);
  });
});
