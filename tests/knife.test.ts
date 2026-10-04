import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { stabChance } from '../src/core/actions/stab';
import { applyRank } from '../src/core/ranks';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const stab = (unitId = 'p1', targetId = 'e1') => ({ type: 'Stab' as const, unitId, targetId });

/** P and E side by side: P at x=1, E at x=2. */
const adjacent = () => makeState(corridorRows('PE'));

describe('stabChance', () => {
  it('is 90% for a Rookie and adds rank accuracy, capped at 95%', () => {
    const s = adjacent();
    const p = unit(s, 'p1');
    expect(stabChance(p)).toBeCloseTo(0.9, 5);
    applyRank(p, 2); // +0.04
    expect(stabChance(p)).toBeCloseTo(0.94, 5);
    applyRank(p, 9); // +0.12 would be 1.02
    expect(stabChance(p)).toBe(0.95);
  });
});

describe('Stab command', () => {
  it('kills an adjacent enemy on a hit, spends 20 AP and credits the kill', () => {
    const s = adjacent();
    s.rngState = seedForRoll((n) => n < 0.9);
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').ap).toBe(40);
    expect(unit(r.state, 'p1').kills).toBe(1);
    expect(r.events).toContainEqual({
      type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60,
      from: { x: 1, y: 1 }, at: { x: 2, y: 1 },
    });
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 2, y: 1 } });
  });

  it('can miss: spends the AP, no damage, no kill', () => {
    const s = adjacent();
    s.rngState = seedForRoll((n) => n >= 0.95);
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'e1')).toMatchObject({ alive: true, hp: 40 });
    expect(unit(r.state, 'p1')).toMatchObject({ ap: 40, kills: 0 });
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'stab', hit: false, damage: 0 }));
    expect(r.events.some((e) => e.type === 'died')).toBe(false);
  });

  it('works on a diagonal neighbour', () => {
    const s = makeState(['####', '#P.#', '#.E#', '####']);
    s.rngState = seedForRoll((n) => n < 0.9);
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'e1').alive).toBe(false);
  });

  it('rejects a target two tiles away and spends nothing', () => {
    const s = makeState(corridorRows('P.E'));
    const res = applyCommand(s, stab());
    expect(reason(res)).toBe('Stab needs an adjacent enemy');
    expect(unit(s, 'p1').ap).toBe(60);
  });

  it('rejects your own side, a dead target and an unknown target', () => {
    const s = makeState(corridorRows('PP.E'));
    expect(reason(applyCommand(s, stab('p1', 'p2')))).toBe('Cannot stab your own side');
    expect(reason(applyCommand(s, stab('p1', 'nobody')))).toBe('No such target');
    const t = adjacent();
    unit(t, 'e1').alive = false;
    expect(reason(applyCommand(t, stab()))).toBe('No such target');
  });

  it('needs 20 AP', () => {
    const s = adjacent();
    unit(s, 'p1').ap = 19;
    expect(reason(applyCommand(s, stab()))).toBe('Not enough action points');
    unit(s, 'p1').ap = 20;
    s.rngState = seedForRoll((n) => n < 0.9);
    expect(ok(applyCommand(s, stab())).state.units.find((u) => u.id === 'p1')!.ap).toBe(0);
  });

  it('ends the soldier alert like any other action', () => {
    const s = adjacent();
    unit(s, 'p1').alert = true;
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'p1').alert).toBe(false);
  });

  it('a rank bonus raises the chance: a roll of 0.93 misses a Rookie but hits a Private', () => {
    const roll = seedForRoll((n) => n >= 0.9 && n < 0.94);
    const rookie = adjacent();
    rookie.rngState = roll;
    expect(unit(ok(applyCommand(rookie, stab())).state, 'e1').alive).toBe(true);
    const pvt = adjacent();
    pvt.rngState = roll;
    applyRank(unit(pvt, 'p1'), 2);
    expect(unit(ok(applyCommand(pvt, stab())).state, 'e1').alive).toBe(false);
  });

  it('wins the mission when the last enemy dies', () => {
    const s = adjacent();
    s.rngState = seedForRoll((n) => n < 0.9);
    const r = ok(applyCommand(s, stab()));
    expect(r.state.status).toBe('won');
  });
});
