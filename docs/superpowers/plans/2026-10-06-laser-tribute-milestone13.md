# Laser Tribute Milestone 13: Generated Campaign Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ten-mission campaign of generated maps (ten types, five fixed variations each) next to a Tutorial mode that keeps today's three hand-drawn missions, with two save slots and a title screen that offers CONTINUE, NEW CAMPAIGN and TUTORIAL.

**Architecture:** A pure, seeded generator in `src/core/gen/` turns `(type, variation, difficulty)` into the existing `MissionDef` (ASCII rows + patrols), so `createMission`, fog, AI, rendering and the camera work unchanged. One shared BSP builder (rooms, doors, archways, a central yard, cover blocks) is driven by ten parameter sets ("recipes"); one shared `checkMission` enforces playability and the generator retries internal attempts until a map passes. `Campaign` gains `mode` and `variations`; saves split into a tutorial slot (old key, old saves load unchanged) and a campaign slot; the App chooses the mission list by mode.

**Tech Stack:** TypeScript, Vitest, Vite, Canvas (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-laser-tribute-milestone13-design.md`

## Global Constraints

- Work on branch `milestone-13` (already created, spec committed). Never commit on `master`. Never push before the final review fixes are in.
- Pure `src/core`: no DOM, no `Math.random`, no `Date`. All generation randomness comes from `seededRandom`.
- Map legend unchanged: `#` wall, `.` floor, `+` door, `P` squad, `E` enemy, `r` rifle, `p` pistol, `g` grenade. Rows all the same width; outer border all `#`.
- Ten types, in this order (name, width x height, enemies): Outpost 30x20 4; Warehouse 30x20 5; Compound 30x20 6; Bunker 32x22 6; Village 36x24 7; Factory 38x26 8; Station 40x26 9; Mine 42x28 10; Fortress 46x30 11; Citadel 48x32 12. Five variations per type (0 to 4).
- Same `(type, variation)` always gives the same map. Enemy stats, enemy gear and AI are not touched.
- Tutorial = `MISSIONS` (3 hand-drawn maps), played exactly as today. Old saves (key `laser-tribute-save`, no `mode` field) load as tutorial progress.
- Save keys: `laser-tribute-save` (tutorial), `laser-tribute-campaign` (campaign), `laser-tribute-last` (last mode played).
- The title screen is always shown at startup (CONTINUE only when a save exists). NEW CAMPAIGN and TUTORIAL need two presses only when that mode's slot already holds a save.
- Run `npx tsc --noEmit` before every commit. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Before Task 1 note the baseline: `npx vitest run` shows 824 passing tests.

## Review Focus

1. Doors and reachability: a generated map where part of the floor can only be reached through a long chain of doors, or where the squad starts boxed in. `checkMission` counts doors as passable; the tests must prove the rule bites on hand-made bad maps.
2. Determinism across code changes: "same (type, variation) gives the same map" is only useful if it stays true. Task 11 pins a fingerprint of all 50 maps; changing the generator later must update it deliberately.
3. An old save whose `missionIndex` is valid for the tutorial only, and a campaign save written with a different type list: parse must reject, never crash, never touch the other slot.
4. Squad start at the map edge on a big map with the close-zoom camera clamped: the camera must stay inside the 48x32 map.
5. A 12-enemy turn on 48x32: time of the enemy turn and `trackCamera` following events on a big map must not blow up.

---

### Task 1: Seeded random stream and the ten recipes

**Files:**
- Modify: `src/core/rng.ts`
- Create: `src/core/gen/recipes.ts`
- Test: `tests/seeded.test.ts`, `tests/genrecipes.test.ts`

**Interfaces:**
- Produces: `seededRandom(seed: number): () => number` (values in [0,1)); `interface Recipe`, `const RECIPES: Recipe[]` (ten, in campaign order) with fields `id, name, width, height, enemies, items {r,p,g}, minW, minH, maxLeaf, vertical, arch, cover, yard: {w,h} | null`.

- [ ] **Step 1: Write the failing tests**

`tests/seeded.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/core/rng';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('gives different sequences for different seeds', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1) and moves on every call', () => {
    const r = seededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(990);
  });
});
```

`tests/genrecipes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/core/gen/recipes';

describe('the ten recipes', () => {
  it('are in campaign order with the agreed names, sizes and enemy counts', () => {
    expect(RECIPES.map((r) => r.name)).toEqual([
      'Outpost', 'Warehouse', 'Compound', 'Bunker', 'Village', 'Factory', 'Station', 'Mine', 'Fortress', 'Citadel',
    ]);
    expect(RECIPES.map((r) => `${r.width}x${r.height}`)).toEqual([
      '30x20', '30x20', '30x20', '32x22', '36x24', '38x26', '40x26', '42x28', '46x30', '48x32',
    ]);
    expect(RECIPES.map((r) => r.enemies)).toEqual([4, 5, 6, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('have unique ids and a yard that fits inside the walls', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(10);
    for (const r of RECIPES) {
      if (r.yard) {
        expect(r.yard.w, r.name).toBeLessThanOrEqual(r.width - 2);
        expect(r.yard.h, r.name).toBeLessThanOrEqual(r.height - 2);
      }
      expect(r.minW, r.name).toBeGreaterThanOrEqual(4);
      expect(r.minH, r.name).toBeGreaterThanOrEqual(4);
    }
  });

  it('never get smaller as the campaign goes on', () => {
    for (let i = 1; i < RECIPES.length; i++) {
      expect(RECIPES[i].width).toBeGreaterThanOrEqual(RECIPES[i - 1].width);
      expect(RECIPES[i].height).toBeGreaterThanOrEqual(RECIPES[i - 1].height);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/seeded.test.ts tests/genrecipes.test.ts`
Expected: FAIL (`seededRandom` is not exported; `gen/recipes` not found).

- [ ] **Step 3: Implement**

Append to `src/core/rng.ts`:
```ts

/** A seeded stream for map generation: each call returns the next number in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    const r = step(state);
    state = r.next;
    return r.value;
  };
}
```

Create `src/core/gen/recipes.ts`:
```ts
/** The knobs of one map type. The shared builder in layout.ts turns them into walls, rooms, doors and cover. */
export interface Recipe {
  id: string;
  name: string;
  width: number;
  height: number;
  enemies: number;
  /** Pickups lying on the map. */
  items: { r: number; p: number; g: number };
  /** Smallest wall-to-wall span of a room along each axis (the room inside is two tiles smaller). */
  minW: number;
  minH: number;
  /** A piece of the map this size or smaller (both axes) is not split further. */
  maxLeaf: number;
  /** Chance that a piece splittable both ways is cut left/right rather than top/bottom. */
  vertical: number;
  /** Chance that the wall between two pieces gets a 2 to 3 tile archway instead of a door. */
  arch: number;
  /** Single cover blocks per 100 open floor tiles. */
  cover: number;
  /** A big open area in the middle of the map, or null. */
  yard: { w: number; h: number } | null;
}

export const RECIPES: Recipe[] = [
  { id: 'outpost', name: 'Outpost', width: 30, height: 20, enemies: 4, items: { r: 1, p: 1, g: 2 },
    minW: 5, minH: 5, maxLeaf: 15, vertical: 0.5, arch: 0, cover: 0, yard: { w: 10, h: 6 } },
  { id: 'warehouse', name: 'Warehouse', width: 30, height: 20, enemies: 5, items: { r: 1, p: 1, g: 2 },
    minW: 4, minH: 7, maxLeaf: 12, vertical: 0.85, arch: 0.5, cover: 3, yard: null },
  { id: 'compound', name: 'Compound', width: 30, height: 20, enemies: 6, items: { r: 1, p: 1, g: 2 },
    minW: 6, minH: 5, maxLeaf: 12, vertical: 0.5, arch: 0.2, cover: 1, yard: { w: 12, h: 8 } },
  { id: 'bunker', name: 'Bunker', width: 32, height: 22, enemies: 6, items: { r: 1, p: 1, g: 3 },
    minW: 4, minH: 4, maxLeaf: 9, vertical: 0.5, arch: 0, cover: 0, yard: null },
  { id: 'village', name: 'Village', width: 36, height: 24, enemies: 7, items: { r: 1, p: 1, g: 3 },
    minW: 5, minH: 5, maxLeaf: 8, vertical: 0.5, arch: 0.6, cover: 1, yard: { w: 14, h: 8 } },
  { id: 'factory', name: 'Factory', width: 38, height: 26, enemies: 8, items: { r: 1, p: 1, g: 3 },
    minW: 7, minH: 6, maxLeaf: 18, vertical: 0.5, arch: 0.4, cover: 4, yard: null },
  { id: 'station', name: 'Station', width: 40, height: 26, enemies: 9, items: { r: 2, p: 1, g: 3 },
    minW: 6, minH: 5, maxLeaf: 12, vertical: 0.5, arch: 0.3, cover: 2, yard: { w: 14, h: 10 } },
  { id: 'mine', name: 'Mine', width: 42, height: 28, enemies: 10, items: { r: 2, p: 1, g: 3 },
    minW: 4, minH: 4, maxLeaf: 11, vertical: 0.5, arch: 0.7, cover: 3, yard: null },
  { id: 'fortress', name: 'Fortress', width: 46, height: 30, enemies: 11, items: { r: 2, p: 1, g: 3 },
    minW: 6, minH: 5, maxLeaf: 13, vertical: 0.5, arch: 0.2, cover: 2, yard: { w: 20, h: 12 } },
  { id: 'citadel', name: 'Citadel', width: 48, height: 32, enemies: 12, items: { r: 2, p: 1, g: 3 },
    minW: 5, minH: 5, maxLeaf: 12, vertical: 0.5, arch: 0.3, cover: 3, yard: { w: 16, h: 10 } },
];
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/seeded.test.ts tests/genrecipes.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts src/core/gen/recipes.ts tests/seeded.test.ts tests/genrecipes.test.ts
git commit -m "feat: seeded random stream and the ten map recipes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Grid helpers and the BSP layout builder

**Files:**
- Create: `src/core/gen/grid.ts`, `src/core/gen/layout.ts`
- Test: `tests/genlayout.test.ts`

**Interfaces:**
- Consumes: `Recipe`, `RECIPES` (Task 1), `seededRandom`.
- Produces (`grid.ts`): `type Grid = string[][]`, `type Rnd = () => number`, `blank(w,h): Grid`, `fill(g,x,y,w,h,ch)`, `ri(rnd,lo,hi)` (inclusive integer), `shuffled<T>(rnd, items): T[]`, `distances(g, from: Pos, passable: (ch)=>boolean): number[][]` (4-neighbour BFS, -1 = unreachable), `toGrid(rows: string[]): Grid`, `toRows(g: Grid): string[]`.
- Produces (`layout.ts`): `buildLayout(recipe: Recipe, rnd: Rnd): Grid` — terrain only (`#`, `.`, `+`), border all wall, every floor and door tile 4-connected, every `+` in a wall gap.

- [ ] **Step 1: Write the failing tests**

`tests/genlayout.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/genlayout.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/core/gen/grid.ts`:
```ts
import type { Pos } from '../types';

export type Grid = string[][];
export type Rnd = () => number;

export const NB4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string>(w).fill('#'));
}

export function fill(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch;
}

/** An integer in [lo, hi], inclusive. */
export function ri(rnd: Rnd, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

export function shuffled<T>(rnd: Rnd, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toGrid(rows: string[]): Grid {
  return rows.map((r) => [...r]);
}

export function toRows(g: Grid): string[] {
  return g.map((r) => r.join(''));
}

/** Steps from `from` to every tile over 4-neighbour moves through tiles `passable` accepts; -1 where it cannot be reached. */
export function distances(g: Grid, from: Pos, passable: (ch: string) => boolean): number[][] {
  const h = g.length;
  const w = g[0].length;
  const d = g.map((row) => row.map(() => -1));
  d[from.y][from.x] = 0;
  const queue: Pos[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of NB4) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || d[y][x] !== -1 || !passable(g[y][x])) continue;
      d[y][x] = d[p.y][p.x] + 1;
      queue.push({ x, y });
    }
  }
  return d;
}
```

`src/core/gen/layout.ts`:
```ts
import { blank, fill, ri, type Grid, type Rnd } from './grid';
import type { Recipe } from './recipes';

/** A piece of the map; the coordinates are wall lines, so the room inside is x0+1..x1-1 by y0+1..y1-1. */
interface Rect { x0: number; y0: number; x1: number; y1: number }
/** A wall line cutting a piece in two. `vertical` means the wall is a column at x = `at`. */
interface Split { vertical: boolean; at: number; a: Rect; b: Rect }

function partition(r: Recipe, rnd: Rnd, rect: Rect, leaves: Rect[], splits: Split[]): void {
  const spanX = rect.x1 - rect.x0;
  const spanY = rect.y1 - rect.y0;
  const canV = spanX >= 2 * r.minW;
  const canH = spanY >= 2 * r.minH;
  if ((!canV && !canH) || (spanX <= r.maxLeaf && spanY <= r.maxLeaf)) {
    leaves.push(rect);
    return;
  }
  let vertical: boolean;
  if (canV && canH) vertical = spanX > spanY * 2 ? true : spanY > spanX * 2 ? false : rnd() < r.vertical;
  else vertical = canV;
  if (vertical) {
    const at = ri(rnd, rect.x0 + r.minW, rect.x1 - r.minW);
    const a = { ...rect, x1: at };
    const b = { ...rect, x0: at };
    splits.push({ vertical, at, a, b });
    partition(r, rnd, a, leaves, splits);
    partition(r, rnd, b, leaves, splits);
  } else {
    const at = ri(rnd, rect.y0 + r.minH, rect.y1 - r.minH);
    const a = { ...rect, y1: at };
    const b = { ...rect, y0: at };
    splits.push({ vertical, at, a, b });
    partition(r, rnd, a, leaves, splits);
    partition(r, rnd, b, leaves, splits);
  }
}

/** Makes a door (or a 2 to 3 tile archway) in the wall line of a split, so the two halves are connected. */
function connect(g: Grid, rnd: Rnd, r: Recipe, s: Split): void {
  const lo = (s.vertical ? s.a.y0 : s.a.x0) + 1;
  const hi = (s.vertical ? s.a.y1 : s.a.x1) - 1;
  const at = (t: number): [number, number] => (s.vertical ? [s.at, t] : [t, s.at]);
  const open: number[] = []; // floor on both sides of the wall
  const door: number[] = []; // ... and wall along both ends, so a door fits
  for (let t = lo; t <= hi; t++) {
    const [x, y] = at(t);
    const across = s.vertical ? [g[y][x - 1], g[y][x + 1]] : [g[y - 1][x], g[y + 1][x]];
    const along = s.vertical ? [g[y - 1][x], g[y + 1][x]] : [g[y][x - 1], g[y][x + 1]];
    if (across[0] !== '.' || across[1] !== '.') continue;
    open.push(t);
    if (along[0] === '#' && along[1] === '#') door.push(t);
  }
  const pool = door.length > 0 ? door : open;
  if (pool.length === 0) return;
  const t = pool[ri(rnd, 0, pool.length - 1)];
  if (rnd() < r.arch) {
    const width = ri(rnd, 2, 3);
    for (let k = 0; k < width; k++) {
      if (!open.includes(t + k)) break;
      const [x, y] = at(t + k);
      g[y][x] = '.';
    }
  } else {
    const [x, y] = at(t);
    g[y][x] = '+';
    if (pool.length >= 8 && rnd() < 0.5) {
      const spare = pool.filter((u) => Math.abs(u - t) >= 3);
      if (spare.length > 0) {
        const [x2, y2] = at(spare[ri(rnd, 0, spare.length - 1)]);
        g[y2][x2] = '+';
      }
    }
  }
}

/** A door that no longer sits in a wall gap (a neighbouring wall was cut away) becomes plain floor. */
function tidyDoors(g: Grid): void {
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < g[0].length - 1; x++) {
      if (g[y][x] !== '+') continue;
      const n = g[y - 1][x], s = g[y + 1][x], w = g[y][x - 1], e = g[y][x + 1];
      const ok = (n === '#' && s === '#' && w === '.' && e === '.') || (w === '#' && e === '#' && n === '.' && s === '.');
      if (!ok) g[y][x] = '.';
    }
  }
}

/** One-tile cover blocks, only where all eight neighbours are floor, so they never cut the map in two. */
function scatterCover(g: Grid, rnd: Rnd, per100: number): void {
  if (per100 <= 0) return;
  const w = g[0].length;
  const h = g.length;
  let open = 0;
  for (const row of g) for (const ch of row) if (ch === '.') open++;
  let left = Math.floor((open * per100) / 100);
  for (let tries = 0; left > 0 && tries < 600; tries++) {
    const x = ri(rnd, 1, w - 2);
    const y = ri(rnd, 1, h - 2);
    let clear = true;
    for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] !== '.') clear = false;
    if (!clear) continue;
    g[y][x] = '#';
    left--;
  }
}

/** The terrain of a map: walls, rooms, doors, archways, an optional yard and cover. No units or items yet. */
export function buildLayout(r: Recipe, rnd: Rnd): Grid {
  const g = blank(r.width, r.height);
  const leaves: Rect[] = [];
  const splits: Split[] = [];
  partition(r, rnd, { x0: 0, y0: 0, x1: r.width - 1, y1: r.height - 1 }, leaves, splits);
  for (const l of leaves) fill(g, l.x0 + 1, l.y0 + 1, l.x1 - l.x0 - 1, l.y1 - l.y0 - 1, '.');
  for (const s of splits) connect(g, rnd, r, s);
  if (r.yard) {
    fill(g, Math.floor((r.width - r.yard.w) / 2), Math.floor((r.height - r.yard.h) / 2), r.yard.w, r.yard.h, '.');
  }
  tidyDoors(g);
  scatterCover(g, rnd, r.cover);
  return g;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/genlayout.test.ts && npx tsc --noEmit`
Expected: PASS. If a recipe/seed fails connectivity or door validity, read the failing coordinates and fix `layout.ts` (the rules in the tests are the spec); do not weaken the tests. If a recipe's parameters cannot satisfy "more than 25% open tiles", adjust that recipe's numbers in `recipes.ts` and ledger it as a Ruling.

- [ ] **Step 5: Commit**

```bash
git add src/core/gen/grid.ts src/core/gen/layout.ts tests/genlayout.test.ts
git commit -m "feat: grid helpers and the BSP layout builder" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The playability check

**Files:**
- Create: `src/core/gen/check.ts`
- Test: `tests/gencheck.test.ts`

**Interfaces:**
- Consumes: `MissionDef` (type, `src/core/missions.ts`), `parseMap` (`src/core/mission.ts`), `hasLineOfSight` (`src/core/vision.ts`), `chebyshev` (`src/core/geometry.ts`), `distances`/`toGrid` (Task 2), `Recipe` (type).
- Produces: `interface Expect { width; height; enemies; items: {r,p,g} }`; `expectFor(recipe: Recipe, enemies = recipe.enemies): Expect`; `checkMission(def: MissionDef, want: Expect): string[]` (empty array = playable).

Rules (spec): size; four `P`; enemy and item counts; border solid; every non-wall tile reachable from the first `P` (doors passable); every `+` in a wall gap; no `E` within 8 tiles (Chebyshev) of a `P` and none with line of sight to a `P`; patrol keys exactly `e1..eN`, each at least two points, in bounds, not wall, reachable; each `P` has another `P` 4-adjacent.

- [ ] **Step 1: Write the failing tests**

`tests/gencheck.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { checkMission, expectFor, type Expect } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';
import type { MissionDef } from '../src/core/missions';

const WANT: Expect = { width: 22, height: 5, enemies: 1, items: { r: 0, p: 0, g: 0 } };

const GOOD_ROWS = [
  '######################',
  '#PP.......#.....E....#',
  '#PP.......+..........#',
  '#.........#..........#',
  '######################',
];

const def = (rows: string[], patrols: MissionDef['patrols'] = { e1: [{ x: 12, y: 3 }, { x: 16, y: 1 }] }): MissionDef => ({
  id: 't', name: 'T', rows, patrols,
});

describe('checkMission', () => {
  it('accepts a good map', () => {
    expect(checkMission(def(GOOD_ROWS), WANT)).toEqual([]);
  });

  it('builds the expectation from a recipe, with the enemy count overridable', () => {
    expect(expectFor(RECIPES[3])).toEqual({ width: 32, height: 22, enemies: 6, items: { r: 1, p: 1, g: 3 } });
    expect(expectFor(RECIPES[3], 9).enemies).toBe(9);
  });

  it('rejects the wrong size', () => {
    expect(checkMission(def(GOOD_ROWS), { ...WANT, width: 30 })[0]).toMatch(/size/);
    expect(checkMission(def([...GOOD_ROWS.slice(0, 4), '#####', '#']), WANT)[0]).toMatch(/size/);
  });

  it('rejects a squad that is not four soldiers', () => {
    const rows = GOOD_ROWS.map((r) => r.replace('#PP.', '#P..'));
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/squad/);
  });

  it('rejects the wrong enemy and item counts', () => {
    expect(checkMission(def(GOOD_ROWS), { ...WANT, enemies: 2 }).join('|')).toMatch(/enemies/);
    expect(checkMission(def(GOOD_ROWS), { ...WANT, items: { r: 1, p: 0, g: 0 } }).join('|')).toMatch(/item r/);
  });

  it('rejects an open border', () => {
    const rows = [...GOOD_ROWS];
    rows[0] = '#####.################';
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/border/);
  });

  it('rejects floor that cannot be reached from the squad', () => {
    const rows = GOOD_ROWS.map((r) => r.replace('+', '#')); // the only door is walled up
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/reach/);
  });

  it('rejects a door that is not in a wall gap', () => {
    const rows = [...GOOD_ROWS];
    rows[3] = '#....+....#..........#'; // a door standing in open floor
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/door at 5,3/);
  });

  it('rejects an enemy within 8 tiles of the squad', () => {
    const rows = GOOD_ROWS.map((r) => r.replace('E', '.'));
    rows[3] = '#.....E...#..........#';
    expect(checkMission(def(rows, { e1: [{ x: 12, y: 3 }, { x: 6, y: 3 }] }), WANT).join('|')).toMatch(/within 8/);
  });

  it('rejects an enemy that has a line of sight to the squad', () => {
    const open = [
      '####################',
      '#PP................#',
      '#PP.............E..#',
      '#..................#',
      '####################',
    ];
    const out = checkMission(def(open, { e1: [{ x: 10, y: 3 }, { x: 16, y: 2 }] }), { ...WANT, width: 20 });
    expect(out.join('|')).toMatch(/sees/);
  });

  it('rejects missing, short and off-map patrols', () => {
    expect(checkMission(def(GOOD_ROWS, {}), WANT).join('|')).toMatch(/patrol e1/);
    expect(checkMission(def(GOOD_ROWS, { e1: [{ x: 16, y: 1 }] }), WANT).join('|')).toMatch(/patrol e1/);
    expect(checkMission(def(GOOD_ROWS, { e1: [{ x: 10, y: 1 }, { x: 16, y: 1 }] }), WANT).join('|')).toMatch(/patrol e1/); // a wall tile
    expect(checkMission(def(GOOD_ROWS, { e1: [{ x: 12, y: 3 }, { x: 16, y: 1 }], e2: [{ x: 12, y: 3 }, { x: 16, y: 1 }] }), WANT).join('|')).toMatch(/patrol e2/);
  });

  it('rejects a squad that starts scattered', () => {
    const rows = [
      '######################',
      '#PP.......#.....E....#',
      '#P........+..........#',
      '#.........#.........P#',
      '######################',
    ];
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/squad start is scattered/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gencheck.test.ts`
Expected: FAIL (`gen/check` not found).

- [ ] **Step 3: Implement**

`src/core/gen/check.ts`:
```ts
import { chebyshev } from '../geometry';
import { parseMap } from '../mission';
import type { MissionDef } from '../missions';
import { hasLineOfSight } from '../vision';
import { distances, toGrid, type Grid } from './grid';
import type { Recipe } from './recipes';

export interface Expect {
  width: number;
  height: number;
  enemies: number;
  items: { r: number; p: number; g: number };
}

export function expectFor(r: Recipe, enemies: number = r.enemies): Expect {
  return { width: r.width, height: r.height, enemies, items: { ...r.items } };
}

function doorFits(g: Grid, x: number, y: number): boolean {
  const n = g[y - 1]?.[x], s = g[y + 1]?.[x], w = g[y][x - 1], e = g[y][x + 1];
  return (n === '#' && s === '#' && w === '.' && e === '.') || (w === '#' && e === '#' && n === '.' && s === '.');
}

/** What is wrong with a generated map; an empty list means it is playable. */
export function checkMission(def: MissionDef, want: Expect): string[] {
  const rows = def.rows;
  if (rows.length !== want.height || rows.some((r) => r.length !== want.width)) {
    return [`size is not ${want.width}x${want.height}`];
  }
  const problems: string[] = [];
  const text = rows.join('');
  const count = (ch: string): number => text.split(ch).length - 1;

  if (count('P') !== 4) problems.push(`squad is ${count('P')} soldiers, not 4`);
  if (count('E') !== want.enemies) problems.push(`${count('E')} enemies, expected ${want.enemies}`);
  for (const k of ['r', 'p', 'g'] as const) {
    if (count(k) !== want.items[k]) problems.push(`${count(k)} of item ${k}, expected ${want.items[k]}`);
  }

  let border = false;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const edge = x === 0 || y === 0 || x === want.width - 1 || y === want.height - 1;
    if (edge && ch !== '#') border = true;
  }));
  if (border) problems.push('border is open');

  const grid = toGrid(rows);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '+' && !doorFits(grid, x, y)) problems.push(`door at ${x},${y} is not in a wall gap`);
  }));

  const state = parseMap(rows);
  const squad = state.units.filter((u) => u.side === 'player').map((u) => u.pos);
  const foes = state.units.filter((u) => u.side === 'enemy');

  let reach: number[][] | null = null;
  if (squad.length > 0) {
    reach = distances(grid, squad[0], (c) => c !== '#');
    let cut = false;
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '#' && reach![y][x] < 0) cut = true; }));
    if (cut) problems.push('some floor cannot be reached from the squad');
  }

  for (const foe of foes) {
    for (const p of squad) {
      if (chebyshev(p, foe.pos) <= 8) problems.push(`enemy ${foe.id} is within 8 tiles of the squad`);
      else if (hasLineOfSight(state, p, foe.pos)) problems.push(`enemy ${foe.id} sees the squad at the start`);
    }
  }

  for (const key of Object.keys(def.patrols)) {
    if (!foes.some((f) => f.id === key)) problems.push(`patrol ${key} belongs to no enemy`);
  }
  for (const foe of foes) {
    const route = def.patrols[foe.id];
    if (!route || route.length < 2) {
      problems.push(`patrol ${foe.id} is missing or has fewer than two points`);
      continue;
    }
    for (const p of route) {
      const inside = p.x >= 0 && p.y >= 0 && p.x < want.width && p.y < want.height;
      if (!inside || grid[p.y][p.x] === '#' || (reach && reach[p.y][p.x] < 0)) {
        problems.push(`patrol ${foe.id} has a point at ${p.x},${p.y} that cannot be walked to`);
      }
    }
  }

  for (const p of squad) {
    if (!squad.some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === 1)) {
      problems.push(`squad start is scattered: ${p.x},${p.y} stands alone`);
    }
  }
  return problems;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/gencheck.test.ts && npx tsc --noEmit`
Expected: PASS. Then prove each rule bites: temporarily delete one rule block in `check.ts`, confirm its test fails, restore it (mutation check; record in the ledger).

- [ ] **Step 5: Commit**

```bash
git add src/core/gen/check.ts tests/gencheck.test.ts
git commit -m "feat: playability check for generated maps" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Populating a layout (squad, enemies, items, patrols)

