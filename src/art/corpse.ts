import type { GameState, Unit } from '../core/types';
import { bodyFigure, type Figure, type FigureSide, type FigureView } from './figure';
import { corpseImage } from './theme';

/** The blood under a body: a bright red that stands out from the dark floor, with a lighter shine. */
export const POOL_COLOUR = { base: '#b3262c', light: '#d9453f' };

const VIEWS: FigureView[] = ['s', 'n', 'e', 'ne', 'se'];
const DIM = 0.8;
export const POSES = VIEWS.length * 2;

/** Turns a figure a quarter turn clockwise: the top row becomes the right-hand column. */
export function rotateCW(f: Figure): Figure {
  const pixels: (string | null)[] = [];
  for (let y = 0; y < f.width; y++) for (let x = 0; x < f.height; x++) pixels.push(f.pixels[(f.height - 1 - x) * f.width + y]);
  return { name: `${f.name}_cw`, width: f.height, height: f.width, pixels };
}

/** A quarter turn the other way: the top row becomes the left-hand column. */
export function rotateCCW(f: Figure): Figure {
  const pixels: (string | null)[] = [];
  for (let y = 0; y < f.width; y++) for (let x = 0; x < f.height; x++) pixels.push(f.pixels[x * f.width + (f.width - 1 - y)]);
  return { name: `${f.name}_ccw`, width: f.height, height: f.width, pixels };
}

function dim(hex: string): string {
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * DIM).toString(16).padStart(2, '0')).join('');
}

const poses = new Map<string, Figure>();

/** One of ten lying poses of a soldier (five views, each turned both ways), 32x16, with a pool of blood behind the body. */
export function corpsePose(side: FigureSide, index: number): Figure {
  const i = ((index % POSES) + POSES) % POSES;
  const key = `${side}_${i}`;
  let f = poses.get(key);
  if (!f) {
    const body = bodyFigure(side, VIEWS[i >> 1]);
    const lying = i & 1 ? rotateCCW(body) : rotateCW(body);
    const pixels = lying.pixels.map((p, n) => {
      if (p) return dim(p);
      const x = n % lying.width;
      const y = Math.floor(n / lying.width);
      const inside = ((x - 15.5) / 15.5) ** 2 + ((y - 11) / 5) ** 2 <= 1;
      if (!inside) return null;
      return (x * 3 + y * 5) % 7 === 0 ? POOL_COLOUR.light : POOL_COLOUR.base;
    });
    f = { name: `corpse_${side === 'squad' ? 'player' : 'enemy'}_p${i}`, width: lying.width, height: lying.height, pixels };
    poses.set(key, f);
  }
  return f;
}

/** A small fixed hash of a unit id, so a corpse always looks the same. */
function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h ^ (h >>> 15)) >>> 0;
}

export interface CorpseLook {
  image: Figure;
  /** 0: one tile. 1: two tiles, the unit's tile and the one to its east. -1: the one to its west and the unit's tile. */
  extend: -1 | 0 | 1;
}

function free(s: GameState, x: number, y: number): boolean {
  return s.tiles[y]?.[x]?.kind === 'floor' && !s.items.some((it) => it.pos.x === x && it.pos.y === y);
}

/** How a dead unit lies: a soldier laid down over two tiles when there is room, else the compact one-tile body. */
export function corpseLook(s: GameState, u: Unit): CorpseLook {
  const compact: CorpseLook = { image: corpseImage(u.side), extend: 0 };
  if (!free(s, u.pos.x, u.pos.y)) return compact; // an item under the body must stay visible
  const h = hash(u.id);
  const first = h & 1 ? 1 : -1;
  const extend = [first, -first as 1 | -1].find((d) => free(s, u.pos.x + d, u.pos.y));
  if (extend === undefined) return compact;
  return { image: corpsePose(u.side === 'player' ? 'squad' : 'enemy', (h >>> 8) % POSES), extend: extend as 1 | -1 };
}

const halves = new Map<Figure, [Figure, Figure]>();

/** The left and right 16x16 tile of a 32x16 pose. */
export function corpseHalves(f: Figure): [Figure, Figure] {
  let h = halves.get(f);
  if (!h) {
    const half = (side: 0 | 1): Figure => {
      const pixels: (string | null)[] = [];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pixels.push(f.pixels[y * f.width + side * 16 + x]);
      return { name: `${f.name}_${side ? 'r' : 'l'}`, width: 16, height: 16, pixels };
    };
    h = [half(0), half(1)];
    halves.set(f, h);
  }
  return h;
}
