import { describe, expect, it } from 'vitest';
import { parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

const opaque = (name: (typeof SPRITE_NAMES)[number]) => SPRITE_ROWS[name].join('').replace(/\./g, '').length;
const OUTLINED = ['flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash', 'boom_0', 'boom_1', 'boom_2'] as const;

describe('the effect sprites', () => {
  it('are exactly the ten effects, each 16x16 with palette letters only', () => {
    expect([...SPRITE_NAMES]).toEqual(['flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash', 'boom_0', 'boom_1', 'boom_2', 'boom_3']);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual([...SPRITE_NAMES].sort());
    for (const name of SPRITE_NAMES) {
      const s = parseSprite(name, SPRITE_ROWS[name]);
      expect(s.pixels.some((p) => p !== null), name).toBe(true);
    }
  });

  it('have a dark outline: every opaque pixel with a transparent neighbour is outline', () => {
    for (const name of OUTLINED) {
      const rows = SPRITE_ROWS[name];
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (rows[y + dy]?.[x + dx] ?? '.') === '.');
        if (open) expect(ch, `${name} at ${x},${y}`).toBe('k');
      }));
    }
  });

  it('keeps the big flash bigger than the small one, and the slash longer on its second frame', () => {
    expect(opaque('flash_0')).toBeGreaterThan(opaque('flash_1'));
    expect(opaque('slash_1')).toBeGreaterThan(opaque('slash_0'));
  });

  it('grows the explosion, then leaves a hollow ring', () => {
    expect(opaque('boom_0')).toBeLessThan(opaque('boom_1'));
    expect(opaque('boom_1')).toBeLessThan(opaque('boom_2'));
    expect(SPRITE_ROWS.boom_3[7][7]).toBe('.');
    expect(SPRITE_ROWS.boom_3.join('')).toMatch(/M/);
  });

  it('draws the spark red and the blood dark red', () => {
    expect(SPRITE_ROWS.spark.join('')).toMatch(/R/);
    expect(SPRITE_ROWS.splash.join('')).toMatch(/u/);
    expect(SPRITE_ROWS.splash.join('')).not.toMatch(/[BCN]/);
  });
});
