import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { imageOf } from '../src/art/image';
import { THEMES, themeFor, tileImage } from '../src/art/theme';
import { generateMission } from '../src/core/gen';
import { RECIPES } from '../src/core/gen/recipes';
import { createMission, MISSIONS } from '../src/core/missions';
import { MAP_THEMES } from '../src/core/themes';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { makeState } from './helpers';

describe('the theme of a mission', () => {
  it('is base for a map parsed without a mission', () => {
    expect(makeState(['###', '#P#', '###']).theme).toBe('base');
    expect(themeFor(makeState(['###', '#P#', '###']))).toBe('base');
  });

  it('follows the map type of the three hand-drawn tutorial missions', () => {
    expect(MISSIONS.map((m) => [m.id, createMission(m, 1).theme])).toEqual([['outpost', 'base'], ['warehouse', 'timber'], ['compound', 'base']]);
  });

  it('follows the map type of every generated campaign mission', () => {
    RECIPES.forEach((recipe, type) => {
      const def = generateMission(type, 0);
      expect(def.id).toBe(recipe.id);
      const state = createMission(def, 1);
      expect(state.theme, recipe.id).toBe(MAP_THEMES[recipe.id]);
      expect(themeFor(state)).toBe(MAP_THEMES[recipe.id]);
    });
  });

  it('is base for a mission of an unknown map type', () => {
    expect(createMission({ ...MISSIONS[0], id: 'swamp' }, 1).theme).toBe('base');
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

describe('drawing a themed mission', () => {
  const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

  function drawn(theme: 'base' | 'steel') {
    const state = createMission(MISSIONS[0], 1);
    state.theme = theme;
    const names: string[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const real = atlas.drawImage.bind(atlas);
    atlas.drawImage = (c, fig, x, y, o = {}) => { names.push(fig.name); return real(c, fig, x, y, o); };
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    return names;
  }

  it('draws the theme tile images, and the soldiers, items and corpses as before', () => {
    const steel = drawn('steel');
    expect(steel.some((n) => /^wall@steel(#\d+)?$/.test(n))).toBe(true);
    expect(steel.some((n) => /^floor_[abc]@steel$/.test(n))).toBe(true);
    expect(steel.some((n) => n.startsWith('squad_'))).toBe(true);
    expect(steel.filter((n) => /^wall(#\d+)?$/.test(n))).toEqual([]);
    const base = drawn('base');
    expect(base.some((n) => /^wall(#\d+)?$/.test(n))).toBe(true);
    expect(base.filter((n) => n.includes('@'))).toEqual([]);
    expect(THEMES.steel.ramps).toBeDefined();
    expect(tileImage('steel', 'wall', false, 0, 0)).not.toBe(imageOf('wall'));
  });
});
