import { CONFIG } from './config';
import type { Unit } from './types';

export interface Rank {
  name: string;
  short: string;
  minKills: number;
  /** Bonuses over a Rookie. */
  hp: number;
  ap: number;
  accuracy: number;
}

export const RANKS: readonly Rank[] = [
  { name: 'Rookie', short: 'Rke', minKills: 0, hp: 0, ap: 0, accuracy: 0 },
  { name: 'Private', short: 'Pvt', minKills: 2, hp: 10, ap: 4, accuracy: 0.04 },
  { name: 'Sergeant', short: 'Sgt', minKills: 5, hp: 20, ap: 8, accuracy: 0.08 },
  { name: 'Captain', short: 'Cpt', minKills: 9, hp: 30, ap: 12, accuracy: 0.12 },
];

/** The highest rank whose kill threshold is met. */
export function rankFor(kills: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) if (kills >= r.minKills) rank = r;
  return rank;
}

export function rankShort(rankName: string): string {
  return RANKS.find((r) => r.name === rankName)?.short ?? '';
}

/** Gives a soldier the stats of the rank earned by `kills`, at full health and AP. */
export function applyRank(u: Unit, kills: number): void {
  const r = rankFor(kills);
  u.rank = r.name;
  u.maxHp = CONFIG.soldierHp + r.hp;
  u.hp = u.maxHp;
  u.maxAp = CONFIG.maxAp + r.ap;
  u.ap = u.maxAp;
  u.accuracy = r.accuracy;
}
