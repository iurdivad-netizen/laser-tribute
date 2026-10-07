import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { RISE } from '../src/art/figure';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { createUiState, type UiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { RANGE_COLORS, blastTiles, shotTiles, throwTiles } from '../src/render/ranges';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

interface Rec { style: string; x: number; y: number; w: number; h: number }

function draw(state: GameState, ui: UiState): { fills: Rec[]; strokes: Rec[] } {
  const fills: Rec[] = [];
  const strokes: Rec[] = [];
  let fillStyle = '';
  let strokeStyle = '';
  const ctx = new Proxy({}, {
    get: (_t, k) => {
      if (k === 'fillRect') return (x: number, y: number, w: number, h: number) => fills.push({ style: fillStyle, x, y, w, h });
      if (k === 'strokeRect') return (x: number, y: number, w: number, h: number) => strokes.push({ style: strokeStyle, x, y, w, h });
      return () => ({ width: 0 });
    },
    set: (_t, k, v) => {
      if (k === 'fillStyle') fillStyle = String(v);
      if (k === 'strokeStyle') strokeStyle = String(v);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  drawGame(ctx, state, ui, new Effects(), 0, new Atlas((w, h) => new FakeCanvas(w, h)));
  return { fills, strokes };
}

const tile = (r: Rec) => ({ x: Math.floor(r.x / 16), y: Math.floor(r.y / 16) });
const tints = (fills: Rec[], style: string) => fills.filter((f) => f.style === style && f.w === 16 && f.h === 16);

function setup() {
  const state = createMission(MISSIONS[0], 1);
  const p = state.units.find((u) => u.side === 'player')!;
  state.explored = state.explored.map((row) => row.map(() => true));
  return { state, p };
}

describe('the range tint', () => {
  it('tints exactly the shootable tiles in snap and aimed mode, and nothing in move mode', () => {
    const { state, p } = setup();
    for (const mode of ['snap', 'aimed'] as const) {
      const ui = createUiState(p.id);
      ui.mode = mode;
      const shown = tints(draw(state, ui).fills, RANGE_COLORS.shot).map(tile);
      const want = shotTiles(state, p);
      expect(shown).toHaveLength(want.length);
      expect(want.length).toBeGreaterThan(5);
      for (const t of want) expect(shown).toContainEqual(t);
    }
    expect(tints(draw(state, createUiState(p.id)).fills, RANGE_COLORS.shot)).toHaveLength(0);
  });

  it('tints the throwable reach in throw mode, in its own colour', () => {
    const { state, p } = setup();
    const ui = createUiState(p.id);
    ui.mode = 'throw';
    const out = draw(state, ui);
    expect(tints(out.fills, RANGE_COLORS.throw)).toHaveLength(throwTiles(state, p).length);
    expect(tints(out.fills, RANGE_COLORS.shot)).toHaveLength(0);
  });

  it('never tints a tile the player has not explored', () => {
    const { state, p } = setup();
    const t = shotTiles(state, p)[0];
    state.explored[t.y][t.x] = false;
    const ui = createUiState(p.id);
    ui.mode = 'snap';
    const shown = tints(draw(state, ui).fills, RANGE_COLORS.shot).map(tile);
    expect(shown).not.toContainEqual(t);
  });

  it('shows nothing when no soldier is selected', () => {
    const { state } = setup();
    const ui = createUiState(null);
    ui.mode = 'snap';
    expect(tints(draw(state, ui).fills, RANGE_COLORS.shot)).toHaveLength(0);
  });
});

describe('the blast preview', () => {
  it('shows the blast square of the kind over the hovered tile, and outlines friends and visible foes in it', () => {
    const { state, p } = setup();
    const reach = throwTiles(state, p);
    const at = reach.find((t) => Math.abs(t.x - p.pos.x) + Math.abs(t.y - p.pos.y) >= 4)!;
    const foe = state.units.find((u) => u.side === 'enemy')!;
    foe.pos = { x: at.x, y: at.y };
    p.throwable = 'frag';
    const ui = createUiState(p.id);
    ui.mode = 'throw';
    ui.hover = at;
    const out = draw(state, ui);
    const blast = tints(out.fills, RANGE_COLORS.blast.frag).map(tile);
    expect(blast).toHaveLength(blastTiles(state, at, 1).length);
    expect(blast).toContainEqual(at);
    const marks = out.strokes.filter((s) => s.style === RANGE_COLORS.foe).map(tile);
    expect(marks).toContainEqual(at);
  });

  it('colours the blast by kind and marks nobody for smoke', () => {
    const { state, p } = setup();
    const at = throwTiles(state, p)[10];
    const foe = state.units.find((u) => u.side === 'enemy')!;
    foe.pos = { ...at };
    p.throwable = 'smoke';
    const ui = createUiState(p.id);
    ui.mode = 'throw';
    ui.hover = at;
    const out = draw(state, ui);
    expect(tints(out.fills, RANGE_COLORS.blast.smoke)).toHaveLength(blastTiles(state, at, 2).length);
    expect(out.strokes.filter((s) => s.style === RANGE_COLORS.foe)).toHaveLength(0);
  });

  it('is not drawn outside throw mode or when the hovered tile is out of reach', () => {
    const { state, p } = setup();
    const at = throwTiles(state, p)[10];
    const ui = createUiState(p.id);
    ui.hover = at;
    expect(tints(draw(state, ui).fills, RANGE_COLORS.blast.frag)).toHaveLength(0);
    ui.mode = 'throw';
    ui.hover = { x: state.width - 2, y: state.height - 2 };
    expect(tints(draw(state, ui).fills, RANGE_COLORS.blast.frag)).toHaveLength(0);
  });
});

describe('health bars', () => {
  const bars = (fills: Rec[], x: number) => fills.filter((f) => f.style === '#7dff9a' && f.h === 2 && f.x >= x * 16 && f.x < x * 16 + 16);

  it('show for the selected soldier even at full health', () => {
    const { state, p } = setup();
    expect(bars(draw(state, createUiState(p.id)).fills, p.pos.x).length).toBeGreaterThan(0);
  });

  it('are hidden for a unit that is unhurt and not selected', () => {
    const { state, p } = setup();
    const other = state.units.find((u) => u.side === 'player' && u.id !== p.id)!;
    expect(other.hp).toBe(other.maxHp);
    expect(bars(draw(state, createUiState(p.id)).fills, other.pos.x)).toHaveLength(0);
  });

  it('show for any unit that is hurt, soldier or enemy', () => {
    const { state, p } = setup();
    const other = state.units.find((u) => u.side === 'player' && u.id !== p.id)!;
    other.hp = other.maxHp - 10;
    const foe = state.units.find((u) => u.side === 'enemy')!;
    foe.hp = foe.maxHp - 5;
    foe.pos = { x: p.pos.x + 1, y: p.pos.y - 1 }; // next to a soldier: always seen
    const out = draw(state, createUiState(p.id));
    expect(bars(out.fills, other.pos.x).length).toBeGreaterThan(0);
    expect(bars(out.fills, foe.pos.x).length).toBeGreaterThan(0);
  });

  it('keep their place above the head', () => {
    const { state, p } = setup();
    for (const b of bars(draw(state, createUiState(p.id)).fills, p.pos.x)) {
      expect(b.y + b.h).toBeLessThanOrEqual(p.pos.y * 16 - RISE - 4);
    }
  });
});

describe('review fixes', () => {
  it('marks a friend (and the thrower) with an inset box in its own colour, so the selection outline cannot hide it', () => {
    const { state, p } = setup();
    p.throwable = 'flash';
    const ui = createUiState(p.id);
    ui.mode = 'throw';
    ui.hover = { ...p.pos };
    const out = draw(state, ui);
    const mine = out.strokes.filter((s) => s.style === RANGE_COLORS.friend && Math.floor(s.x / 16) === p.pos.x && Math.floor(s.y / 16) === p.pos.y);
    expect(mine.length).toBeGreaterThan(0);
    for (const m of mine) expect(m.w).toBeLessThan(15); // inset: not the full-tile selection box
    expect(RANGE_COLORS.friend).not.toBe('#ffe14d');
  });

  it('previews a throw at the thrower own tile', () => {
    const { state, p } = setup();
    const ui = createUiState(p.id);
    ui.mode = 'throw';
    ui.hover = { ...p.pos };
    expect(tints(draw(state, ui).fills, RANGE_COLORS.blast.frag).length).toBeGreaterThan(0);
  });

  it('draws no health bar for a hurt enemy the player cannot see', () => {
    const { state, p } = setup();
    const foe = state.units.find((u) => u.side === 'enemy')!;
    foe.hp = foe.maxHp - 10;
    foe.pos = { x: state.width - 3, y: state.height - 3 }; // far away in the dark
    const out = draw(state, createUiState(p.id));
    const bars = out.fills.filter((f) => f.style === '#7dff9a' && f.h === 2 && f.x >= foe.pos.x * 16 && f.x < foe.pos.x * 16 + 16);
    expect(bars).toHaveLength(0);
  });

  it('draws the victim marks above the hover outline', () => {
    const { state, p } = setup();
    const at = throwTiles(state, p).find((t) => t.x !== p.pos.x || t.y !== p.pos.y)!;
    const foe = state.units.find((u) => u.side === 'enemy')!;
    foe.pos = { ...at };
    const order: string[] = [];
    let stroke = '';
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'strokeRect' ? () => order.push(stroke) : () => ({ width: 0 })),
      set: (_t, k, v) => { if (k === 'strokeStyle') stroke = String(v); return true; },
    }) as unknown as CanvasRenderingContext2D;
    const ui = createUiState(p.id);
    ui.mode = 'throw';
    ui.hover = at;
    drawGame(ctx, state, ui, new Effects(), 0, new Atlas((w, h) => new FakeCanvas(w, h)));
    expect(order.lastIndexOf(RANGE_COLORS.foe)).toBeGreaterThan(order.indexOf('rgba(255,255,255,0.5)'));
  });
});
