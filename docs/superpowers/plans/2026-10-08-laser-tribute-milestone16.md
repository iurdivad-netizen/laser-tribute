# Laser Tribute Milestone 16: Stage 2 Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the floor, wall, doors, item icons, corpses and effects in the style of the PixelLab soldiers (all 16x16 on the unchanged 16 px grid), with the tile choice behind a theme-ready lookup.

**Architecture:** PixelLab PNGs (and hand-drawn rows where PixelLab fails) are committed under `art-src/` and converted by the existing dev script into `src/art/images.generated.ts`. `src/art/image.ts` gives `imageOf(name): Figure`; `src/art/theme.ts` holds the `THEMES` table, `themeFor`, `tileImage`, `itemImage`, `corpseImage`. The atlas draws every image through one 1:1 `drawImage` (the soldiers too). The letter-grid sprites shrink to the 9 effect sprites, redrawn in code with dark outlines.

**Tech Stack:** TypeScript, Vitest, Vite, Canvas; Node `.mjs` converter (no new dependencies); PixelLab MCP tools.

**Spec:** `docs/superpowers/specs/2026-10-08-laser-tribute-milestone16-design.md`

## Global Constraints

- Work on branch `milestone-16` (exists, spec committed). Never commit on `master`. Never push before the final review fixes are in.
- Tiles are 16 px (`CONFIG.tileSize`); every image here is exactly 16x16; the soldiers stay 16x32 figures.
- Image names (fixed, used by tests and the renderer): `floor_a`, `floor_b`, `floor_c`, `wall`, `door_closed`, `door_open`, `item_rifle`, `item_pistol`, `item_grenade`, `corpse_player`, `corpse_enemy` (the spec's `corpse_squad` is `corpse_player` here, so the existing corpse tests keep their names).
- Effect sprite names stay: `flash_0`, `flash_1`, `spark`, `slash_0`, `slash_1`, `splash`, `boom_0` to `boom_3`.
- Files here use CRLF: edit with the Edit tool or with scripts that normalise `\r\n` (see the ledgers of earlier milestones); Node scripts in `scripts/` are plain `.mjs` with a hand-written `.d.mts` (no `@types/node`). No stray empty files from shell redirects.
- Run `npx tsc --noEmit` before every commit. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- PixelLab trial: 34 generations left; this milestone plans 11 to 13. Record every generation in the ledger. Baseline before Task 1: `npx vitest run` shows 1247 passing tests.
- The Browser pane stops opening `file://` pages when many tabs are open: close old tabs first.

## Review Focus

1. Floor repetition: the three floor variants come from one tile (mirrored, turned); a full-map screenshot must not show an obvious grid or stripes (Task 7).
2. Contrast: dark floor against the dark soldiers, items and corpses at close zoom and on a phone (Task 7).
3. Doors: closed and open must differ at a glance, also as remembered by the player (`doorMemory`) and under fog dimming (Task 5 test, Task 7 look).
4. Items under a corpse or a soldier: legible and in the right draw order (existing draw-order tests, Task 5).
5. Anything still naming an old letter sprite (`floor_0`, old `wall`, `door_*`, `item_*`, `corpse_*` in `SPRITE_ROWS`): renderer, gallery, tests, effects (Task 6 test).

---

### Task 1: The art: PixelLab pieces and committed sources

**Files:**
- Create: `art-src/pixellab/tiles/{floor,wall,door_closed,door_open}.png`, `art-src/pixellab/items/{rifle,pistol,grenade}.png`, `art-src/pixellab/corpses/{squad,enemy}.png`, optionally `scripts/hand-images.mjs` (for pieces PixelLab could not make), and notes in `art-src/pixellab/README.md`.
- Scratch (not committed): `.superpowers/pixellab/sheet_stage2.html`

**Interfaces:**
- Produces: for each of the nine sources either a 16x16 RGBA PNG (alpha 0 or 255 only is ideal; the converter treats alpha below 128 as transparent) or an entry in `scripts/hand-images.mjs`: `export const HAND_IMAGES = { door_open: { palette: { k: '#0b0c12', ... }, rows: [ '16 chars', ... x16 ] } }` (a palette of single characters to hex colours, `.` transparent). A piece present as a PNG wins over a hand entry. `floor_b` and `floor_c` are derived later (Task 2).

This task is art, so its checks are file listing and a contact sheet you look at. Dark tones, flat shading, single colour black outline; the floor must stay clearly darker and calmer than the soldiers.

- [ ] **Step 1: The floor and wall tileset (about 4 generations)**

Call `create_topdown_tileset` with `lower_description: "dark worn metal floor panels with faint seams"`, `upper_description: "grey brick wall, seen from above"`, `tile_size: {"width": 16, "height": 16}`, `view: "high top-down"`, `detail: "medium detail"`, `shading: "flat shading"`, `outline: "single color outline"`, `transition_size: 0`, `mode: "standard"`. `wait_for_jobs`, then `get_topdown_tileset` and read which tile has all four corners lower (the plain floor) and which all upper (the plain wall). Download those two tile PNGs to `art-src/pixellab/tiles/floor.png` and `wall.png` (16x16; if a tile comes back at another size, note it and fall back to hand-drawing that tile).

- [ ] **Step 2: Probe one object piece (1 generation)**

Load the schema with ToolSearch `select:mcp__pixellab__create_map_object,mcp__pixellab__get_map_object,mcp__pixellab__create_object_pro_flash,mcp__pixellab__get_object`. Make the rifle first: a top-down 16x16 object with transparent background, description `"rifle lying on the floor seen from above, dark metal barrel and brown wooden stock, small chunky retro game icon"`. Read the result: size, background, look. Record size and cost in the ledger. If the tool cannot give a 16x16 piece with transparent background (or its look is clearly wrong after one retry), switch the item and corpse pieces to hand drawing (Step 4) and skip Step 3.

- [ ] **Step 3: The other object pieces (about 6 to 8 generations with retries)**

Same settings, one call each, descriptions:
- `pistol`: `"pistol lying on the floor seen from above, dark grey metal, small chunky retro game icon"`
- `grenade`: `"hand grenade lying on the floor seen from above, dark green with a metal pin, small chunky retro game icon"`
- `corpses/squad`: `"fallen soldier lying on the ground seen from above, blue uniform and round blue helmet, small chunky retro game sprite"`
- `corpses/enemy`: `"fallen soldier lying on the ground seen from above, dark red uniform and dark red cap, small chunky retro game sprite"`
- `tiles/door_closed`: `"closed wooden door seen from above filling the whole tile, vertical planks with iron bands and a handle, dark brown"`
- `tiles/door_open`: `"open wooden door seen from above, the door leaf swung to one side of a dark doorway, dark brown"`
One retry per piece at most. Download each to `art-src/pixellab/<folder>/<name>.png`.

- [ ] **Step 4: Hand-drawn fallbacks, only where needed**

For any piece that is not a usable PNG, add it to `scripts/hand-images.mjs` as 16 rows of 16 characters with its own palette, in the same style (black outline `k` `#0b0c12`, flat shading, dark tones for the floor/wall/door, bright enough for items and corpses to read on the dark floor). Example for the file:
```js
/** Pieces PixelLab could not make at 16 px: single-character palette, 16 rows of 16 characters, `.` transparent. */
export const HAND_IMAGES = {
  // item_grenade: { palette: { k: '#0b0c12', g: '#3cb371', G: '#26734a', m: '#8a8a99', y: '#ffe14d' }, rows: [ ... 16 rows ... ] },
};
```
If every piece came from PixelLab, create the file with `export const HAND_IMAGES = {};`. A hand-drawn door must fill the tile; items and corpses need a transparent edge.

- [ ] **Step 5: Look at everything**

Write `.superpowers/pixellab/sheet_stage2.html` (inline PNG data URIs, 6x, on the dark floor colour `#2f3347`) showing floor, wall, both doors, three items, two corpses, and a small mock row: floor next to wall next to an item next to a corpse. Close old Browser-pane tabs, open the sheet, take a screenshot. Check: floor calm and dark, wall clearly a wall, closed and open doors different at a glance, items readable, enemy corpse reddish and squad corpse bluish. Replace or hand-draw anything that fails; send the sheet to Rui with SendUserFile and continue (do not wait).

- [ ] **Step 6: Record and commit**

Append to `art-src/pixellab/README.md` a "Stage 2" section: each piece, its PixelLab object or tileset id, prompt, generation date 2026-10-08, and which pieces are hand-drawn and why.
```bash
git add art-src scripts/hand-images.mjs
git commit -m "feat: stage 2 art sources: tiles, doors, items and corpses" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(If `scripts/hand-images.mjs` does not exist yet because Task 2 creates it, create it empty as in Step 4 here; Task 2 only reads it.)

---

### Task 2: The converter makes `images.generated.ts`

**Files:**
- Modify: `scripts/figures-lib.mjs`, `scripts/figures-lib.d.mts`, `scripts/build-figures.mjs`
- Create: `src/art/images.generated.ts` (generated), test `tests/imagesdata.test.ts`

**Interfaces:**
- Consumes: the PNGs and `HAND_IMAGES` from Task 1; the existing `decodePng`.
- Produces (`figures-lib.mjs`): `IMAGE_NAMES` (the eleven names in the order floor_a, floor_b, floor_c, wall, door_closed, door_open, item_rifle, item_pistol, item_grenade, corpse_player, corpse_enemy), `buildImageData(dir: string): { width: 16; height: 16; images: Record<name, { palette: string[]; rows: string[] }> }`, `renderImagesModule(data): string`.
- Produces (`images.generated.ts`): `export type ImageName = ...`, `export const IMAGE_DATA: Record<ImageName, { palette: string[]; rows: string[] }>`; rows are 16 characters, base-62 palette indexes (`0-9a-zA-Z`), `.` transparent.

Rules: sources are `tiles/floor`, `tiles/wall`, `tiles/door_closed`, `tiles/door_open`, `items/{rifle,pistol,grenade}`, `corpses/{squad,enemy}` (PNG under `art-src/pixellab/` if present, else `HAND_IMAGES[name]`); a PNG must be exactly 16x16; alpha below 128 is transparent. `floor_a` and `wall` must have no transparent pixel (throw). A door with transparent pixels is composited over `floor_a` so it is solid. `floor_b` is `floor_a` mirrored left to right, `floor_c` is `floor_a` turned 180 degrees. More than 62 colours in one image throws.

- [ ] **Step 1: Write the failing test**

`tests/imagesdata.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { IMAGE_NAMES, buildImageData, renderImagesModule } from '../scripts/figures-lib.mjs';
import { IMAGE_DATA } from '../src/art/images.generated';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SOLID = ['floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open'] as const;
const LOOSE = ['item_rifle', 'item_pistol', 'item_grenade', 'corpse_player', 'corpse_enemy'] as const;
type Name = (typeof IMAGE_NAMES)[number];

const rowsOf = (n: Name) => IMAGE_DATA[n].rows;
const opaque = (n: Name) => rowsOf(n).join('').replace(/\./g, '').length;
/** Red minus blue over the opaque pixels, a measure of how red an image is. */
function redness(n: Name): number {
  const { palette, rows } = IMAGE_DATA[n];
  let sum = 0;
  for (const row of rows) for (const ch of row) {
    if (ch === '.') continue;
    const hex = palette[DIGITS.indexOf(ch)];
    sum += parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
  }
  return sum;
}

describe('the generated image data', () => {
  it('has the eleven images, each 16x16 with a valid hex palette and valid indexes', () => {
    expect(IMAGE_NAMES).toHaveLength(11);
    expect(Object.keys(IMAGE_DATA).sort()).toEqual([...IMAGE_NAMES].sort());
    for (const name of IMAGE_NAMES) {
      const { palette, rows } = IMAGE_DATA[name];
      expect(rows, name).toHaveLength(16);
      for (const row of rows) expect(row, name).toHaveLength(16);
      expect(palette.length, name).toBeGreaterThan(1);
      expect(palette.length, name).toBeLessThanOrEqual(62);
      for (const hex of palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      for (const row of rows) for (const ch of row) {
        if (ch === '.') continue;
        expect(DIGITS.indexOf(ch), `${name} '${ch}'`).toBeGreaterThanOrEqual(0);
        expect(DIGITS.indexOf(ch), `${name} '${ch}'`).toBeLessThan(palette.length);
      }
    }
  });

  it('floors, wall and doors fill the whole tile', () => {
    for (const name of SOLID) expect(rowsOf(name).join(''), name).not.toMatch(/\./);
  });

  it('items and corpses have a body and a transparent edge', () => {
    for (const name of LOOSE) {
      expect(opaque(name), name).toBeGreaterThanOrEqual(8);
      const border = rowsOf(name).filter((_, y) => y === 0 || y === 15).join('') +
        rowsOf(name).map((r) => r[0] + r[15]).join('');
      expect(border, `${name} has no transparent edge`).toMatch(/\./);
    }
  });

  it('the three floors differ and the doors differ', () => {
    expect(rowsOf('floor_b')).not.toEqual(rowsOf('floor_a'));
    expect(rowsOf('floor_c')).not.toEqual(rowsOf('floor_a'));
    expect(rowsOf('floor_c')).not.toEqual(rowsOf('floor_b'));
    expect(rowsOf('door_closed')).not.toEqual(rowsOf('door_open'));
  });

  it('floor_b is floor_a mirrored and floor_c is floor_a turned 180 degrees', () => {
    const a = rowsOf('floor_a');
    const pal = (n: Name) => (i: string) => IMAGE_DATA[n].palette[DIGITS.indexOf(i)];
    const colour = (n: Name, x: number, y: number) => pal(n)(rowsOf(n)[y][x]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      expect(colour('floor_b', x, y)).toBe(colour('floor_a', 15 - x, y));
      expect(colour('floor_c', x, y)).toBe(colour('floor_a', 15 - x, 15 - y));
    }
    expect(a).toHaveLength(16);
  });

  it('the enemy corpse is redder than the squad corpse', () => {
    expect(redness('corpse_enemy')).toBeGreaterThan(redness('corpse_player'));
  });

  it('matches what the converter makes from the committed sources', () => {
    const made = buildImageData('art-src/pixellab');
    expect(made.width).toBe(16);
    expect(made.height).toBe(16);
    expect(made.images).toEqual(IMAGE_DATA);
    expect(renderImagesModule(made)).toContain('IMAGE_DATA');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/imagesdata.test.ts`
Expected: FAIL (`IMAGE_NAMES` / `images.generated` missing).

- [ ] **Step 3: Implement**

Append to `scripts/figures-lib.d.mts`:
```ts
export const IMAGE_NAMES: readonly [
  'floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open',
  'item_rifle', 'item_pistol', 'item_grenade', 'corpse_player', 'corpse_enemy',
];
export interface ImageEntry { palette: string[]; rows: string[] }
export interface ImageData { width: 16; height: 16; images: Record<(typeof IMAGE_NAMES)[number], ImageEntry> }
export function buildImageData(dir: string): ImageData;
export function renderImagesModule(data: ImageData): string;
```

In `scripts/figures-lib.mjs` add at the top `import { existsSync } from 'node:fs';` (merge with the existing `node:fs` import) and `import { HAND_IMAGES } from './hand-images.mjs';`, then append:
```js
export const IMAGE_NAMES = [
  'floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open',
  'item_rifle', 'item_pistol', 'item_grenade', 'corpse_player', 'corpse_enemy',
];
const IMAGE_SOURCES = {
  floor_a: 'tiles/floor', wall: 'tiles/wall', door_closed: 'tiles/door_closed', door_open: 'tiles/door_open',
  item_rifle: 'items/rifle', item_pistol: 'items/pistol', item_grenade: 'items/grenade',
  corpse_player: 'corpses/squad', corpse_enemy: 'corpses/enemy',
};
const SIZE = 16;

/** A 16x16 grid of hex colours (null = transparent) from a PNG, else from a hand-drawn entry. */
function loadImage(dir, name) {
  const path = join(dir, `${IMAGE_SOURCES[name]}.png`);
  const grid = [];
  if (existsSync(path)) {
    const img = decodePng(readFileSync(path));
    if (img.width !== SIZE || img.height !== SIZE) throw new Error(`${name}: ${path} is ${img.width}x${img.height}, expected ${SIZE}x${SIZE}`);
    for (let y = 0; y < SIZE; y++) {
      const row = [];
      for (let x = 0; x < SIZE; x++) {
        const o = (y * SIZE + x) * 4;
        row.push(img.rgba[o + 3] < 128 ? null : `#${hex2(img.rgba[o])}${hex2(img.rgba[o + 1])}${hex2(img.rgba[o + 2])}`);
      }
      grid.push(row);
    }
    return grid;
  }
  const hand = HAND_IMAGES[name];
  if (!hand) throw new Error(`${name}: no PNG at ${path} and no entry in scripts/hand-images.mjs`);
  if (hand.rows.length !== SIZE) throw new Error(`${name}: hand-drawn image has ${hand.rows.length} rows`);
  for (const line of hand.rows) {
    if (line.length !== SIZE) throw new Error(`${name}: hand-drawn row is ${line.length} wide`);
    grid.push([...line].map((ch) => {
      if (ch === '.') return null;
      if (!hand.palette[ch]) throw new Error(`${name}: unknown colour '${ch}'`);
      return hand.palette[ch];
    }));
  }
  return grid;
}

const flipH = (g) => g.map((row) => [...row].reverse());
const turn180 = (g) => [...g].reverse().map((row) => [...row].reverse());

/** The eleven 16x16 images (tiles, doors, items, corpses) with a palette each; floor_b and floor_c come from floor_a. */
export function buildImageData(dir) {
  const grids = {};
  for (const name of Object.keys(IMAGE_SOURCES)) grids[name] = loadImage(dir, name);
  for (const name of ['floor_a', 'wall']) {
    if (grids[name].some((row) => row.includes(null))) throw new Error(`${name} must fill the whole tile`);
  }
  for (const name of ['door_closed', 'door_open']) {
    grids[name] = grids[name].map((row, y) => row.map((c, x) => c ?? grids.floor_a[y][x])); // doors are solid: over the floor
  }
  grids.floor_b = flipH(grids.floor_a);
  grids.floor_c = turn180(grids.floor_a);
  const images = {};
  for (const name of IMAGE_NAMES) {
    const palette = [];
    const rows = grids[name].map((row) => row.map((c) => {
      if (c === null) return '.';
      let i = palette.indexOf(c);
      if (i < 0) {
        palette.push(c);
        i = palette.length - 1;
      }
      if (i >= DIGITS.length) throw new Error(`${name} uses more than ${DIGITS.length} colours`);
      return DIGITS[i];
    }).join(''));
    images[name] = { palette, rows };
  }
  return { width: SIZE, height: SIZE, images };
}

/** The text of src/art/images.generated.ts. */
export function renderImagesModule(data) {
  return [
    '// Generated by scripts/build-figures.mjs from art-src/pixellab (and scripts/hand-images.mjs). Do not edit by hand.',
    '',
    `export type ImageName = ${IMAGE_NAMES.map((n) => `'${n}'`).join(' | ')};`,
    '',
    'export const IMAGE_DATA: Record<ImageName, { palette: string[]; rows: string[] }> =',
    `${JSON.stringify(data.images, null, 2)};`,
    '',
  ].join('\n');
}
```
In `scripts/build-figures.mjs` add `buildImageData, renderImagesModule` to the import and after the figures write:
```js
const images = buildImageData('art-src/pixellab');
writeFileSync('src/art/images.generated.ts', renderImagesModule(images));
console.log(`wrote src/art/images.generated.ts: ${Object.keys(images.images).length} images`);
```
(`scripts/hand-images.mjs` must exist; Task 1 creates it. Add a `scripts/hand-images.d.mts` only if tsc complains: it should not, since only `figures-lib.mjs` is imported by tests and has its own `.d.mts`.)

- [ ] **Step 4: Generate and run**

Run: `node scripts/build-figures.mjs && npx vitest run tests/imagesdata.test.ts tests/figuresdata.test.ts && npx tsc --noEmit`
Expected: the script prints both lines; tests PASS. If a PNG is not 16x16 or a tile has a hole, fix the source in Task 1 terms (regenerate or hand-draw) rather than loosening the converter.

- [ ] **Step 5: Commit**

```bash
git add scripts src/art/images.generated.ts tests/imagesdata.test.ts
git commit -m "feat: converter for tiles, doors, items and corpses into generated image data" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The image module and the theme lookup

**Files:**
- Create: `src/art/image.ts`, `src/art/theme.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Consumes: `IMAGE_DATA`, `ImageName` (Task 2); `Figure` (`src/art/figure.ts`); `floorVariant` (`src/art/sprite.ts`); `TileKind`, `ItemKind`, `Side`, `GameState` from `src/core/types`.
- Produces:
  - `imageOf(name: ImageName): Figure` (name = the image name, 16x16, hex pixels, cached; same object each call).
  - `type ThemeId = 'base'`, `interface Theme { floors: readonly [ImageName, ImageName, ImageName]; wall: ImageName; doorClosed: ImageName; doorOpen: ImageName }`, `THEMES: Record<ThemeId, Theme>`, `themeFor(state: GameState): ThemeId` (always `'base'`), `tileImage(theme: string, kind: TileKind, open: boolean, x: number, y: number): Figure` (floor variant by `floorVariant(x, y)`; `open` only matters for doors; an unknown theme id uses `base`), `itemImage(kind: ItemKind): Figure`, `corpseImage(side: Side): Figure` (`'player'` gives `corpse_player`, `'enemy'` gives `corpse_enemy`).

- [ ] **Step 1: Write the failing test**

`tests/theme.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { floorVariant } from '../src/art/sprite';
import { THEMES, corpseImage, itemImage, themeFor, tileImage } from '../src/art/theme';
import { createMission, MISSIONS } from '../src/core/missions';

describe('imageOf', () => {
  it('returns a 16x16 figure named after the image, the same object every time', () => {
    const f = imageOf('wall');
    expect(f.name).toBe('wall');
    expect(f.width).toBe(16);
    expect(f.height).toBe(16);
    expect(f.pixels).toHaveLength(256);
    expect(f.pixels.every((p) => p !== null)).toBe(true); // a wall fills its tile
    expect(imageOf('wall')).toBe(f);
  });

  it('gives items and corpses transparent pixels', () => {
    expect(imageOf('item_rifle').pixels.some((p) => p === null)).toBe(true);
    expect(imageOf('corpse_enemy').pixels.some((p) => p === null)).toBe(true);
  });
});

describe('the theme lookup', () => {
  it('has the base theme with three different floors, a wall and two doors', () => {
    const t = THEMES.base;
    expect(new Set(t.floors).size).toBe(3);
    expect(t.wall).toBe('wall');
    expect(t.doorClosed).not.toBe(t.doorOpen);
  });

  it('picks the floor variant by position, the same every time and all three over a map', () => {
    const seen = new Set<string>();
    for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) {
      const f = tileImage('base', 'floor', false, x, y);
      expect(f).toBe(tileImage('base', 'floor', false, x, y));
      expect(f.name).toBe(THEMES.base.floors[floorVariant(x, y)]);
      seen.add(f.name);
    }
    expect(seen.size).toBe(3);
  });

  it('gives the wall, and the closed or open door as remembered', () => {
    expect(tileImage('base', 'wall', false, 3, 4).name).toBe('wall');
    expect(tileImage('base', 'door', false, 3, 4).name).toBe('door_closed');
    expect(tileImage('base', 'door', true, 3, 4).name).toBe('door_open');
    expect(tileImage('base', 'floor', true, 3, 4).name).toMatch(/^floor_/); // open means nothing for a floor
  });

  it('falls back to the base theme for an unknown theme id', () => {
    expect(tileImage('swamp', 'wall', false, 1, 1).name).toBe('wall');
    expect(tileImage('swamp', 'floor', false, 5, 5).name).toBe(tileImage('base', 'floor', false, 5, 5).name);
  });

  it('themeFor gives base for every state today', () => {
    expect(themeFor(createMission(MISSIONS[0], 1))).toBe('base');
  });
});

describe('items and corpses', () => {
  it('map every item kind and both sides to their image', () => {
    expect(itemImage('rifle').name).toBe('item_rifle');
    expect(itemImage('pistol').name).toBe('item_pistol');
    expect(itemImage('grenade').name).toBe('item_grenade');
    expect(corpseImage('player').name).toBe('corpse_player');
    expect(corpseImage('enemy').name).toBe('corpse_enemy');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/theme.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/art/image.ts`:
```ts
import type { Figure } from './figure';
import { IMAGE_DATA, type ImageName } from './images.generated';

export type { ImageName };

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const cache = new Map<ImageName, Figure>();

/** A 16x16 tile, door, item or corpse image, built once from the generated data. */
export function imageOf(name: ImageName): Figure {
  let f = cache.get(name);
  if (!f) {
    const { palette, rows } = IMAGE_DATA[name];
    const pixels: (string | null)[] = [];
    for (const row of rows) for (const ch of row) pixels.push(ch === '.' ? null : palette[DIGITS.indexOf(ch)]);
    f = { name, width: 16, height: 16, pixels };
    cache.set(name, f);
  }
  return f;
}
```

`src/art/theme.ts`:
```ts
import type { GameState, ItemKind, Side, TileKind } from '../core/types';
import type { Figure } from './figure';
import { imageOf, type ImageName } from './image';
import { floorVariant } from './sprite';

export type ThemeId = 'base';

export interface Theme {
  floors: readonly [ImageName, ImageName, ImageName];
  wall: ImageName;
  doorClosed: ImageName;
  doorOpen: ImageName;
}

/** The look of a map's tiles. One theme today; a map type can name another one later. */
export const THEMES: Record<ThemeId, Theme> = {
  base: { floors: ['floor_a', 'floor_b', 'floor_c'], wall: 'wall', doorClosed: 'door_closed', doorOpen: 'door_open' },
};

/** The theme of the mission being drawn: the single place that will read a field on the map later. */
export function themeFor(_state: GameState): ThemeId {
  return 'base';
}

/** The image of a tile. `open` is whether the player last saw the door open; it only matters for doors. */
export function tileImage(theme: string, kind: TileKind, open: boolean, x: number, y: number): Figure {
  const t = (THEMES as Record<string, Theme>)[theme] ?? THEMES.base;
  if (kind === 'wall') return imageOf(t.wall);
  if (kind === 'door') return imageOf(open ? t.doorOpen : t.doorClosed);
  return imageOf(t.floors[floorVariant(x, y)]);
}

const ITEM_IMAGES: Record<ItemKind, ImageName> = { rifle: 'item_rifle', pistol: 'item_pistol', grenade: 'item_grenade' };

export function itemImage(kind: ItemKind): Figure {
  return imageOf(ITEM_IMAGES[kind]);
}

export function corpseImage(side: Side): Figure {
  return imageOf(side === 'player' ? 'corpse_player' : 'corpse_enemy');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/theme.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/art/image.ts src/art/theme.ts tests/theme.test.ts
git commit -m "feat: image lookup and the theme table" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: One `drawImage` for every image

**Files:**
- Modify: `src/art/atlas.ts`, `src/art/gallery.ts`, `src/render/renderer.ts`, `tests/atlas.test.ts`, `tests/artrender.test.ts`, `tests/mobilepanel.test.ts`, `tests/gallery.test.ts`

**Interfaces:**
- Produces: `Atlas.drawFigure` is renamed `Atlas.drawImage(ctx, fig: Figure, x, y, opts?: { flip?: boolean }): boolean` (same behaviour: baked once per name and flip, 1:1). Nothing else changes in this task: tiles, items and corpses still use letter sprites until Task 5.

This is a mechanical rename guarded by the existing tests.

- [ ] **Step 1: Rename**

```bash
grep -rl "drawFigure" src tests | xargs sed -i 's/drawFigure/drawImage/g'
```
Do not touch `ctx.drawImage` (the canvas method) calls: they do not contain `drawFigure`, so the sed leaves them alone. Update the doc comment in `src/art/atlas.ts` to say "An image (a soldier, an enemy, a tile, an item), baked once per mirror...".

- [ ] **Step 2: Run everything**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (1247 tests, identical to before). A failure here is a missed or over-eager rename: read it and fix the rename, not the test logic.

- [ ] **Step 3: Commit**

```bash
git add -A src tests
git commit -m "refactor: the atlas draws every image through drawImage" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The renderer and the gallery use the new images

**Files:**
- Modify: `src/render/renderer.ts`, `src/art/gallery.ts`
- Test: `tests/artrender.test.ts`, `tests/doormemory.test.ts`, `tests/gallery.test.ts`, `tests/atlas.test.ts` (updates and additions)

**Interfaces:**
- Consumes: `tileImage`, `themeFor`, `itemImage`, `corpseImage` (Task 3); `Atlas.drawImage` (Task 4).
- Produces: the tile pass draws `art.drawImage(ctx, tileImage(themeFor(state), tile.kind, tile.kind === 'door' && state.doorMemory[y][x], x, y), x * T, y * T)`; items `art.drawImage(ctx, itemImage(item.kind), …)`; corpses `art.drawImage(ctx, corpseImage(u.side), …)`. Draw order, fog dimming and everything after are unchanged. The gallery draws the 9 effect sprites at 3x through `art.draw` (rows 1 and 2), then the 11 images at 2x on one row (y 120), then the soldiers (rows at y 160 and 230).

- [ ] **Step 1: Update the tests (they fail first)**

`tests/artrender.test.ts`: tile, item and corpse draws are now recorded by the `drawImage` spy under the image names (`wall`, `floor_a|b|c`, `corpse_enemy`, `item_rifle`, `item_grenade`), which the existing assertions already use, so most expectations stay. Add:
```ts
  it('draws tiles, items and corpses as images, not as letter sprites', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    state.items.push({ id: 'i55', pos: { x: soldier.pos.x, y: soldier.pos.y }, kind: 'pistol' });
    const letterSprites: string[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const realDraw = atlas.draw.bind(atlas);
    atlas.draw = (c, name, x, y, opts = {}) => { letterSprites.push(name); return realDraw(c, name, x, y, opts); };
    const images: string[] = [];
    const realImage = atlas.drawImage.bind(atlas);
    atlas.drawImage = (c, fig, x, y, opts = {}) => { images.push(fig.name); return realImage(c, fig, x, y, opts); };
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(images).toEqual(expect.arrayContaining(['wall', 'item_pistol', 'corpse_enemy']));
    expect(images.some((n) => n.startsWith('floor_'))).toBe(true);
    expect(letterSprites.filter((n) => /^(floor|wall|door|item|corpse)/.test(n))).toEqual([]);
  });
```
`tests/doormemory.test.ts`: in "shows the door as last seen" the spy must read `drawImage`: replace the `atlas.draw` override by
```ts
    const real = atlas.drawImage.bind(atlas);
    atlas.drawImage = (ctx, fig, x, y, opts = {}) => {
      drawn.push({ name: fig.name, x, y });
      return real(ctx, fig, x, y, opts);
    };
```
(type the array as `{ name: string; x: number; y: number }[]`; the `SpriteName` import is then unused: remove it). The assertions on `door_closed` and `door_open` stay.

`tests/gallery.test.ts`: replace the body so the fake `art` records `draw` (the 9 effect sprites at scale 3) and `drawImage` (31 calls: 11 images then 20 soldiers, each inside a `translate`/`scale` pair), asserting:
```ts
    expect(drawn.map((d) => d.name)).toEqual([...SPRITE_NAMES]); // the nine effect sprites
    expect(SPRITE_NAMES).toHaveLength(9);
    expect(images).toHaveLength(31);
    expect(new Set(images.map((f) => f.name)).size).toBe(31);
    expect(images.slice(0, 11).map((f) => f.name)).toEqual([...IMAGE_NAMES]); // import IMAGE_NAMES from '../scripts/figures-lib.mjs'
    for (const t of translates) { expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x + 32).toBeLessThanOrEqual(480); expect(t.y + 64).toBeLessThanOrEqual(352); }
```
and `translates` has 31 entries (`SPRITE_NAMES` length 9 holds only after Task 6; until then keep the existing 21 and the effect-only assertion commented in the ledger as a Ruling, or do Task 6's sprite list change here first if simpler). `tests/atlas.test.ts` is unchanged in this task.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/artrender.test.ts tests/doormemory.test.ts tests/gallery.test.ts`
Expected: FAIL (the renderer still draws letter sprites).

- [ ] **Step 3: Implement**

`src/render/renderer.ts`: replace the imports `floorVariant` and `SpriteName`, the `tileSprite` function and the three draw sites. Imports: `import { corpseImage, itemImage, themeFor, tileImage } from '../art/theme';` and `import type { Figure } from '../art/figure';` (keep `RISE, unitFigure`), drop `floorVariant` and the `SpriteName` import. Replace `tileSprite` with
```ts
function tileFigure(state: GameState, x: number, y: number): Figure {
  const tile = state.tiles[y][x];
  // a door as the player last saw it
  return tileImage(themeFor(state), tile.kind, tile.kind === 'door' && state.doorMemory[y][x], x, y);
}
```
and the draws with `art.drawImage(ctx, tileFigure(state, x, y), x * T, y * T)`, `art.drawImage(ctx, itemImage(item.kind), item.pos.x * T, item.pos.y * T)`, `art.drawImage(ctx, corpseImage(u.side), u.pos.x * T, u.pos.y * T)`.

`src/art/gallery.ts`: after the nine effect sprites (cells as now, 8 per row, scale 3), draw the images and then the soldiers:
```ts
  // the eleven tile, door, item and corpse images at 2x on one row
  IMAGE_NAMES_LIST.forEach((name, i) => {
    const x = 4 + i * 42;
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(x, 120, 32, 32);
    ctx.save();
    ctx.translate(x, 120);
    ctx.scale(2, 2);
    art.drawImage(ctx, imageOf(name), 0, 0);
    ctx.restore();
  });
```
with `import { imageOf, type ImageName } from './image';` and a local `const IMAGE_NAMES_LIST: ImageName[] = ['floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open', 'item_rifle', 'item_pistol', 'item_grenade', 'corpse_player', 'corpse_enemy'];` (each cell 42 px wide: 11 cells fit in 480). Move the soldier rows to `y` 160 and 230.

- [ ] **Step 4: Run, then the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. Fix any remaining test that read old sprite names for tiles, items or corpses from `SPRITE_ROWS` (grep `floor_0|SPRITE_ROWS.wall|SPRITE_ROWS.item|SPRITE_ROWS.corpse` in `tests/`): those assertions move to `imageOf` or are deleted if Task 2/3 tests cover them.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: draw tiles, items and corpses from the new images through the theme lookup" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Effects redrawn; the letter sprites shrink to effects

**Files:**
- Modify (rewrite): `src/art/sprites.ts`; modify `tests/sprites.test.ts`, `tests/atlas.test.ts`, `tests/gallery.test.ts`
- Create: `tests/effectsart.test.ts`

**Interfaces:**
- Produces: `SPRITE_NAMES` = the nine effect names; `SPRITE_ROWS: Record<SpriteName, string[]>` with 16x16 letter grids (palette letters from `src/art/palette.ts`) in the new style: a dark outline `k` around every shape, flat bands inside. Same names and sizes as before; explosions are still drawn at 3x by the effects code.
- Shapes: `flash_0` a bright star (core `f`, ring `y`, rays `o`, rays 2 px wide along the axes and diagonals, reach 5.5), `flash_1` a smaller star (reach 3.2); `spark` a small red-white cross (core `f`, arms `P`, tips `R`); `slash_0`/`slash_1` the diagonal blade as now (white `f` with a `C` edge on frame 1, 8 and 11 long); `splash` the old blood blob with `u` body and `R` highlights; `boom_0` to `boom_3` the growing fireball (`f`, `y`, `o`, rim `M`) as now, outlined for frames 0 to 2, the last a smoke ring (`M`, no outline).

- [ ] **Step 1: Write the failing tests**

`tests/effectsart.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

const opaque = (name: (typeof SPRITE_NAMES)[number]) => SPRITE_ROWS[name].join('').replace(/\./g, '').length;
const OUTLINED = ['flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash', 'boom_0', 'boom_1', 'boom_2'] as const;

describe('the effect sprites', () => {
  it('are exactly the nine effects, each 16x16 with palette letters only', () => {
    expect([...SPRITE_NAMES]).toEqual(['flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash', 'boom_0', 'boom_1', 'boom_2', 'boom_3']);
    expect(SPRITE_NAMES).toHaveLength(10);
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
```
(`SPRITE_NAMES` has ten entries, not nine: two flashes, spark, two slashes, splash, four booms; the plan text above says nine in error: the list in the test is the truth. Record the count correction as a ledger Ruling.)

Update `tests/sprites.test.ts`: `has exactly the 10 named sprites` (`toHaveLength(10)`, keys equal), keep the parse and flip test; delete the floors/walls/doors test and the enemy-corpse test (covered by `tests/imagesdata.test.ts`). Update `tests/atlas.test.ts`: `'wall'` becomes `'splash'`, `'item_rifle'` becomes `'slash_0'` (an asymmetric sprite for the mirror test), `SPRITE_ROWS.wall` becomes `SPRITE_ROWS.splash`, and the first-rectangle colour expectation becomes `PALETTE.k` (the outline is the first opaque pixel in reading order). Update `tests/gallery.test.ts` to expect `SPRITE_NAMES` of length 10 drawn through `draw`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/effectsart.test.ts tests/sprites.test.ts tests/atlas.test.ts tests/gallery.test.ts`
Expected: FAIL (`SPRITE_NAMES` still has 21 entries; no outlines).

- [ ] **Step 3: Rewrite `src/art/sprites.ts`**

```ts
export const SPRITE_NAMES = [
  'flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash',
  'boom_0', 'boom_1', 'boom_2', 'boom_3',
] as const;

export type SpriteName = (typeof SPRITE_NAMES)[number];

const SIZE = 16;
const C = (SIZE - 1) / 2; // the centre lies between pixels 7 and 8

const blank = (): string[][] => Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));

/** A dark outline `k` around every shape (4 neighbours), as the soldiers have. */
function outlined(grid: string[][]): string[] {
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') !== '.')) out[y][x] = 'k';
    }
  }
  return out.map((r) => r.join(''));
}

/** A muzzle flash: a star with a white core, a yellow ring and orange rays along the axes and diagonals. */
function flashRows(big: boolean): string[] {
  const g = blank();
  const reach = big ? 5.5 : 3.2;
  const core = big ? 1.8 : 1.2;
  const ring = big ? 3.2 : 2.4;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.abs(x - C);
      const dy = Math.abs(y - C);
      const r = Math.hypot(dx, dy);
      const ray = (dx <= 0.8 || dy <= 0.8 || Math.abs(dx - dy) <= 0.8) && r <= reach;
      if (!ray && r > ring) continue;
      g[y][x] = r <= core ? 'f' : r <= ring ? 'y' : 'o';
    }
  }
  return outlined(g);
}

/** A hit spark: a small cross, white in the middle, pink arms, red tips. */
function sparkRows(): string[] {
  const g = blank();
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) g[y][x] = 'f';
  for (const [x, y] of [[6, 7], [9, 7], [6, 8], [9, 8], [7, 6], [8, 6], [7, 9], [8, 9]]) g[y][x] = 'P';
  for (const [x, y] of [[5, 7], [10, 8], [7, 5], [8, 10]]) g[y][x] = 'R';
  return outlined(g);
}

function slashRows(frame: number): string[] {
  const g = blank();
  const length = frame === 0 ? 8 : 11;
  for (let i = 0; i < length; i++) {
    const x = 13 - i;
    const y = 2 + i;
    g[y][x] = 'f';
    g[y][x + 1] = frame === 0 ? 'f' : 'C';
  }
  return outlined(g);
}

/** Blood: a dark red blob with bright red flecks. */
const SPLASH_BODY = [
  '................',
  '................',
  '................',
  '......uuuu......',
  '....uuuuuuuu....',
  '...uuuRuuuuuu...',
  '..uuuuuuuuRuuu..',
  '..uRuuuuuuuuuu..',
  '..uuuuuRuuuuuu..',
  '...uuuuuuuuuu...',
  '....uuuuuuuu....',
  '......uuuu......',
  '................',
  '................',
  '................',
  '................',
];

/** An explosion frame: a fireball that grows, then thins to a dark ring. */
function boomRows(frame: number): string[] {
  const radius = [3.5, 5.5, 7, 7.5][frame];
  const g = blank();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = Math.hypot(x - C, y - C) / radius;
      if (t > 1) continue;
      if (frame === 3) g[y][x] = t >= 0.6 ? 'M' : '.';
      else g[y][x] = t < 0.35 ? 'f' : t < 0.65 ? 'y' : t < 0.9 ? 'o' : 'M';
    }
  }
  return frame === 3 ? g.map((r) => r.join('')) : outlined(g);
}

