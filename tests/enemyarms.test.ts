import { describe, expect, it } from 'vitest';
import { assignEnemyWeapons } from '../src/core/enemyArms';
import { WEAPONS, unlockedWeapons } from '../src/core/config';
import { createMission, MISSIONS } from '../src/core/missions';
import { itemImage } from '../src/art/theme';

const enemies = (level: number, seed: number) =>
  createMission(MISSIONS[2], seed, undefined, undefined, undefined, undefined, level).units.filter((u) => u.side === 'enemy');

describe('enemy weapons by level', () => {
  it('leaves the tutorial and level 1 as they are: alternating rifle and pistol', () => {
    expect(enemies(1, 7).map((u) => u.weapon)).toEqual(
      createMission(MISSIONS[2], 7).units.filter((u) => u.side === 'enemy').map((u) => u.weapon),
    );
  });

  it('never gives a weapon above the level, and uses every unlocked weapon over many seeds', () => {
    for (const level of [2, 3, 4, 5, 6, 9]) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) for (const u of enemies(level, seed)) {
        expect(unlockedWeapons(level)).toContain(u.weapon);
        expect(u.ammo).toBe(WEAPONS[u.weapon].magazine);
        seen.add(u.weapon);
      }
      expect([...seen].sort()).toEqual([...unlockedWeapons(level)].sort());
    }
  }, 30000);

  it('is deterministic for a seed and varies between seeds', () => {
    expect(enemies(6, 5).map((u) => u.weapon)).toEqual(enemies(6, 5).map((u) => u.weapon));
    const sets = new Set(Array.from({ length: 20 }, (_, i) => enemies(6, i + 1).map((u) => u.weapon).join()));
    expect(sets.size).toBeGreaterThan(3);
  });

  it('does not touch the random stream', () => {
    const a = createMission(MISSIONS[2], 11);
    const b = createMission(MISSIONS[2], 11, undefined, undefined, undefined, undefined, 6);
    expect(b.rngState).toBe(a.rngState);
    expect(b.critState).toBe(a.critState);
  });
});

describe('floor items for the new weapons', () => {
  it('have an image each', () => {
    expect(itemImage('shotgun').name).toBe('item_shotgun');
    expect(itemImage('smg').name).toBe('item_smg');
    expect(itemImage('sniper').name).toBe('item_sniper');
  });
});
