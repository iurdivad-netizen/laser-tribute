import type { Loadout } from './loadout';
import type { GameState, ThrowableId } from './types';

export const STASH_KEYS = [
  'rifle', 'pistol', 'shotgun', 'smg', 'sniper',
  'grenade', 'smoke', 'flash', 'incendiary',
  'clip', 'medkit', 'armour', 'scanner', 'scope',
] as const;
export type StashKey = (typeof STASH_KEYS)[number];

/** Free gear the squad has found: it covers the same kit items on the equipment screen at no cost. `grenade` counts frags; `clip` spare clips. */
export type Stash = Record<StashKey, number>;

export function emptyStash(): Stash {
  return Object.fromEntries(STASH_KEYS.map((k) => [k, 0])) as Stash;
}

export const stashOf = (partial: Partial<Stash>): Stash => ({ ...emptyStash(), ...partial });

/** The stash key of a throwable kind: frags are the old `grenade` counter. */
export const throwableKey = (id: ThrowableId): StashKey => (id === 'frag' ? 'grenade' : id);

export interface Cover {
  /** The soldier's weapon comes from the stash. */
  weapon: boolean;
  /** How many of the soldier's grenades come from the stash. */
  grenades: number;
  /** How many of the soldier's extra clips (beyond the first) come from the stash. */
  clips: number;
  /** The soldier's gadget comes from the stash. */
  gadget: boolean;
  /** The soldier's sightscope comes from the stash. */
  attachment: boolean;
}

/** Which parts of each soldier's kit the stash pays for, handing out stash gear in soldier order. */
export function coverage(l: Loadout, stash: Stash): Cover[] {
  const left = { ...stash };
  return l.map((s) => {
    const weapon = left[s.weapon] > 0;
    if (weapon) left[s.weapon] -= 1;
    const tk = throwableKey(s.throwable ?? 'frag');
    const grenades = Math.min(s.grenades, left[tk]);
    left[tk] -= grenades;
    const clips = Math.min(Math.max(0, s.clips - 1), left.clip);
    left.clip -= clips;
    const g = s.gadget;
    const gadget = !!g && left[g] > 0;
    if (gadget && g) left[g] -= 1;
    const a = s.attachment;
    const attachment = !!a && left[a] > 0;
    if (attachment && a) left[a] -= 1;
    return { weapon, grenades, clips, gadget, attachment };
  });
}

/**
 * The stash after a finished mission. A lost mission is handled by the caller (stash unchanged).
 * The stash keeps what was not lent out, gets back lent gear that a survivor still holds, and gains
 * whatever survivors found: a weapon other than the one they set out with, or extra grenades.
 * Gear held by a dead soldier is lost with them.
 */
export function nextStash(stash: Stash, used: Loadout, finished: GameState): Stash {
  const cover = coverage(used, stash);
  const next: Stash = { ...stash };
  for (const [i, s] of used.entries()) {
    next[s.weapon] -= cover[i].weapon ? 1 : 0;
    next[throwableKey(s.throwable ?? 'frag')] -= cover[i].grenades;
    next.clip -= cover[i].clips;
    if (cover[i].gadget && s.gadget) next[s.gadget] -= 1;
    if (cover[i].attachment && s.attachment) next[s.attachment] -= 1;
  }
  const soldiers = finished.units.filter((u) => u.side === 'player');
  for (const [i, s] of used.entries()) {
    const u = soldiers[i];
    if (!u || !u.alive) continue;
    if (u.weapon !== s.weapon) next[u.weapon] += 1; // found
    else if (cover[i].weapon) next[u.weapon] += 1; // lent, returned
    next[throwableKey(u.throwable)] += Math.max(0, u.grenades - (s.grenades - cover[i].grenades));
    next.clip += Math.max(0, u.clips - (s.clips - cover[i].clips));
    if (s.attachment && u.attachment === s.attachment) next[s.attachment] += 1;
    if (s.gadget && u.gadget === s.gadget) next[s.gadget] += 1; // carried through the mission: lent or bought, it comes back
  }
  return next;
}

const NAMES: Record<StashKey, [string, string]> = {
  rifle: ['rifle', 'rifles'], pistol: ['pistol', 'pistols'], shotgun: ['shotgun', 'shotguns'], smg: ['smg', 'smgs'],
  sniper: ['sniper', 'snipers'], grenade: ['grenade', 'grenades'], smoke: ['smoke', 'smoke'],
  flash: ['flashbang', 'flashbangs'], incendiary: ['incendiary', 'incendiaries'], clip: ['clip', 'clips'],
  medkit: ['medkit', 'medkits'], armour: ['armour', 'armour'], scanner: ['scanner', 'scanners'], scope: ['scope', 'scopes'],
};
export function describeStash(stash: Stash): string {
  return STASH_KEYS.filter((k) => stash[k] > 0).map((k) => `${stash[k]} ${NAMES[k][stash[k] === 1 ? 0 : 1]}`).join(', ');
}

