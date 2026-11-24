import {
  ATTACHMENTS, CONFIG, GADGETS, GADGET_IDS, THROWABLES, THROWABLE_IDS, TUTORIAL_LEVEL, WEAPONS, WEAPON_IDS,
} from '../core/config';
import { gearRulesOf, unlocked, type GearArg } from '../core/gear';
import {
  LOADOUT, SQUAD_SIZE, attachmentPrice, gadgetPrice, loadoutCost, netSoldierCost, validateLoadout, weaponAllowed, weaponPrice,
  type Loadout,
} from '../core/loadout';
import { coverage, describeStash, emptyStash, throwableKey, type Stash } from '../core/stash';
import type { GadgetId, ThrowableId, WeaponId } from '../core/types';
import type { ItemRef } from '../core/world/iteminfo';
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
  /** The unlock level, or the story's gear rules: which gear the buttons offer and what it costs (default: the tutorial's). */
  level?: GearArg;
  /** Draw the small ? buttons that open an item's card (the story's fights); the labels move 6 px right to make room. */
  infoButtons?: boolean;
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

const scopeAllowed = (rules: ReturnType<typeof gearRulesOf>, stash: Stash): boolean =>
  unlocked(rules, 'attachment', 'scope') || stash.scope > 0 || rules.premium !== null;

export function scopeBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): string | null {
  if (l[i].attachment) return null; // taking it off is always allowed
  const rules = gearRulesOf(gear);
  if (!scopeAllowed(rules, stash)) return 'The scope is locked';
  const after = l.map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));
  const need = loadoutCost(after, stash, rules) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleScope(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): Loadout {
  if (l[i].attachment) {
    return l.map((s, j) => {
      if (j !== i) return s;
      const { attachment: _attachment, ...rest } = s;
      return rest;
    });
  }
  if (scopeBlockReason(l, i, budget, stash, gear)) return l;
  return l.map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));
}

const GADGET_CYCLE: (GadgetId | undefined)[] = [undefined, ...GADGET_IDS];

/** The next gadget in the cycle none -> medkit -> armour -> scanner -> none that the budget can pay for. */
export function cycleGadget(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): Loadout {
  const rules = gearRulesOf(gear);
  const at = GADGET_CYCLE.indexOf(l[i].gadget);
  for (let step = 1; step <= GADGET_CYCLE.length; step++) {
    const gadget = GADGET_CYCLE[(at + step) % GADGET_CYCLE.length];
    if (gadget !== undefined && !unlocked(rules, 'gadget', gadget) && stash[gadget] < 1 && rules.premium === null) continue;
    const next = l.map((s, j) => (j === i ? { ...s, gadget } : s));
    if (loadoutCost(next, stash, rules) <= budget) return next;
  }
  return l;
}

const rowY = (i: number) => EQ.rowTop + i * EQ.rowStep;
const inRect = (px: number, py: number, x: number, y: number, w: number, h: number) =>
  px >= x && px < x + w && py >= y && py < y + h;

/** The next weapon in the list that is unlocked at the level or lying in the stash, wrapping around. */
export function nextWeapon(l: Loadout, i: number, level: GearArg, stash: Stash): WeaponId {
  const rules = gearRulesOf(level);
  const options = WEAPON_IDS.filter((w) => weaponAllowed(rules, stash, w) || w === l[i].weapon);
  return options[(options.indexOf(l[i].weapon) + 1) % options.length];
}

/** The next throwable kind that is unlocked at the level or lying in the stash, wrapping around. */
export function nextThrowable(l: Loadout, i: number, level: GearArg, stash: Stash): ThrowableId {
  const rules = gearRulesOf(level);
  const kind = l[i].throwable ?? 'frag';
  const options = THROWABLE_IDS.filter(
    (t) => unlocked(rules, 'throwable', t) || stash[throwableKey(t)] > 0 || rules.premium !== null || t === kind,
  );
  return options[(options.indexOf(kind) + 1) % options.length];
}

/**
 * The weapon a tap moves to. Under story rules (a premium exists) the cycle skips weapons the budget cannot pay for, so
 * a soldier is never stuck on a dear weapon with the cheap ones out of reach; level numbers keep the plain cycle.
 */
