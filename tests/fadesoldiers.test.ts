import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { RISE } from '../src/art/figure';
import { createMission, MISSIONS } from '../src/core/missions';
import type { Mode } from '../src/input/uiState';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

/** The opacity each living unit's figure is drawn at, by unit id. */
function opacities(mode: Mode, mutate: (s: ReturnType<typeof createMission>) => void = () => undefined) {
  const state = createMission(MISSIONS[0], 1);
  const foe = state.units.find((u) => u.side === 'enemy')!;
  const soldier = state.units.find((u) => u.side === 'player')!;
  foe.pos = { x: soldier.pos.x + 1, y: soldier.pos.y - 3 }; // in view
  mutate(state);
  let alpha = 1;
  const seen = new Map<string, number>();
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === 'globalAlpha' ? alpha : () => ({ width: 0 })),
    set: (_t, k, v) => { if (k === 'globalAlpha') alpha = Number(v); return true; },
  }) as unknown as CanvasRenderingContext2D;
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.drawImage.bind(atlas);
  atlas.drawImage = (c, fig, x, y, o = {}) => {
    if (fig.name.startsWith('squad_') || fig.name.startsWith('enemy_')) {
      const u = state.units.find((q) => q.alive && x === q.pos.x * 16 && y === q.pos.y * 16 - RISE);
      if (u) seen.set(u.id, alpha);
    }
    return real(c, fig, x, y, o);
  };
  const ui = createUiState('p1');
  ui.mode = mode;
  drawGame(ctx, state, ui, new Effects(), 0, atlas);
  return { seen, state };
}

describe('the other soldiers fade while you move or open doors', () => {
  it('draws the others at about half opacity in Move and Door mode, the selected one and the enemies solid', () => {
    for (const mode of ['move', 'door'] as const) {
      const { seen, state } = opacities(mode);
      expect(seen.get('p1'), mode).toBe(1);
      for (const id of ['p2', 'p3', 'p4']) expect(seen.get(id), `${mode} ${id}`).toBe(0.5);
      const foe = state.units.find((u) => u.side === 'enemy')!;
      expect(seen.get(foe.id), `${mode} enemy`).toBe(1);
    }
  });

  it('draws everyone solid in the other modes', () => {
    for (const mode of ['snap', 'aimed', 'throw', 'turn', 'stab', 'heal'] as const) {
      const { seen } = opacities(mode);
      for (const id of ['p1', 'p2', 'p3', 'p4']) expect(seen.get(id), `${mode} ${id}`).toBe(1);
    }
  });

  it('draws everyone solid on the enemy turn, and when no soldier is selected', () => {
    const enemyTurn = opacities('move', (s) => { s.turn = 'enemy'; });
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(enemyTurn.seen.get(id)).toBe(1);
    const none = opacities('move', (s) => { s.units.find((u) => u.id === 'p1')!.alive = false; });
    for (const id of ['p2', 'p3', 'p4']) expect(none.seen.get(id)).toBe(1);
  });

  it('fades the status marks of a faded soldier with him', () => {
    const fills: { style: string; alpha: number; h: number }[] = [];
    const state = createMission(MISSIONS[0], 1);
    state.units.find((u) => u.id === 'p2')!.hp = 20;
    let alpha = 1;
    let fillStyle = '';
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'fillRect' ? (_x: number, _y: number, _w: number, h: number) => fills.push({ style: fillStyle, alpha, h }) : k === 'globalAlpha' ? alpha : () => ({ width: 0 })),
      set: (_t, k, v) => { if (k === 'globalAlpha') alpha = Number(v); if (k === 'fillStyle') fillStyle = String(v); return true; },
    }) as unknown as CanvasRenderingContext2D;
    const ui = createUiState('p1');
    drawGame(ctx, state, ui, new Effects(), 0, new Atlas((w, h) => new FakeCanvas(w, h)));
    const bars = fills.filter((f) => f.style === '#7dff9a' && f.h === 2); // the map bars (the squad strip has its own, 4 px high)
    expect(bars.map((b) => b.alpha).sort()).toEqual([0.5, 1]); // p1 solid (selected), p2 (hurt) faded
  });
});

describe('review fixes', () => {
  it('draws everyone solid once the mission is over', () => {
    const { seen } = opacities('move', (s) => { s.status = 'won'; });
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(seen.get(id)).toBe(1);
  });
});
