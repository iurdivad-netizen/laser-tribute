import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { THEMES, tileImage } from '../src/art/theme';
import { MAP_THEMES, THEME_IDS, themeOfMap } from '../src/core/themes';
import { floorVariant } from '../src/art/sprite';

const KINDS: ['floor' | 'wall' | 'door', boolean][] = [['floor', false], ['wall', false], ['door', false], ['door', true]];
const pieces = (theme: string) => KINDS.map(([kind, open]) => tileImage(theme, kind, open, 3, 4));

describe('the map table', () => {
  it('maps the ten campaign map types and nothing else to the five themes', () => {
    expect([...THEME_IDS]).toEqual(['base', 'timber', 'steel', 'cave', 'stone']);
    expect(MAP_THEMES).toEqual({
      outpost: 'base', compound: 'base', warehouse: 'timber', village: 'timber', factory: 'steel', station: 'steel',
      mine: 'cave', bunker: 'cave', fortress: 'stone', citadel: 'stone',
    });
    for (const id of Object.keys(MAP_THEMES)) expect(themeOfMap(id)).toBe(MAP_THEMES[id]);
  });

  it('falls back to base for an unknown id or an inherited key', () => {
    expect(themeOfMap('swamp')).toBe('base');
    expect(themeOfMap('constructor')).toBe('base');
    expect(themeOfMap('__proto__')).toBe('base');
    expect(themeOfMap('')).toBe('base');
  });
});

describe('themed tiles', () => {
  it('returns the original image objects for base', () => {
    expect(tileImage('base', 'wall', false, 1, 1)).toBe(imageOf('wall'));
    expect(tileImage('base', 'door', true, 1, 1)).toBe(imageOf('door_open'));
    expect(tileImage('base', 'floor', false, 1, 1)).toBe(imageOf(THEMES.base.floors[floorVariant(1, 1)]));
  });

  it('recolours every piece for the other themes, cached: the same object every call', () => {
    for (const id of THEME_IDS.filter((t) => t !== 'base')) {
      const a = pieces(id);
      const b = pieces(id);
      a.forEach((fig, i) => {
        expect(fig, `${id} ${i}`).toBe(b[i]);
        expect(fig.width).toBe(16);
      });
      expect(a[1]).not.toBe(imageOf('wall'));
      expect(a[1].pixels).not.toEqual(imageOf('wall').pixels);
    }
  });

  it('keeps the transparent pixels of the open door and the shape of every piece', () => {
    for (const id of THEME_IDS.filter((t) => t !== 'base')) {
      const base = KINDS.map(([kind, open]) => tileImage('base', kind, open, 3, 4));
      pieces(id).forEach((fig, i) => {
        expect(fig.pixels.map((p) => p === null)).toEqual(base[i].pixels.map((p) => p === null));
      });
    }
  });

  it('keeps the floor variant by position and the closed and open doors apart in every theme', () => {
    for (const id of THEME_IDS) {
      const seen = new Set<string>();
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) seen.add(tileImage(id, 'floor', false, x, y).name);
      expect(seen.size, id).toBe(3);
      expect(tileImage(id, 'door', false, 1, 1).pixels).not.toEqual(tileImage(id, 'door', true, 1, 1).pixels);
    }
  });

  it('gives each theme its own look: no two themes share a piece', () => {
    const ids = [...THEME_IDS];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pieces(ids[i]);
        const b = pieces(ids[j]);
        a.forEach((fig, k) => expect(fig.pixels, `${ids[i]} vs ${ids[j]} piece ${k}`).not.toEqual(b[k].pixels));
      }
    }
  });

  it('falls back to base for an unknown theme and for an inherited key', () => {
    expect(tileImage('swamp', 'wall', false, 1, 1)).toBe(imageOf('wall'));
    expect(tileImage('constructor', 'wall', false, 1, 1)).toBe(imageOf('wall'));
  });

  it('lets a theme override one role with a named image, leaving the others recoloured', () => {
    const saved = THEMES.stone.overrides;
    THEMES.stone.overrides = { wall: 'door_closed' };
    try {
      expect(tileImage('stone', 'wall', false, 0, 0)).toBe(imageOf('door_closed'));
      expect(tileImage('stone', 'floor', false, 0, 0)).not.toBe(imageOf(THEMES.stone.floors[floorVariant(0, 0)]));
    } finally {
      THEMES.stone.overrides = saved;
    }
  });
});
