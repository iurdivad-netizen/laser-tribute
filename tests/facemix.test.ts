import { describe, expect, it } from 'vitest';
import { FACES, allowedPicks, isAllowed, mixFace, type FaceName } from '../scripts/mix-faces.mjs';

const own = (n: FaceName) => ({ head: n, eyes: n, mouth: n, clothes: n });

describe('mixed faces', () => {
  const picks = allowedPicks();

  it('keeps every original portrait', () => {
    for (const name of FACES) expect(isAllowed(own(name))).toBe(true);
  });

  it('never offers a swap that looked wrong', () => {
    for (const { head, eyes, mouth, clothes } of picks) {
      if (eyes !== head) expect(['chen', 'woman', 'veteran']).not.toContain(eyes);
      if (mouth !== head) expect(['chen', 'dubois', 'blonde']).not.toContain(mouth);
      if (head === 'woman' || head === 'blonde') expect(mouth).not.toBe('veteran');
      if (head === 'chen' || head === 'man') expect(['woman', 'veteran']).not.toContain(clothes);
      if (head === 'blonde') expect(clothes).not.toBe('woman');
    }
  });

  it('refuses to draw a swap that is not allowed', () => {
    expect(() => mixFace({ ...own('dubois'), eyes: 'chen' })).toThrow('not allowed');
    expect(() => mixFace({ ...own('woman'), mouth: 'veteran' })).toThrow('not allowed');
    expect(() => mixFace({ ...own('man'), clothes: 'veteran' })).toThrow('not allowed');
  });

  it('draws 337 different 64 x 64 faces', () => {
    const faces = picks.map((pick) => mixFace(pick));
    const sizes = new Set(faces.map(({ width, height }) => `${width}x${height}`));
    const drawn = new Set(faces.map(({ rgba }) => String.fromCharCode(...rgba)));
    expect(picks).toHaveLength(337);
    expect([...sizes]).toEqual(['64x64']);
    expect(drawn.size).toBe(337);
  }, 30_000); // draws every face: slow when the whole suite runs at once
});
