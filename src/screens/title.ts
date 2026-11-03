import type { Mode } from '../core/campaign';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame } from '../ui/frame';
import { defaultFont, drawText } from '../ui/text';
import { drawScene } from './titleart';

export interface TitleView {
  /** The game CONTINUE would resume, or null when there is no save. */
  continue: { mode: Mode; missionNumber: number; missionCount: number; soldiers: number; budget: number } | null;
  /** The first press of a button that would replace a save happened; a second one replaces it. */
  armed: Mode | null;
}

export const TITLE = {
  card: { x: 90, y: 50, w: 300, h: 260 },
  cont: { x: 160, y: 130, w: 160, h: 28 },
  campaign: { x: 160, y: 170, w: 160, h: 28 },
  tutorial: { x: 160, y: 210, w: 160, h: 28 },
} as const;

const inside = (b: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean =>
  px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h;

export function titleHit(px: number, py: number, hasContinue: boolean): 'continue' | 'campaign' | 'tutorial' | null {
  if (hasContinue && inside(TITLE.cont, px, py)) return 'continue';
  if (inside(TITLE.campaign, px, py)) return 'campaign';
  if (inside(TITLE.tutorial, px, py)) return 'tutorial';
  return null;
}

export function titleSummary(c: NonNullable<TitleView['continue']>): string {
  const mode = c.mode === 'campaign' ? 'CAMPAIGN' : 'TUTORIAL';
  return `${mode}: MISSION ${c.missionNumber} OF ${c.missionCount}, ${c.soldiers} ${c.soldiers === 1 ? 'SOLDIER' : 'SOLDIERS'}, ${c.budget} CR`;
}

export function drawTitle(ctx: CanvasRenderingContext2D, v: TitleView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawScene(ctx, { x: 0, y: 0, w: VIEW.width, h: VIEW.height }, { soldiers: 4, bleed: true });

  const c = TITLE.card;
  const mid = c.x + c.w / 2;
  // the logo: big letters with a hard shadow, a red laser line under them and a small line of what the game is
  defaultFont.draw(ctx, 'LASER TRIBUTE', mid + 3, 43, UI.dark, 'center', 3); // the shadows are not text runs of their own
  drawText(ctx, 'LASER TRIBUTE', mid, 40, UI.accent, 'center', defaultFont, 3);
  ctx.fillStyle = 'rgba(255,77,77,0.25)';
  ctx.fillRect(mid - 118, 67, 236, 5);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(mid - 116, 69, 232, 1);
  ctx.fillStyle = '#ffd0d0';
  ctx.fillRect(mid - 118, 68, 3, 3);
  ctx.fillRect(mid + 115, 68, 3, 3);
  defaultFont.draw(ctx, 'TURN-BASED SQUAD TACTICS', mid + 1, 79, UI.dark, 'center');
  drawText(ctx, 'TURN-BASED SQUAD TACTICS', mid, 78, UI.text, 'center');

  // a dark panel behind the buttons so they read over the scene
  const top = v.continue ? c.y + 46 : TITLE.campaign.y - 14;
  ctx.fillStyle = 'rgba(8,9,16,0.8)';
  ctx.fillRect(c.x + 8, top, c.w - 16, c.y + 236 - top);
  ctx.fillStyle = UI.light;
  ctx.fillRect(c.x + 8, top, c.w - 16, 1);
  ctx.fillRect(c.x + 8, c.y + 235, c.w - 16, 1);

  if (v.continue) {
    drawText(ctx, titleSummary(v.continue), c.x + c.w / 2, c.y + 60, UI.text, 'center');
    const k = TITLE.cont;
    drawButton(ctx, { x: k.x, y: k.y, w: k.w, h: k.h }, 'CONTINUE', 'raised');
  }
  const button = (b: { x: number; y: number; w: number; h: number }, label: string, armed: boolean): void => {
    if (armed) {
      drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
      drawText(ctx, 'REPLACE SAVE? PRESS AGAIN', b.x + b.w / 2, b.y + Math.floor((b.h - 7) / 2), UI.red, 'center');
    } else {
      drawButton(ctx, { x: b.x, y: b.y, w: b.w, h: b.h }, label, 'raised');
    }
  };
  button(TITLE.campaign, 'NEW CAMPAIGN', v.armed === 'campaign');
  button(TITLE.tutorial, 'TUTORIAL', v.armed === 'tutorial');
  drawText(
    ctx, `${v.continue ? 'ENTER CONTINUE   ' : ''}N NEW CAMPAIGN   T TUTORIAL`, c.x + c.w / 2, c.y + 220, UI.hint, 'center',
  );
}
