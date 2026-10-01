import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev, inBounds, tileAt, unitAt } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handleDoor(
  s: GameState,
  cmd: Extract<Command, { type: 'OpenDoor' | 'CloseDoor' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (!inBounds(s, cmd.at)) return 'That tile is off the map';
  if (chebyshev(unit.pos, cmd.at) > 1) return 'The door is not adjacent';
  const tile = tileAt(s, cmd.at);
  if (tile.kind !== 'door') return 'That is not a door';
  const opening = cmd.type === 'OpenDoor';
  if (tile.open === opening) return opening ? 'The door is already open' : 'The door is already closed';
  if (!opening && unitAt(s, cmd.at)) return 'Something is in the doorway';
  if (unit.ap < CONFIG.doorCost) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.doorCost;
  tile.open = opening;
  events.push({ type: 'doorChanged', at: { ...cmd.at }, open: opening });
  return null;
}
