# Laser Tribute Milestone 14: Mobile Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-playable mission screen in portrait and landscape: a full-window canvas, a scrolling camera at touch-size tiles, a layout-driven panel with touch-size buttons and a squad strip, a TURN mode (tap where to face), pointer-event input (tap, drag-pan, long-press), and a two-tap move preview on touch. Desktop keeps every key and gesture.

**Architecture:** Two new pure modules (`src/ui/layout.ts` for rectangles, `src/render/camera.ts` for the map view) plus a pure gesture recognizer (`src/input/gestures.ts`). The renderer draws the world through one camera transform and clips to the map rectangle; the panel draws from the layout; `App` owns layout and camera and routes pointer positions. Menus keep their 480x400 drawing, scaled and centred ("contain"). Nothing in `src/core` changes.

**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-05-laser-tribute-milestone14-design.md`

## Global Constraints

- `src/core`, saves, the AI, sound recipes and sprites are untouched. Layout, camera and gestures are pure and deterministic (no `window`, no `Date.now`).
- All layout and pointer coordinates are CSS pixels (the canvas fills the window); `App.draw` sets the context transform to the device pixel ratio first. Menus draw in the 480x400 logical space through a contain transform; pointer positions are mapped back before the existing hit tests.
- Touch size: action buttons at least 44 CSS px tall where the window allows, floor 36; text drawn with an integer device-pixel scale chosen so every label fits.
- `new App()` with no size defaults to 480x400 at dpr 1, which keeps the menu transform an identity, so existing App tests that click menu coordinates keep working.
- `drawGame` and `drawPanel` keep their old argument lists working: the new `view`/`layout` parameters are optional and default to the layout of a 480x400 window.
- Desktop keys keep working: Q/E, 1-4, Tab, Escape, right-click, M, -, =, and every action key; new keys `F` (turn) and `Z` (zoom).
- Run `npx tsc --noEmit` before every commit. Create files with the Write tool or a small script file, never with long combined shell commands.
- New test files: `tests/uitext.test.ts`, `tests/uilayout.test.ts`, `tests/camera.test.ts`, `tests/gestures.test.ts`, `tests/mobilepanel.test.ts`, `tests/mobileapp.test.ts` (check each name is free with `ls tests`); otherwise append to or update existing files, never overwrite one. `tests/maplayout.test.ts` is replaced by camera tests (the fixed `screenToTile` goes away).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Pointer positions map to the intended tile at every camera position and zoom (round trip), including after resize and rotation; a tap on a button never also hits the map under or behind it; a drag never fires a tap; a long press never also taps.
- No overlap between interactive rectangles, every label fits its button, buttons reach the touch size in portrait phones, and the panel never covers the map (portrait) or the camera never scrolls the map under the panel.
- The world transform: effects, health bars, markers and the selection box share it; the clip stops everything at the map edge; the panel and menus are unaffected by it.
- TURN: all eight directions from the soldier to the tapped tile, shortest rotation cost, no-op when already facing, refusal with too little AP, leaving the mode by own tile or CANCEL; two-tap preview only for touch pointers, cleared by every other tap, mode change, selection change, resize and turn end.
- Camera follow: recentres on selection, on the end of a move, and during the enemy turn (visible events), but not after a manual drag until the next selection or move.
- Desktop regression: mouse hover preview and one-click moves, keyboard everything, menus identical (the 480x400 contain transform is an identity at that size).
- Page behaviour: no scroll, zoom or pull-to-refresh from touches; safe areas respected; resize and rotation keep the game running.

## File Structure

- Create `src/ui/layout.ts`, `src/render/camera.ts`, `src/input/gestures.ts`.
- Modify `src/ui/text.ts`, `src/render/renderer.ts`, `src/render/panel.ts`, `src/render/layout.ts` (keeps `VIEW`; `screenToTile` removed), `src/input/uiState.ts`, `src/controller.ts`, `src/app.ts`, `src/input/input.ts`, `src/main.ts`, `index.html`.
- Tests: new files listed above; update `tests/panel.test.ts`, `tests/gadgetpanel.test.ts`, `tests/critfeedback.test.ts`, `tests/layout.test.ts`; delete `tests/maplayout.test.ts`.

---

### Task 1: Scaled text

**Files:**
- Modify: `src/ui/text.ts`
- Test: create `tests/uitext.test.ts`

**Interfaces:**
- Produces: `drawText(ctx, text, x, y, colour, align = 'left', atlas = defaultFont, scale = 1)`; `FontAtlas.draw(ctx, text, x, y, colour, align, scale)`; the `onText` run's `width` is `textWidth(text) * scale`; `scaledWidth(text, scale)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/uitext.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CanvasLike } from '../src/art/atlas';
import { textWidth } from '../src/ui/font';
import { FontAtlas, drawText, onText, scaledWidth } from '../src/ui/text';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

