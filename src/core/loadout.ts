import { ATTACHMENTS, ATTACHMENT_IDS, CONFIG, GADGETS, GADGET_IDS, THROWABLES, THROWABLE_IDS, TUTORIAL_LEVEL, WEAPONS, WEAPON_IDS } from './config';
import { gearRulesOf, priceFactor, unlocked, type GearArg, type GearRules } from './gear';
import { coverage, emptyStash, throwableKey, type Stash } from './stash';
import type { AttachmentId, GadgetId, GameState, ThrowableId, WeaponId } from './types';

export const LOADOUT = {
  budget: 120,
  prices: { pistol: WEAPONS.pistol.price, rifle: WEAPONS.rifle.price, grenade: THROWABLES.frag.price, clip: 5 },
  maxGrenades: 3,
} as const;

/** A base price times the rules' factor for that item (rounded, at least 1); unchanged without rules. */
const priced = (base: number, factor: number): number => (factor === 1 ? base : Math.max(1, Math.round(base * factor)));

export const weaponPrice = (id: WeaponId, rules?: GearRules): number =>
  priced(WEAPONS[id].price, rules ? priceFactor(rules, 'weapon', id) : 1);
export const throwablePrice = (s: { throwable?: ThrowableId }, rules?: GearRules): number => {
  const kind = s.throwable ?? 'frag';
  return priced(THROWABLES[kind].price, rules ? priceFactor(rules, 'throwable', kind) : 1);
};
export const gadgetPrice = (id: GadgetId, rules?: GearRules): number =>
  priced(GADGETS[id].price, rules ? priceFactor(rules, 'gadget', id) : 1);
export const attachmentPrice = (id: AttachmentId, rules?: GearRules): number =>
  priced(ATTACHMENTS[id].price, rules ? priceFactor(rules, 'attachment', id) : 1);

/** Whether a weapon may be carried: unlocked, covered by the stash, or buyable at a premium. */
export const weaponAllowed = (rules: GearRules, stash: Stash, id: WeaponId): boolean =>
  unlocked(rules, 'weapon', id) || stash[id] > 0 || rules.premium !== null;

export const SQUAD_SIZE = 4;

export interface SoldierLoadout {
  weapon: WeaponId;
  grenades: number;
  /** The kind of grenade carried; absent means frag. */
  throwable?: ThrowableId;
  /** Spare clips, 1 to 4; the first is included in the weapon price. */
  clips: number;
  /** The one gadget carried; absent means none. */
  gadget?: GadgetId;
  /** The weapon attachment carried; absent means none. */
  attachment?: AttachmentId;
}

export type Loadout = SoldierLoadout[];

export function defaultLoadout(): Loadout {
  return [
    { weapon: 'rifle', grenades: 1, clips: 1 },
    { weapon: 'rifle', grenades: 1, clips: 1 },
    { weapon: 'pistol', grenades: 1, clips: 1 },
    { weapon: 'pistol', grenades: 1, clips: 1 },
  ];
}

export function soldierCost(s: SoldierLoadout, rules?: GearRules): number {
  return weaponPrice(s.weapon, rules) + throwablePrice(s, rules) * s.grenades + LOADOUT.prices.clip * (s.clips - 1) +
    (s.gadget ? gadgetPrice(s.gadget, rules) : 0) +
    (s.attachment ? attachmentPrice(s.attachment, rules) : 0);
}

/** Credits the loadout costs; gear covered by the stash is free. */
export function loadoutCost(l: Loadout, stash: Stash = emptyStash(), rules?: GearRules): number {
  const gross = l.reduce((sum, s) => sum + soldierCost(s, rules), 0);
  const free = coverage(l, stash).reduce(
    (sum, c, i) =>
      sum + (c.weapon ? weaponPrice(l[i].weapon, rules) : 0) + c.grenades * throwablePrice(l[i], rules) + c.clips * LOADOUT.prices.clip +
      (c.gadget && l[i].gadget ? gadgetPrice(l[i].gadget!, rules) : 0) +
      (c.attachment && l[i].attachment ? attachmentPrice(l[i].attachment!, rules) : 0),
    0,
  );
  return gross - free;
}

/** What soldier `i` costs after the stash covers part of the kit (0 when everything is free). */
export function netSoldierCost(l: Loadout, i: number, stash: Stash = emptyStash(), rules?: GearRules): number {
  const c = coverage(l, stash)[i];
  return (
    soldierCost(l[i], rules) -
    (c.weapon ? weaponPrice(l[i].weapon, rules) : 0) -
    c.grenades * throwablePrice(l[i], rules) -
    c.clips * LOADOUT.prices.clip -
    (c.gadget && l[i].gadget ? gadgetPrice(l[i].gadget!, rules) : 0) -
    (c.attachment && l[i].attachment ? attachmentPrice(l[i].attachment!, rules) : 0)
  );
}

