import type { GameState } from './types';

export interface MissionResult {
  won: boolean;
  survivors: number;
  squadSize: number;
  enemiesKilled: number;
  enemyCount: number;
  turns: number;
}

export function summarize(state: GameState): MissionResult {
  const players = state.units.filter((u) => u.side === 'player');
  const enemies = state.units.filter((u) => u.side === 'enemy');
  return {
    won: state.status === 'won',
    survivors: players.filter((u) => u.alive).length,
    squadSize: players.length,
    enemiesKilled: enemies.filter((u) => !u.alive).length,
    enemyCount: enemies.length,
    turns: state.turnNumber,
  };
}
