import {
  ATTACHMENTS, CONFIG, GADGETS, GADGET_IDS, THROWABLES, THROWABLE_IDS, TUTORIAL_LEVEL, WEAPONS, WEAPON_IDS, unlockedThrowables,
  unlockedWeapons,
} from '../core/config';
import {
  LOADOUT, SQUAD_SIZE, loadoutCost, netSoldierCost, validateLoadout, weaponPrice, type Loadout,
} from '../core/loadout';
import { coverage, describeStash, emptyStash, throwableKey, type Stash } from '../core/stash';
import type { GadgetId, ThrowableId, WeaponId } from '../core/types';
import { VIEW } from '../render/layout';
import { UI, drawButton, drawFrame, type ButtonState } from '../ui/frame';
import { textWidth } from '../ui/font';
import { clipText, drawText } from '../ui/text';

export type EquipmentHit =
  | { kind: 'weapon' | 'throwable' | 'minus' | 'plus' | 'clipMinus' | 'clipPlus' | 'gadget' | 'scope'; index: number }
  | { kind: 'start' };

export interface EquipmentView {
  budget: number;
  title: string;
  breakdown: string;
  soldiers: { name: string; kills: number; rank?: string }[];
  stash: Stash;
  /** The unlock level: which weapons and throwables the buttons offer (default: the tutorial's). */
  level?: number;
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
  weapon: { x: 76, w: 100 },
  throwable: { x: 350, w: 76 },
  gadget: { x: 76, w: 100 },
  scope: { x: 352, w: 100 },
  minus: { x: 262, w: 24 },
  plus: { x: 322, w: 24 },
  start: { x: 170, y: 330, w: 140, h: 30 },
} as const;

export function scopeBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  if (l[i].attachment) return null; // taking it off is always allowed
  const after = l.map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));
  const need = loadoutCost(after, stash) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleScope(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  if (l[i].attachment) {
    return l.map((s, j) => {
      if (j !== i) return s;
      const { attachment: _attachment, ...rest } = s;
      return rest;
    });
  }
  if (scopeBlockReason(l, i, budget, stash)) return l;
  return l.map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));
}

const GADGET_CYCLE: (GadgetId | undefined)[] = [undefined, ...GADGET_IDS];

/** The next gadget in the cycle none -> medkit -> armour -> scanner -> none that the budget can pay for. */
export function cycleGadget(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  const at = GADGET_CYCLE.indexOf(l[i].gadget);
  for (let step = 1; step <= GADGET_CYCLE.length; step++) {
    const gadget = GADGET_CYCLE[(at + step) % GADGET_CYCLE.length];
    const next = l.map((s, j) => (j === i ? { ...s, gadget } : s));
    if (loadoutCost(next, stash) <= budget) return next;
  }
  return l;
}

const rowY = (i: number) => EQ.rowTop + i * EQ.rowStep;
const inRect = (px: number, py: number, x: number, y: number, w: number, h: number) =>
  px >= x && px < x + w && py >= y && py < y + h;

/** The next weapon in the list that is unlocked at the level or lying in the stash, wrapping around. */
export function nextWeapon(l: Loadout, i: number, level: number, stash: Stash): WeaponId {
  const options = WEAPON_IDS.filter((w) => unlockedWeapons(level).includes(w) || stash[w] > 0 || w === l[i].weapon);
  return options[(options.indexOf(l[i].weapon) + 1) % options.length];
}

/** The next throwable kind that is unlocked at the level or lying in the stash, wrapping around. */
export function nextThrowable(l: Loadout, i: number, level: number, stash: Stash): ThrowableId {
  const kind = l[i].throwable ?? 'frag';
  const options = THROWABLE_IDS.filter((t) => unlockedThrowables(level).includes(t) || stash[throwableKey(t)] > 0 || t === kind);
  return options[(options.indexOf(kind) + 1) % options.length];
}

