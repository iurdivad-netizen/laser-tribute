import { CONFIG } from './config';
import { inBounds, isBlocking, tileAt, unitAt } from './geometry';
import type { GameState, Pos } from './types';

/** Returns why a single step from `from` to the adjacent tile `to` is illegal, or null if it is legal. */
export function stepBlockedReason(
  s: GameState,
  from: Pos,
  to: Pos,
  ignoreUnits = false,
): string | null {
  if (!inBounds(s, to)) return 'That tile is off the map';
  const tile = tileAt(s, to);
  if (tile.kind === 'wall') return 'A wall blocks the way';
  if (tile.kind === 'door' && !tile.open) return 'The door is closed';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0) {
    const sideA = tileAt(s, { x: to.x, y: from.y });
    const sideB = tileAt(s, { x: from.x, y: to.y });
    if (isBlocking(sideA) || isBlocking(sideB)) return 'Cannot cut a corner';
  }
  if (!ignoreUnits && unitAt(s, to)) return 'That tile is occupied';
  return null;
}

export function stepCost(from: Pos, to: Pos): number {
  return from.x !== to.x && from.y !== to.y ? CONFIG.diagonalCost : CONFIG.moveCost;
}
