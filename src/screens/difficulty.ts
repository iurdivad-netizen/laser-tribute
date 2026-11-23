import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../core/world/difficulty';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { drawText } from '../ui/text';

export const DIFFICULTY_SCREEN = {
  card: { x: 90, y: 40, w: 300, h: 300 },
  calm: { x: 120, y: 100, w: 240, h: 42 },
  standard: { x: 120, y: 156, w: 240, h: 42 },
  pressure: { x: 120, y: 212, w: 240, h: 42 },
  back: { x: 190, y: 290, w: 100, h: 24 },
} as const satisfies Record<string, Rect>;

const inside = (b: Rect, px: number, py: number, slop: number): boolean =>
  px >= b.x - slop && px < b.x + b.w + slop && py >= b.y - slop && py < b.y + b.h + slop;

/** Which preset button (or BACK) a menu-space point is on; the slop widens each by that many pixels (the gap is 14). */
export function difficultyHit(px: number, py: number, slop = 0): DifficultyId | 'back' | null {
  for (const id of DIFFICULTY_IDS) if (inside(DIFFICULTY_SCREEN[id], px, py, slop)) return id;
  return inside(DIFFICULTY_SCREEN.back, px, py, slop) ? 'back' : null;
}

export function drawDifficulty(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const c = DIFFICULTY_SCREEN.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'inset');
  drawText(ctx, 'HOW HARD DOES THE PLANET', c.x + c.w / 2, c.y + 20, UI.accent, 'center');
  drawText(ctx, 'PUSH BACK?', c.x + c.w / 2, c.y + 32, UI.accent, 'center');
  for (const id of DIFFICULTY_IDS) {
    const b = DIFFICULTY_SCREEN[id];
    drawButton(ctx, b, '', 'raised');
    drawText(ctx, DIFFICULTIES[id].name, b.x + b.w / 2, b.y + 9, UI.text, 'center');
    drawText(ctx, DIFFICULTIES[id].blurb.toUpperCase(), b.x + b.w / 2, b.y + 24, UI.dim, 'center');
  }
  drawButton(ctx, DIFFICULTY_SCREEN.back, 'BACK', 'raised');
}
