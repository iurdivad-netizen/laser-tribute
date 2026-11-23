import { CAMPAIGN } from './core/campaign';
import type { Loadout } from './core/loadout';
import { DIFFICULTY_IDS, type DifficultyId } from './core/world/difficulty';
import { CAPITAL_REGION, PLANET_VERSION, REGIONS } from './core/world/planet';
import type { Holder, RegionState, World, WorldStatus } from './core/world/world';
import { browserStorage, isInt, isObj, loadout, soldiers, stash, type SaveStorage } from './save';

export const STORY_SAVE_KEY = 'laser-tribute-story';
export const STORY_SAVE_VERSION = 1;

export interface StorySave {
  world: World;
  loadout: Loadout;
}

/** Which holders a region of each kind can have: a neutral place is either neutral or allied, never held outright. */
const HOLDERS: Record<string, readonly Holder[]> = {
  start: ['player', 'enemy'],
  enemy: ['enemy', 'player'],
  neutral: ['neutral', 'allied'],
  wild: ['wild'],
};
const STATUSES: readonly WorldStatus[] = ['active', 'won', 'lost'];

function regionStates(v: unknown): RegionState[] | null {
  if (!Array.isArray(v) || v.length !== REGIONS.length) return null;
  const out: RegionState[] = [];
  for (let i = 0; i < REGIONS.length; i++) {
    const s = v[i];
    if (!isObj(s) || !HOLDERS[REGIONS[i].kind].includes(s.holder as Holder)) return null;
    if (!isInt(s.garrison, 0, REGIONS[i].maxGarrison) || !isInt(s.attempts, 0, 99999)) return null;
    if (typeof s.visited !== 'boolean') return null;
    out.push({ holder: s.holder as Holder, garrison: s.garrison, visited: s.visited, attempts: s.attempts });
  }
  return out;
}

/** The saved story and loadout, or null when the text is missing or any part of it is inconsistent. */
export function parseStory(text: string | null): StorySave | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.version !== STORY_SAVE_VERSION || !isObj(raw.world)) return null;
  const w = raw.world;
  if (w.planetVersion !== PLANET_VERSION) return null;
  if (!DIFFICULTY_IDS.includes(w.difficulty as DifficultyId)) return null;
  if (!STATUSES.includes(w.status as WorldStatus)) return null;
  if (!isInt(w.seed, -(2 ** 31), 2 ** 31) || !isInt(w.day, 0, 99999)) return null;
  const regions = regionStates(w.regions);
  const roster = soldiers(w.roster, CAMPAIGN.rosterSize);
  const fallen = soldiers(w.fallen);
  const gear = stash(w.stash);
  if (!regions || !roster || !fallen || !gear || !isInt(w.namesUsed, CAMPAIGN.rosterSize, 9999)) return null;
  const held = regions.some((r) => r.holder === 'player');
  if (w.status === 'won' && regions[CAPITAL_REGION].holder !== 'player') return null;
  if (w.status === 'active' && !held) return null;
  const world: World = {
    planetVersion: PLANET_VERSION,
    seed: w.seed,
    difficulty: w.difficulty as DifficultyId,
    day: w.day,
    status: w.status as WorldStatus,
    regions,
    roster,
    fallen,
    namesUsed: w.namesUsed,
    stash: gear,
  };
  return { world, loadout: loadout(raw.loadout) };
}

/** Reads and writes the one story save. Every storage error is swallowed: the game just plays without saving. */
export class StoryStore {
  constructor(private readonly storage: SaveStorage | null) {}

  load(): StorySave | null {
    try {
      return parseStory(this.storage?.getItem(STORY_SAVE_KEY) ?? null);
    } catch {
      return null;
    }
  }

  save(world: World, loadout: Loadout): void {
    try {
      this.storage?.setItem(STORY_SAVE_KEY, JSON.stringify({ version: STORY_SAVE_VERSION, world, loadout }));
    } catch {
      // private mode or a full disk: carry on unsaved
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(STORY_SAVE_KEY);
    } catch {
      // nothing to do
    }
  }
}

export function defaultStoryStore(): StoryStore | null {
  const s = browserStorage();
  return s ? new StoryStore(s) : null;
}
