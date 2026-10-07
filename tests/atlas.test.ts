import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { PALETTE } from '../src/art/palette';
import { SPRITE_ROWS } from '../src/art/sprites';
import { FIGURE_H, FIGURE_W, armedFigure } from '../src/art/figure';

interface Op { colour: string; x: number; y: number; w: number; h: number }

class FakeCanvas implements CanvasLike {
  ops: Op[] = [];
  constructor(public width: number, public height: number) {}
  getContext() {
    const canvas = this;
    let colour = '';
    return {
      set fillStyle(v: unknown) { colour = String(v); },
      get fillStyle() { return colour; },
      fillRect(x: number, y: number, w: number, h: number) { canvas.ops.push({ colour, x, y, w, h }); },
    };
  }
}

function makeAtlas() {
  const canvases: FakeCanvas[] = [];
  const atlas = new Atlas((w, h) => {
    const c = new FakeCanvas(w, h);
    canvases.push(c);
    return c;
  });
  return { atlas, canvases };
}

function fakeCtx() {
  const calls: unknown[][] = [];
  const ctx = { drawImage: (...a: unknown[]) => { calls.push(a); } } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('Atlas', () => {
  it('bakes a sprite once, one rectangle per opaque pixel in the palette colour', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    expect(atlas.draw(ctx, 'wall', 0, 0)).toBe(true);
    expect(atlas.draw(ctx, 'wall', 16, 0)).toBe(true);
    expect(canvases).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const opaque = SPRITE_ROWS.wall.join('').replace(/\./g, '').length;
    expect(canvases[0].ops).toHaveLength(opaque);
    expect(canvases[0].ops[0].colour).toBe(PALETTE.W);
    expect(canvases[0].ops.every((o) => o.w === 1 && o.h === 1)).toBe(true);
  });

  it('draws the baked canvas at the rounded position and size', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'wall', 32.4, 47.6);
    expect(calls[0]).toEqual([canvases[0], 32, 48, 16, 16]);
  });

  it('scales a sprite by whole factors', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'boom_2', 10, 20, { scale: 3 });
    expect(calls[0]).toEqual([canvases[0], 10, 20, 48, 48]);
  });

  it('keeps a mirrored copy as a separate cache entry with the pixels mirrored', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx } = fakeCtx();
    atlas.draw(ctx, 'item_rifle', 0, 0);
    atlas.draw(ctx, 'item_rifle', 0, 0, { flip: true });
    atlas.draw(ctx, 'item_rifle', 0, 0, { flip: true });
    expect(canvases).toHaveLength(2);
    const key = (o: Op) => `${o.x},${o.y},${o.colour}`;
    const plain = new Set(canvases[0].ops.map(key));
    const mirrored = new Set(canvases[1].ops.map((o) => key({ ...o, x: 15 - o.x })));
    expect(mirrored).toEqual(plain);
  });

  it('draws nothing and does not throw when there is no canvas', () => {
    const atlas = new Atlas(() => null);
    const { ctx, calls } = fakeCtx();
    expect(atlas.draw(ctx, 'wall', 0, 0)).toBe(false);
    expect(atlas.draw(ctx, 'item_rifle', 0, 0, { flip: true })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('the default atlas in a plain Node environment has no canvas and stays silent', () => {
    const atlas = new Atlas();
    const { ctx, calls } = fakeCtx();
    expect(() => atlas.draw(ctx, 'wall', 0, 0)).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe('Atlas figures', () => {
  it('bakes a figure once, one rectangle per opaque pixel in its own colour, and draws it 1:1', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx, calls } = fakeCtx();
    const f = armedFigure('squad', 's', 'rifle');
    expect(atlas.drawFigure(ctx, f, 32.4, 47.6)).toBe(true);
    expect(atlas.drawFigure(ctx, f, 0, 0)).toBe(true);
    expect(canvases).toHaveLength(1);
    expect(canvases[0].width).toBe(FIGURE_W);
    expect(canvases[0].height).toBe(FIGURE_H);
    expect(calls[0]).toEqual([canvases[0], 32, 48, FIGURE_W, FIGURE_H]);
    expect(canvases[0].ops).toHaveLength(f.pixels.filter((p) => p !== null).length);
    expect(canvases[0].ops.every((o) => o.w === 1 && o.h === 1)).toBe(true);
    const first = f.pixels.findIndex((p) => p !== null);
    expect(canvases[0].ops[0]).toMatchObject({ x: first % FIGURE_W, y: Math.floor(first / FIGURE_W), colour: f.pixels[first] });
  });

  it('keeps a mirrored copy as a separate cache entry with the pixels mirrored', () => {
    const { atlas, canvases } = makeAtlas();
    const { ctx } = fakeCtx();
    const f = armedFigure('squad', 'ne', 'rifle');
    atlas.drawFigure(ctx, f, 0, 0);
    atlas.drawFigure(ctx, f, 0, 0, { flip: true });
    atlas.drawFigure(ctx, f, 0, 0, { flip: true });
    expect(canvases).toHaveLength(2);
    const key = (o: Op) => `${o.x},${o.y},${o.colour}`;
    const plain = new Set(canvases[0].ops.map(key));
    const mirrored = new Set(canvases[1].ops.map((o) => key({ ...o, x: FIGURE_W - 1 - o.x })));
    expect(mirrored).toEqual(plain);
  });

  it('draws nothing and does not throw when there is no canvas', () => {
    const atlas = new Atlas(() => null);
    const { ctx, calls } = fakeCtx();
    expect(atlas.drawFigure(ctx, armedFigure('enemy', 'e', 'pistol'), 0, 0, { flip: true })).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