**Files:**
- Create: `src/core/gen/populate.ts`
- Test: `tests/genpopulate.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Rnd`, `distances`, `shuffled`, `toRows`, `fill`/`ri` as needed (Task 2); `buildLayout`; `Recipe`; `parseMap`; `hasLineOfSight`; `chebyshev`; `checkMission`/`expectFor` (Task 3); `MissionDef`.
- Produces: `populate(g: Grid, rnd: Rnd, r: Recipe, enemies: number): MissionDef | null` — mutates `g` (writes `P`, `E`, items), returns the def, or null when the layout cannot host the units under the rules (caller retries). Enemy ids `e1..eN` follow reading order; patrols are `[far point, start point]`.

- [ ] **Step 1: Write the failing tests**

`tests/genpopulate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { checkMission, expectFor } from '../src/core/gen/check';
import { buildLayout } from '../src/core/gen/layout';
import { populate } from '../src/core/gen/populate';
import { RECIPES } from '../src/core/gen/recipes';
import { seededRandom } from '../src/core/rng';

function attempt(i: number, seed: number) {
  const r = RECIPES[i];
  const rnd = seededRandom(seed);
  return populate(buildLayout(r, rnd), rnd, r, r.enemies);
}

describe.each(RECIPES.map((r, i) => [r.name, i] as const))('populate %s', (_name, i) => {
  const r = RECIPES[i];

  it('fills in a playable mission for at least some seeds, and every one it returns passes the check', () => {
    let made = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const def = attempt(i, seed);
      if (!def) continue;
      made++;
      expect(checkMission(def, expectFor(r)), `seed ${seed}`).toEqual([]);
      expect(def.id).toBe(r.id);
      expect(def.name).toBe(r.name);
    }
    expect(made).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic for a seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = attempt(i, seed);
      if (!a) continue;
      expect(attempt(i, seed)).toEqual(a);
      return;
    }
    throw new Error('no seed produced a map');
  });
});

describe('populate details', () => {
  it('starts the squad in the bottom-left corner area', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const def = attempt(0, seed);
      if (!def) continue;
      const squad: { x: number; y: number }[] = [];
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'P') squad.push({ x, y }); }));
      expect(squad).toHaveLength(4);
      for (const p of squad) {
        expect(p.x).toBeLessThan(15);
        expect(p.y).toBeGreaterThan(9);
      }
      return;
    }
    throw new Error('no seed produced a map');
  });

  it('numbers enemies in reading order and keys the patrols the same way', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const def = attempt(2, seed);
      if (!def) continue;
      const foes: { x: number; y: number }[] = [];
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'E') foes.push({ x, y }); }));
      foes.forEach((f, n) => expect(def.patrols[`e${n + 1}`][1], `e${n + 1}`).toEqual(f)); // the second point is the start
      return;
    }
    throw new Error('no seed produced a map');
  });

  it('returns null when the layout has too little floor', () => {
    const r = RECIPES[0];
    const rnd = seededRandom(1);
    const g = buildLayout(r, rnd);
    for (const row of g) row.fill('#', 1, row.length - 1); // wall everything inside
    expect(populate(g, rnd, r, r.enemies)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/genpopulate.test.ts`
