# Laser Tribute Milestone 15: Tall PixelLab Soldiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 16x16 hand-built soldier and enemy sprites with taller PixelLab figures (16 px wide, about 33 px tall) standing on the unchanged 16 px tile grid, with the weapon painted by code and clicks that work on the visible figure.

**Architecture:** PixelLab PNGs are committed under `art-src/pixellab/` and converted by a dev script into `src/art/figures.generated.ts` (palette plus rows). A pure `src/art/figure.ts` builds `Figure`s (body, weapon overlay, mirror, opaque mask). The atlas bakes figures like sprites; the renderer draws units sorted by tile row with the feet on the unit's tile; effects start from the chest; a pure `unitAtScreen` makes the opaque pixels of a figure clickable; `App` uses it before the tile lookup. Tiles, items, effects, corpses, the core and saves are untouched.

**Tech Stack:** TypeScript, Vitest, Vite, Canvas; a plain Node `.mjs` converter script (no new dependencies); PixelLab MCP tools for the one new generation.

**Spec:** `docs/superpowers/specs/2026-10-07-laser-tribute-milestone15-design.md`

## Global Constraints

- Work on branch `milestone-15` (exists, spec committed). Never commit on `master`. Never push before the final review fixes are in.
- Tiles are 16 px (`CONFIG.tileSize`). A figure is 16 wide and about 33 tall (`FIGURE_H`); `RISE = FIGURE_H - 16` px of it stand above the unit's tile (17 for 33).
- Facing mapping unchanged: facings 0 to 4 use views n, ne, e, se, s; 5, 6, 7 are the mirrors of 3, 2, 1.
- PixelLab colours are kept as generated (no remap). The squad side key is `squad`, the enemy side key `enemy`; the unit side `player` maps to `squad`.
- Weapon overlay colours: metal `#d0d0d0`, muzzle tip `#ffffff`. Rifle longer than pistol; the weapon never leaves the figure box and starts at or next to the body.
- Shared constants: aim point = tile centre raised by 8 px (`AIM_RAISE = 8`); health bar 4 px above the figure top; rank pips at the bottom-left of the feet tile (x 1 to 3, 1x2 each), armour pip `{x:13,y:13,w:2,h:2}` unchanged.
- Files in this repo use CRLF. Edit with the Edit tool or with scripts that normalise `\r\n` (see earlier milestones' ledger lessons); do not leave stray empty files from shell redirects.
- Run `npx tsc --noEmit` before every commit. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- PixelLab trial: 35 generations left; this milestone uses 1 (the enemy). Baseline before Task 1: `npx vitest run` shows 1209 passing tests.

## Review Focus

1. Two figures overlapping, or a figure over a closed door or a wall: selecting, targeting and hovering must pick the front figure and never a hidden one (Task 8 and Task 9 tests).
2. A soldier on the first walkable row (row 1) under the border wall: the head is drawn over row 0 and is never clipped (Task 5 test).
3. The move animation (offset and bob): clicks use the logical tile and logical figure position, not the animated one (Task 8 test).
4. Fog: an enemy at the edge of vision whose upper body overlaps unexplored or dim tiles is drawn only when its own tile is in view (Task 5 test).
5. The touch two-tap flow when the first tap lands on a figure of the selected soldier or on an enemy (Task 9 test).

---

### Task 1: The enemy art and the committed sources

**Files:**
- Create: `art-src/pixellab/README.md`, `art-src/pixellab/squad/{n,ne,e,se,s}.png`, `art-src/pixellab/enemy/{n,ne,e,se,s}.png`
- Scratch (not committed): `.superpowers/pixellab/sheet_sources.html`

**Interfaces:**
- Produces: ten PNGs (48x48 RGBA, the figure inside the canvas, transparent background), view names `n, ne, e, se, s` = PixelLab `north, north-east, east, south-east, south`.

This task cannot be unit-tested; its checks are the file listing and a contact sheet that you look at.

- [ ] **Step 1: Copy the squad views**

The squad character is the existing "Laser Tribute Standard 32" (id `ee5cbe29-bf0c-4202-bfc9-3c82b21704cf`); its rotations were downloaded to `.superpowers/pixellab/std32/` (`north.png` and so on). If that folder is gone, download them again from the rotation URLs that `get_character` returns for that id.

```bash
mkdir -p art-src/pixellab/squad art-src/pixellab/enemy
cd .superpowers/pixellab/std32
cp north.png ../../../art-src/pixellab/squad/n.png
cp north-east.png ../../../art-src/pixellab/squad/ne.png
cp east.png ../../../art-src/pixellab/squad/e.png
cp south-east.png ../../../art-src/pixellab/squad/se.png
cp south.png ../../../art-src/pixellab/squad/s.png
cd ../../..
```

- [ ] **Step 2: Generate the enemy (1 generation)**

Call `create_character` with: `mode: "standard"`, `n_directions: 8`, `size: 32`, `view: "high top-down"`, `outline: "single color black outline"`, `shading: "flat shading"`, `detail: "low detail"`, `proportions: {"type": "preset", "name": "chibi"}`, `name: "Laser Tribute Enemy 32"`, `description: "enemy soldier in a dark red uniform with a black cap and a dark red vest, arms at the sides, no weapon, chunky retro squad game sprite"`. Then `wait_for_jobs` and `get_character` to read the rotation URLs.

- [ ] **Step 3: Download the enemy views**

For each of `north north-east east south-east south`, download the URL from `get_character` to `art-src/pixellab/enemy/<n|ne|e|se|s>.png` with `curl -s -o`.

- [ ] **Step 4: Write the provenance note**

`art-src/pixellab/README.md`:
```markdown
# PixelLab sources

The soldier and enemy figures in `src/art/figures.generated.ts` are converted from these PNGs by `node scripts/build-figures.mjs`.

- Generator: PixelLab (https://pixellab.ai), standard mode, 8 directions, size 32 (48x48 canvas), high top-down, black outline, flat shading, low detail, chibi proportions, no weapon. Terms: https://pixellab.ai/termsofservice
- `squad/`: character "Laser Tribute Standard 32", id `ee5cbe29-bf0c-4202-bfc9-3c82b21704cf`, generated 2026-10-07. Prompt: blue-uniform soldier with a big round blue helmet, arms at the sides, no weapon, chunky retro squad game sprite.
- `enemy/`: character "Laser Tribute Enemy 32", id <fill in from the generation>, generated 2026-10-07. Prompt: enemy soldier in a dark red uniform with a black cap and a dark red vest, arms at the sides, no weapon, chunky retro squad game sprite.
- File names are the views the game uses: n, ne, e, se, s (PixelLab north, north-east, east, south-east, south). West-side facings are mirrors made in the game.
```
Replace `<fill in from the generation>` with the real id.

- [ ] **Step 5: Contact sheet and look**

Write `.superpowers/pixellab/sheet_sources.html` (inline base64 images, 3x, squad row above enemy row, `image-rendering: pixelated`, dark floor-coloured background `#262a3d`) and open it with `mcp__Claude_Browser__navigate` (file URL), then take a screenshot. Confirm: ten files exist (`ls art-src/pixellab/*`), all are 48x48 (read the PNG header width and height at bytes 16 to 23), the enemy is clearly red where the squad is blue, and the five views face N, NE, E, SE, S. If the enemy looks wrong (not red, no clear cap, wrong facing), generate once more and replace; record each extra generation in the ledger.
Send the sheet to Rui with SendUserFile (caption: the squad and enemy figures that the next tasks convert) and continue; do not wait for a reply. If Rui objects later, regenerate and re-run the converter (Task 2).

- [ ] **Step 6: Commit**

```bash
git add art-src/pixellab
git commit -m "feat: PixelLab sources for the squad and enemy figures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The converter and the generated figure data

**Files:**
- Create: `scripts/figures-lib.mjs`, `scripts/figures-lib.d.mts`, `scripts/build-figures.mjs`, `src/art/figures.generated.ts`
- Test: `tests/figuresdata.test.ts`

**Interfaces:**
- Consumes: the ten PNGs from Task 1.
- Produces (`figures-lib.mjs`): `SIDES = ['squad','enemy']`, `VIEWS = ['n','ne','e','se','s']`, `decodePng(bytes: Uint8Array): { width, height, rgba: Uint8Array }` (8-bit, not interlaced; colour types 6, 2 and 3), `buildFigureData(dir: string): FigureData`, `renderModule(data: FigureData): string`.
- Produces (`figures.generated.ts`): `FIGURE_WIDTH` (16), `FIGURE_HEIGHT` (expected 33), `FIGURE_DATA: Record<'squad'|'enemy', { palette: string[]; views: Record<'n'|'ne'|'e'|'se'|'s', string[]> }>`; rows are `FIGURE_WIDTH` characters, `.` transparent, otherwise a palette index in base 62 (`0-9a-zA-Z`).

Rules: a pixel is opaque when alpha >= 128. The crop width is the union x-range of opaque pixels over all ten images and must equal 16, else throw. Each view is cropped with its own lowest opaque pixel on the bottom row (feet aligned) and its top `height - 1` rows above that, where `height` is the tallest single view's opaque height. A palette per side holds the distinct colours in order of first appearance; more than 62 colours throws.

- [ ] **Step 1: Write the failing test**

`tests/figuresdata.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildFigureData, renderModule } from '../scripts/figures-lib.mjs';
import { FIGURE_DATA, FIGURE_HEIGHT, FIGURE_WIDTH } from '../src/art/figures.generated';

