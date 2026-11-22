import { applyCommand } from '../core/apply';
import { canShoot, pickTarget } from '../core/aiscore';
import { CONFIG, THROWABLES, WEAPONS } from '../core/config';
import { chebyshev, distance, tileAt } from '../core/geometry';
import { findPath } from '../core/path';
import type { Command, GameState, Pos, Unit } from '../core/types';
import { visibleToSide } from '../core/vision';

/**
 * A simple, repeatable stand-in for a player: it shoots what its squad can see, reloads, throws a frag at a distant
 * enemy that no friend stands near, and otherwise walks as a group toward the nearest enemy. It is deliberately not clever
 * (no cover play, no alert, no gadgets), so its win rate is a floor for a careful human, not an estimate of one.
 * To keep the group together a soldier does not walk on while it is more than `LEAD` tiles ahead of the squad's average.
 * The bot knows where the nearest enemy is (a human would have to scout); fighting still obeys the real sight rules.
 */
const LEAD = 2;
const MAX_COMMANDS = 400;

const live = (s: GameState, side: Unit['side']): Unit[] => s.units.filter((u) => u.side === side && u.alive);

/** The next command for `unit`, or null when it has nothing useful left to do this turn. */
export function botCommand(s: GameState, unit: Unit): Command | null {
  const w = WEAPONS[unit.weapon];
  if (unit.ammo < 1 && unit.clips > 0 && unit.ap >= CONFIG.reloadAp) return { type: 'Reload', unitId: unit.id };

  const seen = live(s, 'enemy').filter((e) => visibleToSide(s, 'player', e.pos));
  if (seen.length > 0) {
    const target = pickTarget(s, unit, seen)!;
    const d = distance(unit.pos, target.pos);
    const t = THROWABLES[unit.throwable];
    const friendNear = live(s, 'player').some((f) => f.id !== unit.id && chebyshev(f.pos, target.pos) <= t.radius + 1);
    if ('damage' in t && t.damage && unit.grenades > 0 && unit.ap >= t.apCost && d >= 4 && d <= t.range && !friendNear) {
      return { type: 'Throw', unitId: unit.id, at: { ...target.pos } };
    }
    if (canShoot(s, unit, target)) {
      if (d > 2 && unit.ap >= w.aimedAp) return { type: 'AimedShot', unitId: unit.id, targetId: target.id };
      return { type: 'SnapShot', unitId: unit.id, targetId: target.id };
    }
    if (d <= w.range) return null; // in range but short of AP or rounds: wait for next turn
  }

  const enemies = live(s, 'enemy');
  if (enemies.length === 0) return null;
  // the nearest enemy by walking distance (a straight line can run through walls the squad cannot cross)
  const route = (u: Unit): Pos[] | null => {
    let best: Pos[] | null = null;
    for (const e of enemies) {
      const p = findPath(s, u.id, e.pos, { ignoreOccupantAtGoal: true, openDoors: true });
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best;
  };
  const path = route(unit);
  if (!path || path.length === 0) return null;
  const squad = live(s, 'player');
  const lengths = squad.map((u) => (u.id === unit.id ? path.length : route(u)?.length ?? path.length));
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (seen.length === 0 && path.length < mean - LEAD) return null;
  const next = path[0];
  const tile = tileAt(s, next);
  if (tile.kind === 'door' && !tile.open) {
    return unit.ap >= CONFIG.doorCost ? { type: 'OpenDoor', unitId: unit.id, at: { ...next } } : null;
  }
  return unit.ap >= CONFIG.moveCost ? { type: 'Move', unitId: unit.id, to: next } : null;
}

/** Plays the whole player turn and ends it; returns the new state. */
export function botTurn(state: GameState): GameState {
  let s = state;
  const idle = new Set<string>();
  for (let i = 0; i < MAX_COMMANDS && s.status === 'playing'; i++) {
    let unit: Unit | undefined;
    let cmd: Command | null = null;
    for (const u of s.units) {
      if (u.side !== 'player' || !u.alive || idle.has(u.id)) continue;
      cmd = botCommand(s, u);
      if (cmd) {
        unit = u;
        break;
      }
    }
    if (!unit || !cmd) break;
    const r = applyCommand(s, cmd);
    if (r.ok) s = r.state;
    else idle.add(unit.id); // an illegal pick (blocked path, no line of fire) retires that soldier for the turn
  }
  if (s.status !== 'playing') return s;
  const end = applyCommand(s, { type: 'EndTurn' });
  return end.ok ? end.state : s;
}
