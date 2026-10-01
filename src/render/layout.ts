import { CONFIG } from '../core/config';
import type { Pos } from '../core/types';

/** Logical canvas size: a 30x20 map of 16px tiles plus a 40px panel. */
export const VIEW = { width: 480, height: 360, mapHeight: 320 } as const;

export function screenToTile(px: number, py: number, mapWidth: number, mapHeight: number): Pos | null {
  if (px < 0 || py < 0 || py >= VIEW.mapHeight) return null;
  const x = Math.floor(px / CONFIG.tileSize);
  const y = Math.floor(py / CONFIG.tileSize);
  if (x >= mapWidth || y >= mapHeight) return null;
  return { x, y };
}
