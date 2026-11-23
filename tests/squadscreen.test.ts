import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world/world';
import { SQUAD, drawSquad, squadHit } from '../src/screens/squad';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const fresh = () => newWorld(1, 'calm');

function runs(draw: (ctx: CanvasRenderingContext2D) => void): TextRun[] {
  const out: TextRun[] = [];
  const stop = onText((r) => out.push(r));
  draw(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D);
  stop();
  return out;
}
const left = (r: TextRun): number => (r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2));

describe('squad step hits', () => {
  it('hits a ready soldier\'s row, and the three buttons', () => {
    const w = fresh();
    expect(squadHit(centre(SQUAD.rows[1]).x, centre(SQUAD.rows[1]).y, w)).toEqual({ kind: 'soldier', name: 'Brandt' });
    expect(squadHit(centre(SQUAD.auto).x, centre(SQUAD.auto).y, w)).toEqual({ kind: 'auto' });
    expect(squadHit(centre(SQUAD.start).x, centre(SQUAD.start).y, w)).toEqual({ kind: 'start' });
    expect(squadHit(centre(SQUAD.back).x, centre(SQUAD.back).y, w)).toEqual({ kind: 'back' });
    expect(squadHit(centre(SQUAD.rows[9]).x, centre(SQUAD.rows[9]).y, w)).toBeNull(); // no soldier there
  });

  it('does not let a soldier in training or wounded be picked', () => {
    const w = { ...fresh(), soldiers: fresh().soldiers.map((s, i) => (i === 0 ? { ...s, status: 'training' as const, daysLeft: 2 } : s)) };
    expect(squadHit(centre(SQUAD.rows[0]).x, centre(SQUAD.rows[0]).y, w)).toBeNull();
  });

  it('keeps the rows and buttons apart and inside the screen', () => {
    const rects = [...SQUAD.rows, SQUAD.auto, SQUAD.start, SQUAD.back];
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(480);
      expect(r.y + r.h).toBeLessThanOrEqual(400);
    }
    for (const a of rects) for (const b of rects) {
      if (a === b) continue;
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
    }
    expect(SQUAD.rows).toHaveLength(12);
  });
});

describe('squad step drawing', () => {
  it('says how many mercenaries will be loaned', () => {
    const none = { ...fresh(), soldiers: [], squad: [] as string[] };
    expect(runs((ctx) => drawSquad(ctx, none, [])).map((r) => r.text)).toContain('LOANED: 4');
    const full = runs((ctx) => drawSquad(ctx, fresh(), ['Alvarez', 'Brandt', 'Chen', 'Dubois'])).map((r) => r.text);
    expect(full.some((t) => t.startsWith('LOANED'))).toBe(false);
  });

  it('draws a full barracks inside the screen with supported characters', () => {
    const pool = Array.from({ length: 12 }, (_, i) => ({
      name: `Lindqvist ${i + 2}`, kills: 9999, trained: 9999, status: (i % 2 ? 'ready' : 'wounded') as 'ready', daysLeft: i % 2 ? 0 : 3,
    }));
    const w = { ...fresh(), soldiers: pool, research: { done: ['beds1', 'beds2', 'beds3'], active: null } };
    for (const r of runs((ctx) => drawSquad(ctx, w, ['Lindqvist 3', 'Lindqvist 5']))) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(0);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(480);
    }
  });
});
