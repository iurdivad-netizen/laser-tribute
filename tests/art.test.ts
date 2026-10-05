import { describe, expect, it } from 'vitest';
import { PALETTE, TRANSPARENT } from '../src/art/palette';
import {
  ARMOUR_PIP, SPRITE_SIZE, directionTo, flipHorizontal, floorVariant, frameFor, parseSprite, pipPositions,
  rankPips, recolorRows, rotateRows, unitSprite,
} from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';
import type { Facing, WeaponId } from '../src/core/types';

const row = (ch: string) => ch.repeat(SPRITE_SIZE);
const blank = () => Array.from({ length: SPRITE_SIZE }, () => row('.'));

describe('palette', () => {
  it('uses single characters, valid colours, and keeps . free for transparency', () => {
    expect(TRANSPARENT).toBe('.');
    for (const [ch, colour] of Object.entries(PALETTE)) {
      expect(ch.length).toBe(1);
      expect(ch).not.toBe('.');
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('parseSprite and flipHorizontal', () => {
  it('parses a grid into pixels, transparent as null', () => {
    const rows = blank();
    rows[0] = 'k' + row('.').slice(1);
    const s = parseSprite('t', rows);
    expect(s).toMatchObject({ name: 't', width: 16, height: 16 });
    expect(s.pixels[0]).toBe('k');
    expect(s.pixels[1]).toBeNull();
    expect(s.pixels).toHaveLength(256);
  });

  it('rejects a wrong number of rows, a wrong row length and an unknown colour', () => {
    expect(() => parseSprite('t', blank().slice(1))).toThrow(/expected 16 rows, got 15/);
    const short = blank();
    short[3] = '....';
    expect(() => parseSprite('t', short)).toThrow(/row 3/);
    const bad = blank();
    bad[5] = '?' + row('.').slice(1);
    expect(() => parseSprite('t', bad)).toThrow(/unknown colour '\?'/);
  });

  it('mirrors left to right, and flipping twice gives the original', () => {
    const rows = blank();
    rows[2] = 'k' + row('.').slice(1);
    const s = parseSprite('t', rows);
    const f = flipHorizontal(s);
    expect(f.pixels[2 * 16 + 15]).toBe('k');
    expect(f.pixels[2 * 16]).toBeNull();
    expect(flipHorizontal(f).pixels).toEqual(s.pixels);
  });
});

describe('rotateRows and recolorRows', () => {
  const small = ['ab..', '....', '....', '....'];

  it('turns a square grid clockwise by multiples of 90 degrees exactly', () => {
    expect(rotateRows(small, 90)).toEqual(['...a', '...b', '....', '....']);
    expect(rotateRows(small, 180)).toEqual(['....', '....', '....', '..ba']);
    expect(rotateRows(small, 270)).toEqual(['....', '....', 'b...', 'a...']);
  });

  it('0 and 360 degrees are the identity, and four quarter turns come home', () => {
    expect(rotateRows(small, 0)).toEqual(small);
    expect(rotateRows(small, 360)).toEqual(small);
    let r = small;
    for (let i = 0; i < 4; i++) r = rotateRows(r, 90);
    expect(r).toEqual(small);
  });

  it('a 45 degree turn of a full-size grid stays 16x16, keeps only source letters and keeps pixels', () => {
    const grid = blank();
    grid[7] = '.....kkkkkk.....';
    grid[8] = '.....kBBBBk.....';
    const out = rotateRows(grid, 45);
    expect(out).toHaveLength(16);
    for (const line of out) {
      expect(line).toHaveLength(16);
      expect(line).toMatch(/^[.kB]+$/);
    }
    expect(out.join('').replace(/\./g, '').length).toBeGreaterThan(0);
  });

  it('recolours letters through a map and leaves the rest alone', () => {
    expect(recolorRows(['aBb.', 'BBBB'], { B: 'R' })).toEqual(['aRb.', 'RRRR']);
  });
});

describe('unitSprite', () => {
  it('maps facings 0 to 4 to the five base sprites and 5, 6, 7 to the mirrors of 3, 2, 1, per weapon', () => {
    const expected: [Facing, string, boolean][] = [
      [0, 'n', false], [1, 'ne', false], [2, 'e', false], [3, 'se', false], [4, 's', false],
      [5, 'se', true], [6, 'e', true], [7, 'ne', true],
    ];
    for (const weapon of ['rifle', 'pistol'] as WeaponId[]) {
      for (const [facing, suffix, flip] of expected) {
        expect(unitSprite('player', facing, weapon)).toEqual({ name: `soldier_${weapon}_${suffix}`, flip });
        expect(unitSprite('enemy', facing, weapon)).toEqual({ name: `enemy_${weapon}_${suffix}`, flip });
      }
    }
  });
});

describe('floorVariant', () => {
  it('is deterministic and uses all three variants over a 30x20 map', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 30; x++) {
        const v = floorVariant(x, y);
        expect([0, 1, 2]).toContain(v);
        expect(floorVariant(x, y)).toBe(v);
        seen.add(v);
      }
    }
    expect(seen.size).toBe(3);
  });

  it('does not make every neighbouring tile identical', () => {
    let differing = 0;
    for (let x = 0; x < 29; x++) if (floorVariant(x, 5) !== floorVariant(x + 1, 5)) differing += 1;
    expect(differing).toBeGreaterThan(10);
  });
});

describe('rankPips and pipPositions', () => {
  it('counts pips by rank', () => {
    expect(['Rookie', 'Private', 'Sergeant', 'Captain', '', 'Nonsense'].map(rankPips)).toEqual([0, 1, 2, 3, 0, 0]);
  });

  it('places the pips along the top-left corner of the tile', () => {
    expect(pipPositions(0)).toEqual([]);
    expect(pipPositions(3)).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }]);
  });
});

