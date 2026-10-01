import { describe, expect, it } from 'vitest';
import {
  applyLoadout, defaultLoadout, loadoutCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { createMission1 } from '../src/core/mission1';
import { corridorRows, makeState, unit } from './helpers';

const four = (weapon: 'pistol' | 'rifle', grenades: number): Loadout =>
  Array.from({ length: 4 }, () => ({ weapon, grenades }));

describe('loadout cost and validity', () => {
  it("default loadout is milestone 1's kit: costs 102 and is valid", () => {
    const l = defaultLoadout();
    expect(l.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
    expect(l.map((s) => s.grenades)).toEqual([1, 1, 1, 1]);
    expect(loadoutCost(l)).toBe(102);
    expect(validateLoadout(l)).toBeNull();
  });

  it('four rifles cost 100, leaving only 20 credits', () => {
    expect(loadoutCost(four('rifle', 0))).toBe(100);
    const l = four('rifle', 0);
    l[0].grenades = 1;
    l[1].grenades = 1; // two grenades in total: 116
    expect(loadoutCost(l)).toBe(116);
    expect(validateLoadout(l)).toBeNull();
  });

  it('accepts a loadout that spends exactly the budget', () => {
    const l: Loadout = [
      { weapon: 'pistol', grenades: 3 },
      { weapon: 'pistol', grenades: 3 },
      { weapon: 'pistol', grenades: 3 },
      { weapon: 'pistol', grenades: 1 },
    ];
    expect(loadoutCost(l)).toBe(120);
    expect(validateLoadout(l)).toBeNull();
  });

  it('rejects a loadout over budget', () => {
    const l = four('rifle', 0);
    l[0].grenades = 3; // 124
    expect(validateLoadout(l)).toMatch(/budget/);
    expect(validateLoadout(four('rifle', 3))).toMatch(/budget/);
  });

  it('rejects the wrong squad size', () => {
    expect(validateLoadout(four('pistol', 0).slice(0, 3))).toMatch(/exactly 4/);
  });

  it('rejects a missing or unknown weapon', () => {
    const l = four('pistol', 0);
    (l[1] as { weapon: string }).weapon = 'grenade';
    expect(validateLoadout(l)).toMatch(/Soldier 2 needs a weapon/);
  });

  it('rejects grenade counts below 0, above 3, fractional or NaN', () => {
    for (const bad of [-1, 4, 1.5, NaN]) {
      const l = four('pistol', 0);
      l[2].grenades = bad;
      expect(validateLoadout(l)).toMatch(/grenades/);
    }
  });
});

describe('applyLoadout', () => {
  const custom: Loadout = [
    { weapon: 'rifle', grenades: 0 },
    { weapon: 'pistol', grenades: 2 },
    { weapon: 'rifle', grenades: 1 },
    { weapon: 'pistol', grenades: 3 },
  ]; // cost 118

  it('sets weapon and grenades on the right soldiers without touching the input', () => {
    const s = createMission1();
    const next = applyLoadout(s, custom);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).weapon)).toEqual([
      'rifle', 'pistol', 'rifle', 'pistol',
    ]);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).grenades)).toEqual([0, 2, 1, 3]);
    expect(unit(s, 'p3').weapon).toBe('pistol'); // original untouched
    expect(unit(s, 'p1').grenades).toBe(1);
  });

  it('throws on an invalid loadout', () => {
    expect(() => applyLoadout(createMission1(), four('rifle', 3))).toThrow(/budget/);
  });

  it('throws when the squad size does not match the loadout', () => {
    const tiny = makeState(corridorRows('P..E')); // one soldier
    expect(() => applyLoadout(tiny, defaultLoadout())).toThrow(/squad/);
  });
});

describe('createMission1 with a loadout', () => {
  it('uses the loadout and the seed', () => {
    const s = createMission1(5, [
      { weapon: 'rifle', grenades: 0 },
      { weapon: 'pistol', grenades: 2 },
      { weapon: 'rifle', grenades: 1 },
      { weapon: 'pistol', grenades: 3 },
    ]);
    expect(s.rngState).toBe(5);
    expect(unit(s, 'p2')).toMatchObject({ weapon: 'pistol', grenades: 2 });
    expect(unit(s, 'p4')).toMatchObject({ weapon: 'pistol', grenades: 3 });
  });

  it('is unchanged without a loadout', () => {
    const s = createMission1();
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', grenades: 1 });
    expect(unit(s, 'p3')).toMatchObject({ weapon: 'pistol', grenades: 1 });
  });
});
