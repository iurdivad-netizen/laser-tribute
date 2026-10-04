# Laser Tribute Milestone 7 Implementation Plan (world graphics)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder shapes of the mission view with pixel art drawn in code: soldiers and enemies facing eight directions, textured tiles, item icons, corpses, and shot, hit, stab, death and explosion animations.

**Architecture:** Sprites are 16x16 grids of palette letters held as data in `src/art/sprites.ts`. One authored soldier (facing north) is rotated by code to get the other directions, and the enemy is a recolour of the soldier. `src/art/sprite.ts` holds the pure helpers (parse, flip, rotate, recolour, facing mapping, tile variants, rank pips, barrel, animation frames). `src/art/atlas.ts` bakes each sprite once into an offscreen canvas and stamps it with `drawImage` (it draws nothing when no canvas exists). The renderer and the effects layer switch from shapes to sprites. The rules, sounds and layout constants are untouched.

**Tech Stack:** TypeScript, HTML5 Canvas, Vite, Vitest (`npx vitest run`, `npx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-04-laser-tribute-milestone7-design.md` (read it first).

## Global Constraints

- `src/core` is not touched and has no browser imports. No image files: all art is data in the source.
- Every sprite is exactly 16 rows of 16 characters; `.` is transparent; every other character must be in `PALETTE`.
- Facing numbers follow `FACING_VECTORS`: 0 north, 1 north-east, 2 east, 3 south-east, 4 south, 5 south-west, 6 west, 7 north-west. Facings 5, 6, 7 are the horizontal mirror of 3, 2, 1.
- The canvas stays 480x360 and the tile 16 px; fog of war, hidden enemies, selection box, health bar, "!" alert mark, path dots and hover box behave exactly as before.
- Pixel positions are rounded to whole pixels when drawing; image smoothing stays off.
- Existing tests (406) must keep passing after every task, except the one stab-effect test that Task 5 deliberately replaces.
- Co-author trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on branch `milestone-7` (created, spec committed).

## Review Focus

- `rotateRows` is exact at multiples of 90 degrees (a 90 degree turn four times is the identity, 360 is the identity) and at 45 degrees never reads outside the grid or drops the sprite. Task 1.
- The north-facing soldier is left-right symmetric, so mirroring facings 1, 2, 3 gives correct facings 7, 6, 5; the face (skin pixels) points the way the unit faces for all eight facings. Tasks 1 and 2.
- Hidden enemies are still not drawn, and a corpse or item out of sight is still not drawn (the renderer visibility rules are unchanged). Task 4.
- With no canvas available the atlas draws nothing, never throws, and the renderer and effects still complete. Tasks 3, 4 and 5.
- Effect sprites always pick a frame inside the range, fade out and are removed after their life; the sprite effects replace the old circle and line without leaving the old ones behind. Task 5.
- The frame time does not regress (measured in the browser). Task 6.

## File Structure

- Create `src/art/palette.ts`, `src/art/sprite.ts`, `src/art/sprites.ts`, `src/art/atlas.ts`, `src/art/gallery.ts`.
- Modify `src/render/renderer.ts`, `src/render/effects.ts`, `src/main.ts`, `README.md`.
- Tests: create `tests/art.test.ts`, `tests/sprites.test.ts`, `tests/atlas.test.ts`, `tests/artrender.test.ts`, `tests/arteffects.test.ts`; modify `tests/knifeui.test.ts` (the stab effect test).

---

### Task 1: Palette and pure sprite helpers

**Files:**
- Create: `src/art/palette.ts`, `src/art/sprite.ts`
- Test: `tests/art.test.ts`

**Interfaces:**
- Produces (`palette.ts`): `PALETTE: Record<string, string>` (one character per colour), `TRANSPARENT = '.'`.
- Produces (`sprite.ts`): `SPRITE_SIZE = 16`; `interface Sprite { name: string; width: number; height: number; pixels: (string | null)[] }` (row-major, a palette letter or `null`); `parseSprite(name, rows): Sprite` (throws a clear error for a wrong size or an unknown character); `flipHorizontal(s: Sprite): Sprite`; `rotateRows(rows: string[], degrees: number): string[]` (clockwise, nearest-neighbour about the centre of a square grid); `recolorRows(rows: string[], map: Record<string, string>): string[]`; `unitSprite(side: Side, facing: Facing): { name: SpriteName; flip: boolean }`; `floorVariant(x: number, y: number): 0 | 1 | 2`; `rankPips(rank: string): number`; `pipPositions(count: number): { x: number; y: number }[]`; `barrel(weapon: WeaponId, facing: Facing): { dx: number; dy: number }[]`; `directionTo(from: Pos, to: Pos): Pos`; `frameFor(progress: number, count: number): number`.
- `SpriteName` is a type exported by `sprites.ts` (Task 2); `sprite.ts` imports it with `import type`, so there is no runtime cycle.

- [ ] **Step 1: Write the failing tests**

Create `tests/art.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PALETTE, TRANSPARENT } from '../src/art/palette';
import {
  SPRITE_SIZE, barrel, directionTo, flipHorizontal, floorVariant, frameFor, parseSprite, pipPositions,
  rankPips, recolorRows, rotateRows, unitSprite,
} from '../src/art/sprite';
import type { Facing } from '../src/core/types';

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
    expect(() => parseSprite('t', blank().slice(1))).toThrow(/15 rows/);
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
  it('maps facings 0 to 4 to the five base sprites and 5, 6, 7 to the mirrors of 3, 2, 1', () => {
    const expected: [Facing, string, boolean][] = [
      [0, 'n', false], [1, 'ne', false], [2, 'e', false], [3, 'se', false], [4, 's', false],
      [5, 'se', true], [6, 'e', true], [7, 'ne', true],
    ];
    for (const [facing, suffix, flip] of expected) {
      expect(unitSprite('player', facing)).toEqual({ name: `soldier_${suffix}`, flip });
      expect(unitSprite('enemy', facing)).toEqual({ name: `enemy_${suffix}`, flip });
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

  it('places the pips along the bottom-left corner of the tile', () => {
    expect(pipPositions(0)).toEqual([]);
    expect(pipPositions(3)).toEqual([{ x: 1, y: 14 }, { x: 3, y: 14 }, { x: 5, y: 14 }]);
  });
});

describe('barrel', () => {
  it('is 3 pixels for the pistol and 5 for the rifle, starting 3 pixels out', () => {
    expect(barrel('pistol', 2)).toEqual([{ dx: 3, dy: 0 }, { dx: 4, dy: 0 }, { dx: 5, dy: 0 }]);
    expect(barrel('rifle', 2)).toHaveLength(5);
    expect(barrel('rifle', 2)[0]).toEqual({ dx: 3, dy: 0 });
  });

  it('points along the facing for all eight facings', () => {
    const vec: Record<Facing, [number, number]> = {
      0: [0, -1], 1: [1, -1], 2: [1, 0], 3: [1, 1], 4: [0, 1], 5: [-1, 1], 6: [-1, 0], 7: [-1, -1],
    };
    for (const f of [0, 1, 2, 3, 4, 5, 6, 7] as Facing[]) {
      const [vx, vy] = vec[f];
      const pixels = barrel('rifle', f);
      expect(pixels[0]).toEqual({ dx: vx * 3 || 0, dy: vy * 3 || 0 });
      expect(pixels[4]).toEqual({ dx: vx * 7 || 0, dy: vy * 7 || 0 });
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/art.test.ts`
Expected: FAIL (cannot find module `../src/art/palette`).

- [ ] **Step 3: Implement**

Create `src/art/palette.ts`:

```ts
/** One character per colour. A slightly muted, Amiga-era set: blue for the player's side, red for the enemy. */
export const PALETTE: Record<string, string> = {
  k: '#0b0c12', K: '#1c1f2e', // outline, dark
  g: '#2f3347', G: '#3a3f57', h: '#262a3d', // floor
  w: '#8b8fa8', W: '#b8bcd4', v: '#5d6178', // wall
  B: '#4da6ff', C: '#9bd2ff', N: '#2a6fb8', // blue team
  R: '#ff5555', P: '#ff9a9a', M: '#b02a2a', // red team
  s: '#f0c8a0', // skin
  y: '#ffe14d', o: '#ff9a2e', f: '#ffffff', u: '#a01818', // flash, fire, white, blood
  O: '#b5651d', d: '#8a4d12', D: '#5a3a1a', // door
  e: '#3cb371', E: '#26734a', // grenade
  a: '#d0d0d0', A: '#8a8a99', // gun metal
};

export const TRANSPARENT = '.';
```

Create `src/art/sprite.ts`:

```ts
import type { Facing, Pos, Side, WeaponId } from '../core/types';
import { PALETTE, TRANSPARENT } from './palette';
import type { SpriteName } from './sprites';

export const SPRITE_SIZE = 16;

export interface Sprite {
  name: string;
  width: number;
  height: number;
  /** Row-major: a palette letter, or null for transparent. */
  pixels: (string | null)[];
}

export function parseSprite(name: string, rows: readonly string[]): Sprite {
  if (rows.length !== SPRITE_SIZE) throw new Error(`${name}: expected ${SPRITE_SIZE} rows, got ${rows.length}`);
  const pixels: (string | null)[] = [];
  rows.forEach((row, y) => {
    if (row.length !== SPRITE_SIZE) {
      throw new Error(`${name}: row ${y} has ${row.length} characters, expected ${SPRITE_SIZE}`);
    }
    for (const ch of row) {
      if (ch === TRANSPARENT) pixels.push(null);
      else if (PALETTE[ch] !== undefined) pixels.push(ch);
      else throw new Error(`${name}: unknown colour '${ch}' in row ${y}`);
    }
  });
  return { name, width: SPRITE_SIZE, height: SPRITE_SIZE, pixels };
}

export function flipHorizontal(s: Sprite): Sprite {
  const pixels: (string | null)[] = [];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) pixels.push(s.pixels[y * s.width + (s.width - 1 - x)]);
  }
  return { ...s, pixels };
}

/** Turns a square grid clockwise about its centre (nearest neighbour); anything that falls outside is transparent. */
export function rotateRows(rows: string[], degrees: number): string[] {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const size = rows.length;
  const c = (size - 1) / 2;
  const out: string[] = [];
  for (let y = 0; y < size; y++) {
    let line = '';
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const sx = Math.round(dx * cos + dy * sin + c);
      const sy = Math.round(-dx * sin + dy * cos + c);
      line += sx >= 0 && sx < size && sy >= 0 && sy < size ? rows[sy][sx] : TRANSPARENT;
    }
    out.push(line);
  }
  return out;
}

export function recolorRows(rows: string[], map: Record<string, string>): string[] {
  return rows.map((r) => [...r].map((ch) => map[ch] ?? ch).join(''));
}

const FACING_SUFFIX = ['n', 'ne', 'e', 'se', 's'] as const;

/** Facings 0 to 4 have their own sprite; 5, 6, 7 are the horizontal mirror of 3, 2, 1. */
export function unitSprite(side: Side, facing: Facing): { name: SpriteName; flip: boolean } {
  const flip = facing > 4;
  const base = flip ? 8 - facing : facing;
  const prefix = side === 'player' ? 'soldier' : 'enemy';
  return { name: `${prefix}_${FACING_SUFFIX[base]}` as SpriteName, flip };
}

/** Which of the three floor sprites a tile uses: a fixed hash of its position, so the floor never flickers. */
export function floorVariant(x: number, y: number): 0 | 1 | 2 {
  return ((((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) >>> 3) % 3) as 0 | 1 | 2;
}

const PIPS: Record<string, number> = { Private: 1, Sergeant: 2, Captain: 3 };

export function rankPips(rank: string): number {
  return PIPS[rank] ?? 0;
}

export function pipPositions(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => ({ x: 1 + 2 * i, y: 14 }));
}

const FACING_STEP: Record<Facing, [number, number]> = {
  0: [0, -1], 1: [1, -1], 2: [1, 0], 3: [1, 1], 4: [0, 1], 5: [-1, 1], 6: [-1, 0], 7: [-1, -1],
};

/** The gun barrel as pixel offsets from the tile centre, along the facing: 3 for a pistol, 5 for a rifle. */
export function barrel(weapon: WeaponId, facing: Facing): { dx: number; dy: number }[] {
  const [vx, vy] = FACING_STEP[facing];
  const length = weapon === 'rifle' ? 5 : 3;
  return Array.from({ length }, (_, i) => ({ dx: vx * (3 + i) || 0, dy: vy * (3 + i) || 0 }));
}

/** The sign of each axis from one tile to another. */
export function directionTo(from: Pos, to: Pos): Pos {
  return { x: Math.sign(to.x - from.x) || 0, y: Math.sign(to.y - from.y) || 0 };
}

/** Which of `count` animation frames to show at `progress` (0 up to 1); out-of-range values are clamped. */
export function frameFor(progress: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}
```

`sprite.ts` imports the type `SpriteName` from `./sprites`, which does not exist yet; create a minimal placeholder so this task compiles on its own. Create `src/art/sprites.ts` with only:

```ts
export type SpriteName = string;
```

(Task 2 replaces this file with the real data and a precise `SpriteName` union.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass (406 + the new tests).

- [ ] **Step 5: Commit**

```bash
git add src/art tests/art.test.ts
git commit -m "feat(art): palette and pure sprite helpers (parse, flip, rotate, facing, variants, barrel)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The sprite data

**Files:**
- Modify: `src/art/sprites.ts` (replace the placeholder)
- Test: `tests/sprites.test.ts`

**Interfaces:**
- Consumes: `rotateRows`, `recolorRows` (Task 1).
- Produces: `SPRITE_NAMES` (readonly tuple of the 31 names), `type SpriteName`, `SPRITE_ROWS: Record<SpriteName, string[]>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sprites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flipHorizontal, parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';

/** The average position of the skin pixels: where the face (and hands) are. */
function skinCentre(name: string): { x: number; y: number } {
  const rows = SPRITE_ROWS[name as keyof typeof SPRITE_ROWS];
  let n = 0;
  let sx = 0;
  let sy = 0;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 's') { n += 1; sx += x; sy += y; }
  }));
  return { x: sx / n, y: sy / n };
}

