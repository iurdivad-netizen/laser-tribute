# Laser Tribute Milestone 8 Implementation Plan (interface graphics)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 5x7 pixel font (all caps), beveled Amiga-style frames and buttons, an 80 px mission panel on a 480x400 canvas, and restyled equipment, result and end screens.

**Architecture:** `src/ui/font.ts` holds the glyph bitmaps and `textWidth`. `src/ui/text.ts` has a `FontAtlas` (bakes a glyph once per colour into a small canvas, silent without a canvas), `drawText`, `clipText`, and a text listener used by tests. `src/ui/frame.ts` has the UI colours, `drawFrame` (bevel styles) and `drawButton`. Every `fillText` in the interface is replaced by `drawText`; the panel and screens are re-laid out with the new geometry.

**Tech Stack:** TypeScript, HTML5 Canvas, Vite, Vitest (`npx vitest run`, `npx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-05-laser-tribute-milestone8-design.md` (read it first).

## Global Constraints

- `src/core` is not touched. No image files. All interface text goes through `drawText` (no `fillText`, no `monospace` font outside `src/ui/text.ts`).
- Glyph cell 5x7, advance 6 px, `textWidth(t) = t.length === 0 ? 0 : t.length * 6 - 1`; lower case is shown as capitals; unknown characters draw a visible box and are reported by `unsupportedChars`.
- Canvas 480x400: `VIEW = { width: 480, height: 400, mapHeight: 320 }`. The map and `screenToTile` are unchanged.
- Panel geometry (panel top y = 320): left well x 4..148 (lines at y+8, 19, 30, 41, hints at 54 and 65); turn line (156, y+6); message line (156, y+17) clipped to 320 px; button row 1 at y+28 (x = 156 + 64*i, 60x20, five buttons), row 2 at y+52 (x = 156 + 80*i, 76x20, four buttons); label at (x+3, y+3), cost at (x+3, y+11).
- Equipment: `EQ.weapon = { x: 76, w: 100 }`, `EQ.minus = { x: 262, w: 24 }`, `EQ.plus = { x: 322, w: 24 }`, `EQ.start = { x: 170, y: 330, w: 140, h: 30 }`; rows unchanged (top 56, step 52, button height 24, clip line +26). Result and end geometry unchanged (`RESULT.again = { x: 190, y: 222, w: 100, h: 26 }`, `END.again = { x: 175, y: 240, w: 130, h: 26 }`).
- Controls, keys, rules, sounds and screen flow are unchanged. Existing tests (458) keep passing; only tests with hard-coded interface coordinates change (listed in Tasks 4 and 5).
- Co-author trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on branch `milestone-8` (created, spec committed).

## Review Focus

- Every glyph is 7x5, all glyphs are distinct, and every character the game displays is supported (a typo in a hand-drawn glyph is the likeliest defect). Task 1 and Task 7.
- `clipText` never exceeds its width, `drawText` right/centre alignment is exact, and the atlas is silent without a canvas. Task 2.
- Every panel button label and cost fits its button, the nine buttons do not overlap, and the drawn buttons are the clickable areas. Task 4.
- Longest content on every screen (11-character soldier name with rank, 99 kills, a 60-character message, four promotions, long fallen lists) never leaves its box or the canvas and no two texts overlap. Task 7.
- The canvas change did not break map clicks, panel clicks or the aspect ratio. Tasks 4 and 7.
- No leftover `fillText` or `monospace` in `src` outside `src/ui/text.ts`. Task 7.

## File Structure

- Create `src/ui/font.ts`, `src/ui/text.ts`, `src/ui/frame.ts`.
- Modify `src/art/atlas.ts` (export `defaultCanvas`), `src/render/layout.ts`, `index.html`, `src/render/panel.ts`, `src/render/renderer.ts`, `src/app.ts`, `src/screens/equipment.ts`, `src/screens/result.ts`, `src/screens/end.ts`, `src/art/gallery.ts`, `README.md`.
- Tests: create `tests/font.test.ts`, `tests/text.test.ts`, `tests/frame.test.ts`, `tests/layout.test.ts`; modify `tests/panel.test.ts`, `tests/soundapp.test.ts`, `tests/equipment.test.ts`, `tests/clipsui.test.ts`, `tests/app.test.ts`.

---

### Task 1: The pixel font (glyph data)

**Files:**
- Create: `src/ui/font.ts`
- Test: `tests/font.test.ts`

**Interfaces:**
- Produces: `GLYPH_W = 5`, `GLYPH_H = 7`, `ADVANCE = 6`; `GLYPHS: Record<string, string[]>` (7 strings of 5 characters from `#.`); `FALLBACK: string[]`; `glyphFor(ch: string): string[]` (upper-cases letters, falls back to `FALLBACK`); `isSupported(ch: string): boolean`; `unsupportedChars(text: string): string[]` (unique unsupported characters, in order); `textWidth(text: string): number`.

- [ ] **Step 1: Write the failing tests**

Create `tests/font.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ADVANCE, FALLBACK, GLYPHS, GLYPH_H, GLYPH_W, glyphFor, isSupported, textWidth, unsupportedChars } from '../src/ui/font';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?\'"-+=/()[]<>%*#_&@$~|';

describe('glyph data', () => {
  it('has exactly the character set, every glyph 7 rows of 5 characters from # and .', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...CHARSET].sort());
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(GLYPH_H);
      for (const row of rows) expect(row, ch).toMatch(/^[#.]{5}$/);
    }
    expect(GLYPH_W).toBe(5);
    expect(ADVANCE).toBe(6);
  });

  it('draws something for every character but the space, and no two characters look the same', () => {
    const seen = new Map<string, string>();
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      const key = rows.join('/');
      if (ch === ' ') {
        expect(key).toBe(Array(7).fill('.....').join('/'));
        continue;
      }
      expect(key.includes('#'), ch).toBe(true);
      expect(seen.get(key), `${ch} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, ch);
    }
  });

  it('shows lower case as the capital', () => {
    expect(glyphFor('a')).toBe(GLYPHS.A);
    expect(glyphFor('z')).toBe(GLYPHS.Z);
    expect(isSupported('q')).toBe(true);
  });

  it('draws a visible box for an unsupported character instead of throwing', () => {
    expect(glyphFor('é')).toBe(FALLBACK);
    expect(FALLBACK).toEqual(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####']);
    expect(isSupported('é')).toBe(false);
  });

  it('reports unsupported characters once each, in order', () => {
    expect(unsupportedChars('Need 24 AP, have 15')).toEqual([]);
    expect(unsupportedChars('aébéü')).toEqual(['é', 'ü']);
  });

  it('measures text: 6 pixels per character minus the trailing gap', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('A')).toBe(5);
    expect(textWidth('AB')).toBe(11);
    expect(textWidth('HP 80/80')).toBe(47);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/font.test.ts`
Expected: FAIL (cannot find module `../src/ui/font`).

- [ ] **Step 3: Implement**

Create `src/ui/font.ts`:

```ts
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** Pixels from the start of one character to the start of the next. */
export const ADVANCE = 6;

/** A 5x7 pixel font, capitals only: '#' is a lit pixel. Lower case is drawn as the capital. */
export const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '~': ['.....', '.....', '.##.#', '#.##.', '.....', '.....', '.....'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
};

/** Drawn for any character the font does not have, so a missing glyph is visible. */
export const FALLBACK = ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'];

export function isSupported(ch: string): boolean {
  return GLYPHS[ch.toUpperCase()] !== undefined;
}

export function glyphFor(ch: string): string[] {
  return GLYPHS[ch.toUpperCase()] ?? FALLBACK;
}

export function unsupportedChars(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) if (!isSupported(ch) && !out.includes(ch)) out.push(ch);
  return out;
}

export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * ADVANCE - 1;
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If the "no two characters look the same" test names a pair, one of the two glyphs was mistyped: fix the glyph rows (compare with a neighbouring letter), not the test. Look at the rows of any glyph the test or the later gallery shows as odd.

