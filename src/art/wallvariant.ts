import { E, N, NE, NW, S, SE, SW, W } from '../render/wallmask';
import type { Figure } from './figure';

/** The dark the soldier sprites use for their outline. */
export const OUTLINE = '#0b0c12';
const BLEND = 0.35;

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lighten = (hex: string): string => toHex(channels(hex).map((c) => c + (255 - c) * BLEND));
const darken = (hex: string): string => toHex(channels(hex).map((c) => c * (1 - BLEND)));

/**
 * The wall image with edges for the open sides in `mask` (see `wallMask`): a one-pixel dark outline along each open side,
 * a lighter row just inside the north edge, a darker row just inside the south edge, and one dark pixel in an inner
 * corner. The outline wins where they meet. Mask 0 returns `base` itself; transparent pixels are never touched.
 */
export function wallVariant(base: Figure, mask: number, name: string): Figure {
  if (mask === 0) return base;
  const w = base.width;
  const h = base.height;
  const pixels = [...base.pixels];
  const set = (x: number, y: number, f: (p: string) => string): void => {
    const p = pixels[y * w + x];
    if (p !== null) pixels[y * w + x] = f(p);
  };
  const outline = () => OUTLINE;
  if (mask & N) for (let x = 0; x < w; x++) set(x, 1, lighten);
  if (mask & S) for (let x = 0; x < w; x++) set(x, h - 2, darken);
  if (mask & N) for (let x = 0; x < w; x++) set(x, 0, outline);
  if (mask & S) for (let x = 0; x < w; x++) set(x, h - 1, outline);
  if (mask & E) for (let y = 0; y < h; y++) set(w - 1, y, outline);
  if (mask & W) for (let y = 0; y < h; y++) set(0, y, outline);
  if (mask & NE) set(w - 1, 0, outline);
  if (mask & SE) set(w - 1, h - 1, outline);
  if (mask & SW) set(0, h - 1, outline);
  if (mask & NW) set(0, 0, outline);
  return { name, width: w, height: h, pixels };
}
