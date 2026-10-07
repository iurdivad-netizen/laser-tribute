import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { createMission } from '../src/core/missions';
import { shotLine, shotPreview } from '../src/core/stats';
import { createUiState, type UiState } from '../src/input/uiState';
import { drawCard } from '../src/render/card';
import { DEFAULT_LAYOUT, detailHit, drawPanel } from '../src/render/panel';
import { unsupportedChars } from '../src/ui/font';
import { computeLayout, type Layout } from '../src/ui/layout';
import { onText, type TextRun } from '../src/ui/text';
import { corridorRows, makeState, unit } from './helpers';

const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

function texts(draw: () => void): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  draw();
  stop();
  return runs;
}

function aiming() {
  const state = makeState(corridorRows('P..E'));
  const p = unit(state, 'p1');
  p.facing = 2;
  const ui = createUiState('p1');
  ui.mode = 'snap';
  ui.hover = { ...unit(state, 'e1').pos };
  return { state, p, ui };
}

const panelTexts = (state: ReturnType<typeof makeState>, ui: UiState, now = 0) => texts(() => drawPanel(ctx, state, ui, now)).map((r) => r.text);

describe('the detail line', () => {
  it('shows the weapon damage and accuracy of the selected soldier when the line has room', () => {
    const { state, ui } = aiming();
    ui.mode = 'move';
    const wide = computeLayout(1366, 768, 1);
    const line = texts(() => drawPanel(ctx, state, ui, 0, wide)).map((r) => r.text).find((t) => t.includes('RIFLE'))!;
    expect(line).toContain('DMG 30 ACC 50/85');
  });

  it('keeps the scope tag over the weapon numbers when the line is short', () => {
    const { state, ui } = aiming();
    ui.mode = 'move';
    unit(state, 'p1').attachment = 'scope';
    const line = panelTexts(state, ui).find((t) => t.includes('RIFLE'))!;
    expect(line).toContain('SCOPE');
    expect(line).not.toContain('DMG');
  });
});

describe('the status line while aiming', () => {
  it('shows the hit chance, damage and crit of the hovered visible enemy', () => {
    const { state, p, ui } = aiming();
    const want = shotLine(shotPreview(state, p, unit(state, 'e1'), 'snap'));
    expect(panelTexts(state, ui)).toContain(want);
    ui.mode = 'aimed';
    expect(panelTexts(state, ui)).toContain(shotLine(shotPreview(state, p, unit(state, 'e1'), 'aimed')));
  });

  it('wins over the mode hint but not over a real message', () => {
    const { state, p, ui } = aiming();
    const want = shotLine(shotPreview(state, p, unit(state, 'e1'), 'snap'));
    ui.message = 'Snap shot, 15 AP: click an enemy';
    ui.messageUntil = 5000;
    ui.messageIsHint = true;
    expect(panelTexts(state, ui, 100)).toContain(want);
    ui.message = 'Out of ammo';
    ui.messageIsHint = false;
    const shown = panelTexts(state, ui, 100);
    expect(shown).toContain('Out of ammo');
    expect(shown).not.toContain(want);
  });

  it('is not shown for an empty tile, an unseen enemy, or outside the shot modes', () => {
    const { state, ui } = aiming();
    const plain = (t: string) => t.includes(' HIT ') || t === 'OUT OF RANGE';
    ui.hover = { x: 2, y: 1 };
    expect(panelTexts(state, ui).some(plain)).toBe(false);
    ui.hover = { ...unit(state, 'e1').pos };
    unit(state, 'p1').facing = 6; // looking away: the enemy is not seen
    expect(panelTexts(state, ui).some(plain)).toBe(false);
    unit(state, 'p1').facing = 2;
    ui.mode = 'move';
    expect(panelTexts(state, ui).some(plain)).toBe(false);
    ui.mode = 'throw';
    expect(panelTexts(state, ui).some(plain)).toBe(false);
  });

  it('says OUT OF RANGE for a visible enemy beyond the weapon', () => {
    const state = makeState(corridorRows('P' + '.'.repeat(9) + 'E'));
    const p = unit(state, 'p1');
    p.weapon = 'pistol';
    p.facing = 2;
    const ui = createUiState('p1');
    ui.mode = 'snap';
    ui.hover = { ...unit(state, 'e1').pos };
    expect(panelTexts(state, ui)).toContain('OUT OF RANGE');
  });
});

