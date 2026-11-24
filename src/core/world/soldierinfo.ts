import { CONFIG } from '../config';
import { RANKS, rankFor } from '../ranks';
import { BASE_RULES, levelsOf } from './base';
import type { PoolSoldier, World } from './world';

export interface SoldierStats {
  name: string;
  rank: string;
  hp: number;
  ap: number;
  /** The rank's accuracy bonus, in percent. */
  accuracy: number;
  /** The card's rows as label and value, in display order. */
  rows: [label: string, value: string][];
  note: string;
}

/**
 * What a soldier in the barracks is worth, from the same rank table a mission uses: kills and training points together
 * decide the rank, and the rank decides HP, action points and accuracy. Weapon and kit are chosen before each fight.
 */
export function soldierStats(s: PoolSoldier, w: World): SoldierStats {
  const points = s.kills + s.trained;
  const rank = rankFor(points);
  const next = RANKS.find((r) => r.minKills > points);
  const accuracy = Math.round(rank.accuracy * 100);
  const hp = CONFIG.soldierHp + rank.hp;
  const ap = CONFIG.maxAp + rank.ap;
  const rows: [string, string][] = [
    ['RANK', rank.name.toUpperCase()],
    ['HP', String(hp)],
    ['AP', String(ap)],
    ['ACCURACY', `+${accuracy}%`],
    ['KILLS', String(s.kills)],
    ['TRAINED', String(s.trained)],
    ['NEXT RANK', next ? `${next.name.toUpperCase()} IN ${next.minKills - points}` : 'TOP RANK'],
    ['STATUS', s.status === 'ready' ? 'READY' : `${s.status.toUpperCase()} ${s.daysLeft}D`],
  ];
  const level = levelsOf(w.research.done).training;
  if (level >= 1) {
    const cap = BASE_RULES.trainCaps[level - 1];
    rows.push(['TRAIN CAP', points >= cap ? 'AT CAP' : String(cap)]);
  }
  return { name: s.name, rank: rank.name.toUpperCase(), hp, ap, accuracy, rows, note: 'KIT IS CHOSEN BEFORE EACH FIGHT' };
}
