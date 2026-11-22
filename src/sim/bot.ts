import { applyCommand } from '../core/apply';
import { canShoot, pickTarget } from '../core/aiscore';
import { CONFIG, GADGETS, THROWABLES, WEAPONS } from '../core/config';
import { chebyshev, distance, inBounds, tileAt } from '../core/geometry';
import { findPath } from '../core/path';
import type { Command, GameState, Pos, Unit } from '../core/types';
import { visibleToSide } from '../core/vision';

/**
 * Two stand-ins for a player, both repeatable.
 *
 * `basic` shoots what its squad can see, reloads, throws a frag at a distant enemy that no friend stands near, and
 * otherwise walks as a group toward the enemy nearest by walking distance. It knows where every enemy is.
 *
 * `careful` plays the way a cautious human would: it knows only what the squad has seen (it walks to the nearest edge of the
 * explored map until an enemy shows up), it stops its advance with enough AP left to fire, then goes on alert so the
 * squad shoots whatever steps into view, it uses a medkit on a badly hurt comrade next to it, and it holds position
 * while a comrade already has an enemy in range rather than wandering into the fight one by one.
 *
 * Neither uses cover, smoke, flashbangs or scanners. To keep the group together a soldier does not walk on while it is
 * more than `LEAD` tiles ahead of the squad's average distance to the goal.
 */
export type BotMode = 'basic' | 'careful';

const LEAD = 2;
const MAX_COMMANDS = 400;
const HURT_SHARE = 0.5;

const live = (s: GameState, side: Unit['side']): Unit[] => s.units.filter((u) => u.side === side && u.alive);

/** The nearest explored walkable tile with an unexplored neighbour, found by walking outward from `from`; null when the whole map is known. */
export function nearestFrontier(s: GameState, from: Pos): Pos | null {
  const seen = new Set<number>();
  const key = (p: Pos) => p.y * s.width + p.x;
  const queue: Pos[] = [from];
  seen.add(key(from));
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = { x: p.x + dx, y: p.y + dy };
        if (!inBounds(s, n) || seen.has(key(n))) continue;
        seen.add(key(n));
        if (!s.explored[n.y][n.x]) {
          if (p.x !== from.x || p.y !== from.y) return p; // p borders the unknown (standing on such a tile is no reason to stay)
          continue;
        }
        if (tileAt(s, n).kind === 'wall') continue;
        queue.push(n);
      }
    }
  }
  return null;
}

/** Where the squad is heading this turn: the nearest enemy it can see or has scanned, else the nearest edge of the explored map. */
function squadGoal(s: GameState, mode: BotMode): Pos | null {
  const squad = live(s, 'player');
  if (squad.length === 0) return null;
  const centre = squad[0].pos;
  const enemies = live(s, 'enemy');
  if (mode === 'basic') {
    return enemies.length ? enemies.reduce((a, b) => (distance(centre, a.pos) <= distance(centre, b.pos) ? a : b)).pos : null;
  }
  const known = [
    ...enemies.filter((e) => visibleToSide(s, 'player', e.pos)).map((e) => e.pos),
    ...s.scanned,
  ];
  if (known.length) return known.reduce((a, b) => (distance(centre, a) <= distance(centre, b) ? a : b));
  const edge = nearestFrontier(s, centre);
  if (edge) return edge;
  return enemies.length ? enemies[0].pos : null; // nothing left to explore: fall back to the nearest enemy
}

