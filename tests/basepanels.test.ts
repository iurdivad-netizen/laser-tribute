import { describe, expect, it } from 'vitest';
import { THROWABLES, WEAPONS } from '../src/core/config';
import { NODES } from '../src/core/world/base';
import { newWorld } from '../src/core/world/world';
import {
  PANEL, PANEL_PAGE, drawPanel, panelAction, panelHit, panelRows, type PanelId,
} from '../src/screens/basepanels';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const fresh = () => newWorld(1, 'calm');
const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const IDS: PanelId[] = ['lab', 'market', 'barracks', 'training', 'hospital', 'wait'];

function runs(draw: (ctx: CanvasRenderingContext2D) => void): TextRun[] {
  const out: TextRun[] = [];
  const stop = onText((r) => out.push(r));
  draw(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D);
  stop();
  return out;
}
const left = (r: TextRun): number => (r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2));

describe('lab rows', () => {
  it('lists the 22 nodes in tree order and enables only what can start', () => {
    const rows = panelRows('lab', fresh());
    expect(rows).toHaveLength(NODES.length);
    expect(rows[0].label).toBe('SHOTGUN');
    expect(rows[0].enabled).toBe(true);
    const smg = rows[NODES.findIndex((n) => n.id === 'smg')];
    expect(smg.enabled).toBe(false);
    expect(smg.detail).toContain('SHOTGUN'); // names what it needs
    const done = panelRows('lab', { ...fresh(), research: { done: ['shotgun'], active: null } });
    expect(done[0].detail).toBe('DONE');
  });

  it('starts the selected project, and offers nothing for a locked or unaffordable row', () => {
    const w = fresh();
    expect(panelAction('lab', w, 0)).toBe('START');
    expect(panelAction('lab', w, NODES.findIndex((n) => n.id === 'smg'))).toBeNull();
    expect(panelAction('lab', w, null)).toBeNull();
    expect(panelAction('lab', { ...w, credits: 10 }, 0)).toBeNull();
  });
});

describe('market rows', () => {
  it('shows the base and the market price of each unresearched gear item', () => {
    const rows = panelRows('market', fresh());
    expect(rows).toHaveLength(9);
    const shotgun = rows.find((r) => r.label === 'SHOTGUN')!;
    expect(shotgun.detail).toContain(`${WEAPONS.shotgun.price}`);
    expect(shotgun.detail).toContain(`${Math.round(WEAPONS.shotgun.price * 1.5)}`);
    const smoke = rows.find((r) => r.label === 'SMOKE GRENADE')!;
    expect(smoke.detail).toContain(`${Math.round(THROWABLES.smoke.price * 1.5)}`);
    const owned = panelRows('market', { ...fresh(), research: { done: ['shotgun'], active: null } });
    expect(owned.find((r) => r.label === 'SHOTGUN')!.detail).toBe('OWNED');
    expect(panelAction('market', fresh(), 0)).toBeNull();
  });
});

describe('barracks, training and hospital rows', () => {
  it('lists the pool with status, and offers HIRE only when it can', () => {
    const w = fresh();
    const rows = panelRows('barracks', w);
    expect(rows).toHaveLength(4);
    expect(rows[0].label).toContain('ALVAREZ');
    expect(rows[0].detail).toContain('READY');
    expect(panelAction('barracks', w, null)).toBe('HIRE');
    expect(panelAction('barracks', { ...w, credits: 39 }, null)).toBeNull();
    const full = { ...w, soldiers: [...w.soldiers, ...['E', 'F'].map((n) => ({ name: n, kills: 0, trained: 0, status: 'ready' as const, daysLeft: 0 }))] };
    expect(panelAction('barracks', full, null)).toBeNull();
  });

  it('shows who can train', () => {
    const w = { ...fresh(), research: { done: ['training1'], active: null } };
    const rows = panelRows('training', w);
    expect(rows[0].enabled).toBe(true);
    expect(panelAction('training', w, 0)).toBe('TRAIN');
    expect(panelRows('training', fresh())[0].enabled).toBe(false);
    expect(panelAction('training', fresh(), 0)).toBeNull();
  });

  it('shows the hospital level, the chance, and the next upgrade', () => {
    const none = panelRows('hospital', fresh());
    expect(none.map((r) => r.detail).join(' ')).toContain('0%');
    const l1 = { ...fresh(), research: { done: ['hospital1'], active: null } };
    expect(panelRows('hospital', l1).map((r) => r.detail).join(' ')).toContain('25%');
    expect(panelAction('hospital', fresh(), null)).toBe('START'); // the first upgrade is affordable
    expect(panelAction('hospital', { ...l1, research: { done: ['hospital1', 'hospital2'], active: null } }, null)).toBeNull();
  });

  it('offers the two waits', () => {
    const rows = panelRows('wait', fresh());
    expect(rows.map((r) => r.label)).toEqual(['WAIT 1 DAY', 'WAIT 3 DAYS']);
    expect(panelAction('wait', fresh(), 1)).toBe('WAIT');
    expect(panelAction('wait', fresh(), null)).toBeNull();
  });
});

