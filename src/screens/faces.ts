import { renderFace, type Pixels } from '../art/facegen';
import { faceSpec } from '../core/world/faces';

type Make = (p: Pixels) => CanvasImageSource | null;

/** Turns pixels into a canvas; without a DOM (node tests) there is nothing to make. */
const canvasMake: Make = (p) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = p.w;
  canvas.height = p.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const data = ctx.createImageData(p.w, p.h);
  data.data.set(p.rgba);
  ctx.putImageData(data, 0, 0);
  return canvas;
};

const made = new WeakMap<Make, Map<string, CanvasImageSource | null>>();

/** A soldier's face, composed from the name and kept (so it is made once). Without a DOM (node tests) there is none: `null`. */
export function faceImage(name: string, small: boolean, make: Make = canvasMake): CanvasImageSource | null {
  if (make === canvasMake && typeof document === 'undefined') return null; // no canvas: no face, even one made earlier
  let cache = made.get(make);
  if (!cache) made.set(make, (cache = new Map()));
  const key = `${small ? 16 : 64}:${name}`;
  if (!cache.has(key)) cache.set(key, make(renderFace(faceSpec(name), small ? 16 : 64)));
  return cache.get(key) ?? null;
}
