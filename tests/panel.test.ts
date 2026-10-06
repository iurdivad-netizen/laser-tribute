import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { DEFAULT_LAYOUT, actionBlocked, actionCost, drawPanel, panelButtonAt } from '../src/render/panel';
import { createUiState } from '../src/input/uiState';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';
import { corridorRows, makeState, unit } from './helpers';

const left = (r: TextRun): number =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

function runsOf(draw: (ctx: CanvasRenderingContext2D) => void): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  stop();
  return runs;
}

describe('panel buttons on the default 480x400 layout', () => {
  it('has twelve buttons in the agreed order, each label fitting its button, none overlapping', () => {
    const L = DEFAULT_LAYOUT;
    expect(L.actions.map((b) => b.id)).toEqual(
      ['snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'gadget', 'turn', 'zoom', 'end'],
    );
    for (const b of L.actions) {
      expect(b.rect.x).toBeGreaterThanOrEqual(0);
      expect(b.rect.x + b.rect.w).toBeLessThanOrEqual(L.width);
      expect(b.rect.y).toBeGreaterThanOrEqual(L.panel.y);
      expect(b.rect.y + b.rect.h).toBeLessThanOrEqual(L.height);
      expect(textWidth(b.label) * L.text + 6, b.id).toBeLessThanOrEqual(b.rect.w);
    }
    for (let i = 0; i < L.actions.length; i++) {
      for (let j = i + 1; j < L.actions.length; j++) {
        const a = L.actions[i].rect;
        const c = L.actions[j].rect;
        expect(a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h, `${L.actions[i].id} overlaps ${L.actions[j].id}`).toBe(false);
      }
    }
  });

  it('draws only text the pixel font supports, inside the window, with no two texts overlapping', () => {
    const s = makeState(corridorRows('P..E'));
    const ui = createUiState('p1');
    ui.message = 'Alvarez on alert: fires at enemies that move';
    ui.messageUntil = Infinity;
    const runs = runsOf((ctx) => drawPanel(ctx, s, ui, 0));
    expect(runs.length).toBeGreaterThan(0);
    const scale = DEFAULT_LAYOUT.text;
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(0);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(DEFAULT_LAYOUT.width);
      expect(r.y + 7 * scale, r.text).toBeLessThanOrEqual(DEFAULT_LAYOUT.height);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i];
        const b = runs[j];
        const overlap = left(a) < left(b) + b.width && left(b) < left(a) + a.width && a.y < b.y + 7 * scale && b.y < a.y + 7 * scale;
        expect(overlap, `"${a.text}" overlaps "${b.text}"`).toBe(false);
      }
    }
  });

  it('hit-tests every button by its centre', () => {
    for (const b of DEFAULT_LAYOUT.actions) {
      expect(panelButtonAt(DEFAULT_LAYOUT, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2)).toBe(b.id);
    }
    expect(panelButtonAt(DEFAULT_LAYOUT, 10, 10)).toBeNull();
  });

  it('shows the knife AP cost', () => {
    const s = makeState(corridorRows('P.E'));
    expect(actionCost(unit(s, 'p1'), 'stab')).toBe(CONFIG.knife.apCost);
    expect(CONFIG.knife.apCost).toBe(20);
  });

  it('the turn button costs the turn price per 45 degrees and is blocked without that AP; zoom is never blocked', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    expect(actionCost(p, 'turn')).toBe(CONFIG.turnCostPer45);
    expect(actionBlocked(p, 'turn')).toBe(false);
    p.ap = 0;
    expect(actionBlocked(p, 'turn')).toBe(true);
    expect(actionBlocked(p, 'zoom')).toBe(false);
  });
});