export function toggleBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: number = TUTORIAL_LEVEL,
): string | null {
  const after = l.map((s, j) => (j === i ? { ...s, weapon: nextWeapon(l, i, level, stash) } : s));
  const need = loadoutCost(after, stash) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleWeapon(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: number = TUTORIAL_LEVEL,
): Loadout {
  if (toggleBlockReason(l, i, budget, stash, level)) return l;
  return l.map((s, j) => (j === i ? { ...s, weapon: nextWeapon(l, i, level, stash) } : s));
}

export function throwableBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: number = TUTORIAL_LEVEL,
): string | null {
  const next = nextThrowable(l, i, level, stash);
  if (next === (l[i].throwable ?? 'frag')) return 'No other throwable unlocked';
  const after = l.map((s, j) => (j === i ? { ...s, throwable: next } : s));
  const need = loadoutCost(after, stash) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function cycleThrowable(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: number = TUTORIAL_LEVEL,
): Loadout {
  if (throwableBlockReason(l, i, budget, stash, level)) return l;
  return l.map((s, j) => (j === i ? { ...s, throwable: nextThrowable(l, i, level, stash) } : s));
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
    if (inRect(px, py, EQ.throwable.x, y, EQ.throwable.w, EQ.btnH)) return { kind: 'throwable', index: i };
    if (inRect(px, py, EQ.minus.x, y, EQ.minus.w, EQ.btnH)) return { kind: 'minus', index: i };
    if (inRect(px, py, EQ.plus.x, y, EQ.plus.w, EQ.btnH)) return { kind: 'plus', index: i };
    const cy = y + EQ.clipDy;
    if (inRect(px, py, EQ.minus.x, cy, EQ.minus.w, EQ.btnH)) return { kind: 'clipMinus', index: i };
    if (inRect(px, py, EQ.plus.x, cy, EQ.plus.w, EQ.btnH)) return { kind: 'clipPlus', index: i };
    if (inRect(px, py, EQ.gadget.x, cy, EQ.gadget.w, EQ.btnH)) return { kind: 'gadget', index: i };
    if (inRect(px, py, EQ.scope.x, cy, EQ.scope.w, EQ.btnH)) return { kind: 'scope', index: i };
  }
  return null;
}

export function blockReasonFor(
  l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: number = TUTORIAL_LEVEL,
): string | null {
  switch (hit.kind) {
    case 'weapon': return toggleBlockReason(l, hit.index, budget, stash, level);
    case 'throwable': return throwableBlockReason(l, hit.index, budget, stash, level);
    case 'minus': return grenadeBlockReason(l, hit.index, -1, budget, stash);
    case 'plus': return grenadeBlockReason(l, hit.index, 1, budget, stash);
    case 'clipMinus': return clipBlockReason(l, hit.index, -1, budget, stash);
    case 'clipPlus': return clipBlockReason(l, hit.index, 1, budget, stash);
    case 'gadget': return null;
    case 'scope': return scopeBlockReason(l, hit.index, budget, stash);
    case 'start': return validateLoadout(l, budget, stash, level);
  }
}

export function applyEquipmentHit(
  l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: number = TUTORIAL_LEVEL,
): Loadout {
  switch (hit.kind) {
    case 'weapon': return toggleWeapon(l, hit.index, budget, stash, level);
    case 'throwable': return cycleThrowable(l, hit.index, budget, stash, level);
    case 'minus': return changeGrenades(l, hit.index, -1, budget, stash);
    case 'plus': return changeGrenades(l, hit.index, 1, budget, stash);
    case 'clipMinus': return changeClips(l, hit.index, -1, budget, stash);
    case 'clipPlus': return changeClips(l, hit.index, 1, budget, stash);
    case 'gadget': return cycleGadget(l, hit.index, budget, stash);
    case 'scope': return toggleScope(l, hit.index, budget, stash);
    case 'start': return l;
  }
}

const buttonState = (enabled: boolean, hot: boolean): ButtonState => (!enabled ? 'disabled' : hot ? 'hover' : 'raised');

