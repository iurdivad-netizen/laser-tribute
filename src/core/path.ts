import { NEIGHBORS_8, inBounds, posEq } from './geometry';
import { stepBlockedReason, stepCost } from './movement';
import type { GameState, Pos } from './types';

export interface PathOptions {
  ignoreOccupantAtGoal?: boolean;
}

export function findPath(
  s: GameState,
  unitId: string,
  goal: Pos,
  opts: PathOptions = {},
): Pos[] | null {
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
      const ignoreUnits = !!opts.ignoreOccupantAtGoal && posEq(next, goal);
      if (stepBlockedReason(s, cur, next, ignoreUnits) !== null) continue;
      const nk = key(next);
      const nd = dist.get(ck)! + stepCost(cur, next);
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
