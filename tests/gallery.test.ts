import { describe, expect, it } from 'vitest';
import { drawGallery } from '../src/art/gallery';
import { IMAGE_NAMES } from '../scripts/figures-lib.mjs';
import { SPRITE_NAMES } from '../src/art/sprites';

describe('drawGallery', () => {
  it('draws every sprite once, enlarged three times, then the fourteen images and the twenty soldiers, inside the canvas', () => {
    const drawn: { name: string; x: number; y: number; scale: number }[] = [];
    const figures: { name: string; flip: boolean; x?: number; y?: number }[] = [];
    const art = {
      draw: (_ctx: unknown, name: string, x: number, y: number, opts?: { scale?: number }) => {
        drawn.push({ name, x, y, scale: opts?.scale ?? 1 });
        return true;
      },
      drawImage: (_ctx: unknown, fig: { name: string }, x: number, y: number, opts?: { flip?: boolean }) => {
        figures.push({ name: fig.name, flip: !!opts?.flip, x, y });
        return true;
      },
    };
    const translates: { x: number; y: number }[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'translate' ? (x: number, y: number) => translates.push({ x, y }) : () => undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    drawGallery(ctx, art as never);
    expect(drawn.map((d) => d.name)).toEqual([...SPRITE_NAMES]);
    expect(SPRITE_NAMES).toHaveLength(14);
    for (const d of drawn) {
      expect(d.scale).toBe(3);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x + 48).toBeLessThanOrEqual(480);
      expect(d.y + 48).toBeLessThanOrEqual(360);
    }
    expect(figures).toHaveLength(99); // 14 images, 20 soldiers, 5 themes x 6 tile pieces, 5 themes x 2 props, then 5 themes x 5 wall variants
    expect(new Set(figures.map((f) => f.name)).size).toBe(93); // the base strip repeats the six base tile images
    expect(figures.slice(0, 14).map((f) => f.name)).toEqual([...IMAGE_NAMES].slice(0, 14));
    for (const f of figures.slice(34, 64)) { // the theme strips, drawn at 1x without translate: inside the canvas, above the sample text
      expect(f.x!).toBeGreaterThanOrEqual(0);
      expect(f.x! + 16).toBeLessThanOrEqual(480);
      expect(f.y! + 16).toBeLessThanOrEqual(352);
    }
    for (const f of figures.slice(64, 74)) { // the props: one row at y 362, above the wall variants
      expect(f.y).toBe(362);
      expect(f.x! + 16).toBeLessThanOrEqual(480);
    }
    for (const f of figures.slice(74)) { // the wall variants: one row at y 382, inside the 400-pixel canvas
      expect(f.y).toBe(382);
      expect(f.x! + 16).toBeLessThanOrEqual(480);
      expect(f.y! + 16).toBeLessThanOrEqual(400);
    }
    expect(translates).toHaveLength(34); // the strips use no translate
    for (const t of translates) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + 32).toBeLessThanOrEqual(480);
      expect(t.y + 64).toBeLessThanOrEqual(352); // above the sample text
    }
  });
});
