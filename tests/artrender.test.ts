import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { RISE } from '../src/art/figure';
import { createMission, MISSIONS } from '../src/core/missions';
import { computeVisible } from '../src/core/vision';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

/** An atlas that records what it is asked to draw. */
function spyAtlas() {
  const drawn: { name: string; x: number; y: number; flip: boolean }[] = [];
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.draw.bind(atlas);
  atlas.draw = (ctx, name, x, y, opts = {}) => {
    drawn.push({ name, x, y, flip: !!opts.flip });
    return real(ctx, name, x, y, opts);
  };
  const realFigure = atlas.drawFigure.bind(atlas);
  atlas.drawFigure = (ctx, fig, x, y, opts = {}) => {
    drawn.push({ name: fig.name, x, y, flip: !!opts.flip });
    return realFigure(ctx, fig, x, y, opts);
  };
  return { atlas, drawn };
}

const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

const roster = [
  { name: 'A', kills: 9 }, { name: 'B', kills: 5 }, { name: 'C', kills: 2 }, { name: 'D', kills: 0 },
];

describe('drawGame with sprites', () => {
  it('draws explored tiles, units and items without throwing', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const { atlas, drawn } = spyAtlas();
    expect(() => drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas)).not.toThrow();
    const names = new Set(drawn.map((d) => d.name));
    expect(names.has('wall')).toBe(true);
    expect([...names].some((n) => n.startsWith('floor_'))).toBe(true);
    expect([...names].some((n) => n.startsWith('squad_'))).toBe(true);
  });

  it('draws a soldier sprite per living soldier, mirrored for facings 5 to 7', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldiers = state.units.filter((u) => u.side === 'player');
    soldiers[0].facing = 6; // west: the mirror of east
    soldiers[1].facing = 0;
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const units = drawn.filter((d) => d.name.startsWith('squad_'));
    expect(units).toHaveLength(4);
    expect(units.find((d) => d.name === 'squad_rifle_e')!.flip).toBe(true);
    expect(units.find((d) => d.name === 'squad_rifle_n')!.flip).toBe(false);
  });

  it('does not draw an enemy that is out of sight, and draws one that is seen', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const visible = computeVisible(state, 'player');
    const seenEnemies = state.units.filter((u) => u.side === 'enemy' && u.alive && visible[u.pos.y][u.pos.x]).length;
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.filter((d) => d.name.startsWith('enemy_')).length).toBe(seenEnemies);

    const enemy = state.units.find((u) => u.side === 'enemy')!;
    const soldier = state.units.find((u) => u.side === 'player')!;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y }; // next to a soldier: always seen
    const second = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, second.atlas);
    expect(second.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(true);
  });

  it('draws a corpse only when it is seen', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    const near = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, near.atlas);
    expect(near.drawn.some((d) => d.name === 'corpse_enemy')).toBe(true);
    enemy.pos = { x: 28, y: 18 }; // far away, in the dark
    const far = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, far.atlas);
    expect(far.drawn.some((d) => d.name === 'corpse_enemy')).toBe(false);
  });

  it('draws corpses before the living, so a soldier standing on a corpse stays visible', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { ...soldier.pos }; // the dead lie where the soldier now stands
    state.units.push(state.units.splice(state.units.indexOf(enemy), 1)[0]); // listed after the soldier: drawn after him unless corpses get their own pass
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const corpse = drawn.findIndex((d) => d.name === 'corpse_enemy');
    const alive = drawn.findIndex((d) => d.name.startsWith('squad_') && d.x === soldier.pos.x * 16 && d.y === soldier.pos.y * 16 - RISE);
    expect(corpse).toBeGreaterThanOrEqual(0);
    expect(alive).toBeGreaterThan(corpse);
  });

  it('draws a corpse after the item lying under it', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    state.items.push({ id: 'i77', pos: { ...enemy.pos }, kind: 'rifle' });
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.findIndex((d) => d.name === 'item_rifle')).toBeLessThan(drawn.findIndex((d) => d.name === 'corpse_enemy'));
  });

  it('draws item icons where the player can see them', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    state.items.push({ id: 'i99', pos: { x: soldier.pos.x, y: soldier.pos.y }, kind: 'grenade' });
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(drawn.some((d) => d.name === 'item_grenade')).toBe(true);
  });

  it('draws a figure with its feet on the unit tile: RISE px up and in the tile column', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    for (const u of state.units.filter((x) => x.side === 'player')) {
      expect(drawn.some((d) => d.name.startsWith('squad_') && d.x === u.pos.x * 16 && d.y === u.pos.y * 16 - RISE), u.id).toBe(true);
    }
  });

  it('draws the units in order of tile row, the lowest row last, whatever order they are listed in', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    state.units.reverse();
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const ys = drawn.filter((d) => d.name.startsWith('squad_') || d.name.startsWith('enemy_')).map((d) => d.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it('draws the head of a soldier on the first walkable row over the border wall, never above the map', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const p1 = state.units.find((u) => u.id === 'p1')!;
    p1.pos = { x: 1, y: 1 }; // the first walkable row
    const { atlas, drawn } = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    const fig = drawn.find((d) => d.name.startsWith('squad_') && d.x === 16 && d.y === 16 - RISE);
    expect(fig).toBeDefined();
    expect(fig!.y).toBeGreaterThanOrEqual(0); // the head rows lie in row 0, the wall; the world starts at y = 0
  });

  it('draws an enemy at the edge of vision only when its own tile is in view', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.pos = { x: 28, y: 1 }; // far corner, in the dark
    const hidden = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, hidden.atlas);
    expect(hidden.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(false);
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    const seen = spyAtlas();
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, seen.atlas);
    expect(seen.drawn.some((d) => d.name.startsWith('enemy_'))).toBe(true);
  });

  it('completes with an atlas that has no canvas (nothing is drawn)', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const empty = new Atlas(() => null);
    expect(() => drawGame(ctx, state, createUiState('p1'), new Effects(), 0, empty)).not.toThrow();
  });
});

