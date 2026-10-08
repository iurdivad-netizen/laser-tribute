# Milestone 23: map themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolour the six tile pieces per map type with five gradient-map themes (Concrete, Timber, Steel, Cave, Stone).

**Architecture:** A pure `recolour(image, ramp, name)` maps each pixel's brightness through a three-colour ramp. `src/art/theme.ts` keeps its role-to-image table, adds ramps and optional overrides per theme, and a cached `tileImage`. A new core file `src/core/themes.ts` holds the theme ids and the map-type table, `GameState.theme` carries the id, `createMission` sets it, `themeFor(state)` reads it.

**Tech Stack:** TypeScript, Vitest, Canvas, Vite. Tests: `npx vitest run`, types: `npx tsc --noEmit` (tsc covers `tests/`).

**Spec:** `docs/superpowers/specs/2026-10-08-laser-tribute-milestone23-design.md`

## Global Constraints

- `src/core` stays pure and never imports from `src/art` or `src/render`: the theme ids and the map-type table live in `src/core/themes.ts`; `src/art/theme.ts` imports from core, not the other way round.
- Only the six tile pieces are recoloured (`floor_a`, `floor_b`, `floor_c`, `wall`, `door_closed`, `door_open`). Items, corpses, soldiers and effects are never touched.
- `base` returns the original image objects (identity).
- No change to `scripts/`, `images.generated.ts`, saves, mission records or core rules. No PixelLab generations.
- Baseline: 1455 tests green on `milestone-23`. Every task ends with the whole suite green and `npx tsc --noEmit` clean.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A theme id that is an inherited key (`constructor`, `__proto__`) or unknown must fall back to `base`, in `tileImage` and in `themeOfMap`.
- A saved game continued after this change must still start a mission with a theme (the theme comes from the mission, not the save).
- The recolour of a flat image (one colour) and of an image with one opaque pixel must not divide by zero or produce NaN colours.
- Fog of war: the dimming overlay still works on themed tiles (the fog draws over the tile image, so nothing changes), and unexplored tiles stay black.
- A themed map must keep the corpse blood, item icons and soldiers readable on every floor (the readability tests).
- Door states: a remembered open door and a closed door keep their different images in every theme.

## File Structure

- Create `src/core/themes.ts`: `ThemeId`, `THEME_IDS`, `MAP_THEMES`, `themeOfMap`.
- Create `src/art/recolour.ts`: `Ramp`, `luminance`, `recolour`.
- Modify `src/art/theme.ts`: theme table with ramps, cached `tileImage`, `themeFor`.
- Modify `src/core/types.ts`, `src/core/mission.ts`, `src/core/missions.ts`: `GameState.theme`, `parseMap`, `createMission`.
- Modify `src/art/gallery.ts` and its test: theme strips.
- Create tests: `tests/recolour.test.ts`, `tests/themes.test.ts`, `tests/themeselect.test.ts`, `tests/themereadability.test.ts`; extend `tests/gallery.test.ts`.

---

### Task 1: The recolour function

**Files:**
- Create: `src/art/recolour.ts`
- Test: `tests/recolour.test.ts`

**Interfaces:**
- Produces: `interface Ramp { shadow: string; mid: string; light: string }`, `luminance(hex: string): number` (relative luminance, 0 to 1), `recolour(fig: Figure, ramp: Ramp, name: string): Figure`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/recolour.test.ts
import { describe, expect, it } from 'vitest';
import type { Figure } from '../src/art/figure';
import { luminance, recolour } from '../src/art/recolour';

const RAMP = { shadow: '#000000', mid: '#808080', light: '#ffffff' };
const fig = (pixels: (string | null)[], w = pixels.length): Figure => ({ name: 'src', width: w, height: pixels.length / w, pixels });

describe('luminance', () => {
  it('is 0 for black, 1 for white and rises with brightness', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#808080')).toBeGreaterThan(luminance('#404040'));
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
  });
});