Expected: FAIL (`gen/populate` not found).

- [ ] **Step 3: Implement**

`src/core/gen/populate.ts`:
```ts
import { chebyshev } from '../geometry';
import { parseMap } from '../mission';
import type { MissionDef } from '../missions';
import type { Pos } from '../types';
import { hasLineOfSight } from '../vision';
import { distances, shuffled, toRows, type Grid, type Rnd } from './grid';
import type { Recipe } from './recipes';

/**
 * Puts the squad in the bottom-left corner area, then enemies out of sight and out of range of it, the pickups,
 * and a two-point patrol for every enemy. Returns null when the layout cannot host all of that.
 */
export function populate(g: Grid, rnd: Rnd, r: Recipe, enemies: number): MissionDef | null {
  const h = g.length;
  const floors: Pos[] = [];
  g.forEach((row, y) => row.forEach((ch, x) => { if (ch === '.') floors.push({ x, y }); }));
  const wanted = 'r'.repeat(r.items.r) + 'p'.repeat(r.items.p) + 'g'.repeat(r.items.g);
  if (floors.length < 4 + enemies + wanted.length) return null;

  // squad: the four floor tiles nearest to the bottom-left corner, by walking distance
  const corner = floors.reduce((a, b) => (b.x + (h - 1 - b.y) < a.x + (h - 1 - a.y) ? b : a));
  const walk = distances(g, corner, (c) => c === '.');
  const squad = floors
    .filter((p) => walk[p.y][p.x] >= 0)
    .sort((a, b) => walk[a.y][a.x] - walk[b.y][b.x])
    .slice(0, 4);
  if (squad.length < 4) return null;
  for (const p of squad) g[p.y][p.x] = 'P';

  // enemies: far from the squad and with no line of sight, spread out where the map allows
  const terrain = parseMap(toRows(g));
  const safe = floors.filter(
    (p) => g[p.y][p.x] === '.' && squad.every((s) => chebyshev(s, p) > 8 && !hasLineOfSight(terrain, s, p)),
  );
  const pool = shuffled(rnd, safe);
  const placed: Pos[] = [];
  for (const gap of [4, 2, 0]) {
    for (const p of pool) {
      if (placed.length >= enemies) break;
      if (!placed.includes(p) && placed.every((q) => chebyshev(p, q) >= gap)) placed.push(p);
    }
  }
  if (placed.length < enemies) return null;
  for (const p of placed) g[p.y][p.x] = 'E';

  // pickups on any other floor
  const free = shuffled(rnd, floors.filter((p) => g[p.y][p.x] === '.'));
  if (free.length < wanted.length) return null;
  [...wanted].forEach((ch, i) => { g[free[i].y][free[i].x] = ch; });

  // patrols: from a point 3 to 8 steps away back to the start, keyed e1..eN in reading order
  const patrols: Record<string, Pos[]> = {};
  const order = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < order.length; i++) {
    const start = order[i];
    const d = distances(g, start, (c) => c !== '#');
    const spots = floors.filter((p) => g[p.y][p.x] === '.' && d[p.y][p.x] >= 3 && d[p.y][p.x] <= 8);
    if (spots.length === 0) return null;
    patrols[`e${i + 1}`] = [spots[Math.floor(rnd() * spots.length)], { x: start.x, y: start.y }];
  }

  return { id: r.id, name: r.name, rows: toRows(g), patrols };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/genpopulate.test.ts && npx tsc --noEmit`
Expected: PASS. If `made >= 4` fails for a recipe, the layout is rarely populatable: tune that recipe (for example a smaller yard, or `minW`/`minH`) in `recipes.ts`, or fix the cause in `layout.ts`, and ledger a Ruling. Do not lower the check rules.

- [ ] **Step 5: Commit**

