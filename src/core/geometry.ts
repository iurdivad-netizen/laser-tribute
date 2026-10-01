import type { Facing, GameState, Pos, Tile, Unit } from './types';

export const FACING_VECTORS: Record<Facing, Pos> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: -1 },
  2: { x: 1, y: 0 },
  3: { x: 1, y: 1 },
  4: { x: 0, y: 1 },
  5: { x: -1, y: 1 },
  6: { x: -1, y: 0 },
  7: { x: -1, y: -1 },
};

export const NEIGHBORS_8: Pos[] = Object.values(FACING_VECTORS);
export const NEIGHBORS_4: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function posEq(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function distance(a: Pos, b: Pos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function facingFromDelta(dx: number, dy: number): Facing {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (const f of [0, 1, 2, 3, 4, 5, 6, 7] as Facing[]) {
    const v = FACING_VECTORS[f];
    if (v.x === sx && v.y === sy) return f;
  }
  return 0;
}

export function turnSteps(from: Facing, to: Facing): number {
  const d = Math.abs(from - to) % 8;
  return Math.min(d, 8 - d);
}

export function inBounds(s: GameState, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;
}

export function tileAt(s: GameState, p: Pos): Tile {
  return s.tiles[p.y][p.x];
}

export function isBlocking(tile: Tile): boolean {
  return tile.kind === 'wall' || (tile.kind === 'door' && !tile.open);
}

export function unitAt(s: GameState, p: Pos): Unit | undefined {
  return s.units.find((u) => u.alive && posEq(u.pos, p));
}
