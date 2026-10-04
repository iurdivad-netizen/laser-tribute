import { CONFIG, WEAPONS } from './config';
import { coverage, emptyStash, type Stash } from './stash';
import type { GameState, WeaponId } from './types';

export const LOADOUT = {
  budget: 120,
  prices: { pistol: 10, rifle: 25, grenade: 8, clip: 5 },
  maxGrenades: 3,
} as const;

export const SQUAD_SIZE = 4;

export interface SoldierLoadout {
  weapon: WeaponId;
  grenades: number;
  /** Spare clips, 1 to 4; the first is included in the weapon price. */
  clips: number;
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

export function soldierCost(s: SoldierLoadout): number {
  return LOADOUT.prices[s.weapon] + LOADOUT.prices.grenade * s.grenades + LOADOUT.prices.clip * (s.clips - 1);
}

/** Credits the loadout costs; gear covered by the stash is free. */
export function loadoutCost(l: Loadout, stash: Stash = emptyStash()): number {
  const gross = l.reduce((sum, s) => sum + soldierCost(s), 0);
  const free = coverage(l, stash).reduce(
    (sum, c, i) =>
      sum + (c.weapon ? LOADOUT.prices[l[i].weapon] : 0) + c.grenades * LOADOUT.prices.grenade + c.clips * LOADOUT.prices.clip,
    0,
  );
  return gross - free;
}

/** What soldier `i` costs after the stash covers part of the kit (0 when everything is free). */
export function netSoldierCost(l: Loadout, i: number, stash: Stash = emptyStash()): number {
  const c = coverage(l, stash)[i];
  return (
    soldierCost(l[i]) -
    (c.weapon ? LOADOUT.prices[l[i].weapon] : 0) -
    c.grenades * LOADOUT.prices.grenade -
    c.clips * LOADOUT.prices.clip
  );
}

export function cheapLoadout(): Loadout {
  return Array.from({ length: SQUAD_SIZE }, () => ({ weapon: 'pistol' as const, grenades: 1, clips: 1 }));
}

export function validateLoadout(
  l: Loadout, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  if (l.length !== SQUAD_SIZE) return `A loadout needs exactly ${SQUAD_SIZE} soldiers`;
  for (const [i, s] of l.entries()) {
    if (s.weapon !== 'pistol' && s.weapon !== 'rifle') return `Soldier ${i + 1} needs a weapon`;
    if (!Number.isInteger(s.grenades) || s.grenades < 0 || s.grenades > LOADOUT.maxGrenades) {
      return `Soldier ${i + 1} must carry 0 to ${LOADOUT.maxGrenades} grenades`;
    }
    if (!Number.isInteger(s.clips) || s.clips < 1 || s.clips > CONFIG.maxClips) {
      return `Soldier ${i + 1} must carry 1 to ${CONFIG.maxClips} spare clips`;
    }
  }
  const cost = loadoutCost(l, stash);
  if (cost > budget) return `Loadout costs ${cost}, budget is ${budget}`;
  return null;
}

/** The previous kit if it still fits the budget, else the same kit with one spare clip each, else the cheap fallback kit. */
export function fitLoadout(previous: Loadout, budget: number, stash: Stash = emptyStash()): Loadout {
  if (validateLoadout(previous, budget, stash) === null) return previous;
  // Trim the extra spare clips before giving up the weapons and grenades.
  const trimmed = previous.map((s) => ({ ...s, clips: 1 }));
  return validateLoadout(trimmed, budget, stash) === null ? trimmed : cheapLoadout();
}

export function applyLoadout(
  state: GameState, l: Loadout, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): GameState {
  const error = validateLoadout(l, budget, stash);
  if (error) throw new Error(error);
  const soldiers = state.units.filter((u) => u.side === 'player');
  if (soldiers.length !== l.length) throw new Error('Loadout does not match the squad size');
  const next = structuredClone(state);
  next.units
    .filter((u) => u.side === 'player')
    .forEach((u, i) => {
      u.weapon = l[i].weapon;
      u.grenades = l[i].grenades;
      u.clips = l[i].clips;
      u.ammo = WEAPONS[l[i].weapon].magazine;
    });
  return next;
}
