import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, type AppOptions } from '../src/app';
import type { SoundPlayer } from '../src/audio/sound';
import type { GameState } from '../src/core/types';
import { originOf, tileToScreen } from '../src/render/camera';
import { makeState, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

const START = { x: 240, y: 345 }; // the Start mission button in menu coordinates

/** A 30x20 open map with the four soldiers in the middle and one enemy far in a corner. */
function bigMap(): GameState {
  const rows = Array.from({ length: 20 }, (_, y) => (y === 0 || y === 19 ? '#'.repeat(30) : '#' + '.'.repeat(28) + '#'));
  const put = (x: number, y: number, ch: string) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  [13, 14, 15, 16].forEach((x) => put(x, 10, 'P'));
  put(2, 2, 'E');
  return makeState(rows);
}

function fakeSound(): SoundPlayer & { muted: boolean } {
  return {
    muted: false,
    volume: 0.5,
    play: () => undefined,
    unlock: () => undefined,
    toggleMute() { this.muted = !this.muted; return this.muted ? 'MUTED' : 'SOUND ON'; },
    changeVolume: () => 'VOLUME',
  };
}

function make(opts: AppOptions = {}) {
  let t = 0;
  const app = new App({ clock: () => t, sound: fakeSound(), store: null, createMission: () => bigMap(), ...opts });
  return { app, wait: () => { t += 500; } };
}

const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

function inMission(width: number, height: number, dpr: number) {
  const m = make({ width, height, dpr });
  m.app.click(m.app.menuTransform().scale === 1 && m.app.menuTransform().x === 0
    ? START
    : { x: m.app.menuTransform().x + START.x * m.app.menuTransform().scale, y: m.app.menuTransform().y + START.y * m.app.menuTransform().scale });
  expect(m.app.screen).toBe('mission');
  m.wait();
  return m;
}

describe('the menus are drawn and clicked through a contain transform', () => {
  it('at 480x400 it is the identity, so menu coordinates are pointer coordinates', () => {
    const { app } = make();
    expect(app.menuTransform()).toEqual({ scale: 1, x: 0, y: 0 });
    app.click(START);
    expect(app.screen).toBe('mission');
  });

  it('on a wider window it scales to fit and centres, and clicks are mapped back', () => {
    const { app } = make({ width: 844, height: 390, dpr: 3 });
    const m = app.menuTransform();
    expect(m.scale).toBeCloseTo(Math.min(844 / 480, 390 / 400), 6);
    expect(m.x).toBeCloseTo((844 - 480 * m.scale) / 2, 6);
    app.click(START); // the unscaled coordinates miss the button on this window
    expect(app.screen).toBe('equipment');
    app.click({ x: m.x + START.x * m.scale, y: m.y + START.y * m.scale });
    expect(app.screen).toBe('mission');
  });
});

describe('resizing a mission', () => {
  it('recomputes the layout for the new orientation and recentres the camera on the selected soldier', () => {
    const { app } = inMission(390, 844, 3);
    expect(app.layout.orientation).toBe('portrait');
    app.resize(844, 390, 3);
    expect(app.layout.orientation).toBe('landscape');
    const c = app.controller!;
    const p1 = c.selected()!;
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, p1.pos);
    const mid = centre(app.layout.map);
    expect(Math.abs(s.x + s.tile / 2 - mid.x)).toBeLessThan(s.tile);
    expect(Math.abs(s.y + s.tile / 2 - mid.y)).toBeLessThan(s.tile);
  });

  it('clears a mode and a pending preview', () => {
    const { app } = inMission(390, 844, 3);
    app.controller!.pressButton('snap');
    app.resize(844, 390, 3);
    expect(app.controller!.ui.mode).toBe('move');
  });
});

describe('degenerate window sizes', () => {
  it('ignores a resize to a tiny or zero size (a hidden or not yet laid-out canvas) and keeps the last good layout', () => {
    const { app } = inMission(390, 844, 3);
    const before = app.layout;
    for (const [w, h] of [[0, 0], [1, 1], [60, 900], [900, 60]]) app.resize(w, h, 3);
    expect(app.layout).toBe(before);
    expect(() => app.draw(ctx, 0)).not.toThrow();
  });
});

