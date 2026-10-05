import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { CONFIG } from '../src/core/config';
import { corridorRows, makeState, ok, unit } from './helpers';

function enemyTurn(rows: string[]) {
  const s = makeState(rows);
  s.turn = 'enemy';
  return s;
}

describe('enemies hunting through doors', () => {
  it('walks to the door, opens it for 2 AP, then goes through', () => {
    const s = enemyTurn(corridorRows('E...+' + '.'.repeat(11) + 'P')); // door at x5; P out of sight range
    s.enemyMemory = { x: 6, y: 1 };
    let state = s;
    for (let i = 0; i < 3; i++) {
      const cmd = aiNextCommand(state);
      expect(cmd).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2 + i, y: 1 } });
      state = ok(applyCommand(state, cmd)).state;
    }
    const before = unit(state, 'e1').ap;
    const open = aiNextCommand(state);
    expect(open).toEqual({ type: 'OpenDoor', unitId: 'e1', at: { x: 5, y: 1 } });
    const r = ok(applyCommand(state, open));
    expect(r.events).toContainEqual({ type: 'doorChanged', at: { x: 5, y: 1 }, open: true });
    expect(unit(r.state, 'e1').ap).toBe(before - CONFIG.doorCost);
    expect(aiNextCommand(r.state)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 5, y: 1 } });
  });

  it('hunts a route of exactly 12 tiles through a door, but not one of 13', () => {
    const near = enemyTurn(corridorRows('E.....+......P')); // P at x13: 12 steps
    near.enemyMemory = { x: 13, y: 1 };
    expect(aiNextCommand(near)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
    const far = enemyTurn(corridorRows('E.....+.......P')); // P at x14: 13 steps
    far.enemyMemory = { x: 14, y: 1 };
    expect(aiNextCommand(far)).toEqual({ type: 'EndTurn' });
  });

  it('is not limited on a route with no closed door', () => {
    const s = enemyTurn(corridorRows('E' + '.'.repeat(17) + 'P'));
    s.enemyMemory = { x: 18, y: 1 };
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('walks through a door that is already open, with no limit', () => {
    const s = enemyTurn(corridorRows('E' + '.'.repeat(5) + '+' + '.'.repeat(9) + 'P'));
    s.tiles[1][7].open = true;
    s.enemyMemory = { x: 16, y: 1 };
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('a patrolling enemy with no memory never opens a door', () => {
    const s = enemyTurn(corridorRows('E...+.P'));
    unit(s, 'e1').patrol = [{ x: 6, y: 1 }, { x: 1, y: 1 }];
    expect(aiNextCommand(s)).toEqual({ type: 'EndTurn' });
    expect(runEnemyTurn(s).events.some((e) => e.type === 'doorChanged')).toBe(false);
  });

  it('with 2 AP next to the door it can open it; with 1 AP it ends the turn', () => {
    const rows = corridorRows('E+..P');
    const two = enemyTurn(rows);
    two.enemyMemory = { x: 4, y: 1 };
    unit(two, 'e1').ap = 2;
    expect(aiNextCommand(two)).toEqual({ type: 'OpenDoor', unitId: 'e1', at: { x: 2, y: 1 } });
    const one = enemyTurn(rows);
    one.enemyMemory = { x: 4, y: 1 };
    unit(one, 'e1').ap = 1;
    expect(aiNextCommand(one)).toEqual({ type: 'EndTurn' });
  });

  it('with 3 AP next to the door it opens it but cannot step yet', () => {
    const s = enemyTurn(corridorRows('E+..P'));
    s.enemyMemory = { x: 4, y: 1 };
    unit(s, 'e1').ap = 3;
    const after = ok(applyCommand(s, aiNextCommand(s))).state;
    expect(unit(after, 'e1').ap).toBe(1);
    expect(aiNextCommand(after)).toEqual({ type: 'EndTurn' });
  });

  it('a unit in the doorway: no open command for the enemy behind it', () => {
    const s = enemyTurn(corridorRows('E+..P'));
    s.units.push({ ...unit(s, 'e1'), id: 'e2', pos: { x: 2, y: 1 } });
    s.enemyMemory = { x: 4, y: 1 };
    const cmd = aiNextCommand(s); // e1 is first in unit order, but its route is blocked
    expect(cmd.type).not.toBe('OpenDoor');
    expect(() => runEnemyTurn(s)).not.toThrow();
  });

  it('never closes a door', () => {
    const s = enemyTurn(corridorRows('E...+.P'));
    s.tiles[1][5].open = true;
    s.enemyMemory = { x: 6, y: 1 };
    const events = runEnemyTurn(s).events;
    expect(events.filter((e) => e.type === 'doorChanged')).toEqual([]);
  });

  it('a whole enemy turn: the enemy opens the door and ends up on the far side', () => {
    const s = enemyTurn(corridorRows('E...+' + '.'.repeat(11) + 'P')); // P out of sight range
    s.enemyMemory = { x: 6, y: 1 };
    const r = runEnemyTurn(s);
    expect(r.events.filter((e) => e.type === 'doorChanged')).toHaveLength(1);
    expect(unit(r.state, 'e1').pos.x).toBeGreaterThanOrEqual(5);
  });

  it('opening the door gives sight, and the enemy shoots the soldier it can now see', () => {
    const s = enemyTurn(corridorRows('E...+.P'));
    s.enemyMemory = { x: 6, y: 1 };
    unit(s, 'e1').pos = { x: 4, y: 1 };
    const opened = ok(applyCommand(s, aiNextCommand(s))).state;
    expect(aiNextCommand(opened)).toMatchObject({ type: 'AimedShot', targetId: 'p1' });
  });
});
