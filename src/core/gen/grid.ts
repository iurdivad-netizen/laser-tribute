import type { Pos } from '../types';

export type Grid = string[][];
export type Rnd = () => number;

export const NB4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string>(w).fill('#'));
}

export function fill(g: Grid, x: number, y: number, w: number, h: number, ch: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = ch;
}

/** An integer in [lo, hi], inclusive. */
export function ri(rnd: Rnd, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

export function shuffled<T>(rnd: Rnd, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toGrid(rows: string[]): Grid {
  return rows.map((r) => [...r]);
}

export function toRows(g: Grid): string[] {
  return g.map((r) => r.join(''));
}

/** Steps from `from` to every tile over 4-neighbour moves through tiles `passable` accepts; -1 where it cannot be reached. */
export function distances(g: Grid, from: Pos, passable: (ch: string) => boolean): number[][] {
  const h = g.length;
  const w = g[0].length;
  const d = g.map((row) => row.map(() => -1));
  d[from.y][from.x] = 0;
  const queue: Pos[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of NB4) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || d[y][x] !== -1 || !passable(g[y][x])) continue;
      d[y][x] = d[p.y][p.x] + 1;
      queue.push({ x, y });
    }
  }
  return d;
}
