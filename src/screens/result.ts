import type { MissionResult } from '../core/result';
import { VIEW } from '../render/layout';
import { ADVANCE } from '../ui/font';
import { UI, drawButton, drawFrame } from '../ui/frame';
import { clipText, drawText } from '../ui/text';

export interface ResultView {
  result: MissionResult;
  missionName: string;
  fallen: string[];
  /** Budget for the next mission, or null when the campaign is over. */
  nextBudget: number | null;
  /** 'Name (Rank)' for each soldier promoted by this mission. */
  promoted: string[];
}

export const RESULT = {
  card: { x: 110, y: 50, w: 260, h: 210 },
  again: { x: 190, y: 222, w: 100, h: 26 },
} as const;

/** One line per promotion, at most four, so no name is cut off. */
export function promotionLines(promoted: string[]): string[] {
  return promoted.slice(0, 4).map((p) => `Promoted: ${p}`);
}

export function resultHit(px: number, py: number): 'again' | null {
  const b = RESULT.again;
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h ? 'again' : null;
}

export function drawResult(ctx: CanvasRenderingContext2D, v: ResultView): void {
  const r = v.result;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = RESULT.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 28, 'inset');
  drawText(ctx, r.won ? 'MISSION COMPLETE' : 'MISSION FAILED', c.x + c.w / 2, c.y + 12, r.won ? UI.green : UI.red, 'center');
  drawText(ctx, v.missionName, c.x + c.w / 2, c.y + 24, UI.dim, 'center');

  const x = c.x + 30;
  const room = c.w - 30 - 8; // 222 px of card to the right of the text start
  drawText(ctx, `Survivors     ${r.survivors} of ${r.squadSize}`, x, c.y + 52, UI.text);
  drawText(ctx, `Enemies down  ${r.enemiesKilled} of ${r.enemyCount}`, x, c.y + 68, UI.text);
  drawText(ctx, `Turns taken   ${r.turns}`, x, c.y + 84, UI.text);
  const fallen = v.fallen.length > 0 ? v.fallen.join(', ') : 'none';
  drawText(ctx, `Fallen: ${clipText(fallen, room - 'Fallen: '.length * ADVANCE)}`, x, c.y + 100, UI.text);
  drawText(
    ctx, v.nextBudget === null ? 'The campaign is over' : `Next mission budget: ${v.nextBudget}`,
    x, c.y + 116, UI.accent,
  );
  promotionLines(v.promoted).forEach((line, i) => {
    drawText(ctx, clipText(line, room), x, c.y + 128 + i * 10, UI.green);
  });

  const b = RESULT.again;
  drawButton(ctx, { x: b.x, y: b.y, w: b.w, h: b.h }, 'CONTINUE (Enter)', 'raised');
}