describe('scaled text', () => {
  it('scaledWidth is the unscaled width times the scale', () => {
    expect(scaledWidth('ABC', 1)).toBe(textWidth('ABC'));
    expect(scaledWidth('ABC', 3)).toBe(textWidth('ABC') * 3);
  });

  it('onText reports the scaled width', () => {
    const runs: number[] = [];
    const stop = onText((r) => runs.push(r.width));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawText(ctx, 'AB', 0, 0, '#fff', 'left', undefined, 2);
    stop();
    expect(runs).toEqual([textWidth('AB') * 2]);
  });

  it('draws each glyph at the scale: size and spacing multiply, and a glyph is still baked once', () => {
    let baked = 0;
    const atlas = new FontAtlas((w, h) => { baked += 1; return new FakeCanvas(w, h); });
    const calls: number[][] = [];
    const ctx = { drawImage: (_g: unknown, x: number, y: number, w?: number, h?: number) => calls.push([x, y, w ?? -1, h ?? -1]) } as unknown as CanvasRenderingContext2D;
    atlas.draw(ctx, 'AA', 10, 20, '#fff', 'left', 2);
    expect(calls).toHaveLength(2);
    expect(calls[0].slice(2)).toEqual([10, 14]); // 5x7 glyph at scale 2
    expect(calls[1][0] - calls[0][0]).toBe(12); // advance 6 at scale 2
    expect(baked).toBe(1);
  });

  it('right and centre alignment use the scaled width', () => {
    const calls: number[] = [];
    const ctx = { drawImage: (_g: unknown, x: number) => calls.push(x) } as unknown as CanvasRenderingContext2D;
    const atlas = new FontAtlas((w, h) => new FakeCanvas(w, h));
    atlas.draw(ctx, 'AB', 100, 0, '#fff', 'right', 2);
    expect(calls[0]).toBe(100 - textWidth('AB') * 2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/uitext.test.ts`
Expected: FAIL (`scaledWidth` not exported, scale ignored).

- [ ] **Step 3: Implement**

In `src/ui/text.ts`: add `export const scaledWidth = (text: string, scale = 1): number => textWidth(text) * scale;`. Change `FontAtlas.draw` to take `scale = 1` after `align`, compute `const width = textWidth(text) * scale;`, `start` as before from that width, and draw each glyph with `ctx.drawImage(g as unknown as CanvasImageSource, Math.round(start + i * ADVANCE * scale), Math.round(y), GLYPH_W * scale, GLYPH_H * scale)` (when `scale === 1` the extra size arguments are harmless). Change `drawText` to accept `scale = 1` as its last parameter, report `width: textWidth(text) * scale` to the listeners, and pass `scale` to `atlas.draw`. `clipText` is unchanged (callers pass `maxPx / scale`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/text.ts tests/uitext.test.ts
git commit -m "feat: scaled pixel text"
```

---

### Task 2: The layout module

**Files:**
- Create: `src/ui/layout.ts`
- Test: create `tests/uilayout.test.ts`

**Interfaces:**
- Produces: `Rect`; `ActionId` (`'snap' | 'aimed' | 'throw' | 'stab' | 'reload' | 'door' | 'pickup' | 'alert' | 'gadget' | 'turn' | 'zoom' | 'end'`); `ACTIONS: readonly { id: ActionId; label: string; key: string }[]` (12 entries, that order); `Layout`; `computeLayout(width, height, dpr = 1): Layout`; `LEGACY_SIZE = { width: 480, height: 400 }`.

```ts
export interface Rect { x: number; y: number; w: number; h: number }
export interface LayoutButton { id: ActionId; label: string; key: string; rect: Rect }
export interface Layout {
  width: number; height: number; dpr: number;
  orientation: 'landscape' | 'portrait';
  map: Rect;                 // where the map is drawn (CSS px)
  panel: Rect;               // the panel background
  overlay: boolean;          // status and detail are drawn over the map (landscape) instead of in the panel
  status: Rect; detail: Rect; cancel: Rect; sound: Rect;
  squad: Rect[];             // always 4
  actions: LayoutButton[];   // always 12, ACTIONS order
  text: number;              // text scale in CSS px per font pixel (device integer scale / dpr)
}
```

- [ ] **Step 1: Write the failing tests**

Create `tests/uilayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { textWidth } from '../src/ui/font';
import { ACTIONS, computeLayout, type Layout, type Rect } from '../src/ui/layout';

const SIZES: [number, number, number][] = [
  [320, 568, 2], [375, 812, 3], [390, 844, 3], [844, 390, 3], [812, 375, 3], [1024, 768, 2], [1366, 768, 1], [1920, 1080, 1], [480, 400, 1],
];

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, w: number, h: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.001 && r.y + r.h <= h + 0.001;

function interactive(l: Layout): { name: string; rect: Rect }[] {
  return [
    ...l.actions.map((a) => ({ name: a.id, rect: a.rect })),
    ...l.squad.map((r, i) => ({ name: `squad${i}`, rect: r })),
    { name: 'cancel', rect: l.cancel },
    { name: 'sound', rect: l.sound },
  ];
}

describe('the action list', () => {
  it('has the twelve actions in the agreed order', () => {
    expect(ACTIONS.map((a) => a.id)).toEqual([
      'snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'gadget', 'turn', 'zoom', 'end',
    ]);
  });
});

describe.each(SIZES)('computeLayout %i x %i at dpr %i', (w, h, dpr) => {
  const l = computeLayout(w, h, dpr);

  it('has 12 actions and 4 squad buttons, all inside the window', () => {
    expect(l.actions).toHaveLength(12);
    expect(l.squad).toHaveLength(4);
    for (const it of interactive(l)) expect(inside(it.rect, w, h), it.name).toBe(true);
    expect(inside(l.map, w, h)).toBe(true);
    expect(inside(l.panel, w, h)).toBe(true);
  });

  it('no two interactive rectangles overlap', () => {
    const items = interactive(l);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        expect(overlap(items[i].rect, items[j].rect), `${items[i].name} overlaps ${items[j].name}`).toBe(false);
      }
    }
  });

  it('the map and the panel do not overlap, and the map is not tiny', () => {
    expect(overlap(l.map, l.panel)).toBe(false);
    expect(l.map.w).toBeGreaterThan(w * 0.5);
    expect(l.map.h).toBeGreaterThan(h * 0.4);
  });

  it('buttons are touch size where the window allows (44 px, never below 32)', () => {
    for (const a of l.actions) {
      expect(a.rect.h, a.id).toBeGreaterThanOrEqual(32);
      if (Math.min(w, h) >= 375 && w < h) expect(a.rect.h, a.id).toBeGreaterThanOrEqual(40);
    }
  });

  it('every label fits its button at the chosen text scale', () => {
    for (const a of l.actions) expect(textWidth(a.label) * l.text + 6, a.id).toBeLessThanOrEqual(a.rect.w);
    expect(l.text).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(computeLayout(w, h, dpr)).toEqual(l);
  });
});

describe('orientation', () => {
  it('portrait phones put the panel below the map, landscape phones put it on the right', () => {
    const p = computeLayout(390, 844, 3);
    expect(p.orientation).toBe('portrait');
    expect(p.panel.y).toBeGreaterThanOrEqual(p.map.y + p.map.h - 0.001);
    expect(p.overlay).toBe(false);
    const ls = computeLayout(844, 390, 3);
    expect(ls.orientation).toBe('landscape');
    expect(ls.panel.x).toBeGreaterThanOrEqual(ls.map.x + ls.map.w - 0.001);
    expect(ls.overlay).toBe(true);
  });

  it('large desktop windows use the bottom panel', () => {
    const d = computeLayout(1366, 768, 1);
    expect(d.orientation).toBe('portrait');
    expect(d.panel.y).toBeGreaterThan(d.map.y);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/uilayout.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/ui/layout.ts`**

Write the module exactly as the interface above, with these rules (all CSS px; `PAD = 6`, `GAP = 4`):

```ts
import { textWidth } from './font';

export const LEGACY_SIZE = { width: 480, height: 400 } as const;

export const ACTIONS = [
  { id: 'snap', label: 'SNAP', key: 'S' }, { id: 'aimed', label: 'AIM', key: 'A' }, { id: 'throw', label: 'THROW', key: 'T' },
  { id: 'stab', label: 'STAB', key: 'K' }, { id: 'reload', label: 'RELOAD', key: 'R' }, { id: 'door', label: 'DOOR', key: 'D' },
  { id: 'pickup', label: 'TAKE', key: 'P' }, { id: 'alert', label: 'ALERT', key: 'L' }, { id: 'gadget', label: 'GADGET', key: 'G' },
  { id: 'turn', label: 'TURN', key: 'F' }, { id: 'zoom', label: 'ZOOM', key: 'Z' }, { id: 'end', label: 'END TURN', key: 'SPC' },
] as const;
export type ActionId = (typeof ACTIONS)[number]['id'];
```

(plus the `Rect`, `LayoutButton`, `Layout` types above.)

`computeLayout(width, height, dpr = 1)`:
1. `landscape = width >= height * 1.15 && Math.min(width, height) < 700`.
2. **Portrait (and desktop):** `cols = width < 520 ? 4 : 6`, `rows = 12 / cols`; `bh = width < 520 ? 44 : 40`; `stripH = 38`, `statusH = 20`, `detailH = 16`. `panelH(bh) = PAD + statusH + GAP + detailH + GAP + stripH + GAP + rows * bh + (rows - 1) * GAP + PAD`. While `panelH(bh) > height * 0.45 && bh > 32` decrease `bh` by 2. `map = { 0, 0, width, height - panelH }`, `panel = { 0, height - panelH, width, panelH }`, `overlay = false`. Inside the panel from the top (`y0 = panel.y + PAD`): `status` row (full width minus PAD, height `statusH`), `detail`, the `squad` row (4 equal buttons across the width, `stripH` tall), then the action grid (equal columns across the width, rows of `bh`). `sound` is a `28 x statusH` rect at the right end of the status row and `cancel` is an `80 x statusH` rect immediately to its left (the status text area is what remains).
3. **Landscape:** `colW = clamp(round(width * 0.24), 150, 220)`; `map = { 0, 0, width - colW, height }`; `panel = { width - colW, 0, colW, height }`; `overlay = true`. `status = { PAD, PAD, map.w - 2 * PAD - 28 - GAP - 80 - GAP, 20 }` with `sound` and `cancel` to its right inside the map; `detail = { PAD, map.h - 16 - PAD, map.w - 2 * PAD, 16 }`. In the column: `squad` as a 2x2 grid of `34`-tall buttons from `PAD`; then the actions as 2 columns x 6 rows, with `bh = clamp(floor((height - 2 * PAD - 2 * 34 - 2 * GAP - 6 * GAP) / 6), 32, 44)`.
4. **Text scale:** `text = chooseText(buttons, dpr)`: the cap is `Math.max(1, Math.round((14 * dpr) / 7))` device pixels per font pixel; walk down from the cap to 1 and take the first `s` for which `textWidth(label) * (s / dpr) + 6 <= rect.w` for every action label; return `s / dpr`.

Return `{ width, height, dpr, orientation, map, panel, overlay, status, detail, cancel, sound, squad, actions, text }`. Write `clamp` locally. If a size produces overlapping or out-of-window rectangles in the tests, fix the arithmetic (not the tests) and ledger the change as a Ruling.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/uilayout.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/layout.ts tests/uilayout.test.ts
git commit -m "feat: responsive layout for the mission screen"
```

---

### Task 3: The camera module

**Files:**
- Create: `src/render/camera.ts`
- Test: create `tests/camera.test.ts`; delete `tests/maplayout.test.ts` and remove `screenToTile` from `src/render/layout.ts` in Task 5 (not here: this task only adds)

**Interfaces:**
- Consumes: `Layout`, `Rect` (Task 2).
- Produces:

```ts
export type Zoom = 'close' | 'whole';
export interface Camera { cx: number; cy: number; zoom: Zoom; follow: boolean }
export function tileCss(layout: Layout, zoom: Zoom, mapW: number, mapH: number): number
export function defaultZoom(layout: Layout, mapW: number, mapH: number): Zoom
export function createCamera(layout: Layout, mapW: number, mapH: number): Camera
export function clampCamera(cam: Camera, layout: Layout, mapW: number, mapH: number): Camera
export function followTile(cam: Camera, pos: Pos, layout: Layout, mapW: number, mapH: number): Camera
export function panBy(cam: Camera, dxCss: number, dyCss: number, layout: Layout, mapW: number, mapH: number): Camera
export function setZoom(cam: Camera, zoom: Zoom, layout: Layout, mapW: number, mapH: number): Camera
export function originOf(cam: Camera, layout: Layout, mapW: number, mapH: number): { x: number; y: number; tile: number }
export function screenToTile(cam: Camera, layout: Layout, mapW: number, mapH: number, px: number, py: number): Pos | null
export function tileToScreen(cam: Camera, layout: Layout, mapW: number, mapH: number, t: Pos): { x: number; y: number; tile: number }
```

Rules: `tileCss` for `'whole'` is the largest tile size (a multiple of `1 / dpr`) at which the whole map fits the map rectangle, never below 4 CSS px; for `'close'` it is `max(wholeTile, closeTarget)` where `closeTarget` is `32 * clamp(floor(min(width, height) / 400), 1, 3)` rounded to a device-integer scale (`round(target * dpr / 16) * 16 / dpr`). `defaultZoom` is `'whole'` when the whole tile is at least 28 CSS px, else `'close'`. A centre is clamped so the map never leaves the map rectangle; when the map fits on an axis that axis is fixed at the map centre. `followTile` sets the centre on the tile and clamps, and sets `follow: true`; `panBy` shifts the centre by `-dx / tile` and `-dy / tile`, clamps and sets `follow: false`; `setZoom` keeps the tile at the map-rectangle centre fixed. `originOf` returns the screen position of tile (0, 0) and the tile size: `x = map.x + map.w / 2 - cx * tile`. `screenToTile` returns null outside the map rectangle or outside the map.

- [ ] **Step 1: Write the failing tests**

Create `tests/camera.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clampCamera, createCamera, defaultZoom, followTile, originOf, panBy, screenToTile, setZoom, tileCss, tileToScreen,
} from '../src/render/camera';
import { computeLayout } from '../src/ui/layout';

const W = 30;
const H = 20;
const phone = computeLayout(390, 844, 3);
const wide = computeLayout(1366, 768, 1);

describe('tile size and default zoom', () => {
  it('a phone shows 32 px tiles close up and chooses close; a desktop fits the whole map large', () => {
    expect(tileCss(phone, 'close', W, H)).toBeGreaterThanOrEqual(32);
    expect(tileCss(phone, 'whole', W, H)).toBeLessThan(20);
    expect(defaultZoom(phone, W, H)).toBe('close');
    expect(tileCss(wide, 'whole', W, H) * W).toBeLessThanOrEqual(wide.map.w + 0.001);
    expect(tileCss(wide, 'whole', W, H) * H).toBeLessThanOrEqual(wide.map.h + 0.001);
    expect(defaultZoom(wide, W, H)).toBe('whole');
  });

  it('close is never smaller than whole', () => {
    expect(tileCss(wide, 'close', W, H)).toBeGreaterThanOrEqual(tileCss(wide, 'whole', W, H));
  });
});

describe('screen and tile mapping', () => {
  it('round-trips every tile centre at several camera positions and both zooms', () => {
    for (const zoom of ['close', 'whole'] as const) {
      let cam = { ...createCamera(phone, W, H), zoom };
      for (const pos of [{ x: 0, y: 0 }, { x: 15, y: 10 }, { x: 29, y: 19 }]) {
        cam = followTile(cam, pos, phone, W, H);
        for (const t of [{ x: 2, y: 3 }, { x: 14, y: 9 }, { x: 28, y: 18 }]) {
          const s = tileToScreen(cam, phone, W, H, t);
          const inMap = s.x >= phone.map.x && s.x + s.tile <= phone.map.x + phone.map.w && s.y >= phone.map.y && s.y + s.tile <= phone.map.y + phone.map.h;
          if (!inMap) continue;
          expect(screenToTile(cam, phone, W, H, s.x + s.tile / 2, s.y + s.tile / 2)).toEqual(t);
        }
      }
    }
  });

  it('returns null outside the map rectangle and outside the map', () => {
    const cam = createCamera(wide, W, H);
    expect(screenToTile(cam, wide, W, H, -1, 5)).toBeNull();
    expect(screenToTile(cam, wide, W, H, 10, wide.map.y + wide.map.h + 5)).toBeNull(); // the panel
    const o = originOf(cam, wide, W, H);
    expect(screenToTile(cam, wide, W, H, o.x + W * o.tile + 2, o.y + 2)).toBeNull(); // right of the map
  });
});

describe('clamping, following and panning', () => {
  it('never lets the map edge leave the screen, and fixes an axis the map fits on', () => {
    const cam = clampCamera({ cx: -50, cy: 500, zoom: 'close', follow: true }, phone, W, H);
    const o = originOf(cam, phone, W, H);
    expect(o.x).toBeLessThanOrEqual(phone.map.x + 0.001);
    expect(o.y + H * o.tile).toBeGreaterThanOrEqual(phone.map.y + phone.map.h - 0.001);
    const fit = clampCamera({ cx: 3, cy: 3, zoom: 'whole', follow: true }, wide, W, H);
    expect(fit.cx).toBeCloseTo(W / 2, 5);
    expect(fit.cy).toBeCloseTo(H / 2, 5);
  });

  it('followTile centres a soldier (clamped at the edges) and turns following on', () => {
    const cam = followTile({ ...createCamera(phone, W, H), follow: false }, { x: 15, y: 10 }, phone, W, H);
    expect(cam.follow).toBe(true);
    const s = tileToScreen(cam, phone, W, H, { x: 15, y: 10 });
    expect(Math.abs(s.x + s.tile / 2 - (phone.map.x + phone.map.w / 2))).toBeLessThan(s.tile);
    const corner = followTile(cam, { x: 0, y: 0 }, phone, W, H);
    expect(originOf(corner, phone, W, H).x).toBeCloseTo(phone.map.x, 3);
  });

  it('panBy moves the map with the finger, stops at the edges and turns following off', () => {
    const cam = followTile(createCamera(phone, W, H), { x: 15, y: 10 }, phone, W, H);
    const before = originOf(cam, phone, W, H);
    const panned = panBy(cam, 20, -30, phone, W, H);
    const after = originOf(panned, phone, W, H);
    expect(after.x - before.x).toBeCloseTo(20, 3);
    expect(after.y - before.y).toBeCloseTo(-30, 3);
    expect(panned.follow).toBe(false);
    const far = panBy(cam, 100000, 100000, phone, W, H);
    expect(originOf(far, phone, W, H).x).toBeLessThanOrEqual(phone.map.x + 0.001);
  });

  it('setZoom keeps the tile under the map centre fixed', () => {
    const cam = followTile(createCamera(phone, W, H), { x: 12, y: 8 }, phone, W, H);
    const centreTile = (c: typeof cam) => screenToTile(c, phone, W, H, phone.map.x + phone.map.w / 2, phone.map.y + phone.map.h / 2);
    const whole = setZoom(cam, 'whole', phone, W, H);
    expect(whole.zoom).toBe('whole');
    expect(centreTile(cam)).not.toBeNull();
    const back = setZoom(whole, 'close', phone, W, H);
    expect(back.zoom).toBe('close');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/camera.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/render/camera.ts`** exactly to the rules above (pure functions over `Camera`, `Layout`, map size). Use `Math.floor(x * dpr) / dpr` to snap tile sizes to device pixels.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/camera.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/render/camera.ts tests/camera.test.ts
git commit -m "feat: camera with touch-size tiles, follow, pan and zoom"
```

---

### Task 4: The gesture recognizer

**Files:**
- Create: `src/input/gestures.ts`
- Test: create `tests/gestures.test.ts`

**Interfaces:**
- Produces:

```ts
export type PointerKind = 'mouse' | 'touch' | 'pen';
export interface GestureHandlers {
  tap(p: { x: number; y: number }, kind: PointerKind): void;
  drag(dx: number, dy: number, p: { x: number; y: number }, kind: PointerKind): void;
  longPress(p: { x: number; y: number }, kind: PointerKind): void;
}
export class GestureRecognizer {
  constructor(handlers: GestureHandlers, opts?: { longMs?: number; touchSlop?: number; mouseSlop?: number });
  down(x: number, y: number, kind: PointerKind, now: number): void;
  move(x: number, y: number, now: number): void;
  up(x: number, y: number, now: number): void;
  cancel(): void;
  /** Call regularly while a pointer is down; fires the long press once. */
  tick(now: number): void;
}
```

Rules: slop 10 px for touch and pen, 4 px for mouse. A press that never leaves the slop and goes up before `longMs` (500) is a **tap**. Leaving the slop turns it into a **drag** from then on (`drag(dx, dy)` with the movement since the previous event; the first drag event includes the movement since the press, so the finger and the map stay together); no tap fires on release. A press that stays inside the slop for `longMs` fires `longPress` once from `tick` and then neither tap nor drag fires. `cancel()` resets with no event. A second `down` while one is active replaces it.

- [ ] **Step 1: Write the failing tests**

Create `tests/gestures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GestureRecognizer, type GestureHandlers } from '../src/input/gestures';

function setup() {
  const log: string[] = [];
  const handlers: GestureHandlers = {
    tap: (p, k) => log.push(`tap ${p.x},${p.y} ${k}`),
    drag: (dx, dy) => log.push(`drag ${dx},${dy}`),
    longPress: (p) => log.push(`long ${p.x},${p.y}`),
  };
  return { g: new GestureRecognizer(handlers), log };
}

describe('GestureRecognizer', () => {
  it('a short press without movement is a tap at the release position', () => {
    const { g, log } = setup();
    g.down(100, 200, 'touch', 0);
    g.up(103, 202, 120);
    expect(log).toEqual(['tap 103,202 touch']);
  });

  it('moving beyond the touch slop is a drag and fires no tap', () => {
    const { g, log } = setup();
    g.down(100, 100, 'touch', 0);
    g.move(105, 100, 20); // inside the slop: nothing yet
    expect(log).toEqual([]);
    g.move(130, 100, 40); // outside: the first drag includes the movement since the press
    g.move(140, 110, 60);
    g.up(140, 110, 80);
    expect(log).toEqual(['drag 30,0', 'drag 10,10']);
  });

  it('the mouse slop is smaller than the touch slop', () => {
    const touch = setup();
    touch.g.down(0, 0, 'touch', 0);
    touch.g.move(7, 0, 10);
    touch.g.up(7, 0, 20);
    expect(touch.log).toEqual(['tap 7,0 touch']);
    const mouse = setup();
    mouse.g.down(0, 0, 'mouse', 0);
    mouse.g.move(7, 0, 10);
    mouse.g.up(7, 0, 20);
    expect(mouse.log[0]).toBe('drag 7,0');
  });

  it('holding still fires one long press and then no tap on release', () => {
    const { g, log } = setup();
    g.down(50, 60, 'touch', 0);
    g.tick(300);
    expect(log).toEqual([]);
    g.tick(520);
    g.tick(900);
    g.up(50, 60, 950);
    expect(log).toEqual(['long 50,60']);
  });

  it('a long press is not fired once the finger has moved into a drag', () => {
    const { g, log } = setup();
    g.down(0, 0, 'touch', 0);
    g.move(40, 0, 100);
    g.tick(800);
    g.up(40, 0, 900);
    expect(log).toEqual(['drag 40,0']);
  });

  it('cancel resets without events, and a second press replaces the first', () => {
    const { g, log } = setup();
    g.down(0, 0, 'touch', 0);
    g.cancel();
    g.up(0, 0, 50);
    expect(log).toEqual([]);
    g.down(0, 0, 'touch', 100);
    g.down(9, 9, 'touch', 110);
    g.up(9, 9, 150);
    expect(log).toEqual(['tap 9,9 touch']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gestures.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/input/gestures.ts`** per the rules.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/gestures.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/input/gestures.ts tests/gestures.test.ts
git commit -m "feat: tap, drag and long-press recognizer"
```

---

### Task 5: The mission screen draws and hit-tests from the layout and camera

**Files:**
- Modify: `src/render/renderer.ts`, `src/render/panel.ts`, `src/render/layout.ts`, `src/input/uiState.ts`, `src/app.ts`
- Test: create `tests/mobilepanel.test.ts`; update `tests/panel.test.ts`, `tests/gadgetpanel.test.ts`, `tests/critfeedback.test.ts`, `tests/layout.test.ts`; delete `tests/maplayout.test.ts`

**Interfaces:**
- Consumes: `Layout`, `ACTIONS`, `computeLayout` (Task 2); `Camera`, `createCamera`, `originOf`, `tileCss`, `screenToTile` (Task 3); text scale (Task 1).
- Produces:
  - `src/render/panel.ts`: `ButtonId = ActionId`; `panelButtonAt(layout, px, py): ButtonId | null` (replaces `buttonAt`/`PANEL_BUTTONS`); `squadAt(layout, px, py): number | null`; `cancelHit(layout, px, py): boolean`; `soundHit(layout, px, py): boolean`; `drawPanel(ctx, state, ui, now, layout = DEFAULT_LAYOUT, extras = { zoom: 'whole', soundOn: true })`; `actionCost` and `actionBlocked` accept the new ids (`turn` costs `CONFIG.turnCostPer45` AP per 45 degrees and shows `1 AP`; `zoom` is never blocked).
  - `src/render/renderer.ts`: `interface MissionView { layout: Layout; camera: Camera }`; `defaultView(state)`; `drawGame(ctx, state, ui, effects, now, art = defaultAtlas, view = defaultView(state), extras?)`.
  - `src/input/uiState.ts`: `Mode` gains `'turn'`; `UiState` gains `pendingTile: Pos | null` (created as null).
  - `src/app.ts`: fields `layout: Layout` and `camera: Camera`, defaulting to the 480x400 layout and the default camera for the mission's map; mission clicks use the layout (cancel, sound, squad, actions, then the map through `screenToTile(camera, ...)`).

- [ ] **Step 1: Write the failing tests and update the old ones**

Create `tests/mobilepanel.test.ts` covering: `panelButtonAt` returns the id for the centre of every action rectangle of several layouts and null elsewhere (including the map and panel gaps); `squadAt` returns 0 to 3 for the squad rectangles; `cancelHit` and `soundHit`; `actionCost(u, 'turn')` equals `CONFIG.turnCostPer45` and `actionBlocked(u, 'turn')` is true only when the soldier has less AP than that; `actionBlocked(u, 'zoom')` is always false; every label drawn by `drawPanel` (collect with `onText`) lies inside the window for the layouts of `390x844@3`, `844x390@3`, `1366x768@1`, `320x568@2` (use `onText` runs plus the run's `align`/`width`), with the longest soldier name (`Lindqvist 2`) and both a gadget and a scope; the squad strip shows each soldier's name and marks the selected one; the CANCEL button is drawn only when `ui.mode !== 'move'`; with a map camera the world transform places a soldier's sprite where `tileToScreen` says (record `ctx.translate`/`ctx.scale` calls with a recording context and `atlas.draw` coordinates: the sprite is drawn at `x * 16, y * 16` in world coordinates and the context transform is `translate(origin) scale(tile / 16)`).

Update the old tests:
- `tests/panel.test.ts`: rewrite the geometry tests against `computeLayout(480, 400, 1)` (buttons inside the window, no overlap, label fits, hit-test by centre through `panelButtonAt`); keep the text-support and no-overlap test but run it over the 480x400 layout and check texts against `layout.width/height`.
- `tests/gadgetpanel.test.ts`: the geometry test now checks the gadget action exists in `computeLayout(480, 400, 1).actions` and `panelButtonAt` finds it; the label test expects `HEAL`/`SCAN` (or `G HEAL`/`G SCAN` when the key hint fits: assert the text contains `HEAL`/`SCAN`).
- `tests/critfeedback.test.ts`: the SCOPE tag test finds a run with text `SCOPE` inside the layout (do not assert exact coordinates).
- `tests/layout.test.ts`: the mission view check calls `drawGame` with the default view and must still pass the layout checker (texts inside `layout.width x layout.height`).
- Delete `tests/maplayout.test.ts` and its `screenToTile` import usage.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run`
Expected: FAIL (new API missing, old tests changed).

- [ ] **Step 3: Implement**

`src/render/panel.ts`: remove `DEFS`, `PANEL_BUTTONS`, `TOP` and the old drawing; import `ACTIONS`, `Layout`, `Rect`, `computeLayout`, `LEGACY_SIZE` from `../ui/layout`; export `DEFAULT_LAYOUT = computeLayout(LEGACY_SIZE.width, LEGACY_SIZE.height, 1)`. Implement the hit tests with `inside(rect, px, py)`. `drawPanel(ctx, state, ui, now, layout, extras)`:
- fill the panel (`drawFrame(..., 'raised')`) when `!layout.overlay`; when `overlay`, draw the status and detail rectangles as semi-transparent black bars over the map and the column as a raised frame;
- status text (clipped to the status area minus cancel and sound) with the same message logic as today (won/lost/message/preview/mode name), drawn with `layout.text` scale; the cancel button (only when `ui.mode !== 'move'`) and the sound toggle (`SND` or `MUTE`);
- the detail line: `AP 60/60  RIFLE 5/5 +1  GREN 1` plus `ARMOUR`/`MEDKIT`/`SCANNER`, `SCOPE`, `ALERT` tags, as one clipped line;
- the squad strip: for each of the four player soldiers (by `state.units` order) a button with the short name (`clipText`), a mini health bar and the `pressed` style when selected, `disabled` when dead;
- the action buttons: each drawn with `drawFrame` and its label at the layout text scale (prefixed by the key when `textWidth(`${key} ${label}`) * scale + 6 <= rect.w`), the gadget label `HEAL`/`SCAN` as before, the active style for the current mode (`turn` mode highlights TURN) and for ZOOM when `extras.zoom === 'close'`, cost line under the label when the rectangle is tall enough (`rect.h >= 7 * scale * 2 + 4`).
The action costs: add `turn` (`CONFIG.turnCostPer45`), `zoom` (null) to `actionCost`/`actionBlocked`.

`src/render/renderer.ts`: add `MissionView`, `defaultView(state)` (`{ layout: DEFAULT_LAYOUT, camera: createCamera(DEFAULT_LAYOUT, state.width, state.height) }`) and change `drawGame` to take `view` and `extras`: fill `layout.width x layout.height` black; `ctx.save()`, `ctx.beginPath()`, `ctx.rect(map.x, map.y, map.w, map.h)`, `ctx.clip()`, `ctx.translate(origin.x, origin.y)`, `ctx.scale(tile / 16, tile / 16)`; draw the existing world (tiles, items, corpses, units, markers, preview, hover, effects) unchanged (they already use 16-pixel coordinates); `ctx.restore()`; then `drawPanel(ctx, state, ui, now, view.layout, extras)`. Set `ctx.imageSmoothingEnabled = false` at the start.

`src/render/layout.ts`: keep `VIEW`; delete `screenToTile` and the `Pos`/`CONFIG` imports if now unused.

`src/input/uiState.ts`: `Mode` gains `'turn'`; add `pendingTile: Pos | null` (null) to the interface and `createUiState`.

`src/app.ts`: add `layout`, `camera` fields (defaults from `DEFAULT_LAYOUT` and `createCamera` when a mission starts: in `startMission` set `this.camera = createCamera(this.layout, state.width, state.height)`); in `click` for `'mission'`, test in this order `cancelHit` (call `c.cancel()`), `soundHit` (toggle mute with the existing notice), `squadAt` (select that soldier if alive and follow), `panelButtonAt` (`'zoom'` toggles the camera zoom and is handled here; every other id goes to `c.pressButton`), then the map through `screenToTile(this.camera, this.layout, state.width, state.height, p.x, p.y)`; `move` uses the same tile mapping; `drawScreen` passes `{ layout: this.layout, camera: this.camera }` and the extras (`zoom: this.camera.zoom`, `soundOn: !this.sound.muted`) to `drawGame` (add `muted` to the `SoundPlayer` interface usage if needed: it already exposes `muted` on `Sound`; read it with a safe cast for fakes).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: PASS (new and updated tests); typecheck and build clean. Fix tests that assumed the old fixed panel geometry; every such change is ledgered as a Ruling.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: the mission screen draws and hit-tests from the layout and camera"
```

---

### Task 6: TURN mode, the two-tap preview and camera actions in the controller

**Files:**
- Modify: `src/controller.ts`, `src/input/uiState.ts`
- Test: create `tests/mobilecontroller.test.ts`

**Interfaces:**
- Consumes: `Mode 'turn'`, `pendingTile` (Task 5), `ButtonId` incl. `'turn'` and `'zoom'`.
- Produces: `Controller.clickTile(t: Pos, touch = false)`; `pressButton('turn')` and key `f`; `faceToward(from: Pos, to: Pos): Facing | null` (exported helper); hint text `Turn, 1 AP per 45 degrees: click where to face` (shown with the cost to the chosen facing as `Turn N AP` in the status when previewing is not applicable).

- [ ] **Step 1: Write the failing tests**

Create `tests/mobilecontroller.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, faceToward } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { makeState, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

/** A 9x9 open room with p1 in the middle (4,4), facing north, and e1 far away. */
function room() {
  const rows = ['#########', ...Array.from({ length: 7 }, () => '#.......#'), '#########'];
  rows[4] = '#...P...#';
  rows[7] = '#......E#';
  const state = makeState(rows);
  unit(state, 'p1').facing = 0;
  return { state, c: new Controller(state, createUiState('p1'), new Effects()) };
}

describe('faceToward', () => {
  it('gives the eight facings from a tile to another', () => {
    const o = { x: 4, y: 4 };
    expect(faceToward(o, { x: 4, y: 1 })).toBe(0);
    expect(faceToward(o, { x: 7, y: 1 })).toBe(1);
    expect(faceToward(o, { x: 7, y: 4 })).toBe(2);
    expect(faceToward(o, { x: 7, y: 7 })).toBe(3);
    expect(faceToward(o, { x: 4, y: 7 })).toBe(4);
    expect(faceToward(o, { x: 1, y: 7 })).toBe(5);
    expect(faceToward(o, { x: 1, y: 4 })).toBe(6);
    expect(faceToward(o, { x: 1, y: 1 })).toBe(7);
  });

  it('uses the nearest of the eight directions for in-between angles, and null for the same tile', () => {
    const o = { x: 4, y: 4 };
    expect(faceToward(o, { x: 8, y: 3 })).toBe(2); // mostly east
    expect(faceToward(o, { x: 5, y: 0 })).toBe(0); // mostly north
    expect(faceToward(o, o)).toBeNull();
  });
});

describe('TURN mode', () => {
  it('the TURN button enters the mode and F does too, with a hint', () => {
    const { c } = room();
    c.pressButton('turn');
    expect(c.ui.mode).toBe('turn');
    expect(c.ui.message).toMatch(/turn/i);
    c.cancel();
    c.key('f');
    expect(c.ui.mode).toBe('turn');
  });

  it('tapping a tile turns the soldier to face it for 1 AP per 45 degrees, and leaves the mode', () => {
    const { c } = room();
    c.pressButton('turn');
    c.clickTile({ x: 7, y: 4 }); // east: two 45-degree steps from north
    const p = unit(c.state, 'p1');
    expect(p.facing).toBe(2);
    expect(p.ap).toBe(60 - 2);
    expect(c.ui.mode).toBe('move');
  });

  it('turns the short way round (west from north is two steps, not six)', () => {
    const { c } = room();
    c.pressButton('turn');
    c.clickTile({ x: 1, y: 4 });
    expect(unit(c.state, 'p1').facing).toBe(6);
    expect(unit(c.state, 'p1').ap).toBe(60 - 2);
  });

  it('does nothing and costs nothing when already facing that way, or when the own tile is tapped', () => {
    const { c } = room();
    c.pressButton('turn');
    c.clickTile({ x: 4, y: 1 });
    expect(unit(c.state, 'p1').ap).toBe(60);
    c.pressButton('turn');
    c.clickTile({ x: 4, y: 4 });
    expect(unit(c.state, 'p1').facing).toBe(0);
    expect(unit(c.state, 'p1').ap).toBe(60);
    expect(c.ui.mode).toBe('move');
  });

  it('refuses with too little AP and leaves the facing alone', () => {
    const { c } = room();
    unit(c.state, 'p1').ap = 1;
    c.pressButton('turn');
    c.clickTile({ x: 4, y: 7 }); // south: four steps
    expect(unit(c.state, 'p1').facing).toBe(0);
    expect(c.ui.message).toMatch(/action points/i);
  });
});

describe('the two-tap move preview for touch', () => {
  it('the first touch tap previews the path and cost, the second on the same tile moves', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    expect(c.ui.preview.length).toBeGreaterThan(0);
    expect(c.ui.previewCost).toBe(8);
    expect(c.ui.pendingTile).toEqual({ x: 6, y: 4 });
    expect(unit(c.state, 'p1').pos).toEqual({ x: 4, y: 4 });
    c.clickTile({ x: 6, y: 4 }, true);
    vi.advanceTimersByTime(1000);
    expect(unit(c.state, 'p1').pos).toEqual({ x: 6, y: 4 });
    expect(c.ui.pendingTile).toBeNull();
  });

  it('a tap on a different tile moves the preview instead of moving the soldier', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    c.clickTile({ x: 2, y: 4 }, true);
    expect(c.ui.pendingTile).toEqual({ x: 2, y: 4 });
    expect(unit(c.state, 'p1').pos).toEqual({ x: 4, y: 4 });
  });

  it('a mouse click still moves at once, and tapping a soldier selects at once', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 });
    vi.advanceTimersByTime(1000);
    expect(unit(c.state, 'p1').pos).toEqual({ x: 6, y: 4 });
    expect(c.ui.pendingTile).toBeNull();
  });

  it('cancel, a mode change and a selection change clear the pending preview', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    c.cancel();
    expect(c.ui.pendingTile).toBeNull();
    c.clickTile({ x: 6, y: 4 }, true);
    c.pressButton('turn');
    expect(c.ui.pendingTile).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/mobilecontroller.test.ts`
Expected: FAIL (`faceToward`, turn mode, touch parameter missing).

- [ ] **Step 3: Implement**

In `src/controller.ts`:
- export `faceToward(from, to): Facing | null`: `null` when equal; otherwise take `angle = Math.atan2(dx, -dy)` (0 = north, clockwise), `Math.round(angle / (Math.PI / 4))` modulo 8 to a `Facing`.
- `setMode` hint record gains `turn: 'Turn, 1 AP per 45 degrees: click where to face'`; `MODE_NAMES` in the panel gains `turn: 'Turn'` (done in Task 5 if not already).
- `pressButton` gains `case 'turn': this.setMode('turn'); break;` and `case 'zoom': break;` (the app handles zoom); the key switch gains `case 'f': this.setMode('turn'); return true;`.
- `clickTile(t, touch = false)`: in the non-move branch add the `turn` mode: `const f = faceToward(sel.pos, t); if (f === null || f === sel.facing) { this.ui.mode = 'move'; return; } this.run({ type: 'Turn', unitId: sel.id, facing: f });` (the mode is already reset to move before the branch, as for the other modes; the `Turn` handler charges 1 AP per 45 degrees and rejects with "Not enough action points"). In the move branch, before planning the path: when `touch` and the tile is not a player soldier, `if (!posEq(this.ui.pendingTile, t)) { this.ui.pendingTile = { ...t }; this.ui.hover = { ...t }; this.updatePreview(); this.say(...preview text...); return; }`, otherwise clear `pendingTile` and continue as today. Clear `pendingTile` in `cancel()`, `setMode()`, on selection change (the places that set `ui.selectedId`), when a move starts and at the end of the turn (`endTurn`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/mobilecontroller.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src tests/mobilecontroller.test.ts
git commit -m "feat: TURN mode and a two-tap move preview for touch"
```

---

### Task 7: The app: resize, camera follow, pan, zoom, menus and touch routing

**Files:**
- Modify: `src/app.ts`
- Test: create `tests/mobileapp.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 6.
- Produces: `AppOptions` gains `width?`, `height?`, `dpr?`; `App.resize(width, height, dpr)`; `App.click(p, pointer = 'mouse')`; `App.pan(dx, dy)`; `App.longPress(p)`; `App.camera` / `App.layout` read access; the menu contain transform (`menuTransform()`); `App.draw` sets the device transform and draws menus through the contain transform.

- [ ] **Step 1: Write the failing tests**

Create `tests/mobileapp.test.ts` (use the `make`/`START`/`winTiny` patterns from `tests/app.test.ts` by copying the small helpers you need):
- the default `new App()` is 480x400: the menu transform is an identity (scale 1, offset 0), so clicking the START button at `{ x: 240, y: 345 }` starts a mission as before;
- after `app.resize(844, 390, 3)` the menu transform scales to fit and centres (scale `min(844/480, 390/400)`), and a click at the device position of the START button (computed from the transform) starts the mission, while a click at the unscaled `{240, 345}` does not;
- in a mission, `resize` recomputes the layout and re-centres the camera on the selected soldier; the layout orientation follows the size; `pan(30, 0)` changes the camera origin and turns following off, and selecting a soldier through the squad strip (click the first squad rectangle) turns following back on and centres the camera on that soldier;
- clicking the ZOOM action rectangle toggles `camera.zoom` between `close` and `whole` and the focus tile stays;
- clicking the CANCEL rectangle while a mode is active returns the mode to `move`; `longPress` anywhere on the map does the same; neither fires a move;
- a touch tap (`click(p, 'touch')`) on a far map tile shows the preview first (the controller's `pendingTile` is set and the soldier has not moved), a second touch tap moves; a mouse click moves at once;
- a tap that lands on a button never also hits the tile under it (click the first action rectangle where the camera shows a tile beneath: the soldier does not move and the mode changes);
- after a soldier moves (`moveAlong` finishes) the camera follows him; the camera does not follow after a manual pan until the next selection;
- the SOUND rectangle toggles mute (`app.sound.muted` flips) and `draw` runs without throwing at 390x844@3, 844x390@3 and 1366x768@1 on every screen (title, equipment, mission, result, end) with a Proxy context.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/mobileapp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement in `src/app.ts`**

- Constructor options and fields: `width = 480`, `height = 400`, `dpr = 1`; `this.layout = computeLayout(width, height, dpr)`; `camera` created when a mission starts and recreated by `resize`.
- `resize(width, height, dpr)`: recompute `layout`; in a mission: `camera = followTile(createCamera(...), selectedPos, ...)`, clear the controller's `pendingTile` and any mode (`controller.cancel()`).
- `menuTransform(): { scale: number; x: number; y: number }`: `scale = Math.min(width / 480, height / 400)`, `x = (width - 480 * scale) / 2`, `y = (height - 400 * scale) / 2`. `click`, `move` for the menu screens (`title`, `equipment`, `result`, `end`) map the pointer through the inverse (`(p.x - x) / scale`) before the existing hit tests; the mission screen uses pointer coordinates directly.
- `click(p, pointer)`: mission routing as in Task 5, passing `pointer === 'touch'` to `controller.clickTile`; after any command that changes the selection or position (select, move finished, squad strip) call `followSelected()`, which does `camera = followTile(camera, selected.pos, ...)` unless `camera.follow === false` and the change was not a selection or a move.
- `pan(dx, dy)` (mission only): `camera = panBy(camera, dx, dy, ...)`; `longPress(p)` (mission only): `controller.cancel()` and clear `pendingTile`.
- ZOOM: `camera = setZoom(camera, camera.zoom === 'close' ? 'whole' : 'close', ...)`.
- `draw(ctx, now)`: `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`; clear the window to black; for menu screens `ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);` draw the screen and the sound hint (which uses `VIEW`), `ctx.restore()`; for the mission and result screens draw `drawGame` with the view (the result card is a menu-style overlay: draw it through the contain transform too).
- Enemy turn: while the controller runs enemy steps with a visible event, follow the event: after each `run` during the enemy turn, if the latest visible event position is outside the camera's view, centre on it (use the controller's `lastVisible` flag and the unit that acted; keep this simple: centre on the acting unit when `lastVisible` is true and its tile is off screen), and when the player's turn starts follow the selected soldier again.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: PASS; suite green; typecheck and build clean.

- [ ] **Step 5: Commit**

```bash
git add src tests/mobileapp.test.ts
git commit -m "feat: resize, camera follow, pan, zoom and touch routing in the app"
```

---

### Task 8: Pointer input, the full-window canvas and page locks

**Files:**
- Modify: `src/input/input.ts`, `src/main.ts`, `index.html`
- Test: append to `tests/mobileapp.test.ts` only for pure helpers you extract (e.g. `toCss`); the DOM wiring itself is checked in Task 9

**Interfaces:**
- Consumes: `GestureRecognizer` (Task 4), `App` (Task 7).
- Produces: `attachInput(canvas, app)` using pointer events; `main.ts` sizes the canvas to its CSS box times the device pixel ratio (cap 3) on load, on `ResizeObserver` and on `orientationchange`, then calls `app.resize(cssW, cssH, dpr)`.

- [ ] **Step 1: Implement `src/input/input.ts`**

Replace the mouse listeners with pointer events:

```ts
import type { App } from '../app';
import { GestureRecognizer } from './gestures';

export function attachInput(canvas: HTMLCanvasElement, app: App): void {
  const toCss = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const g = new GestureRecognizer({
    tap: (p, kind) => app.click(p, kind === 'touch' ? 'touch' : 'mouse'),
    drag: (dx, dy) => app.pan(dx, dy),
    longPress: (p) => app.longPress(p),
  });
  let timer: number | undefined;
  const stopTimer = () => { if (timer !== undefined) { window.clearInterval(timer); timer = undefined; } };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toCss(e);
    g.down(p.x, p.y, e.pointerType as 'mouse' | 'touch' | 'pen', e.timeStamp);
    stopTimer();
    timer = window.setInterval(() => g.tick(performance.now()), 100);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toCss(e);
    if (e.pressure > 0 || e.buttons) g.move(p.x, p.y, e.timeStamp);
    else if (e.pointerType === 'mouse') app.move(p);
  });
  const end = (e: PointerEvent) => {
    const p = toCss(e);
    g.up(p.x, p.y, e.timeStamp);
    stopTimer();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { g.cancel(); stopTimer(); });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') app.leave(); });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); app.cancel(); });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.key(e.key, e.repeat)) e.preventDefault();
  });
}
```

(`GestureRecognizer.tick` takes the same clock as `down`; use `performance.now()` for all three if `e.timeStamp` is not in the same time base in the browser; ledger any change as a Ruling.)

- [ ] **Step 2: Implement `src/main.ts` and `index.html`**

`index.html`: the viewport meta becomes `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`; the style: `html, body { margin: 0; height: 100%; background: #000; overflow: hidden; overscroll-behavior: none; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }`, `#app { position: fixed; inset: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); box-sizing: border-box; }`, `canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; touch-action: none; background: #000; }` (remove the old fixed-width rule and the flex centring).

`src/main.ts`: create the canvas in `#app`; a `fit()` function reads `canvas.getBoundingClientRect()`, sets `canvas.width = Math.round(w * dpr)`, `canvas.height = Math.round(h * dpr)` with `dpr = Math.min(window.devicePixelRatio || 1, 3)` and calls `app.resize(w, h, dpr)`; call it at start, from a `ResizeObserver` on the canvas and on `orientationchange`; the frame loop is unchanged (`app.update`, `app.draw`). The dev gallery uses `VIEW` for its own size, so call it with a temporary transform (set `ctx.setTransform(1, 0, 0, 1, 0, 0)` inside the dev hook).

- [ ] **Step 3: Run**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: green and clean.

- [ ] **Step 4: Commit**

```bash
git add src index.html
git commit -m "feat: pointer input and a full-window canvas"
```

---

### Task 9: Look at it on a phone-sized screen, then desktop

**Files:** none (verification); fix defects with a test first.

- [ ] **Step 1: Portrait**

`preview_start` the `laser-tribute-dev` server, then `resize_window` with width 375 and height 812 (the mobile preset). Clear `localStorage` key `laser-tribute-save` and reload. Press Enter in the page (`app.key('Enter')`) or tap START to start Outpost. Screenshot: expect the map filling the top, big tiles, the panel below with the status line, the detail line, four squad buttons and the 12 actions in a 4x3 grid, text readable. Send touch-like input through script: `canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX, clientY, pointerId: 1, pressure: 0.5 }))` followed by `pointerup` at the same position, for: a tap on a far tile (preview, then a second tap to move), the TURN button then a tap on a tile (the soldier turns; check `app.controller.state` facing and AP), ZOOM (screenshot of the whole map), a drag (pointerdown, three pointermoves, pointerup: the camera pans), a long press (down, wait 600 ms, up: the mode cancels), the squad strip (selects another soldier and centres).

- [ ] **Step 2: Landscape and desktop**

`resize_window` to 812x375 and screenshot (map left, panel column right, status and detail as overlays on the map); then the `desktop` preset and screenshot (bottom panel, whole map large); check the keyboard still works (`app.key('f')`, `app.key('q')`), the menus still draw (equipment screen at 812x375 and at 375x812, scaled and centred) and `read_console_messages` shows no errors. Reset the viewport with the `desktop` preset, stop the server, clear `laser-tribute-save`.

- [ ] **Step 3: Commit any fix** found here (test first); otherwise nothing to commit.
