import { CONFIG, WEAPONS } from '../core/config';
import {
  LOADOUT, SQUAD_SIZE, loadoutCost, soldierCost, validateLoadout, type Loadout,
} from '../core/loadout';
import { describeStash, emptyStash, type Stash } from '../core/stash';
import type { WeaponId } from '../core/types';
import { VIEW } from '../render/layout';

export type EquipmentHit =
  | { kind: 'weapon' | 'minus' | 'plus' | 'clipMinus' | 'clipPlus'; index: number }
  | { kind: 'start' };

export interface EquipmentView {
  budget: number;
  title: string;
  breakdown: string;
  soldiers: { name: string; kills: number; rank?: string }[];
  stash: Stash;
}

export const DEFAULT_VIEW: EquipmentView = {
  budget: LOADOUT.budget,
  title: "EQUIPMENT - choose each soldier's kit",
  breakdown: '',
  soldiers: [],
  stash: emptyStash(),
};

/** The text lines beside a soldier's row: name, rank (if known), kills. */
export function soldierLines(who: { name: string; kills: number; rank?: string }): string[] {
  return who.rank ? [who.name, who.rank, `${who.kills} kills`] : [who.name, `${who.kills} kills`];
}

export const EQ = {
  rowTop: 56,
  rowStep: 52,
  btnH: 24,
  clipDy: 26,
  weapon: { x: 60, w: 90 },
  minus: { x: 250, w: 24 },
  plus: { x: 310, w: 24 },
  start: { x: 170, y: 300, w: 140, h: 30 },
} as const;

const rowY = (i: number) => EQ.rowTop + i * EQ.rowStep;
const inRect = (px: number, py: number, x: number, y: number, w: number, h: number) =>
  px >= x && px < x + w && py >= y && py < y + h;

function swapped(l: Loadout, i: number): WeaponId {
  return l[i].weapon === 'pistol' ? 'rifle' : 'pistol';
}

export function toggleBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  const after = l.map((s, j) => (j === i ? { ...s, weapon: swapped(l, i) } : s));
  const need = loadoutCost(after, stash) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleWeapon(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  if (toggleBlockReason(l, i, budget, stash)) return l;
  return l.map((s, j) => (j === i ? { ...s, weapon: swapped(l, i) } : s));
}

