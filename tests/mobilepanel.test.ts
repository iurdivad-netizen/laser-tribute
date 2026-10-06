import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import type { SpriteName } from '../src/art/sprites';
import { createMission, MISSIONS } from '../src/core/missions';
import { createUiState } from '../src/input/uiState';
import { createCamera, followTile, originOf } from '../src/render/camera';
import { Effects } from '../src/render/effects';
import { cancelHit, drawPanel, panelButtonAt, soundHit, squadAt } from '../src/render/panel';
import { drawGame } from '../src/render/renderer';
import { unsupportedChars } from '../src/ui/font';
import { computeLayout, type Layout } from '../src/ui/layout';
import { onText, type TextRun } from '../src/ui/text';
import { corridorRows, makeState, unit } from './helpers';

const SIZES: [number, number, number][] = [[390, 844, 3], [844, 390, 3], [1366, 768, 1], [320, 568, 2]];
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const left = (r: TextRun): number =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

function runsOf(draw: (ctx: CanvasRenderingContext2D) => void): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  stop();
  return runs;
}

describe.each(SIZES)('the panel at %i x %i (dpr %i)', (w, h, dpr) => {
  const L: Layout = computeLayout(w, h, dpr);

  it('hit-tests every action, squad button, cancel and sound by its centre, and nothing else', () => {
    for (const a of L.actions) {
      const c = centre(a.rect);
      expect(panelButtonAt(L, c.x, c.y), a.id).toBe(a.id);
    }
    L.squad.forEach((r, i) => {
      const c = centre(r);
      expect(squadAt(L, c.x, c.y)).toBe(i);
      expect(panelButtonAt(L, c.x, c.y)).toBeNull();
    });
    const c = centre(L.cancel);
    expect(cancelHit(L, c.x, c.y)).toBe(true);
    expect(soundHit(L, c.x, c.y)).toBe(false);
    const s = centre(L.sound);
    expect(soundHit(L, s.x, s.y)).toBe(true);
    expect(panelButtonAt(L, L.map.x + 2, L.map.y + L.map.h / 2)).toBeNull();
    expect(squadAt(L, L.map.x + 2, L.map.y + L.map.h / 2)).toBeNull();
  });

  it('draws only supported text, inside the window, with nothing overlapping', () => {
    const s = makeState(corridorRows('PPPP.E'));
    const p = unit(s, 'p1');
    p.name = 'Lindqvist 2';
    p.rank = 'Captain';
    p.gadget = 'scanner';
    p.attachment = 'scope';
    p.alert = true;
    const ui = createUiState('p1');
    ui.mode = 'turn';
    ui.message = 'Lindqvist 2 on alert: fires at enemies that move';
    ui.messageUntil = Infinity;
    const runs = runsOf((ctx) => drawPanel(ctx, s, ui, 0, L, { zoom: 'close', soundOn: false }));
    expect(runs.length).toBeGreaterThan(10);
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(-0.01);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(w + 0.01);
      expect(r.y + 7 * L.text, r.text).toBeLessThanOrEqual(h + 0.01);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i];
        const b = runs[j];
        const ov = left(a) < left(b) + b.width - 0.01 && left(b) < left(a) + a.width - 0.01
          && a.y < b.y + 7 * L.text - 0.01 && b.y < a.y + 7 * L.text - 0.01;
        expect(ov, `"${a.text}" overlaps "${b.text}"`).toBe(false);
      }
    }
  });

  it('shows the squad names, and CANCEL only while a mode is active', () => {
    const s = makeState(corridorRows('PPPP.E'));
    const idle = runsOf((ctx) => drawPanel(ctx, s, createUiState('p1'), 0, L)).map((r) => r.text);
    for (const n of ['P1', 'P2', 'P3', 'P4']) expect(idle, n).toContain(n);
    expect(idle.some((t) => t === 'CANCEL' || t === 'X')).toBe(false);
    const ui = createUiState('p1');
    ui.mode = 'snap';
    const busy = runsOf((ctx) => drawPanel(ctx, s, ui, 0, L)).map((r) => r.text);
    expect(busy.some((t) => t === 'CANCEL' || t === 'X')).toBe(true);
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

describe('the world is drawn through the camera', () => {
  it('translates and scales the context to the camera, clips to the map rectangle, and draws sprites in tile pixels', () => {
    const calls: { name: string; args: number[] }[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => (typeof k === 'string' ? (...args: number[]) => { calls.push({ name: k, args }); return { width: 0 }; } : undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const drawn: { name: SpriteName; x: number; y: number }[] = [];
    const atlas = new Atlas((a, b) => new FakeCanvas(a, b));
    const real = atlas.draw.bind(atlas);
    atlas.draw = (c, name, x, y, opts = {}) => {
      drawn.push({ name, x, y });
      return real(c, name, x, y, opts);
    };
    const state = createMission(MISSIONS[0], 1);
    const p1 = state.units.find((u) => u.id === 'p1')!;
    const layout = computeLayout(390, 844, 3);
    const camera = followTile(createCamera(layout, state.width, state.height), p1.pos, layout, state.width, state.height);
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas, { layout, camera });

    const o = originOf(camera, layout, state.width, state.height);
    const translate = calls.find((c) => c.name === 'translate')!;
    const scale = calls.find((c) => c.name === 'scale')!;
    const rect = calls.find((c) => c.name === 'rect')!;
    expect(translate.args).toEqual([o.x, o.y]);
    expect(scale.args[0]).toBeCloseTo(o.tile / 16, 6);
    expect(rect.args).toEqual([layout.map.x, layout.map.y, layout.map.w, layout.map.h]);
    expect(calls.some((c) => c.name === 'clip')).toBe(true);
    expect(drawn.some((d) => d.name.startsWith('soldier_') && d.x === p1.pos.x * 16 && d.y === p1.pos.y * 16)).toBe(true);
    // the panel is drawn after the world is restored
    const restore = calls.findIndex((c) => c.name === 'restore');
    const firstPanelFill = calls.findIndex((c, i) => i > restore && c.name === 'fillRect');
    expect(restore).toBeGreaterThan(-1);
    expect(firstPanelFill).toBeGreaterThan(restore);
  });
});
