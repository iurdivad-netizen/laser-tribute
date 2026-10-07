import { CONFIG, NOT_ENOUGH_AP, WEAPONS } from '../config';
import { posEq } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handlePickUp(
  s: GameState,
  cmd: Extract<Command, { type: 'PickUp' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const item = s.items.find((i) => i.id === cmd.itemId);
  if (!item) return 'No such item';
  if (!posEq(item.pos, unit.pos)) return 'The item is not here';
  if (item.kind === unit.weapon) return `Already carrying a ${WEAPONS[unit.weapon].name}`;
  if (unit.ap < CONFIG.pickupCost) return NOT_ENOUGH_AP;
  if (item.kind === 'grenade' && unit.grenades > 0 && unit.throwable !== 'frag') return 'Carrying another throwable';

  unit.ap -= CONFIG.pickupCost;
  const picked = item.kind;
  if (item.kind === 'grenade') {
    unit.throwable = 'frag';
    unit.grenades += 1;
    s.items = s.items.filter((i) => i !== item);
  } else {
    const old = unit.weapon;
    const droppedAmmo = unit.ammo;
    unit.weapon = item.kind;
    unit.ammo = item.ammo ?? WEAPONS[unit.weapon].magazine;
    item.kind = old;
    item.ammo = droppedAmmo; // the weapon left behind keeps its rounds, so swapping cannot create ammo
  }
  events.push({ type: 'pickedUp', unitId: unit.id, itemId: item.id, kind: picked });
  return null;
}
