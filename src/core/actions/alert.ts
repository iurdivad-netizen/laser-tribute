import { NOT_ENOUGH_AP, WEAPONS } from '../config';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handleAlert(
  _s: GameState,
  cmd: Extract<Command, { type: 'Alert' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (cmd.on) {
    if (unit.alert) return 'Already on alert';
    if (unit.ap < WEAPONS[unit.weapon].snapAp) return NOT_ENOUGH_AP;
  } else if (!unit.alert) {
    return 'Not on alert';
  }
  unit.alert = cmd.on;
  events.push({ type: 'alert', unitId: unit.id, on: cmd.on });
  return null;
}
