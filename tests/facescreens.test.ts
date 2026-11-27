import { afterEach, describe, expect, it, vi } from 'vitest';
import { soldierStats } from '../src/core/world/soldierinfo';
import { newWorld, type World } from '../src/core/world/world';
import { createUiState } from '../src/input/uiState';
import { drawCard } from '../src/render/card';
import { DEFAULT_LAYOUT } from '../src/render/panel';
import { CARD, NAME_W, drawSoldierCard } from '../src/screens/baseinfo';
import { PANEL, drawPanel, panelAction, panelHit, panelRows } from '../src/screens/basepanels';
import { faceImage } from '../src/screens/faces';
import { SQUAD } from '../src/screens/squad';
import { computeLayout, type Layout } from '../src/ui/layout';
import { onText, type TextRun } from '../src/ui/text';
import { corridorRows, fakeDocument, makeState, unit } from './helpers';

interface Box { x: number; y: number; w: number; h: number }

/** Draws, collecting the text and the images. */
function record(draw: (ctx: CanvasRenderingContext2D) => void) {
  const text: TextRun[] = [];
  const images: { image: unknown; box: Box }[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name: string) => (...args: unknown[]) => {
      const [image, x, y, w, h] = args as [unknown, number, number, number, number];
      if (name === 'drawImage') images.push({ image, box: { x, y, w, h } });
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const stop = onText((r) => text.push(r));
  draw(ctx);
  stop();
  return { text, images };
}

const textBox = (r: TextRun): Box => ({
  x: r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2),
  y: r.y,
  w: r.width,
  h: 7 * (r.scale ?? 1),
});
const overlap = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const within = (a: Box, outer: Box): boolean =>
  a.x >= outer.x && a.y >= outer.y && a.x + a.w <= outer.x + outer.w && a.y + a.h <= outer.y + outer.h;

/** A fresh story with Chen, the third soldier, wounded for three days. */
const hurt = (): World => {
  const w = newWorld(1, 'calm');
  return { ...w, soldiers: w.soldiers.map((s) => (s.name === 'Chen' ? { ...s, status: 'wounded' as const, daysLeft: 3 } : s)) };
};

afterEach(() => vi.unstubAllGlobals());

describe('the wounded in the field hospital', () => {
  it('lists each of them under the facility rows, and nobody else', () => {
    expect(panelRows('hospital', newWorld(1, 'calm'))).toHaveLength(3);
    const rows = panelRows('hospital', hurt());
    expect(rows).toHaveLength(4);
    expect(rows[3]).toEqual({ label: 'CHEN RKE', detail: 'WOUNDED 3D', enabled: true });
  });

  it('opens a card from the name of a wounded row only', () => {
    const w = hurt();
    const r = PANEL.rows[3];
    expect(panelHit('hospital', r.x + 10, r.y + 5, w, 0)).toEqual({ kind: 'name', index: 3 });
    expect(panelHit('hospital', r.x + NAME_W + 1, r.y + 5, w, 0)).toEqual({ kind: 'row', index: 3 });
    expect(panelHit('hospital', PANEL.rows[2].x + 10, PANEL.rows[2].y + 5, w, 0)).toEqual({ kind: 'row', index: 2 });
  });

  it('offers no upgrade START while a wounded soldier is selected', () => {
    const w = hurt();
    expect(panelAction('hospital', w, 3)).toBeNull();
    expect(panelAction('hospital', w, 0)).toBe('START');
    expect(panelAction('hospital', w, null)).toBe('START');
  });

  it('draws the face of the wounded soldier on that row, and leaves the facility rows as they were', () => {
    vi.stubGlobal('document', fakeDocument());
    const w = hurt();
    const { text, images } = record((ctx) => drawPanel(ctx, 'hospital', w, null, 0, ''));
    const r = PANEL.rows[3];
    expect(images).toEqual([{ image: faceImage('Chen', true), box: { x: r.x + 3, y: r.y + 2, w: 16, h: 16 } }]);
    expect(text.find((t) => t.text === 'CHEN RKE')!.x).toBe(r.x + 26);
    expect(text.find((t) => t.text === 'FIELD HOSPITAL' && t.y > PANEL.rows[0].y)!.x).toBe(PANEL.rows[0].x + 8);
  });
});

describe('the training list', () => {
  it('draws a small face on every row, with the name moved right', () => {
    vi.stubGlobal('document', fakeDocument());
    const w = newWorld(1, 'calm');
    const { text, images } = record((ctx) => drawPanel(ctx, 'training', w, null, 0, ''));
    expect(images.map((i) => i.image)).toEqual(w.soldiers.map((s) => faceImage(s.name, true)));
    expect(text.find((t) => t.text === 'ALVAREZ RKE')!.x).toBe(PANEL.rows[0].x + 26);
  });
});

