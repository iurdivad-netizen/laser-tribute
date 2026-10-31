import { hitChance, isCovered } from './combat';
import { WEAPONS } from './config';
import { NEIGHBORS_8, distance } from './geometry';
import { stepBlockedReason, stepCost } from './movement';
import type { Command, GameState, Pos, Unit } from './types';
import { canSee, visibleToSide } from './vision';

/** An enemy at or under this share of its health stops advancing and tries to get out of sight. */
export const RETREAT_SHARE = 0.4;

const weaponDamage = (u: Unit): number => WEAPONS[u.weapon].damage * (WEAPONS[u.weapon].burst ?? 1);

/** Can `unit` shoot `target` right now: it sees it, is in range and has the AP and a round. */
export function canShoot(s: GameState, unit: Unit, target: Unit): boolean {
  const w = WEAPONS[unit.weapon];
  return unit.ammo >= 1 && unit.ap >= w.snapAp && distance(unit.pos, target.pos) <= w.range && canSee(s, unit, target.pos);
}

/**
 * How much shooting `target` is worth to `unit`: anything it can shoot beats anything it cannot; among those, the
 * likelier the hit and the bigger the share of the target's remaining health it takes, the better (a hit that kills
 * counts in full). Targets it cannot shoot rank by distance, nearest first, so it still closes in on the closest.
 */
export function targetScore(s: GameState, unit: Unit, target: Unit): number {
  if (!canShoot(s, unit, target)) return -distance(unit.pos, target.pos);
  const share = Math.min(weaponDamage(unit), target.hp) / target.hp;
  return 1 + hitChance(s, unit, target, 'snap') * share;
}

/** The best of `targets` for `unit` (the first of equals), or undefined when there are none. */
export function pickTarget(s: GameState, unit: Unit, targets: Unit[]): Unit | undefined {
  let best: Unit | undefined;
  let bestScore = -Infinity;
  for (const t of targets) {
    const score = targetScore(s, unit, t);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export const isHurt = (u: Unit): boolean => u.hp <= u.maxHp * RETREAT_SHARE;

/** Is a legal, affordable step for `unit` from where it stands to `to`. */
function canStep(s: GameState, unit: Unit, to: Pos): boolean {
  return unit.ap >= stepCost(unit.pos, to) && stepBlockedReason(s, unit.pos, to) === null;
}

/** For a unit the squad can see: the cheapest step to a tile the squad cannot see, or null. */
export function retreatStep(s: GameState, unit: Unit): Command | null {
  if (!visibleToSide(s, 'player', unit.pos)) return null;
  let best: Pos | null = null;
  for (const o of NEIGHBORS_8) {
    const to = { x: unit.pos.x + o.x, y: unit.pos.y + o.y };
    if (!canStep(s, unit, to) || visibleToSide(s, 'player', to)) continue;
    if (!best || stepCost(unit.pos, to) < stepCost(unit.pos, best)) best = to;
  }
  return best ? { type: 'Move', unitId: unit.id, to: best } : null;
}

/**
 * While closing in on `goal` (a soldier it can see), a step into cover from that soldier's fire instead of the
 * planned step into the open, when one gets it closer too. Null keeps the planned step. Getting strictly closer
 * each time means it can never walk in circles.
 */
export function coverStep(s: GameState, unit: Unit, goal: Pos, planned: Pos): Command | null {
  if (isCovered(s, goal, planned)) return null;
  const now = distance(unit.pos, goal);
  let best: Pos | null = null;
  for (const o of NEIGHBORS_8) {
    const to = { x: unit.pos.x + o.x, y: unit.pos.y + o.y };
    if (distance(to, goal) >= now || !canStep(s, unit, to) || !isCovered(s, goal, to)) continue;
    if (!best || distance(to, goal) < distance(best, goal)) best = to;
  }
  return best ? { type: 'Move', unitId: unit.id, to: best } : null;
}
