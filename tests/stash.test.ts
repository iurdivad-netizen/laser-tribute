import { describe, expect, it } from 'vitest';
import { newCampaign, recordMission } from '../src/core/campaign';
import {
  applyLoadout, defaultLoadout, fitLoadout, loadoutCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { createMission } from '../src/core/missions';
import { MISSIONS } from '../src/core/missions';
import { emptyStash, nextStash, stashOf, describeStash, type Stash } from '../src/core/stash';
import { addStash, capStash } from '../src/core/loot';
import { corridorRows, makeState, unit } from './helpers';

const four = (weapon: 'pistol' | 'rifle', grenades: number): Loadout =>
  Array.from({ length: 4 }, () => ({ weapon, grenades, clips: 1 }));

describe('loadout cost with a stash', () => {
  it('stash gear is free, in soldier order, up to what is stashed', () => {
    const stash: Stash = stashOf({ rifle: 1, pistol: 5, grenade: 2, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 });
    // default: 2 rifles (50) + 2 pistols (20) + 4 grenades (32) = 102
    // free: 1 rifle (25) + 2 pistols (20) + 2 grenades (16) = 61
    expect(loadoutCost(defaultLoadout(), stash)).toBe(41);
    expect(loadoutCost(defaultLoadout())).toBe(102);
    expect(loadoutCost(defaultLoadout(), emptyStash())).toBe(102);
  });

  it('a big stash lets an otherwise unaffordable kit through validation', () => {
    const big = four('rifle', 3); // 196
    expect(validateLoadout(big, 120)).toMatch(/budget/);
    expect(validateLoadout(big, 120, stashOf({ rifle: 4, pistol: 0, grenade: 12, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }))).toBeNull();
    expect(validateLoadout(big, 120, stashOf({ rifle: 2, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }))).toMatch(/budget is 120/);
  });

  it('applyLoadout and createMission accept the stash', () => {
    const stash: Stash = stashOf({ rifle: 4, pistol: 0, grenade: 12, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 });
    const s = createMission(MISSIONS[2], 1, undefined, four('rifle', 3), 120, stash);
    expect(s.units.filter((u) => u.side === 'player').every((u) => u.weapon === 'rifle' && u.grenades === 3)).toBe(true);
    expect(() => applyLoadout(s, four('rifle', 3), 120)).toThrow(/budget/);
  });

  it('fitLoadout keeps a kit that fits only thanks to the stash', () => {
    const prev = four('rifle', 3);
    expect(fitLoadout(prev, 120, stashOf({ rifle: 4, pistol: 0, grenade: 12, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }))).toBe(prev);
    expect(fitLoadout(prev, 120)).not.toBe(prev);
  });
});

/** A finished 4-soldier mission. */
function finished(status: 'won' | 'lost' = 'won') {
  const s = makeState(corridorRows('PPPP'));
  s.status = status;
  for (const u of s.units) {
    u.weapon = 'pistol';
    u.grenades = 1;
  }
  return s;
}

describe('nextStash', () => {
  it('collects found weapons and extra grenades held by survivors', () => {
    const s = finished();
    unit(s, 'p1').weapon = 'rifle'; // found a rifle
    unit(s, 'p2').grenades = 2; // found a grenade
    unit(s, 'p3').alive = false;
    const next = nextStash(emptyStash(), four('pistol', 1), s);
    expect(next).toEqual(stashOf({ rifle: 1, pistol: 0, grenade: 1, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
  });

  it('gives lent stash gear back if the soldier survives, loses it if they die', () => {
    const s = finished();
    unit(s, 'p2').alive = false; // p2 held a lent pistol
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      unit(s, id).weapon = 'pistol';
      unit(s, id).grenades = 1;
    }
    unit(s, 'p2').alive = false;
    const next = nextStash(stashOf({ rifle: 0, pistol: 2, grenade: 1, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }), four('pistol', 1), s);
    // p1 and p2 hold the 2 lent pistols; p1 gives it back, p2 is dead. p1 also holds the lent grenade.
    expect(next).toEqual(stashOf({ rifle: 0, pistol: 1, grenade: 1, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
  });

  it('keeps unused stash gear', () => {
    const next = nextStash(stashOf({ rifle: 3, pistol: 1, grenade: 4, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }), four('pistol', 1), (() => {
      const s = finished();
      for (const u of s.units) u.grenades = 1;
      return s;
    })());
    expect(next.rifle).toBe(3);
  });

  it('does not count a soldier who swapped back to their own weapon as finding it', () => {
    const s = finished();
    for (const u of s.units) u.grenades = 1;
    expect(nextStash(emptyStash(), four('pistol', 1), s)).toEqual(stashOf({ rifle: 0, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
  });
});

describe('the campaign stash', () => {
  it('starts empty', () => {
    expect(newCampaign().stash).toEqual(stashOf({ rifle: 0, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
  });

  it('a won mission adds the found gear', () => {
    const s = finished('won');
    unit(s, 'p1').weapon = 'rifle';
    for (const u of s.units) u.grenades = 1;
    const c = recordMission(newCampaign(), s, 3, four('pistol', 1));
    expect(c.stash).toEqual(stashOf({ rifle: 1, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
  });

  it('a lost mission leaves the stash as it was', () => {
    const s = finished('lost');
    unit(s, 'p1').weapon = 'rifle';
    const before = newCampaign();
    before.stash = stashOf({ rifle: 2, pistol: 1, grenade: 3, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 });
    const c = recordMission(before, s, 3, four('pistol', 1));
    expect(c.stash).toEqual(stashOf({ rifle: 2, pistol: 1, grenade: 3, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
    expect(c.stash).not.toBe(before.stash);
  });

  it('without the loadout used the stash is unchanged', () => {
    const c = recordMission(newCampaign(), finished('won'), 3);
    expect(c.stash).toEqual(stashOf({ rifle: 0, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 }));
  });
});

describe('the stash with the new items', () => {
  it('adds and caps every key; weapons share the cap of four, heaviest first', () => {
    const sum = addStash(stashOf({ smoke: 1, sniper: 1 }), stashOf({ smoke: 2, shotgun: 3, rifle: 2, pistol: 5 }));
    expect(sum.smoke).toBe(3);
    const capped = capStash(sum);
    expect(capped.sniper + capped.rifle + capped.shotgun + capped.smg + capped.pistol).toBe(4);
    expect(capped.sniper).toBe(1);
    expect(capped.rifle).toBe(2);
    expect(capped.shotgun).toBe(1);
    expect(capped.pistol).toBe(0);
    expect(capped.smoke).toBe(3); // throwables are not capped
  });

  it('describes the new items', () => {
    expect(describeStash(stashOf({ shotgun: 1, smoke: 2, flash: 1 }))).toBe('1 shotgun, 2 smoke, 1 flashbang');
  });
});
