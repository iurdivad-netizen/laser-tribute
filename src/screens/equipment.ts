import { WEAPONS } from '../core/config';
import {
  LOADOUT, SQUAD_SIZE, loadoutCost, soldierCost, validateLoadout, type Loadout,
} from '../core/loadout';
import type { WeaponId } from '../core/types';
import { VIEW } from '../render/layout';

export type EquipmentHit =
  | { kind: 'weapon' | 'minus' | 'plus'; index: number }
  | { kind: 'start' };

export const EQ = {
  rowTop: 56,
  rowStep: 52,
  btnH: 24,
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

export function toggleBlockReason(l: Loadout, i: number): string | null {
  const extra = LOADOUT.prices[swapped(l, i)] - LOADOUT.prices[l[i].weapon];
  const need = loadoutCost(l) + extra - LOADOUT.budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleWeapon(l: Loadout, i: number): Loadout {
  if (toggleBlockReason(l, i)) return l;
  return l.map((s, j) => (j === i ? { ...s, weapon: swapped(l, i) } : s));
}

export function grenadeBlockReason(l: Loadout, i: number, delta: 1 | -1): string | null {
  const next = l[i].grenades + delta;
  if (next < 0) return 'No grenades to remove';
  if (next > LOADOUT.maxGrenades) return `Max ${LOADOUT.maxGrenades} grenades`;
  if (delta === 1) {
    const need = loadoutCost(l) + LOADOUT.prices.grenade - LOADOUT.budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeGrenades(l: Loadout, i: number, delta: 1 | -1): Loadout {
  if (grenadeBlockReason(l, i, delta)) return l;
  return l.map((s, j) => (j === i ? { ...s, grenades: s.grenades + delta } : s));
}

export function equipmentHit(px: number, py: number): EquipmentHit | null {
  const s = EQ.start;
  if (inRect(px, py, s.x, s.y, s.w, s.h)) return { kind: 'start' };
  for (let i = 0; i < SQUAD_SIZE; i++) {
    const y = rowY(i);
    if (inRect(px, py, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH)) return { kind: 'weapon', index: i };
    if (inRect(px, py, EQ.minus.x, y, EQ.minus.w, EQ.btnH)) return { kind: 'minus', index: i };
    if (inRect(px, py, EQ.plus.x, y, EQ.plus.w, EQ.btnH)) return { kind: 'plus', index: i };
  }
  return null;
}

export function blockReasonFor(l: Loadout, hit: EquipmentHit): string | null {
  switch (hit.kind) {
    case 'weapon': return toggleBlockReason(l, hit.index);
    case 'minus': return grenadeBlockReason(l, hit.index, -1);
    case 'plus': return grenadeBlockReason(l, hit.index, 1);
    case 'start': return validateLoadout(l);
  }
}

export function applyEquipmentHit(l: Loadout, hit: EquipmentHit): Loadout {
  switch (hit.kind) {
    case 'weapon': return toggleWeapon(l, hit.index);
    case 'minus': return changeGrenades(l, hit.index, -1);
    case 'plus': return changeGrenades(l, hit.index, 1);
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
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const cost = loadoutCost(l);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText("EQUIPMENT - choose each soldier's kit", 20, 8);
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Credits ${cost}/${LOADOUT.budget}  (${LOADOUT.budget - cost} left)`, 20, 22);
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(20, 34, 440, 8);
  ctx.fillStyle = cost <= LOADOUT.budget ? '#4da6ff' : '#ff5555';
  ctx.fillRect(20, 34, 440 * Math.min(1, cost / LOADOUT.budget), 8);

  l.forEach((s, i) => {
    const y = rowY(i);
    const hot = (kind: 'weapon' | 'minus' | 'plus') =>
      hover !== null && hover.kind !== 'start' && hover.kind === kind && hover.index === i;
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`P${i + 1}`, 20, y + 8);
    button(
      ctx, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH,
      `${WEAPONS[s.weapon].name} (${LOADOUT.prices[s.weapon]})`,
      toggleBlockReason(l, i) === null, hot('weapon'),
    );
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText('Grenades', 180, y + 8);
    button(ctx, EQ.minus.x, y, EQ.minus.w, EQ.btnH, '-', grenadeBlockReason(l, i, -1) === null, hot('minus'));
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${s.grenades}`, 286, y + 8);
    button(ctx, EQ.plus.x, y, EQ.plus.w, EQ.btnH, '+', grenadeBlockReason(l, i, 1) === null, hot('plus'));
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText(`${soldierCost(s)} cr`, 380, y + 8);
  });

  const reason = hover ? blockReasonFor(l, hover) : null;
  ctx.fillStyle = reason ? '#ff9a4d' : '#6a6f88';
  ctx.fillText(reason ?? 'Click a weapon to swap it, + and - for grenades', 20, 272);

  const valid = validateLoadout(l) === null;
  const st = EQ.start;
  button(ctx, st.x, st.y, st.w, st.h, 'START MISSION (Enter)', valid, hover?.kind === 'start');
}