describe('the sprite data', () => {
  it('has exactly the 31 named sprites', () => {
    expect(SPRITE_NAMES).toHaveLength(31);
    expect(Object.keys(SPRITE_ROWS).sort()).toEqual([...SPRITE_NAMES].sort());
  });

  it('every sprite is 16x16, uses only palette letters, has pixels, and flips back to itself', () => {
    for (const name of SPRITE_NAMES) {
      const s = parseSprite(name, SPRITE_ROWS[name]);
      expect(s.pixels.some((p) => p !== null), name).toBe(true);
      expect(flipHorizontal(flipHorizontal(s)).pixels, name).toEqual(s.pixels);
    }
  });

  it('the north soldier is left-right symmetric, so mirrored facings are right', () => {
    for (const row of SPRITE_ROWS.soldier_n) expect([...row].reverse().join('')).toBe(row);
  });

  it('the face points the way the soldier faces, in every direction', () => {
    expect(skinCentre('soldier_n').y).toBeLessThan(7.2);
    expect(skinCentre('soldier_s').y).toBeGreaterThan(7.8);
    expect(skinCentre('soldier_e').x).toBeGreaterThan(7.8);
    const ne = skinCentre('soldier_ne');
    expect(ne.x).toBeGreaterThan(7.8);
    expect(ne.y).toBeLessThan(7.2);
    const se = skinCentre('soldier_se');
    expect(se.x).toBeGreaterThan(7.8);
    expect(se.y).toBeGreaterThan(7.8);
  });

  it('every direction keeps a whole soldier (a similar number of opaque pixels)', () => {
    const count = (name: keyof typeof SPRITE_ROWS) => SPRITE_ROWS[name].join('').replace(/\./g, '').length;
    const n = count('soldier_n');
    for (const name of ['soldier_ne', 'soldier_e', 'soldier_se', 'soldier_s'] as const) {
      expect(count(name)).toBeGreaterThan(n * 0.8);
      expect(count(name)).toBeLessThan(n * 1.2);
    }
  });

  it('the enemy is the soldier in red: no blue, some red, same shape', () => {
    for (const suffix of ['n', 'ne', 'e', 'se', 's']) {
      const soldier = SPRITE_ROWS[`soldier_${suffix}` as 'soldier_n'].join('');
      const enemy = SPRITE_ROWS[`enemy_${suffix}` as 'enemy_n'].join('');
      expect(enemy).not.toMatch(/[BCN]/);
      expect(enemy).toMatch(/R/);
      expect(enemy.replace(/[^.]/g, 'x')).toBe(soldier.replace(/[^.]/g, 'x'));
    }
  });

  it('the three floors differ from each other, and the walls and doors are solid tiles', () => {
    expect(SPRITE_ROWS.floor_0).not.toEqual(SPRITE_ROWS.floor_1);
    expect(SPRITE_ROWS.floor_1).not.toEqual(SPRITE_ROWS.floor_2);
    for (const name of ['wall', 'door_closed', 'door_open'] as const) {
      expect(SPRITE_ROWS[name].join('')).not.toMatch(/\./);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sprites.test.ts`
Expected: FAIL (`SPRITE_NAMES` is not exported by the placeholder).

- [ ] **Step 3: Implement**

Replace `src/art/sprites.ts` with:

```ts
import { recolorRows, rotateRows } from './sprite';

export const SPRITE_NAMES = [
  'soldier_n', 'soldier_ne', 'soldier_e', 'soldier_se', 'soldier_s',
  'enemy_n', 'enemy_ne', 'enemy_e', 'enemy_se', 'enemy_s',
  'floor_0', 'floor_1', 'floor_2', 'wall', 'door_closed', 'door_open',
  'item_pistol', 'item_rifle', 'item_grenade', 'corpse_player', 'corpse_enemy',
  'flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash',
  'boom_0', 'boom_1', 'boom_2', 'boom_3',
] as const;

export type SpriteName = (typeof SPRITE_NAMES)[number];

/** A soldier seen from above, facing north (up): helmet and face at the top, shoulders and hands at the sides. */
const SOLDIER_N = [
  '................',
  '.....kkkkkk.....',
  '....kNBBBBNk....',
  '...kNBCCCCBNk...',
  '...kBCssssCBk...',
  '...kBBssssBBk...',
  '..kkNBBBBBBNkk..',
  '.kssNBBBBBBNssk.',
  '.kssNNBBBBNNssk.',
  '..kkNNBBBBNNkk..',
  '...kNNBBBBNNk...',
  '...kNNNNNNNNk...',
  '....kNNNNNNk....',
  '.....kkkkkk.....',
  '................',
  '................',
];

const ENEMY_COLOURS = { B: 'R', C: 'P', N: 'M' };

const CORPSE_PLAYER = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kNNNNNNNNk...',
  '..kNNssNNNNNNk..',
  '..kNNssNNuuNNk..',
  '..kNNNNNuuuNNk..',
  '...kNNNNNuNNk...',
  '....kkkkkkkk....',
  '................',
  '................',
  '................',
  '................',
];

/** A tile of floor: seams on the bottom and right edge and a few specks, the same for a given variant. */
function floorRows(variant: number): string[] {
  const grid = Array.from({ length: 16 }, () => Array<string>(16).fill('g'));
  for (let i = 0; i < 16; i++) {
    grid[15][i] = 'h';
    grid[i][15] = 'h';
  }
  let seed = 12345 + variant * 7919;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed >>> 8;
  };
  for (let n = 0; n < 7; n++) {
    const x = next() % 14;
    const y = next() % 14;
    grid[y][x] = n % 3 === 0 ? 'G' : 'h';
  }
  return grid.map((r) => r.join(''));
}

/** Brick-like wall with a lit top edge and darker mortar. */
const WALL = (() => {
  const a = 'wwwwwwwvwwwwwwwv';
  const b = 'wwwvwwwwwwwvwwww';
  const m = 'vvvvvvvvvvvvvvvv';
  return ['WWWWWWWWWWWWWWWW', a, a, a, m, b, b, b, m, a, a, a, m, b, b, m];
})();

const DOOR_CLOSED = (() => {
  const frame = 'kkkkkkkkkkkkkkkk';
  const light = 'kOOOOOOOOOOOOOOk';
  const dark = 'kddddddddddddddk';
  const handle = 'kdddddddddddyddk';
  return [frame, light, dark, light, dark, light, dark, light, handle, light, dark, light, dark, light, dark, frame];
})();

const DOOR_OPEN = (() => {
  const edge = 'DDDDDDDDDDDDDDDD';
  const inner = 'D' + 'd'.repeat(14) + 'D';
  const mid = 'Dd' + 'g'.repeat(12) + 'dD';
  return [edge, inner, ...Array.from({ length: 12 }, () => mid), inner, edge];
})();

const FLASH_0 = [
  '................',
  '................',
  '................',
  '.......yy.......',
  '......yooy......',
  '..yy.yoffoy.yy..',
  '...yyoffffoyy...',
  '....yoffffoy....',
  '....yoffffoy....',
  '...yyoffffoyy...',
  '..yy.yoffoy.yy..',
  '......yooy......',
  '.......yy.......',
  '................',
  '................',
  '................',
];

const FLASH_1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oo.......',
  '......oyyo......',
  '.....oyffyo.....',
  '.....oyffyo.....',
  '......oyyo......',
  '.......oo.......',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const SPLASH = [
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

function slashRows(frame: number): string[] {
  const grid = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  const length = frame === 0 ? 8 : 11;
  for (let i = 0; i < length; i++) {
    const x = 13 - i;
    const y = 2 + i;
    grid[y][x] = 'f';
    grid[y][x + 1] = frame === 0 ? 'f' : 'C';
  }
  return grid.map((r) => r.join(''));
}

/** An explosion frame: a fireball that grows, then thins to a dark ring. */
function boomRows(frame: number): string[] {
  const radius = [3.5, 5.5, 7, 7.5][frame];
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let line = '';
    for (let x = 0; x < 16; x++) {
      const t = Math.hypot(x - 7.5, y - 7.5) / radius;
      let ch = '.';
      if (t <= 1) {
        if (frame === 3) ch = t >= 0.6 ? 'M' : '.';
        else ch = t < 0.35 ? 'f' : t < 0.65 ? 'y' : t < 0.9 ? 'o' : 'M';
      }
      line += ch;
    }
    rows.push(line);
  }
  return rows;
}

const ITEM_PISTOL = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kaaaaaaaak...',
  '...kkkkkAAkkk...',
  '......kAAk......',
  '......kAAk......',
  '......kkkk......',
  '................',
  '................',
  '................',
  '................',
];

const ITEM_RIFLE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kaaaaaaaaaaaak.',
  '.kkkAAAkkkkkkkk.',
  '....kAAk........',
  '....kkkk........',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const ITEM_GRENADE = [
  '................',
  '................',
  '................',
  '................',
  '......kk........',
  '.....kyyk.......',
  '....kkkkkk......',
  '...keeeeeEk.....',
  '...keeeeeEk.....',
  '...keeeeEEk.....',
  '...kEEEEEEk.....',
  '....kkkkkk......',
  '................',
  '................',
  '................',
  '................',
];

const soldier = {
  soldier_n: SOLDIER_N,
  soldier_ne: rotateRows(SOLDIER_N, 45),
  soldier_e: rotateRows(SOLDIER_N, 90),
  soldier_se: rotateRows(SOLDIER_N, 135),
  soldier_s: rotateRows(SOLDIER_N, 180),
};

export const SPRITE_ROWS: Record<SpriteName, string[]> = {
  ...soldier,
  enemy_n: recolorRows(soldier.soldier_n, ENEMY_COLOURS),
  enemy_ne: recolorRows(soldier.soldier_ne, ENEMY_COLOURS),
  enemy_e: recolorRows(soldier.soldier_e, ENEMY_COLOURS),
  enemy_se: recolorRows(soldier.soldier_se, ENEMY_COLOURS),
  enemy_s: recolorRows(soldier.soldier_s, ENEMY_COLOURS),
  floor_0: floorRows(0),
  floor_1: floorRows(1),
  floor_2: floorRows(2),
  wall: WALL,
  door_closed: DOOR_CLOSED,
  door_open: DOOR_OPEN,
  item_pistol: ITEM_PISTOL,
  item_rifle: ITEM_RIFLE,
  item_grenade: ITEM_GRENADE,
  corpse_player: CORPSE_PLAYER,
  corpse_enemy: recolorRows(CORPSE_PLAYER, ENEMY_COLOURS),
  flash_0: FLASH_0,
  flash_1: FLASH_1,
  spark: recolorRows(FLASH_1, { o: 'u', y: 'R', f: 'P' }),
  slash_0: slashRows(0),
  slash_1: slashRows(1),
  splash: SPLASH,
  boom_0: boomRows(0),
  boom_1: boomRows(1),
  boom_2: boomRows(2),
  boom_3: boomRows(3),
};
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If a "face points" assertion fails for a rotated soldier, print `SPRITE_ROWS.soldier_ne` and check it by eye before touching the thresholds: the 45 degree rotation is nearest-neighbour, so the skin centroid should still sit towards the top-right, and a failure means the rotation direction is wrong (fix `rotateRows`, not the test). If `unitSprite` in Task 1 reported names that the union now rejects, `tsc` will say so.

- [ ] **Step 5: Commit**

```bash
git add src/art/sprites.ts tests/sprites.test.ts
git commit -m "feat(art): the sprite data (soldier rotated to eight facings, enemy recolour, tiles, items, effects)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The sprite atlas

**Files:**
- Create: `src/art/atlas.ts`
- Test: `tests/atlas.test.ts`

**Interfaces:**
- Consumes: `parseSprite`, `flipHorizontal` (Task 1), `PALETTE`, `SPRITE_ROWS`, `SpriteName` (Task 2).
- Produces: `interface CanvasLike { width: number; height: number; getContext(type: '2d'): { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void } | null }`; `class Atlas` with constructor `(createCanvas?: (w: number, h: number) => CanvasLike | null)` (default: an `OffscreenCanvas`, else a detached `<canvas>`, else `null`); `draw(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, opts?: { flip?: boolean; scale?: number }): boolean` (true when something was drawn).

- [ ] **Step 1: Write the failing tests**

Create `tests/atlas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { PALETTE } from '../src/art/palette';
import { SPRITE_ROWS } from '../src/art/sprites';

interface Op { colour: string; x: number; y: number; w: number; h: number }

class FakeCanvas implements CanvasLike {
  ops: Op[] = [];
  constructor(public width: number, public height: number) {}
  getContext() {
    const canvas = this;
    let colour = '';
    return {
      set fillStyle(v: unknown) { colour = String(v); },
      get fillStyle() { return colour; },
      fillRect(x: number, y: number, w: number, h: number) { canvas.ops.push({ colour, x, y, w, h }); },
    };
  }
}

function makeAtlas() {
  const canvases: FakeCanvas[] = [];
  const atlas = new Atlas((w, h) => {
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

describe('Atlas', () => {
  it('bakes a sprite once, one rectangle per opaque pixel in the palette colour', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    expect(atlas.draw(ctx, 'wall', 0, 0)).toBe(true);
    expect(atlas.draw(ctx, 'wall', 16, 0)).toBe(true);
    expect(canvases).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const opaque = SPRITE_ROWS.wall.join('').replace(/\./g, '').length;
    expect(canvases[0].ops).toHaveLength(opaque);
    expect(canvases[0].ops[0].colour).toBe(PALETTE.W);
    expect(canvases[0].ops.every((o) => o.w === 1 && o.h === 1)).toBe(true);
  });

  it('draws the baked canvas at the rounded position and size', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'wall', 32.4, 47.6);
    expect(calls[0]).toEqual([canvases[0], 32, 48, 16, 16]);
  });

  it('scales a sprite by whole factors', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'boom_2', 10, 20, { scale: 3 });
    expect(calls[0]).toEqual([canvases[0], 10, 20, 48, 48]);
  });

  it('keeps a mirrored copy as a separate cache entry with the pixels mirrored', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx } = fakeCtx();
    atlas.draw(ctx, 'soldier_ne', 0, 0);
    atlas.draw(ctx, 'soldier_ne', 0, 0, { flip: true });
    atlas.draw(ctx, 'soldier_ne', 0, 0, { flip: true });
    expect(canvases).toHaveLength(2);
    const key = (o: Op) => `${o.x},${o.y},${o.colour}`;
    const plain = new Set(canvases[0].ops.map(key));
    const mirrored = new Set(canvases[1].ops.map((o) => key({ ...o, x: 15 - o.x })));
    expect(mirrored).toEqual(plain);
  });

  it('draws nothing and does not throw when there is no canvas', () => {
    const atlas = new Atlas(() => null);
    const { ctx, calls } = fakeCtx();
    expect(atlas.draw(ctx, 'wall', 0, 0)).toBe(false);
    expect(atlas.draw(ctx, 'soldier_n', 0, 0, { flip: true })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('the default atlas in a plain Node environment has no canvas and stays silent', () => {
    const atlas = new Atlas();
    const { ctx, calls } = fakeCtx();
    expect(() => atlas.draw(ctx, 'wall', 0, 0)).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/atlas.test.ts`
Expected: FAIL (cannot find module `../src/art/atlas`).

- [ ] **Step 3: Implement**

Create `src/art/atlas.ts`:

```ts
import { PALETTE } from './palette';
import { flipHorizontal, parseSprite } from './sprite';
import { SPRITE_ROWS, type SpriteName } from './sprites';

export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void } | null;
}

function defaultCanvas(width: number, height: number): CanvasLike | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height) as unknown as CanvasLike;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas as unknown as CanvasLike;
    }
  } catch {
    // fall through: no canvas available
  }
  return null;
}

