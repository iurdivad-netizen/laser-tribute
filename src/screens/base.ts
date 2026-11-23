import { BASE_RULES, NODES, bedCount, levelsOf, nodeById } from '../core/world/base';
import { incomePerDay, type World } from '../core/world/world';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { clipText, drawText } from '../ui/text';

export type BuildingId = 'lab' | 'barracks' | 'market' | 'training' | 'hospital' | 'wait' | 'planet';

export interface Building extends Rect {
  id: BuildingId;
  name: string;
}

/**
 * The base as data: each building has a place on the 480x400 menu screen. The hub draws them as status tiles; a later
 * version can draw a base map from the same list without touching the rules.
 */
export const BUILDINGS: readonly Building[] = [
  { id: 'lab', name: 'LAB', x: 18, y: 34, w: 140, h: 92 },
  { id: 'barracks', name: 'BARRACKS', x: 170, y: 34, w: 140, h: 92 },
  { id: 'market', name: 'MARKET', x: 322, y: 34, w: 140, h: 92 },
  { id: 'training', name: 'TRAINING', x: 18, y: 138, w: 140, h: 92 },
  { id: 'hospital', name: 'HOSPITAL', x: 170, y: 138, w: 140, h: 92 },
  { id: 'wait', name: 'WAIT', x: 322, y: 138, w: 140, h: 92 },
  { id: 'planet', name: 'BACK TO THE PLANET', x: 18, y: 242, w: 444, h: 48 },
];

const inside = (b: Rect, px: number, py: number, slop: number): boolean =>
  px >= b.x - slop && px < b.x + b.w + slop && py >= b.y - slop && py < b.y + b.h + slop;

/** Which building a menu-space point is on; the slop widens each by that many pixels (the gaps are 12, so keep it under 6). */
export function baseHit(px: number, py: number, slop = 0): BuildingId | null {
  for (const b of BUILDINGS) if (inside(b, px, py, slop)) return b.id;
  return null;
}

/** Two short lines (at most 22 characters) saying what is going on in a building. */
export function buildingStatus(w: World, id: BuildingId): string[] {
  const done = w.research.done;
  const levels = levelsOf(done);
  switch (id) {
    case 'lab': {
      const active = w.research.active;
      if (active) return [`RESEARCHING ${active.daysLeft}D`, nodeById(active.node)!.name.toUpperCase()];
      const open = NODES.filter((n) => !done.includes(n.id) && n.needs.every((d) => done.includes(d))).length;
      return ['IDLE', `${open} PROJECTS OPEN`];
    }
    case 'barracks':
      return [`SOLDIERS ${w.soldiers.length}/${bedCount(done)}`, `${w.soldiers.filter((s) => s.status === 'ready').length} READY`];
    case 'market': {
      const locked = NODES.filter((n) => !done.includes(n.id) && (n.gives.weapon || n.gives.throwable || n.gives.gadget || n.gives.attachment)).length;
      return [`PREMIUM +${Math.round((BASE_RULES.premium - 1) * 100)}%`, `${locked} ITEMS LOCKED`];
    }
    case 'training': {
      if (levels.training === 0) return ['NOT BUILT', 'RESEARCH IT IN THE LAB'];
      const busy = w.soldiers.find((s) => s.status === 'training');
      return busy ? [busy.name.toUpperCase(), `${busy.daysLeft} DAYS LEFT`] : [`LEVEL ${levels.training}`, 'READY TO TRAIN'];
    }
    case 'hospital': {
      if (levels.hospital === 0) return ['NOT BUILT', 'RESEARCH IT IN THE LAB'];
      return [`LEVEL ${levels.hospital}`, `${Math.round(BASE_RULES.hospitalChance[levels.hospital] * 100)}% SECOND CHANCE`];
    }
    case 'wait':
      return ['WAIT 1 OR 3 DAYS', `INCOME ${incomePerDay(w)} A DAY`];
    case 'planet':
      return [`DAY ${w.day}`, `CREDITS ${w.credits}`];
  }
}

export function drawBase(ctx: CanvasRenderingContext2D, w: World, notice: string): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawText(ctx, 'BASE', 18, 12, UI.accent, 'left');
  drawText(ctx, `DAY ${w.day}   ${w.credits} CR`, 462, 12, UI.text, 'right');
  for (const b of BUILDINGS) {
    const [first, second] = buildingStatus(w, b.id);
    if (b.id === 'planet') {
      drawButton(ctx, b, b.name, 'raised');
      drawText(ctx, `${first}   ${second}`, b.x + b.w / 2, b.y + b.h - 14, UI.dim, 'center');
      continue;
    }
    drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
    drawText(ctx, b.name, b.x + 8, b.y + 10, UI.accent, 'left');
    drawText(ctx, clipText(first, b.w - 16), b.x + 8, b.y + 36, UI.text, 'left');
    drawText(ctx, clipText(second, b.w - 16), b.x + 8, b.y + 50, UI.dim, 'left');
  }
  if (notice) drawText(ctx, clipText(notice.toUpperCase(), 440), 20, 304, UI.accent, 'left');
  drawText(ctx, 'TAP A TILE TO OPEN IT', 20, 372, UI.hint, 'left');
}
