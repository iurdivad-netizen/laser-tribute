import { CONFIG } from './config';
import { NEIGHBORS_8, inBounds, posEq, tileAt } from './geometry';
import { stepBlockedReason, stepCost } from './movement';
import type { GameState, Pos, Side, Unit } from './types';
import { visibleToSide } from './vision';

/** Counts findPath calls; lets tests check that the AI skips needless pathfinding. */
export const pathStats = { calls: 0 };

/** Extra route cost of stepping onto a tile that is on fire: a detour is preferred, but fire is not a wall. */
const FIRE_STEP_COST = 40;

export interface PathOptions {
  ignoreOccupantAtGoal?: boolean;
  /** Plan as this side would: units this side cannot currently see do not block the path. */
  seenBy?: Side;
  /** Plan as if closed doors could be opened on the way (each costs the door action); real moves never do this. */
  openDoors?: boolean;
  /** Plan with doors as remembered (`GameState.doorMemory`) instead of as they really are: what the player knows. */
  doorView?: boolean[][];
}

export function findPath(
  s: GameState,
  unitId: string,
  goal: Pos,
  opts: PathOptions = {},
): Pos[] | null {
  pathStats.calls += 1;
  const unit = s.units.find((u) => u.id === unitId);
  if (!unit || !unit.alive || !inBounds(s, goal) || posEq(unit.pos, goal)) return null;

  const key = (p: Pos) => p.y * s.width + p.x;
  const dist = new Map<number, number>([[key(unit.pos), 0]]);
  const prev = new Map<number, Pos>();
  const done = new Set<number>();
  const open: Pos[] = [{ ...unit.pos }];

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (dist.get(key(open[i]))! < dist.get(key(open[best]))!) best = i;
    }
    const cur = open.splice(best, 1)[0];
    const ck = key(cur);
    if (done.has(ck)) continue;
    done.add(ck);
    if (posEq(cur, goal)) break;

    for (const d of NEIGHBORS_8) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      const atGoal = !!opts.ignoreOccupantAtGoal && posEq(next, goal);
      const ignoreUnits =
        atGoal || (opts.seenBy ? (u: Unit) => !visibleToSide(s, opts.seenBy!, u.pos) : false);
      const nextTile = inBounds(s, next) ? tileAt(s, next) : null;
      let doorsOpen = !!opts.openDoors;
      if (opts.doorView && nextTile && nextTile.kind === 'door') {
        const remembered = opts.doorView[next.y][next.x];
        if (!remembered && !opts.openDoors) continue; // remembered closed: planned as blocked
        doorsOpen = doorsOpen || remembered;
      }
      if (stepBlockedReason(s, cur, next, ignoreUnits, doorsOpen) !== null) continue;
      const nk = key(next);
      const doorExtra = opts.openDoors && nextTile!.kind === 'door' && !nextTile!.open ? CONFIG.doorCost : 0;
      const fireExtra = s.hazards.some((h) => h.kind === 'fire' && h.pos.x === next.x && h.pos.y === next.y) ? FIRE_STEP_COST : 0;
      const nd = dist.get(ck)! + stepCost(cur, next) + doorExtra + fireExtra;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, cur);
        open.push(next);
      }
    }
  }

  if (!prev.has(key(goal))) return null;
  const path: Pos[] = [];
  let c: Pos = goal;
  while (!posEq(c, unit.pos)) {
    path.unshift({ ...c });
    c = prev.get(key(c))!;
  }
  return path;
}

export function pathCost(from: Pos, path: Pos[]): number {
  let total = 0;
  let p = from;
  for (const n of path) {
    total += stepCost(p, n);
    p = n;
  }
  return total;
}