/** Bakes each sprite once into a small canvas, then stamps it with drawImage. Draws nothing without a canvas. */
export class Atlas {
  private cache = new Map<string, CanvasLike | null>();

  constructor(private readonly createCanvas: (w: number, h: number) => CanvasLike | null = defaultCanvas) {}

  private get(name: SpriteName, flip: boolean): CanvasLike | null {
    const key = flip ? `${name}:flip` : name;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    let sprite = parseSprite(name, SPRITE_ROWS[name]);
    if (flip) sprite = flipHorizontal(sprite);
    const canvas = this.createCanvas(sprite.width, sprite.height);
    const ctx = canvas?.getContext('2d') ?? null;
    if (canvas && ctx) {
      sprite.pixels.forEach((letter, i) => {
        if (letter === null) return;
        ctx.fillStyle = PALETTE[letter];
        ctx.fillRect(i % sprite.width, Math.floor(i / sprite.width), 1, 1);
      });
    }
    const baked = canvas && ctx ? canvas : null;
    this.cache.set(key, baked);
    return baked;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    name: SpriteName,
    x: number,
    y: number,
    opts: { flip?: boolean; scale?: number } = {},
  ): boolean {
    const canvas = this.get(name, opts.flip ?? false);
    if (!canvas) return false;
    const scale = opts.scale ?? 1;
    ctx.drawImage(canvas as unknown as CanvasImageSource, Math.round(x), Math.round(y), canvas.width * scale, canvas.height * scale);
    return true;
  }
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/art/atlas.ts tests/atlas.test.ts
git commit -m "feat(art): sprite atlas that bakes each sprite once and stamps it

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The renderer draws sprites

**Files:**
- Modify: `src/render/renderer.ts`, `src/render/effects.ts` (only `unitBob`, below)
- Test: `tests/artrender.test.ts`

**Interfaces:**
- Consumes: `Atlas` (Task 3), `unitSprite`, `floorVariant`, `rankPips`, `pipPositions`, `barrel` (Task 1), `SpriteName` (Task 2).
- Produces: `drawGame(ctx, state, ui, effects, now, art: Atlas = defaultAtlas)`; `export const defaultAtlas = new Atlas()`; `Effects.unitBob(unitId, now): -1 | 0` (-1 during the first half of the unit's move animation).

- [ ] **Step 0: Measure the baseline frame time**

Start the dev server with `preview_start` (`laser-tribute`), reload, start a mission and run in the page: `const c = document.querySelector('canvas').getContext('2d'); app.click({x:240,y:315}); await new Promise(r => setTimeout(r, 400)); const t0 = performance.now(); for (let i = 0; i < 200; i++) app.draw(c, performance.now()); (performance.now() - t0) / 200`. Write the number (milliseconds per frame) into the ledger as the baseline, then stop the server.

- [ ] **Step 1: Write the failing tests**

Create `tests/artrender.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import type { SpriteName } from '../src/art/sprites';
import { createMission, MISSIONS } from '../src/core/missions';
import { applyRank } from '../src/core/ranks';
import { computeVisible } from '../src/core/vision';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

/** An atlas that records what it is asked to draw. */
function spyAtlas() {
  const drawn: { name: SpriteName; x: number; y: number; flip: boolean }[] = [];
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.draw.bind(atlas);
  atlas.draw = (ctx, name, x, y, opts = {}) => {
    drawn.push({ name, x, y, flip: !!opts.flip });
    return real(ctx, name, x, y, opts);
  };
  return { atlas, drawn };
}

const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

const roster = [
  { name: 'A', kills: 9 }, { name: 'B', kills: 5 }, { name: 'C', kills: 2 }, { name: 'D', kills: 0 },
];

describe('drawGame with sprites', () => {
  it('draws explored tiles, units, items and rank pips without throwing', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const { atlas, drawn } = spyAtlas();
    expect(() => drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas)).not.toThrow();
    const names = new Set(drawn.map((d) => d.name));
    expect(names.has('wall')).toBe(true);
    expect([...names].some((n) => n.startsWith('floor_'))).toBe(true);
    expect([...names].some((n) => n.startsWith('soldier_'))).toBe(true);
  });

  it('draws a soldier sprite per living soldier, mirrored for facings 5 to 7', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldiers = state.units.filter((u) => u.side === 'player');
    soldiers[0].facing = 6; // west: the mirror of east
    soldiers[1].facing = 0;
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const units = drawn.filter((d) => d.name.startsWith('soldier_'));
    expect(units).toHaveLength(4);
    expect(units.find((d) => d.name === 'soldier_e')!.flip).toBe(true);
    expect(units.find((d) => d.name === 'soldier_n')!.flip).toBe(false);
  });

  it('does not draw an enemy that is out of sight, and draws one that is seen', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const visible = computeVisible(state, 'player');
    const seenEnemies = state.units.filter((u) => u.side === 'enemy' && u.alive && visible[u.pos.y][u.pos.x]).length;
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.filter((d) => d.name.startsWith('enemy_')).length).toBe(seenEnemies);

    const enemy = state.units.find((u) => u.side === 'enemy')!;
    const soldier = state.units.find((u) => u.side === 'player')!;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y }; // next to a soldier: always seen
    const second = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, second.atlas);
    expect(second.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(true);
  });

  it('draws a corpse only when it is seen', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    const near = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, near.atlas);
    expect(near.drawn.some((d) => d.name === 'corpse_enemy')).toBe(true);
    enemy.pos = { x: 28, y: 18 }; // far away, in the dark
    const far = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, far.atlas);
    expect(far.drawn.some((d) => d.name === 'corpse_enemy')).toBe(false);
  });

  it('draws item icons where the player can see them', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    state.items.push({ id: 'i99', pos: { x: soldier.pos.x, y: soldier.pos.y }, kind: 'grenade' });
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.some((d) => d.name === 'item_grenade')).toBe(true);
  });

  it('completes with an atlas that has no canvas (nothing is drawn)', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const empty = new Atlas(() => null);
    expect(() => drawGame(ctx, state, createUiState('p1'), new Effects(), 0, empty)).not.toThrow();
  });
});

describe('Effects.unitBob', () => {
  it('lifts a walking unit by one pixel for the first half of its step, then settles', () => {
    const fx = new Effects();
    fx.add([{ type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }], 1000);
    expect(fx.unitBob('p1', 1010)).toBe(-1);
    expect(fx.unitBob('p1', 1090)).toBe(0);
    expect(fx.unitBob('p1', 2000)).toBe(0);
    expect(fx.unitBob('p2', 1010)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/artrender.test.ts`
Expected: FAIL (`drawGame` does not take an atlas and draws no sprites; `unitBob` is missing).

- [ ] **Step 3: Implement**

In `src/render/effects.ts` add this method next to `unitOffset` (leave everything else alone in this task):

```ts
  /** A walking unit bobs up one pixel for the first half of each step. */
  unitBob(unitId: string, now: number): -1 | 0 {
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return p < 0.5 ? -1 : 0;
    }
    return 0;
  }
```

Replace `src/render/renderer.ts` with:

```ts
import { Atlas } from '../art/atlas';
import { barrel, floorVariant, pipPositions, rankPips, unitSprite } from '../art/sprite';
import type { SpriteName } from '../art/sprites';
import { CONFIG } from '../core/config';
import type { GameState } from '../core/types';
import { computeVisible } from '../core/vision';
import type { UiState } from '../input/uiState';
import type { Effects } from './effects';
import { VIEW } from './layout';
import { drawPanel } from './panel';

const T = CONFIG.tileSize;

/** The atlas the game draws with (also used by the dev gallery). */
export const defaultAtlas = new Atlas();

const COLORS = {
  select: '#ffe14d',
  pip: '#ffe14d',
  rifle: '#d0d0d0',
  pistol: '#a0a0a0',
};

function tileSprite(state: GameState, x: number, y: number): SpriteName {
  const tile = state.tiles[y][x];
  if (tile.kind === 'wall') return 'wall';
  if (tile.kind === 'door') return tile.open ? 'door_open' : 'door_closed';
  return `floor_${floorVariant(x, y)}` as SpriteName;
}

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UiState,
  effects: Effects,
  now: number,
  art: Atlas = defaultAtlas,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const visible = computeVisible(state, 'player');

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!state.explored[y][x]) continue;
      art.draw(ctx, tileSprite(state, x, y), x * T, y * T);
      if (!visible[y][x]) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }

  for (const item of state.items) {
    if (!visible[item.pos.y][item.pos.x]) continue;
    art.draw(ctx, `item_${item.kind}` as SpriteName, item.pos.x * T, item.pos.y * T);
  }

  for (const u of state.units) {
    const seen = visible[u.pos.y][u.pos.x];
    if (!u.alive) {
      if (!seen) continue;
      art.draw(ctx, u.side === 'player' ? 'corpse_player' : 'corpse_enemy', u.pos.x * T, u.pos.y * T);
      continue;
    }
    if (u.side === 'enemy' && !seen) continue;

    const off = effects.unitOffset(u.id, now);
    const x0 = Math.round(u.pos.x * T + off.x);
    const y0 = Math.round(u.pos.y * T + off.y + effects.unitBob(u.id, now));
    const { name, flip } = unitSprite(u.side, u.facing);
    art.draw(ctx, name, x0, y0, { flip });
    const cx = x0 + T / 2;
    const cy = y0 + T / 2;

    ctx.fillStyle = COLORS[u.weapon];
    for (const p of barrel(u.weapon, u.facing)) ctx.fillRect(cx + p.dx, cy + p.dy, 1, 1);
    if (u.side === 'player') {
      ctx.fillStyle = COLORS.pip;
      for (const p of pipPositions(rankPips(u.rank))) ctx.fillRect(x0 + p.x, y0 + p.y, 1, 2);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 6, cy - 9, 12, 2);
    ctx.fillStyle = '#7dff9a';
    ctx.fillRect(cx - 6, cy - 9, (12 * u.hp) / u.maxHp, 2);
    if (u.alert) {
      ctx.font = '8px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.select;
      ctx.fillText('!', cx + 5, cy - 17);
    }
    if (u.id === ui.selectedId) {
      ctx.strokeStyle = COLORS.select;
      ctx.strokeRect(u.pos.x * T + 0.5, u.pos.y * T + 0.5, T - 1, T - 1);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const p of ui.preview) ctx.fillRect(p.x * T + 6, p.y * T + 6, 4, 4);
  if (ui.hover) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(ui.hover.x * T + 0.5, ui.hover.y * T + 0.5, T - 1, T - 1);
  }

  effects.draw(ctx, now);
  drawPanel(ctx, state, ui, now);
}
```

(`effects.draw(ctx, now)` is changed to take the atlas in Task 5.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If the "does not draw an enemy that is out of sight" test fails because a soldier already sees every enemy at mission start, that is a defect of the test setup, not of the renderer: check `computeVisible` for Mission 1 (enemies start far from the soldiers) and print how many enemies are visible before touching the renderer.

- [ ] **Step 5: Commit**

```bash
git add src tests/artrender.test.ts
git commit -m "feat(render): draw tiles, items, units, corpses and rank pips with sprites

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sprite effects (muzzle flash, spark, slash, splash, explosion)

**Files:**
- Modify: `src/render/effects.ts`, `src/render/renderer.ts` (pass the atlas), `tests/knifeui.test.ts` (replace one test)
- Test: `tests/arteffects.test.ts`

**Interfaces:**
- Consumes: `frameFor`, `directionTo` (Task 1), `Atlas` (Task 3), `SpriteName` (Task 2).
- Produces: `type EffectDraw = { type: 'sprite'; name: SpriteName; x: number; y: number; scale: number; alpha: number } | { type: 'line'; from: Pos; to: Pos; hit: boolean } | { type: 'rect'; x: number; y: number; w: number; h: number; color: string; alpha: number }`; `Effects.frames(now): EffectDraw[]` (pure; only effects that have started and not ended); `Effects.draw(ctx, now, art?: Atlas)` (executes `frames`, drawing sprites through `art` when given).

- [ ] **Step 1: Write the failing tests**

Create `tests/arteffects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Effects } from '../src/render/effects';

const T = 16;
const sprites = (fx: Effects, now: number) => fx.frames(now).filter((d) => d.type === 'sprite');
const names = (fx: Effects, now: number) => sprites(fx, now).map((d) => (d as { name: string }).name);

describe('shot effects', () => {
  const shot = (hit: boolean) => ({
    type: 'shot' as const, unitId: 'p1', targetId: 'e1', mode: 'snap' as const, hit, damage: hit ? 30 : 0,
    from: { x: 2, y: 3 }, impact: { x: 6, y: 3 },
  });

  it('a shot flashes at the muzzle, half a tile out towards the target, in two frames', () => {
    const fx = new Effects();
    fx.add([shot(true)], 0);
    const first = sprites(fx, 10)[0] as { name: string; x: number; y: number };
    expect(first.name).toBe('flash_0');
    expect(first).toMatchObject({ x: 2 * T + 8, y: 3 * T });
    expect(names(fx, 70)).toContain('flash_1');
    expect(names(fx, 200)).not.toContain('flash_0');
    expect(names(fx, 200)).not.toContain('flash_1');
  });

  it('a hit shows a spark on the target that fades; a miss shows none', () => {
    const hit = new Effects();
    hit.add([shot(true)], 0);
    const spark = sprites(hit, 100).find((d) => (d as { name: string }).name === 'spark') as { x: number; y: number; alpha: number };
    expect(spark).toMatchObject({ x: 6 * T, y: 3 * T });
    expect(spark.alpha).toBeGreaterThan(0);
    expect(spark.alpha).toBeLessThanOrEqual(1);
    const miss = new Effects();
    miss.add([shot(false)], 0);
    expect(names(miss, 100)).not.toContain('spark');
  });

  it('the old tracer line is still drawn for the life of the shot, and gone afterwards', () => {
    const fx = new Effects();
    fx.add([shot(true)], 0);
    expect(fx.frames(50).some((d) => d.type === 'line')).toBe(true);
    expect(fx.frames(1000).some((d) => d.type === 'line')).toBe(false);
  });
});

describe('stab, death, grenade and reload effects', () => {
  it('a stab slashes the target in two frames and sparks on a hit', () => {
    const fx = new Effects();
    fx.add([{ type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } }], 0);
    expect(names(fx, 10)).toContain('slash_0');
    expect(names(fx, 150)).toContain('slash_1');
    expect(names(fx, 100)).toContain('spark');
    expect(fx.frames(5000)).toEqual([]);
  });

  it('a death splashes blood and fades out', () => {
    const fx = new Effects();
    fx.add([{ type: 'died', unitId: 'e1', at: { x: 4, y: 4 } }], 0);
    const splash = sprites(fx, 100)[0] as { name: string; x: number; y: number; alpha: number };
    expect(splash).toMatchObject({ name: 'splash', x: 4 * T, y: 4 * T });
    const early = (sprites(fx, 50)[0] as { alpha: number }).alpha;
    const late = (sprites(fx, 400)[0] as { alpha: number }).alpha;
    expect(late).toBeLessThan(early);
    expect(fx.frames(5000)).toEqual([]);
  });

  it('a grenade is a four-frame explosion, three tiles wide, centred on the blast', () => {
    const fx = new Effects();
    fx.add([{ type: 'grenade', unitId: 'p1', at: { x: 10, y: 5 }, hits: [], doorsDestroyed: [] }], 0);
    const seen = new Set<string>();
    for (let t = 0; t < 450; t += 10) {
      for (const d of sprites(fx, t)) {
        const s = d as { name: string; x: number; y: number; scale: number };
        seen.add(s.name);
        expect(s).toMatchObject({ x: 9 * T, y: 4 * T, scale: 3 });
      }
    }
    expect([...seen].sort()).toEqual(['boom_0', 'boom_1', 'boom_2', 'boom_3']);
    expect(fx.frames(5000)).toEqual([]);
  });

  it('the reload flash is still a rectangle that fades', () => {
    const fx = new Effects();
    fx.add([{ type: 'reloaded', unitId: 'p1', ammo: 5, at: { x: 1, y: 1 } }], 0);
    const rect = fx.frames(50).find((d) => d.type === 'rect') as { x: number; y: number; alpha: number };
    expect(rect).toMatchObject({ x: T, y: T });
    expect(rect.alpha).toBeLessThan(1);
  });

  it('never picks a frame outside the animation, at any moment of its life', () => {
    const fx = new Effects();
    fx.add([
      { type: 'grenade', unitId: 'p1', at: { x: 3, y: 3 }, hits: [], doorsDestroyed: [] },
      { type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } },
    ], 0);
    const allowed = new Set(['boom_0', 'boom_1', 'boom_2', 'boom_3', 'slash_0', 'slash_1', 'spark']);
    for (let t = -50; t < 600; t += 1) {
      for (const d of sprites(fx, t)) expect(allowed.has((d as { name: string }).name)).toBe(true);
    }
  });
});