```bash
git add src/core/gen/populate.ts tests/genpopulate.test.ts
git commit -m "feat: place squad, enemies, items and patrols on a layout" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `generateMission`, `drawVariations` and the 50 maps

**Files:**
- Create: `src/core/gen/index.ts`
- Test: `tests/genmissions.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 to 4.
- Produces: `VARIATIONS = 5`, `CAMPAIGN_LENGTH = RECIPES.length` (10), `generateMission(type: number, variation: number, difficulty = type + 1): MissionDef`, `drawVariations(seed: number): number[]` (ten ints 0..4). Re-exports `RECIPES`.
- `difficulty` adjusts the enemy count: `max(1, recipe.enemies + difficulty - (type + 1))`; the default leaves the recipe count.
- The internal attempt seed is `mix(type, variation, attempt)`; up to 50 attempts; throws `Error` after that. `type` or `variation` out of range throws `RangeError`.

- [ ] **Step 1: Write the failing tests**

`tests/genmissions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, drawVariations, generateMission } from '../src/core/gen';
import { checkMission, expectFor } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';

describe('constants', () => {
  it('has ten missions with five variations each', () => {
    expect(CAMPAIGN_LENGTH).toBe(10);
    expect(VARIATIONS).toBe(5);
  });
});

describe.each(RECIPES.map((r, i) => [r.name, i] as const))('generated %s', (_name, type) => {
  const r = RECIPES[type];

  it.each([0, 1, 2, 3, 4])('variation %i is playable, the right size, and the same every time', (v) => {
    const def = generateMission(type, v);
    expect(checkMission(def, expectFor(r))).toEqual([]);
    expect(def.rows).toHaveLength(r.height);
    expect(def.rows[0]).toHaveLength(r.width);
    expect(def.id).toBe(r.id);
    expect(generateMission(type, v)).toEqual(def);
  });

  it('has five different layouts', () => {
    const layouts = [0, 1, 2, 3, 4].map((v) => generateMission(type, v).rows.join('\n'));
    expect(new Set(layouts).size).toBe(5);
  });
});

describe('generateMission arguments', () => {
  it('rejects a type or variation out of range', () => {
    expect(() => generateMission(-1, 0)).toThrow(RangeError);
    expect(() => generateMission(10, 0)).toThrow(RangeError);
    expect(() => generateMission(0, 5)).toThrow(RangeError);
    expect(() => generateMission(0, 1.5)).toThrow(RangeError);
  });

  it('difficulty changes the enemy count and the map still passes the check', () => {
    const harder = generateMission(2, 0, 6); // type 2 is difficulty 3; +3 enemies
    const want = expectFor(RECIPES[2], RECIPES[2].enemies + 3);
    expect(checkMission(harder, want)).toEqual([]);
    const easy = generateMission(9, 0, 1); // 12 - 9 = 3 enemies
    expect(checkMission(easy, expectFor(RECIPES[9], 3))).toEqual([]);
  });
});

describe('drawVariations', () => {
  it('gives ten numbers from 0 to 4, the same for a seed', () => {
    const v = drawVariations(123);
    expect(v).toHaveLength(10);
    for (const n of v) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
    expect(drawVariations(123)).toEqual(v);
  });

  it('differs between seeds and uses every variation across many seeds', () => {
    const seen = new Set<number>();
    const lists = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const v = drawVariations(s);
      lists.add(v.join(','));
      v.forEach((n) => seen.add(n));
    }
    expect(lists.size).toBeGreaterThan(30);
    expect(seen.size).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/genmissions.test.ts`
Expected: FAIL (`../src/core/gen` not found).

- [ ] **Step 3: Implement**

`src/core/gen/index.ts`:
```ts
import type { MissionDef } from '../missions';
import { seededRandom } from '../rng';
import { checkMission, expectFor } from './check';
import { buildLayout } from './layout';
import { populate } from './populate';
import { RECIPES } from './recipes';

export { RECIPES } from './recipes';

/** Variations per map type. */
export const VARIATIONS = 5;
/** Missions in the generated campaign: one per map type. */
export const CAMPAIGN_LENGTH = RECIPES.length;
const ATTEMPTS = 50;

function mix(type: number, variation: number, attempt: number): number {
  return (
    Math.imul(type + 1, 0x9e3779b1) ^ Math.imul(variation + 1, 0x85ebca6b) ^ Math.imul(attempt + 1, 0xc2b2ae35)
  ) | 0;
}

/**
 * The map for (type, variation). The same pair always gives the same map: internal attempts are numbered, and the
 * first one that passes `checkMission` wins. `difficulty` (default: the type's place in the campaign, 1 to 10) moves
 * the enemy count up or down from the recipe's.
 */
export function generateMission(type: number, variation: number, difficulty: number = type + 1): MissionDef {
  const recipe = RECIPES[type];
  if (!Number.isInteger(type) || !recipe) throw new RangeError(`no map type ${type}`);
  if (!Number.isInteger(variation) || variation < 0 || variation >= VARIATIONS) {
    throw new RangeError(`no variation ${variation}`);
  }
  const enemies = Math.max(1, recipe.enemies + difficulty - (type + 1));
  const want = expectFor(recipe, enemies);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rnd = seededRandom(mix(type, variation, attempt));
    rnd();
    rnd();
    rnd(); // the first values of nearby seeds are alike
    const def = populate(buildLayout(recipe, rnd), rnd, recipe, enemies);
    if (def && checkMission(def, want).length === 0) return def;
  }
  throw new Error(`no playable ${recipe.name} variation ${variation} in ${ATTEMPTS} attempts`);
}

/** One variation (0 to 4) per map type for a new campaign, from a seed. */
export function drawVariations(seed: number): number[] {
  const rnd = seededRandom(seed);
  return RECIPES.map(() => Math.floor(rnd() * VARIATIONS));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/genmissions.test.ts && npx tsc --noEmit`
Expected: PASS for all 50 maps. If a map needs more than 50 attempts, tune that recipe (see Task 4 step 4) rather than raising `ATTEMPTS` above 100; ledger the change as a Ruling. Also print the attempt count per map once (temporary `console.log`, removed before committing) to see which recipes are fragile; write the worst count in the ledger.

- [ ] **Step 5: Mutation check and commit**

Mutation: temporarily make `populate` ignore the line-of-sight filter, run `npx vitest run tests/genmissions.test.ts`; it must still pass (the retry loop catches nothing because populate no longer places unseen enemies, but `checkMission` rejects them and the loop retries; if all attempts fail the test throws, which also proves the rule matters). Restore. Ledger the result.

```bash
git add src/core/gen/index.ts tests/genmissions.test.ts
git commit -m "feat: generateMission, drawVariations and the fifty maps" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Campaign mode in the core

**Files:**
- Modify: `src/core/campaign.ts`
- Test: `tests/campaignmodes.test.ts`; fix any existing test whose expectation only lacks the two new fields (`tests/campaign.test.ts`, `tests/loot.test.ts`, `tests/save.test.ts`)

**Interfaces:**
- Consumes: `drawVariations` is not used here (the caller draws variations).
- Produces: `type Mode = 'tutorial' | 'campaign'`; `Campaign` gains `mode: Mode` and `variations: number[]`; `newCampaign(mode: Mode = 'tutorial', variations: number[] = []): Campaign`; `recordMission` returns the same `mode` and `variations`.

- [ ] **Step 1: Write the failing tests**

`tests/campaignmodes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newCampaign, recordMission } from '../src/core/campaign';
import { corridorRows, makeState, unit } from './helpers';

const finished = (won: boolean) => {
  const s = makeState(corridorRows('PPPPE'));
  s.status = won ? 'won' : 'lost';
  if (!won) for (const id of ['p1', 'p2', 'p3', 'p4']) unit(s, id).alive = false;
  return s;
};

