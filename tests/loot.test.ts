import { describe, expect, it } from 'vitest';
import { newCampaign, recordMission } from '../src/core/campaign';
import { defaultLoadout, loadoutCost, netSoldierCost, type Loadout } from '../src/core/loadout';
import { addStash, capStash, lootFrom } from '../src/core/loot';
import { describeStash, emptyStash, nextStash } from '../src/core/stash';
import { corridorRows, makeState, unit } from './helpers';

/** P with four enemies: e1 rifle, e2 pistol, e3 rifle, e4 pistol (the map's default weapons). */
const arena = () => makeState(corridorRows('PEEEE'));

describe('lootFrom', () => {
  it('collects the weapon and the spare clip of every killed enemy', () => {
    const s = arena();
    for (const id of ['e1', 'e2', 'e3']) unit(s, id).alive = false;
    expect(lootFrom(s)).toEqual({ rifle: 2, pistol: 1, grenade: 0, clip: 3, medkit: 0, armour: 0, scanner: 0, scope: 0 });
  });

  it('takes only the clips an enemy still has, and ignores living enemies and dead soldiers', () => {
    const s = arena();
    unit(s, 'e1').alive = false;
    unit(s, 'e1').clips = 0;
    unit(s, 'p1').alive = false;
    expect(lootFrom(s)).toEqual({ rifle: 1, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 });
  });
});