export function nextAffordableWeapon(l: Loadout, i: number, budget: number, stash: Stash, level: GearArg): WeaponId {
  const rules = gearRulesOf(level);
  const plain = nextWeapon(l, i, level, stash);
  if (rules.premium === null) return plain;
  const options = WEAPON_IDS.filter((w) => weaponAllowed(rules, stash, w) || w === l[i].weapon);
  const at = options.indexOf(l[i].weapon);
  for (let step = 1; step < options.length; step++) {
    const weapon = options[(at + step) % options.length];
    const after = l.map((s, j) => (j === i ? { ...s, weapon } : s));
    if (loadoutCost(after, stash, rules) <= budget) return weapon;
  }
  return plain;
}

export function toggleBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): string | null {
  const after = l.map((s, j) => (j === i ? { ...s, weapon: nextAffordableWeapon(l, i, budget, stash, level) } : s));
  const need = loadoutCost(after, stash, gearRulesOf(level)) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleWeapon(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): Loadout {
  if (toggleBlockReason(l, i, budget, stash, level)) return l;
  return l.map((s, j) => (j === i ? { ...s, weapon: nextAffordableWeapon(l, i, budget, stash, level) } : s));
}

export function throwableBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): string | null {
  const next = nextThrowable(l, i, level, stash);
  if (next === (l[i].throwable ?? 'frag')) return 'No other throwable unlocked';
  const after = l.map((s, j) => (j === i ? { ...s, throwable: next } : s));
  const need = loadoutCost(after, stash, gearRulesOf(level)) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function cycleThrowable(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): Loadout {
  if (throwableBlockReason(l, i, budget, stash, level)) return l;
  return l.map((s, j) => (j === i ? { ...s, throwable: nextThrowable(l, i, level, stash) } : s));
}

export function grenadeBlockReason(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): string | null {
  const next = l[i].grenades + delta;
  if (next < 0) return 'No grenades to remove';
  if (next > LOADOUT.maxGrenades) return `Max ${LOADOUT.maxGrenades} grenades`;
  if (delta === 1) {
    const after = l.map((s, j) => (j === i ? { ...s, grenades: next } : s));
    const need = loadoutCost(after, stash, gearRulesOf(gear)) - budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeGrenades(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): Loadout {
  if (grenadeBlockReason(l, i, delta, budget, stash, gear)) return l;
  return l.map((s, j) => (j === i ? { ...s, grenades: s.grenades + delta } : s));
}

export function clipBlockReason(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): string | null {
  const next = l[i].clips + delta;
  if (next < 1) return 'At least 1 spare clip';
  if (next > CONFIG.maxClips) return `Max ${CONFIG.maxClips} spare clips`;
  if (delta === 1) {
    const after = l.map((s, j) => (j === i ? { ...s, clips: next } : s));
    const need = loadoutCost(after, stash, gearRulesOf(gear)) - budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeClips(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): Loadout {
  if (clipBlockReason(l, i, delta, budget, stash, gear)) return l;
  return l.map((s, j) => (j === i ? { ...s, clips: s.clips + delta } : s));
}

/** A ? button's rectangle: the soldier it is for and the kind of item whose card it opens. */
export interface InfoRect { index: number; kind: ItemRef['kind']; x: number; y: number; w: number; h: number }

/** The ? buttons for the kit: the weapon, the grenade kind, the scope, and the gadget when one is chosen. None overlaps a normal button. */
export function equipmentInfoRects(l: Loadout): InfoRect[] {
  const out: InfoRect[] = [];
  for (let i = 0; i < SQUAD_SIZE; i++) {
    const y = rowY(i);
    const cy = y + EQ.clipDy;
    out.push({ index: i, kind: 'weapon', x: 178, y, w: 14, h: EQ.btnH }, { index: i, kind: 'throwable', x: 246, y, w: 14, h: EQ.btnH });
    if (l[i]?.gadget) out.push({ index: i, kind: 'gadget', x: 178, y: cy, w: 14, h: EQ.btnH });
    out.push({ index: i, kind: 'scope', x: 456, y: cy, w: 20, h: EQ.btnH });
  }
  return out;
}

/** The item behind the ? button under the point, as the kit has it now. A touch slop widens the buttons, but never over a real one. */
export function equipmentInfoHit(px: number, py: number, l: Loadout, slop = 0): ItemRef | null {
  for (const r of equipmentInfoRects(l)) {
    const near = px >= r.x - slop && px < r.x + r.w + slop && py >= r.y - slop && py < r.y + r.h + slop;
    if (!near) continue;
    if (equipmentHit(px, py, slop) !== null) continue; // a real button, or the one nearest within the slop, owns the tap
    const s = l[r.index];
    switch (r.kind) {
      case 'weapon': return { kind: 'weapon', id: s.weapon };
      case 'throwable': return { kind: 'throwable', id: s.throwable ?? 'frag' };
      case 'gadget': return s.gadget ? { kind: 'gadget', id: s.gadget } : null;
      case 'scope': return { kind: 'scope' };
    }
  }
  return null;
}

/** Every button of the screen with its rectangle, in the order a click is tested. */
function equipmentRects(): { hit: EquipmentHit; x: number; y: number; w: number; h: number }[] {
  const s = EQ.start;
  const out: { hit: EquipmentHit; x: number; y: number; w: number; h: number }[] = [{ hit: { kind: 'start' }, x: s.x, y: s.y, w: s.w, h: s.h }];
  for (let i = 0; i < SQUAD_SIZE; i++) {
    const y = rowY(i);
    const cy = y + EQ.clipDy;
    out.push(
      { hit: { kind: 'weapon', index: i }, x: EQ.weapon.x, y, w: EQ.weapon.w, h: EQ.btnH },
      { hit: { kind: 'throwable', index: i }, x: EQ.throwable.x, y, w: EQ.throwable.w, h: EQ.btnH },
      { hit: { kind: 'minus', index: i }, x: EQ.minus.x, y, w: EQ.minus.w, h: EQ.btnH },
      { hit: { kind: 'plus', index: i }, x: EQ.plus.x, y, w: EQ.plus.w, h: EQ.btnH },
      { hit: { kind: 'clipMinus', index: i }, x: EQ.minus.x, y: cy, w: EQ.minus.w, h: EQ.btnH },
      { hit: { kind: 'clipPlus', index: i }, x: EQ.plus.x, y: cy, w: EQ.plus.w, h: EQ.btnH },
      { hit: { kind: 'gadget', index: i }, x: EQ.gadget.x, y: cy, w: EQ.gadget.w, h: EQ.btnH },
      { hit: { kind: 'scope', index: i }, x: EQ.scope.x, y: cy, w: EQ.scope.w, h: EQ.btnH },
    );
  }
  return out;
}

/**
 * The button under the point. With a `slop` (a finger is wider than a 24 px button) a point that misses every button
 * still counts as the nearest one within that many pixels of its edge, so a tap beside a small + or - lands on it.
 */
export function equipmentHit(px: number, py: number, slop = 0): EquipmentHit | null {
  const rects = equipmentRects();
  for (const r of rects) if (inRect(px, py, r.x, r.y, r.w, r.h)) return r.hit;
  if (slop <= 0) return null;
  let best: EquipmentHit | null = null;
  let bestD = slop + 1e-9;
  for (const r of rects) {
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w - 1));
    const dy = Math.max(r.y - py, 0, py - (r.y + r.h - 1));
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      best = r.hit;
      bestD = d;
    }
  }
  return best;
}

export function blockReasonFor(
  l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): string | null {
  switch (hit.kind) {
    case 'weapon': return toggleBlockReason(l, hit.index, budget, stash, level);
    case 'throwable': return throwableBlockReason(l, hit.index, budget, stash, level);
    case 'minus': return grenadeBlockReason(l, hit.index, -1, budget, stash, level);
    case 'plus': return grenadeBlockReason(l, hit.index, 1, budget, stash, level);
    case 'clipMinus': return clipBlockReason(l, hit.index, -1, budget, stash, level);
    case 'clipPlus': return clipBlockReason(l, hit.index, 1, budget, stash, level);
    case 'gadget': return null;
    case 'scope': return scopeBlockReason(l, hit.index, budget, stash, level);
    case 'start': return validateLoadout(l, budget, stash, level);
  }
}

export function applyEquipmentHit(
  l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): Loadout {
  switch (hit.kind) {
    case 'weapon': return toggleWeapon(l, hit.index, budget, stash, level);
    case 'throwable': return cycleThrowable(l, hit.index, budget, stash, level);
    case 'minus': return changeGrenades(l, hit.index, -1, budget, stash, level);
    case 'plus': return changeGrenades(l, hit.index, 1, budget, stash, level);
    case 'clipMinus': return changeClips(l, hit.index, -1, budget, stash, level);
    case 'clipPlus': return changeClips(l, hit.index, 1, budget, stash, level);
    case 'gadget': return cycleGadget(l, hit.index, budget, stash, level);
    case 'scope': return toggleScope(l, hit.index, budget, stash, level);
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

  const level = view.level ?? TUTORIAL_LEVEL;
  const rules = gearRulesOf(level);
  const labelX = view.infoButtons ? 196 : 190;
  const cost = loadoutCost(l, view.stash, rules);
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
      `${WEAPONS[s.weapon].name} (${cover.weapon ? 'FREE' : weaponPrice(s.weapon, rules)})`,
      buttonState(toggleBlockReason(l, i, view.budget, view.stash, level) === null, hot('weapon')),
    );
    drawButton(
      ctx, { x: EQ.throwable.x, y, w: EQ.throwable.w, h: EQ.btnH },
      THROWABLES[s.throwable ?? 'frag'].name.toUpperCase(),
      buttonState(throwableBlockReason(l, i, view.budget, view.stash, level) === null, hot('throwable')),
    );
    drawText(ctx, 'Grenades', labelX, y + 8, UI.dim);
    drawButton(ctx, { x: EQ.minus.x, y, w: EQ.minus.w, h: EQ.btnH }, '-',
      buttonState(grenadeBlockReason(l, i, -1, view.budget, view.stash, level) === null, hot('minus')));
    drawText(ctx, `${s.grenades}`, 304, y + 8, UI.text, 'center');
    drawButton(ctx, { x: EQ.plus.x, y, w: EQ.plus.w, h: EQ.btnH }, '+',
      buttonState(grenadeBlockReason(l, i, 1, view.budget, view.stash, level) === null, hot('plus')));

    const cy = y + EQ.clipDy;
    drawText(ctx, 'Spare clips', labelX, cy + 8, UI.dim);
    drawButton(ctx, { x: EQ.minus.x, y: cy, w: EQ.minus.w, h: EQ.btnH }, '-',
      buttonState(clipBlockReason(l, i, -1, view.budget, view.stash, level) === null, hot('clipMinus')));
    drawText(ctx, `${s.clips}`, 304, cy + 8, UI.text, 'center');
    drawButton(ctx, { x: EQ.plus.x, y: cy, w: EQ.plus.w, h: EQ.btnH }, '+',
      buttonState(clipBlockReason(l, i, 1, view.budget, view.stash, level) === null, hot('clipPlus')));
    const g = s.gadget;
    drawButton(
      ctx, { x: EQ.gadget.x, y: cy, w: EQ.gadget.w, h: EQ.btnH },
      g ? `${GADGETS[g].name.toUpperCase()} (${cover.gadget ? 'FREE' : gadgetPrice(g, rules)})` : 'NO GADGET',
      buttonState(true, hot('gadget')),
    );
    drawButton(
      ctx, { x: EQ.scope.x, y: cy, w: EQ.scope.w, h: EQ.btnH },
      s.attachment ? `SCOPE (${cover.attachment ? 'FREE' : attachmentPrice('scope', rules)})` : 'NO SCOPE',
      buttonState(scopeBlockReason(l, i, view.budget, view.stash, level) === null, hot('scope')),
    );
    if (view.infoButtons) {
      for (const r of equipmentInfoRects(l)) {
        if (r.index === i) drawButton(ctx, { x: r.x, y: r.y, w: r.w, h: r.h }, '?', buttonState(true, false));
      }
    }
    const net = netSoldierCost(l, i, view.stash, rules);
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
