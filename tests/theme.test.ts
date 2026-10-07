import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { floorVariant } from '../src/art/sprite';
import { THEMES, corpseImage, itemImage, themeFor, tileImage } from '../src/art/theme';
import { createMission, MISSIONS } from '../src/core/missions';

describe('imageOf', () => {
  it('returns a 16x16 figure named after the image, the same object every time', () => {
    const f = imageOf('wall');
    expect(f.name).toBe('wall');
    expect(f.width).toBe(16);
    expect(f.height).toBe(16);
    expect(f.pixels).toHaveLength(256);
    expect(f.pixels.every((p) => p !== null)).toBe(true); // a wall fills its tile
    expect(imageOf('wall')).toBe(f);
  });

  it('gives items and corpses transparent pixels', () => {
    expect(imageOf('item_rifle').pixels.some((p) => p === null)).toBe(true);
    expect(imageOf('corpse_enemy').pixels.some((p) => p === null)).toBe(true);
  });
});

describe('the theme lookup', () => {
  it('has the base theme with three different floors, a wall and two doors', () => {
    const t = THEMES.base;
    expect(new Set(t.floors).size).toBe(3);
    expect(t.wall).toBe('wall');
    expect(t.doorClosed).not.toBe(t.doorOpen);
  });

  it('picks the floor variant by position, the same every time and all three over a map', () => {
    const seen = new Set<string>();
    for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) {
      const f = tileImage('base', 'floor', false, x, y);
      expect(f).toBe(tileImage('base', 'floor', false, x, y));
      expect(f.name).toBe(THEMES.base.floors[floorVariant(x, y)]);
      seen.add(f.name);
    }
    expect(seen.size).toBe(3);
  });

  it('gives the wall, and the closed or open door as remembered', () => {
    expect(tileImage('base', 'wall', false, 3, 4).name).toBe('wall');
    expect(tileImage('base', 'door', false, 3, 4).name).toBe('door_closed');
    expect(tileImage('base', 'door', true, 3, 4).name).toBe('door_open');
    expect(tileImage('base', 'floor', true, 3, 4).name).toMatch(/^floor_/); // open means nothing for a floor
  });

  it('falls back to the base theme for an unknown theme id', () => {
    expect(tileImage('swamp', 'wall', false, 1, 1).name).toBe('wall');
    expect(tileImage('swamp', 'floor', false, 5, 5).name).toBe(tileImage('base', 'floor', false, 5, 5).name);
  });

  it('themeFor gives base for every state today', () => {
    expect(themeFor(createMission(MISSIONS[0], 1))).toBe('base');
  });
});

describe('items and corpses', () => {
  it('map every item kind and both sides to their image', () => {
    expect(itemImage('rifle').name).toBe('item_rifle');
    expect(itemImage('pistol').name).toBe('item_pistol');
    expect(itemImage('grenade').name).toBe('item_grenade');
    expect(corpseImage('player').name).toBe('corpse_player');
    expect(corpseImage('enemy').name).toBe('corpse_enemy');
  });
});
