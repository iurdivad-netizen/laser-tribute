import { THROWABLES, NOT_ENOUGH_AP } from '../config';
import { damageTaken } from '../combat';
import { chebyshev, distance, inBounds, tileAt } from '../geometry';
import type { Command, GameEvent, GameState, Pos, Unit } from '../types';
import { hasLineOfSight } from '../vision';

export function handleThrow(s: GameState, cmd: Extract<Command, { type: 'Throw' }>, unit: Unit, events: GameEvent[]): string | null {
  const t = THROWABLES[unit.throwable];
  if (unit.grenades < 1) return 'No grenades left';
  if (unit.ap < t.apCost) return NOT_ENOUGH_AP;
  if (!inBounds(s, cmd.at)) return 'Target is off the map';
  if (distance(unit.pos, cmd.at) > t.range) return 'Out of range';
  if (tileAt(s, cmd.at).kind === 'wall') return 'Cannot throw at a wall';
  if (!hasLineOfSight(s, unit.pos, cmd.at, true)) return 'Path is blocked';

  unit.ap -= t.apCost;
  unit.grenades -= 1;

  const area: Pos[] = [];
  for (let dy = -t.radius; dy <= t.radius; dy++) {
    for (let dx = -t.radius; dx <= t.radius; dx++) {
      const p = { x: cmd.at.x + dx, y: cmd.at.y + dy };
      if (inBounds(s, p) && tileAt(s, p).kind !== 'wall') area.push(p);
    }
  }

  const hits: { unitId: string; damage: number }[] = [];
  const stunned: string[] = [];
  const died: Unit[] = [];
  for (const u of s.units) {
    if (!u.alive || chebyshev(u.pos, cmd.at) > t.radius) continue;
    if (!hasLineOfSight(s, cmd.at, u.pos, true)) continue;
    if (t.damage !== undefined) {
      const dealt = damageTaken(u, t.damage);
      u.hp = Math.max(0, u.hp - dealt);
      hits.push({ unitId: u.id, damage: dealt });
      if (u.hp <= 0) {
        u.alive = false;
        died.push(u);
        if (u.side !== unit.side) unit.kills += 1;
      }
    }
    if (t.apPenalty !== undefined) {
      u.apPenalty += t.apPenalty;
      stunned.push(u.id);
    }
  }

  const doorsDestroyed: Pos[] = [];
  if (t.breaksDoors) {
    for (const p of area) {
      const tile = tileAt(s, p);
      if (tile.kind === 'door') {
        tile.kind = 'floor';
        tile.open = false;
        doorsDestroyed.push(p);
      }
    }
  }

  const hazards: Pos[] = [];
  if (t.hazard) {
    for (const p of area) {
      const old = s.hazards.find((h) => h.kind === t.hazard!.kind && h.pos.x === p.x && h.pos.y === p.y);
      if (old) old.turnsLeft = t.hazard.turns;
      else s.hazards.push({ pos: { ...p }, kind: t.hazard.kind, turnsLeft: t.hazard.turns });
      hazards.push({ ...p });
    }
  }

  events.push({ type: 'grenade', unitId: unit.id, kind: unit.throwable, at: { ...cmd.at }, hits, doorsDestroyed, hazards, stunned });
  for (const u of died) events.push({ type: 'died', unitId: u.id, at: { ...u.pos } });
  return null;
}
