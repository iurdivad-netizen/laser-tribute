import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../src/controller';
import { createMission1 } from '../src/core/mission1';
import { Effects } from '../src/render/effects';
import { createUiState } from '../src/input/uiState';
import { corridorRows, makeState } from './helpers';

function setup() {
  return new Controller(createMission1(), createUiState('p1'), new Effects());
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Controller', () => {
  it('selects soldiers with the number keys', () => {
    const c = setup();
    expect(c.key('2')).toBe(true);
    expect(c.ui.selectedId).toBe('p2');
  });

  it('arms and cancels the snap-shot mode', () => {
    const c = setup();
    c.pressButton('snap');
    expect(c.ui.mode).toBe('snap');
    c.key('Escape');
    expect(c.ui.mode).toBe('move');
  });

  it('moves the selected soldier along a path, one step at a time', () => {
    const c = setup();
    const start = { ...c.selected()!.pos };
    c.clickTile({ x: start.x, y: start.y - 2 });
    vi.advanceTimersByTime(1000);
    expect(c.selected()!.pos).toEqual({ x: start.x, y: start.y - 2 });
    expect(c.ui.busy).toBe(false);
  });

  it('refuses a move that costs more than the soldier has', () => {
    const c = setup();
    c.clickTile({ x: 28, y: 8 }); // across the hall: 9 diagonals + 17 straight steps = 122 AP
    expect(c.selected()!.pos).toEqual({ x: 2, y: 17 });
    expect(c.ui.message).toMatch(/Need/);
  });

  it('runs the enemy turn to completion and returns control to the player', () => {
    const c = setup();
    c.endTurn();
    expect(c.state.turn).toBe('enemy');
    vi.advanceTimersByTime(120000);
    expect(c.state.turn).toBe('player');
    expect(c.ui.busy).toBe(false);
  });

  it('turns the selected soldier with Q and E', () => {
    const c = setup();
    c.key('e');
    expect(c.selected()!.facing).toBe(1);
    c.key('q');
    c.key('q');
    expect(c.selected()!.facing).toBe(7);
  });

  it('previews a path over a tile hiding an unseen enemy just like any other fog tile', () => {
    const c = setup();
    c.hover({ x: 24, y: 15 }); // e4 stands here, out of sight
    expect(c.ui.preview.length).toBeGreaterThan(0);
  });

  it('plays an enemy turn quickly when most of it happens out of sight', () => {
    const c = setup();
    c.endTurn();
    vi.advanceTimersByTime(8000);
    expect(c.state.turn).toBe('player');
  });

  it('stops a multi-step move when a new enemy comes into view', () => {
    const s = makeState(corridorRows('P......E'));
    s.units.find((u) => u.id === 'p1')!.facing = 6; // facing away, e1 unseen
    const c = new Controller(s, createUiState('p1'), new Effects());
    c.clickTile({ x: 5, y: 1 });
    vi.advanceTimersByTime(1000);
    expect(c.selected()!.pos).toEqual({ x: 2, y: 1 });
    expect(c.ui.busy).toBe(false);
  });

  it('toggles alert on the selected soldier with L and the Alert button', () => {
    const c = setup();
    c.key('l');
    expect(c.selected()!.alert).toBe(true);
    expect(c.ui.message).toMatch(/alert/i);
    c.key('L');
    expect(c.selected()!.alert).toBe(false);
    c.pressButton('alert');
    expect(c.selected()!.alert).toBe(true);
  });
});
