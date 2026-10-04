import type { Loadout } from './loadout';
import type { GameState } from './types';

/** Free gear the squad has found: it covers the same kit items on the equipment screen at no cost. */
export interface Stash {
  rifle: number;
  pistol: number;
  grenade: number;
  /** Spare clips: each covers the 5-credit price of an extra clip (the first clip is always included). */
  clip: number;
}

export function emptyStash(): Stash {
  return { rifle: 0, pistol: 0, grenade: 0, clip: 0 };
}

export interface Cover {
  /** The soldier's weapon comes from the stash. */
  weapon: boolean;
  /** How many of the soldier's grenades come from the stash. */
  grenades: number;
  /** How many of the soldier's extra clips (beyond the first) come from the stash. */
  clips: number;
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
    return { weapon, grenades, clips };
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
  }
  const soldiers = finished.units.filter((u) => u.side === 'player');
  for (const [i, s] of used.entries()) {
    const u = soldiers[i];
    if (!u || !u.alive) continue;
    if (u.weapon !== s.weapon) next[u.weapon] += 1; // found
    else if (cover[i].weapon) next[u.weapon] += 1; // lent, returned
    next.grenade += Math.max(0, u.grenades - (s.grenades - cover[i].grenades));
    next.clip += Math.max(0, u.clips - (s.clips - cover[i].clips));
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
  ].filter(Boolean).join(', ');
}
