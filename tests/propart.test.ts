import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { THEMES, propImage } from '../src/art/theme';
import { THEME_IDS } from '../src/core/themes';

const NAMES = ['prop_supply_crate', 'prop_oil_drum', 'prop_wood_crate', 'prop_barrel', 'prop_machine', 'prop_tank', 'prop_boulder', 'prop_rocks', 'prop_pillar', 'prop_urn'] as const;
const BY_THEME: Record<string, [string, string]> = {
  base: ['prop_supply_crate', 'prop_oil_drum'],
  timber: ['prop_wood_crate', 'prop_barrel'],
  steel: ['prop_machine', 'prop_tank'],
  cave: ['prop_boulder', 'prop_rocks'],
  stone: ['prop_pillar', 'prop_urn'],
};

describe('the ten prop images', () => {
  for (const name of NAMES) {
    it(`${name} is a 16x16 drawing with transparent corners and a dark outline`, () => {
      const f = imageOf(name);
      expect([f.width, f.height]).toEqual([16, 16]);
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) expect(f.pixels[y * 16 + x]).toBeNull();
      const opaque = f.pixels.filter((p) => p !== null).length;
      expect(opaque).toBeGreaterThan(40);
      expect(opaque).toBeLessThan(200);
      expect(f.pixels).toContain('#0b0c12');
    });
  }

  it('are all different drawings', () => {
    const seen = new Set(NAMES.map((n) => imageOf(n).pixels.join('|')));
    expect(seen.size).toBe(10);
  });
});

describe('propImage', () => {
  it('gives each theme its two props, the same object every time', () => {
    for (const id of THEME_IDS) {
      for (const v of [0, 1] as const) {
        expect(propImage(id, v).name).toBe(BY_THEME[id][v]);
        expect(propImage(id, v)).toBe(propImage(id, v));
      }
      expect(THEMES[id].props).toEqual(BY_THEME[id]);
    }
  });

  it('falls back to base for an unknown or inherited theme id', () => {
    expect(propImage('swamp', 0).name).toBe('prop_supply_crate');
    expect(propImage('constructor', 1).name).toBe('prop_oil_drum');
  });
});
