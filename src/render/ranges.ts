import { THROWABLES, WEAPONS } from '../core/config';
import { chebyshev, distance, inBounds, posEq, tileAt } from '../core/geometry';
import type { GameState, Pos, Unit } from '../core/types';
import { canSee, hasLineOfSight, sightOf, visibleToSide } from '../core/vision';

/** Overlay colours: the range tints, the blast squares by kind, and the outlines on units caught in a blast. */
export const RANGE_COLORS = {
  shot: 'rgba(255,214,102,0.16)',
  throw: 'rgba(120,190,255,0.16)',
  blast: {
    frag: 'rgba(255,80,60,0.32)',
    incendiary: 'rgba(255,140,40,0.32)',
    smoke: 'rgba(200,205,225,0.34)',
    flash: 'rgba(255,255,255,0.40)',
  },
  foe: '#ff5555',
  /** Not the selection yellow, and drawn inset, so the selected thrower caught in his own blast shows. */
  friend: '#6ef0ff',
} as const;

function around(s: GameState, from: Pos, reach: number): Pos[] {
  const out: Pos[] = [];
  const r = Math.ceil(reach);
  for (let y = Math.max(0, from.y - r); y <= Math.min(s.height - 1, from.y + r); y++) {
    for (let x = Math.max(0, from.x - r); x <= Math.min(s.width - 1, from.x + r); x++) {
      const p = { x, y };
      if (!posEq(p, from) && tileAt(s, p).kind !== 'wall') out.push(p);
    }
  }
  return out;
}

/** The tiles the soldier could shoot at: within the weapon range and `canSee` (sight, facing, line of sight, smoke). */
export function shotTiles(s: GameState, u: Unit): Pos[] {
  const range = WEAPONS[u.weapon].range;
  return around(s, u.pos, Math.max(range, sightOf(u))).filter((p) => distance(u.pos, p) <= range && canSee(s, u, p));
}

/** The tiles the soldier could throw at, his own included: within the range of his grenade and in line of sight, which smoke does not stop. */
export function throwTiles(s: GameState, u: Unit): Pos[] {
  const range = THROWABLES[u.throwable].range;
  const reach = around(s, u.pos, range).filter((p) => distance(u.pos, p) <= range && hasLineOfSight(s, u.pos, p, true));
  return [{ ...u.pos }, ...reach]; // throwing at his own feet is allowed, and the most dangerous target
}

/** The non-wall tiles of the square blast of the given radius around `at`. */
export function blastTiles(s: GameState, at: Pos, radius: number): Pos[] {
  const out: Pos[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: at.x + dx, y: at.y + dy };
      if (inBounds(s, p) && tileAt(s, p).kind !== 'wall') out.push(p);
    }
  }
  return out;
}

/** The units the player can see (his own always) that a throw at `at` would hurt or stun; nobody for smoke. */
export function blastVictims(s: GameState, thrower: Unit, at: Pos): { unit: Unit; friend: boolean }[] {
  const t = THROWABLES[thrower.throwable];
  if (t.damage === undefined && t.apPenalty === undefined) return [];
  return s.units
    .filter((u) => u.alive && chebyshev(u.pos, at) <= t.radius && hasLineOfSight(s, at, u.pos, true))
    .filter((u) => u.side === 'player' || visibleToSide(s, 'player', u.pos))
    .map((u) => ({ unit: u, friend: u.side === thrower.side }));
}

type Memo = { state: GameState; key: string; tiles: Pos[] } | null;
const memo: Record<'shot' | 'throw', Memo> = { shot: null, throw: null };

/** `shotTiles` or `throwTiles`, remembered for the same state, soldier, position, facing and kit, so a redraw costs nothing. */
export function rangeTiles(kind: 'shot' | 'throw', s: GameState, u: Unit): Pos[] {
  const key = `${u.id}:${u.pos.x},${u.pos.y}:${u.facing}:${u.weapon}:${u.throwable}`;
  const hit = memo[kind];
  if (hit && hit.state === s && hit.key === key) return hit.tiles;
  const tiles = kind === 'shot' ? shotTiles(s, u) : throwTiles(s, u);
  memo[kind] = { state: s, key, tiles };
  return tiles;
}
