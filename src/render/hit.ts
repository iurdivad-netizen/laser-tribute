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
 * `accept` lets the caller skip units it has no use for (a heal wants a soldier, a shot an enemy): the next figure
 * under the point that it accepts is returned instead.
 */
export function unitAtScreen(
  state: GameState, camera: Camera, layout: Layout, px: number, py: number, accept: (u: Unit) => boolean = () => true,
): Unit | null {
  const m = layout.map;
  if (px < m.x || py < m.y || px >= m.x + m.w || py >= m.y + m.h) return null;
  const o = originOf(camera, layout, state.width, state.height);
  const k = o.tile / T;
  const wx = (px - o.x) / k;
  const wy = (py - o.y) / k;
  const front = state.units
    .filter((u) => u.alive && accept(u) && (u.side === 'player' || visibleToSide(state, 'player', u.pos)))
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
