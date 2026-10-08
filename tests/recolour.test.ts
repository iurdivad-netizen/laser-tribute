import { describe, expect, it } from 'vitest';
import type { Figure } from '../src/art/figure';
import { luminance, recolour } from '../src/art/recolour';

const RAMP = { shadow: '#000000', mid: '#808080', light: '#ffffff' };
const fig = (pixels: (string | null)[], w = pixels.length): Figure => ({ name: 'src', width: w, height: pixels.length / w, pixels });

describe('luminance', () => {
  it('is 0 for black, 1 for white and rises with brightness', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#808080')).toBeGreaterThan(luminance('#404040'));
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
  });
});

describe('recolour', () => {
  it('maps the darkest pixel to shadow, the lightest to light and the middle to mid', () => {
    const r = recolour(fig(['#101010', '#808080', '#f0f0f0']), { shadow: '#102030', mid: '#405060', light: '#a0b0c0' }, 'out');
    expect(r.pixels[0]).toBe('#102030');
    expect(r.pixels[2]).toBe('#a0b0c0');
    // the middle source pixel is not at the exact middle of the brightness range, so it lies between shadow and light
    const mid = r.pixels[1]!;
    expect(luminance(mid)).toBeGreaterThan(luminance('#102030'));
    expect(luminance(mid)).toBeLessThan(luminance('#a0b0c0'));
  });

  it('puts a pixel exactly halfway in brightness on mid', () => {
    // brightness 0, 0.5, 1 of the range: build sources from the luminance of grey levels
    const levels = ['#000000', '#bcbcbc', '#ffffff'];
    const half = (luminance(levels[0]) + luminance(levels[2])) / 2;
    const grey = levels[1];
    expect(Math.abs(luminance(grey) - half)).toBeLessThan(0.01); // #bcbcbc is the sRGB grey at half the linear luminance
    const r = recolour(fig(levels), RAMP, 'out');
    const got = [1, 3, 5].map((i) => parseInt(r.pixels[1]!.slice(i, i + 2), 16));
    for (const c of got) expect(Math.abs(c - 0x80)).toBeLessThanOrEqual(2); // the grey is only about halfway, to within rounding
  });

  it('keeps transparent pixels transparent, the size and the given name', () => {
    const r = recolour({ name: 'src', width: 2, height: 2, pixels: ['#202020', null, null, '#e0e0e0'] }, RAMP, 'floor_a@timber');
    expect(r.pixels[1]).toBeNull();
    expect(r.pixels[2]).toBeNull();
    expect([r.width, r.height, r.name]).toEqual([2, 2, 'floor_a@timber']);
  });

  it('never maps a brighter source pixel darker', () => {
    const greys = ['#050505', '#202020', '#404040', '#707070', '#a0a0a0', '#d0d0d0', '#fafafa'];
    const out = recolour(fig(greys), { shadow: '#102010', mid: '#506030', light: '#d0c090' }, 'o').pixels as string[];
    for (let i = 1; i < out.length; i++) expect(luminance(out[i])).toBeGreaterThanOrEqual(luminance(out[i - 1]) - 1e-9);
  });

  it('maps a flat image to mid, and an image with no opaque pixel to itself, without NaN', () => {
    const flat = recolour(fig(['#303030', '#303030', null, '#303030'], 2), RAMP, 'o');
    expect(flat.pixels.filter((p) => p !== null)).toEqual(['#808080', '#808080', '#808080']);
    const empty = recolour(fig([null, null]), RAMP, 'o');
    expect(empty.pixels).toEqual([null, null]);
    const one = recolour(fig(['#123456', null]), RAMP, 'o');
    expect(one.pixels[0]).toBe('#808080');
  });

  it('is deterministic and does not change the source', () => {
    const src = fig(['#101010', '#808080', '#f0f0f0']);
    const copy = [...src.pixels];
    expect(recolour(src, RAMP, 'o').pixels).toEqual(recolour(src, RAMP, 'o').pixels);
    expect(src.pixels).toEqual(copy);
  });
});
