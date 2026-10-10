# Milestone 25: autotiled walls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw each wall tile with edge shading chosen by its open neighbours, so wall masses read as connected shapes.

**Architecture:** A pure `wallMask(state, x, y)` in the render layer computes an 8-bit mask from the explored, open neighbours. A pure `wallVariant(base, mask, name)` draws outline, highlight and shade pixels on a copy of the themed wall image. `wallImage(theme, mask)` in `src/art/theme.ts` caches one figure per theme and mask. The renderer uses it for wall tiles.

**Tech Stack:** TypeScript, Vitest, Canvas, Vite. Tests: `npx vitest run`, types: `npx tsc --noEmit` (tsc covers `tests/`).

**Spec:** `docs/superpowers/specs/2026-10-10-laser-tribute-milestone25-design.md`

## Global Constraints

- No leak: an unexplored neighbour counts as solid; a wall never shows an edge towards a tile the player has not explored.
- `src/core` does not change. Floors, doors, items, corpses, soldiers, effects and the fog dimming are unchanged. A wall with no open explored neighbour is drawn exactly as today (the same image object).
- Outline colour `#0b0c12`; highlight 35% towards white, shade 35% towards black; the outline wins where they meet.
- No PixelLab generations; no change to `scripts/` or `images.generated.ts`.
- Baseline: 1534 tests green on `milestone-25`. Every task ends with the whole suite green and `npx tsc --noEmit` clean.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- An unexplored floor or door next to an explored wall must not change that wall's picture (no information about unseen tiles).
- Walls at the map edge and in a one-tile-thick wall with floor on both sides (north and south, or east and west) must look right and not crash.
- The mask must use the state's `explored` at draw time: when the player explores the neighbour, the wall's edge appears on the next frame.
- Doors count as open ground for the wall beside them, closed or open.
- Every theme (recoloured walls) keeps a clearly visible outline; the outline must not equal a theme's wall colour.
- Rows and columns of the variant must stay inside the 16x16 tile and never touch transparent pixels.

## File Structure

- Create `src/render/wallmask.ts`: `wallMask` and the bit constants.
- Create `src/art/wallvariant.ts`: `wallVariant`, `OUTLINE`.
- Modify `src/art/theme.ts`: `wallImage`.
- Modify `src/render/renderer.ts`: `tileFigure` uses `wallImage` for walls.
- Modify `src/art/gallery.ts` and `tests/gallery.test.ts`: variant row.
- Create tests: `tests/wallmask.test.ts`, `tests/wallvariant.test.ts`, `tests/wallimage.test.ts`, `tests/walldraw.test.ts`.

---

### Task 1: The mask and the variant

**Files:**
- Create: `src/render/wallmask.ts`, `src/art/wallvariant.ts`
- Test: `tests/wallmask.test.ts`, `tests/wallvariant.test.ts`

**Interfaces:**
- Produces: `N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128`, `wallMask(state: GameState, x: number, y: number): number`; `OUTLINE = '#0b0c12'`, `wallVariant(base: Figure, mask: number, name: string): Figure`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/wallmask.test.ts
import { describe, expect, it } from 'vitest';
import { E, N, NE, NW, S, SE, SW, W, wallMask } from '../src/render/wallmask';
import { makeState } from './helpers';

const seen = (rows: string[]) => {
  const s = makeState(rows);
  s.explored = s.explored.map((r) => r.map(() => true));
  return s;
};

