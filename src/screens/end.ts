import { VIEW } from '../render/layout';
import { ADVANCE } from '../ui/font';
import { UI, drawButton, drawFrame } from '../ui/frame';
import { clipText, drawText } from '../ui/text';

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
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = END.card;
  drawFrame(ctx, c.x, c.y, c.w, c.h, 'raised');
  drawFrame(ctx, c.x + 8, c.y + 8, c.w - 16, 30, 'inset');
  drawText(ctx, v.won ? 'CAMPAIGN COMPLETE' : 'CAMPAIGN LOST', c.x + c.w / 2, c.y + 20, v.won ? UI.green : UI.red, 'center');

  const x = c.x + 30;
  const room = c.w - 30 - 8; // 262 px
  drawText(ctx, `Missions won  ${v.missionsWon} of ${v.missionCount}`, x, c.y + 60, UI.text);
  drawText(ctx, `Total kills   ${v.totalKills}`, x, c.y + 80, UI.text);
  const survivors = v.survivors.length > 0 ? v.survivors.join(', ') : 'none';
  drawText(ctx, `Survivors: ${clipText(survivors, room - 'Survivors: '.length * ADVANCE)}`, x, c.y + 110, UI.text);
  const fallenLabel = `Fallen (${v.fallen.length}): `;
  const fallen = v.fallen.length > 0 ? v.fallen.join(', ') : 'none';
  drawText(ctx, `${fallenLabel}${clipText(fallen, room - fallenLabel.length * ADVANCE)}`, x, c.y + 130, UI.text);

  const b = END.again;
  drawButton(ctx, { x: b.x, y: b.y, w: b.w, h: b.h }, 'NEW CAMPAIGN (Enter)', 'raised');
}
