import { describe, expect, it } from 'vitest';
import { textWidth } from '../src/ui/font';
import { ACTIONS, computeLayout, type Layout, type Rect } from '../src/ui/layout';

const SIZES: [number, number, number][] = [
  [320, 568, 2], [375, 812, 3], [390, 844, 3], [844, 390, 3], [812, 375, 3], [1024, 768, 2], [1366, 768, 1], [1920, 1080, 1], [480, 400, 1],
];

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.001 && b.x < a.x + a.w - 0.001 && a.y < b.y + b.h - 0.001 && b.y < a.y + a.h - 0.001;
const inside = (r: Rect, w: number, h: number) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 0.001 && r.y + r.h <= h + 0.001;

function interactive(l: Layout): { name: string; rect: Rect }[] {
  return [
    ...l.actions.map((a) => ({ name: a.id, rect: a.rect })),
    ...l.squad.map((r, i) => ({ name: `squad${i}`, rect: r })),
    { name: 'cancel', rect: l.cancel },
    { name: 'sound', rect: l.sound },
  ];
}

describe('the action list', () => {
  it('has the twelve actions in the agreed order', () => {
    expect(ACTIONS.map((a) => a.id)).toEqual([
      'snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'gadget', 'turn', 'zoom', 'end',
    ]);
  });
});

describe.each(SIZES)('computeLayout %i x %i at dpr %i', (w, h, dpr) => {
  const l = computeLayout(w, h, dpr);

  it('has 12 actions and 4 squad buttons, all inside the window', () => {
    expect(l.actions).toHaveLength(12);
    expect(l.squad).toHaveLength(4);
    for (const it of interactive(l)) expect(inside(it.rect, w, h), it.name).toBe(true);
    expect(inside(l.map, w, h)).toBe(true);
    expect(inside(l.panel, w, h)).toBe(true);
  });

  it('no two interactive rectangles overlap', () => {
    const items = interactive(l);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        expect(overlap(items[i].rect, items[j].rect), `${items[i].name} overlaps ${items[j].name}`).toBe(false);
      }
    }
  });

  it('the map and the panel do not overlap, and the map is not tiny', () => {
    expect(overlap(l.map, l.panel)).toBe(false);
    expect(l.map.w).toBeGreaterThan(w * 0.5);
    expect(l.map.h).toBeGreaterThan(h * 0.4);
  });

  it('buttons are touch size where the window allows (44 px, never below 32)', () => {
    for (const a of l.actions) {
      expect(a.rect.h, a.id).toBeGreaterThanOrEqual(32);
      if (Math.min(w, h) >= 375 && w < h) expect(a.rect.h, a.id).toBeGreaterThanOrEqual(40);
    }
  });

  it('every label fits its button at the chosen text scale', () => {
    for (const a of l.actions) expect(textWidth(a.label) * l.text + 6, a.id).toBeLessThanOrEqual(a.rect.w);
    expect(l.text).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(computeLayout(w, h, dpr)).toEqual(l);
  });
});

describe('orientation', () => {
  it('portrait phones put the panel below the map, landscape phones put it on the right', () => {
    const p = computeLayout(390, 844, 3);
    expect(p.orientation).toBe('portrait');
    expect(p.panel.y).toBeGreaterThanOrEqual(p.map.y + p.map.h - 0.001);
    expect(p.overlay).toBe(false);
    const ls = computeLayout(844, 390, 3);
    expect(ls.orientation).toBe('landscape');
    expect(ls.panel.x).toBeGreaterThanOrEqual(ls.map.x + ls.map.w - 0.001);
    expect(ls.overlay).toBe(true);
  });

  it('large desktop windows use the bottom panel', () => {
    const d = computeLayout(1366, 768, 1);
    expect(d.orientation).toBe('portrait');
    expect(d.panel.y).toBeGreaterThan(d.map.y);
  });
});

describe.each([[568, 263, 2], [640, 290, 2], [667, 375, 2], [812, 260, 3]])('short landscape %i x %i at dpr %i', (w, h, dpr) => {
  const l = computeLayout(w, h, dpr);

  it('keeps every interactive rectangle on screen, none overlapping, labels fitting', () => {
    expect(l.orientation).toBe('landscape');
    for (const it of interactive(l)) expect(inside(it.rect, w, h), it.name).toBe(true);
    const items = interactive(l);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) expect(overlap(items[i].rect, items[j].rect), `${items[i].name}/${items[j].name}`).toBe(false);
    }
    for (const a of l.actions) expect(textWidth(a.label) * l.text + 6, a.id).toBeLessThanOrEqual(a.rect.w);
  });

  it('END TURN is reachable', () => {
    const end = l.actions.find((a) => a.id === 'end')!.rect;
    expect(end.y + end.h).toBeLessThanOrEqual(h + 0.001);
    expect(end.h).toBeGreaterThanOrEqual(30);
  });
});
