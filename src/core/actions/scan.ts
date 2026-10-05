import { GADGETS, NOT_ENOUGH_AP } from '../config';
import { chebyshev } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

/** A scanner marks every living enemy within 8 tiles (walls do not matter) until the turn ends, and is used up. */
export function handleScan(
  s: GameState,
  _cmd: Extract<Command, { type: 'Scan' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (unit.gadget !== 'scanner') return 'No scanner';
  if (unit.ap < GADGETS.scanner.apCost) return NOT_ENOUGH_AP;

  unit.ap -= GADGETS.scanner.apCost;
  unit.gadget = null;
  const found = s.units
    .filter((u) => u.alive && u.side !== unit.side && chebyshev(unit.pos, u.pos) <= GADGETS.scanner.radius)
    .map((u) => ({ ...u.pos }));
  s.scanned = found;
  events.push({ type: 'scanned', unitId: unit.id, found: found.map((p) => ({ ...p })) });
  return null;
}