- [ ] **Step 5: Commit**

```bash
git add src/ui/font.ts tests/font.test.ts
git commit -m "feat(ui): 5x7 pixel font glyph data

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `FontAtlas`, `drawText` and `clipText`

**Files:**
- Create: `src/ui/text.ts`
- Modify: `src/art/atlas.ts` (export `defaultCanvas`)
- Test: `tests/text.test.ts`

**Interfaces:**
- Consumes: `glyphFor`, `textWidth`, `ADVANCE`, `GLYPH_W`, `GLYPH_H` (Task 1); `CanvasLike` and the new `defaultCanvas` from `src/art/atlas.ts`.
- Produces: `type Align = 'left' | 'right' | 'center'`; `interface TextRun { text: string; x: number; y: number; colour: string; align: Align; width: number }`; `onText(listener): () => void` (registers a listener called by every `drawText`; returns an unsubscribe function); `class FontAtlas` with constructor `(createCanvas?)` and `draw(ctx, text, x, y, colour, align?): boolean`; `defaultFont: FontAtlas`; `drawText(ctx, text, x, y, colour, align = 'left', atlas = defaultFont): void`; `clipText(text: string, maxPx: number): string`.

- [ ] **Step 1: Write the failing tests**

Create `tests/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CanvasLike } from '../src/art/atlas';
import { GLYPHS } from '../src/ui/font';
import { FontAtlas, clipText, drawText, onText } from '../src/ui/text';
import { textWidth } from '../src/ui/font';

interface Op { colour: string; x: number; y: number }

class FakeCanvas implements CanvasLike {
  ops: Op[] = [];
  constructor(public width: number, public height: number) {}
  getContext() {
    const canvas = this;
    let colour = '';
    return {
      set fillStyle(v: unknown) { colour = String(v); },
      get fillStyle() { return colour; },
      fillRect(x: number, y: number) { canvas.ops.push({ colour, x, y }); },
    };
  }
}

function makeFont() {
  const canvases: FakeCanvas[] = [];
  const atlas = new FontAtlas((w, h) => {
    const c = new FakeCanvas(w, h);
    canvases.push(c);
    return c;
  });
  return { atlas, canvases };
}

function fakeCtx() {
  const calls: unknown[][] = [];
  const ctx = { drawImage: (...a: unknown[]) => { calls.push(a); } } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('FontAtlas', () => {
  it('bakes a glyph once per colour, one pixel per lit cell', () => {
    const { atlas, canvases } = makeFont();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'AA', 0, 0, '#fff');
    expect(canvases).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const lit = GLYPHS.A.join('').replace(/\./g, '').length;
    expect(canvases[0].ops).toHaveLength(lit);
    expect(canvases[0].ops.every((o) => o.colour === '#fff')).toBe(true);
    atlas.draw(ctx, 'A', 0, 0, '#f00');
    expect(canvases).toHaveLength(2);
  });

  it('treats lower case as the same glyph as the capital', () => {
    const { atlas, canvases } = makeFont();
    const { ctx } = fakeCtx();
    atlas.draw(ctx, 'aA', 0, 0, '#fff');
    expect(canvases).toHaveLength(1);
  });

  it('places each character 6 pixels after the last and skips spaces', () => {
    const { atlas, canvases } = makeFont();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'A B', 10, 20, '#fff');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([canvases[0], 10, 20]);
    expect(calls[1][1]).toBe(10 + 2 * 6);
    expect(calls[1][2]).toBe(20);
  });

  it('aligns right text to end at x and centred text around x', () => {
    const { atlas } = makeFont();
    const right = fakeCtx();
    atlas.draw(right.ctx, 'AB', 100, 0, '#fff', 'right');
    expect(right.calls[0][1]).toBe(100 - textWidth('AB'));
    const centre = fakeCtx();
    atlas.draw(centre.ctx, 'AB', 100, 0, '#fff', 'center');
    expect(centre.calls[0][1]).toBe(100 - Math.floor(textWidth('AB') / 2));
  });

  it('draws nothing and does not throw when there is no canvas', () => {
    const atlas = new FontAtlas(() => null);
    const { ctx, calls } = fakeCtx();
    expect(atlas.draw(ctx, 'HELLO', 0, 0, '#fff')).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('draws a visible box for an unsupported character', () => {
    const { atlas, canvases } = makeFont();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'é', 0, 0, '#fff');
    expect(calls).toHaveLength(1);
    expect(canvases[0].ops.length).toBe(16); // the 7x5 outline has 16 lit cells
  });
});

describe('drawText and the text listener', () => {
  it('reports every call with its original text, position, colour, alignment and width', () => {
    const runs: unknown[] = [];
    const stop = onText((r) => runs.push(r));
    const { ctx } = fakeCtx();
    drawText(ctx, 'Need 24 AP', 5, 6, '#abc', 'right');
    stop();
    drawText(ctx, 'after', 0, 0, '#fff');
    expect(runs).toEqual([{ text: 'Need 24 AP', x: 5, y: 6, colour: '#abc', align: 'right', width: textWidth('Need 24 AP') }]);
  });
});

describe('clipText', () => {
  it('leaves text that fits unchanged', () => {
    expect(clipText('SHORT', 100)).toBe('SHORT');
    expect(clipText('', 0)).toBe('');
  });

  it('shortens too-long text so it ends in ... and fits', () => {
    const out = clipText('ALVAREZ, BRANDT, CHEN, DUBOIS, ERIKSEN', 100);
    expect(out.endsWith('...')).toBe(true);
    expect(textWidth(out)).toBeLessThanOrEqual(100);
    expect(out.length).toBeGreaterThan(4);
  });

  it('never exceeds the width, for any width', () => {
    const text = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
    for (let w = 0; w <= 260; w++) expect(textWidth(clipText(text, w)), `width ${w}`).toBeLessThanOrEqual(w);
  });

  it('gives the longest prefix that fits with the dots', () => {
    const out = clipText('ABCDEFGHIJKLMNOP', 60);
    expect(out).toBe('ABCDEFG...'.slice(0, out.length));
    expect(textWidth(out + 'X')).toBeGreaterThan(60 - 0 === 60 ? 0 : 0);
  });
});
```

(The last test only guards that `clipText` is greedy; if its two assertions look redundant when implementing, keep the first one and delete the second.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/text.test.ts`
Expected: FAIL (cannot find module `../src/ui/text`).

- [ ] **Step 3: Implement**

In `src/art/atlas.ts` change `function defaultCanvas(` to `export function defaultCanvas(`.

Create `src/ui/text.ts`:

```ts
import { defaultCanvas, type CanvasLike } from '../art/atlas';
import { ADVANCE, GLYPH_H, GLYPH_W, glyphFor, textWidth } from './font';

export type Align = 'left' | 'right' | 'center';

export interface TextRun {
  text: string;
  x: number;
  y: number;
  colour: string;
  align: Align;
  width: number;
}

const listeners = new Set<(run: TextRun) => void>();

/** Listen to every `drawText` call (used by tests to check layouts). Returns a function that stops listening. */
export function onText(listener: (run: TextRun) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bakes each glyph once per colour into a small canvas, then stamps it. Draws nothing without a canvas. */
export class FontAtlas {
  private cache = new Map<string, CanvasLike | null>();

  constructor(private readonly createCanvas: (w: number, h: number) => CanvasLike | null = defaultCanvas) {}

  private glyph(ch: string, colour: string): CanvasLike | null {
    const rows = glyphFor(ch);
    const key = `${rows.join('/')}|${colour}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const canvas = this.createCanvas(GLYPH_W, GLYPH_H);
    const ctx = canvas?.getContext('2d') ?? null;
    if (canvas && ctx) {
      ctx.fillStyle = colour;
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') ctx.fillRect(x, y, 1, 1); }));
    }
    const baked = canvas && ctx ? canvas : null;
    this.cache.set(key, baked);
    return baked;
  }

  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string, align: Align = 'left'): boolean {
    const width = textWidth(text);
    const start = align === 'left' ? x : align === 'right' ? x - width : x - Math.floor(width / 2);
    let drew = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') continue;
      const g = this.glyph(text[i], colour);
      if (!g) continue;
      ctx.drawImage(g as unknown as CanvasImageSource, Math.round(start + i * ADVANCE), Math.round(y));
      drew = true;
    }
    return drew;
  }
}

