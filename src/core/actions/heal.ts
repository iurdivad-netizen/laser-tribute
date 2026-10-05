import { GADGETS, NOT_ENOUGH_AP } from '../config';
import { chebyshev } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

/** A medkit heals the medic or an adjacent teammate by 25 HP (never above max) and is used up. */
export function handleHeal(
  s: GameState,
  cmd: Extract<Command, { type: 'Heal' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (unit.gadget !== 'medkit') return 'No medkit';
  const target = s.units.find((u) => u.id === cmd.targetId);
  if (!target || !target.alive) return 'No such target';
  if (target.side !== unit.side) return 'Can only heal your own side';
  if (chebyshev(unit.pos, target.pos) > 1) return 'The target is too far away';
  if (target.hp >= target.maxHp) return 'Already at full health';
  if (unit.ap < GADGETS.medkit.apCost) return NOT_ENOUGH_AP;

  unit.ap -= GADGETS.medkit.apCost;
  unit.gadget = null;
  const amount = Math.min(GADGETS.medkit.heal, target.maxHp - target.hp);
  target.hp += amount;
  events.push({ type: 'healed', unitId: unit.id, targetId: target.id, amount, at: { ...target.pos } });
  return null;
}