export function cheapLoadout(): Loadout {
  return Array.from({ length: SQUAD_SIZE }, () => ({ weapon: 'pistol' as const, grenades: 1, clips: 1 }));
}

export function validateLoadout(
  l: Loadout, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): string | null {
  const rules = gearRulesOf(gear);
  if (l.length !== SQUAD_SIZE) return `A loadout needs exactly ${SQUAD_SIZE} soldiers`;
  for (const [i, s] of l.entries()) {
    if (!WEAPON_IDS.includes(s.weapon)) return `Soldier ${i + 1} needs a weapon`;
    if (s.throwable !== undefined && !THROWABLE_IDS.includes(s.throwable)) return `Soldier ${i + 1} has an unknown throwable`;
    if (!weaponAllowed(rules, stash, s.weapon)) return `Soldier ${i + 1}: the ${WEAPONS[s.weapon].name} is locked`;
    const kind = s.throwable ?? 'frag';
    if (s.grenades > 0 && !unlocked(rules, 'throwable', kind) && rules.premium === null && stash[throwableKey(kind)] < 1) {
      return `Soldier ${i + 1}: ${THROWABLES[kind].name} is locked`;
    }
    if (!Number.isInteger(s.grenades) || s.grenades < 0 || s.grenades > LOADOUT.maxGrenades) {
      return `Soldier ${i + 1} must carry 0 to ${LOADOUT.maxGrenades} grenades`;
    }
    if (s.gadget !== undefined && !GADGET_IDS.includes(s.gadget)) return `Soldier ${i + 1} has an unknown gadget`;
    if (s.attachment !== undefined && !ATTACHMENT_IDS.includes(s.attachment)) {
      return `Soldier ${i + 1} has an unknown attachment`;
    }
    if (!Number.isInteger(s.clips) || s.clips < 1 || s.clips > CONFIG.maxClips) {
      return `Soldier ${i + 1} must carry 1 to ${CONFIG.maxClips} spare clips`;
    }
    if (s.gadget !== undefined && !unlocked(rules, 'gadget', s.gadget) && rules.premium === null && stash[s.gadget] < 1) {
      return `Soldier ${i + 1}: the ${GADGETS[s.gadget].name} is locked`;
    }
    if (s.attachment !== undefined && !unlocked(rules, 'attachment', s.attachment) && rules.premium === null && stash[s.attachment] < 1) {
      return `Soldier ${i + 1}: the ${ATTACHMENTS[s.attachment].name} is locked`;
    }
  }
  const cost = loadoutCost(l, stash, rules);
  if (cost > budget) return `Loadout costs ${cost}, budget is ${budget}`;
  return null;
}

/** The previous kit if it still fits the budget and the level, else the same kit with one spare clip each, else the kit without gadgets (locked items swapped for a pistol and frags), else the cheap fallback kit. */
export function fitLoadout(
  previous: Loadout, budget: number, stash: Stash = emptyStash(), gear: GearArg = TUTORIAL_LEVEL,
): Loadout {
  const level = gear;
  const rules = gearRulesOf(gear);
  if (validateLoadout(previous, budget, stash, level) === null) return previous;
  // Trim the extra spare clips before giving up the weapons and grenades.
  const trimmed = previous.map((s) => ({ ...s, clips: 1 }));
  if (validateLoadout(trimmed, budget, stash, level) === null) return trimmed;
  const bare = trimmed.map(({ gadget: _gadget, attachment: _attachment, ...rest }) => rest);
  if (validateLoadout(bare, budget, stash, level) === null) return bare;
  const safe = bare.map((s) => ({
    weapon: weaponAllowed(rules, stash, s.weapon) ? s.weapon : ('pistol' as const),
    grenades: s.grenades,
    clips: 1,
  }));
  return validateLoadout(safe, budget, stash, level) === null ? safe : cheapLoadout();
}

export function applyLoadout(
  state: GameState, l: Loadout, budget: number = LOADOUT.budget, stash: Stash = emptyStash(), level: GearArg = TUTORIAL_LEVEL,
): GameState {
  const error = validateLoadout(l, budget, stash, level);
  if (error) throw new Error(error);
  const soldiers = state.units.filter((u) => u.side === 'player');
  if (soldiers.length !== l.length) throw new Error('Loadout does not match the squad size');
  const next = structuredClone(state);
  next.units
    .filter((u) => u.side === 'player')
    .forEach((u, i) => {
      u.weapon = l[i].weapon;
      u.grenades = l[i].grenades;
      u.throwable = l[i].throwable ?? 'frag';
      u.clips = l[i].clips;
      u.ammo = WEAPONS[l[i].weapon].magazine;
      u.gadget = l[i].gadget ?? null;
      u.attachment = l[i].attachment ?? null;
    });
  return next;
}
