import { describe, expect, it } from 'vitest';
import { defaultLoadout } from '../src/core/loadout';
import { CAPITAL_REGION } from '../src/core/world/planet';
import { advance, newWorld, visit, type World } from '../src/core/world/world';
import type { SaveStorage } from '../src/save';
import { STORY_SAVE_KEY, StoryStore, parseStory } from '../src/storysave';

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const good = () => JSON.parse(JSON.stringify({ version: 3, world: newWorld(3, 'standard'), loadout: defaultLoadout() }));
const reject = (mutate: (o: any) => void) => {
  const o = good();
  mutate(o);
  expect(parseStory(JSON.stringify(o))).toBeNull();
};

describe('StoryStore', () => {
  it('round-trips a new world and a played one', () => {
    const storage = memory();
    const store = new StoryStore(storage);
    expect(store.load()).toBeNull();
    const fresh = newWorld(3, 'standard');
    store.save(fresh, defaultLoadout());
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(true);
    expect(store.load()).toEqual({ world: fresh, loadout: defaultLoadout() });
    const played: World = advance(visit(fresh, 5), 30);
    store.save(played, defaultLoadout());
    expect(store.load()?.world).toEqual(played);
  });

  it('clears, and survives a storage that throws', () => {
    const storage = memory();
    const store = new StoryStore(storage);
    store.save(newWorld(1, 'calm'), defaultLoadout());
    store.clear();
    expect(store.load()).toBeNull();
    const broken: SaveStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const bad = new StoryStore(broken);
    expect(() => bad.save(newWorld(1, 'calm'), defaultLoadout())).not.toThrow();
    expect(bad.load()).toBeNull();
    expect(() => bad.clear()).not.toThrow();
    expect(new StoryStore(null).load()).toBeNull();
  });
});

describe('parseStory', () => {
  it('accepts a well-formed save', () => {
    expect(parseStory(JSON.stringify(good()))?.world.seed).toBe(3);
  });

  it('rejects missing, empty and malformed text', () => {
    expect(parseStory(null)).toBeNull();
    expect(parseStory('')).toBeNull();
    expect(parseStory('{not json')).toBeNull();
    expect(parseStory('[]')).toBeNull();
  });

  it('rejects the wrong version, planet version, difficulty or status', () => {
    reject((o) => { o.version = 4; });
    reject((o) => { o.world.planetVersion = 99; });
    reject((o) => { o.world.difficulty = 'iron'; });
    reject((o) => { o.world.status = 'paused'; });
  });

  it('round-trips the scene record', () => {
    const w = { ...newWorld(3, 'standard'), seen: ['landing', 'offer'], chosen: { offer: 1 as const } };
    const store = new StoryStore(memory());
    store.save(w, defaultLoadout());
    expect(store.load()?.world).toEqual(w);
  });

  it('rejects a bad scene record', () => {
    reject((o) => { o.world.seen = 'landing'; });
    reject((o) => { o.world.seen = ['no-such-scene']; });
    reject((o) => { o.world.seen = ['landing', 'landing']; });
    reject((o) => { o.world.chosen = []; });
    reject((o) => { o.world.seen = ['offer']; o.world.chosen = { landing: 0 }; }); // landing has no choice
    reject((o) => { o.world.chosen = { offer: 0 }; }); // chosen but not seen
    reject((o) => { o.world.seen = ['offer']; o.world.chosen = { offer: 2 }; });
  });

  it('still parses an ended story', () => {
    const w = { ...newWorld(3, 'standard'), status: 'lost' as const, seen: ['defeat'] };
    expect(parseStory(JSON.stringify({ version: 3, world: w, loadout: defaultLoadout() }))?.world.seen).toEqual(['defeat']);
  });

  it('rejects bad numbers', () => {
    reject((o) => { o.world.day = -1; });
    reject((o) => { o.world.day = 1.5; });
    reject((o) => { o.world.seed = 'x'; });
    reject((o) => { o.world.regions[1].attempts = -1; });
    reject((o) => { o.world.regions[1].garrison = 99; });
    reject((o) => { o.world.regions[1].garrison = -1; });
  });

  it('rejects a wrong region list or impossible holders', () => {
    reject((o) => { o.world.regions.pop(); });
    reject((o) => { o.world.regions[1].holder = 'allied'; }); // an enemy region cannot be allied
    reject((o) => { o.world.regions[5].holder = 'player'; }); // a neutral region cannot be held directly
    reject((o) => { o.world.regions[3].holder = 'enemy'; }); // a wilderness cannot be enemy-held
    reject((o) => { o.world.regions[0].holder = 'wild'; });
    reject((o) => { o.world.regions[1].visited = 'yes'; });
    reject((o) => { o.world.regions[1] = null; });
  });

  it('rejects a bad roster, fallen list, name counter or stash', () => {
    reject((o) => { o.world.soldiers[1].name = o.world.soldiers[0].name; }); // duplicate names
    reject((o) => { o.world.soldiers[0].name = ''; });
    reject((o) => { o.world.soldiers[0].status = 'asleep'; });
    reject((o) => { o.world.soldiers[0].status = 'training'; }); // training needs days left
    reject((o) => { o.world.soldiers[0].daysLeft = 3; }); // ready needs none
    reject((o) => { o.world.soldiers[0].kills = -1; });
    reject((o) => { o.world.soldiers = Array.from({ length: 7 }, (_, i) => ({ name: `S${i}`, kills: 0, trained: 0, status: 'ready', daysLeft: 0 })); o.world.namesUsed = 7; }); // over 6 beds
    reject((o) => { o.world.squad = ['Alvarez', 'Brandt', 'Chen', 'Dubois', 'Alvarez']; });
    reject((o) => { o.world.squad = ['Nobody']; });
    reject((o) => { o.world.soldiers[0].status = 'training'; o.world.soldiers[0].daysLeft = 2; }); // squad still names him
    reject((o) => { o.world.credits = -5; });
    reject((o) => { o.world.credits = 1.5; });
    reject((o) => { o.world.research.done = ['smg']; }); // shotgun missing
    reject((o) => { o.world.research.done = ['warp-drive']; });
    reject((o) => { o.world.research.done = ['shotgun', 'shotgun']; });
    reject((o) => { o.world.research.active = { node: 'shotgun', daysLeft: 0 }; });
    reject((o) => { o.world.research.done = ['shotgun']; o.world.research.active = { node: 'shotgun', daysLeft: 2 }; });
    reject((o) => { o.world.research.active = { node: 'smg', daysLeft: 2 }; }); // prerequisite missing
    reject((o) => { o.world.fallen = 'none'; });
    reject((o) => { o.world.namesUsed = 3; });
    reject((o) => { o.world.fallen = [{ name: 'Old', kills: 1 }]; o.world.namesUsed = 4; }); // 4 soldiers + 1 fallen
    reject((o) => { o.world.stash.rifle = -2; });
  });

  it('rejects statuses the regions contradict', () => {
    reject((o) => { o.world.status = 'won'; }); // the capital is not held
    reject((o) => { o.world.regions[0].holder = 'enemy'; }); // active with nothing held
    const won = good();
    won.world.status = 'won';
    won.world.regions[CAPITAL_REGION].holder = 'player';
    expect(parseStory(JSON.stringify(won))).not.toBeNull();
  });

  it('falls back to the default loadout when the loadout is malformed', () => {
    const o = good();
    o.loadout = 'nonsense';
    expect(parseStory(JSON.stringify(o))?.loadout).toEqual(defaultLoadout());
  });
});
