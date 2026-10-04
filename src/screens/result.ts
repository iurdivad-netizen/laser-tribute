import type { MissionResult } from '../core/result';
import { VIEW } from '../render/layout';
import { clip } from './end';

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
  ctx.fillStyle = '#14161f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = '#3a3f55';
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = r.won ? '#7dff9a' : '#ff5555';
  ctx.fillText(r.won ? 'MISSION COMPLETE' : 'MISSION FAILED', c.x + c.w / 2, c.y + 14);
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(v.missionName, c.x + c.w / 2, c.y + 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`Survivors     ${r.survivors} of ${r.squadSize}`, c.x + 30, c.y + 52);
  ctx.fillText(`Enemies down  ${r.enemiesKilled} of ${r.enemyCount}`, c.x + 30, c.y + 68);
  ctx.fillText(`Turns taken   ${r.turns}`, c.x + 30, c.y + 84);
  ctx.fillText(`Fallen: ${clip(v.fallen.length > 0 ? v.fallen.join(', ') : 'none', 30)}`, c.x + 30, c.y + 100);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(
    v.nextBudget === null ? 'The campaign is over' : `Next mission budget: ${v.nextBudget}`,
    c.x + 30, c.y + 116,
  );
  ctx.fillStyle = '#7dff9a';
  promotionLines(v.promoted).forEach((line, i) => {
    ctx.fillText(clip(line, 44), c.x + 30, c.y + 128 + i * 10);
  });

  const b = RESULT.again;
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#000';
  ctx.fillText('CONTINUE (Enter)', b.x + 6, b.y + (b.h - 8) / 2);
}
