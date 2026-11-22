import { ROLES, WEAPONS, unlockedWeapons } from './config';
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

/**
 * Gives some enemies a role from the level on (officers from mission 3, rushers from 4, snipers from 6), chosen by the
 * same seed-and-position hash as the weapons so a mission always has the same cast. Always leaves at least one plain
 * rifleman. A sniper is handed the sniper rifle and a rusher the SMG when their weapons are unlocked.
 */
export function assignEnemyRoles(s: GameState, level: number): void {
  const enemies = s.units.filter((u) => u.side === 'enemy');
  const n = enemies.length;
  const order = enemies
    .map((u, i) => ({ u, k: hash(s.rngState * 17 + i * 7 + 3) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.u);
  const officers = level >= ROLES.officerFrom && n >= 5 ? (n >= 10 ? 2 : 1) : 0;
  const snipers = level >= ROLES.sniperFrom ? (level >= 9 ? 2 : 1) : 0;
  const rushers = level >= ROLES.rusherFrom ? Math.floor(n / 4) : 0;
  const wanted: ('officer' | 'sniper' | 'rusher')[] = [
    ...Array<'officer'>(officers).fill('officer'),
    ...Array<'sniper'>(snipers).fill('sniper'),
    ...Array<'rusher'>(rushers).fill('rusher'),
  ].slice(0, Math.max(0, n - 1));
  wanted.forEach((role, i) => {
    const u = order[i];
    u.role = role;
    const weapon = role === 'sniper' ? 'sniper' : role === 'rusher' && unlockedWeapons(level).includes('smg') ? 'smg' : null;
    if (weapon && unlockedWeapons(level).includes(weapon)) {
      u.weapon = weapon;
      u.ammo = WEAPONS[weapon].magazine;
    }
  });
}
