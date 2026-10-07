import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { canSee, hasLineOfSight, computeVisible } from '../src/core/vision';
import { corridorRows, makeState, ok, unit } from './helpers';

const smoke = (x: number, y = 1) => ({ pos: { x, y }, kind: 'smoke' as const, turnsLeft: 3 });
const fire = (x: number, y = 1, turnsLeft = 3) => ({ pos: { x, y }, kind: 'fire' as const, turnsLeft });
const endTurns = (s: ReturnType<typeof makeState>, n: number) => {
  let cur = s; const events = [];
  for (let i = 0; i < n; i++) { const r = ok(applyCommand(cur, { type: 'EndTurn' })); cur = r.state; events.push(...r.events); }
  return { s: cur, events };
};

describe('smoke and vision', () => {
  it('blocks line of sight through a smoke tile but not the tile the viewer or target stands on', () => {
    const s = makeState(corridorRows('P...E'));
    const p = unit(s, 'p1'); p.facing = 2;
    const e = unit(s, 'e1');
    expect(canSee(s, p, e.pos)).toBe(true);
    s.hazards.push(smoke(3));
    expect(canSee(s, p, e.pos)).toBe(false);
    expect(hasLineOfSight(s, p.pos, e.pos)).toBe(false);
    expect(hasLineOfSight(s, p.pos, e.pos, true)).toBe(true); // throws ignore smoke
  });

  it('hides a unit standing inside smoke from beyond one tile, but not from next to it', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1'); p.facing = 2;
    const e = unit(s, 'e1');
    s.hazards.push(smoke(e.pos.x));
    expect(canSee(s, p, e.pos)).toBe(false);
    p.pos = { x: e.pos.x - 1, y: 1 };
    expect(canSee(s, p, e.pos)).toBe(true);
  });

  it('a viewer inside smoke sees only adjacent tiles', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1'); p.facing = 2;
    s.hazards.push(smoke(p.pos.x));
    expect(canSee(s, p, unit(s, 'e1').pos)).toBe(false);
    expect(computeVisible(s, 'player')[1][p.pos.x + 1]).toBe(true);
  });

  it('does not stop movement', () => {
    const s = makeState(corridorRows('P.E'));
    s.hazards.push(smoke(2));
    ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
  });
});

describe('hazard lifetime and fire damage', () => {
  it('ticks down each time the player turn begins and is removed at 0', () => {
    const s = makeState(corridorRows('P...E'));
    s.hazards.push(smoke(3));
    let cur = endTurns(s, 2).s; // one full round
    expect(cur.hazards[0].turnsLeft).toBe(2);
    cur = endTurns(cur, 4).s;
    expect(cur.hazards).toHaveLength(0);
  });

  it('burns units standing in fire at the start of their own side turn, either side, armour applying', () => {
    const s = makeState(corridorRows('P...E'));
    const e = unit(s, 'e1');
    s.hazards.push(fire(e.pos.x));
    const afterPlayerEnds = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(unit(afterPlayerEnds.state, 'e1').hp).toBe(40 - 10);
    expect(afterPlayerEnds.events).toContainEqual({ type: 'burned', unitId: 'e1', damage: 10, at: e.pos });
    const p = unit(s, 'p1');
    const s2 = makeState(corridorRows('P...E'));
    s2.hazards.push(fire(p.pos.x));
    unit(s2, 'p1').gadget = 'armour';
    const round = endTurns(s2, 2);
    expect(unit(round.s, 'p1').hp).toBe(50 - 7); // 10 minus 30%
  });

  it('can kill, end the mission, and credit no kill', () => {
    const s = makeState(corridorRows('P...E'));
    const e = unit(s, 'e1'); e.hp = 5;
    s.hazards.push(fire(e.pos.x));
    const r = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(r.state.status).toBe('won');
    expect(r.events.some((x) => x.type === 'died' && x.unitId === 'e1')).toBe(true);
    expect(unit(r.state, 'p1').kills).toBe(0);
  });
});

describe('flash penalty', () => {
  it('cuts AP at the start of the unit own turn, never below 0, once', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'e1').apPenalty = 30;
    let cur = ok(applyCommand(s, { type: 'EndTurn' })).state;
    expect(unit(cur, 'e1').ap).toBe(30);
    expect(unit(cur, 'e1').apPenalty).toBe(0);
    cur = endTurns(cur, 2).s;
    expect(unit(cur, 'e1').ap).toBe(60);
    const big = makeState(corridorRows('P...E'));
    unit(big, 'e1').apPenalty = 200;
    expect(unit(ok(applyCommand(big, { type: 'EndTurn' })).state, 'e1').ap).toBe(0);
  });

  it('a flashed player soldier loses AP on the next player turn', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').apPenalty = 30;
    const cur = endTurns(s, 2).s;
    expect(unit(cur, 'p1').ap).toBe(30);
  });
});
