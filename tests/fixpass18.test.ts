import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { createMission, MISSIONS } from '../src/core/missions';
import { smokeAt } from '../src/core/vision';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { throwButtonText } from '../src/render/panel';
import { drawGame } from '../src/render/renderer';
import { textWidth } from '../src/ui/font';
import { corridorRows, makeState, unit } from './helpers';

describe('hazard lookups are cached', () => {
  it('reads the hazard list once, not once per call', () => {
    const s = makeState(corridorRows('P...E'));
    s.hazards.push({ pos: { x: 3, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    let reads = 0;
    s.hazards = new Proxy(s.hazards, {
      get(t, k, r) {
        if (k === 'some' || k === 'filter' || k === 'find') reads++;
        return Reflect.get(t, k, r);
      },
    });
    for (let i = 0; i < 100; i++) smokeAt(s, { x: 3, y: 1 });
    expect(reads).toBeLessThanOrEqual(1);
  });

  it('still sees a smoke tile added later, and one removed by replacing the list', () => {
    const s = makeState(corridorRows('P...E'));
    expect(smokeAt(s, { x: 2, y: 1 })).toBe(false);
    s.hazards.push({ pos: { x: 2, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    expect(smokeAt(s, { x: 2, y: 1 })).toBe(true);
    s.hazards = s.hazards.filter(() => false);
    expect(smokeAt(s, { x: 2, y: 1 })).toBe(false);
    s.hazards.push({ pos: { x: 3, y: 1 }, kind: 'fire', turnsLeft: 3 });
    expect(smokeAt(s, { x: 3, y: 1 })).toBe(false); // fire is not smoke
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

describe('hazards show on explored tiles', () => {
  it('draws smoke where the player has been even though smoke tiles are never "visible", and not on unexplored tiles', () => {
    const state = createMission(MISSIONS[0], 1);
    const p = state.units.find((u) => u.side === 'player')!;
    const near = { x: p.pos.x + 6, y: p.pos.y }; // two or more tiles from every soldier
    state.explored[near.y][near.x] = true;
    state.hazards.push({ pos: near, kind: 'smoke', turnsLeft: 3 }, { pos: { x: 28, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    // a smoke tile next to the thrower hides what is behind it, so mark the tile as one the vision code calls dark
    const names: string[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const real = atlas.draw.bind(atlas);
    atlas.draw = (c, name, x, y, o = {}) => { names.push(`${name}@${x},${y}`); return real(c, name, x, y, o); };
    drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
    expect(names).toContain(`smoke@${near.x * 16},${near.y * 16}`);
    expect(names.some((n) => n.startsWith('smoke@448,16'))).toBe(false);
    void unit;
  });
});

describe('the throw button text', () => {
  const u = { throwable: 'incendiary', grenades: 3 } as never;
  it('is the keyed label when it fits, else shorter ones, and always fits', () => {
    const fitsIn = (limit: number) => (s: string) => textWidth(s) <= limit;
    expect(throwButtonText(u, 'T', fitsIn(999))).toBe('T INCENDIARY (3)');
    for (const limit of [120, 80, 60, 45, 30, 12]) {
      const text = throwButtonText(u, 'T', fitsIn(limit));
      expect(textWidth(text), `limit ${limit}: ${text}`).toBeLessThanOrEqual(Math.max(limit, textWidth('T')));
    }
    expect(throwButtonText({ throwable: 'smoke', grenades: 2 } as never, 'T', fitsIn(60))).toMatch(/SMOKE/);
  });
});
