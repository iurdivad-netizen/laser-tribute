import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { luminance } from '../src/art/recolour';
import { THEMES, tileImage, wallImage } from '../src/art/theme';
import { OUTLINE } from '../src/art/wallvariant';
import { THEME_IDS } from '../src/core/themes';
import { E, N, NE, S, W } from '../src/render/wallmask';

const MASKS = [0, N, E | S, N | E | W, N | E | S | W, NE, N | S, E | W];

describe('wallImage', () => {
  it('is the plain themed wall for mask 0, the same object, in every theme', () => {
    for (const id of THEME_IDS) expect(wallImage(id, 0)).toBe(tileImage(id, 'wall', false, 0, 0));
    expect(wallImage('base', 0)).toBe(imageOf('wall'));
  });

  it('gives every theme and mask a 16x16 figure, cached: the same object every call', () => {
    for (const id of THEME_IDS) {
      for (const mask of MASKS) {
        const f = wallImage(id, mask);
        expect([f.width, f.height]).toEqual([16, 16]);
        expect(wallImage(id, mask), `${id} ${mask}`).toBe(f);
      }
    }
  });

  it('draws the same dark outline in every theme', () => {
    for (const id of THEME_IDS) {
      const f = wallImage(id, N);
      for (let x = 0; x < 16; x++) expect(f.pixels[x]).toBe(OUTLINE);
      expect(wallImage(id, W).pixels[5 * 16]).toBe(OUTLINE);
    }
  });

  it('keeps the themed wall colours inside the tile', () => {
    for (const id of THEME_IDS) {
      const plain = wallImage(id, 0);
      const f = wallImage(id, N);
      expect(f.pixels.slice(2 * 16)).toEqual(plain.pixels.slice(2 * 16)); // below the two edge rows nothing changed
    }
  });

  it('gives different masks different images, and different themes different images', () => {
    expect(wallImage('base', N).pixels).not.toEqual(wallImage('base', S).pixels);
    expect(wallImage('base', N).pixels).not.toEqual(wallImage('steel', N).pixels);
  });

  it('keeps the outline clearly darker than the wall of every theme', () => {
    for (const id of THEME_IDS) {
      const wall = wallImage(id, 0).pixels.filter((p): p is string => p !== null);
      const mean = wall.reduce((s, p) => s + luminance(p), 0) / wall.length;
      expect(mean - luminance(OUTLINE), id).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('falls back to base for an unknown or inherited theme id', () => {
    expect(wallImage('swamp', N)).toBe(wallImage('base', N));
    expect(wallImage('constructor', 0)).toBe(imageOf('wall'));
    expect(THEMES.base.wall).toBe('wall');
  });
});
