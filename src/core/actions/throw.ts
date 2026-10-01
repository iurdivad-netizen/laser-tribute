import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev, distance, inBounds, tileAt } from '../geometry';
import type { Command, GameEvent, GameState, Pos, Unit } from '../types';
import { hasLineOfSight } from '../vision';

export function handleThrow(
  s: GameState,
  cmd: Extract<Command, { type: 'Throw' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const g = CONFIG.grenade;
  if (unit.grenades < 1) return 'No grenades left';
  if (unit.ap < g.apCost) return NOT_ENOUGH_AP;
  if (!inBounds(s, cmd.at)) return 'Target is off the map';
  if (distance(unit.pos, cmd.at) > g.range) return 'Out of range';
  if (tileAt(s, cmd.at).kind === 'wall') return 'Cannot throw at a wall';
  if (!hasLineOfSight(s, unit.pos, cmd.at)) return 'Path is blocked';

  unit.ap -= g.apCost;
  unit.grenades -= 1;

  const hits: { unitId: string; damage: number }[] = [];
  const died: Unit[] = [];
  for (const u of s.units) {
    if (!u.alive) continue;
    if (chebyshev(u.pos, cmd.at) > g.radius) continue;
    if (!hasLineOfSight(s, cmd.at, u.pos)) continue;
    u.hp = Math.max(0, u.hp - g.damage);
    hits.push({ unitId: u.id, damage: g.damage });
    if (u.hp <= 0) {
      u.alive = false;
      died.push(u);
    }
  }

  const doorsDestroyed: Pos[] = [];
  for (let dy = -g.radius; dy <= g.radius; dy++) {
    for (let dx = -g.radius; dx <= g.radius; dx++) {
      const p = { x: cmd.at.x + dx, y: cmd.at.y + dy };
      if (!inBounds(s, p)) continue;
      const tile = tileAt(s, p);
      if (tile.kind === 'door') {
        tile.kind = 'floor';
        tile.open = false;
        doorsDestroyed.push(p);
      }
    }
  }

  events.push({ type: 'grenade', unitId: unit.id, at: { ...cmd.at }, hits, doorsDestroyed });
  for (const u of died) events.push({ type: 'died', unitId: u.id, at: { ...u.pos } });
  return null;
}