export const defaultFont = new FontAtlas();

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour: string,
  align: Align = 'left',
  atlas: FontAtlas = defaultFont,
): void {
  for (const listener of listeners) listener({ text, x, y, colour, align, width: textWidth(text) });
  atlas.draw(ctx, text, x, y, colour, align);
}

/** The text, or the longest start of it followed by "..." that is at most `maxPx` pixels wide. */
export function clipText(text: string, maxPx: number): string {
  if (textWidth(text) <= maxPx) return text;
  for (let n = text.length - 1; n >= 0; n--) {
    const out = `${text.slice(0, n)}...`;
    if (textWidth(out) <= maxPx) return out;
  }
  // not even "..." fits: as many dots as fit
  return '.'.repeat(Math.max(0, Math.floor((maxPx + 1) / ADVANCE)));
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. (The glyph cache key is the glyph rows plus the colour, so `a` and `A` share an entry, and the fallback box is shared by every unsupported character.)

- [ ] **Step 5: Commit**

```bash
git add src tests/text.test.ts
git commit -m "feat(ui): FontAtlas, drawText, clipText and a text listener for tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Beveled frames and buttons

**Files:**
- Create: `src/ui/frame.ts`
- Test: `tests/frame.test.ts`

**Interfaces:**
- Consumes: `drawText` (Task 2).
- Produces: `UI` colour constants; `type FrameStyle = 'raised' | 'pressed' | 'hover' | 'disabled' | 'inset'`; `type ButtonState = 'raised' | 'pressed' | 'hover' | 'disabled'`; `drawFrame(ctx, x, y, w, h, style): void`; `interface Rect { x: number; y: number; w: number; h: number }`; `drawButton(ctx, rect: Rect, label: string, state: ButtonState = 'raised'): void` (label centred; colour by state).

- [ ] **Step 1: Write the failing tests**

Create `tests/frame.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UI, drawButton, drawFrame } from '../src/ui/frame';
import { onText } from '../src/ui/text';

interface Fill { colour: string; x: number; y: number; w: number; h: number }

function recorder() {
  const fills: Fill[] = [];
  let colour = '';
  const ctx = {
    set fillStyle(v: string) { colour = v; },
    fillRect(x: number, y: number, w: number, h: number) { fills.push({ colour, x, y, w, h }); },
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

describe('drawFrame', () => {
  it('a raised frame is a navy body, a light top-left edge and a dark bottom-right edge, 2 px thick', () => {
    const { ctx, fills } = recorder();
    drawFrame(ctx, 10, 20, 100, 30, 'raised');
    expect(fills[0]).toEqual({ colour: UI.fill, x: 10, y: 20, w: 100, h: 30 });
    expect(fills).toContainEqual({ colour: UI.light, x: 10, y: 20, w: 100, h: 2 });
    expect(fills).toContainEqual({ colour: UI.light, x: 10, y: 20, w: 2, h: 30 });
    expect(fills).toContainEqual({ colour: UI.dark, x: 10, y: 48, w: 100, h: 2 });
    expect(fills).toContainEqual({ colour: UI.dark, x: 108, y: 20, w: 2, h: 30 });
  });

  it('a pressed or inset frame swaps the edges and darkens the body', () => {
    for (const style of ['pressed', 'inset'] as const) {
      const { ctx, fills } = recorder();
      drawFrame(ctx, 0, 0, 40, 20, style);
      expect(fills[0].colour).toBe(UI.fillDark);
      expect(fills).toContainEqual({ colour: UI.dark, x: 0, y: 0, w: 40, h: 2 });
      expect(fills).toContainEqual({ colour: UI.light, x: 0, y: 18, w: 40, h: 2 });
    }
  });

  it('a hover frame has a brighter body, and a disabled frame has no light edge', () => {
    const hover = recorder();
    drawFrame(hover.ctx, 0, 0, 40, 20, 'hover');
    expect(hover.fills[0].colour).toBe(UI.fillHi);
    const off = recorder();
    drawFrame(off.ctx, 0, 0, 40, 20, 'disabled');
    expect(off.fills.some((f) => f.colour === UI.light)).toBe(false);
  });
});

describe('drawButton', () => {
  it('draws a frame and the label centred, in a colour that depends on the state', () => {
    const runs: { text: string; x: number; y: number; colour: string; align: string }[] = [];
    const stop = onText((r) => runs.push(r));
    const { ctx } = recorder();
    drawButton(ctx, { x: 100, y: 50, w: 60, h: 20 }, 'SNAP', 'raised');
    drawButton(ctx, { x: 100, y: 50, w: 60, h: 20 }, 'SNAP', 'disabled');
    drawButton(ctx, { x: 100, y: 50, w: 60, h: 20 }, 'SNAP', 'pressed');
    stop();
    expect(runs[0]).toMatchObject({ text: 'SNAP', x: 130, y: 56, align: 'center', colour: UI.text });
    expect(runs[1].colour).toBe(UI.disabledText);
    expect(runs[2].colour).toBe(UI.accent);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/frame.test.ts`
Expected: FAIL (cannot find module `../src/ui/frame`).

- [ ] **Step 3: Implement**

Create `src/ui/frame.ts`:

```ts
import { drawText } from './text';

/** Interface colours, taken from the sprite palette so the menus match the world. */
export const UI = {
  black: '#000000',
  fill: '#1c1f2e',
  fillHi: '#2a2f45',
  fillDark: '#14161f',
  light: '#8b8fa8',
  dark: '#0b0c12',
  text: '#e8e8f0',
  dim: '#8a8fa8',
  hint: '#6a6f88',
  disabledText: '#555a70',
  accent: '#ffe14d',
  red: '#ff5555',
  green: '#7dff9a',
  blue: '#4da6ff',
} as const;

export type FrameStyle = 'raised' | 'pressed' | 'hover' | 'disabled' | 'inset';
export type ButtonState = 'raised' | 'pressed' | 'hover' | 'disabled';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An Amiga-style bevelled box: a 2 px light edge top-left and a dark one bottom-right (swapped when pressed or inset). */
export function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: FrameStyle): void {
  const sunk = style === 'pressed' || style === 'inset';
  ctx.fillStyle = sunk || style === 'disabled' ? UI.fillDark : style === 'hover' ? UI.fillHi : UI.fill;
  ctx.fillRect(x, y, w, h);
  const topLeft = sunk || style === 'disabled' ? UI.dark : UI.light;
  const bottomRight = sunk ? UI.light : UI.dark;
  ctx.fillStyle = topLeft;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = bottomRight;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, state: ButtonState = 'raised'): void {
  drawFrame(ctx, r.x, r.y, r.w, r.h, state);
  const colour = state === 'disabled' ? UI.disabledText : state === 'pressed' ? UI.accent : UI.text;
  drawText(ctx, label, r.x + r.w / 2, r.y + Math.floor((r.h - 7) / 2), colour, 'center');
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/frame.ts tests/frame.test.ts
git commit -m "feat(ui): beveled frames and buttons

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Taller canvas and the new mission panel

**Files:**
- Modify: `src/render/layout.ts`, `index.html`, `src/render/panel.ts`, `src/render/renderer.ts` (the "!" alert mark), `tests/panel.test.ts`, `tests/soundapp.test.ts` (its panel-hint test and its text recorder, see below)
- Test: `tests/panel.test.ts`

**Interfaces:**
- Consumes: `drawFrame`, `drawButton`, `UI` (Task 3); `drawText`, `clipText`, `onText` (Task 2); `textWidth` (Task 1).
- Produces: `VIEW.height = 400`; `PANEL_BUTTONS` with the new rectangles and the labels `SNAP`, `AIM`, `THROW`, `STAB`, `RELOAD`, `DOOR`, `TAKE`, `ALERT`, `END TURN` (keys `S`, `A`, `T`, `K`, `R`, `D`, `P`, `L`, `SPC`); `buttonAt`, `actionCost`, `actionBlocked`, `drawPanel` keep their signatures.

- [ ] **Step 1: Write the failing tests**

In `tests/panel.test.ts` replace the first test (the one named "has nine buttons including STAB and LOAD ...") with:

```ts
  it('has nine buttons in the same order, each label and cost fitting its button, none overlapping', () => {
    expect(PANEL_BUTTONS.map((b) => b.id)).toEqual(
      ['snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'end'],
    );
    for (const b of PANEL_BUTTONS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(VIEW.width);
      expect(b.y).toBeGreaterThanOrEqual(VIEW.mapHeight);
      expect(b.y + b.h).toBeLessThanOrEqual(VIEW.height);
      expect(textWidth(`${b.key} ${b.label}`) + 6, b.id).toBeLessThanOrEqual(b.w);
      expect(textWidth('15 AP') + 6, b.id).toBeLessThanOrEqual(b.w);
    }
    for (let i = 0; i < PANEL_BUTTONS.length; i++) {
      for (let j = i + 1; j < PANEL_BUTTONS.length; j++) {
        const a = PANEL_BUTTONS[i];
        const c = PANEL_BUTTONS[j];
        const overlap = a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${c.id}`).toBe(false);
      }
    }
  });

  it('has the agreed geometry: five buttons on the first row, four on the second, below the map', () => {
    expect(VIEW).toEqual({ width: 480, height: 400, mapHeight: 320 });
    const row = (n: number) => PANEL_BUTTONS.slice(n === 1 ? 0 : 5, n === 1 ? 5 : 9);
    expect(row(1).map((b) => [b.x, b.y, b.w, b.h])).toEqual([
      [156, 348, 60, 20], [220, 348, 60, 20], [284, 348, 60, 20], [348, 348, 60, 20], [412, 348, 60, 20],
    ]);
    expect(row(2).map((b) => [b.x, b.y, b.w, b.h])).toEqual([
      [156, 372, 76, 20], [236, 372, 76, 20], [316, 372, 76, 20], [396, 372, 76, 20],
    ]);
  });

  it('draws only text the pixel font supports, and no two texts overlap', () => {
    const s = makeState(corridorRows('P..E'));
    const ui = createUiState('p1');
    ui.message = 'Alvarez on alert: fires once at each enemy that moves into view';
    ui.messageUntil = Infinity;
    const runs: { text: string; x: number; y: number; width: number }[] = [];
    const stop = onText((r) => runs.push(r));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawPanel(ctx, s, ui, 0);
    stop();
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(r.x + r.width, r.text).toBeLessThanOrEqual(VIEW.width);
      expect(r.y + 7, r.text).toBeLessThanOrEqual(VIEW.height);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i];
        const b = runs[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + 7 && b.y < a.y + 7;
        expect(overlap, `"${a.text}" overlaps "${b.text}"`).toBe(false);
      }
    }
    const message = runs.find((r) => r.text.endsWith('...'))!;
    expect(message.width).toBeLessThanOrEqual(320);
  });
