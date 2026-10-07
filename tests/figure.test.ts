import { describe, expect, it } from 'vitest';
import {
  FIGURE_H, FIGURE_W, METAL, RISE, TIP, WEAPON_AT, armedFigure, bodyFigure, figureMask, flipFigure, unitFigure,
  type FigureSide, type FigureView,
} from '../src/art/figure';
import type { Facing, WeaponId } from '../src/core/types';

const VIEWS: FigureView[] = ['n', 'ne', 'e', 'se', 's'];
const SIDES: FigureSide[] = ['squad', 'enemy'];
const WEAPONS: WeaponId[] = ['rifle', 'pistol'];
const DIR: Record<FigureView, [number, number]> = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1] };

/** The pixels a weapon added to a body, as {x, y, colour}. */
function added(side: FigureSide, view: FigureView, weapon: WeaponId) {
  const body = bodyFigure(side, view);
  const armed = armedFigure(side, view, weapon);
  const out: { x: number; y: number; colour: string }[] = [];
  armed.pixels.forEach((p, i) => {
    if (p !== body.pixels[i]) out.push({ x: i % FIGURE_W, y: Math.floor(i / FIGURE_W), colour: p as string });
  });
  return out;
}

describe('figures', () => {
  it('are 16 wide, about two tiles tall, with RISE the part above the tile', () => {
    expect(FIGURE_W).toBe(16);
    expect(FIGURE_H).toBeGreaterThanOrEqual(30);
    expect(RISE).toBe(FIGURE_H - 16);
    for (const side of SIDES) for (const view of VIEWS) {
      const f = bodyFigure(side, view);
      expect(f.width).toBe(FIGURE_W);
      expect(f.height).toBe(FIGURE_H);
      expect(f.pixels).toHaveLength(FIGURE_W * FIGURE_H);
      expect(f.pixels.some((p) => p !== null), `${side} ${view}`).toBe(true);
    }
  });

  it('have their feet on the bottom row in every view', () => {
    for (const side of SIDES) for (const view of VIEWS) {
      const f = bodyFigure(side, view);
      const bottom = f.pixels.slice((FIGURE_H - 1) * FIGURE_W);
      expect(bottom.some((p) => p !== null), `${side} ${view}`).toBe(true);
    }
  });

  it('keep the squad and the enemy apart: different pixels', () => {
    for (const view of VIEWS) {
      expect(bodyFigure('squad', view).pixels).not.toEqual(bodyFigure('enemy', view).pixels);
    }
  });
});

describe('the painted weapon', () => {
  it('points the way each view faces, for both weapons and both sides', () => {
    for (const view of VIEWS) {
      expect([WEAPON_AT[view].dx, WEAPON_AT[view].dy]).toEqual(DIR[view]);
      for (const side of SIDES) for (const weapon of WEAPONS) {
        const tip = added(side, view, weapon).filter((p) => p.colour === TIP);
        expect(tip, `${side} ${weapon} ${view}`).toHaveLength(1);
        const at = WEAPON_AT[view];
        const [vx, vy] = DIR[view];
        if (vx !== 0) expect(Math.sign(tip[0].x - at.x), `${weapon} ${view} x`).toBe(vx);
        if (vy !== 0) expect(Math.sign(tip[0].y - at.y), `${weapon} ${view} y`).toBe(vy);
      }
    }
  });

  it('is longer for a rifle than for a pistol in every view, and never empty', () => {
    for (const view of VIEWS) {
      const rifle = added('squad', view, 'rifle').length;
      const pistol = added('squad', view, 'pistol').length;
      expect(rifle, view).toBeGreaterThan(pistol);
      expect(pistol, view).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses only metal and tip colours, and stays inside the figure box', () => {
    for (const view of VIEWS) for (const weapon of WEAPONS) {
      for (const p of added('squad', view, weapon)) {
        expect([METAL, TIP]).toContain(p.colour);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(FIGURE_W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(FIGURE_H);
      }
    }
  });

  it('starts at the body: the first barrel pixel is on or next to an opaque body pixel', () => {
    for (const side of SIDES) for (const view of VIEWS) {
      const body = bodyFigure(side, view);
      const at = WEAPON_AT[view];
      const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < FIGURE_W && y < FIGURE_H && body.pixels[y * FIGURE_W + x] !== null;
      const touches = opaque(at.x, at.y) || opaque(at.x - 1, at.y) || opaque(at.x + 1, at.y) || opaque(at.x, at.y - 1) || opaque(at.x, at.y + 1);
      expect(touches, `${side} ${view} weapon start ${at.x},${at.y} floats in the air`).toBe(true);
    }
  });
});

describe('mirrors and masks', () => {
  it('flips left to right, and flipping twice gives the original', () => {
    const f = armedFigure('squad', 'ne', 'rifle');
    const g = flipFigure(f);
    expect(g.pixels[0 * FIGURE_W + 0]).toBe(f.pixels[0 * FIGURE_W + (FIGURE_W - 1)]);
    expect(g.pixels[20 * FIGURE_W + 3]).toBe(f.pixels[20 * FIGURE_W + (FIGURE_W - 1 - 3)]);
    expect(flipFigure(g).pixels).toEqual(f.pixels);
  });

  it('gives an opaque-pixel mask, mirrored when flipped, and caches it', () => {
    const f = armedFigure('squad', 'e', 'rifle');
    const plain = figureMask(f, false);
    const flipped = figureMask(f, true);
    expect(plain).toHaveLength(FIGURE_W * FIGURE_H);
    f.pixels.forEach((p, i) => expect(plain[i]).toBe(p === null ? 0 : 1));
    for (let y = 0; y < FIGURE_H; y++) for (let x = 0; x < FIGURE_W; x++) {
      expect(flipped[y * FIGURE_W + x]).toBe(plain[y * FIGURE_W + (FIGURE_W - 1 - x)]);
    }
    expect(figureMask(f, false)).toBe(plain);
  });

  it('maps facings 0 to 4 to the five views and 5, 6, 7 to the mirrors of 3, 2, 1, per weapon and side', () => {
    const expected: [Facing, FigureView, boolean][] = [
      [0, 'n', false], [1, 'ne', false], [2, 'e', false], [3, 'se', false], [4, 's', false],
      [5, 'se', true], [6, 'e', true], [7, 'ne', true],
    ];
    for (const weapon of WEAPONS) {
      for (const [facing, view, flip] of expected) {
        const p = unitFigure('player', facing, weapon);
        expect(p.flip).toBe(flip);
        expect(p.figure.name).toBe(`squad_${weapon}_${view}`);
        const e = unitFigure('enemy', facing, weapon);
        expect(e.flip).toBe(flip);
        expect(e.figure.name).toBe(`enemy_${weapon}_${view}`);
      }
    }
  });
});
