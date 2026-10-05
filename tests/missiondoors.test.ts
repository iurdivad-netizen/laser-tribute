import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { MISSIONS, createMission } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { ok, unit } from './helpers';

const SLOW = 30_000; // a whole enemy turn on a real map takes about a second

/** Warehouse at the start of the enemy turn, only `only` still alive, the squad last seen at (6, 7). */
function warehouseHunt(only: string): GameState {
  const start = createMission(MISSIONS[1], 1);
  const s = ok(applyCommand(start, { type: 'EndTurn' })).state;
  for (const u of s.units) if (u.side === 'enemy' && u.id !== only) u.alive = false;
  s.enemyMemory = { x: 6, y: 7 }; // the corridor below the first room
  return s;
}

describe('Warehouse: doors and the hunt radius', () => {
  it('an enemy 10 tiles from the sighting opens its room door and comes out', () => {
    const r = runEnemyTurn(warehouseHunt('e1')); // route from (12, 2) is 10 tiles
    expect(r.state.tiles[5][12].open).toBe(true);
    expect(unit(r.state, 'e1').pos.y).toBeGreaterThanOrEqual(5);
  }, SLOW);

  it('an enemy 20 tiles from the sighting stays in its room and patrols', () => {
    const r = runEnemyTurn(warehouseHunt('e2')); // route from (24, 2) is 20 tiles
    expect(r.events.some((e) => e.type === 'doorChanged')).toBe(false);
    expect(unit(r.state, 'e2').pos.y).toBeLessThanOrEqual(4);
  }, SLOW);

  it('with nothing known, no door opens on any mission', () => {
    for (const def of MISSIONS) {
      const start = createMission(def, 1);
      const enemyTurn = ok(applyCommand(start, { type: 'EndTurn' })).state;
      const r = runEnemyTurn(enemyTurn);
      expect(r.events.some((e) => e.type === 'doorChanged'), def.name).toBe(false);
    }
  }, SLOW);
});