export const SPRITE_ROWS: Record<SpriteName, string[]> = {
  flash_0: flashRows(true),
  flash_1: flashRows(false),
  spark: sparkRows(),
  slash_0: slashRows(0),
  slash_1: slashRows(1),
  splash: outlined(SPLASH_BODY.map((r) => [...r])),
  boom_0: boomRows(0),
  boom_1: boomRows(1),
  boom_2: boomRows(2),
  boom_3: boomRows(3),
};
```
Remove now-unused exports from `src/art/sprite.ts` only if tsc complains (`recolorRows`, `rotateRows` stay: tests use them). Keep `floorVariant`.

- [ ] **Step 4: Run, then the suite and a look**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. The `outlined` test may fail for a shape whose outline would fall outside the grid: shrink that shape by one pixel (the explosion at frame 2 reaches the edge by design and is not outlined where it would leave the grid; if `boom_2` fails the outline test for an edge pixel, change the test's `OUTLINED` list to exclude `boom_2` and record a Ruling). Then check the effects in the dev gallery: start the dev server, freeze `requestAnimationFrame`, call `window.gallery()` and screenshot (the main loop redraws over it otherwise). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: effects redrawn with dark outlines; the letter sprites are now only effects" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Check it in the real game

**Files:**
- Production changes only if a bug shows up (failing test first).

- [ ] **Step 1: Everything green**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all tests pass (1247 plus the new ones), tsc clean, build succeeds (note the bundle size in the ledger).

- [ ] **Step 2: Look at the game**

Close old Browser-pane tabs; `preview_start` with `laser-tribute-dev`. Start a tutorial mission (clear `localStorage`, press `T`, then Enter). Take screenshots: desktop size and the 375x812 mobile preset, close zoom and whole-map zoom (Z). Then place an enemy corpse next to the squad and drop an item on a tile through the dev `app` object (`app.controller.state`), and open a door (D next to one, or edit `state.tiles`). Check: floor calm with no visible grid or stripes over a full map; walls read as walls; closed and open doors clearly different, also dimmed under fog; items readable; corpses readable and the enemy one reddish; soldiers still stand out from the floor; shots, stab and grenade effects look right (fire a shot with S then click an enemy, throw with T). Read the console for errors. Reset the viewport to desktop, clear `localStorage`, stop the server.

- [ ] **Step 3: Record**

Write the observations (floor repetition, contrast, door clarity, item legibility, bundle size, generations used in total) into the ledger for the final review. Any bug found: failing test first, fix, rerun the suite, ledger it.

---

## Self-review

- **Spec coverage:** PixelLab floor/wall tileset with derived variants, objects for doors, items and corpses, hand fallback, hand-drawn effects (Tasks 1, 6); converter and generated images with the drift test (Task 2); image type, theme table, `themeFor`, `tileImage`, `itemImage`, `corpseImage` (Task 3); one `drawImage` (Task 4); renderer and gallery migration (Task 5); `SPRITE_NAMES` shrinks to the effects (Task 6); real-game check (Task 7). Not covered by design: autotiled walls, per-map themes, 32 px tiles, animations.
- **Corrections noted in the plan:** the effect sprite count is ten (two flashes, a spark, two slashes, a splash, four explosion frames), not nine as the spec says; the squad corpse keeps the name `corpse_player`. Both are ledger Rulings for Task 6.
- **Placeholders:** none except the hand-drawn rows, which Task 1 writes only for pieces PixelLab cannot make (an example format is given); tests give the checks any such rows must pass.
- **Type consistency:** `ImageName`, `IMAGE_DATA`, `imageOf`, `THEMES`, `Theme`, `themeFor`, `tileImage`, `itemImage`, `corpseImage`, `Atlas.drawImage`, `SPRITE_NAMES`, `SPRITE_ROWS` are used with the same names and signatures in every task.
- **Review Focus coverage:** (1) and (2) Task 7; (3) Task 5 door memory test and Task 7; (4) the existing draw-order tests stay green through Task 5; (5) Task 5 `letterSprites` test and Task 6 `SPRITE_NAMES` test.
