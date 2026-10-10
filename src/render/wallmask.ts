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