```

Add to the imports of `tests/panel.test.ts`: `drawPanel` (from `../src/render/panel`), `createUiState` (from `../src/input/uiState`), `unsupportedChars`, `textWidth` (from `../src/ui/font`) and `onText` (from `../src/ui/text`). Keep the other two tests in the file (`hit-tests every button by its centre`, `shows the knife AP cost`).

In `tests/soundapp.test.ts` the helper `recorder()` collects text through a `fillText` spy; the interface now draws text with `drawText`, so replace the whole `recorder` function with one that collects through `onText`:

```ts
/** Records the text drawn through drawText while a canvas stand-in swallows the rest. */
function recorder() {
  const texts: { text: string; x: number }[] = [];
  const stop = onText((r) => texts.push({ text: r.text, x: r.x }));
  const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, stop };
}
```

and add `import { onText } from '../src/ui/text';` to its imports. In that file each test that calls `recorder()` must call `stop()` after reading the texts (or not depend on later leakage): update the four call sites so they destructure `stop` and call it right after the draw, for example `const { ctx, texts, stop } = recorder(); app.draw(ctx, 0); stop();`. In the test named "shows the key hint on the equipment screen but not during a mission" reassign both `r` recordings the same way (call `r.stop()` after each draw). Update the panel-hint test at the end of the file to: 

```ts
describe('panel hint', () => {
  it('shows the mute key and stays inside the left well', () => {
    const s = makeState(corridorRows('P..E'));
    const ui = createUiState('p1');
    const { ctx, texts, stop } = recorder();
    drawPanel(ctx, s, ui, 0);
    stop();
    const hint = texts.find((t) => t.text.includes('M MUTE'))!;
    expect(hint).toBeDefined();
    expect(hint.x + textWidth(hint.text)).toBeLessThanOrEqual(148);
  });
});
```

(with `textWidth` imported from `../src/ui/font`). The two sound-hint assertions that look for `'Sound off'` and `'M: sound on/off'` keep their text, because `onText` records the original string.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/panel.test.ts tests/soundapp.test.ts`
Expected: FAIL (the old panel has the old geometry; `VIEW.height` is 360).

- [ ] **Step 3: Implement**

`src/render/layout.ts`: change `VIEW` and its comment:

```ts
/** Logical canvas size: a 30x20 map of 16px tiles plus an 80px panel. */
export const VIEW = { width: 480, height: 400, mapHeight: 320 } as const;
```

`index.html`: in the `canvas` rule change `width: min(960px, 100vw, calc(100vh * 4 / 3));` to `width: min(960px, 100vw, calc(100vh * 6 / 5));`.

`src/render/renderer.ts`: replace the alert mark block

```ts
      ctx.font = '8px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.select;
      ctx.fillText('!', cx + 5, cy - 17);
```

with `drawText(ctx, '!', cx + 5, cy - 17, COLORS.select);` and add `import { drawText } from '../ui/text';`.

Replace `src/render/panel.ts` with:

