import { describe, expect, it } from 'vitest';
import { drawGallery } from '../src/art/gallery';
import { IMAGE_NAMES } from '../scripts/figures-lib.mjs';
import { SPRITE_NAMES } from '../src/art/sprites';

describe('drawGallery', () => {
  it('draws every sprite once, enlarged three times, then the eleven images and the twenty soldiers, inside the canvas', () => {
    const drawn: { name: string; x: number; y: number; scale: number }[] = [];
    const figures: { name: string; flip: boolean }[] = [];
    const art = {
      draw: (_ctx: unknown, name: string, x: number, y: number, opts?: { scale?: number }) => {
        drawn.push({ name, x, y, scale: opts?.scale ?? 1 });
        return true;
      },
      drawImage: (_ctx: unknown, fig: { name: string }, _x: number, _y: number, opts?: { flip?: boolean }) => {
        figures.push({ name: fig.name, flip: !!opts?.flip });
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
    expect(SPRITE_NAMES).toHaveLength(10);
    for (const d of drawn) {
      expect(d.scale).toBe(3);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x + 48).toBeLessThanOrEqual(480);
      expect(d.y + 48).toBeLessThanOrEqual(360);
    }
    expect(figures).toHaveLength(31); // 11 images, then 5 views x 2 sides x 2 weapons
    expect(new Set(figures.map((f) => f.name)).size).toBe(31);
    expect(figures.slice(0, 11).map((f) => f.name)).toEqual([...IMAGE_NAMES]);
    expect(translates).toHaveLength(31);
    for (const t of translates) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + 32).toBeLessThanOrEqual(480);
      expect(t.y + 64).toBeLessThanOrEqual(352); // above the sample text
    }
  });
});
