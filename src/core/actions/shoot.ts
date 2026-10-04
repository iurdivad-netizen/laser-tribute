import { NOT_ENOUGH_AP, WEAPONS } from '../config';
import { fireShot } from '../combat';
import { distance } from '../geometry';
import type { Command, GameEvent, GameState, ShotMode, Unit } from '../types';
import { canSee } from '../vision';

export function handleShot(
  s: GameState,
  cmd: Extract<Command, { type: 'SnapShot' | 'AimedShot' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const mode: ShotMode = cmd.type === 'SnapShot' ? 'snap' : 'aimed';
  const target = s.units.find((u) => u.id === cmd.targetId);
  if (!target || !target.alive) return 'No such target';
  if (target.side === unit.side) return 'Cannot shoot your own side';
  if (unit.ammo < 1) return 'Out of ammo';
  const w = WEAPONS[unit.weapon];
  const cost = mode === 'snap' ? w.snapAp : w.aimedAp;
  if (unit.ap < cost) return NOT_ENOUGH_AP;
  if (distance(unit.pos, target.pos) > w.range) return 'Target is out of range';
  if (!canSee(s, unit, target.pos)) return 'Target is not visible';

  unit.ap -= cost;
  fireShot(s, unit, target, mode, events);
  return null;
}