describe('capStash', () => {
  it('keeps at most 4 weapons, rifles first, and 4 clips; grenades are not capped', () => {
    expect(capStash({ rifle: 3, pistol: 3, grenade: 9, clip: 6, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toEqual({ rifle: 3, pistol: 1, grenade: 9, clip: 4, medkit: 0, armour: 0, scanner: 0, scope: 0 });
    expect(capStash({ rifle: 6, pistol: 2, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toEqual({ rifle: 4, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 });
  });

  it('leaves a stash under the caps unchanged', () => {
    const s = { rifle: 1, pistol: 2, grenade: 1, clip: 3, medkit: 0, armour: 0, scanner: 0, scope: 0 };
    expect(capStash(s)).toEqual(s);
  });

  it('adds two stashes field by field', () => {
    expect(addStash({ rifle: 1, pistol: 0, grenade: 2, clip: 1, medkit: 0, armour: 0, scanner: 0, scope: 0 }, { rifle: 2, pistol: 1, grenade: 0, clip: 3, medkit: 0, armour: 0, scanner: 0, scope: 0 }))
      .toEqual({ rifle: 3, pistol: 1, grenade: 2, clip: 4, medkit: 0, armour: 0, scanner: 0, scope: 0 });
  });
});

describe('loot after a mission', () => {
  const four = (): Loadout => defaultLoadout();

  function won(deadEnemies: string[]) {
    const s = arena();
    s.status = 'won';
    for (const id of deadEnemies) unit(s, id).alive = false;
    return s;
  }

  it('a won mission adds the capped loot to the stash', () => {
    const next = recordMission(newCampaign(), won(['e1', 'e2', 'e3', 'e4']), 3, four());
    expect(next.stash).toEqual({ rifle: 2, pistol: 2, grenade: 0, clip: 4, medkit: 0, armour: 0, scanner: 0, scope: 0 });
  });

  it('the stash never grows beyond 4 weapons and 4 clips over several missions', () => {
    let c = newCampaign();
    for (let i = 0; i < 3; i++) c = recordMission(c, won(['e1', 'e2', 'e3', 'e4']), 5, four());
    expect(c.stash.rifle + c.stash.pistol).toBe(4);
    expect(c.stash.clip).toBe(4);
    expect(c.stash.rifle).toBe(4);
  });

  it('a lost mission leaves the stash alone, whatever was killed', () => {
    const s = won(['e1', 'e2']);
    s.status = 'lost';
    const before = newCampaign();
    before.stash = { rifle: 1, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 };
    expect(recordMission(before, s, 3, four()).stash).toEqual({ rifle: 1, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 });
  });
});

describe('spare clips in the stash', () => {
  const withClips = (clips: number[]): Loadout => defaultLoadout().map((s, i) => ({ ...s, clips: clips[i] ?? 1 }));

  it('a stashed clip covers an extra clip, in soldier order', () => {
    const l = withClips([3, 1, 1, 1]); // two extra clips: 10 credits
    expect(loadoutCost(l)).toBe(112);
    expect(loadoutCost(l, { ...emptyStash(), clip: 1, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toBe(107);
    expect(loadoutCost(l, { ...emptyStash(), clip: 2, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toBe(102);
    expect(loadoutCost(l, { ...emptyStash(), clip: 9, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toBe(102); // the free first clip is never refunded
  });

  it('unused stash clips come back, used ones are gone', () => {
    const used = withClips([3, 1, 1, 1]);
    const s = makeState(corridorRows('PPPP'));
    s.status = 'won';
    for (const u of s.units) { u.weapon = u.id === 'p1' || u.id === 'p2' ? 'rifle' : 'pistol'; u.grenades = 1; u.clips = 1; }
    unit(s, 'p1').clips = 3; // kept both
    expect(nextStash({ ...emptyStash(), clip: 2, medkit: 0, armour: 0, scanner: 0, scope: 0 }, used, s).clip).toBe(2);
    unit(s, 'p1').clips = 2; // used one
    expect(nextStash({ ...emptyStash(), clip: 2, medkit: 0, armour: 0, scanner: 0, scope: 0 }, used, s).clip).toBe(1);
  });

  it('describes clips in the stash text', () => {
    expect(describeStash({ rifle: 1, pistol: 0, grenade: 2, clip: 3, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toBe('1 rifle, 2 grenades, 3 clips');
    expect(describeStash({ rifle: 0, pistol: 0, grenade: 0, clip: 1, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toBe('1 clip');
    expect(describeStash(emptyStash())).toBe('');
  });
});

describe('netSoldierCost', () => {
  it('is the soldier price minus what the stash covers', () => {
    const l = defaultLoadout(); // soldier 1: rifle 25 + one grenade 8
    expect(netSoldierCost(l, 0, emptyStash())).toBe(33);
    expect(netSoldierCost(l, 0, { ...emptyStash(), rifle: 1 })).toBe(8);
    expect(netSoldierCost(l, 0, { rifle: 1, pistol: 0, grenade: 1, clip: 0, medkit: 0, armour: 0, scanner: 0, scope: 0 })).toBe(0);
    expect(netSoldierCost(l, 1, { ...emptyStash(), rifle: 1 })).toBe(33); // the stash rifle goes to soldier 1 first, so soldier 2 pays in full
  });
});

describe('row prices and the total agree', () => {
  it('the total cost is the sum of the four net prices, for uneven stash cover', () => {
    const l: Loadout = [
      { weapon: 'rifle', grenades: 3, clips: 1 },
      { weapon: 'pistol', grenades: 0, clips: 4 },
      { weapon: 'rifle', grenades: 1, clips: 2 },
      { weapon: 'pistol', grenades: 1, clips: 1 },
    ];
    const stashes = [
      emptyStash(),
      { rifle: 1, pistol: 0, grenade: 2, clip: 3, medkit: 0, armour: 0, scanner: 0, scope: 0 },
      { rifle: 0, pistol: 2, grenade: 9, clip: 1, medkit: 0, armour: 0, scanner: 0, scope: 0 },
      { rifle: 9, pistol: 9, grenade: 9, clip: 9, medkit: 0, armour: 0, scanner: 0, scope: 0 },
    ];
    for (const stash of stashes) {
      const sum = [0, 1, 2, 3].reduce((n, i) => n + netSoldierCost(l, i, stash), 0);
      expect(sum, JSON.stringify(stash)).toBe(loadoutCost(l, stash));
    }
  });
});

