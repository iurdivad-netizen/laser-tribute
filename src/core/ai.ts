import { applyCommand } from './apply';
import { CONFIG, WEAPONS } from './config';
import { distance, facingFromDelta, posEq } from './geometry';
import { findPath } from './path';
import type { Command, GameEvent, GameState, Pos, Unit } from './types';
import { canSee, visibleToSide } from './vision';

const MAX_COMMANDS_PER_TURN = 500;

function firstStep(s: GameState, unit: Unit, goal: Pos): Pos | null {
  const path = findPath(s, unit.id, goal, { ignoreOccupantAtGoal: true });
  return path && path.length > 0 ? path[0] : null;
}

function candidates(s: GameState, unit: Unit): Command[] {
  const out: Command[] = [];
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
    const step = unit.ap >= CONFIG.moveCost ? firstStep(s, unit, target.pos) : null;
    if (step) out.push({ type: 'Move', unitId: unit.id, to: step });
    return out;
  }

  if (unit.ap < CONFIG.moveCost) return out; // a patrol or search step would be rejected anyway

  const patrolGoal = unit.patrol.length > 0 ? unit.patrol[unit.patrolIndex] : null;
  for (const goal of [s.enemyMemory, patrolGoal]) {
    if (!goal || posEq(unit.pos, goal)) continue;
    const step = firstStep(s, unit, goal);
    if (step) {
      out.push({ type: 'Move', unitId: unit.id, to: step });
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
