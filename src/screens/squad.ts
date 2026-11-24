import { rankFor, rankShort } from '../core/ranks';
import { BASE_RULES } from '../core/world/base';
import type { World } from '../core/world/world';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { clipText, drawText } from '../ui/text';
import { NAME_W } from './baseinfo';

/** The squad step: the barracks as a list (up to 12 beds), tap the ready soldiers you want, then START. */
export const SQUAD = {
  rows: Array.from({ length: 12 }, (_, i): Rect => ({ x: 18, y: 32 + i * 22, w: 444, h: 20 })),
  auto: { x: 18, y: 340, w: 130, h: 30 },
  start: { x: 175, y: 340, w: 130, h: 30 },
  back: { x: 332, y: 340, w: 130, h: 30 },
} as const;

export type SquadHit = { kind: 'soldier'; name: string } | { kind: 'card'; name: string } | { kind: 'auto' } | { kind: 'start' } | { kind: 'back' };

const inside = (b: Rect, px: number, py: number, slop: number): boolean =>
  px >= b.x - slop && px < b.x + b.w + slop && py >= b.y - slop && py < b.y + b.h + slop;

/** A ready soldier's row, or a button; training and wounded soldiers cannot be picked. */
export function squadHit(px: number, py: number, w: World, slop = 0): SquadHit | null {
  for (let i = 0; i < SQUAD.rows.length; i++) {
    if (inside(SQUAD.rows[i], px, py, 0)) {
      const s = w.soldiers[i];
      if (s && px < SQUAD.rows[i].x + NAME_W) return { kind: 'card', name: s.name }; // the name opens the soldier's card, whatever the status
      return s && s.status === 'ready' ? { kind: 'soldier', name: s.name } : null;
    }
  }
  if (inside(SQUAD.auto, px, py, slop)) return { kind: 'auto' };
  if (inside(SQUAD.start, px, py, slop)) return { kind: 'start' };
  if (inside(SQUAD.back, px, py, slop)) return { kind: 'back' };
  return null;
}

export function drawSquad(ctx: CanvasRenderingContext2D, w: World, picked: string[]): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawText(ctx, 'PICK YOUR SQUAD', 18, 12, UI.accent, 'left');
  const real = picked.filter((n) => w.soldiers.some((s) => s.name === n && s.status === 'ready')).length;
  drawText(ctx, `${real} OF 4`, 462, 12, UI.text, 'right');
  w.soldiers.forEach((s, i) => {
    const r = SQUAD.rows[i];
    if (!r) return;
    const ready = s.status === 'ready';
    const on = picked.includes(s.name);
    drawFrame(ctx, r.x, r.y, r.w, r.h, !ready ? 'disabled' : on ? 'hover' : 'raised');
    const rank = rankShort(rankFor(s.kills + s.trained).name).toUpperCase();
    drawText(ctx, clipText(`${on ? '> ' : '  '}${s.name.toUpperCase()} ${rank}`, 220), r.x + 8, r.y + 6, ready ? UI.text : UI.disabledText, 'left');
    const detail = ready ? `K${s.kills}` : `${s.status.toUpperCase()} ${s.daysLeft}D`;
    drawText(ctx, clipText(detail, 200), r.x + r.w - 8, r.y + 6, ready ? UI.dim : UI.disabledText, 'right');
  });
  const loaned = 4 - real;
  if (loaned > 0) {
    drawText(ctx, `LOANED: ${loaned}`, 18, 308, UI.accent, 'left');
    drawText(ctx, `FEE ${BASE_RULES.mercFee * loaned} CR`, 120, 308, UI.dim, 'left');
  }
  drawButton(ctx, SQUAD.auto, 'AUTO', 'raised');
  drawButton(ctx, SQUAD.start, 'EQUIP', 'raised');
  drawButton(ctx, SQUAD.back, 'BACK', 'raised');
}
