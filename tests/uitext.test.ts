import { describe, expect, it } from 'vitest';
import type { CanvasLike } from '../src/art/atlas';
import { textWidth } from '../src/ui/font';
import { FontAtlas, drawText, onText, scaledWidth } from '../src/ui/text';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}

describe('scaled text', () => {
  it('scaledWidth is the unscaled width times the scale', () => {
    expect(scaledWidth('ABC', 1)).toBe(textWidth('ABC'));
    expect(scaledWidth('ABC', 3)).toBe(textWidth('ABC') * 3);
  });

  it('onText reports the scaled width', () => {
    const runs: number[] = [];
    const stop = onText((r) => runs.push(r.width));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawText(ctx, 'AB', 0, 0, '#fff', 'left', undefined, 2);
    stop();
    expect(runs).toEqual([textWidth('AB') * 2]);
  });

  it('draws each glyph at the scale: size and spacing multiply, and a glyph is still baked once', () => {
    let baked = 0;
    const atlas = new FontAtlas((w, h) => { baked += 1; return new FakeCanvas(w, h); });
    const calls: number[][] = [];
    const ctx = { drawImage: (_g: unknown, x: number, y: number, w?: number, h?: number) => calls.push([x, y, w ?? -1, h ?? -1]) } as unknown as CanvasRenderingContext2D;
    atlas.draw(ctx, 'AA', 10, 20, '#fff', 'left', 2);
    expect(calls).toHaveLength(2);
    expect(calls[0].slice(2)).toEqual([10, 14]); // 5x7 glyph at scale 2
    expect(calls[1][0] - calls[0][0]).toBe(12); // advance 6 at scale 2
    expect(baked).toBe(1);
  });

  it('right alignment uses the scaled width', () => {
    const calls: number[] = [];
    const ctx = { drawImage: (_g: unknown, x: number) => calls.push(x) } as unknown as CanvasRenderingContext2D;
    const atlas = new FontAtlas((w, h) => new FakeCanvas(w, h));
    atlas.draw(ctx, 'AB', 100, 0, '#fff', 'right', 2);
    expect(calls[0]).toBe(100 - textWidth('AB') * 2);
  });
});
