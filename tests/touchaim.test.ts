import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../src/controller';
import { WEAPONS } from '../src/core/config';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { DEFAULT_LAYOUT, drawPanel } from '../src/render/panel';
import { computeLayout } from '../src/ui/layout';
import { onText } from '../src/ui/text';
import { makeState, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

const MAP = ['###########', '#PP.......#', '#.........#', '#.....E.E.#', '###########'];

function setup() {
  const state = makeState(MAP);
  const p = unit(state, 'p1');
  p.facing = 2;
  p.ammo = WEAPONS[p.weapon].magazine;
  const c = new Controller(state, createUiState('p1'), new Effects());
  return { c, p, e1: unit(state, 'e1'), e2: unit(state, 'e2') };
}

const ammoOf = (c: Controller) => c.state.units.find((u) => u.id === 'p1')!.ammo;

describe('two-tap aiming on touch', () => {
  it('a first tap on an enemy only aims, a second tap on the same enemy fires', () => {
    const { c, p, e1 } = setup();
    c.pressButton('snap');
    const full = ammoOf(c);
    c.clickTile(e1.pos, true);
    expect(ammoOf(c)).toBe(full);
    expect(c.ui.mode).toBe('snap');
    expect(c.ui.pendingTile).toEqual(e1.pos);
    expect(c.ui.hover).toEqual(e1.pos);
    c.clickTile(e1.pos, true);
    expect(ammoOf(c)).toBe(full - 1);
    expect(c.ui.mode).toBe('move');
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.hover).toBeNull();
    void p;
  });

  it('a tap on another enemy moves the aim instead of firing', () => {
    const { c, e1, e2 } = setup();
    c.pressButton('aimed');
    const full = ammoOf(c);
    c.clickTile(e1.pos, true);
    c.clickTile(e2.pos, true);
    expect(ammoOf(c)).toBe(full);
    expect(c.ui.pendingTile).toEqual(e2.pos);
    c.clickTile(e2.pos, true);
    expect(ammoOf(c)).toBe(full - 1);
  });

  it('refuses a first tap on an empty tile and keeps the mode', () => {
    const { c } = setup();
    c.pressButton('snap');
    c.clickTile({ x: 3, y: 1 }, true);
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.mode).toBe('snap');
    expect(c.ui.message).toMatch(/enemy/i);
  });

  it('a mouse click still fires at once', () => {
    const { c, e1 } = setup();
    c.pressButton('snap');
    const full = ammoOf(c);
    c.clickTile(e1.pos, false);
    expect(ammoOf(c)).toBe(full - 1);
  });

  it('shows the odds with TAP AGAIN in the status line after the first tap', () => {
    const { c, e1 } = setup();
    c.pressButton('snap');
    c.clickTile(e1.pos, true);
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawPanel(ctx, c.state, c.ui, performance.now(), DEFAULT_LAYOUT);
    stop();
    expect(texts.some((t) => t.includes(' HIT ') && t.includes('TAP'))).toBe(true);
  });

  it('cancel, another mode and another soldier all drop the aim', () => {
    const { c, e1 } = setup();
    c.pressButton('snap');
    c.clickTile(e1.pos, true);
    c.cancel();
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.hover).toBeNull();
    c.pressButton('snap');
    c.clickTile(e1.pos, true);
    c.pressButton('aimed');
    expect(c.ui.pendingTile).toBeNull();
    c.clickTile(e1.pos, true);
    expect(c.ui.pendingTile).toEqual(e1.pos);
    c.select('p2');
    expect(c.ui.pendingTile).toBeNull();
  });
});

describe('two-tap throwing on touch', () => {
  it('a first tap on a reachable tile aims and shows the blast, a second tap throws', () => {
    const { c } = setup();
    const grenades = unit(c.state, 'p1').grenades;
    c.pressButton('throw');
    c.clickTile({ x: 5, y: 2 }, true);
    expect(unit(c.state, 'p1').grenades).toBe(grenades);
    expect(c.ui.pendingTile).toEqual({ x: 5, y: 2 });
    expect(c.ui.hover).toEqual({ x: 5, y: 2 });
    expect(c.ui.message).toMatch(/again/i);
    c.clickTile({ x: 5, y: 2 }, true);
    expect(unit(c.state, 'p1').grenades).toBe(grenades - 1);
    expect(c.ui.mode).toBe('move');
    expect(c.ui.pendingTile).toBeNull();
  });

  it('refuses a first tap on a tile out of reach, without aiming', () => {
    const { c } = setup();
    c.pressButton('throw');
    c.clickTile({ x: 10, y: 1 }, true); // the wall at the end of the row: not a tile he can throw at
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.message).toMatch(/reach/i);
    expect(c.ui.mode).toBe('throw');
  });
});

describe('the other modes stay one tap', () => {
  it('a door tap on touch acts at once', () => {
    const state = makeState(['#####', '#P+.#', '#####']);
    const c = new Controller(state, createUiState('p1'), new Effects());
    c.pressButton('door');
    c.clickTile({ x: 2, y: 1 }, true);
    expect(c.state.tiles[1][2].open).toBe(true);
  });
});

describe('review fixes', () => {
  it('puts TAP AGAIN first so it survives the clipping on a portrait phone', () => {
    const { c, e1 } = setup();
    c.pressButton('snap');
    c.clickTile(e1.pos, true);
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawPanel(ctx, c.state, c.ui, performance.now(), computeLayout(390, 844, 3));
    stop();
    const status = texts.find((t) => t.includes('HIT') || t.includes('TAP'))!;
    expect(status.startsWith('TAP AGAIN')).toBe(true);
  });

  it('refuses a first tap on an enemy the shooter cannot see, or cannot reach', () => {
    const { c, p, e1 } = setup();
    p.facing = 6; // looking away, while his neighbour p2 still sees the enemy
    unit(c.state, 'p2').facing = 2;
    c.pressButton('snap');
    c.clickTile(e1.pos, true);
    expect(c.ui.pendingTile).toBeNull();
    expect(c.ui.message).toMatch(/visible/i);
    const far = makeState(['############', '#P........E#', '############']);
    const shooter = unit(far, 'p1');
    shooter.weapon = 'pistol';
    shooter.facing = 2;
    const c2 = new Controller(far, createUiState('p1'), new Effects());
    c2.pressButton('snap');
    c2.clickTile(unit(far, 'e1').pos, true);
    expect(c2.ui.pendingTile).toBeNull();
    expect(c2.ui.message).toMatch(/range/i);
  });

  it('Shift+Tab with nobody selected selects the last living soldier', () => {
    const { c } = setup();
    c.ui.selectedId = null;
    c.cycle(-1);
    expect(c.ui.selectedId).toBe('p2');
  });
});
