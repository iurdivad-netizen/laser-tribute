import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { FIGURE_W, RISE, figureMask, unitFigure } from '../src/art/figure';
import { createMission } from '../src/core/missions';
import type { Unit } from '../src/core/types';
import { tileToScreen } from '../src/render/camera';

const START = { x: 240, y: 345 };

function inMission() {
  let t = 0;
  const app = new App({
    clock: () => t,
    skipTitle: true,
    store: null,
    createMission: (def, seed, roster, loadout, budget, stash) => createMission(def, seed, roster, loadout, budget, stash),
  });
  app.click(START);
  t += 500;
  return { app, wait: () => { t += 500; } };
}

/** The screen point of an opaque pixel of the unit's figure that lies in the part above his feet tile. */
function headPoint(app: App, u: Unit) {
  const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
  const mask = figureMask(figure, flip);
  let i = 0;
  while (mask[i] === 0) i++;
  const lx = i % FIGURE_W;
  const ly = Math.floor(i / FIGURE_W);
  expect(ly).toBeLessThan(RISE);
  const c = app.controller!;
  const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, u.pos);
  const k = s.tile / 16;
  return { x: s.x + (lx + 0.5) * k, y: s.y + (ly - RISE + 0.5) * k };
}

describe('clicking and hovering a figure', () => {
  it('selects a soldier when his head is clicked, though the head is over the tile above', () => {
    const { app, wait } = inMission();
    const c = app.controller!;
    expect(c.ui.selectedId).toBe('p1');
    const p2 = c.state.units.find((u) => u.id === 'p2')!;
    const pt = headPoint(app, p2);
    wait();
    app.click(pt);
    expect(c.ui.selectedId).toBe('p2');
  });

  it('hovers the feet tile when the pointer is over the head', () => {
    const { app } = inMission();
    const c = app.controller!;
    const p2 = c.state.units.find((u) => u.id === 'p2')!;
    app.move(headPoint(app, p2));
    expect(c.ui.hover).toEqual(p2.pos);
  });

  it('still uses the tile under the pointer when no figure is hit', () => {
    const { app, wait } = inMission();
    const c = app.controller!;
    const p1 = c.state.units.find((u) => u.id === 'p1')!;
    const target = { x: p1.pos.x + 4, y: p1.pos.y - 4 }; // an empty floor tile, well clear of every figure
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, target);
    wait();
    app.move({ x: s.x + s.tile / 2, y: s.y + s.tile - 2 });
    expect(c.ui.hover).toEqual(target);
  });

  it('a first touch tap on a figure of another soldier selects him; it does not start a move preview', () => {
    const { app, wait } = inMission();
    const c = app.controller!;
    const p2 = c.state.units.find((u) => u.id === 'p2')!;
    wait();
    app.click(headPoint(app, p2), 'touch');
    expect(c.ui.selectedId).toBe('p2');
    expect(c.ui.pendingTile).toBeNull();
  });
});