const SIDES = ['squad', 'enemy'] as const;
const VIEWS = ['n', 'ne', 'e', 'se', 's'] as const;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('the generated figure data', () => {
  it('is 16 wide and at least 30 tall, for both sides and all five views', () => {
    expect(FIGURE_WIDTH).toBe(16);
    expect(FIGURE_HEIGHT).toBeGreaterThanOrEqual(30);
    for (const side of SIDES) {
      for (const view of VIEWS) {
        const rows = FIGURE_DATA[side].views[view];
        expect(rows, `${side} ${view}`).toHaveLength(FIGURE_HEIGHT);
        for (const row of rows) expect(row).toHaveLength(FIGURE_WIDTH);
      }
    }
  });

  it('uses only valid hex colours and palette indexes, with the feet on the bottom row of every view', () => {
    for (const side of SIDES) {
      const { palette, views } = FIGURE_DATA[side];
      expect(palette.length).toBeGreaterThan(3);
      expect(palette.length).toBeLessThanOrEqual(62);
      for (const hex of palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      for (const view of VIEWS) {
        for (const row of views[view]) {
          for (const ch of row) {
            if (ch === '.') continue;
            expect(DIGITS.indexOf(ch), `${side} ${view} '${ch}'`).toBeGreaterThanOrEqual(0);
            expect(DIGITS.indexOf(ch), `${side} ${view} '${ch}'`).toBeLessThan(palette.length);
          }
        }
        expect(views[view][FIGURE_HEIGHT - 1].replace(/\./g, ''), `${side} ${view} feet`).not.toBe('');
      }
    }
  });

  it('the squad is bluer than red and the enemy redder than blue', () => {
    const balance = (side: (typeof SIDES)[number]) => {
      const { palette, views } = FIGURE_DATA[side];
      let sum = 0;
      for (const view of VIEWS) {
        for (const row of views[view]) {
          for (const ch of row) {
            if (ch === '.') continue;
            const hex = palette[DIGITS.indexOf(ch)];
            sum += parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16); // red minus blue
          }
        }
      }
      return sum;
    };
    expect(balance('squad')).toBeLessThan(0);
    expect(balance('enemy')).toBeGreaterThan(0);
  });

  it('matches what the converter makes from the committed PNGs', () => {
    const made = buildFigureData('art-src/pixellab');
    expect(made.width).toBe(FIGURE_WIDTH);
    expect(made.height).toBe(FIGURE_HEIGHT);
    expect(made.sides).toEqual(FIGURE_DATA);
    expect(renderModule(made)).toContain('FIGURE_DATA');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/figuresdata.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write the converter library**

`scripts/figures-lib.d.mts`:
```ts
export const SIDES: readonly ['squad', 'enemy'];
export const VIEWS: readonly ['n', 'ne', 'e', 'se', 's'];
export interface FigureSideData { palette: string[]; views: Record<'n' | 'ne' | 'e' | 'se' | 's', string[]> }
export interface FigureData { width: number; height: number; sides: Record<'squad' | 'enemy', FigureSideData> }
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array };
export function buildFigureData(dir: string): FigureData;
export function renderModule(data: FigureData): string;
```

`scripts/figures-lib.mjs`:
```js
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

export const SIDES = ['squad', 'enemy'];
export const VIEWS = ['n', 'ne', 'e', 'se', 's'];
const EXPECTED_WIDTH = 16;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Decodes an 8-bit, non-interlaced PNG (colour type 6, 2 or 3) to RGBA. */
export function decodePng(bytes) {
  const b = Buffer.from(bytes);
  let p = 8;
  let width = 0;
  let height = 0;
  let ct = 0;
  const idat = [];
  let plte = null;
  let trns = null;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('latin1', p + 4, p + 8);
    const d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = d.readUInt32BE(0);
      height = d.readUInt32BE(4);
      ct = d[9];
      if (d[8] !== 8 || d[12] !== 0) throw new Error('unsupported PNG: need 8-bit and not interlaced');
    } else if (type === 'IDAT') idat.push(d);
    else if (type === 'PLTE') plte = d;
    else if (type === 'tRNS') trns = d;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 3 ? 1 : 0;
  if (!bpp) throw new Error(`unsupported PNG colour type ${ct}`);
  if (ct === 3 && !plte) throw new Error('palette PNG without PLTE');
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  let prev = Buffer.alloc(width * bpp);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (width * bpp + 1)];
    const line = Buffer.from(raw.subarray(y * (width * bpp + 1) + 1, (y + 1) * (width * bpp + 1)));
    for (let x = 0; x < width * bpp; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const u = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += u;
      else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) {
        const pp = a + u - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - u);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      }
      line[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (ct === 3) {
        const i = line[x];
        rgba[o] = plte[i * 3];
        rgba[o + 1] = plte[i * 3 + 1];
        rgba[o + 2] = plte[i * 3 + 2];
        rgba[o + 3] = trns && i < trns.length ? trns[i] : 255;
      } else {
        rgba[o] = line[x * bpp];
        rgba[o + 1] = line[x * bpp + 1];
        rgba[o + 2] = line[x * bpp + 2];
        rgba[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
      }
    }
    prev = line;
  }
  return { width, height, rgba };
}

const hex2 = (n) => n.toString(16).padStart(2, '0');

/** The five views of both sides, cropped to one width and with every view's feet on the bottom row. */
export function buildFigureData(dir) {
  const images = {};
  let x0 = Infinity;
  let x1 = -Infinity;
  let tallest = 0;
  for (const side of SIDES) {
    images[side] = {};
    for (const view of VIEWS) {
      const img = decodePng(readFileSync(join(dir, side, `${view}.png`)));
      let top = Infinity;
      let bottom = -Infinity;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          if (img.rgba[(y * img.width + x) * 4 + 3] < 128) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      if (bottom < 0) throw new Error(`${side}/${view}.png has no opaque pixel`);
      tallest = Math.max(tallest, bottom - top + 1);
      images[side][view] = { img, bottom };
    }
  }
  const width = x1 - x0 + 1;
  if (width !== EXPECTED_WIDTH) throw new Error(`the figures are ${width} px wide, expected ${EXPECTED_WIDTH}`);
  const sides = {};
  for (const side of SIDES) {
    const palette = [];
    const views = {};
    for (const view of VIEWS) {
      const { img, bottom } = images[side][view];
      const rows = [];
      for (let r = 0; r < tallest; r++) {
        const y = bottom - (tallest - 1 - r);
        let row = '';
        for (let x = x0; x <= x1; x++) {
          const o = (y * img.width + x) * 4;
          if (y < 0 || img.rgba[o + 3] < 128) {
            row += '.';
            continue;
          }
          const hex = `#${hex2(img.rgba[o])}${hex2(img.rgba[o + 1])}${hex2(img.rgba[o + 2])}`;
          let i = palette.indexOf(hex);
          if (i < 0) {
            palette.push(hex);
            i = palette.length - 1;
          }
          if (i >= DIGITS.length) throw new Error(`${side} uses more than ${DIGITS.length} colours`);
          row += DIGITS[i];
        }
        rows.push(row);
      }
      views[view] = rows;
    }
    sides[side] = { palette, views };
  }
  return { width, height: tallest, sides };
}

/** The text of src/art/figures.generated.ts. */
export function renderModule(data) {
  return [
    '// Generated by scripts/build-figures.mjs from art-src/pixellab. Do not edit by hand: run `node scripts/build-figures.mjs`.',
    '',
    `export const FIGURE_WIDTH = ${data.width};`,
    `export const FIGURE_HEIGHT = ${data.height};`,
    '',
    "export const FIGURE_DATA: Record<'squad' | 'enemy', { palette: string[]; views: Record<'n' | 'ne' | 'e' | 'se' | 's', string[]> }> =",
    `${JSON.stringify(data.sides, null, 2)};`,
    '',
  ].join('\n');
}
```

`scripts/build-figures.mjs`:
```js
import { writeFileSync } from 'node:fs';
import { buildFigureData, renderModule } from './figures-lib.mjs';