export function drawEquipment(
  ctx: CanvasRenderingContext2D,
  l: Loadout,
  hover: EquipmentHit | null,
  view: EquipmentView = DEFAULT_VIEW,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const cost = loadoutCost(l, view.stash);
  const level = view.level ?? TUTORIAL_LEVEL;
  drawText(ctx, view.title, 20, 8, UI.accent);
  drawText(ctx, `Credits ${cost}/${view.budget}  (${view.budget - cost} left)`, 20, 22, UI.dim);
  drawFrame(ctx, 18, 32, 444, 12, 'inset');
  ctx.fillStyle = cost <= view.budget ? UI.blue : UI.red;
  ctx.fillRect(20, 34, Math.round(440 * Math.min(1, cost / view.budget)), 8);
  drawText(ctx, view.breakdown, 20, 47, UI.hint);

  l.forEach((s, i) => {
    const y = rowY(i);
    const hot = (kind: Exclude<EquipmentHit['kind'], 'start'>) =>
      hover !== null && hover.kind !== 'start' && hover.kind === kind && hover.index === i;
    const cover = coverage(l, view.stash)[i];
    const who = view.soldiers[i];
    if (who) {
      soldierLines(who).forEach((line, n) => drawText(ctx, line, 8, y + 3 + n * 11, n === 0 ? UI.text : UI.dim));
    } else {
      drawText(ctx, `P${i + 1}`, 8, y + 3, UI.text);
    }
    drawButton(
      ctx, { x: EQ.weapon.x, y, w: EQ.weapon.w, h: EQ.btnH },
      `${WEAPONS[s.weapon].name} (${cover.weapon ? 'FREE' : weaponPrice(s.weapon)})`,
      buttonState(toggleBlockReason(l, i, view.budget, view.stash, level) === null, hot('weapon')),
    );
    drawButton(
      ctx, { x: EQ.throwable.x, y, w: EQ.throwable.w, h: EQ.btnH },
      THROWABLES[s.throwable ?? 'frag'].name.toUpperCase(),
      buttonState(throwableBlockReason(l, i, view.budget, view.stash, level) === null, hot('throwable')),
    );
    drawText(ctx, 'Grenades', 190, y + 8, UI.dim);
    drawButton(ctx, { x: EQ.minus.x, y, w: EQ.minus.w, h: EQ.btnH }, '-',
      buttonState(grenadeBlockReason(l, i, -1, view.budget, view.stash) === null, hot('minus')));
    drawText(ctx, `${s.grenades}`, 304, y + 8, UI.text, 'center');
    drawButton(ctx, { x: EQ.plus.x, y, w: EQ.plus.w, h: EQ.btnH }, '+',
      buttonState(grenadeBlockReason(l, i, 1, view.budget, view.stash) === null, hot('plus')));

    const cy = y + EQ.clipDy;
    drawText(ctx, 'Spare clips', 190, cy + 8, UI.dim);
    drawButton(ctx, { x: EQ.minus.x, y: cy, w: EQ.minus.w, h: EQ.btnH }, '-',
      buttonState(clipBlockReason(l, i, -1, view.budget, view.stash) === null, hot('clipMinus')));
    drawText(ctx, `${s.clips}`, 304, cy + 8, UI.text, 'center');
    drawButton(ctx, { x: EQ.plus.x, y: cy, w: EQ.plus.w, h: EQ.btnH }, '+',
      buttonState(clipBlockReason(l, i, 1, view.budget, view.stash) === null, hot('clipPlus')));
    const g = s.gadget;
    drawButton(
      ctx, { x: EQ.gadget.x, y: cy, w: EQ.gadget.w, h: EQ.btnH },
      g ? `${GADGETS[g].name.toUpperCase()} (${cover.gadget ? 'FREE' : GADGETS[g].price})` : 'NO GADGET',
      buttonState(true, hot('gadget')),
    );
    drawButton(
      ctx, { x: EQ.scope.x, y: cy, w: EQ.scope.w, h: EQ.btnH },
      s.attachment ? `SCOPE (${cover.attachment ? 'FREE' : ATTACHMENTS.scope.price})` : 'NO SCOPE',
      buttonState(scopeBlockReason(l, i, view.budget, view.stash) === null, hot('scope')),
    );
    const net = netSoldierCost(l, i, view.stash);
    drawText(ctx, net === 0 ? 'FREE' : `${net} cr`, 432, y + 8, net === 0 ? UI.green : UI.dim);
  });

  const reason = hover ? blockReasonFor(l, hover, view.budget, view.stash, level) : null;
  drawText(
    ctx, reason ?? 'Click a weapon or grenade kind to swap it; + and - for counts', 20, 272,
    reason ? UI.accent : UI.hint,
  );

  const found = describeStash(view.stash);
  if (found) {
    const line = `Found gear is free: ${found}`;
    if (textWidth(line) <= 440) {
      drawText(ctx, line, 20, 286, UI.green);
    } else {
      drawText(ctx, 'Found gear is free:', 20, 286, UI.green);
      drawText(ctx, clipText(found, 440), 20, 297, UI.green);
    }
  }

  const valid = validateLoadout(l, view.budget, view.stash, level) === null;
  const st = EQ.start;
  drawButton(ctx, { x: st.x, y: st.y, w: st.w, h: st.h }, 'START MISSION (Enter)',
    buttonState(valid, hover?.kind === 'start'));
}
