import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { PANEL_BUTTONS, actionCost, buttonAt } from '../src/render/panel';
import { VIEW } from '../src/render/layout';
import { corridorRows, makeState, unit } from './helpers';

describe('panel buttons', () => {
  it('has nine buttons including STAB and LOAD, all inside the panel, not overlapping, labels short', () => {
    expect(PANEL_BUTTONS.map((b) => b.id)).toEqual(
      ['snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'end'],
    );
    for (const b of PANEL_BUTTONS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(VIEW.width);
      expect(b.y + b.h).toBeLessThanOrEqual(VIEW.height);
      expect(`${b.key} ${b.label}`.length).toBeLessThanOrEqual(6);
    }
    for (let i = 1; i < PANEL_BUTTONS.length; i++) {
      const prev = PANEL_BUTTONS[i - 1];
      expect(PANEL_BUTTONS[i].x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
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
