import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { applyCommand } from '../src/core/apply';
import { findPath } from '../src/core/path';
import { updateExplored } from '../src/core/vision';
import { Controller } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { corridorRows, makeState, ok, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

/** p1 looks west at x1; the door at x6 is behind him, out of sight; e1 stands at x7 next to it. */
function behindTheSquad() {
  const s = makeState(corridorRows('P....+E...'));
  unit(s, 'p1').facing = 6;
  return s;
}

const enemyOpensDoor = (s: ReturnType<typeof makeState>) => {
  s.turn = 'enemy';
  return ok(applyCommand(s, { type: 'OpenDoor', unitId: 'e1', at: { x: 6, y: 1 } })).state;
};

describe('the player remembers doors as last seen', () => {
  it('starts with every door remembered as closed', () => {
    const s = makeState(corridorRows('P..+..E'));
    expect(s.doorMemory.flat().every((open) => open === false)).toBe(true);
  });

  it('records the state of a door the player can see', () => {
    const s = makeState(corridorRows('P..+..E'));
    unit(s, 'p1').facing = 2;
    s.tiles[1][4].open = true;
    updateExplored(s);
    expect(s.doorMemory[1][4]).toBe(true);
  });

  it('a door an enemy opens out of sight stays remembered as closed, and updates when it is seen', () => {
    const opened = enemyOpensDoor(behindTheSquad());
    expect(opened.tiles[1][6].open).toBe(true); // really open, and it stays open
    expect(opened.doorMemory[1][6]).toBe(false); // but the player has not seen it

    opened.turn = 'player';
    const looking = ok(applyCommand(opened, { type: 'Turn', unitId: 'p1', facing: 2 })).state;
    expect(looking.doorMemory[1][6]).toBe(true); // seen now

    const away = ok(applyCommand(looking, { type: 'Turn', unitId: 'p1', facing: 6 })).state;
    expect(away.doorMemory[1][6]).toBe(true); // remembered as open after looking away
    expect(away.tiles[1][6].open).toBe(true);
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

describe('drawing a remembered door', () => {
  it('shows the door as last seen, not as it really is', () => {
    const drawn: { name: string; x: number; y: number }[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const real = atlas.drawImage.bind(atlas);
    atlas.drawImage = (ctx, fig, x, y, opts = {}) => {
      drawn.push({ name: fig.name, x, y });
      return real(ctx, fig, x, y, opts);
    };
    const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;
    const state = enemyOpensDoor(behindTheSquad());
    state.explored[1][6] = true; // seen once, closed
    const door = () => drawn.filter((d) => d.x === 6 * 16 && d.y === 1 * 16).map((d) => d.name);

    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(door()).toContain('door_closed');
    expect(door()).not.toContain('door_open');

    drawn.length = 0;
    state.doorMemory[1][6] = true;
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(door()).toContain('door_open');
  });
});

describe('route planning from memory', () => {
  it('does not route through a door the player remembers closed, even if it is really open', () => {
    const opened = enemyOpensDoor(behindTheSquad());
    expect(findPath(opened, 'p1', { x: 9, y: 1 }, { seenBy: 'player', doorView: opened.doorMemory })).toBeNull();
    opened.doorMemory[1][6] = true;
    expect(findPath(opened, 'p1', { x: 5, y: 1 }, { seenBy: 'player', doorView: opened.doorMemory })).not.toBeNull();
  });

  it('the controller says No path for a remembered-closed door instead of revealing the open one', () => {
    const state = enemyOpensDoor(behindTheSquad());
    state.turn = 'player';
    state.explored[1][8] = true;
    const c = new Controller(state, createUiState('p1'), new Effects());
    c.clickTile({ x: 9, y: 1 });
    expect(c.ui.message).toMatch(/no path/i);
  });
});
