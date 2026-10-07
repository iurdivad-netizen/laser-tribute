import type { Pos } from '../core/types';
import { PALETTE, TRANSPARENT } from './palette';
import { RISE } from './figure';
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

/** Which of the three floor sprites a tile uses: a fixed hash of its position, so the floor never flickers. */
export function floorVariant(x: number, y: number): 0 | 1 | 2 {
  return ((((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) >>> 3) % 3) as 0 | 1 | 2;
}

const PIPS: Record<string, number> = { Private: 1, Sergeant: 2, Captain: 3 };

export function rankPips(rank: string): number {
  return PIPS[rank] ?? 0;
}

/**
 * Rank pips: 1x2 pixels in a row in the status row just above the health bar, which floats above the head of the
 * figure (offsets from the top-left of the feet tile, so y is negative). A figure fills the tile it stands on down to
 * the boots, so no corner of the feet tile is free; above the head nothing is.
 */
export function pipPositions(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => ({ x: 2 + 2 * i, y: -RISE - 9 }));
}

/** The 2x2 armour pip at the right end of the same status row. */
export const ARMOUR_PIP = { x: 12, y: -RISE - 9, w: 2, h: 2 } as const;

/** The sign of each axis from one tile to another. */
export function directionTo(from: Pos, to: Pos): Pos {
  return { x: Math.sign(to.x - from.x) || 0, y: Math.sign(to.y - from.y) || 0 };
}

/** Which of `count` animation frames to show at `progress` (0 up to 1); out-of-range values are clamped. */
export function frameFor(progress: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}
