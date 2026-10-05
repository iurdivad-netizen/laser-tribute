import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame } from '../ui/frame';
import { drawText } from '../ui/text';

export interface TitleView {
  missionNumber: number;
  missionCount: number;
  soldiers: number;
  budget: number;
  /** The first press of NEW CAMPAIGN happened; a second one replaces the save. */
  armed: boolean;
}

export const TITLE = {
  card: { x: 90, y: 70, w: 300, h: 220 },
  cont: { x: 160, y: 160, w: 160, h: 28 },
  fresh: { x: 160, y: 200, w: 160, h: 28 },
} as const;

const inside = (b: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean =>
  px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

export function titleHit(px: number, py: number): 'continue' | 'new' | null {
  if (inside(TITLE.cont, px, py)) return 'continue';
  if (inside(TITLE.fresh, px, py)) return 'new';
  return null;
}

export function titleSummary(v: TitleView): string {
  return `MISSION ${v.missionNumber} OF ${v.missionCount}, ${v.soldiers} ${v.soldiers === 1 ? 'SOLDIER' : 'SOLDIERS'}, ${v.budget} CR`;
}

export function drawTitle(ctx: CanvasRenderingContext2D, v: TitleView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = TITLE.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 30, 'inset');
  drawText(ctx, 'LASER TRIBUTE', c.x + c.w / 2, c.y + 20, UI.accent, 'center');
  drawText(ctx, titleSummary(v), c.x + c.w / 2, c.y + 60, UI.text, 'center');

  const k = TITLE.cont;
  drawButton(ctx, { x: k.x, y: k.y, w: k.w, h: k.h }, 'CONTINUE', 'raised');
  const n = TITLE.fresh;
  if (v.armed) {
    drawFrame(ctx, n.x, n.y, n.w, n.h, 'raised');
    drawText(ctx, 'REPLACE SAVE? PRESS AGAIN', n.x + n.w / 2, n.y + Math.floor((n.h - 7) / 2), UI.red, 'center');
  } else {
    drawButton(ctx, { x: n.x, y: n.y, w: n.w, h: n.h }, 'NEW CAMPAIGN', 'raised');
  }
  drawText(ctx, 'ENTER CONTINUE   N NEW CAMPAIGN', c.x + c.w / 2, c.y + 180, UI.hint, 'center');
}
