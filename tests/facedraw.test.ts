import { afterEach, describe, expect, it, vi } from 'vitest';
import { newWorld, type World } from '../src/core/world/world';
import { PANEL, drawPanel } from '../src/screens/basepanels';
import { fakeDocument } from './helpers';
import { unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

interface Call { name: string; args: unknown[] }
function recorder() {
  const calls: Call[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name: string) => (...args: unknown[]) => { calls.push({ name, args }); },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
const images = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');

function textRuns(draw: (ctx: CanvasRenderingContext2D) => void) {
  const out: { text: string; x: number; width: number; align: string }[] = [];
  const stop = onText((r) => out.push(r));
  draw(recorder().ctx);
  stop();
  return out;
}

describe('the barracks list', () => {
  afterEach(() => vi.unstubAllGlobals());
  const rowsOf = () => PANEL.rows;

  it('draws no face and keeps the label in place with no canvas, and for the other panels', () => {
    const w = newWorld(1, 'calm');
    const none = textRuns((ctx) => drawPanel(ctx, 'barracks', w, null, 0, ''));
    expect(none.some((t) => t.align === 'left' && t.x === rowsOf()[0].x + 8)).toBe(true);
    for (const id of ['lab', 'market', 'training', 'hospital', 'wait'] as const) {
      const { ctx, calls } = recorder();
      drawPanel(ctx, id, w, null, 0, '');
      expect(images(calls), id).toHaveLength(0);
    }
  });

  it('keeps a full barracks, faces and all, inside the screen in supported characters', () => {
    vi.stubGlobal('document', fakeDocument());
    const pool = Array.from({ length: 12 }, (_, i) => ({
      name: `Lindqvist ${i + 2}`, kills: 9999, trained: 9999, status: (i % 2 ? 'ready' : 'wounded') as 'ready', daysLeft: i % 2 ? 0 : 3,
    }));
    const w = { ...newWorld(1, 'calm'), soldiers: pool, research: { done: ['beds1', 'beds2', 'beds3'], active: null } };
    for (const r of textRuns((ctx) => drawPanel(ctx, 'barracks', w, null, 0, ''))) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      const left = r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);
      expect(left, r.text).toBeGreaterThanOrEqual(0);
      expect(left + r.width, r.text).toBeLessThanOrEqual(480);
    }
  });
});