const data = buildFigureData('art-src/pixellab');
writeFileSync('src/art/figures.generated.ts', renderModule(data));
console.log(`wrote src/art/figures.generated.ts: ${data.width}x${data.height}`);
```

- [ ] **Step 4: Generate the data, run the test**

Run: `node scripts/build-figures.mjs` then `npx vitest run tests/figuresdata.test.ts && npx tsc --noEmit`
Expected: the script prints `16x33` (any height of 30 or more is accepted; if the width is not 16 the script throws: look at the contact sheet from Task 1, and if one view's arms or weapon-hand stretch the union, regenerate that character in Task 1 rather than widening the box), tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add scripts src/art/figures.generated.ts tests/figuresdata.test.ts
git commit -m "feat: converter and generated figure data from the PixelLab sources" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Figures, the painted weapon, mirrors and masks

**Files:**
- Create: `src/art/figure.ts`
- Test: `tests/figure.test.ts`

**Interfaces:**
- Consumes: `FIGURE_DATA`, `FIGURE_WIDTH`, `FIGURE_HEIGHT` (Task 2); `Facing`, `Side`, `WeaponId` from `src/core/types`.
- Produces:
  - `FIGURE_W`, `FIGURE_H` (re-exports of the data sizes), `RISE = FIGURE_H - 16`.
  - `type FigureView = 'n'|'ne'|'e'|'se'|'s'`, `type FigureSide = 'squad'|'enemy'`.
  - `interface Figure { name: string; width: number; height: number; pixels: (string | null)[] }` (row-major, hex colour or null).
  - `bodyFigure(side, view): Figure` (weaponless), `armedFigure(side, view, weapon): Figure` (name `${side}_${weapon}_${view}`), `flipFigure(f): Figure`, `figureMask(f, flip): Uint8Array` (1 = opaque; cached by name and flip), `unitFigure(side: Side, facing: Facing, weapon: WeaponId): { figure: Figure; flip: boolean }`.
  - `WEAPON_AT: Record<FigureView, { x; y; dx; dy; rifle; thick?: [number, number] }>`, `METAL = '#d0d0d0'`, `TIP = '#ffffff'`.

Rules for the weapon: a rifle has `rifle` pixels, a pistol `max(2, round(rifle / 2))`; pixel `i` is `METAL`, the last one `TIP`; where `thick` is set, a second `METAL` pixel is painted beside every non-tip barrel pixel. The directions in `WEAPON_AT` are the facing vectors: n (0,-1), ne (1,-1), e (1,0), se (1,1), s (0,1).

- [ ] **Step 1: Write the failing test**

`tests/figure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  FIGURE_H, FIGURE_W, METAL, RISE, TIP, WEAPON_AT, armedFigure, bodyFigure, figureMask, flipFigure, unitFigure,
  type FigureSide, type FigureView,
} from '../src/art/figure';
import type { Facing, WeaponId } from '../src/core/types';

const VIEWS: FigureView[] = ['n', 'ne', 'e', 'se', 's'];
const SIDES: FigureSide[] = ['squad', 'enemy'];
const WEAPONS: WeaponId[] = ['rifle', 'pistol'];
const DIR: Record<FigureView, [number, number]> = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1] };

/** The pixels a weapon added to a body, as {x, y, colour}. */
function added(side: FigureSide, view: FigureView, weapon: WeaponId) {
  const body = bodyFigure(side, view);
  const armed = armedFigure(side, view, weapon);
  const out: { x: number; y: number; colour: string }[] = [];
  armed.pixels.forEach((p, i) => {
    if (p !== body.pixels[i]) out.push({ x: i % FIGURE_W, y: Math.floor(i / FIGURE_W), colour: p as string });
  });
  return out;
}

describe('figures', () => {
  it('are 16 wide, about two tiles tall, with RISE the part above the tile', () => {
    expect(FIGURE_W).toBe(16);
    expect(FIGURE_H).toBeGreaterThanOrEqual(30);
    expect(RISE).toBe(FIGURE_H - 16);
    for (const side of SIDES) for (const view of VIEWS) {
      const f = bodyFigure(side, view);
      expect(f.width).toBe(FIGURE_W);
      expect(f.height).toBe(FIGURE_H);
      expect(f.pixels).toHaveLength(FIGURE_W * FIGURE_H);
      expect(f.pixels.some((p) => p !== null), `${side} ${view}`).toBe(true);
    }
  });

  it('have their feet on the bottom row in every view', () => {
    for (const side of SIDES) for (const view of VIEWS) {
      const f = bodyFigure(side, view);
      const bottom = f.pixels.slice((FIGURE_H - 1) * FIGURE_W);
      expect(bottom.some((p) => p !== null), `${side} ${view}`).toBe(true);
    }
  });

  it('keep the squad and the enemy apart: different pixels, same silhouette height', () => {
    for (const view of VIEWS) {
      expect(bodyFigure('squad', view).pixels).not.toEqual(bodyFigure('enemy', view).pixels);
    }
  });
});

