import { describe, expect, it } from 'vitest';
import { UI, drawButton, drawFrame } from '../src/ui/frame';
import { onText } from '../src/ui/text';

interface Fill { colour: string; x: number; y: number; w: number; h: number }

function recorder() {
  const fills: Fill[] = [];
  let colour = '';
  const ctx = {
    set fillStyle(v: string) { colour = v; },
    fillRect(x: number, y: number, w: number, h: number) { fills.push({ colour, x, y, w, h }); },
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

describe('drawFrame', () => {
  it('a raised frame is a navy body, a light top-left edge and a dark bottom-right edge, 2 px thick', () => {
    const { ctx, fills } = recorder();
    drawFrame(ctx, 10, 20, 100, 30, 'raised');
    expect(fills[0]).toEqual({ colour: UI.fill, x: 10, y: 20, w: 100, h: 30 });
    expect(fills).toContainEqual({ colour: UI.light, x: 10, y: 20, w: 100, h: 2 });
    expect(fills).toContainEqual({ colour: UI.light, x: 10, y: 20, w: 2, h: 30 });
    expect(fills).toContainEqual({ colour: UI.dark, x: 10, y: 48, w: 100, h: 2 });
    expect(fills).toContainEqual({ colour: UI.dark, x: 108, y: 20, w: 2, h: 30 });
  });

  it('a pressed or inset frame swaps the edges and darkens the body', () => {
    for (const style of ['pressed', 'inset'] as const) {
      const { ctx, fills } = recorder();
      drawFrame(ctx, 0, 0, 40, 20, style);
      expect(fills[0].colour).toBe(UI.fillDark);
      expect(fills).toContainEqual({ colour: UI.dark, x: 0, y: 0, w: 40, h: 2 });
      expect(fills).toContainEqual({ colour: UI.light, x: 0, y: 18, w: 40, h: 2 });
    }
  });

  it('a hover frame has a brighter body, and a disabled frame has no light edge', () => {
    const hover = recorder();
    drawFrame(hover.ctx, 0, 0, 40, 20, 'hover');
    expect(hover.fills[0].colour).toBe(UI.fillHi);
    const off = recorder();
    drawFrame(off.ctx, 0, 0, 40, 20, 'disabled');
    expect(off.fills.some((f) => f.colour === UI.light)).toBe(false);
  });
});

describe('drawButton', () => {
  it('draws a frame and the label centred, in a colour that depends on the state', () => {
    const runs: { text: string; x: number; y: number; colour: string; align: string }[] = [];
    const stop = onText((r) => runs.push(r));
    const { ctx } = recorder();
    drawButton(ctx, { x: 100, y: 50, w: 60, h: 20 }, 'SNAP', 'raised');
    drawButton(ctx, { x: 100, y: 50, w: 60, h: 20 }, 'SNAP', 'disabled');
    drawButton(ctx, { x: 100, y: 50, w: 60, h: 20 }, 'SNAP', 'pressed');
    stop();
    expect(runs[0]).toMatchObject({ text: 'SNAP', x: 130, y: 56, align: 'center', colour: UI.text });
    expect(runs[1].colour).toBe(UI.disabledText);
    expect(runs[2].colour).toBe(UI.accent);
  });
});
