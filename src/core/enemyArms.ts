import { WEAPONS, unlockedWeapons } from './config';
import type { GameState } from './types';

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * Arms each enemy with a weapon from the ones unlocked at this level, older weapons more often, decided only
 * by the mission seed and the enemy's position in the list (the game's random stream is not used).
 */
export function assignEnemyWeapons(s: GameState, level: number): void {
  const pool = unlockedWeapons(level);
  const weights = pool.map((_, i) => pool.length - i);
  const total = weights.reduce((a, b) => a + b, 0);
  s.units.filter((u) => u.side === 'enemy').forEach((u, i) => {
    let pick = hash(s.rngState * 31 + i + 1) % total;
    let n = 0;
    while (pick >= weights[n]) pick -= weights[n++];
    u.weapon = pool[n];
    u.ammo = WEAPONS[u.weapon].magazine;
  });
}
