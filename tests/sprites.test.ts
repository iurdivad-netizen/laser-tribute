import { describe, expect, it } from 'vitest';
import { flipHorizontal, parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

describe('the sprite data', () => {
  it('has exactly the 21 named sprites (the soldiers and enemies are figures now)', () => {
    expect(SPRITE_NAMES).toHaveLength(21);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual([...SPRITE_NAMES].sort());
    expect(SPRITE_NAMES.some((n) => n.startsWith('soldier_') || n.startsWith('enemy_'))).toBe(false);
  });

  it('every sprite is 16x16, uses only palette letters, has pixels, and flips back to itself', () => {
    for (const name of SPRITE_NAMES) {
      const s = parseSprite(name, SPRITE_ROWS[name]);
      expect(s.pixels.some((p) => p !== null), name).toBe(true);
      expect(flipHorizontal(flipHorizontal(s)).pixels, name).toEqual(s.pixels);
    }
  });

  it('the three floors differ from each other, and the walls and doors are solid tiles', () => {
    expect(SPRITE_ROWS.floor_0).not.toEqual(SPRITE_ROWS.floor_1);
    expect(SPRITE_ROWS.floor_1).not.toEqual(SPRITE_ROWS.floor_2);
    for (const name of ['wall', 'door_closed', 'door_open'] as const) {
      expect(SPRITE_ROWS[name].join('')).not.toMatch(/\./);
    }
  });

  it('the enemy corpse is the soldier corpse in red', () => {
    expect(SPRITE_ROWS.corpse_enemy.join('')).not.toMatch(/[BCN]/);
    expect(SPRITE_ROWS.corpse_enemy.join('').replace(/[^.]/g, 'x')).toBe(SPRITE_ROWS.corpse_player.join('').replace(/[^.]/g, 'x'));
  });
});
