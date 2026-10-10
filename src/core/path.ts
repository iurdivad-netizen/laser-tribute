import { CONFIG } from './config';
import { NEIGHBORS_8, inBounds, posEq } from './geometry';
import { stepCost } from './movement';
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

/** The open tiles as a binary heap ordered by (cost so far, order of first discovery): the cheapest first, ties to the tile found earliest. */
class OpenHeap {
  private d: number[] = [];
  private q: number[] = [];
  private i: number[] = [];
  get size(): number {
    return this.i.length;
  }
  push(dist: number, order: number, index: number): void {
    let n = this.i.length;
    this.d.push(dist);
    this.q.push(order);
    this.i.push(index);
    // sift the new entry up through the parents that come after it
    while (n > 0) {
      const parent = (n - 1) >> 1;
      if (this.d[parent] < dist || (this.d[parent] === dist && this.q[parent] < order)) break;
      this.d[n] = this.d[parent];
      this.q[n] = this.q[parent];
      this.i[n] = this.i[parent];
      n = parent;
    }
    this.d[n] = dist;
    this.q[n] = order;
    this.i[n] = index;
  }
  /** The tile index of the cheapest entry, removed. */
  pop(): number {
    const top = this.i[0];
    const dist = this.d.pop()!;
    const order = this.q.pop()!;
    const index = this.i.pop()!;
    const last = this.i.length;
    if (last === 0) return top;
    // sift the former last entry down from the root
    let n = 0;
    for (;;) {
      let c = 2 * n + 1;
      if (c >= last) break;
      const r = c + 1;
      if (r < last && (this.d[r] < this.d[c] || (this.d[r] === this.d[c] && this.q[r] < this.q[c]))) c = r;
      if (dist < this.d[c] || (dist === this.d[c] && order < this.q[c])) break;
      this.d[n] = this.d[c];
      this.q[n] = this.q[c];
      this.i[n] = this.i[c];
      n = c;
    }
    this.d[n] = dist;
    this.q[n] = order;
    this.i[n] = index;
    return top;
  }
}

const DX = NEIGHBORS_8.map((d) => d.x);
const DY = NEIGHBORS_8.map((d) => d.y);
const FLOOR = 0;
const WALL = 1;
const CLOSED_DOOR = 2;
const OPEN_DOOR = 3;

/**
 * The cheapest route for a unit to `goal`, as the tiles after its own, or null. This is Dijkstra's search on flat arrays
 * (a kind grid, an occupancy grid, a fire grid) with the same rules as `stepBlockedReason`, `stepCost` and the options
 * below; ties between equal costs go to the tile found first, so the route is always the same one.
 */
export function findPath(
  s: GameState,
  unitId: string,
  goal: Pos,
  opts: PathOptions = {},
): Pos[] | null {
  pathStats.calls += 1;
  const unit = s.units.find((u) => u.id === unitId);
  if (!unit || !unit.alive || !inBounds(s, goal) || posEq(unit.pos, goal)) return null;

  const w = s.width;
  const h = s.height;
  const cells = w * h;
  const kind = new Uint8Array(cells);
  for (let y = 0; y < h; y++) {
    const row = s.tiles[y];
    for (let x = 0; x < w; x++) {
      const t = row[x];
      kind[y * w + x] = t.kind === 'wall' ? WALL : t.kind === 'door' ? (t.open ? OPEN_DOOR : CLOSED_DOOR) : FLOOR;
    }
  }
  // who stands where: the first living unit on a tile, as unitAt would find
  const standing = new Int32Array(cells).fill(-1);
  s.units.forEach((u, i) => {
    const at = u.pos.y * w + u.pos.x;
    if (u.alive && standing[at] < 0) standing[at] = i;
  });
  const fire = s.hazards.some((hz) => hz.kind === 'fire') ? new Uint8Array(cells) : null;
  if (fire) for (const hz of s.hazards) if (hz.kind === 'fire') fire[hz.pos.y * w + hz.pos.x] = 1;

  const dist = new Float64Array(cells).fill(Infinity);
  const prev = new Int32Array(cells).fill(-1);
  const order = new Int32Array(cells).fill(-1); // when a tile was first discovered: the tie-break between equal costs
  const done = new Uint8Array(cells);
  const open = new OpenHeap();
  let found = 0;
  const start = unit.pos.y * w + unit.pos.x;
  const goalIndex = goal.y * w + goal.x;
  dist[start] = 0;
  order[start] = found++;
  open.push(0, order[start], start);

  while (open.size > 0) {
    const ck = open.pop();
    if (done[ck]) continue; // a stale entry: the tile was reached cheaper and has been handled
    done[ck] = 1;
    if (ck === goalIndex) break;
    const cx = ck % w;
    const cy = (ck - cx) / w;

    for (let d = 0; d < 8; d++) {
      const dx = DX[d];
      const dy = DY[d];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      const k = kind[nk];
      let doorsOpen = !!opts.openDoors;
      if (opts.doorView && (k === CLOSED_DOOR || k === OPEN_DOOR)) {
        const remembered = opts.doorView[ny][nx];
        if (!remembered && !opts.openDoors) continue; // remembered closed: planned as blocked
        doorsOpen = doorsOpen || remembered;
      }
      if (k === WALL || (k === CLOSED_DOOR && !doorsOpen)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal) {
        const sideA = kind[cy * w + nx];
        const sideB = kind[ny * w + cx];
        if (sideA === WALL || sideA === CLOSED_DOOR || sideB === WALL || sideB === CLOSED_DOOR) continue; // cannot cut a corner
      }
      const who = standing[nk];
      if (who >= 0) {
        const ignored = (!!opts.ignoreOccupantAtGoal && nk === goalIndex) || (opts.seenBy ? !visibleToSide(s, opts.seenBy, s.units[who].pos) : false);
        if (!ignored) continue;
      }
      const nd =
        dist[ck] +
        (diagonal ? CONFIG.diagonalCost : CONFIG.moveCost) +
        (opts.openDoors && k === CLOSED_DOOR ? CONFIG.doorCost : 0) +
        (fire && fire[nk] ? FIRE_STEP_COST : 0);
      if (nd < dist[nk]) {
        dist[nk] = nd;
        prev[nk] = ck;
        if (order[nk] < 0) order[nk] = found++;
        open.push(nd, order[nk], nk);
      }
    }
  }

  if (prev[goalIndex] < 0) return null;
  const path: Pos[] = [];
  for (let c = goalIndex; c !== start; c = prev[c]) path.unshift({ x: c % w, y: (c - (c % w)) / w });
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
