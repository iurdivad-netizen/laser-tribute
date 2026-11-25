import { BLOCKS, orientations } from './blocks';
import { blank, fill, ri, type Grid, type Rnd } from './grid';
import type { Recipe } from './recipes';

/** A piece of the map; the coordinates are wall lines, so the room inside is x0+1..x1-1 by y0+1..y1-1. */
interface Rect { x0: number; y0: number; x1: number; y1: number }
/** A wall line cutting a piece in two. `vertical` means the wall is a column at x = `at`. */
interface Split { vertical: boolean; at: number; a: Rect; b: Rect }

function partition(r: Recipe, rnd: Rnd, rect: Rect, leaves: Rect[], splits: Split[]): void {
  const spanX = rect.x1 - rect.x0;
  const spanY = rect.y1 - rect.y0;
  const canV = spanX >= 2 * r.minW;
  const canH = spanY >= 2 * r.minH;
  if ((!canV && !canH) || (spanX <= r.maxLeaf && spanY <= r.maxLeaf)) {
    leaves.push(rect);
    return;
  }
  let vertical: boolean;
  if (canV && canH) vertical = spanX > spanY * 2 ? true : spanY > spanX * 2 ? false : rnd() < r.vertical;
  else vertical = canV;
  if (vertical) {
    const at = ri(rnd, rect.x0 + r.minW, rect.x1 - r.minW);
    const a = { ...rect, x1: at };
    const b = { ...rect, x0: at };
    splits.push({ vertical, at, a, b });
    partition(r, rnd, a, leaves, splits);
    partition(r, rnd, b, leaves, splits);
  } else {
    const at = ri(rnd, rect.y0 + r.minH, rect.y1 - r.minH);
    const a = { ...rect, y1: at };
    const b = { ...rect, y0: at };
    splits.push({ vertical, at, a, b });
    partition(r, rnd, a, leaves, splits);
    partition(r, rnd, b, leaves, splits);
  }
}

/** Makes a door (or a 2 to 3 tile archway) in the wall line of a split, so the two halves are connected. */
function connect(g: Grid, rnd: Rnd, r: Recipe, s: Split): void {
  const lo = (s.vertical ? s.a.y0 : s.a.x0) + 1;
  const hi = (s.vertical ? s.a.y1 : s.a.x1) - 1;
  const at = (t: number): [number, number] => (s.vertical ? [s.at, t] : [t, s.at]);
  const open: number[] = []; // floor on both sides of the wall
  const door: number[] = []; // ... and wall along both ends, so a door fits
  for (let t = lo; t <= hi; t++) {
    const [x, y] = at(t);
    const across = s.vertical ? [g[y][x - 1], g[y][x + 1]] : [g[y - 1][x], g[y + 1][x]];
    const along = s.vertical ? [g[y - 1][x], g[y + 1][x]] : [g[y][x - 1], g[y][x + 1]];
    if (across[0] !== '.' || across[1] !== '.') continue;
    open.push(t);
    if (along[0] === '#' && along[1] === '#') door.push(t);
  }
  const pool = door.length > 0 ? door : open;
  if (pool.length === 0) return;
  const t = pool[ri(rnd, 0, pool.length - 1)];
  if (rnd() < r.arch) {
    const width = ri(rnd, 2, 3);
    for (let k = 0; k < width; k++) {
      if (!open.includes(t + k)) break;
      const [x, y] = at(t + k);
      g[y][x] = '.';
    }
  } else {
    const [x, y] = at(t);
    g[y][x] = '+';
    if (pool.length >= 8 && rnd() < 0.5) {
      const spare = pool.filter((u) => Math.abs(u - t) >= 3);
      if (spare.length > 0) {
        const [x2, y2] = at(spare[ri(rnd, 0, spare.length - 1)]);
        g[y2][x2] = '+';
      }
    }
  }
}

