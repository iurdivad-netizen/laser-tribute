import { CONFIG, WEAPONS } from './config';
import { NEIGHBORS_4, distance, inBounds, tileAt } from './geometry';
import { nextRandom } from './rng';
import type { GameEvent, GameState, Pos, ShotMode, Unit } from './types';
import { canSee } from './vision';

export function isCovered(s: GameState, shooter: Pos, target: Pos): boolean {
  const here = tileAt(s, target);
  if (here.kind === 'door' && here.open) return true;
  const d0 = distance(shooter, target);
  return NEIGHBORS_4.some((o) => {
    const p = { x: target.x + o.x, y: target.y + o.y };
    return inBounds(s, p) && tileAt(s, p).kind === 'wall' && distance(shooter, p) < d0;
  });
}

export function hitChance(s: GameState, shooter: Unit, target: Unit, mode: ShotMode): number {
  const w = WEAPONS[shooter.weapon];
  const weaponAccuracy = mode === 'snap' ? w.snapAccuracy : w.aimedAccuracy;
  const base = Math.min(CONFIG.maxHitChance, weaponAccuracy + shooter.accuracy);
  const rangeFactor = 1 - 0.5 * (distance(shooter.pos, target.pos) / w.range);
  const cover = isCovered(s, shooter.pos, target.pos) ? CONFIG.coverMultiplier : 1;
  return base * rangeFactor * cover;
}

function missImpact(s: GameState, target: Pos): Pos {
  let ox = Math.floor(nextRandom(s) * 3) - 1;
  const oy = Math.floor(nextRandom(s) * 3) - 1;
  if (ox === 0 && oy === 0) ox = 1;
  return {
    x: Math.min(s.width - 1, Math.max(0, target.x + ox)),
    y: Math.min(s.height - 1, Math.max(0, target.y + oy)),
  };
}

export function fireShot(
  s: GameState,
  shooter: Unit,
  target: Unit,
  mode: ShotMode,
  events: GameEvent[],
): void {
  shooter.ammo -= 1;
  const hit = nextRandom(s) < hitChance(s, shooter, target, mode);
  let damage = 0;
  let impact: Pos = { ...target.pos };
  if (hit) {
    damage = WEAPONS[shooter.weapon].damage;
    target.hp = Math.max(0, target.hp - damage);
  } else {
    impact = missImpact(s, target.pos);
  }
  events.push({
    type: 'shot',
    unitId: shooter.id,
    targetId: target.id,
    mode,
    hit,
    damage,
    from: { ...shooter.pos },
    impact,
  });
  if (hit && target.hp <= 0) {
    target.alive = false;
    if (target.side !== shooter.side) shooter.kills += 1;
    events.push({ type: 'died', unitId: target.id, at: { ...target.pos } });
  }
}

/** Alerted units on the other side fire one snap shot at a mover they can see, once per turn per target. */
export function applyReactionFire(s: GameState, mover: Unit, events: GameEvent[]): void {
  for (const o of s.units) {
    if (!mover.alive) return;
    if (!o.alive || !o.alert || o.side === mover.side) continue;
    const w = WEAPONS[o.weapon];
    if (o.ap < w.snapAp) continue;
    if (o.ammo < 1) continue;
    if (distance(o.pos, mover.pos) > w.range) continue;
    if (!canSee(s, o, mover.pos)) continue;
    const key = `${o.id}>${mover.id}`;
    if (s.reacted.includes(key)) continue;
    s.reacted.push(key);
    o.ap -= w.snapAp;
    fireShot(s, o, mover, 'snap', events);
    if (o.ap < w.snapAp || o.ammo < 1) o.alert = false;
  }
}
