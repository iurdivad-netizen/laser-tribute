import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev, facingFromDelta, posEq, turnSteps } from '../geometry';
import { stepBlockedReason, stepCost } from '../movement';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handleMove(
  s: GameState,
  cmd: Extract<Command, { type: 'Move' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const from = { ...unit.pos };
  const to = cmd.to;
  if (chebyshev(from, to) !== 1) return 'Move one tile at a time';
  const blocked = stepBlockedReason(s, from, to);
  if (blocked) return blocked;
  const cost = stepCost(from, to);
  if (unit.ap < cost) return NOT_ENOUGH_AP;

  unit.ap -= cost;
  unit.pos = { ...to };
  unit.facing = facingFromDelta(to.x - from.x, to.y - from.y);
  events.push({ type: 'moved', unitId: unit.id, from, to: { ...to } });

  if (unit.patrol.length > 0 && posEq(unit.pos, unit.patrol[unit.patrolIndex])) {
    unit.patrolIndex = (unit.patrolIndex + 1) % unit.patrol.length;
  }
  return null;
}

export function handleTurn(
  _s: GameState,
  cmd: Extract<Command, { type: 'Turn' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const steps = turnSteps(unit.facing, cmd.facing);
  if (steps === 0) return 'Already facing that way';
  const cost = steps * CONFIG.turnCostPer45;
  if (unit.ap < cost) return NOT_ENOUGH_AP;
  unit.ap -= cost;
  unit.facing = cmd.facing;
  events.push({ type: 'turned', unitId: unit.id, facing: cmd.facing });
  return null;
}
