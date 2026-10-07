import type { Facing, Side, WeaponId } from '../core/types';
import { FIGURE_DATA, FIGURE_HEIGHT, FIGURE_WIDTH } from './figures.generated';

export const FIGURE_W = FIGURE_WIDTH;
export const FIGURE_H = FIGURE_HEIGHT;
/** How many pixel rows of a figure stand above the tile its feet are on. */
export const RISE = FIGURE_H - 16;

export type FigureView = 'n' | 'ne' | 'e' | 'se' | 's';
export type FigureSide = 'squad' | 'enemy';

export const METAL = '#d0d0d0';
export const TIP = '#ffffff';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FACING_VIEW: FigureView[] = ['n', 'ne', 'e', 'se', 's'];

export interface Figure {
  name: string;
  width: number;
  height: number;
  /** Row-major: a hex colour, or null for transparent. */
  pixels: (string | null)[];
}

/**
 * Where the weapon starts (at the hands) and which way it points, per view; a rifle has `rifle` pixels, a pistol about
 * half. The profiles are thin, so every view has its own hand position. Tuned by eye in the dev gallery.
 */
export const WEAPON_AT: Record<FigureView, { x: number; y: number; dx: number; dy: number; rifle: number; thick?: [number, number] }> = {
  n: { x: 14, y: 22, dx: 0, dy: -1, rifle: 7, thick: [1, 0] },
  ne: { x: 11, y: 20, dx: 1, dy: -1, rifle: 5 },
  e: { x: 10, y: 21, dx: 1, dy: 0, rifle: 6, thick: [0, -1] },
  se: { x: 11, y: 20, dx: 1, dy: 1, rifle: 5 },
  s: { x: 13, y: 22, dx: 0, dy: 1, rifle: 5, thick: [-1, 0] },
};

const bodies = new Map<string, Figure>();
const armed = new Map<string, Figure>();
const masks = new Map<string, Uint8Array>();

export function bodyFigure(side: FigureSide, view: FigureView): Figure {
  const key = `${side}_${view}`;
  let f = bodies.get(key);
  if (!f) {
    const { palette, views } = FIGURE_DATA[side];
    const pixels: (string | null)[] = [];
    for (const row of views[view]) for (const ch of row) pixels.push(ch === '.' ? null : palette[DIGITS.indexOf(ch)]);
    f = { name: key, width: FIGURE_W, height: FIGURE_H, pixels };
    bodies.set(key, f);
  }
  return f;
}

/** The body with its weapon painted in: light metal along the barrel and a white tip at the muzzle. */
export function armedFigure(side: FigureSide, view: FigureView, weapon: WeaponId): Figure {
  const key = `${side}_${weapon}_${view}`;
  let f = armed.get(key);
  if (!f) {
    const body = bodyFigure(side, view);
    const pixels = [...body.pixels];
    const at = WEAPON_AT[view];
    const length = weapon === 'rifle' ? at.rifle : Math.max(2, Math.round(at.rifle / 2));
    const put = (x: number, y: number, colour: string): void => {
      if (x < 0 || y < 0 || x >= FIGURE_W || y >= FIGURE_H) throw new Error(`${key}: weapon pixel ${x},${y} is outside the figure`);
      pixels[y * FIGURE_W + x] = colour;
    };
    for (let i = 0; i < length; i++) {
      put(at.x + at.dx * i, at.y + at.dy * i, i === length - 1 ? TIP : METAL);
      // a second pixel beside the barrel (not on diagonals) so the weapon shows at game size
      if (at.thick && i < length - 1) put(at.x + at.dx * i + at.thick[0], at.y + at.dy * i + at.thick[1], METAL);
    }
    f = { name: key, width: FIGURE_W, height: FIGURE_H, pixels };
    armed.set(key, f);
  }
  return f;
}

export function flipFigure(f: Figure): Figure {
  const pixels: (string | null)[] = [];
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) pixels.push(f.pixels[y * f.width + (f.width - 1 - x)]);
  }
  return { ...f, name: `${f.name}:flip`, pixels };
}

/** 1 where the figure has a pixel, as drawn (mirrored when `flip`); the same array is returned for the same figure. */
export function figureMask(f: Figure, flip: boolean): Uint8Array {
  const key = flip ? `${f.name}:flip` : f.name;
  let m = masks.get(key);
  if (!m) {
    const source = flip ? flipFigure(f) : f;
    m = Uint8Array.from(source.pixels, (p) => (p === null ? 0 : 1));
    masks.set(key, m);
  }
  return m;
}

/** Facings 0 to 4 have their own view; 5, 6, 7 are the horizontal mirror of 3, 2, 1. */
export function unitFigure(side: Side, facing: Facing, weapon: WeaponId): { figure: Figure; flip: boolean } {
  const flip = facing > 4;
  const base = flip ? 8 - facing : facing;
  return { figure: armedFigure(side === 'player' ? 'squad' : 'enemy', FACING_VIEW[base], weapon), flip };
}
