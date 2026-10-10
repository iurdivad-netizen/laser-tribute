import { handleAlert } from './actions/alert';
import { handleDoor } from './actions/door';
import { handleEndTurn } from './actions/endTurn';
import { handleHeal } from './actions/heal';
import { handlePickUp } from './actions/item';
import { handleMove, handleTurn } from './actions/move';
import { handleReload } from './actions/reload';
import { handleScan } from './actions/scan';
import { handleShot } from './actions/shoot';
import { handleStab } from './actions/stab';
import { handleThrow } from './actions/throw';
import type { Command, GameEvent, GameState, Result, Unit } from './types';
import { updateEnemyMemory, updateExplored } from './vision';

type UnitCommand = Exclude<Command, { type: 'EndTurn' }>;

const fail = (reason: string): Result => ({ ok: false, reason });

/** Counts applications and explored-map recomputations; lets tests check that the AI does neither more often than it must. */
export const applyStats = { calls: 0, explored: 0 };

/** Enemy actions that cannot show the squad anything new: no tile, door or hazard changes and the squad does not move. */
const NO_NEW_SIGHT = new Set<Command['type']>(['Move', 'Turn', 'SnapShot', 'AimedShot', 'Stab', 'Reload', 'Alert']);

export function applyCommand(state: GameState, cmd: Command): Result {
  if (state.status !== 'playing') return fail('The mission is over');
  applyStats.calls += 1;
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
    // Spending AP on anything but going on alert ends the soldier's own alert.
    if (!error && cmd.type !== 'Alert') unit.alert = false;
  }

  if (error) return fail(error);
  checkGameOver(s, events);
  if (!(state.turn === 'enemy' && NO_NEW_SIGHT.has(cmd.type))) {
    applyStats.explored += 1;
    updateExplored(s);
  }
  updateEnemyMemory(s);
  return { ok: true, state: s, events };
}

function dispatch(s: GameState, cmd: UnitCommand, unit: Unit, events: GameEvent[]): string | null {
  switch (cmd.type) {
    case 'Move':
      return handleMove(s, cmd, unit, events);
    case 'Turn':
      return handleTurn(s, cmd, unit, events);
    case 'OpenDoor':
    case 'CloseDoor':
      return handleDoor(s, cmd, unit, events);
    case 'PickUp':
      return handlePickUp(s, cmd, unit, events);
    case 'SnapShot':
    case 'AimedShot':
      return handleShot(s, cmd, unit, events);
    case 'Stab':
      return handleStab(s, cmd, unit, events);
    case 'Reload':
      return handleReload(s, cmd, unit, events);
    case 'Throw':
      return handleThrow(s, cmd, unit, events);
    case 'Alert':
      return handleAlert(s, cmd, unit, events);
    case 'Heal':
      return handleHeal(s, cmd, unit, events);
    case 'Scan':
      return handleScan(s, cmd, unit, events);
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