describe('Effects.unitBob', () => {
  it('lifts a walking unit by one pixel for the first half of its step, then settles', () => {
    const fx = new Effects();
    fx.add([{ type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }], 1000);
    expect(fx.unitBob('p1', 1010)).toBe(-1);
    expect(fx.unitBob('p1', 1090)).toBe(0);
    expect(fx.unitBob('p1', 2000)).toBe(0);
    expect(fx.unitBob('p2', 1010)).toBe(0);
  });
});

describe('gadget markers', () => {
  /** A canvas stand-in that records every fillRect with the fill style in force. */
  function recorder() {
    const fills: { style: string; x: number; y: number; w: number; h: number }[] = [];
    let style = '';
    const target = new Proxy({}, {
      get: (_t, k) => (k === 'fillStyle' ? style : k === 'fillRect'
        ? (x: number, y: number, w: number, h: number) => fills.push({ style, x, y, w, h })
        : () => ({ width: 0 })),
      set: (_t, k, v) => { if (k === 'fillStyle') style = String(v); return true; },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx: target, fills };
  }

  it('draws a red dot on a scanned tile the player cannot see, and none on a visible one', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const vis = computeVisible(state, 'player');
    let hidden = { x: 0, y: 0 };
    let shown = { x: 0, y: 0 };
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (state.tiles[y][x].kind === 'floor') {
          if (!vis[y][x]) hidden = { x, y };
          else shown = { x, y };
        }
      }
    }
    const dot = (p: { x: number; y: number }) => ({ style: '#ff4d4d', x: p.x * 16 + 6, y: p.y * 16 + 6, w: 4, h: 4 });
    state.scanned = [hidden];
    const a = recorder();
    drawGame(a.ctx, state, createUiState('p1'), new Effects(), 0, spyAtlas().atlas);
    expect(a.fills).toContainEqual(dot(hidden));
    state.scanned = [shown];
    const b = recorder();
    drawGame(b.ctx, state, createUiState('p1'), new Effects(), 0, spyAtlas().atlas);
    expect(b.fills).not.toContainEqual(dot(shown));
  });

  it('draws a blue pip on an armoured soldier only', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const armoured = state.units.find((u) => u.id === 'p1')!;
    const none = recorder();
    drawGame(none.ctx, state, createUiState('p1'), new Effects(), 0, spyAtlas().atlas);
    expect(none.fills.some((f) => f.style === '#4da6ff')).toBe(false);
    armoured.gadget = 'armour';
    const worn = recorder();
    drawGame(worn.ctx, state, createUiState('p1'), new Effects(), 0, spyAtlas().atlas);
    expect(worn.fills).toContainEqual({ style: '#4da6ff', x: armoured.pos.x * 16 + 12, y: armoured.pos.y * 16 - RISE - 9, w: 2, h: 2 });
  });

  it('keeps the armour pip clear of the rank pips of a promoted soldier', () => {
    const state = createMission(MISSIONS[0], 1, roster); // roster[0] has 9 kills: a Captain with three pips
    const p1 = state.units.find((u) => u.id === 'p1')!;
    p1.gadget = 'armour';
    const r = recorder();
    drawGame(r.ctx, state, createUiState('p1'), new Effects(), 0, spyAtlas().atlas);
    const x0 = p1.pos.x * 16;
    const y0 = p1.pos.y * 16 - RISE - 12; // the status row above the head
    const near = (f: { x: number; y: number }) => f.x >= x0 && f.x < x0 + 16 && f.y >= y0 && f.y < y0 + 8;
    const pips = r.fills.filter((f) => f.style === '#ffe14d' && f.w === 1 && f.h === 2 && near(f));
    const armour = r.fills.filter((f) => f.style === '#4da6ff' && near(f));
    expect(pips).toHaveLength(3);
    expect(armour).toHaveLength(1);
    const a = armour[0];
    for (const p of pips) {
      const overlap = a.x < p.x + p.w && p.x < a.x + a.w && a.y < p.y + p.h && p.y < a.y + a.h;
      expect(overlap, `armour pip overlaps a rank pip at ${p.x},${p.y}`).toBe(false);
    }
  });

  it('draws the health bar entirely above the figure, so it never covers the helmet or the rank pips', () => {
    const state = createMission(MISSIONS[0], 1, roster);
    const p1 = state.units.find((u) => u.id === 'p1')!;
    const r = recorder();
    drawGame(r.ctx, state, createUiState('p1'), new Effects(), 0, spyAtlas().atlas);
    const bars = r.fills.filter((f) => f.style === '#7dff9a' && f.h === 2 && f.x >= p1.pos.x * 16 && f.x < p1.pos.x * 16 + 16);
    expect(bars.length).toBeGreaterThan(0);
    for (const b of bars) expect(b.y + b.h).toBeLessThanOrEqual(p1.pos.y * 16 - RISE - 4); // a 4 px gap over the head
  });
});
