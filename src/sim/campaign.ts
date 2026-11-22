import { runEnemyTurn } from '../core/ai';
import { campaignBudget, levelOf, newCampaign, recordMission, type Campaign } from '../core/campaign';
import { unlockedWeapons } from '../core/config';
import { CAMPAIGN_LENGTH, drawVariations, generateMission } from '../core/gen';
import { defaultLoadout, fitLoadout, validateLoadout, type Loadout } from '../core/loadout';
import { createMission } from '../core/missions';
import type { Stash } from '../core/stash';
import type { GameState, WeaponId } from '../core/types';
import { botTurn } from './bot';

/** A mission that runs past this many turns counts as lost (the bot is stuck). */
export const TURN_LIMIT = 80;

export interface MissionRecord {
  mission: number;
  won: boolean;
  timedOut: boolean;
  casualties: number;
  enemies: number;
  turns: number;
  budget: number;
}

/** Spends the budget the way a sensible player would: a rifle each, spare clips, a frag each, a medkit or two, then heavier guns. */
export function chooseLoadout(budget: number, stash: Stash, level: number): Loadout {
  let l: Loadout = defaultLoadout().map((s) => ({ ...s, weapon: 'pistol' as WeaponId, grenades: 0 }));
  const ok = (x: Loadout) => validateLoadout(x, budget, stash, level) === null;
  const set = (i: number, patch: Partial<Loadout[number]>) => (x: Loadout) => x.map((s, j) => (j === i ? { ...s, ...patch } : s));
  const has = (w: WeaponId) => unlockedWeapons(level).includes(w) || stash[w] > 0;
  const steps: ((x: Loadout) => Loadout)[] = [];
  for (let i = 0; i < 4; i++) steps.push(set(i, { weapon: 'rifle' }));
  for (let i = 0; i < 4; i++) steps.push(set(i, { clips: 2 }));
  for (let i = 0; i < 4; i++) steps.push(set(i, { grenades: 1 }));
  steps.push(set(0, { gadget: 'medkit' }), set(1, { gadget: 'medkit' }));
  steps.push(set(0, { weapon: 'sniper' }), set(1, { weapon: 'sniper' }));
  for (let i = 0; i < 4; i++) steps.push(set(i, { clips: 3 }));
  for (let i = 0; i < 4; i++) steps.push(set(i, { grenades: 2 }));
  for (const step of steps) {
    const next = step(l);
    if (next.some((s) => !has(s.weapon))) continue;
    if (ok(next)) l = next;
  }
  return ok(l) ? l : fitLoadout(l, budget, stash, level);
}

export interface CampaignRun {
  records: MissionRecord[];
  status: Campaign['status'];
}

/** Plays a whole campaign with the bot: the seed picks the map variations and every mission's random stream. */
export function runCampaign(seed: number): CampaignRun {
  let c = newCampaign('campaign', drawVariations(seed));
  const records: MissionRecord[] = [];
  while (c.status === 'active') {
    const idx = c.missionIndex;
    const level = levelOf(c);
    const budget = campaignBudget(c);
    const loadout = chooseLoadout(budget, c.stash, level);
    const def = generateMission(idx, c.variations[idx]);
    let s: GameState = createMission(def, seed * 100 + idx, c.roster, loadout, budget, c.stash, level);
    const enemies = s.units.filter((u) => u.side === 'enemy').length;
    let timedOut = false;
    while (s.status === 'playing') {
      if (s.turnNumber > TURN_LIMIT) {
        timedOut = true;
        s = { ...s, status: 'lost' };
        break;
      }
      s = botTurn(s);
      if (s.status === 'playing' && s.turn === 'enemy') s = runEnemyTurn(s).state;
    }
    const casualties = s.units.filter((u) => u.side === 'player' && !u.alive).length;
    records.push({ mission: idx + 1, won: s.status === 'won', timedOut, casualties, enemies, turns: s.turnNumber, budget });
    c = recordMission(c, s, CAMPAIGN_LENGTH, loadout);
  }
  return { records, status: c.status };
}