describe('campaign modes', () => {
  it('a plain newCampaign is the tutorial with no variations', () => {
    const c = newCampaign();
    expect(c.mode).toBe('tutorial');
    expect(c.variations).toEqual([]);
  });

  it('a campaign keeps the variations it was started with, and copies them', () => {
    const v = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];
    const c = newCampaign('campaign', v);
    expect(c.mode).toBe('campaign');
    expect(c.variations).toEqual(v);
    v[0] = 4;
    expect(c.variations[0]).toBe(0);
  });

  it('recordMission carries the mode and the variations through a win and a loss', () => {
    const c = newCampaign('campaign', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const won = recordMission(c, finished(true), 10);
    expect(won.mode).toBe('campaign');
    expect(won.variations).toEqual(c.variations);
    expect(won.missionIndex).toBe(1);
    const lost = recordMission(c, finished(false), 10);
    expect(lost.mode).toBe('campaign');
    expect(lost.variations).toEqual(c.variations);
    expect(lost.status).toBe('lost');
  });

  it('a ten-mission campaign is won on the tenth win and not before', () => {
    let c = newCampaign('campaign', Array(10).fill(0));
    for (let i = 0; i < 9; i++) {
      c = recordMission(c, finished(true), 10);
      expect(c.status).toBe('active');
    }
    c = recordMission(c, finished(true), 10);
    expect(c.status).toBe('won');
    expect(c.missionsWon).toBe(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/campaignmodes.test.ts`
Expected: FAIL (`mode` undefined).

- [ ] **Step 3: Implement**

In `src/core/campaign.ts`:
- After the `RosterSoldier` interface add `export type Mode = 'tutorial' | 'campaign';`.
- In `interface Campaign` add as the first fields:
```ts
  /** The hand-drawn tutorial or the generated ten-mission campaign. */
  mode: Mode;
  /** Campaign only: the variation (0 to 4) of each of the ten map types for this run; empty in the tutorial. */
  variations: number[];
```
- Replace `export function newCampaign(): Campaign {` and its return with:
```ts
export function newCampaign(mode: Mode = 'tutorial', variations: number[] = []): Campaign {
  return {
    mode,
    variations: [...variations],
    missionIndex: 0,
    missionsWon: 0,
    roster: Array.from({ length: CAMPAIGN.rosterSize }, (_, i) => ({ name: soldierName(i), kills: 0 })),
    fallen: [],
    namesUsed: CAMPAIGN.rosterSize,
    status: 'active',
    stash: emptyStash(),
  };
}
```
- In `recordMission`'s final `return`, add the two fields: `return { mode: c.mode, variations: [...c.variations], missionIndex, missionsWon, roster, fallen, namesUsed, status, stash };`

- [ ] **Step 4: Run the new test, then the whole suite**

Run: `npx vitest run tests/campaignmodes.test.ts` (PASS), then `npx tsc --noEmit` and `npx vitest run`.
Expected: type errors or failures only in places that build a `Campaign` literal or `toEqual` a campaign without the new fields (`src/save.ts` `parseSave` builds one: add `mode: 'tutorial', variations: []` there as a stopgap for this task; Task 7 rewrites it properly). Fix each by adding the fields to the expectation or literal; do not weaken any assertion.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: campaign mode and per-type variations in the core" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Two save slots and the last-mode memory

**Files:**
- Modify: `src/save.ts`
- Test: `tests/savemodes.test.ts`

**Interfaces:**
- Consumes: `Mode`, `Campaign` (Task 6); `CAMPAIGN_LENGTH`, `VARIATIONS` from `src/core/gen`.
- Produces: `SAVE_KEY` (unchanged), `CAMPAIGN_SAVE_KEY = 'laser-tribute-campaign'`, `LAST_KEY = 'laser-tribute-last'`; `parseSave(text, missionCount, mode: Mode = 'tutorial')`; `new SaveStore(storage, missionCount, mode: Mode = 'tutorial')` (key by mode, same `load/save/clear`); `class LastMode { constructor(storage: SaveStorage | null); get(): Mode | null; set(mode: Mode): void }`; `defaultSaveStore(missionCount)` (tutorial, unchanged), `defaultCampaignStore()`, `defaultLastMode()`.
- Rules: tutorial slot accepts `mode` missing or `'tutorial'` (a `'campaign'` text there is rejected); campaign slot needs `version === 1`, `mode === 'campaign'`, `variations` an array of exactly `CAMPAIGN_LENGTH` integers 0 to `VARIATIONS - 1`; every other validation as today. A parsed tutorial campaign has `variations: []`.

- [ ] **Step 1: Write the failing tests**

`tests/savemodes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/core/campaign';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { defaultLoadout } from '../src/core/loadout';
import {
  CAMPAIGN_SAVE_KEY, LAST_KEY, LastMode, SAVE_KEY, SaveStore, parseSave, type SaveStorage,
} from '../src/save';

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const VARS = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];
const campaignAt = (i: number) => ({ ...newCampaign('campaign', VARS), missionIndex: i, missionsWon: i });

describe('the campaign slot', () => {
  it('saves and loads a campaign with its variations, under its own key', () => {
    const mem = memory();
    const store = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    store.save(campaignAt(4), defaultLoadout());
    expect([...mem.data.keys()]).toEqual([CAMPAIGN_SAVE_KEY]);
    const back = store.load()!;
    expect(back.campaign.mode).toBe('campaign');
    expect(back.campaign.variations).toEqual(VARS);
    expect(back.campaign.missionIndex).toBe(4);
  });

  it('accepts mission 10 (index 9) but not index 10', () => {
    const mem = memory();
    const store = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    store.save(campaignAt(9), defaultLoadout());
    expect(store.load()!.campaign.missionIndex).toBe(9);
    store.save(campaignAt(10), defaultLoadout());
    expect(store.load()).toBeNull();
  });

  it.each([
    ['too few variations', VARS.slice(0, 9)],
    ['too many variations', [...VARS, 0]],
    ['a variation of 5', [...VARS.slice(0, 9), 5]],
    ['a negative variation', [...VARS.slice(0, 9), -1]],
    ['a fractional variation', [...VARS.slice(0, 9), 1.5]],
    ['a text variation', [...VARS.slice(0, 9), '2']],
  ])('rejects %s', (_label, variations) => {
    const text = JSON.stringify({ version: 1, campaign: { ...campaignAt(2), variations }, loadout: defaultLoadout() });
    expect(parseSave(text, CAMPAIGN_LENGTH, 'campaign')).toBeNull();
  });

  it('rejects a campaign text whose mode is not campaign, or whose variations are missing', () => {
    const base = { ...campaignAt(2) };
    expect(parseSave(JSON.stringify({ version: 1, campaign: { ...base, mode: 'tutorial' }, loadout: [] }), CAMPAIGN_LENGTH, 'campaign')).toBeNull();
    const { variations: _v, ...noVars } = base;
    expect(parseSave(JSON.stringify({ version: 1, campaign: noVars, loadout: [] }), CAMPAIGN_LENGTH, 'campaign')).toBeNull();
  });

  it('a corrupt campaign slot is ignored and leaves the tutorial slot alone', () => {
    const mem = memory();
    const tutorial = new SaveStore(mem, 3);
    const campaign = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    tutorial.save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    mem.setItem(CAMPAIGN_SAVE_KEY, '{not json');
    expect(campaign.load()).toBeNull();
    expect(tutorial.load()!.campaign.missionIndex).toBe(1);
  });

  it('clearing one slot leaves the other', () => {
    const mem = memory();
    const tutorial = new SaveStore(mem, 3);
    const campaign = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    tutorial.save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    campaign.save(campaignAt(2), defaultLoadout());
    campaign.clear();
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
    expect(tutorial.load()).not.toBeNull();
  });
});

describe('the tutorial slot', () => {
  it('loads an old save with no mode field as tutorial progress', () => {
    const old: Record<string, unknown> = { ...newCampaign(), missionIndex: 1, missionsWon: 1 };
    delete old.mode;
    delete old.variations;
    const back = parseSave(JSON.stringify({ version: 1, campaign: old, loadout: defaultLoadout() }), 3);
    expect(back!.campaign.mode).toBe('tutorial');
    expect(back!.campaign.variations).toEqual([]);
    expect(back!.campaign.missionIndex).toBe(1);
  });

  it('rejects a campaign-mode text in the tutorial slot', () => {
    const text = JSON.stringify({ version: 1, campaign: campaignAt(1), loadout: defaultLoadout() });
    expect(parseSave(text, 3)).toBeNull();
  });

  it('writes under the old key', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    expect([...mem.data.keys()]).toEqual([SAVE_KEY]);
  });
});

describe('LastMode', () => {
  it('remembers the mode and ignores junk and storage errors', () => {
    const mem = memory();
    const last = new LastMode(mem);
    expect(last.get()).toBeNull();
    last.set('campaign');
    expect(mem.data.get(LAST_KEY)).toBe('campaign');
    expect(last.get()).toBe('campaign');
    mem.setItem(LAST_KEY, 'banana');
    expect(last.get()).toBeNull();
    const broken: SaveStorage = {
      getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => undefined,
    };
    const b = new LastMode(broken);
    expect(b.get()).toBeNull();
    expect(() => b.set('tutorial')).not.toThrow();
    expect(new LastMode(null).get()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/savemodes.test.ts`
Expected: FAIL (`CAMPAIGN_SAVE_KEY`, `LastMode` not exported).

- [ ] **Step 3: Implement**

In `src/save.ts`:
- Imports: `import { CAMPAIGN, type Campaign, type Mode, type RosterSoldier } from './core/campaign';` and `import { CAMPAIGN_LENGTH, VARIATIONS } from './core/gen';`.
- Keys: keep `export const SAVE_KEY = 'laser-tribute-save';` and add
```ts
export const CAMPAIGN_SAVE_KEY = 'laser-tribute-campaign';
export const LAST_KEY = 'laser-tribute-last';
const keyFor = (mode: Mode): string => (mode === 'campaign' ? CAMPAIGN_SAVE_KEY : SAVE_KEY);
```
- Add a helper above `parseSave`:
```ts
/** The ten variations of a campaign save, or null when they are not exactly ten integers from 0 to 4. */
function variationList(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== CAMPAIGN_LENGTH) return null;
  const out: number[] = [];
  for (const n of v) {
    if (!isInt(n, 0, VARIATIONS - 1)) return null;
    out.push(n);
  }
  return out;
}
```
- Change `parseSave`'s signature to `parseSave(text: string | null, missionCount: number, mode: Mode = 'tutorial'): Save | null`. After the existing `c.status !== 'active'` line and mission checks, add the mode handling and build the campaign with them:
```ts
  if (mode === 'campaign' ? c.mode !== 'campaign' : c.mode !== undefined && c.mode !== 'tutorial') return null;
  const variations = mode === 'campaign' ? variationList(c.variations) : [];
  if (!variations) return null;
```
and add `mode, variations,` to the `campaign` object literal (replace the stopgap from Task 6).
- `SaveStore`: constructor becomes
```ts
  constructor(
    private readonly storage: SaveStorage | null,
    private readonly missionCount: number,
    private readonly mode: Mode = 'tutorial',
  ) {}
```
and `load/save/clear` use `keyFor(this.mode)` instead of `SAVE_KEY`; `load` passes `this.mode` to `parseSave`.
- Add after `SaveStore`:
```ts
/** Which mode was played last, so CONTINUE can pick it. Every storage error is swallowed. */
export class LastMode {
  constructor(private readonly storage: SaveStorage | null) {}

  get(): Mode | null {
    try {
      const v = this.storage?.getItem(LAST_KEY);
      return v === 'tutorial' || v === 'campaign' ? v : null;
    } catch {
      return null;
    }
  }

  set(mode: Mode): void {
    try {
      this.storage?.setItem(LAST_KEY, mode);
    } catch {
      // carry on unsaved
    }
  }
}

function browserStorage(): SaveStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function defaultCampaignStore(): SaveStore | null {
  const s = browserStorage();
  return s ? new SaveStore(s, CAMPAIGN_LENGTH, 'campaign') : null;
}

export function defaultLastMode(): LastMode | null {
  const s = browserStorage();
  return s ? new LastMode(s) : null;
}
```
- Replace the body of `defaultSaveStore` with `const s = browserStorage(); return s ? new SaveStore(s, missionCount) : null;`.

- [ ] **Step 4: Run, then the whole suite**

Run: `npx vitest run tests/savemodes.test.ts tests/save.test.ts && npx tsc --noEmit`
Expected: PASS (existing save tests still pass: tutorial behaviour is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/save.ts tests/savemodes.test.ts
git commit -m "feat: separate tutorial and campaign save slots, last-mode memory" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The three-button title screen

**Files:**
- Modify: `src/screens/title.ts`
- Rewrite: `tests/title.test.ts`

**Interfaces:**
- Produces: `interface TitleView { continue: { mode: Mode; missionNumber: number; missionCount: number; soldiers: number; budget: number } | null; armed: Mode | null }`; `TITLE` rects `{ card, cont, campaign, tutorial }`; `titleHit(px, py, hasContinue: boolean): 'continue' | 'campaign' | 'tutorial' | null`; `titleSummary(c: NonNullable<TitleView['continue']>): string` = `"CAMPAIGN: MISSION 4 OF 10, 4 SOLDIERS, 215 CR"` (mode word then the old text; `TUTORIAL: MISSION 2 OF 3, ...`); `drawTitle(ctx, v)`.
- Layout (menu space 480x400): card `{x:90,y:50,w:300,h:260}`; `cont {x:160,y:130,w:160,h:28}`, `campaign {x:160,y:170,w:160,h:28}`, `tutorial {x:160,y:210,w:160,h:28}`; heading at `card.y+20`, summary at `card.y+60` (only when `continue` exists); hint at `card.y+220` (`ENTER CONTINUE   N NEW CAMPAIGN   T TUTORIAL`, or without the ENTER part when there is no save). When `armed` is `'campaign'` or `'tutorial'`, that button shows `REPLACE SAVE? PRESS AGAIN` in red, as NEW CAMPAIGN does today.

- [ ] **Step 1: Rewrite the test file**

Replace `tests/title.test.ts` entirely with:
```ts
import { describe, expect, it } from 'vitest';
import { TITLE, drawTitle, titleHit, titleSummary, type TitleView } from '../src/screens/title';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const saved = { mode: 'campaign' as const, missionNumber: 4, missionCount: 10, soldiers: 4, budget: 215 };
const view = (over: Partial<TitleView> = {}): TitleView => ({ continue: saved, armed: null, ...over });

const left = (r: TextRun): number =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

function texts(v: TitleView): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  drawTitle(ctx, v);
  stop();
  return runs;
}

describe('title screen', () => {
  it('finds the three buttons and ignores everything else', () => {
    expect(titleHit(240, 144, true)).toBe('continue');
    expect(titleHit(160, 130, true)).toBe('continue');
    expect(titleHit(319, 157, true)).toBe('continue');
    expect(titleHit(240, 184, true)).toBe('campaign');
    expect(titleHit(240, 224, true)).toBe('tutorial');
    expect(titleHit(240, 164, true)).toBeNull(); // between the buttons
    expect(titleHit(159, 144, true)).toBeNull();
    expect(titleHit(320, 144, true)).toBeNull();
    expect(titleHit(10, 10, true)).toBeNull();
  });

  it('has no continue button to hit when there is no save', () => {
    expect(titleHit(240, 144, false)).toBeNull();
    expect(titleHit(240, 184, false)).toBe('campaign');
    expect(titleHit(240, 224, false)).toBe('tutorial');
  });

  it('summarises the saved game with its mode', () => {
    expect(titleSummary(saved)).toBe('CAMPAIGN: MISSION 4 OF 10, 4 SOLDIERS, 215 CR');
    expect(titleSummary({ ...saved, mode: 'tutorial', missionNumber: 2, missionCount: 3, soldiers: 1 })).toBe(
      'TUTORIAL: MISSION 2 OF 3, 1 SOLDIER, 215 CR',
    );
  });

  it('draws the heading, the summary, the three buttons and the hint when a save exists', () => {
    const t = texts(view()).map((r) => r.text);
    expect(t).toContain('LASER TRIBUTE');
    expect(t).toContain('CAMPAIGN: MISSION 4 OF 10, 4 SOLDIERS, 215 CR');
    expect(t).toContain('CONTINUE');
    expect(t).toContain('NEW CAMPAIGN');
    expect(t).toContain('TUTORIAL');
    expect(t.some((s) => s.includes('ENTER') && s.includes('N ') && s.includes('T '))).toBe(true);
  });

  it('draws no CONTINUE, no summary and no ENTER hint without a save', () => {
    const t = texts(view({ continue: null })).map((r) => r.text);
    expect(t).not.toContain('CONTINUE');
    expect(t.some((s) => s.includes('MISSION'))).toBe(false);
    expect(t.some((s) => s.includes('ENTER'))).toBe(false);
    expect(t).toContain('NEW CAMPAIGN');
    expect(t).toContain('TUTORIAL');
  });

  it('shows the confirmation text on the armed button only', () => {
    const c = texts(view({ armed: 'campaign' })).map((r) => r.text);
    expect(c).toContain('REPLACE SAVE? PRESS AGAIN');
    expect(c).not.toContain('NEW CAMPAIGN');
    expect(c).toContain('TUTORIAL');
    const t = texts(view({ armed: 'tutorial' })).map((r) => r.text);
    expect(t).toContain('REPLACE SAVE? PRESS AGAIN');
    expect(t).not.toContain('TUTORIAL');
    expect(t).toContain('NEW CAMPAIGN');
  });

  it('fits every text inside the card, even with big numbers', () => {
    const views = [
      view(), view({ armed: 'campaign' }), view({ armed: 'tutorial' }), view({ continue: null }),
      view({ continue: { ...saved, missionNumber: 10, budget: 9999, soldiers: 12 } }),
      view({ continue: { ...saved, mode: 'tutorial' } }),
    ];
    for (const v of views) {
      for (const r of texts(v)) {
        expect(unsupportedChars(r.text), r.text).toEqual([]);
        expect(left(r), r.text).toBeGreaterThanOrEqual(TITLE.card.x);
        expect(left(r) + r.width, r.text).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      }
    }
  });

  it('keeps the three buttons inside the card and apart', () => {
    const rects = [TITLE.cont, TITLE.campaign, TITLE.tutorial];
    for (const b of rects) {
      expect(b.x).toBeGreaterThanOrEqual(TITLE.card.x);
      expect(b.x + b.w).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      expect(b.y + b.h).toBeLessThan(TITLE.card.y + TITLE.card.h - 20);
    }
    for (let i = 1; i < rects.length; i++) expect(rects[i].y).toBeGreaterThanOrEqual(rects[i - 1].y + rects[i - 1].h + 4);
    expect(textWidth('REPLACE SAVE? PRESS AGAIN')).toBeLessThanOrEqual(TITLE.campaign.w);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/title.test.ts`
Expected: FAIL (new exports missing).

- [ ] **Step 3: Implement**

Replace `src/screens/title.ts` with:
```ts
import type { Mode } from '../core/campaign';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame } from '../ui/frame';
import { drawText } from '../ui/text';

export interface TitleView {
  /** The game CONTINUE would resume, or null when there is no save. */
  continue: { mode: Mode; missionNumber: number; missionCount: number; soldiers: number; budget: number } | null;
  /** The first press of a button that would replace a save happened; a second one replaces it. */
  armed: Mode | null;
}

export const TITLE = {
  card: { x: 90, y: 50, w: 300, h: 260 },
  cont: { x: 160, y: 130, w: 160, h: 28 },
  campaign: { x: 160, y: 170, w: 160, h: 28 },
  tutorial: { x: 160, y: 210, w: 160, h: 28 },
} as const;

const inside = (b: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean =>
  px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

export function titleHit(px: number, py: number, hasContinue: boolean): 'continue' | 'campaign' | 'tutorial' | null {
  if (hasContinue && inside(TITLE.cont, px, py)) return 'continue';
  if (inside(TITLE.campaign, px, py)) return 'campaign';
  if (inside(TITLE.tutorial, px, py)) return 'tutorial';
  return null;
}

export function titleSummary(c: NonNullable<TitleView['continue']>): string {
  const mode = c.mode === 'campaign' ? 'CAMPAIGN' : 'TUTORIAL';
  return `${mode}: MISSION ${c.missionNumber} OF ${c.missionCount}, ${c.soldiers} ${c.soldiers === 1 ? 'SOLDIER' : 'SOLDIERS'}, ${c.budget} CR`;
}

export function drawTitle(ctx: CanvasRenderingContext2D, v: TitleView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = TITLE.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 30, 'inset');
  drawText(ctx, 'LASER TRIBUTE', c.x + c.w / 2, c.y + 20, UI.accent, 'center');

  if (v.continue) {
    drawText(ctx, titleSummary(v.continue), c.x + c.w / 2, c.y + 60, UI.text, 'center');
    const k = TITLE.cont;
    drawButton(ctx, { x: k.x, y: k.y, w: k.w, h: k.h }, 'CONTINUE', 'raised');
  }
  const button = (b: { x: number; y: number; w: number; h: number }, label: string, armed: boolean): void => {
    if (armed) {
      drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
      drawText(ctx, 'REPLACE SAVE? PRESS AGAIN', b.x + b.w / 2, b.y + Math.floor((b.h - 7) / 2), UI.red, 'center');
    } else {
      drawButton(ctx, { x: b.x, y: b.y, w: b.w, h: b.h }, label, 'raised');
    }
  };
  button(TITLE.campaign, 'NEW CAMPAIGN', v.armed === 'campaign');
  button(TITLE.tutorial, 'TUTORIAL', v.armed === 'tutorial');
  drawText(
    ctx, `${v.continue ? 'ENTER CONTINUE   ' : ''}N NEW CAMPAIGN   T TUTORIAL`, c.x + c.w / 2, c.y + 220, UI.hint, 'center',
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/title.test.ts`
Expected: PASS. (`npx tsc --noEmit` will report `src/app.ts` errors until Task 9; that is expected here. Commit with `--no-verify` is not needed: tsc is not a commit hook.)

- [ ] **Step 5: Commit**

```bash
git add src/screens/title.ts tests/title.test.ts
git commit -m "feat: title screen with continue, new campaign and tutorial" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: App integration: modes, slots, mission lists

**Files:**
- Modify: `src/app.ts`
- Test: new `tests/campaignapp.test.ts`; update `tests/app.test.ts`, `tests/mobileapp.test.ts`, `tests/layout.test.ts`, `tests/soundapp.test.ts`

**Interfaces:**
- Consumes: Tasks 6 to 8, `CAMPAIGN_LENGTH`, `drawVariations`, `generateMission`.
- New `AppOptions`: `campaignStore?: SaveStore | null`, `last?: LastMode | null`, `generate?: (type: number, variation: number) => MissionDef`, `skipTitle?: boolean`. Defaults: when `store` is omitted (the real game) the campaign store and last-mode memory come from the browser; when `store` is given (tests) they default to `null`.
- Start-up: load both slots; if any exists show the title (CONTINUE resumes the last-played mode's save, else the other); with none, show the title too, unless `skipTitle` is true, in which case start on the tutorial's equipment screen (tests and tools only; a real save still shows the title).
- Title input: click CONTINUE / NEW CAMPAIGN / TUTORIAL; keys Enter (continue, only if a save exists), N (new campaign), T (tutorial). NEW CAMPAIGN or TUTORIAL starts at once when that mode's slot has no save; otherwise the first press arms (3 s, red text), a second press of the same button replaces that slot only. A press of the other button disarms.
- Missions: tutorial uses `this.missions` (3); campaign uses `generate(i, variations[i])` (cached per index, cleared when a campaign begins). `recordMission` gets the mode's mission count; saving goes to the mode's store and updates `last`; finishing (won or lost) clears that mode's slot. The end screen's NEW CAMPAIGN restarts the same mode.
- Screens: equipment title `MISSION n OF N: NAME`; result card name `NAME, MISSION n OF N` (upper case); end screen mission count by mode.

- [ ] **Step 1: Write the failing tests**

`tests/campaignapp.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { newCampaign } from '../src/core/campaign';
import { CAMPAIGN_LENGTH, drawVariations } from '../src/core/gen';
import { defaultLoadout } from '../src/core/loadout';
import {
  CAMPAIGN_SAVE_KEY, LAST_KEY, LastMode, SAVE_KEY, SaveStore, type SaveStorage,
} from '../src/save';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState } from './helpers';

const CONTINUE = { x: 240, y: 144 };
const CAMPAIGN = { x: 240, y: 184 };
const TUTORIAL = { x: 240, y: 224 };
const START = { x: 240, y: 345 };
const RESULT_CONTINUE = { x: 240, y: 235 };

const winTiny = (): GameState => makeState(corridorRows('P..'));

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function setup(storage = memory(), opts: AppOptions = {}) {
  let t = 0;
  const app = new App({
    clock: () => t,
    newSeed: () => 5,
    store: new SaveStore(storage, 3),
    campaignStore: new SaveStore(storage, CAMPAIGN_LENGTH, 'campaign'),
    last: new LastMode(storage),
    ...opts,
  });
  return { app, storage, wait: () => { t += 500; } };
}

/** From the equipment screen: start, win with no enemies, and press Continue on the result card. */
function winMission(app: App, wait: () => void): void {
  wait();
  app.click(START);
  app.controller!.key('e');
  app.update(1000);
  app.update(2200);
  wait();
  app.click(RESULT_CONTINUE);
  wait();
}

const campaignSave = (index: number) => ({ ...newCampaign('campaign', drawVariations(5)), missionIndex: index, missionsWon: index });

describe('start-up', () => {
  it('shows the title with no continue when there is no save', () => {
    const { app } = setup();
    expect(app.screen).toBe('title');
    app.click(CONTINUE); // nothing there
    expect(app.screen).toBe('title');
  });

  it('skipTitle goes straight to the tutorial equipment screen when there is no save', () => {
    const { app } = setup(memory(), { skipTitle: true });
    expect(app.screen).toBe('equipment');
    expect(app.campaign.mode).toBe('tutorial');
  });

  it('skipTitle does not hide a real save', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    expect(setup(mem, { skipTitle: true }).app.screen).toBe('title');
  });

  it('TUTORIAL starts the hand-drawn tutorial, NEW CAMPAIGN a generated one', () => {
    const t = setup();
    t.app.click(TUTORIAL);
    expect(t.app.screen).toBe('equipment');
    expect(t.app.campaign.mode).toBe('tutorial');
    const c = setup();
    c.app.click(CAMPAIGN);
    expect(c.app.screen).toBe('equipment');
    expect(c.app.campaign.mode).toBe('campaign');
    expect(c.app.campaign.variations).toEqual(drawVariations(5));
  });

  it('the keys N, T and Enter do the same as the buttons', () => {
    const n = setup();
    n.app.key('n');
    expect(n.app.campaign.mode).toBe('campaign');
    const t = setup();
    t.app.key('T');
    expect(t.app.campaign.mode).toBe('tutorial');
    expect(t.app.screen).toBe('equipment');
    const e = setup();
    e.app.key('Enter'); // no save: nothing happens
    expect(e.app.screen).toBe('title');
  });
});

describe('a campaign mission', () => {
  it('is the generated Outpost for mission 1: 30x20 with 4 enemies', () => {
    const { app, wait } = setup();
    app.click(CAMPAIGN);
    wait();
    app.click(START);
    const s = app.controller!.state;
    expect([s.width, s.height]).toEqual([30, 20]);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(4);
  });

  it('mission 10 is the 48x32 Citadel with 12 enemies, and the camera stays inside it', () => {
    const mem = memory();
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(9), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CONTINUE);
    wait();
    app.click(START);
    const s = app.controller!.state;
    expect([s.width, s.height]).toEqual([48, 32]);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(12);
    expect(app.camera.cx).toBeGreaterThanOrEqual(0);
    expect(app.camera.cx).toBeLessThanOrEqual(48);
    expect(app.camera.cy).toBeGreaterThanOrEqual(0);
    expect(app.camera.cy).toBeLessThanOrEqual(32);
  });

  it('winning the tenth mission ends the campaign as won and clears its save', () => {
    const mem = memory();
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(9), defaultLoadout());
    const { app, wait } = setup(mem, { createMission: winTiny });
    app.click(CONTINUE);
    winMission(app, wait);
    expect(app.screen).toBe('end');
    expect(app.campaign.status).toBe('won');
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
  });

  it('winning mission 1 saves to the campaign slot only and remembers the mode', () => {
    const { app, wait, storage } = setup(memory(), { createMission: winTiny });
    app.click(CAMPAIGN);
    winMission(app, wait);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
    expect(storage.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(storage.data.get(LAST_KEY)).toBe('campaign');
  });
});

describe('two slots', () => {
  it('a tutorial save and a campaign save live side by side, and CONTINUE resumes the last played', () => {
    const mem = memory();
    const first = setup(mem, { createMission: winTiny });
    first.app.click(TUTORIAL);
    winMission(first.app, first.wait);
    const second = setup(mem, { createMission: winTiny });
    second.app.click(CAMPAIGN); // no campaign save yet: starts at once even though a tutorial save exists
    expect(second.app.campaign.mode).toBe('campaign');
    winMission(second.app, second.wait);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);

    const reloaded = setup(mem);
    expect(reloaded.app.screen).toBe('title');
    reloaded.app.click(CONTINUE);
    expect(reloaded.app.campaign.mode).toBe('campaign'); // played last
    expect(JSON.parse(mem.data.get(SAVE_KEY)!).campaign.missionIndex).toBe(1); // tutorial slot untouched
  });

  it('CONTINUE falls back to the other slot when the last-played mode has no save', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    mem.setItem(LAST_KEY, 'campaign'); // but there is no campaign save
    const { app } = setup(mem);
    app.click(CONTINUE);
    expect(app.campaign.mode).toBe('tutorial');
    expect(app.campaign.missionIndex).toBe(1);
  });

  it('an old save with no mode loads as the tutorial', () => {
    const mem = memory();
    const old: Record<string, unknown> = { ...newCampaign(), missionIndex: 1, missionsWon: 1 };
    delete old.mode;
    delete old.variations;
    mem.setItem(SAVE_KEY, JSON.stringify({ version: 1, campaign: old, loadout: defaultLoadout() }));
    const { app } = setup(mem);
    expect(app.screen).toBe('title');
    app.click(CONTINUE);
    expect(app.campaign.mode).toBe('tutorial');
    expect(app.campaign.missionIndex).toBe(1);
  });

  it('a corrupt campaign slot is ignored and the tutorial save still continues', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    mem.setItem(CAMPAIGN_SAVE_KEY, '{broken');
    const { app } = setup(mem);
    app.click(CONTINUE);
    expect(app.campaign.mode).toBe('tutorial');
  });

  it('NEW CAMPAIGN over a campaign save needs a second press, which replaces only that slot', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(3), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CAMPAIGN);
    expect(app.screen).toBe('title'); // armed
    wait();
    app.click(CAMPAIGN);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
  });

  it('pressing the other button disarms, and TUTORIAL over no tutorial save starts at once', () => {
    const mem = memory();
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(3), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CAMPAIGN); // armed
    wait();
    app.click(TUTORIAL); // no tutorial save: starts at once
    expect(app.screen).toBe('equipment');
    expect(app.campaign.mode).toBe('tutorial');
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(true); // not replaced
  });

  it('two presses of different buttons are not a confirmation', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(3), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CAMPAIGN); // armed for the campaign
    wait();
    app.click(TUTORIAL); // arms the tutorial instead
    expect(app.screen).toBe('title');
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
  });
});

describe('screens by mode', () => {
  it('the end screen of a finished tutorial offers a new tutorial, of a campaign a new campaign', () => {
    const t = setup(memory(), { createMission: () => makeState(corridorRows('PPPPE')) });
    t.app.click(TUTORIAL);
    expect(t.app.campaign.mode).toBe('tutorial');
    // lose the mission: all soldiers dead on the enemy turn is covered in app.test; here just check the mode survives a new run
    t.app.campaign = { ...t.app.campaign, status: 'lost' };
    t.app.screen = 'end';
    t.wait();
    t.app.click({ x: 240, y: 252 }); // NEW CAMPAIGN button of the end screen
    expect(t.app.campaign.mode).toBe('tutorial');
    expect(t.app.screen).toBe('equipment');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/campaignapp.test.ts`
Expected: FAIL (`skipTitle`, `campaignStore`, mode handling missing).

- [ ] **Step 3: Implement the App changes**

Edit `src/app.ts`:

1. Imports. Change the campaign import to also bring `type Mode`; add `import { CAMPAIGN_LENGTH, drawVariations, generateMission } from './core/gen';`; change the save import to `import { defaultCampaignStore, defaultLastMode, defaultSaveStore, type LastMode, type Save, type SaveStore } from './save';`; change the title import to `import { drawTitle, titleHit, type TitleView } from './screens/title';`.
2. Add to `AppOptions` (after `store`):
```ts
  /** Where the generated campaign is saved (same rule as `store`: undefined uses the browser, null turns saving off). */
  campaignStore?: SaveStore | null;
  /** Remembers which mode was played last. */
  last?: LastMode | null;
  /** Builds a campaign mission from (type, variation); defaults to the generator. */
  generate?: (type: number, variation: number) => MissionDef;
  /** With no save to continue, start on the tutorial's equipment screen instead of the title (tests and tools). */
  skipTitle?: boolean;
```
3. Fields: replace `private newArmedUntil = 0;` with
```ts
  private newArmedUntil = 0;
  private armedMode: Mode | null = null;
  private saves: { tutorial: Save | null; campaign: Save | null } = { tutorial: null, campaign: null };
  private readonly campaignStore: SaveStore | null;
  private readonly lastMode: LastMode | null;
  private readonly generate: NonNullable<AppOptions['generate']>;
  private generated = new Map<number, MissionDef>();
```
4. Constructor: after `this.camera = createCamera(...)`, replace the store/save block (from `this.store = ...` through the closing brace of `if (saved) {...}`) with:
```ts
    const real = opts.store === undefined; // the real game; tests pass their own stores
    this.store = real ? defaultSaveStore(this.missions.length) : opts.store!;
    this.campaignStore = opts.campaignStore !== undefined ? opts.campaignStore : real ? defaultCampaignStore() : null;
    this.lastMode = opts.last !== undefined ? opts.last : real ? defaultLastMode() : null;
    this.generate = opts.generate ?? generateMission;
    this.saves = { tutorial: this.store?.load() ?? null, campaign: this.campaignStore?.load() ?? null };
    this.screen = this.continueMode() === null && opts.skipTitle ? 'equipment' : 'title';
```
Note `opts.store` may be `null` (saving off): `real` is false then, `this.store = null` is right: `opts.store!` is a typing shortcut; write `(opts.store ?? null)` instead to avoid the non-null assertion.
5. New methods (put them next to `pressNew`, which is replaced):
```ts
  private storeFor(mode: Mode): SaveStore | null {
    return mode === 'campaign' ? this.campaignStore : this.store;
  }

  /** The mode CONTINUE would resume: the one played last if it has a save, else the other one, else none. */
  private continueMode(): Mode | null {
    const last = this.lastMode?.get() ?? 'tutorial';
    const order: Mode[] = last === 'campaign' ? ['campaign', 'tutorial'] : ['tutorial', 'campaign'];
    return order.find((m) => this.saves[m] !== null) ?? null;
  }

  private missionCount(): number {
    return this.campaign.mode === 'campaign' ? CAMPAIGN_LENGTH : this.missions.length;
  }

  private titleView(): TitleView {
    const m = this.continueMode();
    const save = m ? this.saves[m] : null;
    return {
      continue: m && save
        ? {
            mode: m,
            missionNumber: save.campaign.missionIndex + 1,
            missionCount: m === 'campaign' ? CAMPAIGN_LENGTH : this.missions.length,
            soldiers: save.campaign.roster.length,
            budget: campaignBudget(save.campaign),
          }
        : null,
      armed: this.clock() < this.newArmedUntil ? this.armedMode : null,
    };
  }

  private continueFromTitle(): void {
    const mode = this.continueMode();
    const save = mode ? this.saves[mode] : null;
    if (!mode || !save) return;
    this.newArmedUntil = 0;
    this.campaign = save.campaign;
    this.generated.clear();
    this.loadout = fitLoadout(save.loadout, campaignBudget(save.campaign), save.campaign.stash);
    this.lastMode?.set(mode);
    this.screen = 'equipment';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** NEW CAMPAIGN or TUTORIAL on the title: starts at once, or arms first when it would replace that mode's save. */
  private pressStart(mode: Mode): void {
    if (this.saves[mode] === null) {
      this.begin(mode);
      return;
    }
    if (this.armedMode === mode && this.clock() < this.newArmedUntil) {
      this.newArmedUntil = 0;
      this.armedMode = null;
      this.storeFor(mode)?.clear();
      this.saves[mode] = null;
      this.begin(mode);
      return;
    }
    this.armedMode = mode;
    this.newArmedUntil = this.clock() + NEW_CONFIRM_MS;
    this.lock(); // a held key or a double click must not count as the second press
    this.sound.play('click', 0.9);
  }

  /** A fresh run of `mode` on the equipment screen. */
  private begin(mode: Mode): void {
    this.campaign = mode === 'campaign' ? newCampaign('campaign', drawVariations(this.newSeed())) : newCampaign();
    this.generated.clear();
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.hover = null;
    this.newArmedUntil = 0;
    this.lastMode?.set(mode);
    this.screen = 'equipment';
    this.lock();
    this.sound.play('click', 0.9);
  }
```
Delete the old `continueFromTitle`, `pressNew` and `newCampaignScreen`.
6. `mission()` becomes:
```ts
  private mission(): MissionDef {
    const i = Math.min(this.campaign.missionIndex, this.missionCount() - 1);
    if (this.campaign.mode === 'tutorial') return this.missions[i];
    let def = this.generated.get(i);
    if (!def) {
      def = this.generate(i, this.campaign.variations[i]);
      this.generated.set(i, def);
    }
    return def;
  }
```
7. `startMission`: after `this.playedName = def.name;` replace with
```ts
    this.playedName = `${def.name}, MISSION ${this.campaign.missionIndex + 1} OF ${this.missionCount()}`.toUpperCase();
```
8. `click` title case: replace the body with
```ts
      case 'title': {
        const hit = titleHit(mp.x, mp.y, this.continueMode() !== null);
        if (hit === 'continue') this.continueFromTitle();
        else if (hit === 'campaign') this.pressStart('campaign');
        else if (hit === 'tutorial') this.pressStart('tutorial');
        return;
      }
```
`click` end case: `if (endHit(mp.x, mp.y) === 'new') this.begin(this.campaign.mode);`
9. `key` title case: replace with
```ts
      case 'title':
        if (k === 'Enter') {
          if (!this.locked() && this.continueMode() !== null) this.continueFromTitle();
          return true;
        }
        if (k === 'n' || k === 'N' || k === 't' || k === 'T') {
          if (!repeat && !this.locked()) this.pressStart(k === 'n' || k === 'N' ? 'campaign' : 'tutorial');
          return true;
        }
        return false;
```
`key` end case: `if (!this.locked()) this.begin(this.campaign.mode);`
10. `update`: replace `recordMission(this.campaign, c.state, this.missions.length, this.usedLoadout)` with `this.missionCount()`; replace the `if (this.campaign.status === 'active') { this.store?.save(...) } else { this.store?.clear(); }` block with
```ts
      const mode = this.campaign.mode;
      if (this.campaign.status === 'active') {
        const loadout = fitLoadout(this.loadout, this.budget(), this.campaign.stash);
        this.storeFor(mode)?.save(this.campaign, loadout);
        this.saves[mode] = { campaign: this.campaign, loadout };
        this.lastMode?.set(mode);
      } else {
        this.storeFor(mode)?.clear();
        this.saves[mode] = null;
      }
```
11. `equipmentView`: use `this.missionCount()` instead of `this.missions.length`. `drawScreen` title case: `this.inMenuSpace(ctx, () => drawTitle(ctx, this.titleView()));` (remove the now unused local `c`); end case: `missionCount: this.missionCount()`.

Then update the existing tests so they keep their meaning:
- `tests/app.test.ts` `make`: add `skipTitle: true` to the options (`new App({ clock: () => t, skipTitle: true, ...opts })`). The saved-game tests that expect the title with a save keep working (a real save shows the title). Tests that press the old title buttons (NEW CAMPAIGN at the old position, `n` key) must use the new coordinates `CONTINUE {240,144}`, `CAMPAIGN {240,184}`, `TUTORIAL {240,224}` and the new rules (a first press arms only when that slot has a save). A test of "NEW CAMPAIGN on the title replaces the save" now clicks the TUTORIAL button (the old save is the tutorial slot) twice.
- `tests/mobileapp.test.ts` `make`, `tests/layout.test.ts` (2 constructions) and `tests/soundapp.test.ts` (1): add `skipTitle: true`.
- Run `npx vitest run` and fix every remaining failure by reading it; any change to an existing expectation beyond coordinates, `skipTitle` and the new two-press rule needs a ledger Ruling.

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (all previous tests plus the new ones). Mutation checks (ledger each): (a) make `pressStart` skip the arming (always `begin`) and confirm the "needs a second press" test fails; (b) make `update` save to `this.store` always and confirm the "campaign slot only" test fails; (c) make `continueMode` ignore `lastMode` and confirm the "last played" test fails. Restore each.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: tutorial and campaign modes in the app, two save slots, three-button title" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Big maps in the engine, and a game test of all ten types

**Files:**
- Test: `tests/genplay.test.ts` (new). Production changes only if a test exposes a real problem.

**Interfaces:**
- Consumes: `generateMission`, `RECIPES`, `createMission`, `runEnemyTurn` (`src/core/ai.ts`), `findPath`, `computeVisible`, `updateExplored`, camera functions, `computeLayout`.

- [ ] **Step 1: Write the tests**

`tests/genplay.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { generateMission } from '../src/core/gen';
import { RECIPES } from '../src/core/gen/recipes';
import { createMission } from '../src/core/missions';
import { findPath } from '../src/core/path';
import { computeVisible } from '../src/core/vision';
import { createCamera, defaultZoom, followTile, tileCss } from '../src/render/camera';
import { computeLayout } from '../src/ui/layout';

describe.each(RECIPES.map((r, i) => [r.name, i] as const))('playing %s', (_name, type) => {
  const r = RECIPES[type];

  it('starts with the recipe size, four soldiers and its enemies, and the squad can see something', () => {
    const s = createMission(generateMission(type, 0), 3);
    expect([s.width, s.height]).toEqual([r.width, r.height]);
    expect(s.units.filter((u) => u.side === 'player')).toHaveLength(4);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(r.enemies);
    const seen = computeVisible(s, 'player').flat().filter(Boolean).length;
    expect(seen).toBeGreaterThan(4);
    expect(s.explored.flat().filter(Boolean).length).toBeGreaterThan(4);
  });

  it('lets every soldier path to every enemy (doors counted as openable)', () => {
    const s = createMission(generateMission(type, 0), 3);
    for (const e of s.units.filter((u) => u.side === 'enemy')) {
      const path = findPath(s, 'p1', e.pos, { ignoreOccupantAtGoal: true, openDoors: true });
      expect(path, `${e.id}`).not.toBeNull();
    }
  });

  it('runs a whole enemy turn quickly and leaves a valid state', () => {
    const s = createMission(generateMission(type, 0), 3);
    s.turn = 'enemy';
    const t0 = performance.now();
    const out = runEnemyTurn(s);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(5000);
    expect(out.state.units.every((u) => u.pos.x >= 0 && u.pos.y >= 0 && u.pos.x < r.width && u.pos.y < r.height)).toBe(true);
    expect(out.state.status === 'playing' || out.state.status === 'lost').toBe(true);
  });
});

describe('the camera on the biggest map', () => {
  const [W, H] = [48, 32];
  it('keeps close-up tiles at 32 px or more on a phone and a readable whole map on a desktop', () => {
    const phone = computeLayout(390, 844, 3);
    const wide = computeLayout(1366, 768, 1);
    expect(tileCss(phone, 'close', W, H)).toBeGreaterThanOrEqual(32);
    expect(tileCss(wide, 'whole', W, H)).toBeGreaterThanOrEqual(8);
    expect(tileCss(wide, 'close', W, H)).toBeGreaterThanOrEqual(tileCss(wide, 'whole', W, H));
    expect(['close', 'whole']).toContain(defaultZoom(wide, W, H));
  });

  it('follows a soldier in the far corners without leaving the map', () => {
    const wide = computeLayout(1366, 768, 1);
    for (const pos of [{ x: 0, y: 0 }, { x: 47, y: 0 }, { x: 0, y: 31 }, { x: 47, y: 31 }]) {
      const cam = followTile(createCamera(wide, W, H), pos, wide, W, H);
      expect(cam.cx).toBeGreaterThanOrEqual(0);
      expect(cam.cx).toBeLessThanOrEqual(W);
      expect(cam.cy).toBeGreaterThanOrEqual(0);
      expect(cam.cy).toBeLessThanOrEqual(H);
    }
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/genplay.test.ts`
Expected: PASS. If `openDoors` option or `status` values differ from what the code uses, read `src/core/path.ts` and `src/core/types.ts` and adjust the test to the real names (the intent stays: every enemy is reachable; the turn finishes in time and leaves a sane state). A genuine failure (a map where an enemy cannot be reached, a turn that takes seconds, a camera outside the map) is a real bug: fix the production code with a failing test first and ledger it.

- [ ] **Step 3: Whole suite and types**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/genplay.test.ts
git commit -m "test: play every generated map type, big-map camera and enemy turn" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Pin the maps, build, check in the real browser

**Files:**
- Test: `tests/genfingerprint.test.ts` (new)
- Production changes only if the browser check finds a bug (failing test first).

**Interfaces:**
- Consumes: all of `src/core/gen`.

- [ ] **Step 1: Write the fingerprint test with a placeholder, watch it fail, pin it**

`tests/genfingerprint.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, generateMission } from '../src/core/gen';

/** A simple hash of a string (FNV-1a), enough to notice any change to any map. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Pins the fifty maps: a saved campaign stores only variation numbers, so a map must not change under a player. */
describe('the fifty maps are pinned', () => {
  const hashes: string[] = [];
  for (let t = 0; t < CAMPAIGN_LENGTH; t++) {
    for (let v = 0; v < VARIATIONS; v++) {
      const def = generateMission(t, v);
      hashes.push(fnv(def.rows.join('\n') + JSON.stringify(def.patrols)));
    }
  }

  it('has fifty hashes', () => {
    expect(hashes).toHaveLength(50);
  });

  it('matches the pinned fingerprint', () => {
    expect(fnv(hashes.join(','))).toBe('PIN-ME');
  });
});
```
Run: `npx vitest run tests/genfingerprint.test.ts` — Expected: FAIL showing the real fingerprint in the assertion message. Replace `PIN-ME` with that value, rerun: PASS. Add a comment line above the assertion: `// Changing the generator or a recipe changes this on purpose: update it in the same commit and say so in the commit message.`

- [ ] **Step 2: Everything green**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all tests pass (previous 824 plus the new ones), tsc clean, build succeeds (note the bundle size increase in the ledger).

- [ ] **Step 3: Real-browser check**

Use `preview_start` with the project's dev server (see `.claude/launch.json`; create the entry if missing). In the browser pane:
1. Fresh state (clear `localStorage`): the title shows NEW CAMPAIGN and TUTORIAL, no CONTINUE. Screenshot.
2. Click TUTORIAL: equipment screen titled `MISSION 1 OF 3: OUTPOST`. Back, reload, click NEW CAMPAIGN: `MISSION 1 OF 10: OUTPOST`. Start the mission and screenshot the map.
3. Put a saved campaign at mission 10 in `localStorage` (`laser-tribute-campaign`: version 1, `campaign` with `mode: 'campaign'`, `variations` ten numbers 0 to 4, `missionIndex` 9, `missionsWon` 9, status `active`, four roster soldiers, empty `fallen`, `namesUsed` 4, a zero stash; `loadout` the default), reload, CONTINUE, start: the 48x32 Citadel loads; screenshot close zoom and the Z whole-map view; confirm no console errors (`read_console_messages`).
4. At 375x812 (mobile preset) repeat step 3's mission: the camera follows, drag pans, ZOOM works. Reset the viewport to desktop afterwards.
5. Clear `localStorage`, stop the dev server.

Any bug found: reproduce in a failing test, fix, rerun the suite, ledger it.

- [ ] **Step 4: Commit**

```bash
git add tests/genfingerprint.test.ts
git commit -m "test: pin the fifty generated maps" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** generator, ten recipes, five variations, playability rules, `generateMission(type, variation, difficulty)` (Tasks 1 to 5); `mode` and `variations` in `Campaign` (6); two slots, last-mode key, old save as tutorial, strict validation (7); title with CONTINUE / NEW CAMPAIGN / TUTORIAL and the two-press rule per slot (8, 9); mission lists by mode, "Mission n of N" on equipment, result and end screens (9); the hard-coded 30x20 camera in `src/app.ts` only applies before a mission starts: `startMission` already rebuilds it from the real size, and Task 9's mission-10 test asserts it (9); big-map engine tests and a game test per type (10); pinned fingerprint and browser check (11). Not covered by design: enemy gear, new enemies, wounds, research, minimap, touch-friendly menus (listed as open items in the spec).
- **Placeholders:** the only deliberate placeholder is `PIN-ME` in Task 11, replaced in the same task by the real value the failing run prints. Every test has its code.
- **Type consistency:** `Recipe`, `Expect`, `expectFor`, `checkMission`, `populate`, `buildLayout`, `distances`, `generateMission`, `drawVariations`, `CAMPAIGN_LENGTH`, `VARIATIONS`, `Mode`, `SaveStore(storage, count, mode)`, `LastMode`, `TitleView.continue`, `titleHit(px, py, hasContinue)` are used with the same names and signatures in every task.
- **Review Focus coverage:** (1) Task 3 hand-made bad maps + Task 10 "every soldier paths to every enemy"; (2) Task 11 fingerprint; (3) Task 7 rejection tests and Task 9 old-save and corrupt-slot tests; (4) Tasks 9 and 10 camera tests; (5) Task 10 enemy-turn time on every type, including the 12-enemy Citadel.
