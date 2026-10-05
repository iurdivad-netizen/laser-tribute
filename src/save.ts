import { CAMPAIGN, type Campaign, type RosterSoldier } from './core/campaign';
import { GADGET_IDS } from './core/config';
import { defaultLoadout, type Loadout } from './core/loadout';
import type { Stash } from './core/stash';

export const SAVE_KEY = 'laser-tribute-save';
const SAVE_VERSION = 1;

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
  const { rifle, pistol, grenade, clip } = v;
  const optional = (n: unknown): number | null => (n === undefined ? 0 : isInt(n, 0, 99) ? n : null);
  const medkit = optional(v.medkit);
  const armour = optional(v.armour);
  const scanner = optional(v.scanner);
  if (!isInt(rifle, 0, 99) || !isInt(pistol, 0, 99) || !isInt(grenade, 0, 99) || !isInt(clip, 0, 99)) return null;
  if (medkit === null || armour === null || scanner === null) return null;
  return { rifle, pistol, grenade, clip, medkit, armour, scanner };
}

/** The saved loadout when it is well formed; the default one otherwise (the app then fits it to the budget). */
function loadout(v: unknown): Loadout {
  if (!Array.isArray(v) || v.length !== CAMPAIGN.rosterSize) return defaultLoadout();
  const out: Loadout = [];
  for (const s of v) {
    if (!isObj(s) || (s.weapon !== 'pistol' && s.weapon !== 'rifle')) return defaultLoadout();
    if (!isInt(s.grenades, 0, 3) || !isInt(s.clips, 1, 4)) return defaultLoadout();
    if (s.gadget !== undefined && !GADGET_IDS.includes(s.gadget as never)) return defaultLoadout();
    out.push({
      weapon: s.weapon, grenades: s.grenades, clips: s.clips,
      ...(s.gadget !== undefined ? { gadget: s.gadget as (typeof GADGET_IDS)[number] } : {}),
    });
  }
  return out;
}

/** The saved campaign and loadout, or null when the text is missing or not a valid save. */
export function parseSave(text: string | null, missionCount: number): Save | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.version !== SAVE_VERSION || !isObj(raw.campaign)) return null;
  const c = raw.campaign;
  if (c.status !== 'active') return null;
  if (!isInt(c.missionIndex, 0, missionCount - 1) || c.missionsWon !== c.missionIndex) return null;
  const roster = soldiers(c.roster, CAMPAIGN.rosterSize);
  const fallen = soldiers(c.fallen);
  const gear = stash(c.stash);
  if (!roster || !fallen || !gear) return null;
  if (!isInt(c.namesUsed, CAMPAIGN.rosterSize, 9999)) return null;
  const campaign: Campaign = {
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
  ) {}

  load(): Save | null {
    try {
      return parseSave(this.storage?.getItem(SAVE_KEY) ?? null, this.missionCount);
    } catch {
      return null;
    }
  }

  save(campaign: Campaign, loadout: Loadout): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, campaign, loadout }));
    } catch {
      // private mode or a full disk: carry on unsaved
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // nothing to do
    }
  }
}

/** A store over the browser's localStorage, or null where there is none (tests, blocked storage). */
export function defaultSaveStore(missionCount: number): SaveStore | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return new SaveStore(window.localStorage, missionCount);
  } catch {
    return null;
  }
}
