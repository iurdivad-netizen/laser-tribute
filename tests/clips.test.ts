import { describe, expect, it } from 'vitest';
import {
  LOADOUT, applyLoadout, cheapLoadout, defaultLoadout, fitLoadout, loadoutCost, soldierCost,
  validateLoadout, type Loadout,
} from '../src/core/loadout';
import { createMission1 } from '../src/core/mission1';
import { unit } from './helpers';

const withClips = (clips: number[]): Loadout => defaultLoadout().map((s, i) => ({ ...s, clips: clips[i] ?? 1 }));

describe('spare clips in the loadout', () => {
  it('the default kit has one clip each and still costs 102', () => {
    const l = defaultLoadout();
    expect(l.every((s) => s.clips === 1)).toBe(true);
    expect(loadoutCost(l)).toBe(102);
    expect(validateLoadout(l)).toBeNull();
    expect(LOADOUT.prices.clip).toBe(5);
  });

  it('the first clip is free, each further clip costs 5', () => {
    expect(loadoutCost(withClips([2, 1, 1, 1]))).toBe(107);
    expect(loadoutCost(withClips([4, 1, 1, 1]))).toBe(117); // 3 extra clips: +15
    expect(soldierCost({ weapon: 'rifle', grenades: 1, clips: 3 })).toBe(25 + 8 + 10);
  });

  it('rejects 0 clips, more than 4, and non-integers', () => {
    expect(validateLoadout(withClips([0, 1, 1, 1]))).toMatch(/Soldier 1 must carry 1 to 4 spare clips/);
    expect(validateLoadout(withClips([1, 5, 1, 1]))).toMatch(/Soldier 2 must carry 1 to 4 spare clips/);
    expect(validateLoadout(withClips([1, 1, 2.5, 1]))).toMatch(/Soldier 3 must carry 1 to 4 spare clips/);
  });

  it('extra clips can push a loadout over the budget', () => {
    const l = withClips([4, 4, 4, 4]); // 102 + 4 * 15 = 162
    expect(loadoutCost(l)).toBe(162);
    expect(validateLoadout(l, 120)).toMatch(/budget/);
    expect(validateLoadout(l, 162)).toBeNull();
  });

  it('cheapLoadout and fitLoadout keep the field', () => {
    expect(cheapLoadout().every((s) => s.clips === 1)).toBe(true);
    const prev = withClips([2, 1, 1, 1]);
    expect(fitLoadout(prev, 120)).toBe(prev);
    const tooBig = withClips([4, 4, 4, 4]);
    expect(fitLoadout(tooBig, 120).every((s) => s.clips === 1)).toBe(true);
    expect(fitLoadout(tooBig, 120).map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
  });

  it('applyLoadout sets the clips and refills ammo for the chosen weapon', () => {
    const l = withClips([3, 1, 2, 4]);
    l[1] = { weapon: 'pistol', grenades: 1, clips: 1 }; // p2 is a rifleman on the map, a pistol soldier here
    l[2] = { weapon: 'rifle', grenades: 1, clips: 2 }; // p3 is a pistol soldier on the map, a rifleman here
    const next = applyLoadout(createMission1(), l, 200);
    expect(unit(next, 'p1')).toMatchObject({ clips: 3, ammo: 5 });
    expect(unit(next, 'p2')).toMatchObject({ weapon: 'pistol', clips: 1, ammo: 8 });
    expect(unit(next, 'p3')).toMatchObject({ weapon: 'rifle', clips: 2, ammo: 5 });
    expect(unit(next, 'p4')).toMatchObject({ clips: 4 });
  });
});
