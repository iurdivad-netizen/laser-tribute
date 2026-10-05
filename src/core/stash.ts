import type { Loadout } from './loadout';
import type { GameState } from './types';

/** Free gear the squad has found: it covers the same kit items on the equipment screen at no cost. */
export interface Stash {
  rifle: number;
  pistol: number;
  grenade: number;
  /** Spare clips: each covers the 5-credit price of an extra clip (the first clip is always included). */
  clip: number;
  medkit: number;
  armour: number;
  scanner: number;
  scope: number;
}

export function emptyStash(): Stash {
  return { rifle: 0, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 };
}

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
    const grenades = Math.min(s.grenades, left.grenade);
    left.grenade -= grenades;
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
    next.grenade -= cover[i].grenades;
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
    next.grenade += Math.max(0, u.grenades - (s.grenades - cover[i].grenades));
    next.clip += Math.max(0, u.clips - (s.clips - cover[i].clips));
    if (s.attachment && u.attachment === s.attachment) next[s.attachment] += 1;
    if (s.gadget && u.gadget === s.gadget) next[s.gadget] += 1; // carried through the mission: lent or bought, it comes back
  }
  return next;
}

/** e.g. "1 rifle, 2 grenades, 3 clips"; empty string for an empty stash. */
export function describeStash(stash: Stash): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    stash.rifle > 0 ? plural(stash.rifle, 'rifle', 'rifles') : '',
    stash.pistol > 0 ? plural(stash.pistol, 'pistol', 'pistols') : '',
    stash.grenade > 0 ? plural(stash.grenade, 'grenade', 'grenades') : '',
    stash.clip > 0 ? plural(stash.clip, 'clip', 'clips') : '',
    stash.medkit > 0 ? plural(stash.medkit, 'medkit', 'medkits') : '',
    stash.armour > 0 ? plural(stash.armour, 'armour', 'armour') : '',
    stash.scanner > 0 ? plural(stash.scanner, 'scanner', 'scanners') : '',
    stash.scope > 0 ? plural(stash.scope, 'scope', 'scopes') : '',
  ].filter(Boolean).join(', ');
}
