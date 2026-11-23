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

const good = () => JSON.parse(JSON.stringify({ version: 1, world: newWorld(3, 'standard'), loadout: defaultLoadout() }));
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
    reject((o) => { o.version = 2; });
    reject((o) => { o.world.planetVersion = 99; });
    reject((o) => { o.world.difficulty = 'iron'; });
    reject((o) => { o.world.status = 'paused'; });
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
    reject((o) => { o.world.roster.pop(); });
    reject((o) => { o.world.roster[0].name = ''; });
    reject((o) => { o.world.fallen = 'none'; });
    reject((o) => { o.world.namesUsed = 3; });
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
