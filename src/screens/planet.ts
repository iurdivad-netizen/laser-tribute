import { CAPITAL_REGION, REGIONS } from '../core/world/planet';
import { RECIPES } from '../core/gen';
import { DAYS, DIFFICULTIES } from '../core/world/difficulty';
import {
  canAttack, canVisit, capitalOpen, regionsHeld, type Holder, type World,
} from '../core/world/world';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { clipText, drawText } from '../ui/text';

/** Where things are on the planet screen, in the 480x400 menu space. Region positions are relative to `map`. */
export const PLANET = {
  map: { x: 6, y: 22, w: 330, h: 372 },
  panel: { x: 342, y: 22, w: 132, h: 372 },
  act: { x: 350, y: 290, w: 116, h: 28 },
  abandon: { x: 350, y: 326, w: 116, h: 22 },
  back: { x: 350, y: 358, w: 116, h: 22 },
} as const satisfies Record<string, Rect>;

/** BACK on the story equipment screen: returns to the planet without fighting. Menu space; clear of the equipment rows. */
export const STORY_EQUIPMENT_BACK = { x: 20, y: 330, w: 80, h: 30 } as const satisfies Rect;

export const storyEquipmentBackHit = (px: number, py: number, slop = 0): boolean =>
  inside(STORY_EQUIPMENT_BACK, px, py, slop);

export interface PlanetView {
  world: World;
  selected: number | null;
  /** The first press of ABANDON happened; a second one ends the story. */
  armedAbandon: boolean;
  /** A line of news (loot found, an ally gained); empty for none. */
  notice: string;
}

export type PlanetHit = { kind: 'region'; id: number } | { kind: 'act' } | { kind: 'abandon' } | { kind: 'back' };

const REGION_HIT = 10;

const inside = (b: Rect, px: number, py: number, slop: number): boolean =>
  px >= b.x - slop && px < b.x + b.w + slop && py >= b.y - slop && py < b.y + b.h + slop;

/** What a menu-space point is on: the nearest region within reach, or a button. The slop widens everything for a finger. */
export function planetHit(px: number, py: number, slop = 0): PlanetHit | null {
  let best: number | null = null;
  let bestDist = REGION_HIT + slop;
  for (const r of REGIONS) {
    const d = Math.hypot(px - (PLANET.map.x + r.x), py - (PLANET.map.y + r.y));
    if (d <= bestDist) { best = r.id; bestDist = d; }
  }
  if (best !== null) return { kind: 'region', id: best };
  if (inside(PLANET.act, px, py, slop)) return { kind: 'act' };
  if (inside(PLANET.abandon, px, py, slop)) return { kind: 'abandon' };
  if (inside(PLANET.back, px, py, slop)) return { kind: 'back' };
  return null;
}

/** The action button's label for the selected region, or null when nothing can be done there. */
export function actLabel(v: PlanetView): string | null {
  const id = v.selected;
  if (id === null) return null;
  if (canAttack(v.world, id)) return 'ATTACK';
  if (canVisit(v.world, id)) return 'VISIT';
  if (id === CAPITAL_REGION && v.world.regions[id].holder === 'enemy' && !capitalOpen(v.world)) return 'LOCKED';
  return null;
}

const HOLDER_COLOUR: Record<Holder, string> = {
  enemy: UI.red, player: UI.green, allied: UI.blue, neutral: UI.accent, wild: UI.dim,
};
const HOLDER_TEXT: Record<Holder, string> = {
  enemy: 'ENEMY-HELD', player: 'YOURS', allied: 'ALLIED', neutral: 'NEUTRAL SETTLEMENT', wild: 'WILDERNESS',
};

/** A few stable specks so the plain map backdrop does not look empty; placeholder art until project 3. */
function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  const m = PLANET.map;
  ctx.fillStyle = '#0d1824';
  ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.fillStyle = '#13243a';
  for (let i = 0; i < 70; i++) {
    const x = m.x + 4 + ((i * 97 + 13) % (m.w - 8));
    const y = m.y + 4 + ((i * 53 + 29) % (m.h - 8));
    ctx.fillRect(x, y, 2, 1);
  }
}