describe('recolour', () => {
  it('maps the darkest pixel to shadow, the lightest to light and the middle to mid', () => {
    const r = recolour(fig(['#101010', '#808080', '#f0f0f0']), { shadow: '#102030', mid: '#405060', light: '#a0b0c0' }, 'out');
    expect(r.pixels[0]).toBe('#102030');
    expect(r.pixels[2]).toBe('#a0b0c0');
    // the middle source pixel is not at the exact middle of the brightness range, so it lies between shadow and light
    const mid = r.pixels[1]!;
    expect(luminance(mid)).toBeGreaterThan(luminance('#102030'));
    expect(luminance(mid)).toBeLessThan(luminance('#a0b0c0'));
  });

  it('puts a pixel exactly halfway in brightness on mid', () => {
    // brightness 0, 0.5, 1 of the range: build sources from the luminance of grey levels
    const levels = ['#000000', '#bcbcbc', '#ffffff'];
    const half = (luminance(levels[0]) + luminance(levels[2])) / 2;
    const grey = levels[1];
    expect(Math.abs(luminance(grey) - half)).toBeLessThan(0.01); // #bcbcbc is the sRGB grey at half the linear luminance
    const r = recolour(fig(levels), RAMP, 'out');
    expect(r.pixels[1]).toBe('#808080');
  });

  it('keeps transparent pixels transparent, the size and the given name', () => {
    const r = recolour({ name: 'src', width: 2, height: 2, pixels: ['#202020', null, null, '#e0e0e0'] }, RAMP, 'floor_a@timber');
    expect(r.pixels[1]).toBeNull();
    expect(r.pixels[2]).toBeNull();
    expect([r.width, r.height, r.name]).toEqual([2, 2, 'floor_a@timber']);
  });

  it('never maps a brighter source pixel darker', () => {
    const greys = ['#050505', '#202020', '#404040', '#707070', '#a0a0a0', '#d0d0d0', '#fafafa'];
    const out = recolour(fig(greys), { shadow: '#102010', mid: '#506030', light: '#d0c090' }, 'o').pixels as string[];
    for (let i = 1; i < out.length; i++) expect(luminance(out[i])).toBeGreaterThanOrEqual(luminance(out[i - 1]) - 1e-9);
  });

  it('maps a flat image to mid, and an image with no opaque pixel to itself, without NaN', () => {
    const flat = recolour(fig(['#303030', '#303030', null, '#303030'], 2), RAMP, 'o');
    expect(flat.pixels.filter((p) => p !== null)).toEqual(['#808080', '#808080', '#808080']);
    const empty = recolour(fig([null, null]), RAMP, 'o');
    expect(empty.pixels).toEqual([null, null]);
    const one = recolour(fig(['#123456', null]), RAMP, 'o');
    expect(one.pixels[0]).toBe('#808080');
  });

  it('is deterministic and does not change the source', () => {
    const src = fig(['#101010', '#808080', '#f0f0f0']);
    const copy = [...src.pixels];
    expect(recolour(src, RAMP, 'o').pixels).toEqual(recolour(src, RAMP, 'o').pixels);
    expect(src.pixels).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/recolour.test.ts`
Expected: FAIL (module `../src/art/recolour` not found).

- [ ] **Step 3: Implement**

```ts
// src/art/recolour.ts
import type { Figure } from './figure';

/** Three colours a gradient map blends between: the darkest pixels take `shadow`, the middle `mid`, the lightest `light`. */
export interface Ramp {
  shadow: string;
  mid: string;
  light: string;
}

const channels = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const linear = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toHex = (c: number[]): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** The relative luminance of a `#rrggbb` colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);

/**
 * A gradient map: every opaque pixel is placed by its brightness within the image (darkest 0, lightest 1) and takes the
 * colour of the ramp there, blending shadow to mid over the lower half and mid to light over the upper half. The texture
 * of the image (its specks, seams and outlines) stays, the colours change. Transparent pixels stay transparent; a flat
 * image maps to `mid`.
 */
export function recolour(fig: Figure, ramp: Ramp, name: string): Figure {
  const lums = fig.pixels.map((p) => (p === null ? null : luminance(p)));
  const seen = lums.filter((l): l is number => l !== null);
  if (seen.length === 0) return { name, width: fig.width, height: fig.height, pixels: [...fig.pixels] };
  const lo = Math.min(...seen);
  const hi = Math.max(...seen);
  const [shadow, mid, light] = [ramp.shadow, ramp.mid, ramp.light].map(channels);
  const pixels = lums.map((l) => {
    if (l === null) return null;
    const t = hi === lo ? 0.5 : (l - lo) / (hi - lo);
    return toHex(t <= 0.5 ? mix(shadow, mid, t * 2) : mix(mid, light, (t - 0.5) * 2));
  });
  return { name, width: fig.width, height: fig.height, pixels };
}
```

- [ ] **Step 4: Run it, typecheck, whole suite**

Run: `npx vitest run tests/recolour.test.ts && npx tsc --noEmit && npx vitest run`
Expected: recolour tests PASS; tsc clean; suite 1455 + 6 new pass. If "puts a pixel exactly halfway" fails because `#bcbcbc` is not at half the linear luminance, pick the grey whose `luminance` is closest to 0.5 (search greys `#00` to `#ff`) and put that value in the test; the rule being tested is that brightness is measured in linear luminance.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: gradient-map recolouring of tile images" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Theme ids, the map table, and the cached themed tile lookup

**Files:**
- Create: `src/core/themes.ts`
- Modify: `src/art/theme.ts`
- Test: `tests/themes.test.ts`; existing `tests/theme.test.ts` must pass unchanged

**Interfaces:**
- Consumes: `recolour`, `Ramp` (Task 1).
- Produces: `ThemeId`, `THEME_IDS`, `MAP_THEMES`, `themeOfMap(id)` in `src/core/themes.ts`; `Theme` with `name`, `ramps?`, `overrides?`; `THEMES: Record<ThemeId, Theme>`; `tileImage(theme, kind, open, x, y)` (same signature); `themeFor(state)` unchanged for now (still returns `'base'` until Task 3).

- [ ] **Step 1: Write the failing test**

```ts
// tests/themes.test.ts
import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { THEMES, tileImage } from '../src/art/theme';
import { MAP_THEMES, THEME_IDS, themeOfMap } from '../src/core/themes';
import { floorVariant } from '../src/art/sprite';

const KINDS: ['floor' | 'wall' | 'door', boolean][] = [['floor', false], ['wall', false], ['door', false], ['door', true]];
const pieces = (theme: string) => KINDS.map(([kind, open]) => tileImage(theme, kind, open, 3, 4));

describe('the map table', () => {
  it('maps the ten campaign map types and nothing else to the five themes', () => {
    expect([...THEME_IDS]).toEqual(['base', 'timber', 'steel', 'cave', 'stone']);
    expect(MAP_THEMES).toEqual({
      outpost: 'base', compound: 'base', warehouse: 'timber', village: 'timber', factory: 'steel', station: 'steel',
      mine: 'cave', bunker: 'cave', fortress: 'stone', citadel: 'stone',
    });
    for (const id of Object.keys(MAP_THEMES)) expect(themeOfMap(id)).toBe(MAP_THEMES[id]);
  });

  it('falls back to base for an unknown id or an inherited key', () => {
    expect(themeOfMap('swamp')).toBe('base');
    expect(themeOfMap('constructor')).toBe('base');
    expect(themeOfMap('__proto__')).toBe('base');
    expect(themeOfMap('')).toBe('base');
  });
});

describe('themed tiles', () => {
  it('returns the original image objects for base', () => {
    expect(tileImage('base', 'wall', false, 1, 1)).toBe(imageOf('wall'));
    expect(tileImage('base', 'door', true, 1, 1)).toBe(imageOf('door_open'));
    expect(tileImage('base', 'floor', false, 1, 1)).toBe(imageOf(THEMES.base.floors[floorVariant(1, 1)]));
  });

  it('recolours every piece for the other themes, cached: the same object every call', () => {
    for (const id of THEME_IDS.filter((t) => t !== 'base')) {
      const a = pieces(id);
      const b = pieces(id);
      a.forEach((fig, i) => {
        expect(fig, `${id} ${i}`).toBe(b[i]);
        expect(fig.width).toBe(16);
      });
      expect(a[1]).not.toBe(imageOf('wall'));
      expect(a[1].pixels).not.toEqual(imageOf('wall').pixels);
    }
  });

  it('keeps the transparent pixels of the open door and the shape of every piece', () => {
    for (const id of THEME_IDS.filter((t) => t !== 'base')) {
      const base = KINDS.map(([kind, open]) => tileImage('base', kind, open, 3, 4));
      pieces(id).forEach((fig, i) => {
        expect(fig.pixels.map((p) => p === null)).toEqual(base[i].pixels.map((p) => p === null));
      });
    }
  });

  it('keeps the floor variant by position and the closed and open doors apart in every theme', () => {
    for (const id of THEME_IDS) {
      const seen = new Set<string>();
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) seen.add(tileImage(id, 'floor', false, x, y).name);
      expect(seen.size, id).toBe(3);
      expect(tileImage(id, 'door', false, 1, 1).pixels).not.toEqual(tileImage(id, 'door', true, 1, 1).pixels);
    }
  });

  it('gives each theme its own look: no two themes share a piece', () => {
    const ids = [...THEME_IDS];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pieces(ids[i]);
        const b = pieces(ids[j]);
        a.forEach((fig, k) => expect(fig.pixels, `${ids[i]} vs ${ids[j]} piece ${k}`).not.toEqual(b[k].pixels));
      }
    }
  });

  it('falls back to base for an unknown theme and for an inherited key', () => {
    expect(tileImage('swamp', 'wall', false, 1, 1)).toBe(imageOf('wall'));
    expect(tileImage('constructor', 'wall', false, 1, 1)).toBe(imageOf('wall'));
  });

  it('lets a theme override one role with a named image, leaving the others recoloured', () => {
    const saved = THEMES.stone.overrides;
    THEMES.stone.overrides = { wall: 'door_closed' };
    try {
      expect(tileImage('stone', 'wall', false, 0, 0)).toBe(imageOf('door_closed'));
      expect(tileImage('stone', 'floor', false, 0, 0)).not.toBe(imageOf(THEMES.stone.floors[floorVariant(0, 0)]));
    } finally {
      THEMES.stone.overrides = saved;
    }
  });
});
```


- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/themes.test.ts`
Expected: FAIL (`../src/core/themes` not found).

- [ ] **Step 3: Implement**

`src/core/themes.ts`:

```ts
export type ThemeId = 'base' | 'timber' | 'steel' | 'cave' | 'stone';

export const THEME_IDS: readonly ThemeId[] = ['base', 'timber', 'steel', 'cave', 'stone'];

/** Which look each map type has (the campaign's ten map types, and the tutorial's three missions by name). */
export const MAP_THEMES: Record<string, ThemeId> = {
  outpost: 'base', compound: 'base',
  warehouse: 'timber', village: 'timber',
  factory: 'steel', station: 'steel',
  mine: 'cave', bunker: 'cave',
  fortress: 'stone', citadel: 'stone',
};

/** The theme of a map type id; `base` for an unknown id (and for inherited keys such as `constructor`). */
export function themeOfMap(id: string): ThemeId {
  return Object.hasOwn(MAP_THEMES, id) ? MAP_THEMES[id] : 'base';
}
```

`src/art/theme.ts` (replace the top part through `tileImage`; keep `themeFor`, `ITEM_IMAGES`, `itemImage`, `corpseImage` as they are):

```ts
import { THEME_IDS, type ThemeId } from '../core/themes';
import type { GameState, ItemKind, Side, TileKind } from '../core/types';
import type { Figure } from './figure';
import { imageOf, type ImageName } from './image';
import { recolour, type Ramp } from './recolour';
import { floorVariant } from './sprite';

export type { ThemeId };

type Role = 'floorA' | 'floorB' | 'floorC' | 'wall' | 'doorClosed' | 'doorOpen';

export interface Theme {
  name: string;
  floors: readonly [ImageName, ImageName, ImageName];
  wall: ImageName;
  doorClosed: ImageName;
  doorOpen: ImageName;
  /** Gradient maps for the piece groups; a group without one keeps the base image. */
  ramps?: { floor?: Ramp; wall?: Ramp; door?: Ramp };
  /** Replaces one role with a named image (no recolouring): the place for a hand-drawn piece. */
  overrides?: Partial<Record<Role, ImageName>>;
}

const BASE_PIECES = { floors: ['floor_a', 'floor_b', 'floor_c'], wall: 'wall', doorClosed: 'door_closed', doorOpen: 'door_open' } as const;

/** The look of a map's tiles: the base pieces, recoloured by a ramp per group. Ramps are tuned by eye in the dev gallery. */
export const THEMES: Record<ThemeId, Theme> = {
  base: { name: 'Concrete', ...BASE_PIECES },
  timber: {
    name: 'Timber', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#2a1c12', mid: '#4a3322', light: '#6b4e33' },
      wall: { shadow: '#4a3a28', mid: '#8a6a44', light: '#c7a066' },
      door: { shadow: '#2e1410', mid: '#6a2a1c', light: '#a8482c' },
    },
  },
  steel: {
    name: 'Steel', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#1c2430', mid: '#2e3a4a', light: '#46566a' },
      wall: { shadow: '#33424f', mid: '#6a7f94', light: '#aebdcb' },
      door: { shadow: '#40220f', mid: '#a65a1c', light: '#e08a30' },
    },
  },
  cave: {
    name: 'Cave', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#201a14', mid: '#33291f', light: '#4a3c2c' },
      wall: { shadow: '#2e261e', mid: '#5a4a38', light: '#8c7656' },
      door: { shadow: '#2a1a0f', mid: '#5c3a1c', light: '#8c5c2c' },
    },
  },
  stone: {
    name: 'Stone', ...BASE_PIECES,
    ramps: {
      floor: { shadow: '#33363c', mid: '#4c5058', light: '#6a6f78' },
      wall: { shadow: '#5a5e66', mid: '#9a9ea6', light: '#d4d6da' },
      door: { shadow: '#2c1e16', mid: '#6a4a2a', light: '#a87c44' },
    },
  },
};

