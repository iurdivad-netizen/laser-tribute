import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { PANEL_BUTTONS, actionCost, buttonAt, drawPanel } from '../src/render/panel';
import { createUiState } from '../src/input/uiState';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';
import { VIEW } from '../src/render/layout';
import { corridorRows, makeState, unit } from './helpers';

describe('panel buttons', () => {
  it('has ten buttons in the same order, each label and cost fitting its button, none overlapping', () => {
    expect(PANEL_BUTTONS.map((b) => b.id)).toEqual(
      ['snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'gadget', 'end'],
    );
    for (const b of PANEL_BUTTONS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(VIEW.width);
      expect(b.y).toBeGreaterThanOrEqual(VIEW.mapHeight);
      expect(b.y + b.h).toBeLessThanOrEqual(VIEW.height);
      expect(textWidth(`${b.key} ${b.label}`) + 6, b.id).toBeLessThanOrEqual(b.w); // drawn 3 px from the left edge, so 3 px are left on the right
      expect(textWidth('15 AP') + 4, b.id).toBeLessThanOrEqual(b.w);
    }
    for (let i = 0; i < PANEL_BUTTONS.length; i++) {
      for (let j = i + 1; j < PANEL_BUTTONS.length; j++) {
        const a = PANEL_BUTTONS[i];
        const c = PANEL_BUTTONS[j];
        const overlap = a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${c.id}`).toBe(false);
      }
    }
  });

  it('has the agreed geometry: five buttons on each row, below the map', () => {
    expect(VIEW).toEqual({ width: 480, height: 400, mapHeight: 320 });
    const row = (n: number) => PANEL_BUTTONS.slice(n === 1 ? 0 : 5, n === 1 ? 5 : 10);
    expect(row(1).map((b) => [b.x, b.y, b.w, b.h])).toEqual([
      [156, 348, 60, 22], [220, 348, 60, 22], [284, 348, 60, 22], [348, 348, 60, 22], [412, 348, 60, 22],
    ]);
    expect(row(2).map((b) => [b.x, b.y, b.w, b.h])).toEqual([
      [156, 372, 48, 22], [208, 372, 48, 22], [260, 372, 52, 22], [316, 372, 56, 22], [376, 372, 78, 22],
    ]);
  });

  it('draws only text the pixel font supports, and no two texts overlap', () => {
    const s = makeState(corridorRows('P..E'));
    const ui = createUiState('p1');
    ui.message = 'Alvarez on alert: fires once at each enemy that moves into view';
    ui.messageUntil = Infinity;
    const runs: { text: string; x: number; y: number; width: number }[] = [];
    const stop = onText((r) => runs.push(r));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawPanel(ctx, s, ui, 0);
    stop();
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(r.x + r.width, r.text).toBeLessThanOrEqual(VIEW.width);
      expect(r.y + 7, r.text).toBeLessThanOrEqual(VIEW.height);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i];
        const b = runs[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + 7 && b.y < a.y + 7;
        expect(overlap, `"${a.text}" overlaps "${b.text}"`).toBe(false);
      }
    }
    const message = runs.find((r) => r.text.endsWith('...'))!;
    expect(message.width).toBeLessThanOrEqual(320);
  });

  it('hit-tests every button by its centre', () => {
    for (const b of PANEL_BUTTONS) {
      expect(buttonAt(b.x + b.w / 2, b.y + b.h / 2)).toBe(b.id);
    }
    expect(buttonAt(10, 10)).toBeNull();
  });

  it('shows the knife AP cost', () => {
    const s = makeState(corridorRows('P.E'));
    expect(actionCost(unit(s, 'p1'), 'stab')).toBe(CONFIG.knife.apCost);
    expect(CONFIG.knife.apCost).toBe(20);
  });
});
