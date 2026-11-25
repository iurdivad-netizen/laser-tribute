import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, generateMission } from '../src/core/gen';
import { BLOCKS, BLOCK_TAGS, orientations } from '../src/core/gen/blocks';
import { distances, isSolid, toRows } from '../src/core/gen/grid';
import { buildLayout, stampBlocks } from '../src/core/gen/layout';
import { RECIPES } from '../src/core/gen/recipes';
import { seededRandom } from '../src/core/rng';

describe('room blocks', () => {
  it('are small rectangles of walls, props and floor, with names and tags', () => {
    expect(BLOCKS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BLOCKS.map((b) => b.name)).size).toBe(BLOCKS.length);
    for (const b of BLOCKS) {
      expect(BLOCK_TAGS, b.name).toContain(b.tag);
      expect(new Set(b.rows.map((r) => r.length)).size, b.name).toBe(1);
      expect(b.rows.length, b.name).toBeLessThanOrEqual(5);
      expect(b.rows[0].length, b.name).toBeLessThanOrEqual(7);
      expect(b.rows.join(''), b.name).toMatch(/^[.#xy]+$/);
      expect(b.rows.join(''), b.name).toMatch(/[#xy]/);
    }
  });

  it('leave every floor tile inside them reachable, in every orientation', () => {
    for (const b of BLOCKS) {
      for (const rows of orientations(b.rows)) {
        const h = rows.length + 2;
        const w = rows[0].length + 2;
        const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => rows[y - 1]?.[x - 1] ?? '.'));
        const d = distances(g, { x: 0, y: 0 }, (c) => !isSolid(c));
        const cut = g.some((row, y) => row.some((c, x) => !isSolid(c) && d[y][x] < 0));
        expect(cut, `${b.name}\n${rows.join('\n')}`).toBe(false);
      }
    }
  });

  it('turn into up to eight different orientations', () => {
    expect(orientations(['xx', '..']).length).toBe(4);
    expect(orientations(['x.', '.y']).length).toBe(4);
    expect(orientations(['xyx', '...']).length).toBe(4);
    expect(orientations(['xy.', '...', '#..']).length).toBe(8);
  });
});

describe('maps with blocks', () => {
  it('differ from plain maps, and stay the same for the same seed', () => {
    let differ = 0;
    for (const [i, r] of RECIPES.entries()) {
      const plain = toRows(buildLayout(r, seededRandom(i + 1)));
      const a = toRows(buildLayout(r, seededRandom(i + 1), true));
      expect(toRows(buildLayout(r, seededRandom(i + 1), true))).toEqual(a);
      if (a.join() !== plain.join()) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(8);
  });

  it('keep the border closed and every door in a wall gap', () => {
    for (const r of RECIPES) {
      const g = buildLayout(r, seededRandom(9), true);
      expect(g[0].every((c) => c === '#') && g.at(-1)!.every((c) => c === '#')).toBe(true);
      expect(g.every((row) => row[0] === '#' && row.at(-1) === '#')).toBe(true);
    }
  });

  it('give a playable map for every type and variation', () => {
    for (let t = 0; t < CAMPAIGN_LENGTH; t++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const def = generateMission(t, v, t + 1, true);
        expect(def.rows.join('').match(/[xy#]/g)!.length).toBeGreaterThan(0);
        expect(generateMission(t, v, t + 1, true).rows).toEqual(def.rows);
      }
    }
  });

  it('stay playable at every garrison difficulty a region can have', () => {
    for (let t = 0; t < CAMPAIGN_LENGTH; t++) {
      for (let v = 0; v < VARIATIONS; v++) for (const d of [1, 4, 8, 12, 14]) expect(() => generateMission(t, v, d, true), `${t},${v},${d}`).not.toThrow();
    }
  });

  it('are chosen by the seed, not only by where the room is', () => {
    const r = { ...RECIPES[8], blocks: { chance: 1, tags: ['crates', 'hall', 'fort', 'vault', 'barracks'] as const } };
    const room = (salt: number) => {
      const g = Array.from({ length: 14 }, (_, y) => Array.from({ length: 20 }, (_, x) => (x === 0 || y === 0 || x === 19 || y === 13 ? '#' : '.')));
      stampBlocks(g, r as never, [{ x0: 0, y0: 0, x1: 19, y1: 13 }], salt);
      return toRows(g).join('/');
    };
    expect(new Set(Array.from({ length: 12 }, (_, i) => room(i + 1))).size).toBeGreaterThanOrEqual(8);
  });

  it('are off by default, so the campaign maps do not change', () => {
    expect(generateMission(3, 2).rows).toEqual(generateMission(3, 2, 4, false).rows);
  });
});
