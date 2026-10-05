import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { damageTaken } from '../combat';
import { chebyshev } from '../geometry';
import { nextRandom } from '../rng';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function stabChance(u: Unit): number {
  return Math.min(CONFIG.maxHitChance, CONFIG.knife.accuracy + u.accuracy);
}

/** Every soldier carries a knife: an adjacent living enemy can be stabbed for very high damage. */
export function handleStab(
  s: GameState,
  cmd: Extract<Command, { type: 'Stab' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const target = s.units.find((u) => u.id === cmd.targetId);
  if (!target || !target.alive) return 'No such target';
  if (target.side === unit.side) return 'Cannot stab your own side';
  if (chebyshev(unit.pos, target.pos) !== 1) return 'Stab needs an adjacent enemy';
  if (unit.ap < CONFIG.knife.apCost) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.knife.apCost;
  const hit = nextRandom(s) < stabChance(unit);
  const damage = hit ? damageTaken(target, CONFIG.knife.damage) : 0;
  if (hit) target.hp = Math.max(0, target.hp - damage);
  events.push({
    type: 'stab',
    unitId: unit.id,
    targetId: target.id,
    hit,
    damage,
    from: { ...unit.pos },
    at: { ...target.pos },
  });
  if (hit && target.hp <= 0) {
    target.alive = false;
    unit.kills += 1;
    events.push({ type: 'died', unitId: target.id, at: { ...target.pos } });
  }
  return null;
}