```ts
import { CONFIG, WEAPONS } from '../core/config';
import { rankShort } from '../core/ranks';
import type { GameState, Unit } from '../core/types';
import type { UiState } from '../input/uiState';
import { UI, drawButton, drawFrame, type ButtonState } from '../ui/frame';
import { clipText, drawText } from '../ui/text';
import { VIEW } from './layout';

export type ButtonId = 'snap' | 'aimed' | 'throw' | 'stab' | 'reload' | 'door' | 'pickup' | 'alert' | 'end';

export interface PanelButton {
  id: ButtonId;
  label: string;
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFS: [ButtonId, string, string][] = [
  ['snap', 'SNAP', 'S'],
  ['aimed', 'AIM', 'A'],
  ['throw', 'THROW', 'T'],
  ['stab', 'STAB', 'K'],
  ['reload', 'RELOAD', 'R'],
  ['door', 'DOOR', 'D'],
  ['pickup', 'TAKE', 'P'],
  ['alert', 'ALERT', 'L'],
  ['end', 'END TURN', 'SPC'],
];

const TOP = VIEW.mapHeight;

/** Row 1: five buttons 60 wide from x 156; row 2: four buttons 76 wide from x 156. */
export const PANEL_BUTTONS: PanelButton[] = DEFS.map(([id, label, key], i) =>
  i < 5
    ? { id, label, key, x: 156 + i * 64, y: TOP + 28, w: 60, h: 20 }
    : { id, label, key, x: 156 + (i - 5) * 80, y: TOP + 52, w: 76, h: 20 },
);

/** AP the soldier pays for the action behind this button; null for buttons that cost nothing. */
export function actionCost(u: Unit, id: ButtonId): number | null {
  switch (id) {
    case 'snap': return WEAPONS[u.weapon].snapAp;
    case 'aimed': return WEAPONS[u.weapon].aimedAp;
    case 'throw': return CONFIG.grenade.apCost;
    case 'stab': return CONFIG.knife.apCost;
    case 'reload': return CONFIG.reloadAp;
    case 'door': return CONFIG.doorCost;
    case 'pickup': return CONFIG.pickupCost;
    default: return null;
  }
}

/** True when the button's action cannot be used right now (not enough AP, empty gun, nothing to reload). */
export function actionBlocked(u: Unit, id: ButtonId): boolean {
  const cost = actionCost(u, id);
  if (cost !== null && u.ap < cost) return true;
  if (id === 'reload') return u.clips < 1 || u.ammo >= WEAPONS[u.weapon].magazine;
  if (id === 'snap' || id === 'aimed') return u.ammo < 1;
  if (id === 'throw') return u.grenades < 1;
  return false;
}

const MODE_NAMES: Partial<Record<UiState['mode'], string>> = {
  snap: 'Snap shot', aimed: 'Aimed shot', throw: 'Grenade', door: 'Door', stab: 'Stab',
};

export function buttonAt(px: number, py: number): ButtonId | null {
  const b = PANEL_BUTTONS.find((x) => px >= x.x && px < x.x + x.w && py >= x.y && py < x.y + x.h);
  return b ? b.id : null;
}

export function drawPanel(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState, now: number): void {
  drawFrame(ctx, 0, TOP, VIEW.width, VIEW.height - TOP, 'raised');
  drawFrame(ctx, 4, TOP + 4, 144, 72, 'inset');

  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);
  if (u) {
    const tag = rankShort(u.rank);
    const weapon = WEAPONS[u.weapon];
    drawText(ctx, `${tag ? `${tag} ` : ''}${u.name}`, 8, TOP + 8, UI.text);
    drawText(ctx, `HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}`, 8, TOP + 19, UI.dim);
    drawText(ctx, `${weapon.name} ${u.ammo}/${weapon.magazine} +${u.clips}  GREN ${u.grenades}`, 8, TOP + 30, UI.text);
    if (u.alert) drawText(ctx, 'ALERT', 8, TOP + 41, UI.accent);
  } else {
    drawText(ctx, 'NO SOLDIER SELECTED', 8, TOP + 8, UI.dim);
  }
  drawText(ctx, '1-4 SELECT  Q/E TURN', 8, TOP + 54, UI.hint);
  drawText(ctx, 'ESC CANCEL  M MUTE', 8, TOP + 65, UI.hint);

  drawText(ctx, `TURN ${state.turnNumber}  ${state.turn === 'player' ? 'YOUR MOVE' : 'ENEMY MOVE'}`, 156, TOP + 6, UI.dim);

  let line = '';
  if (state.status === 'won') line = 'MISSION COMPLETE';
  else if (state.status === 'lost') line = 'MISSION FAILED';
  else if (now < ui.messageUntil) line = ui.message;
  else if (ui.previewCost !== null) line = `Move: ${ui.previewCost} AP`;
  else if (u && MODE_NAMES[ui.mode]) {
    line = `${MODE_NAMES[ui.mode]}: ${actionCost(u, ui.mode as ButtonId)} AP`;
  }
  drawText(ctx, clipText(line, 320), 156, TOP + 17, state.status === 'playing' ? UI.accent : UI.green);

  const modeButton: Partial<Record<UiState['mode'], ButtonId>> = {
    snap: 'snap', aimed: 'aimed', throw: 'throw', door: 'door', stab: 'stab',
  };
  for (const b of PANEL_BUTTONS) {
    const active = modeButton[ui.mode] === b.id || (b.id === 'alert' && !!u?.alert);
    const blocked = !!u && actionBlocked(u, b.id);
    const state2: ButtonState = active ? 'pressed' : blocked ? 'disabled' : 'raised';
    drawFrame(ctx, b.x, b.y, b.w, b.h, state2);
    drawText(ctx, `${b.key} ${b.label}`, b.x + 3, b.y + 3, active ? UI.accent : blocked ? UI.disabledText : UI.text);
    const cost = u ? actionCost(u, b.id) : null;
    if (cost !== null) {
      drawText(ctx, `${cost} AP`, b.x + 3, b.y + 11, blocked ? UI.red : UI.dim);
    }
  }
}
```