describe('the painted weapon', () => {
  it('points the way each view faces, for both weapons and both sides', () => {
    for (const view of VIEWS) {
      expect([WEAPON_AT[view].dx, WEAPON_AT[view].dy]).toEqual(DIR[view]);
      for (const side of SIDES) for (const weapon of WEAPONS) {
        const tip = added(side, view, weapon).filter((p) => p.colour === TIP);
        expect(tip, `${side} ${weapon} ${view}`).toHaveLength(1);
        const at = WEAPON_AT[view];
        const [vx, vy] = DIR[view];
        if (vx !== 0) expect(Math.sign(tip[0].x - at.x), `${weapon} ${view} x`).toBe(vx);
        if (vy !== 0) expect(Math.sign(tip[0].y - at.y), `${weapon} ${view} y`).toBe(vy);
      }
    }
  });

  it('is longer for a rifle than for a pistol in every view, and never empty', () => {
    for (const view of VIEWS) {
      const rifle = added('squad', view, 'rifle').length;
      const pistol = added('squad', view, 'pistol').length;
      expect(rifle, view).toBeGreaterThan(pistol);
      expect(pistol, view).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses only metal and tip colours, and stays inside the figure box', () => {
    for (const view of VIEWS) for (const weapon of WEAPONS) {
      for (const p of added('squad', view, weapon)) {
        expect([METAL, TIP]).toContain(p.colour);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(FIGURE_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(FIGURE_H);
      }
    }
  });

  it('starts at the body: the first barrel pixel is on or next to an opaque body pixel', () => {
    for (const view of VIEWS) {
      const body = bodyFigure('squad', view);
      const at = WEAPON_AT[view];
      const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < FIGURE_W && y < FIGURE_H && body.pixels[y * FIGURE_W + x] !== null;
      const touches = opaque(at.x, at.y) || opaque(at.x - 1, at.y) || opaque(at.x + 1, at.y) || opaque(at.x, at.y - 1) || opaque(at.x, at.y + 1);
      expect(touches, `${view} weapon start ${at.x},${at.y} floats in the air`).toBe(true);
    }
  });
});

describe('mirrors and masks', () => {
  it('flips left to right, and flipping twice gives the original', () => {
    const f = armedFigure('squad', 'ne', 'rifle');
    const g = flipFigure(f);
    expect(g.pixels[0 * FIGURE_W + 0]).toBe(f.pixels[0 * FIGURE_W + (FIGURE_W - 1)]);
    expect(g.pixels[20 * FIGURE_W + 3]).toBe(f.pixels[20 * FIGURE_W + (FIGURE_W - 1 - 3)]);
    expect(flipFigure(g).pixels).toEqual(f.pixels);
  });

  it('gives an opaque-pixel mask, mirrored when flipped, and caches it', () => {
    const f = armedFigure('squad', 'e', 'rifle');
    const plain = figureMask(f, false);
    const flipped = figureMask(f, true);
    expect(plain).toHaveLength(FIGURE_W * FIGURE_H);
    f.pixels.forEach((p, i) => expect(plain[i]).toBe(p === null ? 0 : 1));
    for (let y = 0; y < FIGURE_H; y++) for (let x = 0; x < FIGURE_W; x++) {
      expect(flipped[y * FIGURE_W + x]).toBe(plain[y * FIGURE_W + (FIGURE_W - 1 - x)]);
    }
    expect(figureMask(f, false)).toBe(plain);
  });

  it('maps facings 0 to 4 to the five views and 5, 6, 7 to the mirrors of 3, 2, 1, per weapon and side', () => {
    const expected: [Facing, FigureView, boolean][] = [
      [0, 'n', false], [1, 'ne', false], [2, 'e', false], [3, 'se', false], [4, 's', false],
      [5, 'se', true], [6, 'e', true], [7, 'ne', true],
    ];
    for (const weapon of WEAPONS) {
      for (const [facing, view, flip] of expected) {
        const p = unitFigure('player', facing, weapon);
        expect(p.flip).toBe(flip);
        expect(p.figure.name).toBe(`squad_${weapon}_${view}`);
        const e = unitFigure('enemy', facing, weapon);
        expect(e.flip).toBe(flip);
        expect(e.figure.name).toBe(`enemy_${weapon}_${view}`);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/figure.test.ts`
Expected: FAIL (`src/art/figure` not found).

- [ ] **Step 3: Implement**

`src/art/figure.ts`:
```ts
import type { Facing, Side, WeaponId } from '../core/types';
import { FIGURE_DATA, FIGURE_HEIGHT, FIGURE_WIDTH } from './figures.generated';

export const FIGURE_W = FIGURE_WIDTH;
export const FIGURE_H = FIGURE_HEIGHT;
/** How many pixel rows of a figure stand above the tile its feet are on. */
export const RISE = FIGURE_H - 16;

export type FigureView = 'n' | 'ne' | 'e' | 'se' | 's';
export type FigureSide = 'squad' | 'enemy';

export const METAL = '#d0d0d0';
export const TIP = '#ffffff';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FACING_VIEW: FigureView[] = ['n', 'ne', 'e', 'se', 's'];

export interface Figure {
  name: string;
  width: number;
  height: number;
  /** Row-major: a hex colour, or null for transparent. */
  pixels: (string | null)[];
}

/**
 * Where the weapon starts (at the hands) and which way it points, per view; a rifle has `rifle` pixels, a pistol about
 * half. The profiles are thin, so every view has its own hand position. Tuned by eye in the dev gallery.
 */
export const WEAPON_AT: Record<FigureView, { x: number; y: number; dx: number; dy: number; rifle: number; thick?: [number, number] }> = {
  n: { x: 12, y: 21, dx: 0, dy: -1, rifle: 7, thick: [1, 0] },
  ne: { x: 11, y: 20, dx: 1, dy: -1, rifle: 5 },
  e: { x: 11, y: 21, dx: 1, dy: 0, rifle: 6, thick: [0, -1] },
  se: { x: 10, y: 21, dx: 1, dy: 1, rifle: 6 },
  s: { x: 11, y: 22, dx: 0, dy: 1, rifle: 5, thick: [-1, 0] },
};

const bodies = new Map<string, Figure>();
const armed = new Map<string, Figure>();
const masks = new Map<string, Uint8Array>();

export function bodyFigure(side: FigureSide, view: FigureView): Figure {
  const key = `${side}_${view}`;
  let f = bodies.get(key);
  if (!f) {
    const { palette, views } = FIGURE_DATA[side];
    const pixels: (string | null)[] = [];
    for (const row of views[view]) for (const ch of row) pixels.push(ch === '.' ? null : palette[DIGITS.indexOf(ch)]);
    f = { name: key, width: FIGURE_W, height: FIGURE_H, pixels };
    bodies.set(key, f);
  }
  return f;
}

/** The body with its weapon painted in: light metal along the barrel and a white tip at the muzzle. */
export function armedFigure(side: FigureSide, view: FigureView, weapon: WeaponId): Figure {
  const key = `${side}_${weapon}_${view}`;
  let f = armed.get(key);
  if (!f) {
    const body = bodyFigure(side, view);
    const pixels = [...body.pixels];
    const at = WEAPON_AT[view];
    const length = weapon === 'rifle' ? at.rifle : Math.max(2, Math.round(at.rifle / 2));
    const put = (x: number, y: number, colour: string): void => {
      if (x < 0 || y < 0 || x >= FIGURE_W || y >= FIGURE_H) throw new Error(`${key}: weapon pixel ${x},${y} is outside the figure`);
      pixels[y * FIGURE_W + x] = colour;
    };
    for (let i = 0; i < length; i++) {
      put(at.x + at.dx * i, at.y + at.dy * i, i === length - 1 ? TIP : METAL);
      // a second pixel beside the barrel (not on diagonals) so the weapon shows at game size
      if (at.thick && i < length - 1) put(at.x + at.dx * i + at.thick[0], at.y + at.dy * i + at.thick[1], METAL);
    }
    f = { name: key, width: FIGURE_W, height: FIGURE_H, pixels };
    armed.set(key, f);
  }
  return f;
}

export function flipFigure(f: Figure): Figure {
  const pixels: (string | null)[] = [];
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) pixels.push(f.pixels[y * f.width + (f.width - 1 - x)]);
  }
  return { ...f, name: `${f.name}:flip`, pixels };
}

/** 1 where the figure has a pixel, as drawn (mirrored when `flip`); the same array is returned for the same figure. */
export function figureMask(f: Figure, flip: boolean): Uint8Array {
  const key = flip ? `${f.name}:flip` : f.name;
  let m = masks.get(key);
  if (!m) {
    const source = flip ? flipFigure(f) : f;
    m = Uint8Array.from(source.pixels, (p) => (p === null ? 0 : 1));
    masks.set(key, m);
  }
  return m;
}

/** Facings 0 to 4 have their own view; 5, 6, 7 are the horizontal mirror of 3, 2, 1. */
export function unitFigure(side: Side, facing: Facing, weapon: WeaponId): { figure: Figure; flip: boolean } {
  const flip = facing > 4;
  const base = flip ? 8 - facing : facing;
  return { figure: armedFigure(side === 'player' ? 'squad' : 'enemy', FACING_VIEW[base], weapon), flip };
}
```

- [ ] **Step 4: Run, then tune the weapon positions by eye**

Run: `npx vitest run tests/figure.test.ts && npx tsc --noEmit`. The "starts at the body" test and the overlay-bounds test may fail for the first-guess `WEAPON_AT` numbers: use the figure rows to place the hands. Print a view as text (a throwaway vitest or a node snippet that imports the generated data and prints rows with `.` and `#`), pick for each view the pixel where the arm or hand is (about chest height), set `x, y` there, and keep `dx, dy` and the lengths (rifle 5 to 7). Tune until the tests pass. Then write a throwaway HTML sheet (inline images, 6x) of the five views of both sides with rifle and pistol, open it in the browser pane and look: the barrel should leave the hands and point the right way in every view. Record the final table and anything odd in the ledger.
Expected: tests PASS, the sheet looks right.

- [ ] **Step 5: Commit**

```bash
git add src/art/figure.ts tests/figure.test.ts
git commit -m "feat: figures with a painted weapon, mirrors and opaque masks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The atlas bakes figures

**Files:**
- Modify: `src/art/atlas.ts`
- Test: `tests/atlas.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `Figure`, `flipFigure` (Task 3).
- Produces: `Atlas.drawFigure(ctx, fig: Figure, x: number, y: number, opts?: { flip?: boolean }): boolean` — bakes the figure once per (figure name, flip) into a `fig.width` x `fig.height` canvas, one 1x1 `fillRect` per opaque pixel in the pixel's hex colour, then `drawImage(canvas, round(x), round(y))` at 1:1 (no scale); returns false and draws nothing when there is no canvas.

- [ ] **Step 1: Write the failing tests**

Append to `tests/atlas.test.ts` (it already defines `FakeCanvas`, `makeAtlas`, `fakeCtx`, `Op`):
```ts
import { FIGURE_H, FIGURE_W, armedFigure } from '../src/art/figure';

describe('Atlas figures', () => {
  it('bakes a figure once, one rectangle per opaque pixel in its own colour, and draws it 1:1', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    const f = armedFigure('squad', 's', 'rifle');
    expect(atlas.drawFigure(ctx, f, 32.4, 47.6)).toBe(true);
    expect(atlas.drawFigure(ctx, f, 0, 0)).toBe(true);
    expect(canvases).toHaveLength(1);
    expect(canvases[0].width).toBe(FIGURE_W);
    expect(canvases[0].height).toBe(FIGURE_H);
    expect(calls[0]).toEqual([canvases[0], 32, 48, FIGURE_W, FIGURE_H]);
    expect(canvases[0].ops).toHaveLength(f.pixels.filter((p) => p !== null).length);
    expect(canvases[0].ops.every((o) => o.w === 1 && o.h === 1)).toBe(true);
    const first = f.pixels.findIndex((p) => p !== null);
    expect(canvases[0].ops[0]).toMatchObject({ x: first % FIGURE_W, y: Math.floor(first / FIGURE_W), colour: f.pixels[first] });
  });

  it('keeps a mirrored copy as a separate cache entry with the pixels mirrored', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx } = fakeCtx();
    const f = armedFigure('squad', 'ne', 'rifle');
    atlas.drawFigure(ctx, f, 0, 0);
    atlas.drawFigure(ctx, f, 0, 0, { flip: true });
    atlas.drawFigure(ctx, f, 0, 0, { flip: true });
    expect(canvases).toHaveLength(2);
    const key = (o: Op) => `${o.x},${o.y},${o.colour}`;
    const plain = new Set(canvases[0].ops.map(key));
    const mirrored = new Set(canvases[1].ops.map((o) => key({ ...o, x: FIGURE_W - 1 - o.x })));
    expect(mirrored).toEqual(plain);
  });

  it('draws nothing and does not throw when there is no canvas', () => {
    const atlas = new Atlas(() => null);
    const { ctx, calls } = fakeCtx();
    expect(atlas.drawFigure(ctx, armedFigure('enemy', 'e', 'pistol'), 0, 0, { flip: true })).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/atlas.test.ts`
Expected: FAIL (`drawFigure` is not a function).

- [ ] **Step 3: Implement**

In `src/art/atlas.ts`: add `import { flipFigure, type Figure } from './figure';`, a field `private figures = new Map<string, CanvasLike | null>();` and a method:
```ts
  /** A figure (a soldier or an enemy), baked once per mirror and stamped 1:1 with its top-left at (x, y). */
  drawFigure(ctx: CanvasRenderingContext2D, fig: Figure, x: number, y: number, opts: { flip?: boolean } = {}): boolean {
    const flip = opts.flip ?? false;
    const key = flip ? `${fig.name}:flip` : fig.name;
    if (!this.figures.has(key)) {
      const source = flip ? flipFigure(fig) : fig;
      const canvas = this.createCanvas(source.width, source.height);
      const c = canvas?.getContext('2d') ?? null;
      if (canvas && c) {
        source.pixels.forEach((colour, i) => {
          if (colour === null) return;
          c.fillStyle = colour;
          c.fillRect(i % source.width, Math.floor(i / source.width), 1, 1);
        });
      }
      this.figures.set(key, canvas && c ? canvas : null);
    }
    const baked = this.figures.get(key) ?? null;
    if (!baked) return false;
    ctx.drawImage(baked as unknown as CanvasImageSource, Math.round(x), Math.round(y), baked.width, baked.height);
    return true;
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/atlas.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/art/atlas.ts tests/atlas.test.ts
git commit -m "feat: the atlas bakes and stamps figures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Drawing the tall soldiers

**Files:**
- Modify: `src/render/renderer.ts`, `src/art/sprite.ts` (`pipPositions`), `src/art/sprites.ts` is NOT touched yet (Task 7)
- Test: `tests/artrender.test.ts`, `tests/art.test.ts` (updates and additions)

**Interfaces:**
- Consumes: `unitFigure`, `RISE`, `FIGURE_H` (Task 3); `Atlas.drawFigure` (Task 4).
- Produces: units are drawn with `art.drawFigure(ctx, figure, x0, y0 - RISE, { flip })` where `(x0, y0)` is the feet tile's top-left including the move offset and bob; living units are drawn sorted by tile row, the lowest row last; `pipPositions(count)` returns `{ x: 1 + i, y: 13 }` (1x2 pips at the bottom-left of the feet tile); the health bar is `{x: cx - 6, y: y0 - RISE - 6, w: 12, h: 2}` (entirely above the figure, 4 px gap); the alert `!` is drawn at `(cx + 8, y0 - RISE - 13)`; the selection box stays on the feet tile.

- [ ] **Step 1: Update and add the tests (they fail first)**

In `tests/artrender.test.ts`:
- Change `spyAtlas` to record figures too (names `squad_...` / `enemy_...` are distinct from sprite names):
```ts
function spyAtlas() {
  const drawn: { name: string; x: number; y: number; flip: boolean }[] = [];
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.draw.bind(atlas);
  atlas.draw = (ctx, name, x, y, opts = {}) => {
    drawn.push({ name, x, y, flip: !!opts.flip });
    return real(ctx, name, x, y, opts);
  };
  const realFigure = atlas.drawFigure.bind(atlas);
  atlas.drawFigure = (ctx, fig, x, y, opts = {}) => {
    drawn.push({ name: fig.name, x, y, flip: !!opts.flip });
    return realFigure(ctx, fig, x, y, opts);
  };
  return { atlas, drawn };
}
```
(`SpriteName` import is no longer needed there.)
- Replace every `d.name.startsWith('soldier_')` with `d.name.startsWith('squad_')`, and `'soldier_rifle_e'` / `'soldier_rifle_n'` with `'squad_rifle_e'` / `'squad_rifle_n'`.
- In "draws corpses before the living", the position check becomes `d.name.startsWith('squad_') && d.x === soldier.pos.x * 16 && d.y === soldier.pos.y * 16 - RISE` (import `RISE` from `../src/art/figure`).
- In "draws the health bar entirely above the tile ..." rename it to "draws the health bar entirely above the figure" and assert `b.y + b.h <= p1.pos.y * 16 - RISE - 4 + 0` (the bar bottom is at least 4 px above the figure top): `expect(b.y + b.h).toBeLessThanOrEqual(p1.pos.y * 16 - RISE - 4)`.
- Add these tests:
```ts
  it('draws a figure with its feet on the unit tile: 17 px up and in the tile column', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    for (const u of state.units.filter((x) => x.side === 'player')) {
      expect(drawn.some((d) => d.name.startsWith('squad_') && d.x === u.pos.x * 16 && d.y === u.pos.y * 16 - RISE), u.id).toBe(true);
    }
  });

  it('draws the units in order of tile row, the lowest row last, whatever order they are listed in', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    state.units.reverse();
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const ys = drawn.filter((d) => d.name.startsWith('squad_') || d.name.startsWith('enemy_')).map((d) => d.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('draws the head of a soldier on the first walkable row over the border wall, never above the map', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const p1 = state.units.find((u) => u.id === 'p1')!;
    p1.pos = { x: 1, y: 1 }; // the first walkable row
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const fig = drawn.find((d) => d.name.startsWith('squad_') && d.x === 16 && d.y === 16 - RISE)!;
    expect(fig).toBeDefined();
    expect(fig.y).toBeGreaterThanOrEqual(-RISE); // the head rows lie in row 0, the wall; the world starts at y = 0
    expect(RISE).toBeLessThanOrEqual(17 + 16); // never more than two tiles above the feet tile
  });

  it('draws an enemy at the edge of vision only when its own tile is in view', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.pos = { x: 28, y: 1 }; // far corner, in the dark
    const hidden = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, hidden.atlas);
    expect(hidden.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(false);
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    const seen = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, seen.atlas);
    expect(seen.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(true);
  });
```
- In "keeps the armour pip clear of the rank pips" the region `near` is the feet tile rectangle: keep it (pips now at the bottom-left, armour at the bottom-right); no change needed besides the pip y.

In `tests/art.test.ts`:
- Delete the `describe('unitSprite', ...)` block (replaced by the `unitFigure` test in Task 3) and remove `unitSprite` from the imports.
- Replace the two pip describes with:
```ts
describe('rankPips and pipPositions', () => {
  it('counts pips by rank', () => {
    expect(['Rookie', 'Private', 'Sergeant', 'Captain', '', 'Nonsense'].map(rankPips)).toEqual([0, 1, 2, 3, 0, 0]);
  });

  it('places the pips in a row at the bottom-left of the feet tile, clear of the tile edge', () => {
    expect(pipPositions(0)).toEqual([]);
    expect(pipPositions(3)).toEqual([{ x: 1, y: 13 }, { x: 2, y: 13 }, { x: 3, y: 13 }]);
    for (const p of pipPositions(3)) {
      expect(p.x).toBeGreaterThanOrEqual(1); // column 0 is the selection and hover outline
      expect(p.y + 2).toBeLessThanOrEqual(15); // row 15 is the edge row
    }
  });
});

describe('rank pips and the armour pip stay clear of every figure', () => {
  it('overlap no opaque pixel of any soldier or enemy figure, mirrored or not, in the feet tile', () => {
    const marks: { x: number; y: number }[] = [];
    for (const p of pipPositions(3)) marks.push({ x: p.x, y: p.y }, { x: p.x, y: p.y + 1 });
    for (let dy = 0; dy < ARMOUR_PIP.h; dy++) for (let dx = 0; dx < ARMOUR_PIP.w; dx++) marks.push({ x: ARMOUR_PIP.x + dx, y: ARMOUR_PIP.y + dy });
    for (const side of ['squad', 'enemy'] as const) for (const view of ['n', 'ne', 'e', 'se', 's'] as const) for (const weapon of ['rifle', 'pistol'] as const) {
      const f = armedFigure(side, view, weapon);
      for (const flip of [false, true]) {
        const mask = figureMask(f, flip);
        for (const m of marks) {
          expect(mask[(m.y + RISE) * FIGURE_W + m.x], `${f.name} flip=${flip} at ${m.x},${m.y}`).toBe(0);
        }
      }
    }
  });
});
```
with imports `armedFigure, figureMask, FIGURE_W, RISE` from `../src/art/figure`; keep `ARMOUR_PIP, pipPositions, rankPips` imports; drop `SPRITE_NAMES`/`SPRITE_ROWS`/`SPRITE_SIZE` if no longer used in this file.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/artrender.test.ts tests/art.test.ts`
Expected: FAIL (renderer still draws sprites; pips at the top-left).

- [ ] **Step 3: Implement**

`src/art/sprite.ts`: change `pipPositions` to
```ts
/**
 * Rank pips: 1x2 pixels in a row at the bottom-left of the feet tile (x 1 to 3, rows 13-14): clear of the figure's
 * legs and boots, of the selection outline on the tile edge and of the health bar above the head.
 */
export function pipPositions(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => ({ x: 1 + i, y: 13 }));
}
```
(update its doc comment accordingly; `ARMOUR_PIP` unchanged).

`src/render/renderer.ts`: imports `import { RISE, unitFigure } from '../art/figure';`, remove `unitSprite` from the `../art/sprite` import. Replace the whole living-units loop (from `for (const u of state.units) { if (!u.alive) continue;` to its closing brace) with:
```ts
  // Living units in order of tile row, the lowest row last, so a figure in front covers the one behind it (and the wall
  // its head overlaps). The sort is stable: units on one row keep their list order.
  const living = state.units
    .filter((u) => u.alive && !(u.side === 'enemy' && !visible[u.pos.y][u.pos.x]))
    .sort((a, b) => a.pos.y - b.pos.y);
  for (const u of living) {
    const off = effects.unitOffset(u.id, now);
    const x0 = Math.round(u.pos.x * T + off.x); // the top-left of the tile the feet stand on
    const y0 = Math.round(u.pos.y * T + off.y + effects.unitBob(u.id, now));
    const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
    art.drawFigure(ctx, figure, x0, y0 - RISE, { flip });
    const cx = x0 + T / 2;

    if (u.side === 'player') {
      ctx.fillStyle = COLORS.pip;
      for (const p of pipPositions(rankPips(u.rank))) ctx.fillRect(x0 + p.x, y0 + p.y, 1, 2);
      if (u.gadget === 'armour') {
        ctx.fillStyle = COLORS.armour;
        ctx.fillRect(x0 + ARMOUR_PIP.x, y0 + ARMOUR_PIP.y, ARMOUR_PIP.w, ARMOUR_PIP.h);
      }
    }

    const barY = y0 - RISE - 6; // the bar's bottom is 4 px above the top of the figure
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 6, barY, 12, 2);
    ctx.fillStyle = '#7dff9a';
    ctx.fillRect(cx - 6, barY, (12 * u.hp) / u.maxHp, 2);
    if (u.alert) {
      drawText(ctx, '!', cx + 8, barY - 7, COLORS.select);
    }
    if (u.id === ui.selectedId) {
      ctx.strokeStyle = COLORS.select;
      ctx.strokeRect(u.pos.x * T + 0.5, u.pos.y * T + 0.5, T - 1, T - 1);
    }
  }
```

- [ ] **Step 4: Run, fix pip overlaps if the test finds any, run the suite**

Run: `npx vitest run tests/artrender.test.ts tests/art.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS. If the pip-overlap test reports a figure pixel at a pip position (a boot or a weapon reaching the corner), move the rank pips along the bottom edge of the feet tile to free columns (keep them in a row of 1x2 marks inside the feet tile, away from the armour pip at x 13 to 14) and update `pipPositions` and the two expectations above; record the choice as a Ruling in the ledger. Other tests that import `unitSprite` or soldier sprite names must be updated to the figure API (grep `unitSprite|soldier_|enemy_rifle|enemy_pistol` in `tests/` outside `sprites.test.ts` and `gallery.test.ts`, which Task 7 owns).

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: draw the tall figures by row with the feet on the tile" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Effects start from the chest

**Files:**
- Modify: `src/render/effects.ts`
- Test: `tests/arteffects.test.ts`

**Interfaces:**
- Produces: `AIM_RAISE = 8` and `aimPoint(p: Pos): Pos` (`{ x: p.x * T + T / 2, y: p.y * T + T / 2 - AIM_RAISE }`) exported from `effects.ts`. The tracer line goes from `aimPoint(from)` to `aimPoint(to)`; the muzzle flash sprite is at `(tile x + dir.x * 8, tile y + dir.y * 8 - 8)`; the hit spark and the stab slash and spark are at the target tile's top-left raised by 8 (`y - 8`); the crit second spark is at `(x - 8, y - 16)` of the tile. Grenade booms, death splashes and tile flashes stay on tile coordinates.

- [ ] **Step 1: Update the tests (they fail first)**

In `tests/arteffects.test.ts`:
- muzzle flash expectation: `toMatchObject({ x: 2 * T + 8, y: 3 * T - 8 })`.
- hit spark: `toMatchObject({ x: 6 * T, y: 3 * T - 8 })`.
- add:
```ts
  it('the tracer starts and ends at the chest of the shooter and of the target', () => {
    const fx = new Effects();
    fx.add([shot(true)], 0);
    const line = fx.frames(50).find((d) => d.type === 'line') as { from: { x: number; y: number }; to: { x: number; y: number } };
    expect(line.from).toEqual({ x: 2 * T + 8, y: 3 * T + 8 - 8 });
    expect(line.to).toEqual({ x: 6 * T + 8, y: 3 * T + 8 - 8 });
    expect(aimPoint({ x: 1, y: 1 })).toEqual({ x: 16 + 8, y: 16 + 8 - 8 });
  });
```
  (import `aimPoint` from `../src/render/effects`).
- stab test: add `expect(sprites(fx, 10).find((d) => (d as { name: string }).name === 'slash_0')).toMatchObject({ x: 2 * T, y: 1 * T - 8 })`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/arteffects.test.ts tests/rendereffects.test.ts`
Expected: FAIL (positions unchanged, `aimPoint` missing).

- [ ] **Step 3: Implement**

In `src/render/effects.ts`: add after `const T = ...`:
```ts
/** How far above its tile's centre a soldier's chest is: shots and blows start and end there, not at the feet. */
export const AIM_RAISE = 8;
export const aimPoint = (p: Pos): Pos => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 - AIM_RAISE });
```
Replace `center` uses: in `frames`, the line effect uses `aimPoint(e.from)` and `aimPoint(e.to)` (remove the unused `center`). In `add`: muzzle `{ x: muzzle.x + dir.x * 8, y: muzzle.y + dir.y * 8 - AIM_RAISE }`; hit spark `{ x: impact.x, y: impact.y - AIM_RAISE }` from `tilePx(e.impact)`; crit second spark `{ x: t.x - 8, y: t.y - 8 - AIM_RAISE }`; stab slash and stab spark at `tilePx(e.at)` with `y - AIM_RAISE`. Leave `died`, `grenade`, `healed`, `reloaded` as they are.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/arteffects.test.ts tests/rendereffects.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/effects.ts tests/arteffects.test.ts
git commit -m "feat: shots and blows start and end at the chest of the tall figures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Remove the old soldier sprites; the gallery shows the figures

**Files:**
- Modify: `src/art/sprites.ts`, `src/art/sprite.ts`, `src/art/gallery.ts`
- Test: `tests/sprites.test.ts`, `tests/gallery.test.ts`, `tests/atlas.test.ts` (remove soldier sprite uses)

**Interfaces:**
- Produces: `SPRITE_NAMES` without the 20 `soldier_*` and `enemy_*` entries (21 names left: floors, wall, doors, items, corpses, flashes, spark, slashes, splash, booms); `SPRITE_ROWS` likewise; `unitSprite` removed from `sprite.ts`; the gallery draws the 21 sprites at 3x as before and, below them, the figures: row 1 at y 176: squad rifle (5 views) then enemy rifle (5 views); row 2 at y 246: squad pistol then enemy pistol; each figure at 2x through `art.drawFigure` is not available (1:1 only), so the gallery draws figures through a scaled context: `ctx.save(); ctx.translate(x, y); ctx.scale(2, 2); art.drawFigure(ctx, fig, 0, 0, { flip }); ctx.restore()`; views n, ne, e, se, s left to right, cells 44 px wide.

- [ ] **Step 1: Update the tests (they fail first)**

`tests/sprites.test.ts`: change `has exactly the 41 named sprites` to 21 (`toHaveLength(21)`), delete the tests that read `soldier_*`/`enemy_*` rows (symmetry, weapon direction, rifle versus pistol, face, opaque count, enemy red: they moved to `tests/figure.test.ts`), keep the floors/walls test and the all-sprites-16x16 test.

`tests/gallery.test.ts`: the fake `art` gets `drawFigure` too; the test asserts `drawn.map(d => d.name)` equals `[...SPRITE_NAMES]` (21 sprites), that exactly 20 figures were drawn (names starting `squad_` or `enemy_`: 5 views x 2 sides x 2 weapons), all inside 480x360, and sprite scale 3:
```ts
    const figures: { name: string; flip: boolean }[] = [];
    const art = {
      draw: (_ctx: unknown, name: string, x: number, y: number, opts?: { scale?: number }) => { drawn.push({ name, x, y, scale: opts?.scale ?? 1 }); return true; },
      drawFigure: (_ctx: unknown, fig: { name: string }, _x: number, _y: number, opts?: { flip?: boolean }) => { figures.push({ name: fig.name, flip: !!opts?.flip }); return true; },
    };
    // ctx stand-in must tolerate save/translate/scale/restore (the Proxy already returns functions)
    ...
    expect(figures).toHaveLength(20);
    expect(new Set(figures.map((f) => f.name)).size).toBe(20);
```
`tests/atlas.test.ts`: the two tests that use `soldier_rifle_ne` and `soldier_rifle_n` sprite names switch to `item_rifle` (an asymmetric sprite) and the mirrored-pixel assertion still holds; nothing else changes.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sprites.test.ts tests/gallery.test.ts tests/atlas.test.ts`
Expected: FAIL (still 41 sprites; gallery draws no figures).

- [ ] **Step 3: Implement**

`src/art/sprites.ts`: delete the `BODY`, `WEAPON_AT`, `armed`, `FIGHTERS` code, the `View` type if unused, and the 20 soldier/enemy names in `SPRITE_NAMES` and the `...FIGHTERS` spread in `SPRITE_ROWS`. Keep `ENEMY_COLOURS` (used by `corpse_enemy`). Remove now-unused imports. `src/art/sprite.ts`: delete `unitSprite`, `FACING_SUFFIX`, and the `Facing, Side, WeaponId` imports if unused. `src/art/gallery.ts`: after the sprite grid add
```ts
  const views = ['n', 'ne', 'e', 'se', 's'] as const;
  const rows: [number, 'rifle' | 'pistol'][] = [[176, 'rifle'], [246, 'pistol']];
  for (const [y, weapon] of rows) {
    ['squad', 'enemy'].forEach((side, s) => {
      views.forEach((view, v) => {
        const x = 4 + (s * 5 + v) * 44;
        ctx.fillStyle = '#2a2f45';
        ctx.fillRect(x, y, 32, FIGURE_H * 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(2, 2);
        art.drawFigure(ctx, armedFigure(side as 'squad' | 'enemy', view, weapon), 0, 0);
        ctx.restore();
      });
    });
  }
```
(import `FIGURE_H, armedFigure` from `./figure`; the canvas is 480 wide: 10 cells x 44 = 440 fits; the figures are 66 px tall so row 2 ends at y 312, above the sample text at 352).

- [ ] **Step 4: Run the suite and look at the gallery**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. Then start the dev server (`preview_start laser-tribute-dev`), open the dev gallery (see `src/main.ts` for how `gallery` is reached, a query string), screenshot, and check both sides, five views, rifle and pistol, in the browser pane. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "refactor: drop the 16 px soldier sprites; the gallery shows the figures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Hit-testing a figure's opaque pixels

**Files:**
- Create: `src/render/hit.ts`
- Test: `tests/hit.test.ts`

**Interfaces:**
- Consumes: `unitFigure`, `figureMask`, `FIGURE_W`, `FIGURE_H`, `RISE` (Task 3); `originOf`, `Camera` (`src/render/camera.ts`); `visibleToSide` (`src/core/vision.ts`); `Layout` (`src/ui/layout.ts`).
- Produces: `unitAtScreen(state: GameState, camera: Camera, layout: Layout, px: number, py: number): Unit | null` — null outside the map rectangle; otherwise the first living unit, front first (largest tile row, then smaller x), whose figure (weapon and flip included) has an opaque pixel at the point, squad always and enemies only when their tile is in view; the figure of a unit stands at `(pos.x * 16, pos.y * 16 - RISE)` in world pixels, using the logical position (not the animation offset).

- [ ] **Step 1: Write the failing tests**

`tests/hit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FIGURE_H, FIGURE_W, RISE, figureMask, unitFigure } from '../src/art/figure';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState, Unit } from '../src/core/types';
import { createCamera, tileToScreen } from '../src/render/camera';
import { unitAtScreen } from '../src/render/hit';
import { computeLayout } from '../src/ui/layout';

const layout = computeLayout(480, 400, 1);

function setup() {
  const state = createMission(MISSIONS[0], 1);
  const camera = createCamera(layout, state.width, state.height);
  return { state, camera };
}

/** The screen point of figure pixel (lx, ly) of a unit (the middle of that pixel). */
function screenOf(state: GameState, camera: ReturnType<typeof createCamera>, u: Unit, lx: number, ly: number) {
  const s = tileToScreen(camera, layout, state.width, state.height, u.pos);
  const k = s.tile / 16;
  return { x: s.x + (lx + 0.5) * k, y: s.y + (ly - RISE + 0.5) * k };
}

function maskOf(u: Unit) {
  const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
  return figureMask(figure, flip);
}

function pixel(mask: Uint8Array, want: 0 | 1, from = 0) {
  for (let i = from; i < mask.length; i++) if (mask[i] === want) return { lx: i % FIGURE_W, ly: Math.floor(i / FIGURE_W) };
  throw new Error('no such pixel');
}

describe('unitAtScreen', () => {
  it('hits a soldier on an opaque pixel of his head, which lies over the tile above', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const head = pixel(maskOf(p), 1); // the first opaque pixel is at the top of the figure
    expect(head.ly).toBeLessThan(RISE); // in the part above the feet tile
    const pt = screenOf(state, camera, p, head.lx, head.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p1');
  });

  it('falls through on a transparent pixel inside the figure rectangle', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const gap = pixel(maskOf(p), 0); // the top-left pixel of the rectangle is empty
    const pt = screenOf(state, camera, p, gap.lx, gap.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)).toBeNull();
  });

  it('uses the mirrored mask for a mirrored facing', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    p.facing = 6; // west: the mirror of east
    const { figure } = unitFigure(p.side, p.facing, p.weapon);
    const plain = figureMask(figure, false);
    const flipped = figureMask(figure, true);
    let found: { lx: number; ly: number } | null = null;
    for (let i = 0; i < plain.length && !found; i++) {
      if (flipped[i] === 1 && plain[i] === 0) found = { lx: i % FIGURE_W, ly: Math.floor(i / FIGURE_W) };
    }
    expect(found).not.toBeNull();
    const pt = screenOf(state, camera, p, found!.lx, found!.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p1');
  });

  it('picks the figure in front when two overlap', () => {
    const { state, camera } = setup();
    const back = state.units.find((u) => u.id === 'p1')!;
    const front = state.units.find((u) => u.id === 'p2')!;
    back.pos = { x: 5, y: 10 };
    front.pos = { x: 5, y: 11 }; // one row lower: in front, his head overlaps the back figure's legs
    const a = maskOf(back);
    const b = maskOf(front);
    let both: { x: number; y: number } | null = null; // a world pixel opaque in both figures
    for (let ly = 0; ly < FIGURE_H && !both; ly++) {
      for (let lx = 0; lx < FIGURE_W && !both; lx++) {
        const wy = back.pos.y * 16 - RISE + ly; // the same world pixel in the front figure's own rows
        const fy = wy - (front.pos.y * 16 - RISE);
        if (fy >= 0 && fy < FIGURE_H && a[ly * FIGURE_W + lx] === 1 && b[fy * FIGURE_W + lx] === 1) both = { x: lx, y: ly };
      }
    }
    expect(both).not.toBeNull();
    const pt = screenOf(state, camera, back, both!.x, both!.y);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p2');
  });

  it('never hits an enemy that is out of sight, and hits one that is seen', () => {
    const { state, camera } = setup();
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.pos = { x: 28, y: 5 }; // far away, in the dark
    const body = pixel(maskOf(enemy), 1);
    let pt = screenOf(state, camera, enemy, body.lx, body.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)).toBeNull();
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    pt = screenOf(state, camera, enemy, body.lx, body.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe(enemy.id);
  });

  it('ignores the dead and points outside the map rectangle', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const body = pixel(maskOf(p), 1);
    const pt = screenOf(state, camera, p, body.lx, body.ly);
    p.alive = false;
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)).toBeNull();
    p.alive = true;
    expect(unitAtScreen(state, camera, layout, layout.map.x + layout.map.w + 5, 10)).toBeNull();
  });

  it('uses the logical position: a sliding unit is hit where it stands, not where it is drawn', () => {
    // the renderer adds a move offset; unitAtScreen takes none, so the hit is always at pos
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const body = pixel(maskOf(p), 1);
    const pt = screenOf(state, camera, p, body.lx, body.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/hit.test.ts`
Expected: FAIL (`src/render/hit` not found).

- [ ] **Step 3: Implement**

`src/render/hit.ts`:
```ts
import { FIGURE_H, FIGURE_W, RISE, figureMask, unitFigure } from '../art/figure';
import { CONFIG } from '../core/config';
import type { GameState, Unit } from '../core/types';
import { visibleToSide } from '../core/vision';
import type { Layout } from '../ui/layout';
import { originOf, type Camera } from './camera';

const T = CONFIG.tileSize;

/**
 * The unit whose figure has an opaque pixel under a screen point, or null. Figures stand about two tiles tall, so the
 * head of a unit is over the tile above his feet; the opaque pixels count as the unit, the front figure (lowest tile
 * row) wins, and enemies count only when their tile is in view. The unit's logical tile is used, not any animation offset.
 */
export function unitAtScreen(state: GameState, camera: Camera, layout: Layout, px: number, py: number): Unit | null {
  const m = layout.map;
  if (px < m.x || py < m.y || px >= m.x + m.w || py >= m.y + m.h) return null;
  const o = originOf(camera, layout, state.width, state.height);
  const k = o.tile / T;
  const wx = (px - o.x) / k;
  const wy = (py - o.y) / k;
  const front = state.units
    .filter((u) => u.alive && (u.side === 'player' || visibleToSide(state, 'player', u.pos)))
    .sort((a, b) => b.pos.y - a.pos.y || a.pos.x - b.pos.x);
  for (const u of front) {
    const lx = Math.floor(wx - u.pos.x * T);
    const ly = Math.floor(wy - (u.pos.y * T - RISE));
    if (lx < 0 || ly < 0 || lx >= FIGURE_W || ly >= FIGURE_H) continue;
    const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
    if (figureMask(figure, flip)[ly * FIGURE_W + lx] === 1) return u;
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/hit.test.ts && npx tsc --noEmit`
Expected: PASS. If the "overlap" test cannot find a world pixel opaque in both figures (the legs and the head do not overlap at these positions), move the front unit one row up (`y: 10`) and the back to row 11 swapped so the rows overlap by the figure rise, and keep the assertion that the lower unit (larger y) wins; record the setup in the ledger.

- [ ] **Step 5: Commit**

```bash
git add src/render/hit.ts tests/hit.test.ts
git commit -m "feat: the opaque pixels of a figure count as the unit under the pointer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Clicking and hovering figures in the App

**Files:**
- Modify: `src/app.ts`
- Test: `tests/figureclick.test.ts` (new)

**Interfaces:**
- Consumes: `unitAtScreen` (Task 8).
- Produces: in `App.click`, `case 'mission'`: after the cancel, sound, squad-strip and panel-button checks and before `screenToTile`: `const hit = unitAtScreen(c.state, this.camera, L, p.x, p.y); if (hit) { c.clickTile(hit.pos, pointer === 'touch'); return; }`; in `App.move`: `c.hover(unitAtScreen(...)?.pos ?? screenToTile(...))`. The `longPress` map-area check keeps using `screenToTile`. The controller, the core and the panel hit-tests are unchanged.

- [ ] **Step 1: Write the failing tests**

`tests/figureclick.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { FIGURE_W, RISE, figureMask, unitFigure } from '../src/art/figure';
import { createMission, MISSIONS } from '../src/core/missions';
import type { Unit } from '../src/core/types';
import { tileToScreen } from '../src/render/camera';

const START = { x: 240, y: 345 };

function inMission() {
  let t = 0;
  const app = new App({ clock: () => t, skipTitle: true, store: null, createMission: (def, seed, roster, loadout, budget, stash) => createMission(def, seed, roster, loadout, budget, stash) });
  app.click(START);
  t += 500;
  return { app, wait: () => { t += 500; } };
}

/** The screen point of an opaque pixel of the unit's figure that lies in the part above his feet tile. */
function headPoint(app: App, u: Unit) {
  const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
  const mask = figureMask(figure, flip);
  let i = 0;
  while (mask[i] === 0) i++;
  const lx = i % FIGURE_W;
  const ly = Math.floor(i / FIGURE_W);
  expect(ly).toBeLessThan(RISE);
  const c = app.controller!;
  const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, u.pos);
  const k = s.tile / 16;
  return { x: s.x + (lx + 0.5) * k, y: s.y + (ly - RISE + 0.5) * k };
}

describe('clicking and hovering a figure', () => {
  it('selects a soldier when his head is clicked, though the head is over the tile above', () => {
    const { app, wait } = inMission();
    const c = app.controller!;
    expect(c.ui.selectedId).toBe('p1');
    const p2 = c.state.units.find((u) => u.id === 'p2')!;
    const pt = headPoint(app, p2);
    wait();
    app.click(pt);
    expect(c.ui.selectedId).toBe('p2');
  });

  it('hovers the feet tile when the pointer is over the head', () => {
    const { app } = inMission();
    const c = app.controller!;
    const p2 = c.state.units.find((u) => u.id === 'p2')!;
    app.move(headPoint(app, p2));
    expect(c.ui.hover).toEqual(p2.pos);
  });

  it('still uses the tile under the pointer when no figure is hit', () => {
    const { app, wait } = inMission();
    const c = app.controller!;
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, { x: 12, y: 12 });
    wait();
    app.move({ x: s.x + s.tile / 2, y: s.y + s.tile / 2 });
    expect(c.ui.hover).toEqual({ x: 12, y: 12 });
  });

  it('a first touch tap on a figure of another soldier selects him; it does not start a move preview', () => {
    const { app, wait } = inMission();
    const c = app.controller!;
    const p2 = c.state.units.find((u) => u.id === 'p2')!;
    wait();
    app.click(headPoint(app, p2), 'touch');
    expect(c.ui.selectedId).toBe('p2');
    expect(c.ui.pendingTile).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/figureclick.test.ts`
Expected: FAIL (the head click hits the tile above and selects nobody; hover is the tile above).

- [ ] **Step 3: Implement**

In `src/app.ts`: add `import { unitAtScreen } from './render/hit';`. In `click`, `case 'mission'`, replace
```ts
        const t = screenToTile(this.camera, L, c.state.width, c.state.height, p.x, p.y);
        if (t) c.clickTile(t, pointer === 'touch');
        return;
```
with
```ts
        const hit = unitAtScreen(c.state, this.camera, L, p.x, p.y);
        if (hit) {
          c.clickTile(hit.pos, pointer === 'touch'); // a figure counts as his feet tile
          return;
        }
        const t = screenToTile(this.camera, L, c.state.width, c.state.height, p.x, p.y);
        if (t) c.clickTile(t, pointer === 'touch');
        return;
```
and in `move` replace the `c.hover(...)` line with
```ts
      const hit = unitAtScreen(c.state, this.camera, this.layout, p.x, p.y);
      c.hover(hit ? hit.pos : screenToTile(this.camera, this.layout, c.state.width, c.state.height, p.x, p.y));
```

- [ ] **Step 4: Run to verify it passes, then the whole suite**

Run: `npx vitest run tests/figureclick.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS. If a test in `tests/mobileapp.test.ts` or `tests/app.test.ts` clicks a tile that is now covered by a figure's opaque pixels (a tile directly above a soldier), fix the test by clicking the tile's lowest corner pixel or a different tile and record a Ruling in the ledger; do not change the hit rules.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts tests/figureclick.test.ts
git commit -m "feat: clicking or hovering a figure acts on that unit" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Check it in the real game

**Files:**
- Production changes only if a bug shows up (failing test first).

- [ ] **Step 1: Everything green**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all tests pass (1209 plus the new ones), tsc clean, build succeeds (note the bundle size change in the ledger).

- [ ] **Step 2: Look at the game**

Start the dev server (`preview_start` with the `laser-tribute-dev` entry). In the browser pane: start a tutorial mission and take screenshots at desktop size and at 375x812 (mobile preset). Check: soldiers stand two tiles tall with their feet on their tile; the squad is distinguishable from the floor (note the contrast honestly); the selected soldier has the yellow box on his feet tile; the health bar floats above the head; rifle and pistol point the way each soldier faces; clicking a soldier's head selects him; hovering a head highlights his feet tile; moving a soldier slides the whole figure; an enemy in view is red-uniformed. Read the console for errors. Reset the viewport to desktop, clear `localStorage`, stop the server.

- [ ] **Step 3: Record and finish**

Write the observations (contrast, any overlap oddities, bundle size) into the ledger for the final review. Any bug found: reproduce in a failing test, fix, rerun the suite, ledger it.

---

## Self-review

- **Spec coverage:** sources and converter (Tasks 1, 2); `Figure`, weapon overlay, masks, anchor (Task 3); atlas baking (Task 4); draw order, health bar, alert, pips, selection, border-row head (Task 5); aim point (Task 6); old sprites removed and gallery (Task 7); hit-testing and its rules (Task 8); App wiring (Task 9); real-game check (Task 10). Not covered by design: tiles, items, effects, corpses, animations, palette remap.
- **Placeholders:** none, except the enemy character id in the README which Task 1 fills from the generation, and the weapon-hand numbers, which Task 3 step 4 tunes by eye with tests that constrain them.
- **Deviation from the spec, recorded here:** the converter aligns each view's own feet to the bottom row and crops to the tallest view, instead of one union box, so every view stands on the ground.
- **Type consistency:** `Figure`, `FigureView`, `FigureSide`, `armedFigure`, `bodyFigure`, `figureMask`, `flipFigure`, `unitFigure`, `WEAPON_AT`, `RISE`, `FIGURE_W/H`, `Atlas.drawFigure`, `aimPoint`, `unitAtScreen`, `pipPositions` are used with the same names and signatures in every task.
- **Review Focus coverage:** (1) Task 8 overlap test and Task 9 head click; (2) Task 5 first-row test; (3) Task 8 logical-position test; (4) Task 5 fog test; (5) Task 9 touch test.
