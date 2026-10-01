import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);
const MISS = () => seedForRoll((n) => n >= 0.96);

describe('kill crediting', () => {
  it('credits the shooter for a kill', () => {
    const s = makeState(corridorRows('P...E'));
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').hp = 20;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(1);
  });

  it('credits nothing for a hit that does not kill', () => {
    const s = makeState(corridorRows('P...E'));
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'p1').kills).toBe(0);
  });

  it('credits nothing for a miss', () => {
    const s = makeState(corridorRows('P...E'));
    s.rngState = MISS();
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').hp = 1;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'p1').kills).toBe(0);
  });

  it('credits the thrower for every enemy the blast kills', () => {
    const s = makeState(corridorRows('P.....EE')); // e1 at x=7, e2 at x=8
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 7, y: 1 } }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'e2').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(2);
  });

  it('does not credit killing his own side', () => {
    const s = makeState(corridorRows('P.PE..')); // p2 at x=3, e1 at x=4
    unit(s, 'p2').hp = 10;
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }));
    expect(unit(r.state, 'p2').alive).toBe(false);
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(1); // only the enemy counts
  });

  it('credits an alert reaction kill to the reacting soldier', () => {
    const s = makeState(corridorRows('P....E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alert = true;
    unit(s, 'e1').hp = 10;
    s.turn = 'enemy';
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'e1', to: { x: 5, y: 1 } }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(1);
  });
});
