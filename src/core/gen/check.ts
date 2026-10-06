import { chebyshev } from '../geometry';
import { parseMap } from '../mission';
import type { MissionDef } from '../missions';
import { hasLineOfSight } from '../vision';
import { distances, toGrid, type Grid } from './grid';
import type { Recipe } from './recipes';

export interface Expect {
  width: number;
  height: number;
  enemies: number;
  items: { r: number; p: number; g: number };
}

export function expectFor(r: Recipe, enemies: number = r.enemies): Expect {
  return { width: r.width, height: r.height, enemies, items: { ...r.items } };
}

/** Floor for the door rule: anything walkable that is not a door (units and pickups stand on floor). */
const isFloor = (c: string | undefined): boolean => c !== undefined && c !== '#' && c !== '+';

function doorFits(g: Grid, x: number, y: number): boolean {
  const n = g[y - 1]?.[x], s = g[y + 1]?.[x], w = g[y][x - 1], e = g[y][x + 1];
  return (n === '#' && s === '#' && isFloor(w) && isFloor(e)) || (w === '#' && e === '#' && isFloor(n) && isFloor(s));
}

/** What is wrong with a generated map; an empty list means it is playable. */
export function checkMission(def: MissionDef, want: Expect): string[] {
  const rows = def.rows;
  if (rows.length !== want.height || rows.some((r) => r.length !== want.width)) {
    return [`size is not ${want.width}x${want.height}`];
  }
  const problems: string[] = [];
  const text = rows.join('');
  const count = (ch: string): number => text.split(ch).length - 1;

  if (count('P') !== 4) problems.push(`squad is ${count('P')} soldiers, not 4`);
  if (count('E') !== want.enemies) problems.push(`${count('E')} enemies, expected ${want.enemies}`);
  for (const k of ['r', 'p', 'g'] as const) {
    if (count(k) !== want.items[k]) problems.push(`${count(k)} of item ${k}, expected ${want.items[k]}`);
  }

  let border = false;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const edge = x === 0 || y === 0 || x === want.width - 1 || y === want.height - 1;
    if (edge && ch !== '#') border = true;
  }));
  if (border) problems.push('border is open');

  const grid = toGrid(rows);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '+' && !doorFits(grid, x, y)) problems.push(`door at ${x},${y} is not in a wall gap`);
  }));

  const state = parseMap(rows);
  const squad = state.units.filter((u) => u.side === 'player').map((u) => u.pos);
  const foes = state.units.filter((u) => u.side === 'enemy');

  let reach: number[][] | null = null;
  if (squad.length > 0) {
    reach = distances(grid, squad[0], (c) => c !== '#');
    let cut = false;
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '#' && reach![y][x] < 0) cut = true; }));
    if (cut) problems.push('some floor cannot be reached from the squad');
  }

  for (const foe of foes) {
    for (const p of squad) {
      if (chebyshev(p, foe.pos) <= 8) problems.push(`enemy ${foe.id} is within 8 tiles of the squad`);
      else if (hasLineOfSight(state, p, foe.pos)) problems.push(`enemy ${foe.id} sees the squad at the start`);
    }
  }

  for (const key of Object.keys(def.patrols)) {
    if (!foes.some((f) => f.id === key)) problems.push(`patrol ${key} belongs to no enemy`);
  }
  for (const foe of foes) {
    const route = def.patrols[foe.id];
    if (!route || route.length < 2) {
      problems.push(`patrol ${foe.id} is missing or has fewer than two points`);
      continue;
    }
    // enemies patrol with every door closed (only a hunting enemy opens doors), so each point must be reachable without one
    const onFoot = distances(grid, foe.pos, (c) => c !== '#' && c !== '+');
    for (const p of route) {
      const inside = p.x >= 0 && p.y >= 0 && p.x < want.width && p.y < want.height;
      if (!inside || grid[p.y][p.x] === '#' || (reach && reach[p.y][p.x] < 0)) {
        problems.push(`patrol ${foe.id} has a point at ${p.x},${p.y} that cannot be walked to`);
      } else if (onFoot[p.y][p.x] < 0) {
        problems.push(`patrol ${foe.id} has a point at ${p.x},${p.y} behind a closed door`);
      }
    }
  }

  for (const p of squad) {
    if (!squad.some((q) => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === 1)) {
      problems.push(`squad start is scattered: ${p.x},${p.y} stands alone`);
    }
  }
  return problems;
}