describe('panel hits and drawing', () => {
  it('hits row centres on a page, the buttons, and nothing past the last row', () => {
    const w = fresh();
    expect(panelHit('lab', centre(PANEL.rows[0]).x, centre(PANEL.rows[0]).y, w, 0)).toEqual({ kind: 'row', index: 0 });
    expect(panelHit('lab', centre(PANEL.rows[3]).x, centre(PANEL.rows[3]).y, w, 1)).toEqual({ kind: 'row', index: PANEL_PAGE + 3 });
    expect(panelHit('lab', centre(PANEL.act).x, centre(PANEL.act).y, w, 0)).toEqual({ kind: 'act' });
    expect(panelHit('lab', centre(PANEL.back).x, centre(PANEL.back).y, w, 0)).toEqual({ kind: 'back' });
    expect(panelHit('lab', centre(PANEL.next).x, centre(PANEL.next).y, w, 0)).toEqual({ kind: 'next' });
    expect(panelHit('lab', centre(PANEL.prev).x, centre(PANEL.prev).y, w, 1)).toEqual({ kind: 'prev' });
    expect(panelHit('barracks', centre(PANEL.rows[8]).x, centre(PANEL.rows[8]).y, w, 0)).toBeNull(); // only 4 soldiers
    expect(panelHit('lab', centre(PANEL.rows[10]).x, centre(PANEL.rows[10]).y, w, 1)).toEqual({ kind: 'row', index: 21 }); // the last of 22
    expect(panelHit('lab', centre(PANEL.next).x, centre(PANEL.next).y, w, 1)).toBeNull(); // no page after the last
  });

  it('keeps rows and buttons apart', () => {
    const rects = [...PANEL.rows, PANEL.act, PANEL.back, PANEL.prev, PANEL.next];
    for (const a of rects) for (const b of rects) {
      if (a === b) continue;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart).toBe(true);
    }
    expect(PANEL.rows).toHaveLength(PANEL_PAGE);
  });

  it('draws every panel inside the screen with supported characters', () => {
    const rich = {
      ...fresh(), credits: 999999, day: 99999, namesUsed: 9,
      research: { done: ['training3', 'hospital2', 'beds3', 'labs2'], active: null },
      soldiers: Array.from({ length: 12 }, (_, i) => ({
        name: `Lindqvist ${i + 2}`, kills: 9999, trained: 9999, status: (i % 3 === 0 ? 'ready' : i % 3 === 1 ? 'training' : 'wounded') as 'ready',
        daysLeft: i % 3 === 0 ? 0 : 3,
      })),
    };
    for (const w of [fresh(), rich]) {
      for (const id of IDS) {
        for (const r of runs((ctx) => drawPanel(ctx, id, w, 0, 0, 'Hired Eriksen.'))) {
          expect(unsupportedChars(r.text), `${id}: ${r.text}`).toEqual([]);
          expect(left(r), `${id}: ${r.text}`).toBeGreaterThanOrEqual(0);
          expect(left(r) + r.width, `${id}: ${r.text}`).toBeLessThanOrEqual(480);
        }
      }
    }
  });
});
