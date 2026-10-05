import { emptyStash, type Stash } from './stash';
import type { GameState } from './types';

/** The most weapons and the most spare clips the squad stash keeps. */
export const STASH_CAP = { weapons: 4, clips: 4, gadgets: 4 } as const;

export function addStash(a: Stash, b: Stash): Stash {
  return {
    rifle: a.rifle + b.rifle,
    pistol: a.pistol + b.pistol,
    grenade: a.grenade + b.grenade,
    clip: a.clip + b.clip,
    medkit: a.medkit + b.medkit,
    armour: a.armour + b.armour,
    scanner: a.scanner + b.scanner,
  };
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

/** At most 4 weapons (rifles first) and 4 clips; grenades are not capped. */
export function capStash(s: Stash): Stash {
  const rifle = Math.min(s.rifle, STASH_CAP.weapons);
  const pistol = Math.min(s.pistol, STASH_CAP.weapons - rifle);
  return {
    rifle,
    pistol,
    grenade: s.grenade,
    clip: Math.min(s.clip, STASH_CAP.clips),
    medkit: Math.min(s.medkit, STASH_CAP.gadgets),
    armour: Math.min(s.armour, STASH_CAP.gadgets),
    scanner: Math.min(s.scanner, STASH_CAP.gadgets),
  };
}
