import { describe, expect, it } from 'vitest';
import type { Figure } from '../src/art/figure';
import { OUTLINE, wallVariant } from '../src/art/wallvariant';
import { E, N, NE, NW, S, SE, SW, W } from '../src/render/wallmask';

const GREY = '#808080';
const LIGHT = '#acacac'; // 128 + 127 * 0.35, rounded
const DARK = '#535353'; // 128 * 0.65, rounded
const flat = (): Figure => ({ name: 'wall', width: 16, height: 16, pixels: Array(256).fill(GREY) });
const at = (f: Figure, x: number, y: number) => f.pixels[y * 16 + x];
const changed = (a: Figure, b: Figure) => a.pixels.map((p, i) => (p !== b.pixels[i] ? i : -1)).filter((i) => i >= 0);

describe('wallVariant', () => {
  it('returns the base itself for mask 0', () => {
    const base = flat();
    expect(wallVariant(base, 0, 'x')).toBe(base);
  });

  it('keeps the size and takes the given name, without changing the base', () => {
    const base = flat();
    const copy = [...base.pixels];
    const v = wallVariant(base, N, 'wall#1');
    expect([v.width, v.height, v.name]).toEqual([16, 16, 'wall#1']);
    expect(base.pixels).toEqual(copy);
  });

  it('draws an outline row with a highlight under it for an open north side', () => {
    const v = wallVariant(flat(), N, 'v');
    for (let x = 0; x < 16; x++) {
      expect(at(v, x, 0)).toBe(OUTLINE);
      expect(at(v, x, 1)).toBe(LIGHT);
    }
    expect(changed(flat(), v)).toHaveLength(32);
  });

  it('draws an outline row with a shade above it for an open south side', () => {
    const v = wallVariant(flat(), S, 'v');
    for (let x = 0; x < 16; x++) {
      expect(at(v, x, 15)).toBe(OUTLINE);
      expect(at(v, x, 14)).toBe(DARK);
    }
    expect(changed(flat(), v)).toHaveLength(32);
  });

  it('draws an outline column for an open east or west side, and nothing else', () => {
    const e = wallVariant(flat(), E, 'v');
    const w = wallVariant(flat(), W, 'v');
    for (let y = 0; y < 16; y++) {
      expect(at(e, 15, y)).toBe(OUTLINE);
      expect(at(w, 0, y)).toBe(OUTLINE);
    }
    expect(changed(flat(), e)).toHaveLength(16);
    expect(changed(flat(), w)).toHaveLength(16);
  });

  it('lets the outline win where it meets a highlight or a shade', () => {
    const v = wallVariant(flat(), N | W | S | E, 'v');
    expect(at(v, 0, 1)).toBe(OUTLINE); // west column over the highlight row
    expect(at(v, 15, 14)).toBe(OUTLINE); // east column over the shade row
    expect(at(v, 5, 1)).toBe(LIGHT);
    expect(at(v, 5, 14)).toBe(DARK);
    expect(at(v, 5, 7)).toBe(GREY);
  });

  it('changes exactly one pixel for an inner corner', () => {
    const spots: [number, number, number][] = [[NE, 15, 0], [SE, 15, 15], [SW, 0, 15], [NW, 0, 0]];
    for (const [bit, x, y] of spots) {
      const v = wallVariant(flat(), bit, 'v');
      expect(at(v, x, y)).toBe(OUTLINE);
      expect(changed(flat(), v)).toEqual([y * 16 + x]);
    }
  });

  it('never touches transparent pixels', () => {
    const base = flat();
    base.pixels[0] = null;
    base.pixels[1 * 16 + 5] = null;
    const v = wallVariant(base, N | S | E | W | NE, 'v');
    expect(v.pixels[0]).toBeNull();
    expect(v.pixels[16 + 5]).toBeNull();
  });
});