describe('drawing the frames', () => {
  it('stamps sprites through the atlas with their scale and resets the alpha afterwards', () => {
    const fx = new Effects();
    fx.add([{ type: 'grenade', unitId: 'p1', at: { x: 3, y: 3 }, hits: [], doorsDestroyed: [] }], 0);
    const drawn: unknown[][] = [];
    const art = { draw: (...a: unknown[]) => { drawn.push(a); return true; } };
    const alphas: number[] = [];
    const ctx = {
      set globalAlpha(v: number) { alphas.push(v); },
      fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      set fillStyle(_v: string) {}, set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
    } as unknown as CanvasRenderingContext2D;
    fx.draw(ctx, 50, art as never);
    expect(drawn).toHaveLength(1);
    expect(drawn[0][1]).toBe('boom_0');
    expect(drawn[0][4]).toEqual({ scale: 3 });
    expect(alphas[alphas.length - 1]).toBe(1);
  });

  it('draws nothing for sprites when no atlas is given, and does not throw', () => {
    const fx = new Effects();
    fx.add([{ type: 'died', unitId: 'e1', at: { x: 4, y: 4 } }], 0);
    const ctx = { fillRect() {}, set globalAlpha(_v: number) {} } as unknown as CanvasRenderingContext2D;
    expect(() => fx.draw(ctx, 50)).not.toThrow();
  });
});
```

Replace the last `describe('stab effects', ...)` block in `tests/knifeui.test.ts` (the one that counts `stroke` calls) with:

```ts
describe('stab effects', () => {
  it('shows a slash for a stab event and removes it afterwards', () => {
    const fx = new Effects();
    fx.add(
      [{ type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } }],
      0,
    );
    expect(fx.frames(50).some((d) => d.type === 'sprite' && d.name.startsWith('slash'))).toBe(true);
    expect(fx.frames(5000)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/arteffects.test.ts tests/knifeui.test.ts`
Expected: FAIL (`frames` does not exist).

- [ ] **Step 3: Implement**

Replace `src/render/effects.ts` with:

```ts
import type { Atlas } from '../art/atlas';
import { directionTo, frameFor } from '../art/sprite';
import type { SpriteName } from '../art/sprites';
import { CONFIG } from '../core/config';
import type { GameEvent, Pos } from '../core/types';

const T = CONFIG.tileSize;

type Effect =
  | { kind: 'move'; unitId: string; from: Pos; to: Pos; start: number; dur: number }
  | { kind: 'shot'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }
  | { kind: 'flash'; at: Pos; color: string; start: number; dur: number }
  | { kind: 'sprite'; frames: SpriteName[]; px: Pos; scale: number; fade: boolean; start: number; dur: number };

/** What to draw for the effects alive at one moment (pure, so it can be tested). */
export type EffectDraw =
  | { type: 'sprite'; name: SpriteName; x: number; y: number; scale: number; alpha: number }
  | { type: 'line'; from: Pos; to: Pos; hit: boolean }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string; alpha: number };

const center = (p: Pos) => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 });
const tilePx = (p: Pos) => ({ x: p.x * T, y: p.y * T });

export class Effects {
  private list: Effect[] = [];

  private sprite(frames: SpriteName[], px: Pos, start: number, dur: number, opts: { scale?: number; fade?: boolean } = {}): void {
    this.list.push({ kind: 'sprite', frames, px, scale: opts.scale ?? 1, fade: opts.fade ?? false, start, dur });
  }

  add(events: GameEvent[], now: number): void {
    for (const e of events) {
      if (e.type === 'moved') {
        this.list.push({ kind: 'move', unitId: e.unitId, from: e.from, to: e.to, start: now, dur: 120 });
      } else if (e.type === 'shot') {
        this.list.push({ kind: 'shot', from: e.from, to: e.impact, hit: e.hit, start: now, dur: 180 });
        const dir = directionTo(e.from, e.impact);
        const muzzle = tilePx(e.from);
        this.sprite(['flash_0', 'flash_1'], { x: muzzle.x + dir.x * 8, y: muzzle.y + dir.y * 8 }, now, 90);
        if (e.hit) this.sprite(['spark'], tilePx(e.impact), now + 80, 220, { fade: true });
      } else if (e.type === 'stab') {
        this.sprite(['slash_0', 'slash_1'], tilePx(e.at), now, 220);
        if (e.hit) this.sprite(['spark'], tilePx(e.at), now + 60, 220, { fade: true });
      } else if (e.type === 'died') {
        this.sprite(['splash'], tilePx(e.at), now, 450, { fade: true });
      } else if (e.type === 'grenade') {
        this.sprite(['boom_0', 'boom_1', 'boom_2', 'boom_3'], { x: (e.at.x - 1) * T, y: (e.at.y - 1) * T }, now, 450, { scale: 3 });
      } else if (e.type === 'reloaded') {
        this.list.push({ kind: 'flash', at: e.at, color: '120,200,255', start: now, dur: 250 });
      }
    }
  }

  /** Pixel offset to add to a unit's logical position while it slides between tiles. */
  unitOffset(unitId: string, now: number): { x: number; y: number } {
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return { x: (e.from.x - e.to.x) * T * (1 - p), y: (e.from.y - e.to.y) * T * (1 - p) };
    }
    return { x: 0, y: 0 };
  }

  /** A walking unit bobs up one pixel for the first half of each step. */
  unitBob(unitId: string, now: number): -1 | 0 {
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return p < 0.5 ? -1 : 0;
    }
    return 0;
  }

  frames(now: number): EffectDraw[] {
    const out: EffectDraw[] = [];
    for (const e of this.list) {
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      if (e.kind === 'shot') {
        out.push({ type: 'line', from: center(e.from), to: center(e.to), hit: e.hit });
      } else if (e.kind === 'flash') {
        out.push({ type: 'rect', x: e.at.x * T, y: e.at.y * T, w: T, h: T, color: e.color, alpha: 1 - p });
      } else if (e.kind === 'sprite') {
        out.push({
          type: 'sprite',
          name: e.frames[frameFor(p, e.frames.length)],
          x: e.px.x,
          y: e.px.y,
          scale: e.scale,
          alpha: e.fade ? 1 - p : 1,
        });
      }
    }
    return out;
  }

  draw(ctx: CanvasRenderingContext2D, now: number, art?: Atlas): void {
    this.list = this.list.filter((e) => now < e.start + e.dur);
    for (const d of this.frames(now)) {
      if (d.type === 'line') {
        ctx.strokeStyle = d.hit ? '#ffe14d' : '#9aa0b5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.from.x, d.from.y);
        ctx.lineTo(d.to.x, d.to.y);
        ctx.stroke();
      } else if (d.type === 'rect') {
        ctx.fillStyle = `rgba(${d.color},${d.alpha})`;
        ctx.fillRect(d.x, d.y, d.w, d.h);
      } else if (art) {
        ctx.globalAlpha = d.alpha;
        art.draw(ctx, d.name, d.x, d.y, { scale: d.scale });
        ctx.globalAlpha = 1;
      }
    }
  }
}
```

In `src/render/renderer.ts` change `effects.draw(ctx, now);` to `effects.draw(ctx, now, art);`.

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass (including the unchanged `tests/ammoui.test.ts` reload-flash test, which still counts `fillRect` calls from `draw`, and `tests/rendereffects.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(render): muzzle flash, hit spark, stab slash, death splash and explosion as sprites

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dev gallery, visual review and docs