export function grenadeBlockReason(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  const next = l[i].grenades + delta;
  if (next < 0) return 'No grenades to remove';
  if (next > LOADOUT.maxGrenades) return `Max ${LOADOUT.maxGrenades} grenades`;
  if (delta === 1) {
    const after = l.map((s, j) => (j === i ? { ...s, grenades: next } : s));
    const need = loadoutCost(after, stash) - budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeGrenades(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  if (grenadeBlockReason(l, i, delta, budget, stash)) return l;
  return l.map((s, j) => (j === i ? { ...s, grenades: s.grenades + delta } : s));
}

export function clipBlockReason(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  const next = l[i].clips + delta;
  if (next < 1) return 'At least 1 spare clip';
  if (next > CONFIG.maxClips) return `Max ${CONFIG.maxClips} spare clips`;
  if (delta === 1) {
    const after = l.map((s, j) => (j === i ? { ...s, clips: next } : s));
    const need = loadoutCost(after, stash) - budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeClips(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  if (clipBlockReason(l, i, delta, budget, stash)) return l;
  return l.map((s, j) => (j === i ? { ...s, clips: s.clips + delta } : s));
}

export function equipmentHit(px: number, py: number): EquipmentHit | null {
  const s = EQ.start;
  if (inRect(px, py, s.x, s.y, s.w, s.h)) return { kind: 'start' };
  for (let i = 0; i < SQUAD_SIZE; i++) {
    const y = rowY(i);
    if (inRect(px, py, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH)) return { kind: 'weapon', index: i };
    if (inRect(px, py, EQ.minus.x, y, EQ.minus.w, EQ.btnH)) return { kind: 'minus', index: i };
    if (inRect(px, py, EQ.plus.x, y, EQ.plus.w, EQ.btnH)) return { kind: 'plus', index: i };
    const cy = y + EQ.clipDy;
    if (inRect(px, py, EQ.minus.x, cy, EQ.minus.w, EQ.btnH)) return { kind: 'clipMinus', index: i };
    if (inRect(px, py, EQ.plus.x, cy, EQ.plus.w, EQ.btnH)) return { kind: 'clipPlus', index: i };
  }
  return null;
}

export function blockReasonFor(
  l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  switch (hit.kind) {
    case 'weapon': return toggleBlockReason(l, hit.index, budget, stash);
    case 'minus': return grenadeBlockReason(l, hit.index, -1, budget, stash);
    case 'plus': return grenadeBlockReason(l, hit.index, 1, budget, stash);
    case 'clipMinus': return clipBlockReason(l, hit.index, -1, budget, stash);
    case 'clipPlus': return clipBlockReason(l, hit.index, 1, budget, stash);
    case 'start': return validateLoadout(l, budget, stash);
  }
}

export function applyEquipmentHit(
  l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  switch (hit.kind) {
    case 'weapon': return toggleWeapon(l, hit.index, budget, stash);
    case 'minus': return changeGrenades(l, hit.index, -1, budget, stash);
    case 'plus': return changeGrenades(l, hit.index, 1, budget, stash);
    case 'clipMinus': return changeClips(l, hit.index, -1, budget, stash);
    case 'clipPlus': return changeClips(l, hit.index, 1, budget, stash);
    case 'start': return l;
  }
}

function button(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, enabled: boolean, hot: boolean,
): void {
  ctx.fillStyle = !enabled ? '#1c1f2e' : hot ? '#4da6ff' : '#2a2f45';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = !enabled ? '#555a70' : hot ? '#000' : '#e8e8f0';
  ctx.fillText(label, x + 4, y + (h - 8) / 2);
}

export function drawEquipment(
  ctx: CanvasRenderingContext2D,
  l: Loadout,
  hover: EquipmentHit | null,
  view: EquipmentView = DEFAULT_VIEW,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const cost = loadoutCost(l, view.stash);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(view.title, 20, 8);
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Credits ${cost}/${view.budget}  (${view.budget - cost} left)`, 20, 22);
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(20, 34, 440, 8);
  ctx.fillStyle = cost <= view.budget ? '#4da6ff' : '#ff5555';
  ctx.fillRect(20, 34, 440 * Math.min(1, cost / view.budget), 8);
  ctx.fillStyle = '#6a6f88';
  ctx.fillText(view.breakdown, 20, 45);

  l.forEach((s, i) => {
    const y = rowY(i);
    const hot = (kind: Exclude<EquipmentHit['kind'], 'start'>) =>
      hover !== null && hover.kind !== 'start' && hover.kind === kind && hover.index === i;
    const who = view.soldiers[i];
    if (who) {
      soldierLines(who).forEach((line, n) => {
        ctx.fillStyle = n === 0 ? '#e8e8f0' : '#8a8fa8';
        ctx.fillText(line, 8, y + 3 + n * 11);
      });
    } else {
      ctx.fillStyle = '#e8e8f0';
      ctx.fillText(`P${i + 1}`, 8, y + 3);
    }
    button(
      ctx, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH,
      `${WEAPONS[s.weapon].name} (${LOADOUT.prices[s.weapon]})`,
      toggleBlockReason(l, i, view.budget, view.stash) === null, hot('weapon'),
    );
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText('Grenades', 180, y + 8);
    button(ctx, EQ.minus.x, y, EQ.minus.w, EQ.btnH, '-', grenadeBlockReason(l, i, -1, view.budget, view.stash) === null, hot('minus'));
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${s.grenades}`, 286, y + 8);
    button(ctx, EQ.plus.x, y, EQ.plus.w, EQ.btnH, '+', grenadeBlockReason(l, i, 1, view.budget, view.stash) === null, hot('plus'));
    const cy = y + EQ.clipDy;
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText('Spare clips', 180, cy + 8);
    button(ctx, EQ.minus.x, cy, EQ.minus.w, EQ.btnH, '-', clipBlockReason(l, i, -1, view.budget, view.stash) === null, hot('clipMinus'));
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${s.clips}`, 286, cy + 8);
    button(ctx, EQ.plus.x, cy, EQ.plus.w, EQ.btnH, '+', clipBlockReason(l, i, 1, view.budget, view.stash) === null, hot('clipPlus'));
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText(`${soldierCost(s)} cr`, 380, y + 8);
  });

  const reason = hover ? blockReasonFor(l, hover, view.budget, view.stash) : null;
  ctx.fillStyle = reason ? '#ff9a4d' : '#6a6f88';
  ctx.fillText(reason ?? 'Click a weapon to swap it; + and - for grenades and spare clips', 20, 272);

  const found = describeStash(view.stash);
  if (found) {
    ctx.fillStyle = '#7dff9a';
    ctx.fillText(`Found gear is free: ${found}`, 20, 286);
  }

  const valid = validateLoadout(l, view.budget, view.stash) === null;
  const st = EQ.start;
  button(ctx, st.x, st.y, st.w, st.h, 'START MISSION (Enter)', valid, hover?.kind === 'start');
}
