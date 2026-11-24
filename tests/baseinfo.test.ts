import { describe, expect, it } from 'vitest';
import { buildingInfo, type InfoId } from '../src/core/world/buildinginfo';
import { soldierStats } from '../src/core/world/soldierinfo';
import { newWorld, type World } from '../src/core/world/world';
import { CARD, INFO_BOX, drawInfoBox, drawSoldierCard } from '../src/screens/baseinfo';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

interface Call { name: string; args: unknown[]; fill: string }

function record(draw: (ctx: CanvasRenderingContext2D) => void) {
  const runs: TextRun[] = [];
  const calls: Call[] = [];
  const state: Record<string, unknown> = { fillStyle: '' };
  const ctx = new Proxy({}, {
    get: (_t, name: string) => (name in state ? state[name] : (...args: unknown[]) => { calls.push({ name, args, fill: String(state.fillStyle) }); }),
    set: (_t, name: string, value) => { state[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const stop = onText((r) => runs.push(r));
  draw(ctx);
  stop();
  return { runs, calls, texts: runs.map((r) => r.text) };
}
const left = (r: TextRun): number => (r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2));
const inside = (r: { x: number; y: number; w: number; h: number }, o: { x: number; y: number; w: number; h: number }) =>
  o.x >= r.x && o.y >= r.y && o.x + o.w <= r.x + r.w && o.y + o.h <= r.y + r.h;
const IDS: InfoId[] = ['lab', 'market', 'barracks', 'training', 'hospital', 'wait'];
const rich = (): World => ({ ...newWorld(1, 'calm'), research: { done: ['training3', 'hospital2', 'labs2', 'beds3'], active: null } });

describe('the card and box rectangles', () => {
  it('are inside the screen, with BACK inside its box and big enough to hit', () => {
    for (const b of [CARD, INFO_BOX]) {
      expect(b.box.x).toBeGreaterThanOrEqual(0);
      expect(b.box.y).toBeGreaterThanOrEqual(0);
      expect(b.box.x + b.box.w).toBeLessThanOrEqual(480);
      expect(b.box.y + b.box.h).toBeLessThanOrEqual(400);
      expect(inside(b.box, b.back)).toBe(true);
      expect(b.back.w).toBeGreaterThanOrEqual(70);
      expect(b.back.h).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('drawSoldierCard', () => {
  it('draws the name, every row, the note and BACK, over a dimmed screen', () => {
    const w = rich();
    const stats = soldierStats({ name: 'Alvarez', kills: 6, trained: 1, status: 'ready', daysLeft: 0 }, w);
    const { texts, calls } = record((ctx) => drawSoldierCard(ctx, stats));
    expect(calls[0].name).toBe('fillRect');
    expect(calls[0].fill).toMatch(/^rgba\(0,\s*0,\s*0,/);
    expect(texts).toContain('Alvarez');
    for (const [label, value] of stats.rows) {
      expect(texts, label).toContain(label);
      expect(texts, label).toContain(value);
    }
    expect(texts).toContain(stats.note);
    expect(texts).toContain('BACK');
  });

  it('keeps a long name with huge numbers inside the screen, in supported characters', () => {
    const w = rich();
    const stats = soldierStats({ name: 'Lindqvist 12', kills: 9999, trained: 9999, status: 'wounded', daysLeft: 30 }, w);
    const { runs } = record((ctx) => drawSoldierCard(ctx, stats));
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(CARD.box.x);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(CARD.box.x + CARD.box.w);
    }
  });
});

describe('drawInfoBox', () => {
  it('draws the title, at most 8 rows of text and BACK for every building, inside the box', () => {
    for (const w of [newWorld(1, 'calm'), rich()]) {
      for (const id of IDS) {
        const info = buildingInfo(id, w);
        const { runs, texts } = record((ctx) => drawInfoBox(ctx, info));
        expect(texts, id).toContain(info.title);
        expect(texts, id).toContain('BACK');
        const body = runs.filter((r) => r.text !== info.title && r.text !== 'BACK');
        expect(body.length, id).toBeGreaterThanOrEqual(info.lines.length);
        expect(body.length, id).toBeLessThanOrEqual(8);
        expect(body.map((r) => r.text).join(' ').replace(/\s+/g, ' ')).toBe(info.lines.join(' '));
        for (const r of runs) {
          expect(unsupportedChars(r.text), r.text).toEqual([]);
          expect(left(r), r.text).toBeGreaterThanOrEqual(INFO_BOX.box.x);
          expect(left(r) + r.width, r.text).toBeLessThanOrEqual(INFO_BOX.box.x + INFO_BOX.box.w);
        }
      }
    }
  });
});
