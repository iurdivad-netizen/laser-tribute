import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { FIGURE_W, RISE, figureMask, unitFigure } from '../src/art/figure';
import { createMission } from '../src/core/missions';
import type { Unit } from '../src/core/types';
import { setZoom, tileToScreen } from '../src/render/camera';

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

/** A mission with the whole map in view and a clear stretch of floor around (10, 16). */
function scene() {
  const { app, wait } = inMission();
  const c = app.controller!;
  app.camera = setZoom(app.camera, 'whole', app.layout, c.state.width, c.state.height);
  const unit = (id: string) => c.state.units.find((u) => u.id === id)!;
  const place = (id: string, x: number, y: number) => { unit(id).pos = { x, y }; };
  const centre = (x: number, y: number) => {
    const s = tileToScreen(app.camera, app.layout, c.state.width, c.state.height, { x, y });
    return { x: s.x + s.tile / 2, y: s.y + s.tile / 2 };
  };
  wait();
  return { app, c, unit, place, centre, wait };
}

describe('a figure never takes a click that belongs to the tile under it', () => {
  it('heal: clicking the wounded soldier standing north of the medic heals him, not the medic', () => {
    const { app, c, unit, place, centre } = scene();
    place('p1', 10, 17);
    place('p2', 10, 16);
    unit('p1').gadget = 'medkit';
    unit('p2').hp = unit('p2').maxHp - 30;
    const hurt = unit('p2').hp;
    const medic = unit('p1').hp;
    c.select('p1');
    c.ui.mode = 'heal';
    app.click(centre(10, 16));
    expect(unit('p2').hp).toBeGreaterThan(hurt);
    expect(unit('p1').hp).toBe(medic);
  });

  it('door: clicking the door north of a soldier opens it', () => {
    const { app, c, unit, place, centre } = scene();
    place('p1', 10, 17);
    c.state.tiles[16][10] = { kind: 'door', open: false };
    c.select('p1');
    c.ui.mode = 'door';
    app.click(centre(10, 16));
    expect(c.state.tiles[16][10].open).toBe(true);
    expect(unit('p1').ap).toBeLessThan(60);
  });

  it('turn: clicking the tile north of the soldier turns him that way', () => {
    const { app, c, unit, place, centre } = scene();
    place('p1', 10, 17);
    unit('p1').facing = 2;
    c.select('p1');
    c.ui.mode = 'turn';
    app.click(centre(10, 16));
    expect(unit('p1').facing).toBe(0);
  });

  it('stab: an enemy standing directly north of the soldier can be stabbed by clicking its tile', () => {
    const { app, c, unit, place, centre } = scene();
    place('p1', 10, 17);
    place('e1', 10, 16);
    c.select('p1');
    c.ui.mode = 'stab';
    app.click(centre(10, 16));
    expect(unit('p1').ap).toBe(60 - 20);
  });

  it('snap: clicking an enemy tile shoots it even when a friend stands in front of the enemy', () => {
    const { app, c, unit, place, centre } = scene();
    place('p1', 7, 16);
    unit('p1').facing = 2;
    place('e1', 10, 16);
    place('p2', 10, 17); // his figure covers the enemy's tile
    c.select('p1');
    c.ui.mode = 'snap';
    app.click(centre(10, 16));
    expect(unit('p1').ap).toBe(60 - 15);
    expect(c.ui.selectedId).toBe('p1');
  });

  it('snap: the head of an enemy over the tile above still counts as the enemy', () => {
    const { app, c, unit, place } = scene();
    place('p1', 7, 16);
    unit('p1').facing = 2;
    place('e1', 10, 16);
    c.select('p1');
    c.ui.mode = 'snap';
    app.click(headPoint(app, unit('e1')));
    expect(unit('p1').ap).toBe(60 - 15);
  });

  it('move: the tile north of an enemy can be hovered and clicked, though his head covers it', () => {
    const { app, c, place, centre } = scene();
    place('e1', 10, 16);
    app.move(centre(10, 15));
    expect(c.ui.hover).toEqual({ x: 10, y: 15 });
  });

  it('throw: the tile north of a friend is the target, not the friend', () => {
    const { app, c, place, centre } = scene();
    place('p2', 10, 17);
    c.select('p1');
    c.ui.mode = 'throw';
    app.move(centre(10, 16));
    expect(c.ui.hover).toEqual({ x: 10, y: 16 });
  });
});