/** The theme of the mission being drawn: the one the mission was created with. */
export function themeFor(_state: GameState): ThemeId {
  return 'base';
}

const recoloured = new Map<string, Figure>();

/** The image of a piece in a theme: the override, else the base image recoloured by the group's ramp, else the base image. */
function piece(id: ThemeId, group: 'floor' | 'wall' | 'door', image: ImageName, override?: ImageName): Figure {
  if (override) return imageOf(override);
  const ramp = THEMES[id].ramps?.[group];
  if (!ramp) return imageOf(image);
  const key = `${id}:${image}`;
  let fig = recoloured.get(key);
  if (!fig) {
    fig = recolour(imageOf(image), ramp, `${image}@${id}`);
    recoloured.set(key, fig);
  }
  return fig;
}

const FLOOR_ROLES: Role[] = ['floorA', 'floorB', 'floorC'];

/** The image of a tile. `open` is whether the player last saw the door open; it only matters for doors. */
export function tileImage(theme: string, kind: TileKind, open: boolean, x: number, y: number): Figure {
  const id: ThemeId = (THEME_IDS as readonly string[]).includes(theme) ? (theme as ThemeId) : 'base';
  const t = THEMES[id];
  if (kind === 'wall') return piece(id, 'wall', t.wall, t.overrides?.wall);
  if (kind === 'door') {
    return open ? piece(id, 'door', t.doorOpen, t.overrides?.doorOpen) : piece(id, 'door', t.doorClosed, t.overrides?.doorClosed);
  }
  const v = floorVariant(x, y);
  return piece(id, 'floor', t.floors[v], t.overrides?.[FLOOR_ROLES[v]]);
}
```

- [ ] **Step 4: Run, typecheck, whole suite**

Run: `npx vitest run tests/themes.test.ts tests/theme.test.ts && npx tsc --noEmit && npx vitest run`
Expected: both theme test files PASS; tsc clean; suite green. If the "no two themes share a piece" test fails for two themes, their ramps produce identical pixels for that piece: change a ramp colour (the test is the rule). If a base-identity assertion fails, `piece` is recolouring `base`: base has no `ramps`, so check the table.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: five map themes with a cached recolouring tile lookup" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The theme travels with the mission

**Files:**
- Modify: `src/core/types.ts`, `src/core/mission.ts`, `src/core/missions.ts`, `src/art/theme.ts`
- Test: `tests/themeselect.test.ts`

**Interfaces:**
- Consumes: `themeOfMap`, `ThemeId` (Task 2).
- Produces: `GameState.theme: ThemeId`; `parseMap` sets `'base'`; `createMission` sets `themeOfMap(def.id)`; `themeFor(state)` returns `state.theme`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/themeselect.test.ts
import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { imageOf } from '../src/art/image';
import { THEMES, themeFor, tileImage } from '../src/art/theme';
import { generateMission } from '../src/core/gen';
import { RECIPES } from '../src/core/gen/recipes';
import { createMission, MISSIONS } from '../src/core/missions';
import { MAP_THEMES } from '../src/core/themes';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { makeState } from './helpers';

describe('the theme of a mission', () => {
  it('is base for a map parsed without a mission', () => {
    expect(makeState(['###', '#P#', '###']).theme).toBe('base');
    expect(themeFor(makeState(['###', '#P#', '###']))).toBe('base');
  });

  it('follows the map type of the three hand-drawn tutorial missions', () => {
    expect(MISSIONS.map((m) => [m.id, createMission(m, 1).theme])).toEqual([['outpost', 'base'], ['warehouse', 'timber'], ['compound', 'base']]);
  });

  it('follows the map type of every generated campaign mission', () => {
    RECIPES.forEach((recipe, type) => {
      const def = generateMission(type, 0);
      expect(def.id).toBe(recipe.id);
      const state = createMission(def, 1);
      expect(state.theme, recipe.id).toBe(MAP_THEMES[recipe.id]);
      expect(themeFor(state)).toBe(MAP_THEMES[recipe.id]);
    });
  });

  it('is base for a mission of an unknown map type', () => {
    expect(createMission({ ...MISSIONS[0], id: 'swamp' }, 1).theme).toBe('base');
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

describe('drawing a themed mission', () => {
  const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

  function drawn(theme: 'base' | 'steel') {
    const state = createMission(MISSIONS[0], 1);
    state.theme = theme;
    const names: string[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const real = atlas.drawImage.bind(atlas);
    atlas.drawImage = (c, fig, x, y, o = {}) => { names.push(fig.name); return real(c, fig, x, y, o); };
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    return names;
  }

  it('draws the theme tile images, and the soldiers, items and corpses as before', () => {
    const steel = drawn('steel');
    expect(steel.some((n) => n === 'wall@steel')).toBe(true);
    expect(steel.some((n) => /^floor_[abc]@steel$/.test(n))).toBe(true);
    expect(steel.some((n) => n.startsWith('squad_'))).toBe(true);
    expect(steel).not.toContain('wall');
    const base = drawn('base');
    expect(base).toContain('wall');
    expect(base.filter((n) => n.includes('@'))).toEqual([]);
    expect(THEMES.steel.ramps).toBeDefined();
    expect(tileImage('steel', 'wall', false, 0, 0)).not.toBe(imageOf('wall'));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/themeselect.test.ts`
