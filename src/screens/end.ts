import { VIEW } from '../render/layout';

export interface EndView {
  won: boolean;
  missionsWon: number;
  missionCount: number;
  /** Kills by the roster and the fallen together. */
  totalKills: number;
  survivors: string[];
  fallen: string[];
}

export const END = {
  card: { x: 90, y: 30, w: 300, h: 260 },
  again: { x: 175, y: 240, w: 130, h: 26 },
} as const;

export function endHit(px: number, py: number): 'new' | null {
  const b = END.again;
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h ? 'new' : null;
}

/** Shortens text to at most `max` characters, ending in "..." when it was cut. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

export function drawCampaignEnd(ctx: CanvasRenderingContext2D, v: EndView): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = END.card;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = '#3a3f55';
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = v.won ? '#7dff9a' : '#ff5555';
  ctx.fillText(v.won ? 'CAMPAIGN COMPLETE' : 'CAMPAIGN LOST', c.x + c.w / 2, c.y + 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`Missions won  ${v.missionsWon} of ${v.missionCount}`, c.x + 30, c.y + 60);
  ctx.fillText(`Total kills   ${v.totalKills}`, c.x + 30, c.y + 80);
  ctx.fillText(
    `Survivors: ${clip(v.survivors.length > 0 ? v.survivors.join(', ') : 'none', 38)}`,
    c.x + 30, c.y + 110,
  );
  ctx.fillText(
    `Fallen (${v.fallen.length}): ${clip(v.fallen.length > 0 ? v.fallen.join(', ') : 'none', 34)}`,
    c.x + 30, c.y + 130,
  );

  const b = END.again;
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#000';
  ctx.fillText('NEW CAMPAIGN (Enter)', b.x + 6, b.y + (b.h - 8) / 2);
}
