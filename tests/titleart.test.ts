import { describe, expect, it } from 'vitest';
import { drawScene } from '../src/screens/titleart';

interface Fill { style: string; x: number; y: number; w: number; h: number }

function record(opts: { soldiers: number; bleed: boolean }, r = { x: 20, y: 10, w: 200, h: 120 }): Fill[] {
  const fills: Fill[] = [];
  let style = '';
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === 'fillStyle' ? style : k === 'fillRect'
      ? (x: number, y: number, w: number, h: number) => fills.push({ style, x, y, w, h })
      : () => undefined),
    set: (_t, k, v) => { if (k === 'fillStyle') style = String(v); return true; },
  }) as unknown as CanvasRenderingContext2D;
  drawScene(ctx, r, opts);
  return fills;
}

describe('the title scene', () => {
  it('draws the same picture every time', () => {
    expect(record({ soldiers: 3, bleed: false })).toEqual(record({ soldiers: 3, bleed: false }));
  });

  it('stays inside its rectangle unless the sky and ground are asked to run on', () => {
    const r = { x: 20, y: 10, w: 200, h: 120 };
    for (const f of record({ soldiers: 2, bleed: false }, r)) {
      expect(f.w, JSON.stringify(f)).toBeGreaterThan(0);
      expect(f.x, JSON.stringify(f)).toBeGreaterThanOrEqual(r.x);
      expect(f.x + f.w, JSON.stringify(f)).toBeLessThanOrEqual(r.x + r.w);
      expect(f.y, JSON.stringify(f)).toBeGreaterThanOrEqual(r.y - 12); // an aerial may poke above the skyline
      expect(f.y + f.h, JSON.stringify(f)).toBeLessThanOrEqual(r.y + r.h);
    }
  });

  it('with bleed, the sky reaches past every edge of the window', () => {
    const fills = record({ soldiers: 0, bleed: true }, { x: 0, y: 0, w: 480, h: 400 });
    expect(Math.min(...fills.map((f) => f.x))).toBeLessThan(-400);
    expect(Math.max(...fills.map((f) => f.x + f.w))).toBeGreaterThan(880);
    expect(Math.min(...fills.map((f) => f.y))).toBeLessThan(-400);
    expect(Math.max(...fills.map((f) => f.y + f.h))).toBeGreaterThan(800);
  });

  it('has stars, lit windows and a red laser fence', () => {
    const styles = new Set(record({ soldiers: 0, bleed: false }).map((f) => f.style));
    for (const s of ['#ffffff', '#ffd070', '#ff5a5a']) expect(styles.has(s), s).toBe(true);
  });
});
