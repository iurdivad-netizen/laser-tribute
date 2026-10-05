import { describe, expect, it } from 'vitest';
import { newCampaign, recordMission, type Campaign } from '../src/core/campaign';
import { defaultLoadout } from '../src/core/loadout';
import { SAVE_KEY, SaveStore, defaultSaveStore, parseSave, type SaveStorage } from '../src/save';
import { corridorRows, makeState, unit } from './helpers';

function memory(initial?: string): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SAVE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const throwing: SaveStorage = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

/** A campaign after one won mission with a death (rookie replacement), a promotion-worthy soldier and a stash. */
function played(): Campaign {
  const s = makeState(corridorRows('PPPP'));
  unit(s, 'p2').alive = false;
  unit(s, 'p2').kills = 3;
  unit(s, 'p1').kills = 2;
  s.status = 'won';
  const c = recordMission(newCampaign(), s, 3, defaultLoadout());
  c.stash = { rifle: 2, pistol: 1, grenade: 3, clip: 4, medkit: 0, armour: 0, scanner: 0, scope: 0 };
  return c;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (over: (o: any) => void, c: Campaign = played()): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o: any = { version: 1, campaign: JSON.parse(JSON.stringify(c)), loadout: defaultLoadout() };
  over(o);
  return JSON.stringify(o);
};

describe('SaveStore', () => {
  it('round-trips a played campaign and its loadout', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    const c = played();
    const loadout = defaultLoadout();
    loadout[0].clips = 3;
    store.save(c, loadout);
    expect(store.load()).toEqual({ campaign: c, loadout });
  });

  it('returns null with no save, and clear removes a save', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    expect(store.load()).toBeNull();
    store.save(played(), defaultLoadout());
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    store.clear();
    expect(mem.data.has(SAVE_KEY)).toBe(false);
  });

  it('survives storage that throws on every call, and a missing storage', () => {
    for (const storage of [throwing, null]) {
      const store = new SaveStore(storage, 3);
      expect(() => store.save(played(), defaultLoadout())).not.toThrow();
      expect(store.load()).toBeNull();
      expect(() => store.clear()).not.toThrow();
    }
  });

  it('does not delete a save it cannot read', () => {
    const mem = memory('{"version":2,"future":true}');
    const store = new SaveStore(mem, 3);
    expect(store.load()).toBeNull();
    expect(mem.data.get(SAVE_KEY)).toBe('{"version":2,"future":true}');
  });

  it('has no default store without a browser', () => {
    expect(defaultSaveStore(3)).toBeNull();
  });
});

describe('parseSave', () => {
  it('accepts a valid save', () => {
    expect(parseSave(json(() => undefined), 3)).not.toBeNull();
  });

  it.each([
    ['null text', null],
    ['not JSON', '{nope'],
    ['an array', '[]'],
    ['a string', '"x"'],
    ['the wrong version', json((o) => { o.version = 2; })],
    ['a missing campaign', json((o) => { delete o.campaign; })],
    ['a finished campaign', json((o) => { o.campaign.status = 'won'; })],
    ['a lost campaign', json((o) => { o.campaign.status = 'lost'; })],
    ['a mission index past the list', json((o) => { o.campaign.missionIndex = 3; o.campaign.missionsWon = 3; })],
    ['a negative mission index', json((o) => { o.campaign.missionIndex = -1; o.campaign.missionsWon = -1; })],
    ['wins that differ from the index', json((o) => { o.campaign.missionsWon = 2; })],
    ['a roster of the wrong size', json((o) => { o.campaign.roster.pop(); })],
    ['an empty name', json((o) => { o.campaign.roster[0].name = ''; })],
    ['fractional kills', json((o) => { o.campaign.roster[0].kills = 1.5; })],
    ['negative kills', json((o) => { o.campaign.roster[0].kills = -1; })],
    ['a bad fallen entry', json((o) => { o.campaign.fallen = [{ name: 5, kills: 0 }]; })],
    ['fewer names used than the roster', json((o) => { o.campaign.namesUsed = 2; })],
    ['a negative stash', json((o) => { o.campaign.stash.rifle = -1; })],
    ['a missing stash field', json((o) => { delete o.campaign.stash.clip; })],
    ['a huge stash', json((o) => { o.campaign.stash.grenade = 1000; })],
  ])('rejects %s', (_name, text) => {
    expect(parseSave(text, 3)).toBeNull();
  });

  it('drops unknown fields', () => {
    const save = parseSave(json((o) => { o.campaign.extra = 1; o.campaign.roster[0].secret = 'x'; o.junk = 1; }), 3)!;
    expect(save.campaign).not.toHaveProperty('extra');
    expect(save.campaign.roster[0]).not.toHaveProperty('secret');
    expect(save).not.toHaveProperty('junk');
  });

  it('replaces a bad loadout with the default one, and keeps a good one', () => {
    for (const bad of [null, 'x', [], [{ weapon: 'rifle' }], defaultLoadout().map((s) => ({ ...s, weapon: 'laser' })),
      defaultLoadout().map((s) => ({ ...s, grenades: 9 })), defaultLoadout().map((s) => ({ ...s, clips: 0 }))]) {
      const save = parseSave(json((o) => { o.loadout = bad; }), 3)!;
      expect(save.loadout).toEqual(defaultLoadout());
    }
    const custom = defaultLoadout();
    custom[1] = { weapon: 'pistol', grenades: 3, clips: 4 };
    expect(parseSave(json((o) => { o.loadout = custom; }), 3)!.loadout).toEqual(custom);
  });
});

describe('gadgets in a save', () => {
  it('an old save without gadget fields still loads, with no gadgets and an empty gadget stash', () => {
    const save = parseSave(json((o) => {
      delete o.campaign.stash.medkit;
      delete o.campaign.stash.armour;
      delete o.campaign.stash.scanner;
    }), 3)!;
    expect(save.campaign.stash).toMatchObject({ medkit: 0, armour: 0, scanner: 0, scope: 0 });
    expect(save.loadout.every((s) => s.gadget === undefined)).toBe(true);
  });

  it('round-trips gadgets in the loadout and the stash', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    const c = played();
    c.stash = { ...c.stash, medkit: 2, armour: 1, scanner: 3, scope: 0 };
    const loadout = defaultLoadout();
    loadout[0] = { ...loadout[0], gadget: 'medkit' };
    loadout[3] = { ...loadout[3], gadget: 'armour' };
    store.save(c, loadout);
    expect(store.load()).toEqual({ campaign: c, loadout });
  });

  it('an unknown gadget id replaces the whole loadout with the default one', () => {
    const bad = defaultLoadout().map((s, i) => (i === 1 ? { ...s, clips: 3, gadget: 'laser' } : s)); // otherwise valid, so a default result proves the fallback
    expect(parseSave(json((o) => { o.loadout = bad; }), 3)!.loadout).toEqual(defaultLoadout());
  });

  it('rejects a negative or huge gadget count in the stash', () => {
    expect(parseSave(json((o) => { o.campaign.stash.medkit = -1; }), 3)).toBeNull();
    expect(parseSave(json((o) => { o.campaign.stash.scanner = 100; }), 3)).toBeNull();
    expect(parseSave(json((o) => { o.campaign.stash.armour = 1.5; }), 3)).toBeNull();
  });
});
