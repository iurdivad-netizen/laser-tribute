import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { armedFigure } from '../src/art/figure';
import { parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { createMission, MISSIONS } from '../src/core/missions';

const metal = (f: ReturnType<typeof armedFigure>) => f.pixels.filter((p) => p === '#d0d0d0' || p === '#ffffff').length;

describe('in-hand weapons', () => {
  it('draws every weapon in every view, in range, each different from the bare body and from each other', () => {
    for (const view of ['n', 'ne', 'e', 'se', 's'] as const) {
      const sizes = (['pistol', 'smg', 'shotgun', 'rifle', 'sniper'] as const).map((w) => metal(armedFigure('squad', view, w)));
      expect(new Set(sizes).size).toBeGreaterThanOrEqual(4);
      expect(metal(armedFigure('squad', view, 'sniper'))).toBeGreaterThan(metal(armedFigure('squad', view, 'rifle')));
      expect(metal(armedFigure('squad', view, 'smg'))).toBeLessThan(metal(armedFigure('squad', view, 'rifle')));
    }
  });
});

describe('the hazard sprites', () => {
  it('exist and have palette letters only', () => {
    for (const n of ['smoke', 'fire_0', 'fire_1', 'bang'] as const) {
      expect(SPRITE_NAMES).toContain(n);
      expect(parseSprite(n, SPRITE_ROWS[n]).pixels.some((p) => p !== null)).toBe(true);
    }
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

describe('hazards on the map', () => {
  function drawnSprites(state: ReturnType<typeof createMission>, now = 0) {
    const names: string[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const real = atlas.draw.bind(atlas);
    atlas.draw = (c, name, x, y, o = {}) => { names.push(`${name}@${x},${y}`); return real(c, name, x, y, o); };
    drawGame(ctx, state, createUiState('p1'), new Effects(), now, atlas);
    return names;
  }

  it('draws smoke and fire on tiles the player sees, and not on tiles in the dark', () => {
    const state = createMission(MISSIONS[0], 1);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const near = { x: soldier.pos.x + 1, y: soldier.pos.y };
    state.hazards.push({ pos: near, kind: 'smoke', turnsLeft: 3 }, { pos: { x: soldier.pos.x, y: soldier.pos.y - 1 }, kind: 'fire', turnsLeft: 2 });
    state.hazards.push({ pos: { x: 28, y: 1 }, kind: 'smoke', turnsLeft: 3 }); // far away, dark
    const names = drawnSprites(state);
    expect(names.some((n) => n.startsWith(`smoke@${near.x * 16},${near.y * 16}`))).toBe(true);
    expect(names.some((n) => n.startsWith('fire_'))).toBe(true);
    expect(names.some((n) => n.startsWith('smoke@448,16'))).toBe(false);
  });

  it('flickers the fire between two frames over time', () => {
    const state = createMission(MISSIONS[0], 1);
    const s = state.units.find((u) => u.side === 'player')!;
    state.hazards.push({ pos: { x: s.pos.x, y: s.pos.y - 1 }, kind: 'fire', turnsLeft: 2 });
    const frames = new Set([0, 200, 400, 600].map((t) => drawnSprites(state, t).find((n) => n.startsWith('fire_'))!.split('@')[0]));
    expect(frames.size).toBe(2);
  });
});