Expected: FAIL (`theme` is undefined on the state).

- [ ] **Step 3: Implement**

`src/core/types.ts`: `import type { ThemeId } from './themes';` and add to `GameState` (after `status`): `/** The look of the map's tiles; set from the map type when the mission is created. */ theme: ThemeId;`.

`src/core/mission.ts` `parseMap` return: add `theme: 'base',`.

`src/core/missions.ts` `createMission`: `import { themeOfMap } from './themes';` and after the `parseMap` call and patrol loop add `s.theme = themeOfMap(def.id);`.

`src/art/theme.ts`: `export function themeFor(state: GameState): ThemeId { return state.theme; }`.

Run `npx tsc --noEmit`: add `theme: 'base'` to any hand-built `GameState` literal it reports (test fixtures).

- [ ] **Step 4: Run all**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green (the existing renderer tests that count tiles by image name still pass because their states are `base`).

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: a mission carries its map theme" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Readability rules, tuned palettes, gallery strips

**Files:**
- Modify: `src/art/theme.ts` (ramp colours only, as the tests demand), `src/art/gallery.ts`, `tests/gallery.test.ts`
- Test: `tests/themereadability.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: a green readability suite, ramps that pass it, and gallery strips (one per theme).

- [ ] **Step 1: Write the failing test**

```ts
// tests/themereadability.test.ts
import { describe, expect, it } from 'vitest';
import type { Figure } from '../src/art/figure';
import { imageOf } from '../src/art/image';
import { luminance } from '../src/art/recolour';
import { THEMES, tileImage } from '../src/art/theme';
import { THEME_IDS } from '../src/core/themes';

