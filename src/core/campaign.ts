import type { Loadout } from './loadout';
import { addStash, capStash, lootFrom } from './loot';
import { emptyStash, nextStash, type Stash } from './stash';
import type { GameState } from './types';

export const CAMPAIGN = { baseBudget: 120, winBonus: 20, killBonus: 5, rosterSize: 4 } as const;

export const SOLDIER_NAMES = [
  'Alvarez', 'Brandt', 'Chen', 'Dubois', 'Eriksen', 'Fontaine',
  'Garcia', 'Haddad', 'Ivanov', 'Jensen', 'Kowalski', 'Lindqvist',
];

export interface RosterSoldier {
  name: string;
  kills: number;
}

export interface Campaign {
  missionIndex: number;
  missionsWon: number;
  roster: RosterSoldier[];
  fallen: RosterSoldier[];
  namesUsed: number;
  status: 'active' | 'won' | 'lost';
  /** Found gear that is free on the next equipment screens. */
  stash: Stash;
}

export function soldierName(index: number): string {
  const base = SOLDIER_NAMES[index % SOLDIER_NAMES.length];
  const round = Math.floor(index / SOLDIER_NAMES.length);
  return round === 0 ? base : `${base} ${round + 1}`;
}

export function newCampaign(): Campaign {
  return {
    missionIndex: 0,
    missionsWon: 0,
    roster: Array.from({ length: CAMPAIGN.rosterSize }, (_, i) => ({ name: soldierName(i), kills: 0 })),
    fallen: [],
    namesUsed: CAMPAIGN.rosterSize,
    status: 'active',
    stash: emptyStash(),
  };
}

/** Kills by the soldiers still in the roster (fallen soldiers' kills do not count). */
export function totalKills(c: Campaign): number {
  return c.roster.reduce((sum, r) => sum + r.kills, 0);
}

export function campaignBudget(c: Campaign): number {
  return CAMPAIGN.baseBudget + CAMPAIGN.winBonus * c.missionsWon + CAMPAIGN.killBonus * totalKills(c);
}

export function budgetBreakdown(c: Campaign): string {
  return (
    `Base ${CAMPAIGN.baseBudget} + wins ${CAMPAIGN.winBonus * c.missionsWon}` +
    ` + kills ${CAMPAIGN.killBonus * totalKills(c)}`
  );
}

/**
 * Folds a finished mission into the campaign. Pure: returns a new Campaign.
 * While the campaign stays active a dead soldier is replaced by a rookie; once it is over the
 * roster holds only the survivors (no rookie who never fought).
 */
export function recordMission(
  c: Campaign, finished: GameState, missionCount: number, used?: Loadout,
): Campaign {
  if (finished.status === 'playing') throw new Error('The mission is not finished');
  const won = finished.status === 'won';
  const missionsWon = c.missionsWon + (won ? 1 : 0);
  const missionIndex = won ? c.missionIndex + 1 : c.missionIndex;
  const status = !won ? 'lost' : missionIndex >= missionCount ? 'won' : 'active';

  const players = finished.units.filter((u) => u.side === 'player');
  const roster: RosterSoldier[] = [];
  const fallen = c.fallen.map((f) => ({ ...f }));
  let namesUsed = c.namesUsed;

  c.roster.forEach((soldier, i) => {
    const unit = players[i];
    if (!unit) {
      roster.push({ ...soldier });
      return;
    }
    const updated = { name: soldier.name, kills: soldier.kills + unit.kills };
    if (unit.alive) {
      roster.push(updated);
    } else {
      fallen.push(updated);
      if (status === 'active') {
        roster.push({ name: soldierName(namesUsed), kills: 0 });
        namesUsed += 1;
      }
    }
  });

  // A lost mission (or an unknown kit) leaves the stash as it was.
  const stash = won && used ? capStash(addStash(nextStash(c.stash, used, finished), lootFrom(finished))) : { ...c.stash };

  return { missionIndex, missionsWon, roster, fallen, namesUsed, status, stash };
}
