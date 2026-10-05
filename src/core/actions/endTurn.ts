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
      u.ap = u.maxAp;
      u.alert = false;
    }
  }
  return null;
}
