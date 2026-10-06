import { chebyshev } from '../geometry';
import { parseMap } from '../mission';
import type { MissionDef } from '../missions';
import type { Pos } from '../types';
import { hasLineOfSight } from '../vision';
import { distances, shuffled, toRows, type Grid, type Rnd } from './grid';
import type { Recipe } from './recipes';

/**
 * Puts the squad in the bottom-left corner area, then enemies out of sight and out of range of it, the pickups,
 * and a two-point patrol for every enemy. Returns null when the layout cannot host all of that.
 */
export function populate(g: Grid, rnd: Rnd, r: Recipe, enemies: number): MissionDef | null {
  const h = g.length;
  const floors: Pos[] = [];
  g.forEach((row, y) => row.forEach((ch, x) => { if (ch === '.') floors.push({ x, y }); }));
  const wanted = 'r'.repeat(r.items.r) + 'p'.repeat(r.items.p) + 'g'.repeat(r.items.g);
  if (floors.length < 4 + enemies + wanted.length) return null;

  // squad: the four floor tiles nearest to the bottom-left corner, by walking distance
  const corner = floors.reduce((a, b) => (b.x + (h - 1 - b.y) < a.x + (h - 1 - a.y) ? b : a));
  const walk = distances(g, corner, (c) => c === '.');
  const squad = floors
    .filter((p) => walk[p.y][p.x] >= 0)
    .sort((a, b) => walk[a.y][a.x] - walk[b.y][b.x])
    .slice(0, 4);
  if (squad.length < 4) return null;
  for (const p of squad) g[p.y][p.x] = 'P';

  // enemies: far from the squad and with no line of sight, spread out where the map allows
  const terrain = parseMap(toRows(g));
  const safe = floors.filter(
    (p) => g[p.y][p.x] === '.' && squad.every((s) => chebyshev(s, p) > 8 && !hasLineOfSight(terrain, s, p)),
  );
  const pool = shuffled(rnd, safe);
  const placed: Pos[] = [];
  for (const gap of [4, 2, 0]) {
    for (const p of pool) {
      if (placed.length >= enemies) break;
      if (!placed.includes(p) && placed.every((q) => chebyshev(p, q) >= gap)) placed.push(p);
    }
  }
  if (placed.length < enemies) return null;
  for (const p of placed) g[p.y][p.x] = 'E';

  // pickups on any other floor
  const free = shuffled(rnd, floors.filter((p) => g[p.y][p.x] === '.'));
  if (free.length < wanted.length) return null;
  [...wanted].forEach((ch, i) => { g[free[i].y][free[i].x] = ch; });

  // patrols: from a point 3 to 8 steps away back to the start, keyed e1..eN in reading order
  const patrols: Record<string, Pos[]> = {};
  const order = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < order.length; i++) {
    const start = order[i];
    const d = distances(g, start, (c) => c !== '#');
    const spots = floors.filter((p) => g[p.y][p.x] === '.' && d[p.y][p.x] >= 3 && d[p.y][p.x] <= 8);
    if (spots.length === 0) return null;
    patrols[`e${i + 1}`] = [spots[Math.floor(rnd() * spots.length)], { x: start.x, y: start.y }];
  }

  return { id: r.id, name: r.name, rows: toRows(g), patrols };
}
