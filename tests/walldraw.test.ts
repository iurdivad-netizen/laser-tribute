import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { wallMask } from '../src/render/wallmask';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

/** The image name drawn at each tile, by 'x,y' (tiles are 16 px). */
function drawn(state: GameState): Map<string, string> {
  const at = new Map<string, string>();
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.drawImage.bind(atlas);
  atlas.drawImage = (c, fig, x, y, o = {}) => {
    if (fig.name.startsWith('wall') || fig.name.startsWith('floor')) at.set(`${x / 16},${y / 16}`, fig.name);
    return real(c, fig, x, y, o);
  };
  drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
  return at;
}

/** A wall tile with an open floor tile to its east, and that floor tile. */
function wallBesideFloor(state: GameState): { wall: { x: number; y: number }; floor: { x: number; y: number } } {
  for (let y = 1; y < state.height - 1; y++) {
    for (let x = 0; x < state.width - 1; x++) {
      if (state.tiles[y][x].kind === 'wall' && state.tiles[y][x + 1].kind === 'floor') return { wall: { x, y }, floor: { x: x + 1, y } };
    }
  }
  throw new Error('no wall beside a floor');
}

describe('walls are drawn with their edges', () => {
  it('draws an edged variant for an explored wall beside explored floor', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const { wall } = wallBesideFloor(state);
    const mask = wallMask(state, wall.x, wall.y);
    expect(mask).not.toBe(0);
    expect(drawn(state).get(`${wall.x},${wall.y}`)).toBe(`wall#${mask}`);
  });

  it('draws the plain wall when the floor beside it is not explored (nothing about unseen tiles shows)', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const { wall, floor } = wallBesideFloor(state);
    const plainBefore = wallMask(state, wall.x, wall.y);
    state.explored[floor.y][floor.x] = false;
    const maskNow = wallMask(state, wall.x, wall.y);
    expect(maskNow & 2).toBe(0); // the east side no longer counts
    expect(maskNow).not.toBe(plainBefore);
    const name = drawn(state).get(`${wall.x},${wall.y}`);
    expect(name).toBe(maskNow === 0 ? 'wall' : `wall#${maskNow}`);
  });

  it('draws floors, doors and units as before', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const names = [...drawn(state).values()];
    expect(names.some((n) => /^floor_[abc]$/.test(n))).toBe(true);
    expect(names.filter((n) => n.startsWith('floor')).every((n) => !n.includes('#'))).toBe(true);
  });

  it('shows the edge the frame after the neighbour is explored', () => {
    const state = createMission(MISSIONS[0], 1);
    state.explored = state.explored.map((r) => r.map(() => true));
    const { wall, floor } = wallBesideFloor(state);
    state.explored[floor.y][floor.x] = false;
    const before = drawn(state).get(`${wall.x},${wall.y}`);
    state.explored[floor.y][floor.x] = true;
    const after = drawn(state).get(`${wall.x},${wall.y}`);
    expect(after).not.toBe(before);
  });
});