**Files:**
- Create: `src/art/gallery.ts`
- Modify: `src/main.ts`, `README.md`; and, only if the review below calls for it, `src/art/sprites.ts` and `src/art/palette.ts`
- Test: `tests/gallery.test.ts`

**Interfaces:**
- Consumes: `SPRITE_NAMES` (Task 2), `Atlas` (Task 3), `defaultAtlas` (Task 4).
- Produces: `drawGallery(ctx, atlas)` (draws every sprite at 3x on a labelled grid; 8 per row); in dev only, `window.gallery()`.

- [ ] **Step 1: Write the failing test**

Create `tests/gallery.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { drawGallery } from '../src/art/gallery';
import { SPRITE_NAMES } from '../src/art/sprites';

describe('drawGallery', () => {
  it('draws every sprite once, enlarged three times, inside the canvas', () => {
    const drawn: { name: string; x: number; y: number; scale: number }[] = [];
    const art = {
      draw: (_ctx: unknown, name: string, x: number, y: number, opts?: { scale?: number }) => {
        drawn.push({ name, x, y, scale: opts?.scale ?? 1 });
        return true;
      },
    };
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawGallery(ctx, art as never);
    expect(drawn.map((d) => d.name)).toEqual([...SPRITE_NAMES]);
    for (const d of drawn) {
      expect(d.scale).toBe(3);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x + 48).toBeLessThanOrEqual(480);
      expect(d.y + 48).toBeLessThanOrEqual(360);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gallery.test.ts`
