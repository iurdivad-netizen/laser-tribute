import { HAZARD } from '../config';
import { damageTaken } from '../combat';
import type { GameEvent, GameState, Side } from '../types';

export function handleEndTurn(s: GameState, events: GameEvent[]): string | null {
  const next: Side = s.turn === 'player' ? 'enemy' : 'player';
  events.push({ type: 'turnEnded', side: s.turn });
  s.turn = next;
  if (next === 'player') s.turnNumber += 1;
  s.reacted = [];
  s.scanned = [];
  for (const u of s.units) {
    if (u.alive && u.side === next) {
      u.ap = Math.max(0, u.maxAp - u.apPenalty);
      u.apPenalty = 0;
      u.alert = false;
    }
  }
  // fire burns whoever stands in it at the start of their own side's turn, then the player turn ticks every hazard down
  for (const u of s.units) {
    if (!u.alive || u.side !== next) continue;
    if (!s.hazards.some((h) => h.kind === 'fire' && h.pos.x === u.pos.x && h.pos.y === u.pos.y)) continue;
    const damage = damageTaken(u, HAZARD.fireDamage);
    u.hp = Math.max(0, u.hp - damage);
    events.push({ type: 'burned', unitId: u.id, damage, at: { ...u.pos } });
    if (u.hp <= 0) {
      u.alive = false;
      events.push({ type: 'died', unitId: u.id, at: { ...u.pos } });
    }
  }
  if (next === 'player') {
    for (const h of s.hazards) h.turnsLeft -= 1;
    s.hazards = s.hazards.filter((h) => h.turnsLeft > 0);
  }
  return null;
}
