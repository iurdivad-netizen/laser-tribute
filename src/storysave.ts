import { CAMPAIGN } from './core/campaign';
import { BASE_RULES, bedCount, nodeById } from './core/world/base';
import type { Loadout } from './core/loadout';
import { DIFFICULTY_IDS, type DifficultyId } from './core/world/difficulty';
import { CAPITAL_REGION, PLANET_VERSION, REGIONS } from './core/world/planet';
import { nextScene, see, sceneById } from './core/world/story';
import type { Holder, PoolSoldier, RegionState, World, WorldStatus } from './core/world/world';
import { browserStorage, isInt, isObj, loadout, soldiers, stash, type SaveStorage } from './save';

export const STORY_SAVE_KEY = 'laser-tribute-story';
export const STORY_SAVE_VERSION = 3;

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

const POOL_STATUSES = ['ready', 'training', 'wounded'] as const;

function poolSoldiers(v: unknown, beds: number): PoolSoldier[] | null {
  if (!Array.isArray(v) || v.length > beds) return null;
  const out: PoolSoldier[] = [];
  const names = new Set<string>();
  for (const item of v) {
    if (!isObj(item) || typeof item.name !== 'string' || item.name.length === 0 || item.name.length > 40) return null;
    if (names.has(item.name)) return null;
    names.add(item.name);
    if (!isInt(item.kills, 0, 9999) || !isInt(item.trained, 0, 9999) || !isInt(item.daysLeft, 0, 30)) return null;
    if (!POOL_STATUSES.includes(item.status as never)) return null;
    if ((item.status === 'ready') !== (item.daysLeft === 0)) return null;
    out.push({ name: item.name, kills: item.kills, trained: item.trained, status: item.status as PoolSoldier['status'], daysLeft: item.daysLeft });
  }
  return out;
}

/** The research record when every id is known, unique and its prerequisites are done; the active project likewise. */
function researchState(v: unknown): World['research'] | null {
  if (!isObj(v) || !Array.isArray(v.done)) return null;
  const done: string[] = [];
  for (const id of v.done) {
    if (typeof id !== 'string' || !nodeById(id) || done.includes(id)) return null;
    done.push(id);
  }
  if (!done.every((id) => nodeById(id)!.needs.every((n) => done.includes(n)))) return null;
  if (v.active === null) return { done, active: null };
  if (!isObj(v.active) || typeof v.active.node !== 'string' || !isInt(v.active.daysLeft, 1, 30)) return null;
  const node = nodeById(v.active.node);
  if (!node || done.includes(node.id) || !node.needs.every((n) => done.includes(n))) return null;
  return { done, active: { node: node.id, daysLeft: v.active.daysLeft } };
}

/** The scene record: known unique ids seen, and a 0 or 1 for each seen scene that has a choice. */
function sceneRecord(seen: unknown, chosen: unknown): Pick<World, 'seen' | 'chosen'> | null {
  if (!Array.isArray(seen) || !isObj(chosen) || Array.isArray(chosen)) return null;
  const ids: string[] = [];
  for (const id of seen) {
    if (typeof id !== 'string' || !sceneById(id) || ids.includes(id)) return null;
    ids.push(id);
  }
  const out: Record<string, 0 | 1> = {};
  for (const [id, option] of Object.entries(chosen)) {
    if (!ids.includes(id) || !sceneById(id)?.choice || (option !== 0 && option !== 1)) return null;
    out[id] = option;
  }
  return { seen: ids, chosen: out };
}

/** An older save has no scene record: every scene whose trigger already holds counts as seen, so the past is not replayed. */
function markPastSeen(w: World): World {
  let next = w;
  for (let s = nextScene(next); s; s = nextScene(next)) next = see(next, s.id);
  return next;
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
  if (!isObj(raw) || (raw.version !== 1 && raw.version !== 2 && raw.version !== STORY_SAVE_VERSION) || !isObj(raw.world)) return null;
  const w = raw.world;
  if (w.planetVersion !== PLANET_VERSION) return null;
  if (!DIFFICULTY_IDS.includes(w.difficulty as DifficultyId)) return null;
  if (!STATUSES.includes(w.status as WorldStatus)) return null;
  if (!isInt(w.seed, -(2 ** 31), 2 ** 31) || !isInt(w.day, 0, 99999)) return null;
  const regions = regionStates(w.regions);
  const fallen = soldiers(w.fallen);
  const gear = stash(w.stash);
  if (!regions || !fallen || !gear) return null;
  const held = regions.some((r) => r.holder === 'player');
  if (w.status === 'won' && regions[CAPITAL_REGION].holder !== 'player') return null;
  if (w.status === 'active' && !held) return null;

  let credits: number;
  let research: World['research'];
  let pool: PoolSoldier[];
  let squad: string[];
  if (raw.version === 1) {
    // project 1: a roster of four, no base. They become ready soldiers, with the starting credits and no research.
    const roster = soldiers(w.roster, CAMPAIGN.rosterSize);
    if (!roster) return null;
    credits = BASE_RULES.startCredits;
    research = { done: [], active: null };
    pool = roster.map((r) => ({ name: r.name, kills: r.kills, trained: 0, status: 'ready' as const, daysLeft: 0 }));
    squad = roster.map((r) => r.name);
  } else {
    if (!isInt(w.credits, 0, 999999)) return null;
    const r = researchState(w.research);
    if (!r) return null;
    const p = poolSoldiers(w.soldiers, bedCount(r.done));
    if (!p) return null;
    if (!Array.isArray(w.squad) || w.squad.length > CAMPAIGN.rosterSize || new Set(w.squad).size !== w.squad.length) return null;
    for (const name of w.squad) {
      if (typeof name !== 'string' || !p.some((x) => x.name === name && x.status === 'ready')) return null;
    }
    credits = w.credits;
    research = r;
    pool = p;
    squad = w.squad as string[];
  }
  if (!isInt(w.namesUsed, CAMPAIGN.rosterSize, 9999) || w.namesUsed < fallen.length + pool.length) return null;
  let record: Pick<World, 'seen' | 'chosen'> = { seen: [], chosen: {} };
  if (raw.version === STORY_SAVE_VERSION) {
    const r = sceneRecord(w.seen, w.chosen);
    if (!r) return null;
    record = r;
  }
  let world: World = {
    planetVersion: PLANET_VERSION,
    seed: w.seed,
    difficulty: w.difficulty as DifficultyId,
    day: w.day,
    status: w.status as WorldStatus,
    regions,
    credits,
    research,
    soldiers: pool,
    squad,
    fallen,
    namesUsed: w.namesUsed,
    stash: gear,
    ...record,
  };
  if (raw.version !== STORY_SAVE_VERSION) world = markPastSeen(world);
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
