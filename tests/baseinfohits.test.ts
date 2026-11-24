import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/core/world/world';
import { NAME_W } from '../src/screens/baseinfo';
import { PANEL, drawPanel, panelHit, type PanelId } from '../src/screens/basepanels';
import { SQUAD, squadHit } from '../src/screens/squad';
import { onText } from '../src/ui/text';

const fresh = () => newWorld(1, 'calm');
const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const PANELS: PanelId[] = ['lab', 'market', 'barracks', 'training', 'hospital', 'wait'];
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

describe('the name area of a panel row', () => {
  it('is the first NAME_W pixels of a soldier row in the barracks and training panels', () => {
    const row = PANEL.rows[0];
    for (const id of ['barracks', 'training'] as const) {
      expect(panelHit(id, row.x + 10, row.y + 5, fresh(), 0), id).toEqual({ kind: 'name', index: 0 });
      expect(panelHit(id, row.x + NAME_W - 1, row.y + 5, fresh(), 0), id).toEqual({ kind: 'name', index: 0 });
      expect(panelHit(id, row.x + NAME_W + 1, row.y + 5, fresh(), 0), id).toEqual({ kind: 'row', index: 0 });
      expect(panelHit(id, row.x + 200, row.y + 5, fresh(), 0), id).toEqual({ kind: 'row', index: 0 });
    }
  });

  it('never appears on the other panels, and a row with no soldier is nothing', () => {
    const row = PANEL.rows[0];
    for (const id of ['lab', 'market', 'hospital', 'wait'] as const) {
      expect(panelHit(id, row.x + 10, row.y + 5, fresh(), 0)?.kind, id).toBe('row');
    }
    expect(panelHit('barracks', PANEL.rows[9].x + 10, PANEL.rows[9].y + 5, fresh(), 0)).toBeNull();
  });
});

describe('the INFO button', () => {
  it('is hit at its centre on every panel, also with touch slop, without reaching another button', () => {
    for (const id of PANELS) {
      const c = centre(PANEL.info);
      expect(panelHit(id, c.x, c.y, fresh(), 0), id).toEqual({ kind: 'info' });
      expect(panelHit(id, PANEL.info.x - 4, c.y, fresh(), 0, 5), id).toEqual({ kind: 'info' });
      expect(panelHit(id, centre(PANEL.act).x, centre(PANEL.act).y, fresh(), 0, 5)?.kind, id).toBe('act');
      expect(panelHit(id, centre(PANEL.back).x, centre(PANEL.back).y, fresh(), 0, 5)?.kind, id).toBe('back');
    }
  });

  it('keeps clear of the rows and the other buttons, inside the screen', () => {
    for (const other of [...PANEL.rows, PANEL.act, PANEL.back, PANEL.prev, PANEL.next]) expect(overlap(PANEL.info, other)).toBe(false);
    expect(PANEL.info.x + PANEL.info.w).toBeLessThanOrEqual(480);
    expect(PANEL.info.y).toBeGreaterThanOrEqual(0);
  });

  it('is drawn on every panel', () => {
    for (const id of PANELS) {
      const out: string[] = [];
      const stop = onText((r) => out.push(r.text));
      drawPanel(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D, id, fresh(), null, 0, '');
      stop();
      expect(out, id).toContain('INFO');
    }
  });
});

describe('the name area of a squad row', () => {
  it('opens a card for any soldier, and the rest of a ready row still picks', () => {
    const w = fresh();
    const row = SQUAD.rows[1];
    expect(squadHit(row.x + 10, row.y + 5, w)).toEqual({ kind: 'card', name: 'Brandt' });
    expect(squadHit(row.x + NAME_W + 1, row.y + 5, w)).toEqual({ kind: 'soldier', name: 'Brandt' });
    expect(squadHit(row.x + 300, row.y + 5, w)).toEqual({ kind: 'soldier', name: 'Brandt' });
  });

  it('gives a training or wounded soldier a card from the name, and nothing from the rest of the row', () => {
    const base = fresh();
    const w = {
      ...base,
      soldiers: base.soldiers.map((s, i) => (i === 0 ? { ...s, status: 'training' as const, daysLeft: 2 } : i === 1 ? { ...s, status: 'wounded' as const, daysLeft: 3 } : s)),
    };
    for (const i of [0, 1]) {
      const row = SQUAD.rows[i];
      expect(squadHit(row.x + 10, row.y + 5, w)?.kind).toBe('card');
      expect(squadHit(row.x + 300, row.y + 5, w)).toBeNull();
    }
  });

  it('leaves the buttons and empty rows as they were', () => {
    const w = fresh();
    expect(squadHit(centre(SQUAD.start).x, centre(SQUAD.start).y, w)).toEqual({ kind: 'start' });
    expect(squadHit(SQUAD.rows[9].x + 10, SQUAD.rows[9].y + 5, w)).toBeNull();
  });
});