export function drawPlanet(ctx: CanvasRenderingContext2D, v: PlanetView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const w = v.world;
  drawText(ctx, `STORY: ${DIFFICULTIES[w.difficulty].name}`, 8, 8, UI.accent, 'left');
  drawBackdrop(ctx);
  drawFrame(ctx, PLANET.map.x - 2, PLANET.map.y - 2, PLANET.map.w + 4, PLANET.map.h + 4, 'inset');
  const pos = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });

  for (const r of REGIONS) {
    for (const l of r.links) {
      if (l < r.id) continue;
      const a = pos(r.id);
      const b = pos(l);
      const friendly = ['player', 'allied'].includes(w.regions[r.id].holder) && ['player', 'allied'].includes(w.regions[l].holder);
      ctx.strokeStyle = friendly ? UI.green : UI.hint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  for (const r of REGIONS) {
    const p = pos(r.id);
    const size = r.id === CAPITAL_REGION ? 13 : 9;
    ctx.fillStyle = UI.black;
    ctx.fillRect(p.x - size / 2 - 1, p.y - size / 2 - 1, size + 2, size + 2);
    ctx.fillStyle = HOLDER_COLOUR[w.regions[r.id].holder];
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    if (r.id === v.selected) {
      ctx.strokeStyle = UI.text;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - size / 2 - 3, p.y - size / 2 - 3, size + 6, size + 6);
    }
  }

  const P = PLANET.panel;
  drawFrame(ctx, P.x, P.y, P.w, P.h, 'raised');
  const col = P.x + 8;
  const maxPx = P.w - 14;
  drawText(ctx, `DAY ${w.day}`, col, P.y + 10, UI.text, 'left');
  drawText(ctx, `HELD ${regionsHeld(w)}   ${w.credits} CR`, col, P.y + 22, UI.dim, 'left');
  const sel = v.selected;
  if (sel !== null) {
    const r = REGIONS[sel];
    const s = w.regions[sel];
    drawText(ctx, clipText(r.name.toUpperCase(), maxPx), col, P.y + 44, UI.accent, 'left');
    drawText(ctx, clipText(HOLDER_TEXT[s.holder], maxPx), col, P.y + 56, HOLDER_COLOUR[s.holder], 'left');
    if (s.holder === 'enemy' || r.kind === 'start') {
      drawText(ctx, `${s.garrison} ENEMIES`, col, P.y + 72, UI.text, 'left');
      drawText(ctx, clipText(`MAP: ${RECIPES[r.type].name.toUpperCase()}`, maxPx), col, P.y + 84, UI.dim, 'left');
    }
    if (sel === CAPITAL_REGION && s.holder === 'enemy') {
      drawText(ctx, 'HOLD 2 GATES FIRST', col, P.y + 100, UI.hint, 'left');
    }
    const label = actLabel(v);
    if (label === 'ATTACK') drawText(ctx, `${DAYS.attack} DAYS`, col, P.y + 100, UI.dim, 'left');
    if (label === 'VISIT') drawText(ctx, `${DAYS.visit} DAYS`, col, P.y + 100, UI.dim, 'left');
  } else {
    drawText(ctx, 'PICK A REGION', col, P.y + 44, UI.hint, 'left');
  }
  if (v.notice) drawText(ctx, clipText(v.notice.toUpperCase(), maxPx), col, P.y + 250, UI.accent, 'left');
  const label = actLabel(v);
  drawButton(ctx, PLANET.act, label ?? 'NO ACTION', label === 'ATTACK' || label === 'VISIT' ? 'raised' : 'disabled');
  if (v.armedAbandon) {
    drawFrame(ctx, PLANET.abandon.x, PLANET.abandon.y, PLANET.abandon.w, PLANET.abandon.h, 'raised');
    drawText(ctx, 'ERASE? PRESS AGAIN', PLANET.abandon.x + PLANET.abandon.w / 2, PLANET.abandon.y + 8, UI.red, 'center');
  } else {
    drawButton(ctx, PLANET.abandon, 'ABANDON', 'raised');
  }
  drawButton(ctx, PLANET.back, 'BACK', 'raised');
}
