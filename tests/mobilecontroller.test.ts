import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, faceToward } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { makeState, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

/** A 7x7 open room with p1 in the middle (4,4), facing north, and e1 in a far corner. */
function room() {
  const rows = ['#########', ...Array.from({ length: 7 }, () => '#.......#'), '#########'];
  rows[4] = '#...P...#';
  rows[7] = '#E......#'; // out of sight of a soldier walking east or facing north
  const state = makeState(rows);
  unit(state, 'p1').facing = 0;
  return { state, c: new Controller(state, createUiState('p1'), new Effects()) };
}

describe('faceToward', () => {
  it('gives the eight facings from a tile to another', () => {
    const o = { x: 4, y: 4 };
    expect(faceToward(o, { x: 4, y: 1 })).toBe(0);
    expect(faceToward(o, { x: 7, y: 1 })).toBe(1);
    expect(faceToward(o, { x: 7, y: 4 })).toBe(2);
    expect(faceToward(o, { x: 7, y: 7 })).toBe(3);
    expect(faceToward(o, { x: 4, y: 7 })).toBe(4);
    expect(faceToward(o, { x: 1, y: 7 })).toBe(5);
    expect(faceToward(o, { x: 1, y: 4 })).toBe(6);
    expect(faceToward(o, { x: 1, y: 1 })).toBe(7);
  });

  it('uses the nearest of the eight directions for in-between angles, and null for the same tile', () => {
    const o = { x: 4, y: 4 };
    expect(faceToward(o, { x: 8, y: 3 })).toBe(2); // mostly east
    expect(faceToward(o, { x: 5, y: 0 })).toBe(0); // mostly north
    expect(faceToward(o, o)).toBeNull();
  });
});

describe('TURN mode', () => {
  it('the TURN button enters the mode and F does too, with a hint', () => {
    const { c } = room();
    c.pressButton('turn');
    expect(c.ui.mode).toBe('turn');
    expect(c.ui.message).toMatch(/turn/i);
    c.cancel();
    c.key('f');
    expect(c.ui.mode).toBe('turn');
  });

  it('tapping a tile turns the soldier to face it for 1 AP per 45 degrees, and leaves the mode', () => {
    const { c } = room();
    c.pressButton('turn');
    c.clickTile({ x: 7, y: 4 }); // east: two 45-degree steps from north
    const p = unit(c.state, 'p1');
    expect(p.facing).toBe(2);
    expect(p.ap).toBe(60 - 2);
    expect(c.ui.mode).toBe('move');
  });

  it('turns the short way round (west from north is two steps, not six)', () => {
    const { c } = room();
    c.pressButton('turn');
    c.clickTile({ x: 1, y: 4 });
    expect(unit(c.state, 'p1').facing).toBe(6);
    expect(unit(c.state, 'p1').ap).toBe(60 - 2);
  });

  it('does nothing and costs nothing when already facing that way, or when the own tile is tapped', () => {
    const { c } = room();
    c.pressButton('turn');
    c.clickTile({ x: 4, y: 1 });
    expect(unit(c.state, 'p1').ap).toBe(60);
    expect(c.ui.mode).toBe('move');
    c.pressButton('turn');
    c.clickTile({ x: 4, y: 4 });
    expect(unit(c.state, 'p1').facing).toBe(0);
    expect(unit(c.state, 'p1').ap).toBe(60);
    expect(c.ui.mode).toBe('move');
  });

  it('refuses with too little AP and leaves the facing alone', () => {
    const { c } = room();
    unit(c.state, 'p1').ap = 1;
    c.pressButton('turn');
    c.clickTile({ x: 4, y: 7 }); // south: four steps
    expect(unit(c.state, 'p1').facing).toBe(0);
    expect(c.ui.message).toMatch(/action points/i);
  });
});

describe('the two-tap move preview for touch', () => {
  it('the first touch tap previews the path and cost, the second on the same tile moves', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    expect(c.ui.preview.length).toBeGreaterThan(0);
    expect(c.ui.previewCost).toBe(8);
    expect(c.ui.pendingTile).toEqual({ x: 6, y: 4 });
    expect(unit(c.state, 'p1').pos).toEqual({ x: 4, y: 4 });
    c.clickTile({ x: 6, y: 4 }, true);
    vi.advanceTimersByTime(1000);
    expect(unit(c.state, 'p1').pos).toEqual({ x: 6, y: 4 });
    expect(c.ui.pendingTile).toBeNull();
  });

  it('a tap on a different tile moves the preview instead of moving the soldier', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    c.clickTile({ x: 2, y: 4 }, true);
    expect(c.ui.pendingTile).toEqual({ x: 2, y: 4 });
    expect(unit(c.state, 'p1').pos).toEqual({ x: 4, y: 4 });
  });

  it('a mouse click still moves at once', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 });
    vi.advanceTimersByTime(1000);
    expect(unit(c.state, 'p1').pos).toEqual({ x: 6, y: 4 });
    expect(c.ui.pendingTile).toBeNull();
  });

  it('a touch tap on an unreachable tile says so and keeps nothing pending', () => {
    const { c } = room();
    c.clickTile({ x: 0, y: 0 }, true); // a wall
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.message).toMatch(/no path/i);
  });

  it('cancel, a mode change, a selection and the end of the turn clear the pending preview', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    c.cancel();
    expect(c.ui.pendingTile).toBeNull();
    c.clickTile({ x: 6, y: 4 }, true);
    c.pressButton('turn');
    expect(c.ui.pendingTile).toBeNull();
    c.cancel();
    c.clickTile({ x: 6, y: 4 }, true);
    c.select('p1');
    expect(c.ui.pendingTile).toBeNull();
    c.clickTile({ x: 6, y: 4 }, true);
    c.endTurn();
    expect(c.ui.pendingTile).toBeNull();
  });

  it('tapping a soldier selects at once and clears the pending preview', () => {
    const rows = ['#######', '#.....#', '#.PP..#', '#..E..#', '#######'];
    const state = makeState(rows);
    const c = new Controller(state, createUiState('p1'), new Effects());
    c.clickTile({ x: 5, y: 1 }, true);
    expect(c.ui.pendingTile).toEqual({ x: 5, y: 1 });
    c.clickTile({ x: 3, y: 2 }, true); // p2
    expect(c.ui.selectedId).toBe('p2');
    expect(c.ui.pendingTile).toBeNull();
  });
});

describe('cleanup after a touch preview', () => {
  it('a selection clears the preview of the old tile, so no stale Move line is shown', () => {
    const { c } = room();
    c.clickTile({ x: 6, y: 4 }, true);
    expect(c.ui.previewCost).toBe(8);
    c.select('p1');
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.hover).toBeNull();
    expect(c.ui.previewCost).toBeNull();
  });

  it('selecting from the squad strip leaves heal mode, like the number keys', () => {
    const rows = ['#######', '#.....#', '#.PP..#', '#..E..#', '#######'];
    const state = makeState(rows);
    unit(state, 'p1').gadget = 'medkit';
    const c = new Controller(state, createUiState('p1'), new Effects());
    c.pressButton('gadget');
    expect(c.ui.mode).toBe('heal');
    c.select('p2');
    expect(c.ui.mode).toBe('move');
  });
});
