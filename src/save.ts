import { CAMPAIGN, type Campaign, type Mode, type RosterSoldier } from './core/campaign';
import { ATTACHMENT_IDS, GADGET_IDS, THROWABLE_IDS, WEAPON_IDS } from './core/config';
import { CAMPAIGN_LENGTH, VARIATIONS } from './core/gen';
import { defaultLoadout, type Loadout } from './core/loadout';
import { STASH_KEYS, emptyStash, type Stash } from './core/stash';

export const SAVE_KEY = 'laser-tribute-save';
export const CAMPAIGN_SAVE_KEY = 'laser-tribute-campaign';
export const LAST_KEY = 'laser-tribute-last';
const keyFor = (mode: Mode): string => (mode === 'campaign' ? CAMPAIGN_SAVE_KEY : SAVE_KEY);
const SAVE_VERSION = 2;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Save {
  campaign: Campaign;
  loadout: Loadout;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function soldier(v: unknown): RosterSoldier | null {
  if (!isObj(v) || typeof v.name !== 'string' || v.name.length === 0 || v.name.length > 40) return null;
  if (!isInt(v.kills, 0, 9999)) return null;
  return { name: v.name, kills: v.kills };
}

function soldiers(v: unknown, exactly?: number): RosterSoldier[] | null {
  if (!Array.isArray(v) || v.length > 999 || (exactly !== undefined && v.length !== exactly)) return null;
  const out: RosterSoldier[] = [];
  for (const item of v) {
    const s = soldier(item);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

function stash(v: unknown): Stash | null {
  if (!isObj(v)) return null;
  const out = emptyStash();
  for (const k of STASH_KEYS) {
    const n = v[k];
    if (n === undefined && !['rifle', 'pistol', 'grenade', 'clip'].includes(k)) continue; // keys added later may be absent
    if (!isInt(n, 0, 99)) return null;
    out[k] = n;
  }
  return out;
}

/** The saved loadout when it is well formed; the default one otherwise (the app then fits it to the budget). */
function loadout(v: unknown): Loadout {
  if (!Array.isArray(v) || v.length !== CAMPAIGN.rosterSize) return defaultLoadout();
  const out: Loadout = [];
  for (const s of v) {
    if (!isObj(s) || !WEAPON_IDS.includes(s.weapon as never)) return defaultLoadout();
    if (!isInt(s.grenades, 0, 3) || !isInt(s.clips, 1, 4)) return defaultLoadout();
    if (s.throwable !== undefined && !THROWABLE_IDS.includes(s.throwable as never)) return defaultLoadout();
    if (s.gadget !== undefined && !GADGET_IDS.includes(s.gadget as never)) return defaultLoadout();
    if (s.attachment !== undefined && !ATTACHMENT_IDS.includes(s.attachment as never)) return defaultLoadout();
    out.push({
      weapon: s.weapon as (typeof WEAPON_IDS)[number], grenades: s.grenades, clips: s.clips,
      ...(s.throwable !== undefined ? { throwable: s.throwable as (typeof THROWABLE_IDS)[number] } : {}),
      ...(s.gadget !== undefined ? { gadget: s.gadget as (typeof GADGET_IDS)[number] } : {}),
      ...(s.attachment !== undefined ? { attachment: s.attachment as (typeof ATTACHMENT_IDS)[number] } : {}),
    });
  }
  return out;
}

/** The ten variations of a campaign save, or null when they are not exactly ten integers from 0 to 4. */
function variationList(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== CAMPAIGN_LENGTH) return null;
  const out: number[] = [];
  for (const n of v) {
    if (!isInt(n, 0, VARIATIONS - 1)) return null;
    out.push(n);
  }
  return out;
}

/** The saved campaign and loadout, or null when the text is missing or not a valid save. */
export function parseSave(text: string | null, missionCount: number, mode: Mode = 'tutorial'): Save | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || (raw.version !== 1 && raw.version !== SAVE_VERSION) || !isObj(raw.campaign)) return null;
  const c = raw.campaign;
  if (c.status !== 'active') return null;
  if (!isInt(c.missionIndex, 0, missionCount - 1) || c.missionsWon !== c.missionIndex) return null;
  if (mode === 'campaign' ? c.mode !== 'campaign' : c.mode !== undefined && c.mode !== 'tutorial') return null;
  const variations = mode === 'campaign' ? variationList(c.variations) : [];
  if (!variations) return null;
  const roster = soldiers(c.roster, CAMPAIGN.rosterSize);
  const fallen = soldiers(c.fallen);
  const gear = stash(c.stash);
  if (!roster || !fallen || !gear) return null;
  if (!isInt(c.namesUsed, CAMPAIGN.rosterSize, 9999)) return null;
  const campaign: Campaign = {
    mode,
    variations,
    missionIndex: c.missionIndex,
    missionsWon: c.missionIndex,
    roster,
    fallen,
    namesUsed: c.namesUsed,
    status: 'active',
    stash: gear,
  };
  return { campaign, loadout: loadout(raw.loadout) };
}

/** Reads and writes the one save. Every storage error is swallowed: the game just plays without saving. */
export class SaveStore {
  constructor(
    private readonly storage: SaveStorage | null,
    private readonly missionCount: number,
    private readonly mode: Mode = 'tutorial',
  ) {}

  load(): Save | null {
    try {
      return parseSave(this.storage?.getItem(keyFor(this.mode)) ?? null, this.missionCount, this.mode);
    } catch {
      return null;
    }
  }

  save(campaign: Campaign, loadout: Loadout): void {
    try {
      this.storage?.setItem(keyFor(this.mode), JSON.stringify({ version: SAVE_VERSION, campaign, loadout }));
    } catch {
      // private mode or a full disk: carry on unsaved
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(keyFor(this.mode));
    } catch {
      // nothing to do
    }
  }
}

/** Which mode was played last, so CONTINUE can pick it. Every storage error is swallowed. */
export class LastMode {
  constructor(private readonly storage: SaveStorage | null) {}

  get(): Mode | null {
    try {
      const v = this.storage?.getItem(LAST_KEY);
      return v === 'tutorial' || v === 'campaign' ? v : null;
    } catch {
      return null;
    }
  }

  set(mode: Mode): void {
    try {
      this.storage?.setItem(LAST_KEY, mode);
    } catch {
      // carry on unsaved
    }
  }
}

function browserStorage(): SaveStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A store over the browser's localStorage, or null where there is none (tests, blocked storage). */
export function defaultSaveStore(missionCount: number): SaveStore | null {
  const s = browserStorage();
  return s ? new SaveStore(s, missionCount) : null;
}

export function defaultCampaignStore(): SaveStore | null {
  const s = browserStorage();
  return s ? new SaveStore(s, CAMPAIGN_LENGTH, 'campaign') : null;
}

export function defaultLastMode(): LastMode | null {
  const s = browserStorage();
  return s ? new LastMode(s) : null;
}