describe('opening the soldier card', () => {
  function inMission() {
    let t = 0;
    const app = new App({
      clock: () => t,
      skipTitle: true,
      store: null,
      createMission: (def, seed, roster, loadout, budget, stash) => createMission(def, seed, roster, loadout, budget, stash),
    });
    app.click({ x: 240, y: 345 });
    t += 500;
    return app;
  }
  const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  it('opens with I and closes with I or Escape', () => {
    const app = inMission();
    const c = app.controller!;
    expect(c.ui.card).toBe(false);
    app.key('i');
    expect(c.ui.card).toBe(true);
    app.key('I');
    expect(c.ui.card).toBe(false);
    app.key('i');
    app.key('Escape');
    expect(c.ui.card).toBe(false);
  });

  it('opens with a click on the detail line and closes with any click', () => {
    const app = inMission();
    const c = app.controller!;
    expect(detailHit(app.layout, centre(app.layout.detail).x, centre(app.layout.detail).y)).toBe(true);
    app.click(centre(app.layout.detail));
    expect(c.ui.card).toBe(true);
    app.click({ x: 10, y: 10 });
    expect(c.ui.card).toBe(false);
  });

  it('ignores the game keys while open, so nothing is triggered by accident', () => {
    const app = inMission();
    const c = app.controller!;
    app.key('i');
    app.key('s');
    expect(c.ui.mode).toBe('move');
    app.key(' ');
    expect(c.state.turn).toBe('player');
    app.key('i');
    app.key('s');
    expect(c.ui.mode).toBe('snap');
  });

  it('does not open with nobody selected', () => {
    const app = inMission();
    const c = app.controller!;
    c.ui.selectedId = null;
    app.key('i');
    expect(c.ui.card).toBe(false);
  });
});

const SIZES: [number, number, number][] = [[480, 400, 1], [390, 844, 3], [844, 390, 3], [1366, 768, 1], [320, 568, 2]];

describe.each(SIZES)('the soldier card at %i x %i (dpr %i)', (w, h, dpr) => {
  const L: Layout = w === 480 ? DEFAULT_LAYOUT : computeLayout(w, h, dpr);

  it('draws the sections, inside the map area, with no overlapping text and only supported characters', () => {
    const state = makeState(corridorRows('P..E'));
    const p = unit(state, 'p1');
    p.weapon = 'sniper';
    p.throwable = 'incendiary';
    p.gadget = 'medkit';
    p.attachment = 'scope';
    p.rank = 'Captain';
    const ui = createUiState('p1');
    ui.card = true;
    const runs = texts(() => drawCard(ctx, state, ui, L));
    const all = runs.map((r) => r.text);
    for (const heading of ['SOLDIER', 'WEAPON', 'GRENADE', 'KIT']) expect(all, heading).toContain(heading);
    expect(all).toContain('SNIPER');
    const left = (r: TextRun) => (r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2));
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(L.map.x);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(L.map.x + L.map.w);
      expect(r.y, r.text).toBeGreaterThanOrEqual(L.map.y);
      expect(r.y + 7, r.text).toBeLessThanOrEqual(L.map.y + L.map.h);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = { x: left(runs[i]), y: runs[i].y, w: runs[i].width, h: 7 };
        const b = { x: left(runs[j]), y: runs[j].y, w: runs[j].width, h: 7 };
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `"${runs[i].text}" overlaps "${runs[j].text}"`).toBe(false);
      }
    }
  });

  it('draws nothing when the card is closed or nobody is selected', () => {
    const state = makeState(corridorRows('P..E'));
    expect(texts(() => drawCard(ctx, state, createUiState('p1'), L))).toHaveLength(0);
    const ui = createUiState(null);
    ui.card = true;
    expect(texts(() => drawCard(ctx, state, ui, L))).toHaveLength(0);
  });
});
