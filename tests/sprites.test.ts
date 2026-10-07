import { describe, expect, it } from 'vitest';
import { flipHorizontal, parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

describe('the sprite data', () => {
  it('has exactly the 14 named effect sprites (tiles, doors, items and corpses are images now)', () => {
    expect(SPRITE_NAMES).toHaveLength(14);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual([...SPRITE_NAMES].sort());
    expect(SPRITE_NAMES.some((n) => /^(soldier|enemy|floor|wall|door|item|corpse)/.test(n))).toBe(false);
  });

  it('every sprite is 16x16, uses only palette letters, has pixels, and flips back to itself', () => {
    for (const name of SPRITE_NAMES) {
      const s = parseSprite(name, SPRITE_ROWS[name]);
      expect(s.pixels.some((p) => p !== null), name).toBe(true);
      expect(flipHorizontal(flipHorizontal(s)).pixels, name).toEqual(s.pixels);
    }
  });
});
