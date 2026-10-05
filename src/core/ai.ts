import { applyCommand } from './apply';
import { CONFIG, WEAPONS } from './config';
import { distance, facingFromDelta, posEq, tileAt } from './geometry';
import { findPath } from './path';
import type { Command, GameEvent, GameState, Pos, Unit } from './types';
import { canSee, visibleToSide } from './vision';

const MAX_COMMANDS_PER_TURN = 500;

/**
 * The next command on the way to `goal`, or null. A hunting goal plans through closed doors: when the
 * next tile is one it returns OpenDoor (the enemy is adjacent to it), and a route that crosses a closed
 * door and is longer than the hunt radius gives no step, so enemies far from the squad stay put.
 */
function stepToward(s: GameState, unit: Unit, goal: Pos, hunting: boolean): Command | null {
  const path = findPath(s, unit.id, goal, { ignoreOccupantAtGoal: true, openDoors: hunting });
  if (!path || path.length === 0) return null;
  const next = path[0];
  if (hunting) {
    const closed = (p: Pos) => {
      const t = tileAt(s, p);
      return t.kind === 'door' && !t.open;
    };
    // too far to go through a door: take the door-free route instead (none means stay put)
    if (path.length > CONFIG.huntRadius && path.some(closed)) return stepToward(s, unit, goal, false);
    if (closed(next)) {
      return unit.ap >= CONFIG.doorCost ? { type: 'OpenDoor', unitId: unit.id, at: { ...next } } : null;
    }
  }
  return unit.ap >= CONFIG.moveCost ? { type: 'Move', unitId: unit.id, to: next } : null;
}

function candidates(s: GameState, unit: Unit): Command[] {
  const out: Command[] = [];
  if (unit.ammo < 1 && unit.clips > 0) out.push({ type: 'Reload', unitId: unit.id });
  const targets = s.units.filter(
    (u) => u.side === 'player' && u.alive && visibleToSide(s, 'enemy', u.pos),
  );

  if (targets.length > 0) {
    const target = targets.reduce((a, b) =>
      distance(unit.pos, a.pos) <= distance(unit.pos, b.pos) ? a : b,
    );
    const w = WEAPONS[unit.weapon];
    const d = distance(unit.pos, target.pos);
    const sees = canSee(s, unit, target.pos);
    if (sees && d <= w.range) {
      if (d > 2 && unit.ap >= w.aimedAp) {
        out.push({ type: 'AimedShot', unitId: unit.id, targetId: target.id });
      }
      out.push({ type: 'SnapShot', unitId: unit.id, targetId: target.id });
    }
    if (!sees) {
      out.push({
        type: 'Turn',
        unitId: unit.id,
        facing: facingFromDelta(target.pos.x - unit.pos.x, target.pos.y - unit.pos.y),
      });
    }
    const step = unit.ap >= CONFIG.doorCost ? stepToward(s, unit, target.pos, true) : null;
    if (step) out.push(step);
    return out;
  }

  const patrolGoal = unit.patrol.length > 0 ? unit.patrol[unit.patrolIndex] : null;
  const goals: [Pos | null, boolean][] = [[s.enemyMemory, true], [patrolGoal, false]];
  for (const [goal, hunting] of goals) {
    if (!goal || posEq(unit.pos, goal)) continue;
    // a patrol step needs a move; a hunting goal may only need to open a door
    if (unit.ap < (hunting ? CONFIG.doorCost : CONFIG.moveCost)) continue;
    const step = stepToward(s, unit, goal, hunting);
    if (step) {
      out.push(step);
      break;
    }
  }
  return out;
}

export function aiNextCommand(state: GameState): Command {
  for (const unit of state.units) {
    if (unit.side !== 'enemy' || !unit.alive) continue;
    for (const cmd of candidates(state, unit)) {
      if (applyCommand(state, cmd).ok) return cmd;
    }
  }
  return { type: 'EndTurn' };
}

export function runEnemyTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < MAX_COMMANDS_PER_TURN; i++) {
    const cmd = aiNextCommand(s);
    const r = applyCommand(s, cmd);
    if (!r.ok) break;
    s = r.state;
    events.push(...r.events);
    if (cmd.type === 'EndTurn' || s.status !== 'playing') break;
  }
  return { state: s, events };
}