(`drawButton` is not used here because the panel draws a two-line button; the import of `drawButton` can be dropped if the linter complains about the unused name: use `import { UI, drawFrame, type ButtonState } ...`.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: the panel and sound-app tests pass. Other tests may fail because of the taller canvas or moved geometry: any test that checks `VIEW.height`, a panel pixel position, or draws the panel with `fillText` needs the same kind of update; fix those tests (not the code) unless the failure shows a real defect. Record each such test in the ledger as `Task 4: Ruling: updated <test> for the new panel geometry`.

- [ ] **Step 5: Commit**

```bash
git add index.html src tests
git commit -m "feat(ui): 480x400 canvas and the new beveled mission panel in the pixel font

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The equipment screen

**Files:**
- Modify: `src/screens/equipment.ts`, `tests/equipment.test.ts`, `tests/clipsui.test.ts`, `tests/app.test.ts`

**Interfaces:**
- Consumes: `drawFrame`, `drawButton`, `UI`, `Rect`, `ButtonState` (Task 3); `drawText` (Task 2).
- Produces: the new `EQ` geometry (`weapon: { x: 76, w: 100 }`, `minus: { x: 262, w: 24 }`, `plus: { x: 322, w: 24 }`, `start: { x: 170, y: 330, w: 140, h: 30 }`); `drawEquipment` drawn with the pixel font and beveled buttons; `equipmentHit` and every other export keep their signatures.

- [ ] **Step 1: Update the tests to the new geometry (they fail first)**

`tests/equipment.test.ts`, test "finds the weapon, minus, plus and start buttons": replace its expectations with

```ts
    expect(equipmentHit(100, 68)).toEqual({ kind: 'weapon', index: 0 });
    expect(equipmentHit(100, 120)).toEqual({ kind: 'weapon', index: 1 });
    expect(equipmentHit(270, 172)).toEqual({ kind: 'minus', index: 2 });
    expect(equipmentHit(330, 224)).toEqual({ kind: 'plus', index: 3 });
    expect(equipmentHit(240, 345)).toEqual({ kind: 'start' });
```

`tests/clipsui.test.ts`, test "are hit-tested on a second line under the grenade controls": replace with

```ts
    expect(equipmentHit(270, 86)).toEqual({ kind: 'clipMinus', index: 0 });
    expect(equipmentHit(330, 86)).toEqual({ kind: 'clipPlus', index: 0 });
    expect(equipmentHit(270, 242)).toEqual({ kind: 'clipMinus', index: 3 });
    expect(equipmentHit(270, 68)).toEqual({ kind: 'minus', index: 0 }); // the grenade line is unchanged
    expect(equipmentHit(200, 86)).toBeNull();
```

`tests/app.test.ts`: change `const START = { x: 240, y: 315 };` to `const START = { x: 240, y: 345 };`; in the test about the double-click guard keep the two clicks at `{ x: 200, y: 301 }` but fix the comment to `// a map tile (the Start button now sits below the map)`; in the test that clicks `{ x: 260, y: 224 }` ("fourth soldier's grenade minus, overlapping the Continue button") change both clicks to `{ x: 270, y: 224 }`. Also change the same `START` constant in `tests/soundapp.test.ts` to `{ x: 240, y: 345 }`.

Add a drawing test to `tests/equipment.test.ts` (and the imports `drawEquipment` from the screen, `unsupportedChars` from `../src/ui/font`, `onText` from `../src/ui/text`, `textWidth` from `../src/ui/font`):

```ts
describe('drawEquipment', () => {
  it('draws only supported text and keeps every label inside its button', () => {
    const runs: { text: string; x: number; y: number; width: number; align: string }[] = [];
    const stop = onText((r) => runs.push(r));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawEquipment(ctx, defaultLoadout(), null, {
      budget: 200,
      title: 'MISSION 3 OF 3: COMPOUND',
      breakdown: 'Base 120 + wins 40 + kills 40',
      soldiers: [
        { name: 'Lindqvist 2', kills: 99, rank: 'Sergeant' },
        { name: 'Alvarez', kills: 0, rank: 'Rookie' },
        { name: 'Brandt', kills: 4, rank: 'Private' },
        { name: 'Chen', kills: 12, rank: 'Captain' },
      ],
      stash: { rifle: 2, pistol: 1, grenade: 3 },
    });
    stop();
    for (const r of runs) expect(unsupportedChars(r.text), r.text).toEqual([]);
    const name = runs.find((r) => r.text === 'Lindqvist 2')!;
    expect(name.x + textWidth(name.text)).toBeLessThanOrEqual(76); // clear of the weapon button at x 76
    const start = runs.find((r) => r.text.startsWith('START MISSION'))!;
    expect(textWidth(start.text) + 6).toBeLessThanOrEqual(140);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/equipment.test.ts tests/clipsui.test.ts tests/app.test.ts tests/soundapp.test.ts`
Expected: FAIL (old geometry).

- [ ] **Step 3: Implement**

In `src/screens/equipment.ts`:
- Replace the `EQ` constant with:

```ts
export const EQ = {
  rowTop: 56,
  rowStep: 52,
  btnH: 24,
  clipDy: 26,
  weapon: { x: 76, w: 100 },
  minus: { x: 262, w: 24 },
  plus: { x: 322, w: 24 },
  start: { x: 170, y: 330, w: 140, h: 30 },
} as const;
```

- Remove the local `button(...)` helper and the `import { VIEW }` use of font setup, and add the imports `import { UI, drawButton, drawFrame, type ButtonState } from '../ui/frame';` and `import { drawText } from '../ui/text';`.
- Replace `drawEquipment` with:

```ts
const buttonState = (enabled: boolean, hot: boolean): ButtonState => (!enabled ? 'disabled' : hot ? 'hover' : 'raised');

export function drawEquipment(
  ctx: CanvasRenderingContext2D,
  l: Loadout,
  hover: EquipmentHit | null,
  view: EquipmentView = DEFAULT_VIEW,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const cost = loadoutCost(l, view.stash);
  drawText(ctx, view.title, 20, 8, UI.accent);
  drawText(ctx, `Credits ${cost}/${view.budget}  (${view.budget - cost} left)`, 20, 22, UI.dim);
  drawFrame(ctx, 18, 32, 444, 12, 'inset');
  ctx.fillStyle = cost <= view.budget ? UI.blue : UI.red;
  ctx.fillRect(20, 34, Math.round(440 * Math.min(1, cost / view.budget)), 8);
  drawText(ctx, view.breakdown, 20, 47, UI.hint);

  l.forEach((s, i) => {
    const y = rowY(i);
    const hot = (kind: Exclude<EquipmentHit['kind'], 'start'>) =>
      hover !== null && hover.kind !== 'start' && hover.kind === kind && hover.index === i;
    const who = view.soldiers[i];
    if (who) {
      soldierLines(who).forEach((line, n) => drawText(ctx, line, 8, y + 3 + n * 11, n === 0 ? UI.text : UI.dim));
    } else {
      drawText(ctx, `P${i + 1}`, 8, y + 3, UI.text);
    }
    drawButton(
      ctx, { x: EQ.weapon.x, y, w: EQ.weapon.w, h: EQ.btnH },
      `${WEAPONS[s.weapon].name} (${LOADOUT.prices[s.weapon]})`,
      buttonState(toggleBlockReason(l, i, view.budget, view.stash) === null, hot('weapon')),
    );
    drawText(ctx, 'Grenades', 190, y + 8, UI.dim);
    drawButton(ctx, { x: EQ.minus.x, y, w: EQ.minus.w, h: EQ.btnH }, '-',
      buttonState(grenadeBlockReason(l, i, -1, view.budget, view.stash) === null, hot('minus')));
    drawText(ctx, `${s.grenades}`, 304, y + 8, UI.text, 'center');
    drawButton(ctx, { x: EQ.plus.x, y, w: EQ.plus.w, h: EQ.btnH }, '+',
      buttonState(grenadeBlockReason(l, i, 1, view.budget, view.stash) === null, hot('plus')));

    const cy = y + EQ.clipDy;
    drawText(ctx, 'Spare clips', 190, cy + 8, UI.dim);
    drawButton(ctx, { x: EQ.minus.x, y: cy, w: EQ.minus.w, h: EQ.btnH }, '-',
      buttonState(clipBlockReason(l, i, -1, view.budget, view.stash) === null, hot('clipMinus')));
    drawText(ctx, `${s.clips}`, 304, cy + 8, UI.text, 'center');
    drawButton(ctx, { x: EQ.plus.x, y: cy, w: EQ.plus.w, h: EQ.btnH }, '+',
      buttonState(clipBlockReason(l, i, 1, view.budget, view.stash) === null, hot('clipPlus')));
    drawText(ctx, `${soldierCost(s)} cr`, 380, y + 8, UI.dim);
  });

  const reason = hover ? blockReasonFor(l, hover, view.budget, view.stash) : null;
  drawText(
    ctx, reason ?? 'Click a weapon to swap it; + and - for grenades and spare clips', 20, 272,
    reason ? UI.accent : UI.hint,
  );

  const found = describeStash(view.stash);
  if (found) drawText(ctx, `Found gear is free: ${found}`, 20, 286, UI.green);

  const valid = validateLoadout(l, view.budget, view.stash) === null;
  const st = EQ.start;
  drawButton(ctx, { x: st.x, y: st.y, w: st.w, h: st.h }, 'START MISSION (Enter)',
    buttonState(valid, hover?.kind === 'start'));
}
```

(Keep the existing imports of `describeStash`, `soldierCost`, `LOADOUT`, `WEAPONS`, `VIEW` etc. that the function uses; remove any import that becomes unused.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. Fix any other test that uses an old equipment pixel position (grep tests for `y: 315`, `x: 260`, `x: 320`) the same way and record it in the ledger.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(ui): equipment screen in the pixel font with beveled buttons

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Result card, end screen, sound hint and gallery

**Files:**
- Modify: `src/screens/result.ts`, `src/screens/end.ts`, `src/app.ts`, `src/art/gallery.ts`

**Interfaces:**
- Consumes: `drawFrame`, `drawButton`, `UI` (Task 3); `drawText`, `clipText` (Task 2); `textWidth` (Task 1).
- Produces: `drawResult` and `drawCampaignEnd` drawn with frames and the pixel font (geometry and exports unchanged, including `clip`); the sound notice (right-aligned top right, on an inset frame) and key hint drawn with `drawText`; gallery labels and a font sample drawn with `drawText`.

- [ ] **Step 1: Write the failing tests**

Create `tests/screens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { drawCampaignEnd } from '../src/screens/end';
import { drawResult } from '../src/screens/result';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

function collect(draw: (ctx: CanvasRenderingContext2D) => void) {
  const runs: { text: string; x: number; y: number; width: number; align: string }[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  stop();
  return runs;
}

const left = (r: { x: number; width: number; align: string }) =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

describe('result card', () => {
  it('keeps every line inside the card, with four promotions and long fallen names', () => {
    const runs = collect((ctx) => drawResult(ctx, {
      result: { won: true, survivors: 2, squadSize: 4, enemiesKilled: 8, enemyCount: 8, turns: 12 },
      missionName: 'Compound',
      fallen: ['Lindqvist 2', 'Kowalski', 'Fontaine', 'Eriksen'],
      nextBudget: 215,
      promoted: ['Lindqvist 2 (Sergeant)', 'Alvarez (Captain)', 'Brandt (Private)', 'Chen (Sergeant)'],
    }));
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(110);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(370 - 8);
    }
    expect(runs.some((r) => r.text.startsWith('Promoted: Lindqvist'))).toBe(true);
    expect(runs.filter((r) => r.text.startsWith('Promoted:'))).toHaveLength(4);
    expect(runs.some((r) => r.text.includes('CONTINUE') || r.text.includes('Continue'))).toBe(true);
  });
});

describe('end screen', () => {
  it('keeps every line inside the card, with long survivor and fallen lists', () => {
    const runs = collect((ctx) => drawCampaignEnd(ctx, {
      won: true, missionsWon: 3, missionCount: 3, totalKills: 31,
      survivors: ['Alvarez', 'Brandt', 'Chen', 'Dubois', 'Eriksen', 'Fontaine'],
      fallen: ['Garcia', 'Haddad', 'Ivanov', 'Jensen', 'Kowalski', 'Lindqvist'],
    }));
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(90);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(390 - 8);
    }
    const button = runs.find((r) => r.text.includes('NEW CAMPAIGN'))!;
    expect(textWidth(button.text) + 6).toBeLessThanOrEqual(130);
    expect(runs.some((r) => r.text.includes('CAMPAIGN COMPLETE'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/screens.test.ts`
Expected: FAIL (the screens still use `fillText`, so `onText` records nothing).

- [ ] **Step 3: Implement**

`src/screens/result.ts`: replace the `drawResult` body with the framed version (keep `ResultView`, `RESULT`, `resultHit`, `promotionLines` as they are; add the imports `import { UI, drawButton, drawFrame } from '../ui/frame'; import { clipText, drawText } from '../ui/text'; import { textWidth } from '../ui/font';` and drop the `clip` import if unused):

```ts
export function drawResult(ctx: CanvasRenderingContext2D, v: ResultView): void {
  const r = v.result;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = RESULT.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 28, 'inset');
  drawText(ctx, r.won ? 'MISSION COMPLETE' : 'MISSION FAILED', c.x + c.w / 2, c.y + 12, r.won ? UI.green : UI.red, 'center');
  drawText(ctx, v.missionName, c.x + c.w / 2, c.y + 24, UI.dim, 'center');

  const x = c.x + 30;
  const room = c.w - 30 - 8; // 222 px of card to the right of the text start
  drawText(ctx, `Survivors     ${r.survivors} of ${r.squadSize}`, x, c.y + 52, UI.text);
  drawText(ctx, `Enemies down  ${r.enemiesKilled} of ${r.enemyCount}`, x, c.y + 68, UI.text);
  drawText(ctx, `Turns taken   ${r.turns}`, x, c.y + 84, UI.text);
  const fallen = v.fallen.length > 0 ? v.fallen.join(', ') : 'none';
  drawText(ctx, `Fallen: ${clipText(fallen, room - textWidth('Fallen: '))}`, x, c.y + 100, UI.text);
  drawText(
    ctx, v.nextBudget === null ? 'The campaign is over' : `Next mission budget: ${v.nextBudget}`,
    x, c.y + 116, UI.accent,
  );
  promotionLines(v.promoted).forEach((line, i) => {
    drawText(ctx, clipText(line, room), x, c.y + 128 + i * 10, UI.green);
  });

  const b = RESULT.again;
  drawButton(ctx, { x: b.x, y: b.y, w: b.w, h: b.h }, 'CONTINUE (Enter)', 'raised');
}
```

(`CONTINUE (Enter)` is 16 characters, 95 px, and fits the 100 px button; `drawButton` centres it.)

`src/screens/end.ts`: add the same kind of imports (keep the `clip` export and its use only if still needed; the screen now uses `clipText`) and replace `drawCampaignEnd` with:

```ts
export function drawCampaignEnd(ctx: CanvasRenderingContext2D, v: EndView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = END.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 30, 'inset');
  drawText(ctx, v.won ? 'CAMPAIGN COMPLETE' : 'CAMPAIGN LOST', c.x + c.w / 2, c.y + 20, v.won ? UI.green : UI.red, 'center');

  const x = c.x + 30;
  const room = c.w - 30 - 8; // 262 px
  drawText(ctx, `Missions won  ${v.missionsWon} of ${v.missionCount}`, x, c.y + 60, UI.text);
  drawText(ctx, `Total kills   ${v.totalKills}`, x, c.y + 80, UI.text);
  const survivors = v.survivors.length > 0 ? v.survivors.join(', ') : 'none';
  drawText(ctx, `Survivors: ${clipText(survivors, room - textWidth('Survivors: '))}`, x, c.y + 110, UI.text);
  const fallenLabel = `Fallen (${v.fallen.length}): `;
  const fallen = v.fallen.length > 0 ? v.fallen.join(', ') : 'none';
  drawText(ctx, `${fallenLabel}${clipText(fallen, room - textWidth(fallenLabel))}`, x, c.y + 130, UI.text);

  const b = END.again;
  drawButton(ctx, { x: b.x, y: b.y, w: b.w, h: b.h }, 'NEW CAMPAIGN (Enter)', 'raised');
}
```

`src/app.ts`: add `import { UI, drawFrame } from './ui/frame'; import { drawText } from './ui/text'; import { textWidth } from './ui/font';` and replace the body of `drawSoundHint` with:

```ts
  private drawSoundHint(ctx: CanvasRenderingContext2D): void {
    if (this.clock() < this.noticeUntil) {
      const w = textWidth(this.noticeText) + 10;
      drawFrame(ctx, VIEW.width - 6 - w, 2, w, 13, 'inset');
      drawText(ctx, this.noticeText, VIEW.width - 11, 5, UI.accent, 'right');
    } else if (this.screen !== 'mission') {
      drawText(ctx, 'M: sound on/off   - =: volume', VIEW.width - 6, VIEW.height - 12, UI.hint, 'right');
    }
  }
```

`src/art/gallery.ts`: replace the label drawing with `drawText(ctx, name.replace('soldier', 'sold').replace('door_', 'd_').slice(0, 9), x, y + 16 * SCALE + 2, '#8a8fa8');`, remove the `ctx.font`/`ctx.textBaseline`/`fillText` lines, add a font sample after the loop:

```ts
  drawText(ctx, 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', 4, 262, '#e8e8f0');
  drawText(ctx, '0123456789 .,:;!?\'"-+=/()[]<>%*#_&@$~|', 4, 274, '#ffe14d');
```

(add `import { drawText } from '../ui/text';`; the gallery test still draws every sprite once at 3x, and its canvas bound is unchanged).

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass, including `tests/soundapp.test.ts` (the notice and hint texts are still found through `onText`).

- [ ] **Step 5: Commit**

```bash
git add src tests/screens.test.ts
git commit -m "feat(ui): result card, end screen, sound notice and gallery in the pixel font

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Layout and leftovers check, docs, visual review

**Files:**
- Create: `tests/layout.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the tests**

Create `tests/layout.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { VIEW } from '../src/render/layout';
import { drawGame } from '../src/render/renderer';
import { Effects } from '../src/render/effects';
import { createUiState } from '../src/input/uiState';
import { createMission, MISSIONS } from '../src/core/missions';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

function collect(draw: () => void): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  draw();
  stop();
  return runs;
}

const rect = (r: TextRun) => {
  const x = r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);
  return { x, y: r.y, w: r.width, h: 7 };
};

function check(name: string, runs: TextRun[]) {
  expect(runs.length, name).toBeGreaterThan(0);
  for (const r of runs) {
    expect(unsupportedChars(r.text), `${name}: ${r.text}`).toEqual([]);
    const b = rect(r);
    expect(b.x, `${name}: ${r.text}`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w, `${name}: ${r.text}`).toBeLessThanOrEqual(VIEW.width);
    expect(b.y + b.h, `${name}: ${r.text}`).toBeLessThanOrEqual(VIEW.height);
  }
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = rect(runs[i]);
      const b = rect(runs[j]);
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${name}: "${runs[i].text}" overlaps "${runs[j].text}"`).toBe(false);
    }
  }
}

