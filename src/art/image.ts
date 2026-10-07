import type { Figure } from './figure';
import { IMAGE_DATA, type ImageName } from './images.generated';

export type { ImageName };

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const cache = new Map<ImageName, Figure>();

/** A 16x16 tile, door, item or corpse image, built once from the generated data. */
export function imageOf(name: ImageName): Figure {
  let f = cache.get(name);
  if (!f) {
    const { palette, rows } = IMAGE_DATA[name];
    const pixels: (string | null)[] = [];
    for (const row of rows) for (const ch of row) pixels.push(ch === '.' ? null : palette[DIGITS.indexOf(ch)]);
    f = { name, width: 16, height: 16, pixels };
    cache.set(name, f);
  }
  return f;
}