describe('the soldier card in the base', () => {
  const w = { ...newWorld(1, 'calm'), research: { done: ['training1'], active: null } };
  const stats = soldierStats(w.soldiers[0], w);

  it('shows the face at the top, clear of the text, inside the card', () => {
    vi.stubGlobal('document', fakeDocument());
    const { text, images } = record((ctx) => drawSoldierCard(ctx, stats));
    expect(images).toHaveLength(1);
    const face = images[0];
    expect(face.image).toBe(faceImage('Alvarez', false));
    expect([face.box.w, face.box.h]).toEqual([64, 64]);
    expect(within(face.box, CARD.box)).toBe(true);
    for (const r of text) {
      expect(textBox(r).y, r.text).toBeGreaterThanOrEqual(face.box.y + face.box.h);
      expect(within(textBox(r), CARD.box), r.text).toBe(true);
      if (r.text !== 'BACK') expect(textBox(r).y + 7, r.text).toBeLessThanOrEqual(CARD.back.y);
    }
  });

  it('keeps its BACK inside the card and above the screen buttons under it', () => {
    expect(within(CARD.back, CARD.box)).toBe(true);
    expect(within(CARD.box, { x: 0, y: 0, w: 480, h: 400 })).toBe(true);
    for (const under of [PANEL.act, PANEL.back, SQUAD.start, SQUAD.back]) expect(overlap(CARD.back, under)).toBe(false);
  });
});

const SIZES: [number, number, number][] = [
  [480, 400, 1], [390, 844, 3], [844, 390, 3], [1366, 768, 1], [320, 568, 2], [568, 270, 2], [740, 260, 3], [320, 480, 2], [667, 375, 2],
];

/** The mission card of a soldier with the longest kit, drawn on a layout. */
const missionCard = (L: Layout) => {
  const state = makeState(corridorRows('P..E'));
  const p = unit(state, 'p1');
  Object.assign(p, { name: 'Chen', weapon: 'sniper', throwable: 'incendiary', gadget: 'medkit', attachment: 'scope', rank: 'Captain' });
  const ui = createUiState('p1');
  ui.card = true;
  return record((ctx) => drawCard(ctx, state, ui, L));
};

describe.each(SIZES)('the face on the mission card at %i x %i (dpr %i)', (width, height, dpr) => {
  const L: Layout = width === 480 ? DEFAULT_LAYOUT : computeLayout(width, height, dpr);
  const card = () => missionCard(L);

  it('is the selected soldier, inside the map, over no text, and never takes the text below its normal size', () => {
    const plain = card(); // no canvas yet: the card without a face
    expect(plain.images).toHaveLength(0);
    vi.stubGlobal('document', fakeDocument());
    const { text, images } = card();
    expect(images).toHaveLength(1);
    const face = images[0];
    expect(face.image).toBe(faceImage('Chen', false));
    expect(face.box.w).toBe(face.box.h);
    expect(face.box.w).toBeGreaterThanOrEqual(16);
    expect(within(face.box, L.map)).toBe(true);
    for (const r of text) {
      expect(overlap(face.box, textBox(r)), r.text).toBe(false);
      expect(within(textBox(r), L.map), r.text).toBe(true);
    }
    // a tight screen may lose enlargement, but not below scale 1 (or the plain card's own scale)
    expect(text[0].scale).toBeGreaterThanOrEqual(Math.min(plain.text[0].scale!, 1));
  });
});

describe('the mission card on any window', () => {
  it('never loses room or text size to the face: it gives way first', () => {
    const bad: string[] = [];
    for (const dpr of [1, 2, 2.625, 3]) {
      for (let width = 280; width <= 900; width += 40) {
        for (let height = 160; height <= 900; height += 40) {
          const L = computeLayout(width, height, dpr);
          vi.unstubAllGlobals();
          const plain = missionCard(L).text;
          vi.stubGlobal('document', fakeDocument());
          const faced = missionCard(L).text;
          const right = (t: TextRun[]) => Math.max(...t.map((r) => textBox(r).x + textBox(r).w));
          const bottom = (t: TextRun[]) => Math.max(...t.map((r) => textBox(r).y + textBox(r).h));
          const smaller = faced[0].scale! < Math.min(plain[0].scale!, 1) - 1e-9;
          const spills = right(faced) > Math.max(right(plain), L.map.x + L.map.w) || bottom(faced) > Math.max(bottom(plain), L.map.y + L.map.h);
          if (smaller || spills) bad.push(`${width}x${height}@${dpr}`);
        }
      }
    }
    expect(bad).toEqual([]);
  }, 30000);

  it('uses a whole number of device pixels, with the face, on a phone whose panel text is below 1', () => {
    const L = computeLayout(568, 270, 2.625);
    expect(L.text).toBeLessThan(1);
    vi.stubGlobal('document', fakeDocument());
    const { text, images } = missionCard(L);
    expect(text[0].scale).toBeCloseTo(L.text, 6);
    expect(images).toHaveLength(1);
  });
});