/** The next command for `unit`, or null when it has nothing useful left to do this turn. */
export function botCommand(s: GameState, unit: Unit, mode: BotMode = 'basic', goal: Pos | null = null, relaxed = false): Command | null {
  const w = WEAPONS[unit.weapon];
  if (unit.alert) return null; // on overwatch: leave the rest of the AP for reaction fire
  if (unit.ammo < 1 && unit.clips > 0 && unit.ap >= CONFIG.reloadAp) return { type: 'Reload', unitId: unit.id };

  const squad = live(s, 'player');
  const seen = live(s, 'enemy').filter((e) => visibleToSide(s, 'player', e.pos));

  if (mode === 'careful' && unit.gadget === 'medkit' && unit.ap >= GADGETS.medkit.apCost) {
    const patient = squad
      .filter((f) => chebyshev(f.pos, unit.pos) <= 1 && f.hp <= f.maxHp * HURT_SHARE)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (patient) return { type: 'Heal', unitId: unit.id, targetId: patient.id };
  }

  if (seen.length > 0) {
    const target = pickTarget(s, unit, seen)!;
    const d = distance(unit.pos, target.pos);
    const t = THROWABLES[unit.throwable];
    const friendNear = squad.some((f) => f.id !== unit.id && chebyshev(f.pos, target.pos) <= t.radius + 1);
    if ('damage' in t && t.damage && unit.grenades > 0 && unit.ap >= t.apCost && d >= 4 && d <= t.range && !friendNear) {
      return { type: 'Throw', unitId: unit.id, at: { ...target.pos } };
    }
    if (canShoot(s, unit, target)) {
      if (d > 2 && unit.ap >= w.aimedAp) return { type: 'AimedShot', unitId: unit.id, targetId: target.id };
      return { type: 'SnapShot', unitId: unit.id, targetId: target.id };
    }
    if (d <= w.range) return null; // in range but short of AP or rounds: wait for next turn
    // careful: a comrade is already shooting, so hold instead of walking into the fight alone
    if (mode === 'careful' && squad.some((f) => f.id !== unit.id && f.ap > 0 && seen.some((e) => distance(f.pos, e.pos) <= WEAPONS[f.weapon].range))) return null;
  }

  if (!goal) return null;
  // the squad advances as one: skip the step when this soldier is already well ahead of the others
  const mean = squad.reduce((sum, u) => sum + distance(u.pos, goal), 0) / squad.length;
  if (seen.length === 0 && !relaxed && distance(unit.pos, goal) < mean - LEAD) return mode === 'careful' ? overwatch(unit) : null;

  const path = findPath(s, unit.id, goal, { ignoreOccupantAtGoal: true, openDoors: true });
  if (!path || path.length === 0) return mode === 'careful' ? overwatch(unit) : null;
  const next = path[0];
  const tile = tileAt(s, next);
  const cost = tile.kind === 'door' && !tile.open ? CONFIG.doorCost : CONFIG.moveCost;
  // careful keeps enough AP to fire a snap shot, so the soldier can end the turn on alert
  const reserve = mode === 'careful' ? w.snapAp : 0;
  if (unit.ap - cost < reserve) return mode === 'careful' ? overwatch(unit) : null;
  if (tile.kind === 'door' && !tile.open) return { type: 'OpenDoor', unitId: unit.id, at: { ...next } };
  return { type: 'Move', unitId: unit.id, to: next };
}

const overwatch = (unit: Unit): Command | null =>
  unit.ammo >= 1 && unit.ap >= WEAPONS[unit.weapon].snapAp ? { type: 'Alert', unitId: unit.id, on: true } : null;

/** Plays the whole player turn and ends it; returns the new state. */
export function botTurn(state: GameState, mode: BotMode = 'basic'): GameState {
  let s = state;
  const idle = new Set<string>();
  let goal = squadGoal(s, mode);
  let relaxed = false; // set when keeping the squad together would leave everybody standing still (a soldier in a doorway blocks the rest)
  let moved = false;
  for (let i = 0; i < MAX_COMMANDS && s.status === 'playing'; i++) {
    // overwatch is the last thing a soldier does, so every other soldier gets his chance to act first
    let pick: { unit: Unit; cmd: Command } | undefined;
    let watch: { unit: Unit; cmd: Command } | undefined;
    for (const u of s.units) {
      if (u.side !== 'player' || !u.alive || idle.has(u.id)) continue;
      const cmd = botCommand(s, u, mode, goal, relaxed);
      if (!cmd) continue;
      if (cmd.type === 'Alert') watch ??= { unit: u, cmd };
      else {
        pick = { unit: u, cmd };
        break;
      }
    }
    if (!pick && !moved && !relaxed) {
      relaxed = true; // nobody can move: let the front soldiers go on regardless of the others
      continue;
    }
    const chosen = pick ?? watch;
    if (!chosen) break;
    const r = applyCommand(s, chosen.cmd);
    if (r.ok) {
      s = r.state;
      if (chosen.cmd.type === 'Move' || chosen.cmd.type === 'OpenDoor') {
        moved = true;
        goal = squadGoal(s, mode); // the picture changed (an enemy came into view, or the map opened up): re-aim the squad
      }
    } else idle.add(chosen.unit.id); // an illegal pick (blocked path, no line of fire) retires that soldier for the turn
  }
  if (s.status !== 'playing') return s;
  const end = applyCommand(s, { type: 'EndTurn' });
  return end.ok ? end.state : s;
}
