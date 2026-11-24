import { NO_ART, type Art } from '../art/planetimages';
import { BASE_RULES, NODES, bedCount, levelsOf, nodeById } from '../core/world/base';
import { incomePerDay, type World } from '../core/world/world';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { clipText, drawText } from '../ui/text';
import { SPRITE_SIZE, campLook, type CampArtId } from './campart';

export type BuildingId = 'lab' | 'barracks' | 'market' | 'training' | 'hospital' | 'wait' | 'planet';

export interface Building extends Rect {
  id: BuildingId;
  name: string;
}

/**
 * The camp as data: each building has a place on the 480x400 menu screen, laid out on the painted camp (a fenced
 * compound with paths in a cross). The painted camp draws a sprite and a label chip in each rectangle; a building
 * with no sprite draws a status tile there instead.
 */
export const BUILDINGS: readonly Building[] = [
  { id: 'lab', name: 'LAB', x: 45, y: 50, w: 130, h: 106 },
  { id: 'barracks', name: 'BARRACKS', x: 320, y: 50, w: 130, h: 106 },
  { id: 'market', name: 'MARKET', x: 45, y: 230, w: 130, h: 106 },
  { id: 'training', name: 'TRAINING', x: 222, y: 248, w: 68, h: 88 },
  { id: 'hospital', name: 'HOSPITAL', x: 326, y: 230, w: 130, h: 106 },
  { id: 'wait', name: 'WAIT', x: 258, y: 176, w: 56, h: 60 },
  { id: 'planet', name: 'BACK TO THE PLANET', x: 245, y: 348, w: 90, h: 50 },
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
      if (levels.training === 0) return ['NOT BUILT', 'RESEARCH IT FIRST'];
      const busy = w.soldiers.find((s) => s.status === 'training');
      return busy ? [busy.name.toUpperCase(), `${busy.daysLeft} DAYS LEFT`] : [`LEVEL ${levels.training}`, 'READY TO TRAIN'];
    }
    case 'hospital': {
      if (levels.hospital === 0) return ['NOT BUILT', 'RESEARCH IT FIRST'];
      return [`LEVEL ${levels.hospital}`, `${Math.round(BASE_RULES.hospitalChance[levels.hospital] * 100)}% SECOND CHANCE`];
    }
    case 'wait':
      return ['WAIT 1 OR 3 DAYS', `INCOME ${incomePerDay(w)} A DAY`];
    case 'planet':
      return [`DAY ${w.day}`, `CREDITS ${w.credits}`];
  }
}

const CHIP = 'rgba(8,10,18,0.85)';
/** Chip heights: three lines for the big buildings, two for the small ones. */
const CHIP_BIG = 34;
const CHIP_SMALL = 24;
const CHIP_GATE = 15;
const isSmall = (b: Building): boolean => b.w < 100 || b.id === 'planet';
const labelOf = (b: Building): string => (b.id === 'planet' ? 'PLANET' : b.name);

/** The status tile of a building that has no sprite (the camp's fallback, and the whole hub when there is no art). */
function drawTile(ctx: CanvasRenderingContext2D, b: Building, lines: string[]): void {
  const [first, second] = lines;
  if (isSmall(b)) {
    drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
    drawText(ctx, labelOf(b), b.x + b.w / 2, b.y + 8, UI.accent, 'center');
    drawText(ctx, clipText(b.id === 'planet' ? `${first}  ${second}` : first, b.w - 8), b.x + b.w / 2, b.y + 22, UI.text, 'center');
    return;
  }
  drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
  drawText(ctx, b.name, b.x + 8, b.y + 10, UI.accent, 'left');
  drawText(ctx, clipText(first, b.w - 16), b.x + 8, b.y + 36, UI.text, 'left');
  drawText(ctx, clipText(second, b.w - 16), b.x + 8, b.y + 50, UI.dim, 'left');
}

/** A dark label across the foot of a painted building, so its name and status read on any painting. */
function drawChip(ctx: CanvasRenderingContext2D, b: Building, lines: string[]): void {
  const small = isSmall(b);
  if (b.id === 'planet') {
    // the gate is painted into the backdrop: just say where it leads (the day and credits are in the header)
    const y = b.y; // the top of the gate area, clear of the sound hint along the bottom edge
    ctx.fillStyle = CHIP;
    ctx.fillRect(b.x, y, b.w, CHIP_GATE);
    drawText(ctx, 'TO THE PLANET', b.x + b.w / 2, y + 4, UI.accent, 'center');
    return;
  }
  const h = small ? CHIP_SMALL : CHIP_BIG;
  const y = b.y + b.h - h;
  ctx.fillStyle = CHIP;
  ctx.fillRect(b.x, y, b.w, h);
  drawText(ctx, labelOf(b), b.x + 4, y + 3, UI.accent, 'left');
  const [first, second] = lines;
  drawText(ctx, clipText(first, b.w - 8), b.x + 4, y + 13, UI.text, 'left');
  if (!small) drawText(ctx, clipText(second, b.w - 8), b.x + 4, y + 23, UI.dim, 'left');
}

export function drawBase(ctx: CanvasRenderingContext2D, w: World, notice: string, art: Art<CampArtId> = NO_ART): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const backdrop = art.image('camp_backdrop');
  if (backdrop) ctx.drawImage(backdrop, 0, 0, VIEW.width, VIEW.height);
  drawText(ctx, 'BASE', 18, 12, UI.accent, 'left');
  drawText(ctx, `DAY ${w.day}   ${w.credits} CR`, 462, 12, UI.text, 'right');
  const look = campLook(w);
  for (const b of BUILDINGS) {
    const lines = buildingStatus(w, b.id);
    const id = look[b.id];
    const image = id ? art.image(id) : null;
    if (image && id) {
      const size = SPRITE_SIZE[id];
      ctx.drawImage(image, b.x + Math.round((b.w - size.w) / 2), b.y, size.w, size.h);
      drawChip(ctx, b, lines);
    } else if (!id && backdrop) {
      drawChip(ctx, b, lines); // the fire is painted into the backdrop: just its label
    } else {
      drawTile(ctx, b, lines);
    }
  }
  // the notice and the hint live in the free band under the buildings, each on a dark strip over the painting
  if (notice) {
    if (backdrop) {
      ctx.fillStyle = CHIP;
      ctx.fillRect(12, 348, 228, 15);
    }
    drawText(ctx, clipText(notice.toUpperCase(), 220), 16, 352, UI.accent, 'left');
  }
  if (backdrop) {
    ctx.fillStyle = CHIP; // keep the hint readable over the fence
    ctx.fillRect(14, 380, 160, 15);
  }
  drawText(ctx, 'TAP A BUILDING TO OPEN IT', 20, 384, UI.hint, 'left');
}