/** A door that no longer sits in a wall gap (a neighbouring wall was cut away) becomes plain floor. */
function tidyDoors(g: Grid): void {
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < g[0].length - 1; x++) {
      if (g[y][x] !== '+') continue;
      const n = g[y - 1][x], s = g[y + 1][x], w = g[y][x - 1], e = g[y][x + 1];
      const ok = (n === '#' && s === '#' && w === '.' && e === '.') || (w === '#' && e === '#' && n === '.' && s === '.');
      if (!ok) g[y][x] = '.';
    }
  }
}

/** The three kinds of cover block: a tall pillar and the two props, picked by position so no random draw changes. */
const COVER_CHARS = ['#', 'x', 'y'] as const;

/**
 * One-tile cover blocks, only where all eight neighbours are floor, so they never cut the map in two. About two thirds are
 * props (low walls: they block movement but not sight), the rest tall pillars.
 */
function scatterCover(g: Grid, rnd: Rnd, per100: number): void {
  if (per100 <= 0) return;
  const w = g[0].length;
  const h = g.length;
  let open = 0;
  for (const row of g) for (const ch of row) if (ch === '.') open++;
  let left = Math.floor((open * per100) / 100);
  for (let tries = 0; left > 0 && tries < 600; tries++) {
    const x = ri(rnd, 1, w - 2);
    const y = ri(rnd, 1, h - 2);
    let clear = true;
    for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] !== '.') clear = false;
    if (!clear) continue;
    g[y][x] = COVER_CHARS[(x * 7 + y * 13) % 3];
    left--;
  }
}

/** A well-mixed hash of a few numbers: block choices come from here, not from the random stream, so they never shift other draws. */
function hash(...n: number[]): number {
  let h = 0x811c9dc5;
  for (const v of n) {
    h = Math.imul(h ^ (v + 0x9e3779b9), 0x01000193);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/**
 * Puts a premade block of furniture in some rooms: a block that suits the recipe, in a random orientation, where it and a
 * ring of floor round it all lie on open floor (so doors, archways and the way round are untouched).
 */
function stampBlocks(g: Grid, r: Recipe, leaves: Rect[]): void {
  for (const l of leaves) {
    const h = hash(l.x0, l.y0, l.x1, l.y1);
    if ((h % 1000) / 1000 >= r.blocks.chance) continue;
    const w = l.x1 - l.x0 - 1;
    const rh = l.y1 - l.y0 - 1;
    const fits = BLOCKS.filter((b) => r.blocks.tags.includes(b.tag))
      .flatMap((b) => orientations(b.rows))
      .filter((o) => o[0].length + 2 <= w && o.length + 2 <= rh);
    if (fits.length === 0) continue;
    const o = fits[hash(h, 1) % fits.length];
    const x = l.x0 + 1 + 1 + (hash(h, 2) % (w - o[0].length - 1));
    const y = l.y0 + 1 + 1 + (hash(h, 3) % (rh - o.length - 1));
    let clear = true;
    for (let j = y - 1; j <= y + o.length && clear; j++) for (let i = x - 1; i <= x + o[0].length; i++) if (g[j][i] !== '.') clear = false;
    if (!clear) continue;
    o.forEach((row, j) => [...row].forEach((ch, i) => { g[y + j][x + i] = ch; }));
  }
}

/** The terrain of a map: walls, rooms, doors, archways, an optional yard, cover and (with `blocks`, story mode) furniture blocks. No units or items yet. */
export function buildLayout(r: Recipe, rnd: Rnd, blocks = false): Grid {
  const g = blank(r.width, r.height);
  const leaves: Rect[] = [];
  const splits: Split[] = [];
  partition(r, rnd, { x0: 0, y0: 0, x1: r.width - 1, y1: r.height - 1 }, leaves, splits);
  for (const l of leaves) fill(g, l.x0 + 1, l.y0 + 1, l.x1 - l.x0 - 1, l.y1 - l.y0 - 1, '.');
  for (const s of splits) connect(g, rnd, r, s);
  if (r.yard) {
    fill(g, Math.floor((r.width - r.yard.w) / 2), Math.floor((r.height - r.yard.h) / 2), r.yard.w, r.yard.h, '.');
  }
  tidyDoors(g);
  if (blocks) stampBlocks(g, r, leaves);
  scatterCover(g, rnd, r.cover);
  return g;
}