describe('camera: follow, pan, zoom, squad', () => {
  it('a drag pans the camera and turns following off; the next selection or move follows again', () => {
    const { app } = inMission(390, 844, 3);
    const c = app.controller!;
    const before = originOf(app.camera, app.layout, c.state.width, c.state.height);
    app.pan(20, 0);
    const after = originOf(app.camera, app.layout, c.state.width, c.state.height);
    expect(after.x - before.x).toBeCloseTo(20, 3);
    expect(app.camera.follow).toBe(false);
    app.update(0);
    expect(app.camera.follow).toBe(false); // nothing changed, so it stays where the player put it
    c.run({ type: 'Move', unitId: 'p1', to: { x: 12, y: 10 } });
    app.update(1);
    expect(app.camera.follow).toBe(true);
  });

  it('the squad strip selects a soldier and centres the camera on him', () => {
    const { app } = inMission(390, 844, 3);
    const c = app.controller!;
    const r = centre(app.layout.squad[2]);
    app.click(r);
    expect(c.ui.selectedId).toBe('p3');
    expect(app.camera.follow).toBe(true);
    const p3 = c.selected()!;
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, p3.pos);
    const mid = centre(app.layout.map);
    expect(Math.abs(s.x + s.tile / 2 - mid.x)).toBeLessThan(s.tile);
  });

  it('the ZOOM button toggles close and whole', () => {
    const { app } = inMission(390, 844, 3);
    const zoom = app.layout.actions.find((a) => a.id === 'zoom')!;
    const start = app.camera.zoom;
    app.click(centre(zoom.rect));
    expect(app.camera.zoom).not.toBe(start);
    app.click(centre(zoom.rect));
    expect(app.camera.zoom).toBe(start);
  });

  it('zooming in from the whole map centres the camera on the selected soldier, even after a pan', () => {
    const { app } = inMission(390, 844, 3);
    const c = app.controller!;
    const zoom = app.layout.actions.find((a) => a.id === 'zoom')!;
    app.click(centre(zoom.rect)); // whole
    app.pan(40, 40);
    app.click(centre(zoom.rect)); // close again
    expect(app.camera.zoom).toBe('close');
    const p = c.selected()!;
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, p.pos);
    const mid = centre(app.layout.map);
    expect(Math.abs(s.x + s.tile / 2 - mid.x)).toBeLessThan(s.tile);
    expect(Math.abs(s.y + s.tile / 2 - mid.y)).toBeLessThan(s.tile);
  });

  it('the enemy turn follows a visible event that is off screen, and the player turn goes back to the soldier', () => {
    const { app } = inMission(390, 844, 3);
    const c = app.controller!;
    c.state.turn = 'enemy';
    c.lastEventAt = { x: 2, y: 2 };
    app.update(0);
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, { x: 2, y: 2 });
    const mid = centre(app.layout.map);
    expect(Math.abs(s.x + s.tile / 2 - mid.x)).toBeLessThan(app.layout.map.w / 2);
    c.state.turn = 'player';
    app.update(1);
    const p1 = c.selected()!;
    const back = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, p1.pos);
    expect(Math.abs(back.x + back.tile / 2 - mid.x)).toBeLessThan(back.tile);
  });
});

describe('modes, cancel, long press and buttons over the map', () => {
  it('the CANCEL button and a long press both leave a mode, without moving anyone', () => {
    const { app } = inMission(390, 844, 3);
    const c = app.controller!;
    const home = { ...c.selected()!.pos };
    c.pressButton('snap');
    app.click(centre(app.layout.cancel));
    expect(c.ui.mode).toBe('move');
    c.pressButton('snap');
    app.longPress(centre(app.layout.map));
    expect(c.ui.mode).toBe('move');
    expect(c.selected()!.pos).toEqual(home);
  });

  it('a tap on an action button never also hits the map tile under it', () => {
    const { app } = inMission(844, 390, 3); // landscape: the status and detail bars sit over the map
    const c = app.controller!;
    const home = { ...c.selected()!.pos };
    app.click(centre(app.layout.actions[0].rect)); // SNAP
    expect(c.ui.mode).toBe('snap');
    app.click(centre(app.layout.sound));
    expect(c.selected()!.pos).toEqual(home);
  });

  it('the SOUND button toggles mute', () => {
    const sound = fakeSound();
    const { app, wait } = make({ width: 390, height: 844, dpr: 3, sound });
    const m = app.menuTransform();
    app.click({ x: m.x + START.x * m.scale, y: m.y + START.y * m.scale });
    wait(); // the input lock after a screen switch
    expect(sound.muted).toBe(false);
    app.click(centre(app.layout.sound));
    expect(sound.muted).toBe(true);
  });
});

describe('touch taps preview first, mouse clicks move', () => {
  it('a touch tap previews, a second touch tap moves; a mouse click moves at once', () => {
    const touch = inMission(390, 844, 3);
    const c = touch.app.controller!;
    const target = { x: 13, y: 12 };
    const s = tileToScreen(touch.app.camera, touch.app.layout, c.state.width, c.state.height, target);
    const p = { x: s.x + s.tile / 2, y: s.y + s.tile / 2 };
    const home = { ...c.selected()!.pos };
    touch.app.click(p, 'touch');
    expect(c.ui.pendingTile).toEqual(target);
    expect(c.selected()!.pos).toEqual(home);
    touch.app.click(p, 'touch');
    vi.advanceTimersByTime(2000);
    expect(unit(c.state, 'p1').pos).toEqual(target);

    const mouse = inMission(390, 844, 3);
    const mc = mouse.app.controller!;
    const ms = tileToScreen(mouse.app.camera, mouse.app.layout, mc.state.width, mc.state.height, target);
    mouse.app.click({ x: ms.x + ms.tile / 2, y: ms.y + ms.tile / 2 });
    vi.advanceTimersByTime(2000);
    expect(unit(mc.state, 'p1').pos).toEqual(target);
  });
});

describe('drawing at phone and desktop sizes', () => {
  it.each([[390, 844, 3], [844, 390, 3], [1366, 768, 1], [480, 400, 1]])('draws every screen at %i x %i', (w, h, dpr) => {
    const { app } = make({ width: w, height: h, dpr });
    expect(() => app.draw(ctx, 0)).not.toThrow(); // equipment
    app.screen = 'title';
    expect(() => app.draw(ctx, 0)).not.toThrow();
    app.screen = 'end';
    expect(() => app.draw(ctx, 0)).not.toThrow();
    app.screen = 'equipment';
    const m = app.menuTransform();
    app.click({ x: m.x + START.x * m.scale, y: m.y + START.y * m.scale });
    expect(app.screen).toBe('mission');
    expect(() => app.draw(ctx, 0)).not.toThrow();
  });
});
