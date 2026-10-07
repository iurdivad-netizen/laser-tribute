import { describe, expect, it } from 'vitest';
import {
  HAZARD, THROWABLES, THROWABLE_IDS, TUTORIAL_LEVEL, WEAPONS, WEAPON_IDS, unlockedThrowables, unlockedWeapons,
} from '../src/core/config';

describe('the catalogue', () => {
  it('lists five weapons and four throwables, every id in its table', () => {
    expect([...WEAPON_IDS]).toEqual(['pistol', 'rifle', 'shotgun', 'smg', 'sniper']);
    expect([...THROWABLE_IDS]).toEqual(['frag', 'smoke', 'flash', 'incendiary']);
    for (const id of WEAPON_IDS) expect(WEAPONS[id].name.length).toBeGreaterThan(0);
    for (const id of THROWABLE_IDS) expect(THROWABLES[id].name.length).toBeGreaterThan(0);
  });

  it('keeps the old stats and adds the new ones from the spec', () => {
    expect(WEAPONS.rifle).toMatchObject({ damage: 30, range: 14, snapAp: 15, aimedAp: 30, magazine: 5, price: 25, unlockAt: 1 });
    expect(WEAPONS.pistol).toMatchObject({ damage: 18, range: 8, magazine: 8, price: 10, unlockAt: 1 });
    expect(WEAPONS.shotgun).toMatchObject({ damage: 45, range: 6, snapAp: 15, aimedAp: 25, magazine: 4, falloff: 0.9, price: 22, unlockAt: 2 });
    expect(WEAPONS.smg).toMatchObject({ damage: 12, range: 9, snapAp: 18, aimedAp: 28, magazine: 12, burst: 3, price: 28, unlockAt: 4 });
    expect(WEAPONS.sniper).toMatchObject({
      damage: 55, range: 16, snapAp: 25, aimedAp: 35, magazine: 3, falloff: 0.2, sight: 14, price: 40, unlockAt: 6,
      closePenalty: { within: 3, multiplier: 0.5 },
    });
    expect(THROWABLES.frag).toMatchObject({ apCost: 24, range: 8, radius: 1, damage: 40, breaksDoors: true, price: 8, unlockAt: 1 });
    expect(THROWABLES.smoke).toMatchObject({ apCost: 18, radius: 2, hazard: { kind: 'smoke', turns: 3 }, price: 10, unlockAt: 2 });
    expect(THROWABLES.flash).toMatchObject({ apCost: 18, radius: 2, apPenalty: 30, price: 10, unlockAt: 4 });
    expect(THROWABLES.incendiary).toMatchObject({ apCost: 24, radius: 1, damage: 15, hazard: { kind: 'fire', turns: 3 }, price: 14, unlockAt: 6 });
    expect(HAZARD.fireDamage).toBe(10);
  });

  it('unlocks along the ladder, and the tutorial is level 1', () => {
    expect(TUTORIAL_LEVEL).toBe(1);
    expect(unlockedWeapons(1)).toEqual(['pistol', 'rifle']);
    expect(unlockedWeapons(2)).toEqual(['pistol', 'rifle', 'shotgun']);
    expect(unlockedWeapons(4)).toEqual(['pistol', 'rifle', 'shotgun', 'smg']);
    expect(unlockedWeapons(10)).toEqual([...WEAPON_IDS]);
    expect(unlockedThrowables(1)).toEqual(['frag']);
    expect(unlockedThrowables(2)).toEqual(['frag', 'smoke']);
    expect(unlockedThrowables(4)).toEqual(['frag', 'smoke', 'flash']);
    expect(unlockedThrowables(6)).toEqual([...THROWABLE_IDS]);
  });
});
