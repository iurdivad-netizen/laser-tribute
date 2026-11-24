import { describe, expect, it } from 'vitest';
import { defaultLoadout } from '../src/core/loadout';
import { ALL_ITEMS, itemCard } from '../src/core/world/iteminfo';
import { newWorld } from '../src/core/world/world';
import { ITEM_CARD, drawItemCard } from '../src/screens/baseinfo';
import { drawEquipment, DEFAULT_VIEW } from '../src/screens/equipment';
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

describe('the item card rectangles', () => {
  it('are inside the screen, with BACK inside the box and big enough to hit', () => {
    const b = ITEM_CARD;
    expect(b.box.x).toBeGreaterThanOrEqual(0);
    expect(b.box.y).toBeGreaterThanOrEqual(0);
    expect(b.box.x + b.box.w).toBeLessThanOrEqual(480);
    expect(b.box.y + b.box.h).toBeLessThanOrEqual(400);
    expect(inside(b.box, b.back)).toBe(true);
    expect(b.back.w).toBeGreaterThanOrEqual(70);
    expect(b.back.h).toBeGreaterThanOrEqual(24);
  });
});

describe('drawItemCard', () => {
  it('draws the title, every row, the good-for line (at most 3 rows) and BACK for every item, over a dimmed screen', () => {
    for (const w of [null, newWorld(1, 'calm')]) {
      for (const ref of ALL_ITEMS) {
        const card = itemCard(ref, w);
        const name = JSON.stringify(ref);
        const { runs, texts, calls } = record((ctx) => drawItemCard(ctx, card));
        expect(calls[0].name, name).toBe('fillRect');
        expect(calls[0].fill, name).toMatch(/^rgba\(0,\s*0,\s*0,/);
        expect(texts, name).toContain(card.title);
        for (const [label, value] of card.rows) {
          expect(texts, `${name} ${label}`).toContain(label);
          expect(texts, `${name} ${label}`).toContain(value);
        }
        expect(texts, name).toContain('BACK');
        const good = runs.filter((r) => !card.rows.some(([l, v]) => r.text === l || r.text === v) && r.text !== card.title && r.text !== 'BACK');
        expect(good.length, name).toBeGreaterThanOrEqual(1);
        expect(good.length, name).toBeLessThanOrEqual(3);
        expect(good.map((r) => r.text).join(' ')).toBe(card.goodFor);
        for (const r of runs) {
          expect(unsupportedChars(r.text), `${name} ${r.text}`).toEqual([]);
          expect(left(r), `${name} ${r.text}`).toBeGreaterThanOrEqual(ITEM_CARD.box.x);
          expect(left(r) + r.width, `${name} ${r.text}`).toBeLessThanOrEqual(ITEM_CARD.box.x + ITEM_CARD.box.w);
        }
      }
    }
  });
});

describe('the equipment screen ? buttons', () => {
  const kit = defaultLoadout().map((s, i) => (i === 0 ? { ...s, gadget: 'scanner' as const } : s));

  it('draw a ? for each weapon, grenade and scope button and for a chosen gadget when asked', () => {
    const { texts } = record((ctx) => drawEquipment(ctx, kit, null, { ...DEFAULT_VIEW, infoButtons: true }));
    expect(texts.filter((t) => t === '?')).toHaveLength(4 * 3 + 1);
  });

  it('draw none by default, and the default screen is unchanged', () => {
    const plain = record((ctx) => drawEquipment(ctx, kit, null, DEFAULT_VIEW));
    expect(plain.texts).not.toContain('?');
    const off = record((ctx) => drawEquipment(ctx, kit, null, { ...DEFAULT_VIEW, infoButtons: false }));
    expect(off.runs.map((r) => [r.text, r.x, r.y])).toEqual(plain.runs.map((r) => [r.text, r.x, r.y]));
    // the labels stay at x 190 without the ? buttons
    expect(plain.runs.find((r) => r.text === 'Grenades')?.x).toBe(190);
    expect(record((ctx) => drawEquipment(ctx, kit, null, { ...DEFAULT_VIEW, infoButtons: true })).runs.find((r) => r.text === 'Grenades')?.x).toBe(196);
  });
});
