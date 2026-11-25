import { renderFace, type Pixels } from '../art/facegen';
import type { Art } from '../art/planetimages';
import { faceSpec } from '../core/world/faces';
import { faceFor, type CampArtId } from './campart';

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

/**
 * A soldier's face: the painted one for the four originals, otherwise one composed from the name (kept, so it is
 * made once). Where none can be made it is the plain recruit image, which may itself still be loading (`null`).
 */
export function faceImage(art: Art<CampArtId>, name: string, small: boolean, make: Make = canvasMake): CanvasImageSource | null {
  const painted = faceFor(name);
  if (painted !== 'face_recruit') return art.image(small ? `${painted}_s` : painted);
  // the generic speaker of the story is nobody in the barracks, so it gets no made-up face
  if (name === 'RECRUIT') return art.image(small ? 'face_recruit_s' : 'face_recruit');
  let cache = made.get(make);
  if (!cache) made.set(make, (cache = new Map()));
  const key = `${small ? 16 : 64}:${name}`;
  if (!cache.has(key)) cache.set(key, make(renderFace(faceSpec(name), small ? 16 : 64)));
  return cache.get(key) ?? art.image(small ? 'face_recruit_s' : 'face_recruit');
}
