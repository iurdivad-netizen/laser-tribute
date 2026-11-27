import type { ItemCard } from '../core/world/iteminfo';
import type { BuildingInfo } from '../core/world/buildinginfo';
import type { SoldierStats } from '../core/world/soldierinfo';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { clipText, drawText } from '../ui/text';
import { faceImage } from './faces';
import { wrapText } from './scene';

/** A soldier row's name area: this many pixels from the row's left edge. A click there opens the soldier's card; the rest of the row keeps its job. */
export const NAME_W = 120;

const PAD = 14;
const ROW = 16;
const TEXT_ROW = 11;
const DIM = 'rgba(0,0,0,0.6)';

/** The soldier card: a framed box in the middle of the 480x400 menu space. Any click, or BACK, closes it. */
export const CARD = {
  box: { x: 80, y: 30, w: 320, h: 320 },
  back: { x: 190, y: 308, w: 100, h: 28 },
} as const satisfies { box: Rect; back: Rect };

/** The face at the top of the soldier card, drawn at its own size. */
const FACE = 64;

/** The building explanation box: wide enough for 64 characters a line. */
export const INFO_BOX = {
  box: { x: 40, y: 60, w: 400, h: 260 },
  back: { x: 190, y: 278, w: 100, h: 28 },
} as const satisfies { box: Rect; back: Rect };

function dim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = DIM;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

export function drawSoldierCard(ctx: CanvasRenderingContext2D, stats: SoldierStats): void {
  dim(ctx);
  const b = CARD.box;
  drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
  const face = faceImage(stats.name, false);
  if (face) ctx.drawImage(face, b.x + (b.w - FACE) / 2, b.y + 8, FACE, FACE);
  const top = b.y + 12 + (face ? FACE + 4 : 0);
  drawText(ctx, clipText(stats.name, 160), b.x + PAD, top, UI.accent, 'left');
  drawText(ctx, stats.rank, b.x + b.w - PAD, top, UI.text, 'right');
  stats.rows.forEach(([label, value], i) => {
    const y = top + 22 + i * ROW;
    drawText(ctx, label, b.x + PAD, y, UI.dim, 'left');
    drawText(ctx, clipText(value, b.w - 2 * PAD - 90), b.x + b.w - PAD, y, UI.text, 'right');
  });
  drawText(ctx, clipText(stats.note, b.w - 2 * PAD), b.x + PAD, top + 22 + stats.rows.length * ROW + 8, UI.hint, 'left');
  drawButton(ctx, CARD.back, 'BACK', 'raised');
}

export function drawInfoBox(ctx: CanvasRenderingContext2D, info: BuildingInfo): void {
  dim(ctx);
  const b = INFO_BOX.box;
  drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
  drawText(ctx, info.title, b.x + PAD, b.y + 12, UI.accent, 'left');
  let y = b.y + 36;
  for (const line of info.lines) {
    for (const row of wrapText(line, b.w - 16)) {
      drawText(ctx, row, b.x + 8, y, UI.text, 'left');
      y += TEXT_ROW;
    }
    y += 5; // a little air between lines
  }
  drawButton(ctx, INFO_BOX.back, 'BACK', 'raised');
}

/** The item card: a framed box with the item's numbers, a line on when to pick it, and BACK. Any click closes it. */
export const ITEM_CARD = {
  box: { x: 70, y: 20, w: 340, h: 350 },
  back: { x: 190, y: 326, w: 100, h: 28 },
} as const satisfies { box: Rect; back: Rect };

export function drawItemCard(ctx: CanvasRenderingContext2D, card: ItemCard): void {
  dim(ctx);
  const b = ITEM_CARD.box;
  drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
  drawText(ctx, clipText(card.title, b.w - 2 * PAD), b.x + PAD, b.y + 12, UI.accent, 'left');
  card.rows.forEach(([label, value], i) => {
    const y = b.y + 34 + i * ROW;
    drawText(ctx, label, b.x + PAD, y, UI.dim, 'left');
    drawText(ctx, clipText(value, b.w - 2 * PAD - 90), b.x + b.w - PAD, y, UI.text, 'right');
  });
  let y = b.y + 34 + card.rows.length * ROW + 8;
  for (const row of wrapText(card.goodFor, b.w - 2 * PAD)) {
    drawText(ctx, row, b.x + PAD, y, UI.hint, 'left');
    y += TEXT_ROW;
  }
  drawButton(ctx, ITEM_CARD.back, 'BACK', 'raised');
}
