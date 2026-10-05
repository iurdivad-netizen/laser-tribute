import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../src/controller';
import { DEFAULT_LAYOUT, actionBlocked, actionCost, drawPanel, panelButtonAt } from '../src/render/panel';
import { Effects } from '../src/render/effects';
import { createUiState } from '../src/input/uiState';
import { onText } from '../src/ui/text';
import { corridorRows, makeState, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

function setup(rows = corridorRows('PP..E')) {
  const state = makeState(rows);
  return { state, c: new Controller(state, createUiState('p1'), new Effects()) };
}

describe('gadget button', () => {
  it('is one of the twelve panel buttons and is found by a tap on its centre', () => {
    const b = DEFAULT_LAYOUT.actions.find((x) => x.id === 'gadget')!;
    expect(panelButtonAt(DEFAULT_LAYOUT, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2)).toBe('gadget');
  });

  it('costs the gadget action, and is blocked without a usable gadget or AP', () => {
    const { state } = setup();
    const p = unit(state, 'p1');
    expect(actionCost(p, 'gadget')).toBeNull();
    expect(actionBlocked(p, 'gadget')).toBe(true);
    p.gadget = 'armour';
    expect(actionBlocked(p, 'gadget')).toBe(true);
    p.gadget = 'medkit';
    expect(actionCost(p, 'gadget')).toBe(12);
    expect(actionBlocked(p, 'gadget')).toBe(false);
    p.ap = 11;
    expect(actionBlocked(p, 'gadget')).toBe(true);
    p.gadget = 'scanner';
    p.ap = 10;
    expect(actionCost(p, 'gadget')).toBe(10);
    expect(actionBlocked(p, 'gadget')).toBe(false);
  });

  it('is labelled HEAL or SCAN for the gadgets, and the soldier line names the gadget', () => {
    for (const [gadget, label] of [['medkit', 'HEAL'], ['scanner', 'SCAN']] as const) {
      const { state } = setup();
      unit(state, 'p1').gadget = gadget;
      const texts: string[] = [];
      const stop = onText((r) => texts.push(r.text));
      const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
      drawPanel(ctx, state, createUiState('p1'), 0);
      stop();
      expect(texts.some((t) => t.endsWith(label)), label).toBe(true); // 'G HEAL' or just 'HEAL' when the key hint does not fit
      expect(texts.some((t) => t.toUpperCase().includes(gadget.toUpperCase()))).toBe(true);
    }
  });
});

describe('using gadgets from the controller', () => {
  it('G with a scanner scans at once and says how many enemies were found', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'scanner';
    c.key('g');
    expect(c.state.scanned).toEqual([{ x: 5, y: 1 }]);
    expect(c.ui.message).toMatch(/SCAN: 1 ENEMY NEARBY/i);
    expect(c.selected()!.gadget).toBeNull();
  });

  it('says so when nothing is nearby', () => {
    const { state, c } = setup(corridorRows('P' + '.'.repeat(12) + 'E'));
    unit(state, 'p1').gadget = 'scanner';
    c.key('g');
    expect(c.ui.message).toMatch(/NO ENEMIES NEARBY/i);
  });

  it('G with a medkit enters heal mode; clicking an adjacent wounded teammate heals them', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'medkit';
    unit(state, 'p2').hp = 20;
    c.key('g');
    expect(c.ui.mode).toBe('heal');
    c.clickTile({ x: 2, y: 1 });
    expect(unit(c.state, 'p2').hp).toBe(45);
    expect(c.ui.mode).toBe('move');
    expect(c.ui.message).toMatch(/HEALS/i);
  });

  it('clicking an enemy or empty tile in heal mode refuses, and Escape cancels the mode', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'medkit';
    c.key('g');
    c.clickTile({ x: 5, y: 1 });
    expect(c.ui.message).toMatch(/click a soldier/i);
    expect(unit(c.state, 'p1').gadget).toBe('medkit');
    c.key('g');
    c.key('Escape');
    expect(c.ui.mode).toBe('move');
  });

  it('G with armour or no gadget refuses and spends nothing', () => {
    const { state, c } = setup();
    c.key('g');
    expect(c.ui.message).toMatch(/no gadget to use/i);
    unit(state, 'p1').gadget = 'armour';
    c.key('g');
    expect(c.ui.message).toMatch(/no gadget to use/i);
    expect(c.selected()!.ap).toBe(60);
  });
});

describe('heal mode and selection', () => {
  it('changing the selected soldier cancels heal mode, so no stale "Heal: null AP"', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'medkit';
    c.key('g');
    expect(c.ui.mode).toBe('heal');
    c.key('2');
    expect(c.ui.mode).toBe('move');
    c.key('1');
    c.key('g');
    c.key('Tab');
    expect(c.ui.mode).toBe('move');
  });

  it('the status line never prints a null cost', () => {
    const { state } = setup();
    const ui = createUiState('p2'); // p2 has no gadget
    ui.mode = 'heal';
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawPanel(ctx, state, ui, 0);
    stop();
    expect(texts.some((t) => t.includes('null'))).toBe(false);
  });
});