Expected: FAIL (cannot find module `../src/art/gallery`).

- [ ] **Step 3: Implement**

Create `src/art/gallery.ts`:

```ts
import { VIEW } from '../render/layout';
import type { Atlas } from './atlas';
import { SPRITE_NAMES } from './sprites';

const SCALE = 3;
const CELL_W = 58;
const CELL_H = 62;

/** Every sprite enlarged on a labelled grid, for reviewing the art. */
export function drawGallery(ctx: CanvasRenderingContext2D, art: Atlas): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  SPRITE_NAMES.forEach((name, i) => {
    const x = 4 + (i % 8) * CELL_W;
    const y = 4 + Math.floor(i / 8) * CELL_H;
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(x, y, 16 * SCALE, 16 * SCALE);
    art.draw(ctx, name, x, y, { scale: SCALE });
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText(name.replace('soldier', 'sold').replace('door_', 'd_').slice(0, 9), x, y + 16 * SCALE + 2);
  });
}
```

In `src/main.ts`, add `import { drawGallery } from './art/gallery';` and `import { defaultAtlas } from './render/renderer';`, and after the existing `if (import.meta.env.DEV) ...window.app` line add:

```ts
if (import.meta.env.DEV) (window as unknown as { gallery: () => void }).gallery = () => drawGallery(ctx, defaultAtlas);
```

