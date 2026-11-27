import { soldierCard, type CardSection } from '../core/stats';
import type { GameState } from '../core/types';
import type { UiState } from '../input/uiState';
import { faceImage } from '../screens/faces';
import { textWidth } from '../ui/font';
import { UI, drawFrame } from '../ui/frame';
import type { Layout } from '../ui/layout';
import { drawText } from '../ui/text';

const PAD = 6;
const COLUMN_GAP = 10;
const MARGIN = 2;
/** The face's side in layout pixels at text scale 1; it grows and shrinks with the text. */
const FACE = 32;

/** The space between rows: roomy at a big text scale, tight at scale 1 and below so the whole card fits a small phone. */
const gapFor = (scale: number): number => (scale > 1.2 ? 4 : 2);

/** Where the face goes: left of the columns, on top of the first one, or nowhere. */
type Spot = 'beside' | 'above' | 'none';

interface Arrangement {
  columns: CardSection[][];
  scale: number;
  spot: Spot;
}

const rowsOf = (sections: CardSection[]): number => sections.reduce((n, s) => n + 1 + s.rows.length, 0);

/**
 * The soldier card: a modal box over the map with the selected soldier's face, stats, weapon, grenade and kit.
 * Drawn only while `ui.card` is set and a soldier is selected.
 *
 * The text is drawn at a whole number of device pixels per font pixel. The arrangement is the first that fits the map
 * area, trying in this order: one column at the panel's scale or a smaller one down to 1, two columns (the weapon on its
 * own) at the same scales, and last a smaller-than-1 scale. At each scale the face is tried beside the text, then above. It is left out when
 * keeping it would cost more than one thing a reader notices: any fit at all, or text below scale 1.
 */
export function drawCard(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState, layout: Layout): void {
  if (!ui.card) return;
  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);
  if (!u) return;
  const sections = soldierCard(u);
  const labelW = Math.max(...sections.flatMap((s) => s.rows.map((r) => textWidth(r[0]))));
  const valueW = Math.max(...sections.flatMap((s) => s.rows.map((r) => textWidth(r[1]))), ...sections.map((s) => textWidth(s.heading)));
  const oneColumn = [sections];
  const twoColumns = [sections.filter((s) => s.heading !== 'WEAPON'), sections.filter((s) => s.heading === 'WEAPON')];
  const m = layout.map;
  const face = faceImage(u.name, false);
  /** The room the face takes to the left of the columns, and above the first one. */
  const besideW = (scale: number, spot: Spot): number => (spot === 'beside' ? FACE * scale + COLUMN_GAP : 0);
  const aboveH = (scale: number, spot: Spot): number => (spot === 'above' ? FACE * scale + gapFor(scale) : 0);

  const size = (columns: CardSection[][], scale: number, spot: Spot): { w: number; h: number } => ({
    w: Math.ceil(besideW(scale, spot) + columns.length * ((labelW + valueW) * scale + COLUMN_GAP) - COLUMN_GAP + 2 * PAD),
    h: Math.ceil(Math.max(...columns.map((c, i) => rowsOf(c) * (7 * scale + gapFor(scale)) + (i === 0 ? aboveH(scale, spot) : 0))) + 2 * PAD),
  });
  const fits = (columns: CardSection[][], scale: number, spot: Spot): boolean => {
    const s = size(columns, scale, spot);
    return s.w <= m.w - 2 * MARGIN && s.h <= m.h - 2 * MARGIN;
  };
  const steps = (from: number, to: number): number[] => {
    const out: number[] = [];
    for (let k = Math.round(from * layout.dpr); k / layout.dpr >= to - 1e-9; k--) out.push(k / layout.dpr);
    return out;
  };
  const big = steps(layout.text, 1);
  // a panel scale below 1 is itself the first small step
  const small = steps(layout.text < 1 ? layout.text : 1 - 1 / layout.dpr, 0.5);
  const tries: [CardSection[][], number[]][] = [[oneColumn, big], [twoColumns, big], [oneColumn, small], [twoColumns, small]];
  const arrange = (spots: Spot[]): Arrangement | null => {
    for (const [columns, scales] of tries) {
      for (const scale of scales) {
        const spot = spots.find((s) => fits(columns, scale, s));
        if (spot) return { columns, scale, spot };
      }
    }
    return null;
  };
  const plain = arrange(['none']);
  const faced = face ? arrange(['beside', 'above']) : null;
  const keepFace = faced && plain && faced.scale >= Math.min(1, plain.scale);
  // nothing fits (a tiny window): the smallest two-column card, kept inside the map as far as it goes
  const { columns, scale, spot } =
    (keepFace ? faced : plain) ?? { columns: twoColumns, scale: Math.max(0.5, 1 / layout.dpr), spot: 'none' as const };

  const rowH = 7 * scale + gapFor(scale);
  const box = size(columns, scale, spot);
  const w = Math.min(box.w, m.w - 2 * MARGIN);
  const h = Math.min(box.h, m.h - 2 * MARGIN);
  const x = m.x + Math.floor((m.w - w) / 2);
  const y = m.y + Math.floor((m.h - h) / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(m.x, m.y, m.w, m.h);
  drawFrame(ctx, x, y, w, h, 'raised');
  if (face && spot !== 'none') ctx.drawImage(face, x + PAD, y + PAD, FACE * scale, FACE * scale);
  const colW = (labelW + valueW) * scale + COLUMN_GAP;
  columns.forEach((col, i) => {
    const left = x + PAD + besideW(scale, spot) + i * colW;
    const right = left + (labelW + valueW) * scale;
    let ry = y + PAD + (i === 0 ? aboveH(scale, spot) : 0);
    const text = (s: string, tx: number, colour: string, align: 'left' | 'right') =>
      drawText(ctx, s, tx, Math.round(ry), colour, align, undefined, scale);
    for (const section of col) {
      text(section.heading, left, UI.accent, 'left');
      ry += rowH;
      for (const [label, value] of section.rows) {
        text(label, left, UI.dim, 'left');
        text(value, right, UI.text, 'right');
        ry += rowH;
      }
    }
  });
}
