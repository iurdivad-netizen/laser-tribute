import { describe, expect, it } from 'vitest';
import { imageOf, type ImageName } from '../src/art/image';
import { DECAL_PER_100, THEMES, decalFor, propFor, propImage } from '../src/art/theme';
import { THEME_IDS } from '../src/core/themes';

const BY_THEME: Record<string, string[]> = {
  base: ['prop_supply_crate', 'prop_oil_drum', 'prop_sandbags', 'prop_crate_stack', 'prop_barrier', 'prop_tyres'],
  timber: ['prop_wood_crate', 'prop_barrel', 'prop_plank_stack', 'prop_hay_bale', 'prop_workbench', 'prop_cask'],
  steel: ['prop_machine', 'prop_tank', 'prop_server_rack', 'prop_generator', 'prop_pipe_run', 'prop_console'],
  cave: ['prop_boulder', 'prop_rocks', 'prop_stalagmite', 'prop_crystals', 'prop_bone_pile', 'prop_mushrooms'],
  stone: ['prop_pillar', 'prop_urn', 'prop_statue', 'prop_brazier', 'prop_sarcophagus', 'prop_broken_column'],
};
const NAMES = Object.values(BY_THEME).flat() as ImageName[];
const DECALS = ['decal_stain', 'decal_cracks', 'decal_debris', 'decal_straw', 'decal_scrap', 'decal_grate', 'decal_cable', 'decal_pebbles', 'decal_puddle', 'decal_moss', 'decal_rubble', 'decal_chips', 'decal_rune'] as ImageName[];

describe('the thirty prop images', () => {
  for (const name of NAMES) {
    it(`${name} is 16 wide and 16 to 24 tall, with transparent corners and a dark outline, its feet in the tile`, () => {
      const f = imageOf(name);
      expect(f.width).toBe(16);
      expect(f.height).toBeGreaterThanOrEqual(16);
      expect(f.height).toBeLessThanOrEqual(24);
      for (const [x, y] of [[0, 0], [15, 0], [0, f.height - 1], [15, f.height - 1]]) expect(f.pixels[y * 16 + x]).toBeNull();
      const opaque = f.pixels.filter((p) => p !== null).length;
      expect(opaque).toBeGreaterThan(40);
      expect(opaque).toBeLessThan(260);
      expect(f.pixels).toContain('#0b0c12');
      // nothing is drawn in the last two rows: the base outline sits in tile row 13, as for the first ten props
      expect(f.pixels.slice((f.height - 2) * 16).every((p) => p === null)).toBe(true);
    });
  }

  it('are all different drawings', () => {
    const seen = new Set(NAMES.map((n) => imageOf(n).pixels.join('|')));
    expect(seen.size).toBe(30);
  });
});

describe('the thirteen floor decals', () => {
  for (const name of DECALS) {
    it(`${name} is a flat 16x16 mark with a transparent edge and no outline`, () => {
      const f = imageOf(name);
      expect([f.width, f.height]).toEqual([16, 16]);
      const opaque = f.pixels.filter((p) => p !== null);
      expect(opaque.length).toBeGreaterThan(8);
      expect(opaque.length).toBeLessThan(120);
      expect(opaque).not.toContain('#0b0c12');
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) expect(f.pixels[y * 16 + x], `${name} corner`).toBeNull();
    });
  }
});

describe('propImage', () => {
  it('gives each theme its six props, the same object every time', () => {
    for (const id of THEME_IDS) {
      for (const v of [0, 1, 2, 3, 4, 5] as const) {
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

describe('propFor', () => {
  it('the letter picks the kind (even or odd places) and the position picks among three, steadily', () => {
    for (const id of THEME_IDS) {
      const seen = new Set<string>();
      for (let x = 0; x < 40; x++) {
        for (const letter of [0, 1] as const) {
          const y = (x * 3) % 17;
          const f = propFor(id, letter, x, y);
          expect(BY_THEME[id].indexOf(f.name) % 2).toBe(letter);
          expect(propFor(id, letter, x, y)).toBe(f);
          seen.add(f.name);
        }
      }
      expect(seen.size).toBe(6); // a whole map shows every picture of the theme
    }
  });
});

describe('decalFor', () => {
  it('puts a decal on about the share of tiles asked for, always the same one, from the three of the theme', () => {
    for (const id of THEME_IDS) {
      let n = 0;
      const names = new Set<string>();
      for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
        const d = decalFor(id, x, y);
        expect(decalFor(id, x, y)).toBe(d);
        if (d) { n++; names.add(d.name); }
      }
      expect(n / 3600).toBeGreaterThan((DECAL_PER_100 / 100) * 0.7);
      expect(n / 3600).toBeLessThan((DECAL_PER_100 / 100) * 1.3);
      expect([...names].sort()).toEqual([...new Set(THEMES[id].decals)].sort());
    }
  });

  it('falls back to the base theme for an unknown id', () => {
    for (let x = 0; x < 200; x++) {
      const d = decalFor('swamp', x, 0);
      if (d) expect(THEMES.base.decals).toContain(d.name);
    }
  });
});