- [ ] **Step 4: Run all tests, the type check and the build**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 5: Visual review in the browser (the real test of this milestone)**

Start the dev server with `preview_start` (`laser-tribute`) and make the pane a desktop size (`resize_window` preset `desktop`).
1. Call `window.gallery()` (one frame only: the game loop redraws every frame, so stop it first with `window.requestAnimationFrame = () => 0` before calling `gallery()`), take a screenshot, and look at it. Check each of these and write what you see in the ledger:
   - the five soldier directions: the face and the hands clearly point north, north-east, east, south-east and south; none looks broken or holey;
   - the enemy is clearly the same shape in red;
   - floor, wall, closed door and open door read as a tile, a wall and a door (a bit of texture, not noise);
   - the three item icons, two corpses, flash, spark, slash, splash and the four explosion frames are recognisable.
2. Reload, start a mission and take screenshots at game scale. Check that the eight facings can be told apart (turn a soldier with `app.controller.run({type:'Turn', unitId:'p1', facing: n})` for n = 0..7), the barrel shows pistol versus rifle, the rank pips show on a Captain (set `app.campaign.roster[0].kills = 9` before starting), a corpse and an item appear, fog still dims explored tiles, and a hidden enemy is not drawn.
3. Fix what is wrong in `src/art/sprites.ts` (and `palette.ts` if a colour is unreadable). A weak soldier rotation at 45 degrees is the most likely problem: if `soldier_ne` looks ragged, author it by hand as a literal 16-row grid in place of `rotateRows(SOLDIER_N, 45)` (keeping the face in the upper-right), and likewise `soldier_se`. Keep every sprite valid (`npx vitest run tests/sprites.test.ts`) and record each change in the ledger as `Task 6: Ruling: <what> - <why> - <cost if wrong>`. Do not spend more than two rounds on this; Rui reviews the final look and any further changes are a follow-up.
4. Measure the frame time again with the same script as in Task 4 Step 0 and write both numbers in the ledger. The new frame time must be within 1 ms of the baseline or at most 4 ms per frame, whichever is larger; if not, investigate (the atlas should be baking each sprite once) before continuing.
5. Press and hold nothing; check `read_console_messages` shows no errors. Stop the server with `preview_stop`.