describe('rank pips and the armour pip stay clear of every soldier sprite', () => {
  it('overlap no opaque pixel of any soldier or enemy sprite, mirrored or not', () => {
    const marks: { x: number; y: number }[] = [];
    for (const p of pipPositions(3)) marks.push({ x: p.x, y: p.y }, { x: p.x, y: p.y + 1 });
    for (let dy = 0; dy < ARMOUR_PIP.h; dy++) for (let dx = 0; dx < ARMOUR_PIP.w; dx++) marks.push({ x: ARMOUR_PIP.x + dx, y: ARMOUR_PIP.y + dy });
    for (const name of SPRITE_NAMES.filter((n) => n.startsWith('soldier_') || n.startsWith('enemy_'))) {
      for (const flip of [false, true]) {
        for (const m of marks) {
          const ch = SPRITE_ROWS[name][m.y][flip ? SPRITE_SIZE - 1 - m.x : m.x];
          expect(ch, `${name} flip=${flip} at ${m.x},${m.y}`).toBe('.');
        }
      }
    }
  });
});

describe('directionTo and frameFor', () => {
  it('gives the sign of each axis', () => {
    expect(directionTo({ x: 1, y: 1 }, { x: 5, y: 1 })).toEqual({ x: 1, y: 0 });
    expect(directionTo({ x: 4, y: 4 }, { x: 2, y: 9 })).toEqual({ x: -1, y: 1 });
    expect(directionTo({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 0, y: 0 });
  });

  it('picks a frame inside the range for any progress', () => {
    expect(frameFor(0, 4)).toBe(0);
    expect(frameFor(0.24, 4)).toBe(0);
    expect(frameFor(0.25, 4)).toBe(1);
    expect(frameFor(0.99, 4)).toBe(3);
    expect(frameFor(1, 4)).toBe(3);
    expect(frameFor(-1, 4)).toBe(0);
    expect(frameFor(5, 4)).toBe(3);
    expect(frameFor(0.7, 1)).toBe(0);
  });
});
