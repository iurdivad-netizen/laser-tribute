import { describe, expect, it } from 'vitest';
import { renderFace, type Pixels } from '../src/art/facegen';
import { FACE_PARTS, faceSpec, type FaceSpec } from '../src/core/world/faces';
import { RECRUIT_SURNAMES } from '../src/core/world/names';

const PARTS = Object.keys(FACE_PARTS) as (keyof FaceSpec)[];
const ZERO: FaceSpec = { skin: 0, hairStyle: 0, hairColour: 0, eyes: 0, brows: 0, mouth: 0, beard: 0, extra: 0 };
const bytes = (p: Pixels) => Array.from(p.rgba).join(',');
const colours = (p: Pixels) => new Set(Array.from({ length: p.w * p.h }, (_, i) => Array.from(p.rgba.slice(i * 4, i * 4 + 4)).join(',')));

describe('renderFace', () => {
  it('draws exactly 64 x 64 and 16 x 16 RGBA pixels, all opaque', () => {
    for (const size of [64, 16] as const) {
      const p = renderFace(faceSpec('Haddad'), size);
      expect([p.w, p.h, p.rgba.length]).toEqual([size, size, size * size * 4]);
      for (let i = 3; i < p.rgba.length; i += 4) expect(p.rgba[i]).toBe(255);
    }
  });

  it('puts the dark background in the corner and a face in the middle, like the painted faces', () => {
    const p = renderFace(ZERO, 64);
    expect(Array.from(p.rgba.slice(0, 3))).toEqual([20, 18, 19]);
    const mid = (32 * 64 + 32) * 4;
    expect(Array.from(p.rgba.slice(mid, mid + 3))).not.toEqual([20, 18, 19]);
  });

  it('is the same bytes for the same spec', () => {
    for (const size of [64, 16] as const) expect(bytes(renderFace(faceSpec('Zhou'), size))).toBe(bytes(renderFace(faceSpec('Zhou'), size)));
  });

  it('shows every value of every part', () => {
    for (const part of PARTS) {
      const seen = new Set<string>();
      for (let v = 0; v < FACE_PARTS[part]; v++) seen.add(bytes(renderFace({ ...ZERO, [part]: v }, 64)));
      expect(seen.size, part).toBe(FACE_PARTS[part]);
    }
  });

  it('keeps the colour count low', () => {
    for (const name of RECRUIT_SURNAMES) {
      expect(colours(renderFace(faceSpec(name), 64)).size, name).toBeLessThanOrEqual(24);
      expect(colours(renderFace(faceSpec(name), 16)).size, name).toBeLessThanOrEqual(16);
    }
  });

  it('keeps small faces apart too', () => {
    const small = new Set(RECRUIT_SURNAMES.map((n) => bytes(renderFace(faceSpec(n), 16))));
    expect(small.size).toBeGreaterThanOrEqual(RECRUIT_SURNAMES.length - 5);
  });

  it('rejects a spec outside the part ranges', () => {
    expect(() => renderFace({ ...ZERO, hairStyle: 99 }, 64)).toThrow();
  });
});
