import { describe, expect, it } from 'vitest';
import { drawGallery } from '../src/art/gallery';
import { SPRITE_NAMES } from '../src/art/sprites';

describe('drawGallery', () => {
  it('draws every sprite once, enlarged three times, inside the canvas', () => {
    const drawn: { name: string; x: number; y: number; scale: number }[] = [];
    const art = {
      draw: (_ctx: unknown, name: string, x: number, y: number, opts?: { scale?: number }) => {
        drawn.push({ name, x, y, scale: opts?.scale ?? 1 });
        return true;
      },
    };
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawGallery(ctx, art as never);
    expect(drawn.map((d) => d.name)).toEqual([...SPRITE_NAMES]);
    for (const d of drawn) {
      expect(d.scale).toBe(3);
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x + 48).toBeLessThanOrEqual(480);
      expect(d.y + 48).toBeLessThanOrEqual(360);
    }
  });
});
