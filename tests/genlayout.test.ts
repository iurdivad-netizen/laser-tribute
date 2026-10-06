import { describe, expect, it } from 'vitest';
import { distances, toGrid, toRows } from '../src/core/gen/grid';
import { buildLayout } from '../src/core/gen/layout';
import { RECIPES } from '../src/core/gen/recipes';
import { seededRandom } from '../src/core/rng';

const SEEDS = [1, 2, 3, 4, 5, 6];

function openTiles(rows: string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '#') out.push({ x, y }); }));
  return out;
}

describe('grid helpers', () => {
  it('distances counts 4-neighbour steps and marks walls and cut-off tiles -1', () => {
    const g = toGrid(['#####', '#..##', '#.#.#', '#####']);
    const d = distances(g, { x: 1, y: 1 }, (c) => c !== '#');
    expect(d[1][1]).toBe(0);
    expect(d[1][2]).toBe(1);
    expect(d[2][1]).toBe(1);
    expect(d[2][3]).toBe(-1); // not connected
    expect(d[0][0]).toBe(-1);
    expect(toRows(g)).toEqual(['#####', '#..##', '#.#.#', '#####']);
  });
});

describe.each(RECIPES.map((r) => [r.name, r] as const))('buildLayout %s', (_name, recipe) => {
  for (const seed of SEEDS) {
    const rows = toRows(buildLayout(recipe, seededRandom(seed)));

    it(`seed ${seed}: has the recipe size and a solid border`, () => {
      expect(rows).toHaveLength(recipe.height);
      for (const row of rows) expect(row).toHaveLength(recipe.width);
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (x === 0 || y === 0 || x === recipe.width - 1 || y === recipe.height - 1) expect(ch).toBe('#');
      }));
    });

    it(`seed ${seed}: every floor and door tile can be reached from every other`, () => {
      const open = openTiles(rows);
      expect(open.length).toBeGreaterThan(recipe.width * recipe.height * 0.25);
      const d = distances(toGrid(rows), open[0], (c) => c !== '#');
      for (const p of open) expect(d[p.y][p.x], `${p.x},${p.y}`).toBeGreaterThanOrEqual(0);
    });

    it(`seed ${seed}: every door has walls on two opposite sides and floor on the others`, () => {
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch !== '+') return;
        const n = rows[y - 1][x], s = rows[y + 1][x], w = row[x - 1], e = row[x + 1];
        const ok = (n === '#' && s === '#' && w === '.' && e === '.') || (w === '#' && e === '#' && n === '.' && s === '.');
        expect(ok, `door at ${x},${y}`).toBe(true);
      }));
    });
  }

  it('is deterministic for a seed and different for different seeds', () => {
    const a = toRows(buildLayout(recipe, seededRandom(11)));
    const b = toRows(buildLayout(recipe, seededRandom(11)));
    const c = toRows(buildLayout(recipe, seededRandom(12)));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe('buildLayout features', () => {
  it('opens the yard in the middle (the Outpost has a 10x6 open area)', () => {
    const rows = toRows(buildLayout(RECIPES[0], seededRandom(3)));
    const x0 = Math.floor((30 - 10) / 2);
    const y0 = Math.floor((20 - 6) / 2);
    for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 10; x++) expect(rows[y][x], `${x},${y}`).toBe('.');
  });

  it('scatters single cover blocks only where all eight neighbours are floor', () => {
    const rows = toRows(buildLayout(RECIPES[5], seededRandom(3))); // Factory: cover 4
    let blocks = 0;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '#' || x === 0 || y === 0 || x === row.length - 1 || y === rows.length - 1) return;
      const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => rows[y + dy][x + dx]));
      if (around.filter((c) => c === '.').length === 8) blocks++;
    }));
    expect(blocks).toBeGreaterThan(0);
  });
});