- [ ] **Step 6: Update the README and commit**

Read `README.md`, add a short "Graphics" paragraph under the title or controls (pixel art is drawn in code from small grids in `src/art/sprites.ts`; `window.gallery()` in dev mode shows every sprite enlarged), then:

```bash
git add src tests README.md
git commit -m "feat(art): dev gallery, visual review fixes and docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** palette and sprite data with the 31 names (Tasks 1 and 2); one authored soldier rotated to eight facings, enemy as a recolour, tiles, items, corpses, effect frames (Task 2); parse, flip, rotate, facing mapping, floor variants, rank pips, barrel, direction and frame helpers (Task 1); the atlas with caching, mirroring, scaling and a silent no-canvas mode (Task 3); renderer drawing tiles, items, corpses, units, barrels and pips with the visibility rules unchanged and the walking bob (Task 4); muzzle flash, spark, slash, splash and the explosion in the effects layer (Task 5); the dev gallery, a visual review, frame-time check and README (Task 6). Deviations from the spec: the gallery shows sprites at 3x, not 4x (31 sprites at 4x do not fit the 480x360 canvas); `soldier_s` and the diagonal soldiers come from rotating the north soldier, which the spec allows ("sprites to author") and Task 6 lets the executor hand-author if the rotation looks bad; the effects layer gains a pure `frames()` so effects can be tested, and the old stab test in `knifeui.test.ts` is replaced accordingly.

**Placeholders:** none; the sprite grids, helpers and renderer are written out. The one intentionally open item is the visual review in Task 6, which has explicit criteria and a bounded number of rounds.

**Type consistency:** `SpriteName`/`SPRITE_NAMES` (Task 2) are used by `unitSprite` (Task 1, type-only), `Atlas.draw` (Task 3), the renderer (Task 4), `Effects` (Task 5) and the gallery (Task 6); `Atlas.draw(ctx, name, x, y, { flip?, scale? })` is the same call everywhere; `Effects.frames`, `EffectDraw` and `draw(ctx, now, art?)` match between Task 5 and the renderer.

**Review Focus coverage:** rotation exactness and 45 degrees (Task 1), symmetry, mirroring and face direction (Tasks 1 and 2), hidden enemies, corpses and items (Task 4), no-canvas safety (Tasks 3, 4, 5), frame ranges, fading and removal of effects (Task 5), frame time (Tasks 4 and 6).