describe('wallMask', () => {
  it('has the bit values of the spec', () => {
    expect([N, E, S, W, NE, SE, SW, NW]).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
  });

  it('is 0 for a wall surrounded by walls and by the map edge', () => {
    const s = seen(['###', '###', '###']);
    expect(wallMask(s, 1, 1)).toBe(0);
    expect(wallMask(s, 0, 0)).toBe(0);
    expect(wallMask(s, 2, 1)).toBe(0);
  });

  it('sets one bit for each open side', () => {
    expect(wallMask(seen(['#.#', '###', '###']), 1, 1)).toBe(N);
    expect(wallMask(seen(['###', '###', '#.#']), 1, 1)).toBe(S);
    expect(wallMask(seen(['###', '.##', '###']), 1, 1)).toBe(W);
    expect(wallMask(seen(['###', '##.', '###']), 1, 1)).toBe(E);
  });

  it('sets two, three and four sides', () => {
    expect(wallMask(seen(['#.#', '###', '###']), 1, 1)).toBe(N);
    expect(wallMask(seen(['#.#', '##.', '###']), 1, 1)).toBe(N | E);
    expect(wallMask(seen(['#.#', '.#.', '###']), 1, 1)).toBe(N | E | W);
    expect(wallMask(seen(['#.#', '.#.', '#.#']), 1, 1)).toBe(N | E | S | W);
  });

  it('sets an inner corner bit only when the diagonal is open and both touching sides are solid', () => {
    expect(wallMask(seen(['##.', '###', '###']), 1, 1)).toBe(NE);
    expect(wallMask(seen(['###', '###', '##.']), 1, 1)).toBe(SE);
    expect(wallMask(seen(['###', '###', '.##']), 1, 1)).toBe(SW);
    expect(wallMask(seen(['.##', '###', '###']), 1, 1)).toBe(NW);
    // with the north side open the corner is covered by the side edge
    expect(wallMask(seen(['...', '###', '###']), 1, 1)).toBe(N);
    expect(wallMask(seen(['.#.', '###', '###']), 1, 1)).toBe(NE | NW);
  });

  it('counts a door as open ground, closed or open', () => {
    const s = seen(['#+#', '###', '###']);
    expect(wallMask(s, 1, 1)).toBe(N);
    s.tiles[0][1].open = true;
    expect(wallMask(s, 1, 1)).toBe(N);
  });

  it('counts an unexplored neighbour as solid, and picks the edge up once it is explored', () => {
    const s = seen(['#.#', '###', '###']);
    s.explored[0][1] = false;
    expect(wallMask(s, 1, 1)).toBe(0);
    s.explored[0][1] = true;
    expect(wallMask(s, 1, 1)).toBe(N);
    const corner = seen(['##.', '###', '###']);
    corner.explored[0][2] = false;
    expect(wallMask(corner, 1, 1)).toBe(0);
  });

  it('gives a one-tile wall both its edges', () => {
    expect(wallMask(seen(['.#.', '.#.', '.#.']), 1, 1)).toBe(E | W);
    expect(wallMask(seen(['...', '###', '...']), 1, 1)).toBe(N | S);
  });
});
```

```ts
// tests/wallvariant.test.ts
import { describe, expect, it } from 'vitest';
import type { Figure } from '../src/art/figure';
import { OUTLINE, wallVariant } from '../src/art/wallvariant';
import { E, N, NE, NW, S, SE, SW, W } from '../src/render/wallmask';

const GREY = '#808080';
const LIGHT = '#acacac'; // 128 + 127 * 0.35, rounded
const DARK = '#535353'; // 128 * 0.65, rounded
const flat = (): Figure => ({ name: 'wall', width: 16, height: 16, pixels: Array(256).fill(GREY) });
const at = (f: Figure, x: number, y: number) => f.pixels[y * 16 + x];
const changed = (a: Figure, b: Figure) => a.pixels.map((p, i) => (p !== b.pixels[i] ? i : -1)).filter((i) => i >= 0);

