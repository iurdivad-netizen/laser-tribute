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