const SQUAD = '#174fa2';
const ENEMY = '#852131';
const METAL = '#d0d0d0';
const BLOOD = '#b3262c';

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const meanLum = (f: Figure) => {
  const px = f.pixels.filter((p): p is string => p !== null);
  return px.reduce((s, p) => s + luminance(p), 0) / px.length;
};
const meanRgb = (f: Figure): [number, number, number] => {
  const px = f.pixels.filter((p): p is string => p !== null);
  const sum = [0, 0, 0];
  for (const p of px) [1, 3, 5].forEach((i, k) => { sum[k] += parseInt(p.slice(i, i + 2), 16); });
  return sum.map((v) => v / px.length) as [number, number, number];
};
const hue = ([r, g, b]: [number, number, number]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

const floors = (id: string) => [0, 1, 2].map((v) => tileImage(id, 'floor', false, v, 0)).concat(tileImage(id, 'floor', false, 1, 1));
const worst = (id: string, against: string) => Math.min(...floors(id).map((f) => contrast(meanLum(f), luminance(against))));

describe('every theme keeps the map readable', () => {
  const baseSquad = worst('base', SQUAD);
  const baseEnemy = worst('base', ENEMY);

  for (const id of THEME_IDS) {
    describe(THEMES[id].name, () => {
      it('keeps soldiers and enemies readable against its floors (at least 80% of the base contrast)', () => {
        expect(worst(id, SQUAD)).toBeGreaterThanOrEqual(baseSquad * 0.8);
        expect(worst(id, ENEMY)).toBeGreaterThanOrEqual(baseEnemy * 0.8);
      });

      it('keeps the item icons and the blood pool visible on its floors', () => {
        expect(worst(id, METAL)).toBeGreaterThanOrEqual(3);
        expect(worst(id, BLOOD)).toBeGreaterThanOrEqual(1.6);
      });

      it('tells wall, door and floor apart', () => {
        const floor = floors(id)[0];
        const wall = tileImage(id, 'wall', false, 0, 0);
        const door = tileImage(id, 'door', false, 0, 0);
        expect(Math.abs(meanLum(wall) - meanLum(floor))).toBeGreaterThanOrEqual(0.04);
        for (const other of [floor, wall]) {
          const dl = Math.abs(meanLum(door) - meanLum(other));
          const dh = hueGap(hue(meanRgb(door)), hue(meanRgb(other)));
          expect(dl >= 0.04 || dh >= 40, `door against ${other.name}: lum ${dl.toFixed(3)} hue ${dh.toFixed(0)}`).toBe(true);
        }
      });
    });
  }

  it('records the base numbers the rules compare against', () => {
    expect(baseSquad).toBeGreaterThan(1);
    expect(baseEnemy).toBeGreaterThan(1);
    expect(worst('base', BLOOD)).toBeGreaterThanOrEqual(1.8);
    void imageOf;
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/themereadability.test.ts`
Expected: `base` passes; any theme whose proposed ramp breaks a rule FAILS with the number in the message. That is the signal to tune that ramp.

- [ ] **Step 3: Tune the ramps**

For each failing check, edit only the ramp colours in `THEMES` (`src/art/theme.ts`), then re-run. Rules of thumb: a floor that is too light fails the soldier and enemy contrast (lower its `light` and `mid`); a floor too close in lightness to its wall fails the wall rule (raise the wall ramp or lower the floor ramp); a door that blends with both fails the door rule (pick a different hue or lightness for the door ramp); blood below 1.6 means the floor is too bright or too red (darken it or move its hue away from red). Keep the five themes visibly different. Do not weaken the tests to make them pass.

- [ ] **Step 4: The gallery strips**

In `src/art/gallery.ts` add, after the soldiers loop and before the sample text, one strip per theme in the free band between y 296 and 348: each strip is the labelled theme name (`drawText`, `THEMES[id].name.toUpperCase()`) and its six tile pieces at 1x (floors `0, 1, 2` by variant, wall, closed door, open door) drawn with `art.drawImage(ctx, tileImage(id, ...), x, y)` at 17 px steps. Layout: strips for base, timber and steel on the row at y 298 (x = 4, 164, 324), cave and stone on the row at y 324 (x = 4, 164). Each strip's label goes above its tiles (y - 9 would collide with the row above; draw the label to the right of the tiles instead: x + 6 * 17 + 4). Update `tests/gallery.test.ts` in the same step:

```ts
    expect(figures).toHaveLength(64); // 14 images, 20 soldiers, then 5 themes x 6 tile pieces
    expect(new Set(figures.map((f) => f.name)).size).toBe(58); // the base strip repeats the six base tile images
    expect(figures.slice(0, 14).map((f) => f.name)).toEqual([...IMAGE_NAMES]);
    expect(translates).toHaveLength(34); // the strips are drawn at 1x, without translate
```

and add a check that every strip tile lies inside the canvas and above the sample text line (`y + 16 <= 352`) by recording the `x, y` the stub `drawImage` receives for the last 30 figures.

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; whole suite green including the readability tests.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: readability rules for every theme, tuned palettes and gallery strips" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Look at every map type in the game

**Files:**
- Modify: ramp colours in `src/art/theme.ts` only if a screenshot shows a problem (each fix first adds or tightens a test in `tests/themereadability.test.ts` that fails for it)

**Interfaces:**
- Consumes: everything.
- Produces: a verified look for the ten map types and the tutorial.

- [ ] **Step 1: Verify the whole suite, typecheck and build**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: clean, all green, build succeeds.

- [ ] **Step 2: Look at the themes in the dev server**

Start `laser-tribute-dev`. For the tutorial: start the tutorial and screenshot missions 1, 2 and 3 (concrete, timber, concrete). For the campaign: start a new campaign; for each of the ten map types set `app.campaign.missionIndex` to the type's index through the browser console (`app.campaign.missionIndex = i; app.campaign.missionsWon = i`) before pressing Start mission, and screenshot the map with the squad in view (squad, an enemy in view, a door, a corpse placed with `app.controller.state` if needed). Also open the dev gallery (the route the gallery test covers) and screenshot the five theme strips.

Check by eye against the rules: soldiers and enemies read against the floor; walls, doors and floors are distinct; the five themes are clearly different from each other; fog dimming looks right; blood and item icons are visible. Note any piece that reads poorly.

- [ ] **Step 3: Fix what the screenshots show**

For each problem: add a failing assertion to `tests/themereadability.test.ts` that captures it (a contrast or a distinctness number), adjust the ramp colours until it passes, re-run the whole suite, and re-take the screenshot. If nothing needs fixing, say so in the ledger.

- [ ] **Step 4: Commit any changes**

```bash
git add src tests && git commit -m "fix: palette tweaks from the in-game look" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## After the tasks

Final whole-branch review by a fresh Opus reviewer using the spec, this plan's Review Focus and the ledger rulings; one fix pass (each fix RED then GREEN, whole suite green); then push `milestone-23`, give Rui the PR link, and after "pushed and merged" sync master, run the suite, check the live bundle and write the vault notes. If the deploy fails with "Multiple artifacts" or "Found 0 artifacts", the fix is a fresh run of the workflow from the Actions tab, not Re-run jobs.