describe('wallVariant', () => {
  it('returns the base itself for mask 0', () => {
    const base = flat();
    expect(wallVariant(base, 0, 'x')).toBe(base);
  });

  it('keeps the size and takes the given name, without changing the base', () => {
    const base = flat();
    const copy = [...base.pixels];
    const v = wallVariant(base, N, 'wall#1');
    expect([v.width, v.height, v.name]).toEqual([16, 16, 'wall#1']);
    expect(base.pixels).toEqual(copy);
  });

  it('draws an outline row with a highlight under it for an open north side', () => {
    const v = wallVariant(flat(), N, 'v');
    for (let x = 0; x < 16; x++) {
      expect(at(v, x, 0)).toBe(OUTLINE);
      expect(at(v, x, 1)).toBe(LIGHT);
    }
    expect(changed(flat(), v)).toHaveLength(32);
  });

  it('draws an outline row with a shade above it for an open south side', () => {
    const v = wallVariant(flat(), S, 'v');
    for (let x = 0; x < 16; x++) {
      expect(at(v, x, 15)).toBe(OUTLINE);
      expect(at(v, x, 14)).toBe(DARK);
    }
    expect(changed(flat(), v)).toHaveLength(32);
  });

  it('draws an outline column for an open east or west side, and nothing else', () => {
    const e = wallVariant(flat(), E, 'v');
    const w = wallVariant(flat(), W, 'v');
    for (let y = 0; y < 16; y++) {
      expect(at(e, 15, y)).toBe(OUTLINE);
      expect(at(w, 0, y)).toBe(OUTLINE);
    }
    expect(changed(flat(), e)).toHaveLength(16);
    expect(changed(flat(), w)).toHaveLength(16);
  });

  it('lets the outline win where it meets a highlight or a shade', () => {
    const v = wallVariant(flat(), N | W | S | E, 'v');
    expect(at(v, 0, 1)).toBe(OUTLINE); // west column over the highlight row
    expect(at(v, 15, 14)).toBe(OUTLINE); // east column over the shade row
    expect(at(v, 5, 1)).toBe(LIGHT);
    expect(at(v, 5, 14)).toBe(DARK);
    expect(at(v, 5, 7)).toBe(GREY);
  });

  it('changes exactly one pixel for an inner corner', () => {
    const spots: [number, number, number][] = [[NE, 15, 0], [SE, 15, 15], [SW, 0, 15], [NW, 0, 0]];
    for (const [bit, x, y] of spots) {
      const v = wallVariant(flat(), bit, 'v');
      expect(at(v, x, y)).toBe(OUTLINE);
      expect(changed(flat(), v)).toEqual([y * 16 + x]);
    }
  });

  it('never touches transparent pixels', () => {
    const base = flat();
    base.pixels[0] = null;
    base.pixels[1 * 16 + 5] = null;
    const v = wallVariant(base, N | S | E | W | NE, 'v');
    expect(v.pixels[0]).toBeNull();
    expect(v.pixels[16 + 5]).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/wallmask.test.ts tests/wallvariant.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// src/render/wallmask.ts
import type { GameState } from '../core/types';

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const NE = 16;
export const SE = 32;
export const SW = 64;
export const NW = 128;

/**
 * Which neighbours of the wall at (x, y) are open ground the player has seen: bits for the four sides, and for an inner
 * corner (the diagonal is open while both sides that touch it are solid). A neighbour is open when it is on the map, is a
 * floor or a door, and is explored; walls, the map edge and unexplored tiles are solid, so a wall never shows what lies
 * behind it before the player has seen it.
 */
export function wallMask(s: GameState, x: number, y: number): number {
  const open = (dx: number, dy: number): boolean => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) return false;
    const kind = s.tiles[ny][nx].kind;
    return (kind === 'floor' || kind === 'door') && s.explored[ny][nx];
  };
  const n = open(0, -1);
  const e = open(1, 0);
  const so = open(0, 1);
  const w = open(-1, 0);
  let mask = (n ? N : 0) | (e ? E : 0) | (so ? S : 0) | (w ? W : 0);
  if (open(1, -1) && !n && !e) mask |= NE;
  if (open(1, 1) && !so && !e) mask |= SE;
  if (open(-1, 1) && !so && !w) mask |= SW;
  if (open(-1, -1) && !n && !w) mask |= NW;
  return mask;
}
```

```ts
// src/art/wallvariant.ts
import { E, N, NE, NW, S, SE, SW, W } from '../render/wallmask';
import type { Figure } from './figure';

/** The dark the soldier sprites use for their outline. */
export const OUTLINE = '#0b0c12';
const BLEND = 0.35;

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lighten = (hex: string): string => toHex(channels(hex).map((c) => c + (255 - c) * BLEND));
const darken = (hex: string): string => toHex(channels(hex).map((c) => c * (1 - BLEND)));

/**
 * The wall image with edges for the open sides in `mask` (see `wallMask`): a one-pixel dark outline along each open side,
 * a lighter row just inside the north edge, a darker row just inside the south edge, and one dark pixel in an inner
 * corner. The outline wins where they meet. Mask 0 returns `base` itself; transparent pixels are never touched.
 */
export function wallVariant(base: Figure, mask: number, name: string): Figure {
  if (mask === 0) return base;
  const w = base.width;
  const h = base.height;
  const pixels = [...base.pixels];
  const set = (x: number, y: number, f: (p: string) => string): void => {
    const p = pixels[y * w + x];
    if (p !== null) pixels[y * w + x] = f(p);
  };
  const outline = () => OUTLINE;
  if (mask & N) for (let x = 0; x < w; x++) set(x, 1, lighten);
  if (mask & S) for (let x = 0; x < w; x++) set(x, h - 2, darken);
  if (mask & N) for (let x = 0; x < w; x++) set(x, 0, outline);
  if (mask & S) for (let x = 0; x < w; x++) set(x, h - 1, outline);
  if (mask & E) for (let y = 0; y < h; y++) set(w - 1, y, outline);
  if (mask & W) for (let y = 0; y < h; y++) set(0, y, outline);
  if (mask & NE) set(w - 1, 0, outline);
  if (mask & SE) set(w - 1, h - 1, outline);
  if (mask & SW) set(0, h - 1, outline);
  if (mask & NW) set(0, 0, outline);
  return { name, width: w, height: h, pixels };
}
```

- [ ] **Step 4: Run them, typecheck, whole suite**

Run: `npx vitest run tests/wallmask.test.ts tests/wallvariant.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS; tsc clean; suite 1534 + the new tests green. If the exact grey values (`#acacac`, `#535353`) differ by one because of rounding, correct the constants in the test to the rounded values of `128 + 127 * 0.35` and `128 * 0.65` (172.45 and 83.2).

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: wall neighbour mask and edge-shaded wall variants" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The themed wall image per mask

**Files:**
- Modify: `src/art/theme.ts`
- Test: `tests/wallimage.test.ts`

**Interfaces:**
- Consumes: `wallVariant`, `OUTLINE` (Task 1), existing `tileImage`.
- Produces: `wallImage(theme: string, mask: number): Figure`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/wallimage.test.ts
import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { luminance } from '../src/art/recolour';
import { THEMES, tileImage, wallImage } from '../src/art/theme';
import { OUTLINE } from '../src/art/wallvariant';
import { THEME_IDS } from '../src/core/themes';
import { E, N, NE, S, W } from '../src/render/wallmask';

const MASKS = [0, N, E | S, N | E | W, N | E | S | W, NE, N | S, E | W];

describe('wallImage', () => {
  it('is the plain themed wall for mask 0, the same object, in every theme', () => {
    for (const id of THEME_IDS) expect(wallImage(id, 0)).toBe(tileImage(id, 'wall', false, 0, 0));
    expect(wallImage('base', 0)).toBe(imageOf('wall'));
  });

  it('gives every theme and mask a 16x16 figure, cached: the same object every call', () => {
    for (const id of THEME_IDS) {
      for (const mask of MASKS) {
        const f = wallImage(id, mask);
        expect([f.width, f.height]).toEqual([16, 16]);
        expect(wallImage(id, mask), `${id} ${mask}`).toBe(f);
      }
    }
  });

  it('draws the same dark outline in every theme', () => {
    for (const id of THEME_IDS) {
      const f = wallImage(id, N);
      for (let x = 0; x < 16; x++) expect(f.pixels[x]).toBe(OUTLINE);
      expect(wallImage(id, W).pixels[5 * 16]).toBe(OUTLINE);
    }
  });

  it('keeps the themed wall colours inside the tile', () => {
    for (const id of THEME_IDS) {
      const plain = wallImage(id, 0);
      const f = wallImage(id, N);
      expect(f.pixels.slice(2 * 16)).toEqual(plain.pixels.slice(2 * 16)); // below the two edge rows nothing changed
    }
  });

  it('gives different masks different images, and different themes different images', () => {
    expect(wallImage('base', N).pixels).not.toEqual(wallImage('base', S).pixels);
    expect(wallImage('base', N).pixels).not.toEqual(wallImage('steel', N).pixels);
  });

  it('keeps the outline clearly darker than the wall of every theme', () => {
    for (const id of THEME_IDS) {
      const wall = wallImage(id, 0).pixels.filter((p): p is string => p !== null);
      const mean = wall.reduce((s, p) => s + luminance(p), 0) / wall.length;
      expect(mean - luminance(OUTLINE), id).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('falls back to base for an unknown or inherited theme id', () => {
    expect(wallImage('swamp', N)).toBe(wallImage('base', N));
    expect(wallImage('constructor', 0)).toBe(imageOf('wall'));
    expect(THEMES.base.wall).toBe('wall');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/wallimage.test.ts`
Expected: FAIL (`wallImage` is not exported).

- [ ] **Step 3: Implement**

In `src/art/theme.ts` add `import { wallVariant } from './wallvariant';` and, after `tileImage`:

```ts
const wallVariants = new Map<string, Figure>();

/** The wall of a theme with the edges of `mask` (see `wallMask`); mask 0 is the plain wall. Cached per theme and mask. */
export function wallImage(theme: string, mask: number): Figure {
  const id: ThemeId = (THEME_IDS as readonly string[]).includes(theme) ? (theme as ThemeId) : 'base';
  const base = tileImage(id, 'wall', false, 0, 0);
  if (mask === 0) return base;
  const key = `${id}:${mask}`;
  let fig = wallVariants.get(key);
  if (!fig) {
    fig = wallVariant(base, mask, `${base.name}#${mask}`);
    wallVariants.set(key, fig);
  }
  return fig;
}
```

- [ ] **Step 4: Run, typecheck, whole suite**

Run: `npx vitest run tests/wallimage.test.ts tests/themes.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS; clean; suite green. If the "outline darker than the wall" check fails for a theme, that theme's wall ramp is too dark: raise its `wall` ramp (the readability suite from milestone 23 must still pass).

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: cached themed wall images per neighbour mask" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The renderer draws the edges, and never leaks

**Files:**
- Modify: `src/render/renderer.ts`
- Test: `tests/walldraw.test.ts`

**Interfaces:**
- Consumes: `wallMask`, `wallImage`.
- Produces: walls drawn through `wallImage(themeFor(state), wallMask(state, x, y))`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/walldraw.test.ts
import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { wallMask } from '../src/render/wallmask';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

/** The image name drawn at each tile, by 'x,y' (tiles are 16 px). */
function drawn(state: GameState): Map<string, string> {
  const at = new Map<string, string>();
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.drawImage.bind(atlas);
  atlas.drawImage = (c, fig, x, y, o = {}) => {
    if (fig.name.startsWith('wall') || fig.name.startsWith('floor')) at.set(`${x / 16},${y / 16}`, fig.name);
    return real(c, fig, x, y, o);
  };
  drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
  return at;
}

/** A wall tile with an open floor tile to its east, and that floor tile. */
function wallBesideFloor(state: GameState): { wall: { x: number; y: number }; floor: { x: number; y: number } } {
  for (let y = 1; y < state.height - 1; y++) {
    for (let x = 0; x < state.width - 1; x++) {
      if (state.tiles[y][x].kind === 'wall' && state.tiles[y][x + 1].kind === 'floor') return { wall: { x, y }, floor: { x: x + 1, y } };
    }
  }
  throw new Error('no wall beside a floor');
}

describe('walls are drawn with their edges', () => {
  it('draws an edged variant for an explored wall beside explored floor', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const { wall } = wallBesideFloor(state);
    const mask = wallMask(state, wall.x, wall.y);
    expect(mask).not.toBe(0);
    expect(drawn(state).get(`${wall.x},${wall.y}`)).toBe(`wall#${mask}`);
  });

  it('draws the plain wall when the floor beside it is not explored (nothing about unseen tiles shows)', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const { wall, floor } = wallBesideFloor(state);
    const plainBefore = wallMask(state, wall.x, wall.y);
    state.explored[floor.y][floor.x] = false;
    const maskNow = wallMask(state, wall.x, wall.y);
    expect(maskNow & 2).toBe(0); // the east side no longer counts
    expect(maskNow).not.toBe(plainBefore);
    const name = drawn(state).get(`${wall.x},${wall.y}`);
    expect(name).toBe(maskNow === 0 ? 'wall' : `wall#${maskNow}`);
  });

  it('draws floors, doors and units as before', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const names = [...drawn(state).values()];
    expect(names.some((n) => /^floor_[abc]$/.test(n))).toBe(true);
    expect(names.filter((n) => n.startsWith('floor')).every((n) => !n.includes('#'))).toBe(true);
  });

  it('shows the edge the frame after the neighbour is explored', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const { wall, floor } = wallBesideFloor(state);
    state.explored[floor.y][floor.x] = false;
    const before = drawn(state).get(`${wall.x},${wall.y}`);
    state.explored[floor.y][floor.x] = true;
    const after = drawn(state).get(`${wall.x},${wall.y}`);
    expect(after).not.toBe(before);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/walldraw.test.ts`
Expected: FAIL (the renderer still draws the plain `wall`).

- [ ] **Step 3: Implement**

In `src/render/renderer.ts`: `import { wallMask } from './wallmask';`, add `wallImage` to the `../art/theme` import, and change `tileFigure`:

```ts
function tileFigure(state: GameState, x: number, y: number): Figure {
  const tile = state.tiles[y][x];
  if (tile.kind === 'wall') return wallImage(themeFor(state), wallMask(state, x, y));
  // a door as the player last saw it
  return tileImage(themeFor(state), tile.kind, tile.kind === 'door' && state.doorMemory[y][x], x, y);
}
```

- [ ] **Step 4: Run, typecheck, whole suite**

Run: `npx vitest run tests/walldraw.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS; clean; suite green. Existing tests that count wall draws by the name `wall` (for example in `tests/artrender.test.ts`, `themeselect.test.ts`) may now see `wall#<mask>` for some walls: update those assertions to accept `wall` or `wall#N` (`/^wall(#\d+)?$/`) and, for the themed test, `wall@steel` or `wall@steel#N`. Do not change what they check.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: walls are drawn with edges from their explored neighbours" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Gallery row, a look at every map type, tuning

**Files:**
- Modify: `src/art/gallery.ts`, `tests/gallery.test.ts`; strengths in `src/art/wallvariant.ts` only if the look demands it
- Test: gallery test; readability tests as needed

**Interfaces:**
- Consumes: everything above.
- Produces: a gallery row with the main variants per theme and a verified in-game look.

- [ ] **Step 1: The gallery row**

In `src/art/gallery.ts`, after the theme strips and before the sample text, add one row at y 376: for each theme (5), five 16x16 tiles at 17 px steps, in a group of 85 px (x = 4 + themeIndex * 85 + k * 17): a straight edge (`wallImage(id, N)`), an outer corner (`N | E`), a wall end (`N | E | W`), a pillar (`N | E | S | W`) and an inner corner (`NE`), drawn with `art.drawImage(ctx, wallImage(id, mask), x, 376)`. They sit inside the 400-pixel canvas (376 + 16 = 392). Update `tests/gallery.test.ts` in the same step: `figures` length 89 (14 images, 20 soldiers, 30 theme-strip tiles, 25 wall variants), unique names 83 (the 58 before plus 25 distinct wall variants), the last 25 figures lie at `y = 376`, `x + 16 <= 480`, `y + 16 <= 400`; the theme-strip check (`figures.slice(34)` above 352) becomes `figures.slice(34, 64)`.

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; green.

- [ ] **Step 2: Look at the game**

Start `laser-tribute-dev`. For the tutorial's three missions and a campaign run (set `app.campaign.missionIndex` to 0, 3, 5, 7 and 8 through the console and press Start mission as in milestone 23), screenshot with the whole map explored (`state.explored` all true, zoom to whole map) and with the normal fog, so both the edges and the no-leak behaviour show. Check: wall masses read as solid shapes with defined edges; doors still read; the fogged walls still look right; no wall shows an edge towards a tile the squad has not seen (screenshot the start position of a map: the unexplored side has none); the highlight and shade are visible but not heavy.

- [ ] **Step 3: Tune**

If the edges read too heavy or too faint, change `BLEND` (and only that, or the outline colour) in `src/art/wallvariant.ts`, update the exact grey constants in `tests/wallvariant.test.ts` to the new rounded values, and re-run the whole suite. Add a failing assertion first if a theme shows a problem (for example an outline that vanishes against a dark theme wall) in `tests/wallimage.test.ts`.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: clean, all green, build succeeds.

```bash
git add src tests && git commit -m "feat: wall variant rows in the gallery; tuned edges" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## After the tasks

Final whole-branch review by a fresh Opus reviewer using the spec, this plan's Review Focus and the ledger rulings; one fix pass (each fix RED then GREEN, whole suite green); then push `milestone-25`, give Rui the PR link, and after "pushed and merged" sync master, run the suite, check the live bundle and write the vault notes. If the deploy fails with "Multiple artifacts" or "Found 0 artifacts", the fix is a fresh run of the workflow from the Actions tab, not Re-run jobs.
