import { CONFIG, NOT_ENOUGH_AP, WEAPONS } from '../config';
import type { Command, GameEvent, GameState, Unit } from '../types';

/** Swaps in a spare clip: the magazine is full again. */
export function handleReload(
  _s: GameState,
  _cmd: Extract<Command, { type: 'Reload' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const magazine = WEAPONS[unit.weapon].magazine;
  if (unit.clips < 1) return 'No spare clips';
  if (unit.ammo >= magazine) return 'Magazine is already full';
  if (unit.ap < CONFIG.reloadAp) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.reloadAp;
  unit.ammo = magazine;
  unit.clips -= 1;
  events.push({ type: 'reloaded', unitId: unit.id, ammo: unit.ammo, at: { ...unit.pos } });
  return null;
}
