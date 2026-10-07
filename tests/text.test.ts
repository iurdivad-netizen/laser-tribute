import { describe, expect, it } from 'vitest';
import type { CanvasLike } from '../src/art/atlas';
import { GLYPHS, textWidth } from '../src/ui/font';
import { FontAtlas, clipText, drawText, onText } from '../src/ui/text';

interface Op { colour: string; x: number; y: number }

class FakeCanvas implements CanvasLike {
  ops: Op[] = [];
  constructor(public width: number, public height: number) {}
  getContext() {
    const canvas = this;
    let colour = '';
    return {
      set fillStyle(v: unknown) { colour = String(v); },
      get fillStyle() { return colour; },
      fillRect(x: number, y: number) { canvas.ops.push({ colour, x, y }); },
    };
  }
}

function makeFont() {
  const canvases: FakeCanvas[] = [];
  const atlas = new FontAtlas((w, h) => {
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

describe('FontAtlas', () => {
  it('bakes a glyph once per colour, one pixel per lit cell', () => {
    const { atlas, canvases } = makeFont();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'AA', 0, 0, '#fff');
    expect(canvases).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const lit = GLYPHS.A.join('').replace(/\./g, '').length;
    expect(canvases[0].ops).toHaveLength(lit);
    expect(canvases[0].ops.every((o) => o.colour === '#fff')).toBe(true);
    atlas.draw(ctx, 'A', 0, 0, '#f00');
    expect(canvases).toHaveLength(2);
  });

  it('treats lower case as the same glyph as the capital', () => {
    const { atlas, canvases } = makeFont();
    const { ctx } = fakeCtx();
    atlas.draw(ctx, 'aA', 0, 0, '#fff');
    expect(canvases).toHaveLength(1);
  });

  it('places each character 6 pixels after the last and skips spaces', () => {
    const { atlas, canvases } = makeFont();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'A B', 10, 20, '#fff');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([canvases[0], 10, 20]);
    expect(calls[1][1]).toBe(10 + 2 * 6);
    expect(calls[1][2]).toBe(20);
  });

  it('aligns right text to end at x and centred text around x', () => {
    const { atlas } = makeFont();
    const right = fakeCtx();
    atlas.draw(right.ctx, 'AB', 100, 0, '#fff', 'right');
    expect(right.calls[0][1]).toBe(100 - textWidth('AB'));
    const centre = fakeCtx();
    atlas.draw(centre.ctx, 'AB', 100, 0, '#fff', 'center');
    expect(centre.calls[0][1]).toBe(100 - Math.floor(textWidth('AB') / 2));
  });

  it('draws nothing and does not throw when there is no canvas', () => {
    const atlas = new FontAtlas(() => null);
    const { ctx, calls } = fakeCtx();
    expect(atlas.draw(ctx, 'HELLO', 0, 0, '#fff')).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('draws a visible box for an unsupported character', () => {
    const { atlas, canvases } = makeFont();
    const { ctx, calls } = fakeCtx();
    atlas.draw(ctx, 'é', 0, 0, '#fff');
    expect(calls).toHaveLength(1);
    expect(canvases[0].ops.length).toBe(20); // the 7x5 outline has 20 lit cells
  });
});

describe('drawText and the text listener', () => {
  it('reports every call with its original text, position, colour, alignment and width', () => {
    const runs: unknown[] = [];
    const stop = onText((r) => runs.push(r));
    const { ctx } = fakeCtx();
    drawText(ctx, 'Need 24 AP', 5, 6, '#abc', 'right');
    stop();
    drawText(ctx, 'after', 0, 0, '#fff');
    expect(runs).toEqual([{ text: 'Need 24 AP', x: 5, y: 6, colour: '#abc', align: 'right', width: textWidth('Need 24 AP'), scale: 1 }]);
  });
});

describe('clipText', () => {
  it('leaves text that fits unchanged', () => {
    expect(clipText('SHORT', 100)).toBe('SHORT');
    expect(clipText('', 0)).toBe('');
  });

  it('shortens too-long text so it ends in ... and fits', () => {
    const out = clipText('ALVAREZ, BRANDT, CHEN, DUBOIS, ERIKSEN', 100);
    expect(out.endsWith('...')).toBe(true);
    expect(textWidth(out)).toBeLessThanOrEqual(100);
    expect(out.length).toBeGreaterThan(4);
  });

  it('never exceeds the width, for any width', () => {
    const text = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
    for (let w = 0; w <= 260; w++) expect(textWidth(clipText(text, w)), `width ${w}`).toBeLessThanOrEqual(w);
  });

  it('does not leave a space before the dots', () => {
    expect(clipText('AAAA BBBB', 47)).toBe('AAAA...'); // "AAAA ..." would fit, but looks wrong
  });

  it('gives the longest prefix that fits with the dots', () => {
    expect(clipText('ABCDEFGHIJKLMNOP', 60)).toBe('ABCDEFG...'); // 10 characters = 59 px; one more would be 65
  });
});
