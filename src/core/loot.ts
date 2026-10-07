import { STASH_KEYS, emptyStash, type Stash } from './stash';
import type { GameState } from './types';

/** The most weapons and the most spare clips the squad stash keeps. */
export const STASH_CAP = { weapons: 4, clips: 4, gadgets: 4 } as const;

export function addStash(a: Stash, b: Stash): Stash {
  const out = emptyStash();
  for (const k of STASH_KEYS) out[k] = a[k] + b[k];
  return out;
}

/** What the squad recovers from the enemies it killed: each dead enemy's weapon and the spare clips it still had. */
export function lootFrom(finished: GameState): Stash {
  const loot: Stash = emptyStash();
  for (const u of finished.units) {
    if (u.side !== 'enemy' || u.alive) continue;
    loot[u.weapon] += 1;
    loot.clip += u.clips;
  }
  return loot;
}

/** Heaviest weapons are kept first when the stash is over its cap of four weapons. */
const KEEP_ORDER = ['sniper', 'rifle', 'shotgun', 'smg', 'pistol'] as const;

/** At most 4 weapons (heaviest first), 4 clips, 4 of each gadget; throwables are not capped. */
export function capStash(s: Stash): Stash {
  const out = { ...s };
  let room: number = STASH_CAP.weapons;
  for (const w of KEEP_ORDER) {
    out[w] = Math.min(s[w], room);
    room -= out[w];
  }
  out.clip = Math.min(s.clip, STASH_CAP.clips);
  for (const g of ['medkit', 'armour', 'scanner', 'scope'] as const) out[g] = Math.min(s[g], STASH_CAP.gadgets);
  return out;
}
