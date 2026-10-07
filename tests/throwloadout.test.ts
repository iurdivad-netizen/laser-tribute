import { describe, expect, it } from 'vitest';
import { applyLoadout, defaultLoadout, loadoutCost, soldierCost, validateLoadout } from '../src/core/loadout';
import { createMission, MISSIONS } from '../src/core/missions';
import { STASH_KEYS, emptyStash, stashOf, throwableKey } from '../src/core/stash';

describe('throwables in the loadout', () => {
  it('defaults to frag and prices the kind from the table', () => {
    expect(defaultLoadout()[0].throwable).toBeUndefined();
    const base = { weapon: 'pistol' as const, grenades: 2, clips: 1 };
    expect(soldierCost(base)).toBe(10 + 8 * 2);
    expect(soldierCost({ ...base, throwable: 'smoke' })).toBe(10 + 10 * 2);
    expect(soldierCost({ ...base, weapon: 'smg', throwable: 'incendiary' })).toBe(28 + 14 * 2);
  });

  it('puts the throwable on the unit, frag when none is chosen', () => {
    const l = defaultLoadout();
    l[1] = { ...l[1], throwable: 'smoke' };
    const s = applyLoadout(createMission(MISSIONS[0], 1), l, 999, stashOf({ smoke: 1 }));
    const soldiers = s.units.filter((u) => u.side === 'player');
    expect(soldiers[0].throwable).toBe('frag');
    expect(soldiers[1].throwable).toBe('smoke');
  });

  it('is free when the stash holds that kind', () => {
    const l = defaultLoadout().map((x) => ({ ...x, grenades: 0 }));
    l[0] = { ...l[0], grenades: 2, throwable: 'smoke' };
    const paid = loadoutCost(l);
    const free = loadoutCost(l, stashOf({ smoke: 2 }));
    expect(paid - free).toBe(20);
  });

  it('rejects an unknown throwable', () => {
    const l = defaultLoadout();
    (l[0] as { throwable?: string }).throwable = 'laser';
    expect(validateLoadout(l, 999)).toMatch(/throwable/);
  });
});

describe('the keyed stash', () => {
  it('has a key for every weapon and throwable and starts empty', () => {
    expect(STASH_KEYS).toEqual(expect.arrayContaining(['rifle', 'pistol', 'shotgun', 'smg', 'sniper', 'grenade', 'smoke', 'flash', 'incendiary', 'clip', 'medkit', 'armour', 'scanner', 'scope']));
    for (const k of STASH_KEYS) expect(emptyStash()[k]).toBe(0);
    expect(throwableKey('frag')).toBe('grenade');
    expect(throwableKey('smoke')).toBe('smoke');
  });
});
