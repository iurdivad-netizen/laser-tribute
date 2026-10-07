import { describe, expect, it } from 'vitest';
import { FIGURE_H, FIGURE_W, RISE, figureMask, unitFigure } from '../src/art/figure';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState, Unit } from '../src/core/types';
import { createCamera, setZoom, tileToScreen } from '../src/render/camera';
import { unitAtScreen } from '../src/render/hit';
import { computeLayout } from '../src/ui/layout';

const layout = computeLayout(480, 400, 1);

function setup() {
  const state = createMission(MISSIONS[0], 1);
  const camera = setZoom(createCamera(layout, state.width, state.height), 'whole', layout, state.width, state.height); // the whole map in sight
  return { state, camera };
}

/** The screen point of figure pixel (lx, ly) of a unit (the middle of that pixel). */
function screenOf(state: GameState, camera: ReturnType<typeof createCamera>, u: Unit, lx: number, ly: number) {
  const s = tileToScreen(camera, layout, state.width, state.height, u.pos);
  const k = s.tile / 16;
  return { x: s.x + (lx + 0.5) * k, y: s.y + (ly - RISE + 0.5) * k };
}

function maskOf(u: Unit) {
  const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
  return figureMask(figure, flip);
}

function pixel(mask: Uint8Array, want: 0 | 1, from = 0) {
  for (let i = from; i < mask.length; i++) if (mask[i] === want) return { lx: i % FIGURE_W, ly: Math.floor(i / FIGURE_W) };
  throw new Error('no such pixel');
}

describe('unitAtScreen', () => {
  it('hits a soldier on an opaque pixel of his head, which lies over the tile above', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const head = pixel(maskOf(p), 1); // the first opaque pixel is at the top of the figure
    expect(head.ly).toBeLessThan(RISE); // in the part above the feet tile
    const pt = screenOf(state, camera, p, head.lx, head.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p1');
  });

  it('falls through on a transparent pixel inside the figure rectangle', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const gap = pixel(maskOf(p), 0); // the top-left pixel of the rectangle is empty
    const pt = screenOf(state, camera, p, gap.lx, gap.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)).toBeNull();
  });

  it('uses the mirrored mask for a mirrored facing', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    p.facing = 6; // west: the mirror of east
    const { figure } = unitFigure(p.side, p.facing, p.weapon);
    const plain = figureMask(figure, false);
    const flipped = figureMask(figure, true);
    let found: { lx: number; ly: number } | null = null;
    for (let i = 0; i < plain.length && !found; i++) {
      if (flipped[i] === 1 && plain[i] === 0) found = { lx: i % FIGURE_W, ly: Math.floor(i / FIGURE_W) };
    }
    expect(found).not.toBeNull();
    const pt = screenOf(state, camera, p, found!.lx, found!.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p1');
  });

  it('picks the figure in front when two overlap', () => {
    const { state, camera } = setup();
    const back = state.units.find((u) => u.id === 'p1')!;
    const front = state.units.find((u) => u.id === 'p2')!;
    back.pos = { x: 5, y: 10 };
    front.pos = { x: 5, y: 11 }; // one row lower: in front, his head overlaps the back figure's legs
    const a = maskOf(back);
    const b = maskOf(front);
    let both: { x: number; y: number } | null = null; // a world pixel opaque in both figures
    for (let ly = 0; ly < FIGURE_H && !both; ly++) {
      for (let lx = 0; lx < FIGURE_W && !both; lx++) {
        const wy = back.pos.y * 16 - RISE + ly; // the same world pixel in the front figure's own rows
        const fy = wy - (front.pos.y * 16 - RISE);
        if (fy >= 0 && fy < FIGURE_H && a[ly * FIGURE_W + lx] === 1 && b[fy * FIGURE_W + lx] === 1) both = { x: lx, y: ly };
      }
    }
    expect(both).not.toBeNull();
    const pt = screenOf(state, camera, back, both!.x, both!.y);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p2');
  });

  it('never hits an enemy that is out of sight, and hits one that is seen', () => {
    const { state, camera } = setup();
    const soldier = state.units.find((u) => u.side === 'player')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    enemy.pos = { x: 28, y: 5 }; // far away, in the dark
    const body = pixel(maskOf(enemy), 1);
    let pt = screenOf(state, camera, enemy, body.lx, body.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)).toBeNull();
    enemy.pos = { x: soldier.pos.x + 1, y: soldier.pos.y };
    pt = screenOf(state, camera, enemy, body.lx, body.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe(enemy.id);
  });

  it('ignores the dead and points outside the map rectangle', () => {
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const body = pixel(maskOf(p), 1);
    const pt = screenOf(state, camera, p, body.lx, body.ly);
    p.alive = false;
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)).toBeNull();
    p.alive = true;
    expect(unitAtScreen(state, camera, layout, layout.map.x + layout.map.w + 5, 10)).toBeNull();
  });

  it('uses the logical position: the hit is where the unit stands, whatever the animation does', () => {
    // the renderer adds a move offset; unitAtScreen takes none, so the hit is always at pos
    const { state, camera } = setup();
    const p = state.units.find((u) => u.id === 'p1')!;
    const body = pixel(maskOf(p), 1);
    const pt = screenOf(state, camera, p, body.lx, body.ly);
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).toBe('p1');
    p.pos = { x: p.pos.x, y: p.pos.y - 3 }; // moved three tiles up: the old point is clear of his figure
    expect(unitAtScreen(state, camera, layout, pt.x, pt.y)?.id).not.toBe('p1');
  });
});
