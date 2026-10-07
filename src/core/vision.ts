import { CONFIG, WEAPONS } from './config';
import {
  FACING_VECTORS, chebyshev, distance, inBounds, isBlocking, posEq, tileAt,
} from './geometry';
import type { GameState, Hazard, Pos, Side, Unit } from './types';

export function lineTiles(a: Pos, b: Pos): Pos[] {
  const out: Pos[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

const hazardKey = (p: Pos): number => p.y * 4096 + p.x;
const hazardIndexes = new WeakMap<Hazard[], { len: number; smoke: Set<number>; fire: Set<number> }>();

/**
 * The smoke and fire tiles as sets, built once per hazard list. Hazards only change by being pushed (the length
 * changes) or by the list being replaced (a new array), so the length and the array identity say when to rebuild.
 */
function hazardIndex(s: GameState): { smoke: Set<number>; fire: Set<number> } {
  let e = hazardIndexes.get(s.hazards);
  if (!e || e.len !== s.hazards.length) {
    e = { len: s.hazards.length, smoke: new Set(), fire: new Set() };
    for (const h of s.hazards) (h.kind === 'smoke' ? e.smoke : e.fire).add(hazardKey(h.pos));
    hazardIndexes.set(s.hazards, e);
  }
  return e;
}

export const smokeAt = (s: GameState, p: Pos): boolean => hazardIndex(s).smoke.has(hazardKey(p));
export const fireAt = (s: GameState, p: Pos): boolean => hazardIndex(s).fire.has(hazardKey(p));

export function hasLineOfSight(s: GameState, from: Pos, to: Pos, ignoreSmoke = false): boolean {
  const tiles = lineTiles(from, to);
  for (let i = 1; i < tiles.length - 1; i++) {
    if (isBlocking(tileAt(s, tiles[i]))) return false;
    if (!ignoreSmoke && smokeAt(s, tiles[i])) return false;
  }
  return true;
}

/** How far a unit sees: its weapon's own sight (the sniper rifle's is longer), else the standard range. */
export function sightOf(u: Unit): number {
  return WEAPONS[u.weapon].sight ?? CONFIG.sightRange;
}

export function canSee(s: GameState, unit: Unit, pos: Pos): boolean {
  if (!unit.alive) return false;
  if (chebyshev(unit.pos, pos) <= 1) return true;
  if (distance(unit.pos, pos) > sightOf(unit)) return false;
  if (smokeAt(s, unit.pos) || smokeAt(s, pos)) return false; // inside smoke you see (and are seen) only from next to it
  const f = FACING_VECTORS[unit.facing];
  const dot = (pos.x - unit.pos.x) * f.x + (pos.y - unit.pos.y) * f.y;
  if (dot < 0) return false;
  return hasLineOfSight(s, unit.pos, pos);
}

export function visibleToSide(s: GameState, side: Side, pos: Pos): boolean {
  return s.units.some((u) => u.alive && u.side === side && canSee(s, u, pos));
}

export function computeVisible(s: GameState, side: Side): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < s.height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < s.width; x++) row.push(visibleToSide(s, side, { x, y }));
    grid.push(row);
  }
  return grid;
}

export function updateExplored(s: GameState): void {
  const vis = computeVisible(s, 'player');
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (vis[y][x] && inBounds(s, { x, y })) {
        s.explored[y][x] = true;
        const tile = s.tiles[y][x];
        if (tile.kind === 'door') s.doorMemory[y][x] = tile.open; // the player sees a door as it is now
      }
    }
  }
}

export function updateEnemyMemory(s: GameState): void {
  const seen = s.units.find(
    (u) => u.alive && u.side === 'player' && visibleToSide(s, 'enemy', u.pos),
  );
  if (seen) {
    s.enemyMemory = { ...seen.pos };
    return;
  }
  const memory = s.enemyMemory;
  if (memory && s.units.some((u) => u.alive && u.side === 'enemy' && posEq(u.pos, memory))) {
    s.enemyMemory = null;
  }
}