describe('every screen lays out inside the canvas, with the longest content', () => {
  it('the equipment screen at the start and in a later mission with long names', () => {
    const fresh = new App({ clock: () => 0 });
    check('equipment (new)', collect(() => fresh.draw(ctx, 0)));

    const later = new App({ clock: () => 0 });
    later.campaign.missionsWon = 2;
    later.campaign.roster = [
      { name: 'Lindqvist 2', kills: 99 }, { name: 'Kowalski 2', kills: 12 }, { name: 'Fontaine', kills: 5 }, { name: 'Dubois', kills: 2 },
    ];
    later.campaign.stash = { rifle: 2, pistol: 1, grenade: 3 };
    check('equipment (late)', collect(() => later.draw(ctx, 0)));
  });

  it('the mission view, with a long message and the longest soldier name', () => {
    const roster = [
      { name: 'Lindqvist 2', kills: 9 }, { name: 'B', kills: 0 }, { name: 'C', kills: 0 }, { name: 'D', kills: 0 },
    ];
    const state = createMission(MISSIONS[0], 1, roster);
    const ui = createUiState('p1');
    ui.message = 'Lindqvist 2 on alert: fires once at each enemy that moves into view';
    ui.messageUntil = Infinity;
    state.units.find((u) => u.id === 'p1')!.alert = true;
    state.turnNumber = 99;
    check('mission', collect(() => drawGame(ctx, state, ui, new Effects(), 0)));
  });

  it('the result card and the end screen', () => {
    const app = new App({ clock: () => 0 });
    app.screen = 'result';
    app.result = { won: true, survivors: 2, squadSize: 4, enemiesKilled: 8, enemyCount: 8, turns: 12 };
    app.promoted = ['Lindqvist 2 (Sergeant)', 'Alvarez (Captain)', 'Brandt (Private)', 'Chen (Sergeant)'];
    // the card draws over the last mission view, so give it a controller to draw under it
    app.controller = new (class extends Object {})() as never;
    expect(true).toBe(true);
  });
});

