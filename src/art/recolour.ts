import type { Figure } from './figure';

/** Three colours a gradient map blends between: the darkest pixels take `shadow`, the middle `mid`, the lightest `light`. */
export interface Ramp {
  shadow: string;
  mid: string;
  light: string;
}

const channels = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const linear = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toHex = (c: number[]): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** The relative luminance of a `#rrggbb` colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => v + (b[i] - v) * t);

/**
 * A gradient map: every opaque pixel is placed by its brightness within the image (darkest 0, lightest 1) and takes the
 * colour of the ramp there, blending shadow to mid over the lower half and mid to light over the upper half. The texture
 * of the image (its specks, seams and outlines) stays, the colours change. Transparent pixels stay transparent; a flat
 * image maps to `mid`. Pieces that belong together (the closed and open door) pass one shared `range`, so the same
 * source colour gets the same result in both.
 */
export function recolour(fig: Figure, ramp: Ramp, name: string, range?: { lo: number; hi: number }): Figure {
  const lums = fig.pixels.map((p) => (p === null ? null : luminance(p)));
  const seen = lums.filter((l): l is number => l !== null);
  if (seen.length === 0) return { name, width: fig.width, height: fig.height, pixels: [...fig.pixels] };
  const lo = range ? range.lo : Math.min(...seen);
  const hi = range ? range.hi : Math.max(...seen);
  const [shadow, mid, light] = [ramp.shadow, ramp.mid, ramp.light].map(channels);
  const pixels = lums.map((l) => {
    if (l === null) return null;
    const t = hi === lo ? 0.5 : (l - lo) / (hi - lo);
    return toHex(t <= 0.5 ? mix(shadow, mid, t * 2) : mix(mid, light, (t - 0.5) * 2));
  });
  return { name, width: fig.width, height: fig.height, pixels };
}

/** The least and greatest luminance over the opaque pixels of several images (the shared range of a set of pieces). */
export function luminanceRange(figs: Figure[]): { lo: number; hi: number } {
  const all = figs.flatMap((f) => f.pixels.filter((p): p is string => p !== null).map(luminance));
  return { lo: Math.min(...all), hi: Math.max(...all) };
}
