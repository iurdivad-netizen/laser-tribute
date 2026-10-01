import type { MissionResult } from '../core/result';
import { VIEW } from '../render/layout';

export const RESULT = {
  card: { x: 110, y: 70, w: 260, h: 180 },
  again: { x: 190, y: 200, w: 100, h: 26 },
} as const;

export function resultHit(px: number, py: number): 'again' | null {
  const b = RESULT.again;
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h ? 'again' : null;
}

export function drawResult(ctx: CanvasRenderingContext2D, r: MissionResult): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = RESULT.card;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = '#3a3f55';
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = r.won ? '#7dff9a' : '#ff5555';
  ctx.fillText(r.won ? 'MISSION COMPLETE' : 'MISSION FAILED', c.x + 70, c.y + 20);
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`Survivors     ${r.survivors} of ${r.squadSize}`, c.x + 50, c.y + 60);
  ctx.fillText(`Enemies down  ${r.enemiesKilled} of ${r.enemyCount}`, c.x + 50, c.y + 80);
  ctx.fillText(`Turns taken   ${r.turns}`, c.x + 50, c.y + 100);

  const b = RESULT.again;
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#000';
  ctx.fillText('PLAY AGAIN (Enter)', b.x + 6, b.y + (b.h - 8) / 2);
}