describe('no leftover system fonts', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
    });

  it('only src/ui/text.ts may draw text or set a font', () => {
    for (const file of walk('src')) {
      const source = readFileSync(file, 'utf8');
      if (file.replace(/\\/g, '/').endsWith('src/ui/text.ts')) continue;
      expect(source, file).not.toMatch(/\.fillText\(/);
      expect(source, file).not.toMatch(/monospace/);
    }
  });
});
```

The third test above is a stub; replace its body with a real one when writing the file. Use `drawResult` and `drawCampaignEnd` directly (they take plain views, no `App` needed):

```ts
  it('the result card and the end screen', () => {
    check('result', collect(() => drawResult(ctx, {
      result: { won: true, survivors: 2, squadSize: 4, enemiesKilled: 8, enemyCount: 8, turns: 12 },
      missionName: 'Compound',
      fallen: ['Lindqvist 2', 'Kowalski', 'Fontaine', 'Eriksen'],
      nextBudget: 215,
      promoted: ['Lindqvist 2 (Sergeant)', 'Alvarez (Captain)', 'Brandt (Private)', 'Chen (Sergeant)'],
    })));
    check('end', collect(() => drawCampaignEnd(ctx, {
      won: false, missionsWon: 1, missionCount: 3, totalKills: 9,
      survivors: [], fallen: ['Lindqvist 2', 'Kowalski 2', 'Fontaine 2', 'Eriksen 2'],
    })));
  });
```

with the imports `drawResult` (from `../src/screens/result`) and `drawCampaignEnd` (from `../src/screens/end`); remove the stub lines (`app.screen = 'result'` ... `expect(true).toBe(true)`).

- [ ] **Step 2: Run the layout tests**

Run: `npx vitest run tests/layout.test.ts`
Expected: they should pass. If a layout test reports an overlap or an overflow, fix the geometry or shorten the text in the screen that drew it (not the test), and record the change in the ledger as a Ruling. A failure in the "no leftover system fonts" test names the file: replace its `fillText` or `monospace` use with `drawText`.

- [ ] **Step 3: Full verification**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 4: Visual review in the browser**

Start the dev server with `preview_start` (`laser-tribute`) and use `resize_window` with 1000x760. For each screen, take a screenshot and (to see the pixels) copy a region into a magnified `<canvas id="zoom">` on the page as in milestone 7. Check each of these and write what you see in the ledger:
1. Equipment screen (reload the page): the title, credits bar in an inset frame, four soldier rows with name, rank and kills, beveled weapon and +/- buttons, the Start button at the bottom; no overlapping text; the sound hint bottom-right.
2. Mission: start a mission (`app.click({x:240,y:345})`), then take a screenshot: the 80 px panel with the left well (name, HP and AP, weapon line, hints), the turn line, a message line (press `s` to see `SNAP SHOT: 15 AP` or trigger a long message with `app.controller.key('l')`), and the two rows of buttons with costs; the pressed look of the active mode (`app.controller.key('k')`); a red cost on a blocked button.
3. Result card: `app.screen = 'result'; app.result = {won:true, survivors:3, squadSize:4, enemiesKilled:4, enemyCount:4, turns:7}; app.promoted = ['Alvarez (Captain)','Brandt (Sergeant)']; app.draw(...)`.
4. End screen: `app.screen = 'end'` (set `app.campaign.status = 'won'`).
5. The page layout: the canvas shows at the 6:5 ratio without being cut off or scrolled.
6. Run the gallery (`app.draw = () => {}; gallery()`) and read the font sample lines: every letter, digit and punctuation mark should look like itself. Any glyph that looks wrong is a data fix in `src/ui/font.ts`.
Fix what is wrong, with at most two rounds, and record each change in the ledger as `Task 7: Ruling: <what> - <why> - <cost if wrong>`. Check `read_console_messages` for errors. Stop the server with `preview_stop`.

- [ ] **Step 5: Update the README and commit**

Read `README.md`: in the "Graphics" paragraph add that the interface uses a 5x7 pixel font (capitals only) and beveled frames drawn in code (`src/ui`), and that the canvas is 480x400. Then:

```bash
git add src tests README.md
git commit -m "feat(ui): layout and leftovers checks, docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** font data and measurement (Task 1); `FontAtlas`, `drawText`, `clipText`, listener (Task 2); frames, buttons and UI colours (Task 3); 480x400 canvas, `index.html` aspect ratio, new panel with the agreed geometry, "!" mark (Task 4); equipment geometry and drawing (Task 5); result card, end screen, sound notice and hint, gallery font sample (Task 6); layout check across screens with the longest content, a leftover-`fillText`/`monospace` guard, README and a visual review (Task 7). The spec's "positions recorded in the plan" for result/end buttons: geometry is unchanged. A small addition not in the spec: the sound notice sits on an inset frame (the milestone 6 minor about readability).

**Placeholders:** none; the one intentional stub in Task 7's test text is called out and replaced by the full test shown next to it.

**Type consistency:** `FontAtlas`, `drawText(ctx, text, x, y, colour, align?, atlas?)`, `clipText`, `onText`, `TextRun` (Task 2) are used by `drawButton` (Task 3), the panel (Task 4), equipment (Task 5), result, end, app and gallery (Task 6) and the tests (Tasks 4 to 7); `UI`, `drawFrame`, `drawButton`, `ButtonState`, `Rect` (Task 3) are used in Tasks 4 to 6; `defaultCanvas` is exported from `atlas.ts` in Task 2 and used by `FontAtlas`.

**Review Focus coverage:** glyph shape, distinctness and charset (Tasks 1 and 7), `clipText`/alignment/no-canvas (Task 2), button label fit and non-overlap (Task 4), longest content on every screen (Task 7), canvas change and hit areas (Tasks 4, 5 and 7), leftover system fonts (Task 7).
