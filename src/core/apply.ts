import { handleEndTurn } from './actions/endTurn';
import { handleMove, handleTurn } from './actions/move';
import type { Command, GameEvent, GameState, Result, Unit } from './types';
import { updateEnemyMemory, updateExplored } from './vision';

type UnitCommand = Exclude<Command, { type: 'EndTurn' }>;

const fail = (reason: string): Result => ({ ok: false, reason });

export function applyCommand(state: GameState, cmd: Command): Result {
  if (state.status !== 'playing') return fail('The mission is over');
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  let error: string | null;

  if (cmd.type === 'EndTurn') {
    error = handleEndTurn(s, events);
  } else {
    const unit = s.units.find((u) => u.id === cmd.unitId);
    if (!unit) return fail('Unknown unit');
    if (!unit.alive) return fail('That unit is dead');
    if (unit.side !== s.turn) return fail("It is not that unit's turn");
    error = dispatch(s, cmd, unit, events);
  }

  if (error) return fail(error);
  checkGameOver(s, events);
  updateExplored(s);
  updateEnemyMemory(s);
  return { ok: true, state: s, events };
}

function dispatch(s: GameState, cmd: UnitCommand, unit: Unit, events: GameEvent[]): string | null {
  switch (cmd.type) {
    case 'Move':
      return handleMove(s, cmd, unit, events);
    case 'Turn':
      return handleTurn(s, cmd, unit, events);
    default:
      return 'Unsupported command';
  }
}

function checkGameOver(s: GameState, events: GameEvent[]): void {
  if (s.status !== 'playing') return;
  const enemiesAlive = s.units.some((u) => u.side === 'enemy' && u.alive);
  const playersAlive = s.units.some((u) => u.side === 'player' && u.alive);
  if (!enemiesAlive) {
    s.status = 'won';
    events.push({ type: 'gameOver', winner: 'player' });
  } else if (!playersAlive) {
    s.status = 'lost';
    events.push({ type: 'gameOver', winner: 'enemy' });
  }
}
