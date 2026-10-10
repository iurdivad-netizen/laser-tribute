import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

/** Every tile image drawn, in order, with its tile coordinates. */
function drawn(state: GameState): { name: string; x: number; y: number }[] {
  const out: { name: string; x: number; y: number }[] = [];
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.drawImage.bind(atlas);
  atlas.drawImage = (c, fig, x, y, o = {}) => {
    if (/^(floor|wall|prop)/.test(fig.name)) out.push({ name: fig.name, x: x / 16, y: y / 16 });
    return real(c, fig, x, y, o);
  };
  drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
  return out;
}

function withProp(): { state: GameState; at: { x: number; y: number } } {
  const state = createMission(MISSIONS[0], 1);
  state.explored = state.explored.map((r) => r.map(() => true));
  const at = { x: 0, y: 0 };
  outer: for (let y = 2; y < state.height - 2; y++) {
    for (let x = 2; x < state.width - 2; x++) {
      if (state.tiles[y][x].kind === 'floor') { state.tiles[y][x] = { kind: 'wall', open: false, low: true, prop: 1 }; at.x = x; at.y = y; break outer; }
    }
  }
  return { state, at };
}

describe('drawing a prop', () => {
  it('draws the floor and then the prop of the theme on an explored prop tile', () => {
    const { state, at } = withProp();
    const here = drawn(state).filter((d) => d.x === at.x && d.y === at.y);
    expect(here.map((d) => d.name)).toEqual([expect.stringMatching(/^floor_[abc]$/), 'prop_oil_drum']);
  });

  it('uses the theme of the mission for the prop', () => {
    const { state, at } = withProp();
    state.theme = 'timber';
    const here = drawn(state).filter((d) => d.x === at.x && d.y === at.y);
    expect(here[here.length - 1].name).toBe('prop_barrel');
  });

  it('draws nothing on an unexplored prop tile', () => {
    const { state, at } = withProp();
    state.explored[at.y][at.x] = false;
    expect(drawn(state).filter((d) => d.x === at.x && d.y === at.y)).toEqual([]);
  });

  it('draws a plain wall as before (an autotiled wall image, no prop)', () => {
    const { state } = withProp();
    const names = drawn(state).map((d) => d.name);
    expect(names.some((n) => /^wall(#\d+)?$/.test(n))).toBe(true);
    expect(names.filter((n) => n.startsWith('prop_'))).toHaveLength(1);
  });
});
