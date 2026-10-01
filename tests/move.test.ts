import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

const open = ['#######', '#P....#', '#....E#', '#######'];

describe('Move', () => {
  it('moves one tile, spends AP and faces the direction of travel', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(unit(r.state, 'p1').pos).toEqual({ x: 2, y: 1 });
    expect(unit(r.state, 'p1').ap).toBe(56);
    expect(unit(r.state, 'p1').facing).toBe(2);
    expect(r.events).toEqual([
      { type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ]);
  });

  it('charges more for a diagonal step', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }));
    expect(unit(r.state, 'p1').ap).toBe(54);
    expect(unit(r.state, 'p1').facing).toBe(3);
  });

  it('does not mutate the input state', () => {
    const s = makeState(open);
    applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } });
    expect(unit(s, 'p1').pos).toEqual({ x: 1, y: 1 });
    expect(unit(s, 'p1').ap).toBe(60);
  });

  it('rejects a move without enough AP and changes nothing', () => {
    const s = makeState(open);
    unit(s, 'p1').ap = 3;
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /action points/,
    );
  });

  it('rejects moving more than one tile at a time', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 3, y: 1 } }))).toMatch(
      /one tile/,
    );
  });

  it('rejects walking into a wall', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 0, y: 1 } }))).toMatch(
      /wall/,
    );
  });

  it('rejects walking through a closed door', () => {
    const s = makeState(corridorRows('P+..E'));
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /door/,
    );
  });

  it('rejects moving onto a tile occupied by another unit', () => {
    const s = makeState(corridorRows('PE..'));
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /occupied/,
    );
  });

  it('allows moving onto the tile of a dead unit', () => {
    const s = makeState(corridorRows('PE..'));
    unit(s, 'e1').alive = false;
    ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
  });

  it('rejects a diagonal step that cuts a wall corner', () => {
    const s = makeState(['####', '#P.#', '##.#', '####']);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }))).toMatch(
      /corner/,
    );
  });

  it('advances the patrol index on reaching the patrol point', () => {
    const s = makeState(corridorRows('P...E'));
    s.turn = 'enemy';
    const e = unit(s, 'e1');
    e.patrol = [{ x: 4, y: 1 }, { x: 5, y: 1 }];
    e.patrolIndex = 0;
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'e1', to: { x: 4, y: 1 } }));
    expect(unit(r.state, 'e1').patrolIndex).toBe(1);
  });
});

describe('command validation', () => {
  it('rejects an unknown unit', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'zz', to: { x: 2, y: 1 } }))).toMatch(
      /Unknown/,
    );
  });

  it('rejects a dead unit', () => {
    const s = makeState(open);
    unit(s, 'p1').alive = false;
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /dead/,
    );
  });

  it("rejects a command for the other side's unit", () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Turn', unitId: 'e1', facing: 0 }))).toMatch(/turn/);
  });

  it('rejects any command once the mission is over', () => {
    const s = makeState(open);
    s.status = 'won';
    expect(reason(applyCommand(s, { type: 'EndTurn' }))).toMatch(/over/);
  });
});

describe('Turn', () => {
  it('costs 1 AP per 45 degrees', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 2 }));
    expect(unit(r.state, 'p1').facing).toBe(2);
    expect(unit(r.state, 'p1').ap).toBe(58);
    expect(r.events).toEqual([{ type: 'turned', unitId: 'p1', facing: 2 }]);
  });

  it('takes the short way round', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 7 }));
    expect(unit(r.state, 'p1').ap).toBe(59);
  });

  it('rejects turning to the current facing', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 0 }))).toMatch(/already/i);
  });

  it('rejects a turn without enough AP', () => {
    const s = makeState(open);
    unit(s, 'p1').ap = 1;
    expect(reason(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 4 }))).toMatch(
      /action points/,
    );
  });
});

describe('EndTurn', () => {
  it('hands the turn over and refills the new side only', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'e1').ap = 5;
    unit(s, 'p1').ap = 7;
    const r1 = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(r1.state.turn).toBe('enemy');
    expect(unit(r1.state, 'e1').ap).toBe(60);
    expect(unit(r1.state, 'p1').ap).toBe(7);
    expect(r1.events).toEqual([{ type: 'turnEnded', side: 'player' }]);

    const r2 = ok(applyCommand(r1.state, { type: 'EndTurn' }));
    expect(r2.state.turn).toBe('player');
    expect(r2.state.turnNumber).toBe(2);
    expect(unit(r2.state, 'p1').ap).toBe(60);
  });
});

describe('game over', () => {
  it('declares a win when no enemy is left', () => {
    const s = makeState(corridorRows('P..')); // no enemies at all
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 2 }));
    expect(r.state.status).toBe('won');
    expect(r.events).toContainEqual({ type: 'gameOver', winner: 'player' });
  });

  it('declares a loss when no soldier is left', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').alive = false;
    s.turn = 'enemy';
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'e1', facing: 6 }));
    expect(r.state.status).toBe('lost');
    expect(r.events).toContainEqual({ type: 'gameOver', winner: 'enemy' });
  });
});
