import { soldierCard } from '../core/stats';
import type { GameState } from '../core/types';
import type { UiState } from '../input/uiState';
import { textWidth } from '../ui/font';
import { UI, drawFrame } from '../ui/frame';
import type { Layout } from '../ui/layout';
import { drawText } from '../ui/text';

const PAD = 6;
/** The space between rows: roomy at a big text scale, tight at scale 1 so the whole card fits a small phone. */
const gapFor = (scale: number): number => (scale > 1.2 ? 4 : 2);
const COLUMN_GAP = 10;

/**
 * The soldier card: a modal box over the map with the selected soldier's stats and his weapon, grenade and kit.
 * Drawn only while `ui.card` is set and a soldier is selected. The text scale is the largest, down to 1, at which the
 * whole card fits the map area.
 */
export function drawCard(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState, layout: Layout): void {
  if (!ui.card) return;
  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);
  if (!u) return;
  const sections = soldierCard(u);
  const rows = sections.reduce((n, s) => n + 1 + s.rows.length, 0);
  const labelW = Math.max(...sections.flatMap((s) => s.rows.map((r) => textWidth(r[0]))));
  const valueW = Math.max(...sections.flatMap((s) => s.rows.map((r) => textWidth(r[1]))), ...sections.map((s) => textWidth(s.heading)));
  const m = layout.map;
  const fitsAt = (scale: number): boolean =>
    rows * (7 * scale + gapFor(scale)) + 2 * PAD <= m.h - 4 && (labelW + valueW) * scale + COLUMN_GAP + 2 * PAD <= m.w - 4;
  let scale = 1;
  for (let s = layout.text; s > 1; s -= 0.25) {
    if (fitsAt(s)) {
      scale = s;
      break;
    }
  }
  const rowH = 7 * scale + gapFor(scale);
  const w = Math.min(m.w - 4, Math.ceil((labelW + valueW) * scale + COLUMN_GAP + 2 * PAD));
  const h = Math.ceil(rows * rowH + 2 * PAD);
  const x = m.x + Math.floor((m.w - w) / 2);
  const y = m.y + Math.floor((m.h - h) / 2);

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(m.x, m.y, m.w, m.h);
  drawFrame(ctx, x, y, w, h, 'raised');
  let ry = y + PAD;
  const text = (s: string, tx: number, colour: string, align: 'left' | 'right') =>
    drawText(ctx, s, tx, Math.round(ry), colour, align, undefined, scale);
  for (const section of sections) {
    text(section.heading, x + PAD, UI.accent, 'left');
    ry += rowH;
    for (const [label, value] of section.rows) {
      text(label, x + PAD, UI.dim, 'left');
      text(value, x + w - PAD, UI.text, 'right');
      ry += rowH;
    }
  }
}
