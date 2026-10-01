import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { createMission1 } from '../src/core/mission1';
import { pathStats } from '../src/core/path';
import { corridorRows, makeState, ok, unit } from './helpers';

function enemyTurn(rows: string[]) {
  const s = makeState(rows);
  s.turn = 'enemy';
  return s;
}

describe('aiNextCommand', () => {
  it('takes an aimed shot at a visible soldier when it has the AP', () => {
    const s = enemyTurn(corridorRows('E...P'));
    unit(s, 'e1').facing = 2;
    expect(aiNextCommand(s)).toEqual({ type: 'AimedShot', unitId: 'e1', targetId: 'p1' });
  });

  it('falls back to a snap shot when AP is short', () => {
    const s = enemyTurn(corridorRows('E...P'));
    unit(s, 'e1').facing = 2;
    unit(s, 'e1').ap = 20;
    expect(aiNextCommand(s)).toEqual({ type: 'SnapShot', unitId: 'e1', targetId: 'p1' });
  });

  it('turns toward a soldier that a teammate can see', () => {
    const s = enemyTurn(corridorRows('EE..P'));
    unit(s, 'e1').facing = 6;
    unit(s, 'e2').facing = 2;
    expect(aiNextCommand(s)).toEqual({ type: 'Turn', unitId: 'e1', facing: 2 });
  });

  it('advances toward the last seen position', () => {
    const s = enemyTurn(['#########', '#E....#P#', '#########']);
    s.enemyMemory = { x: 4, y: 1 };
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('patrols when nothing is known', () => {
    const s = enemyTurn(['#########', '#E....#P#', '#########']);
    unit(s, 'e1').patrol = [{ x: 4, y: 1 }, { x: 1, y: 1 }];
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('falls back to patrol when the last seen position is unreachable', () => {
    const s = enemyTurn(corridorRows('E...+.P')); // closed door between e1 and the memory
    s.enemyMemory = { x: 6, y: 1 };
    unit(s, 'e1').patrol = [{ x: 3, y: 1 }, { x: 1, y: 1 }];
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('does not pathfind for enemies that cannot afford a step', () => {
    const s = enemyTurn(['##########', '#E..E..#P#', '##########']);
    for (const id of ['e1', 'e2']) {
      unit(s, id).ap = 2; // less than the cheapest move (4)
      unit(s, id).patrol = [{ x: 6, y: 1 }, { x: 1, y: 1 }];
    }
    pathStats.calls = 0;
    expect(aiNextCommand(s)).toEqual({ type: 'EndTurn' });
    expect(pathStats.calls).toBe(0);
  });

  it('still pathfinds for enemies that can afford a step', () => {
    const s = enemyTurn(['##########', '#E..E..#P#', '##########']);
    unit(s, 'e1').patrol = [{ x: 3, y: 1 }, { x: 1, y: 1 }]; // stops short of e2
    pathStats.calls = 0;
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
    expect(pathStats.calls).toBeGreaterThan(0);
  });

  it('ends the turn when nothing is possible', () => {
    const s = enemyTurn(['#####', '#E#P#', '#####']);
    expect(aiNextCommand(s)).toEqual({ type: 'EndTurn' });
  });

  it('returns only commands that apply cleanly', () => {
    const s = enemyTurn(corridorRows('E...P'));
    unit(s, 'e1').facing = 2;
    ok(applyCommand(s, aiNextCommand(s)));
  });
});

describe('runEnemyTurn', () => {
  it('hands the turn back even when an enemy is walled in', () => {
    const s = enemyTurn(['#####', '#E#P#', '#####']);
    const r = runEnemyTurn(s);
    expect(r.state.turn).toBe('player');
  });

  it('finishes a full turn on Mission 1', () => {
    const s = createMission1();
    const ended = ok(applyCommand(s, { type: 'EndTurn' })).state;
    expect(ended.turn).toBe('enemy');
    const r = runEnemyTurn(ended);
    expect(r.state.turn).toBe('player');
    expect(r.events.length).toBeGreaterThan(0);
  });
});
