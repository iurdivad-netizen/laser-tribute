import type { Figure } from './figure';
import { IMAGE_DATA, type ImageName } from './images.generated';

export type { ImageName };

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const cache = new Map<ImageName, Figure>();

/** A tile, door, item, corpse, decal or prop image, built once from the generated data: 16 wide and 16 tall (a prop may be taller). */
export function imageOf(name: ImageName): Figure {
  let f = cache.get(name);
  if (!f) {
    const { palette, rows } = IMAGE_DATA[name];
    const pixels: (string | null)[] = [];
    for (const row of rows) for (const ch of row) pixels.push(ch === '.' ? null : palette[DIGITS.indexOf(ch)]);
    f = { name, width: 16, height: rows.length, pixels };
    cache.set(name, f);
  }
  return f;
}
