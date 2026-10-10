import { describe, expect, it } from 'vitest';
import { aiNextStep, runEnemyTurn } from '../src/core/ai';
import { applyCommand, applyStats } from '../src/core/apply';
import { corridorRows, makeState, ok, unit } from './helpers';

describe('an enemy action is applied once', () => {
  it('aiNextStep returns the command with the result of applying it, as one application', () => {
    const s = makeState(corridorRows('E......P'));
    s.turn = 'enemy';
    s.enemyMemory = { ...unit(s, 'p1').pos };
    const before = applyStats.calls;
    const step = aiNextStep(s);
    expect(applyStats.calls - before).toBe(1);
    expect(step.cmd.type).not.toBe('EndTurn');
    expect(step.result.ok).toBe(true);
    const again = applyCommand(s, step.cmd);
    expect(JSON.stringify(step.result)).toBe(JSON.stringify(again));
  });

  it('runEnemyTurn applies one command per action: the moves and the final end of turn', () => {
    const s = makeState(corridorRows('E' + '.'.repeat(30) + 'P'));
    s.turn = 'enemy';
    s.enemyMemory = { ...unit(s, 'p1').pos };
    const before = applyStats.calls;
    const r = runEnemyTurn(s);
    const moves = r.events.filter((e) => e.type === 'moved').length;
    expect(moves).toBeGreaterThan(5);
    expect(applyStats.calls - before).toBe(moves + 1);
  });
});

describe('the explored map is not recomputed for enemy actions that cannot change it', () => {
  const explored = () => applyStats.explored;

  it('skips it for an enemy move, turn and shot', () => {
    const s = makeState(corridorRows('P..E'));
    s.turn = 'enemy';
    unit(s, 'e1').facing = 6;
    const before = explored();
    ok(applyCommand(s, { type: 'Move', unitId: 'e1', to: { x: 3, y: 1 } }));
    ok(applyCommand(s, { type: 'Turn', unitId: 'e1', facing: 4 }));
    ok(applyCommand(s, { type: 'SnapShot', unitId: 'e1', targetId: 'p1' }));
    expect(explored() - before).toBe(0);
  });

  it('keeps it for an enemy opening a door, a player action, and the end of the enemy turn', () => {
    const s = makeState(['#####', '#P+E#', '#####']);
    s.turn = 'enemy';
    let before = explored();
    const opened = ok(applyCommand(s, { type: 'OpenDoor', unitId: 'e1', at: { x: 2, y: 1 } }));
    expect(explored() - before).toBe(1);
    before = explored();
    ok(applyCommand(opened.state, { type: 'EndTurn' }));
    expect(explored() - before).toBe(1);
    const mine = makeState(corridorRows('P..E'));
    before = explored();
    ok(applyCommand(mine, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(explored() - before).toBe(1);
  });

  it('still reveals what an enemy door opening shows to the squad', () => {
    const s = makeState(['#######', '#P+...#', '#..#E.#', '#######']);
    s.turn = 'enemy';
    s.units.find((u) => u.id === 'p1')!.facing = 2;
    const e = unit(s, 'e1');
    e.pos = { x: 1, y: 2 };
    const r = ok(applyCommand(s, { type: 'OpenDoor', unitId: 'e1', at: { x: 2, y: 1 } }));
    expect(r.state.explored[1][3]).toBe(true);
  });
});
