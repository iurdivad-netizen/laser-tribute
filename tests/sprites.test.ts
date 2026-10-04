import { describe, expect, it } from 'vitest';
import { flipHorizontal, parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

/** The average position of the skin pixels: where the face (and hands) are. */
function skinCentre(name: string): { x: number; y: number } {
  const rows = SPRITE_ROWS[name as keyof typeof SPRITE_ROWS];
  let n = 0;
  let sx = 0;
  let sy = 0;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 's') { n += 1; sx += x; sy += y; }
  }));
  return { x: sx / n, y: sy / n };
}

describe('the sprite data', () => {
  it('has exactly the 31 named sprites', () => {
    expect(SPRITE_NAMES).toHaveLength(31);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual([...SPRITE_NAMES].sort());
  });

  it('every sprite is 16x16, uses only palette letters, has pixels, and flips back to itself', () => {
    for (const name of SPRITE_NAMES) {
      const s = parseSprite(name, SPRITE_ROWS[name]);
      expect(s.pixels.some((p) => p !== null), name).toBe(true);
      expect(flipHorizontal(flipHorizontal(s)).pixels, name).toEqual(s.pixels);
    }
  });

  it('the north soldier is left-right symmetric, so mirrored facings are right', () => {
    for (const row of SPRITE_ROWS.soldier_n) expect([...row].reverse().join('')).toBe(row);
  });

  it('the face points the way the soldier faces, in every direction', () => {
    expect(skinCentre('soldier_n').y).toBeLessThan(7.2);
    expect(skinCentre('soldier_s').y).toBeGreaterThan(7.8);
    expect(skinCentre('soldier_e').x).toBeGreaterThan(7.8);
    const ne = skinCentre('soldier_ne');
    expect(ne.x).toBeGreaterThan(7.8);
    expect(ne.y).toBeLessThan(7.2);
    const se = skinCentre('soldier_se');
    expect(se.x).toBeGreaterThan(7.8);
    expect(se.y).toBeGreaterThan(7.8);
  });

  it('every direction keeps a whole soldier (a similar number of opaque pixels)', () => {
    const count = (name: keyof typeof SPRITE_ROWS) => SPRITE_ROWS[name].join('').replace(/\./g, '').length;
    const n = count('soldier_n');
    for (const name of ['soldier_ne', 'soldier_e', 'soldier_se', 'soldier_s'] as const) {
      expect(count(name)).toBeGreaterThan(n * 0.8);
      expect(count(name)).toBeLessThan(n * 1.2);
    }
  });

  it('the enemy is the soldier in red: no blue, some red, same shape', () => {
    for (const suffix of ['n', 'ne', 'e', 'se', 's']) {
      const soldier = SPRITE_ROWS[`soldier_${suffix}` as 'soldier_n'].join('');
      const enemy = SPRITE_ROWS[`enemy_${suffix}` as 'enemy_n'].join('');
      expect(enemy).not.toMatch(/[BCN]/);
      expect(enemy).toMatch(/R/);
      expect(enemy.replace(/[^.]/g, 'x')).toBe(soldier.replace(/[^.]/g, 'x'));
    }
  });

  it('the three floors differ from each other, and the walls and doors are solid tiles', () => {
    expect(SPRITE_ROWS.floor_0).not.toEqual(SPRITE_ROWS.floor_1);
    expect(SPRITE_ROWS.floor_1).not.toEqual(SPRITE_ROWS.floor_2);
    for (const name of ['wall', 'door_closed', 'door_open'] as const) {
      expect(SPRITE_ROWS[name].join('')).not.toMatch(/\./);
    }
  });
});
