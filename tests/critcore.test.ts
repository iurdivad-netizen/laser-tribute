import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { critChance, hitChance } from '../src/core/combat';
import { ATTACHMENTS, ATTACHMENT_IDS, CRIT } from '../src/core/config';
import { nextCrit, nextRandom } from '../src/core/rng';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, ok, seedForCrit, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);

/** P and E two tiles apart with a tough enemy so damage is readable. */
function duel() {
  const s = makeState(corridorRows('P.E'));
  unit(s, 'p1').facing = 2;
  const e = unit(s, 'e1');
  e.hp = e.maxHp = 100;
  s.rngState = HIT();
  return s;
}

const snap = { type: 'SnapShot' as const, unitId: 'p1', targetId: 'e1' };
const aimed = { type: 'AimedShot' as const, unitId: 'p1', targetId: 'e1' };

describe('crit data and stream', () => {
  it('has the agreed numbers', () => {
    expect(CRIT).toEqual({ snap: 0.08, aimed: 0.15, multiplier: 1.5 });
    expect([...ATTACHMENT_IDS]).toEqual(['scope']);
    expect(ATTACHMENTS.scope).toMatchObject({ price: 18, accuracy: 0.1, crit: 0.1 });
  });

  it('every unit starts without an attachment', () => {
    expect(makeState(corridorRows('P.E')).units.every((u) => u.attachment === null)).toBe(true);
  });

  it('nextCrit is deterministic and independent of the hit stream', () => {
    const a = { rngState: 5, critState: 9 } as GameState;
    const b = { rngState: 5, critState: 9 } as GameState;
    expect(nextCrit(a)).toBe(nextCrit(b));
    const before = a.rngState;
    nextCrit(a);
    expect(a.rngState).toBe(before);
    const critBefore = a.critState;
    nextRandom(a);
    expect(a.critState).toBe(critBefore);
  });
});

describe('critChance and hitChance', () => {
  it('is 8% snap, 15% aimed, and 10 points more with a scope', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    expect(critChance(p, 'snap')).toBeCloseTo(0.08, 5);
    expect(critChance(p, 'aimed')).toBeCloseTo(0.15, 5);
    p.attachment = 'scope';
    expect(critChance(p, 'snap')).toBeCloseTo(0.18, 5);
    expect(critChance(p, 'aimed')).toBeCloseTo(0.25, 5);
  });

  it('a scope adds 10 points of base accuracy, scaled by distance, and respects the 95% cap', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(6) + 'E')); // distance 7, rifle range 14
    const p = unit(s, 'p1');
    const e = unit(s, 'e1');
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo(0.375, 4);
    p.attachment = 'scope';
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo(0.6 * 0.75, 4);
    p.accuracy = 0.5; // 1.0 already over the cap
    const capped = hitChance(s, p, e, 'snap');
    p.attachment = null;
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo(capped, 6);
  });
});

describe('critical shots', () => {
  it('a hit with a low crit draw does 1.5x damage and reports crit', () => {
    const s = duel();
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, snap));
    expect(unit(r.state, 'e1').hp).toBe(100 - 45);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: true, crit: true, damage: 45 }));
  });

  it('a pistol crit does 27', () => {
    const s = duel();
    unit(s, 'p1').weapon = 'pistol';
    s.critState = seedForCrit((n) => n < 0.01);
    expect(unit(ok(applyCommand(s, snap)).state, 'e1').hp).toBe(100 - 27);
  });

  it('a hit with a high crit draw is a normal hit', () => {
    const s = duel();
    s.critState = seedForCrit((n) => n >= 0.5);
    const r = ok(applyCommand(s, snap));
    expect(unit(r.state, 'e1').hp).toBe(70);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', crit: false, damage: 30 }));
  });

  it('aimed shots crit more often than snap shots', () => {
    const draw = seedForCrit((n) => n >= 0.08 && n < 0.15);
    const a = duel();
    a.critState = draw;
    expect(ok(applyCommand(a, snap)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: false }));
    const b = duel();
    b.critState = draw;
    expect(ok(applyCommand(b, aimed)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: true }));
  });

  it('a scope turns a 0.12 draw into a snap-shot crit', () => {
    const draw = seedForCrit((n) => n >= 0.08 && n < 0.18);
    const plain = duel();
    plain.critState = draw;
    expect(ok(applyCommand(plain, snap)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: false }));
    const scoped = duel();
    unit(scoped, 'p1').attachment = 'scope';
    scoped.critState = draw;
    expect(ok(applyCommand(scoped, snap)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: true }));
  });

  it('armour reduces a critical hit', () => {
    const s = duel();
    unit(s, 'e1').gadget = 'armour';
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, snap));
    expect(unit(r.state, 'e1').hp).toBe(100 - 32); // 45 - floor(13.5) = 32
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', crit: true, damage: 32 }));
  });

  it('a miss never crits and leaves the crit stream alone', () => {
    const s = duel();
    s.rngState = seedForRoll((n) => n >= 0.96);
    s.critState = seedForCrit((n) => n < 0.01);
    const before = s.critState;
    const r = ok(applyCommand(s, snap));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: false, crit: false, damage: 0 }));
    expect(r.state.critState).toBe(before);
  });

  it('a critical kill credits the kill, and the sequence is deterministic', () => {
    const run = () => {
      const s = duel();
      unit(s, 'e1').hp = unit(s, 'e1').maxHp = 40;
      s.critState = seedForCrit((n) => n < 0.01);
      return ok(applyCommand(s, snap));
    };
    const a = run();
    const b = run();
    expect(unit(a.state, 'e1').alive).toBe(false);
    expect(unit(a.state, 'p1').kills).toBe(1);
    expect(a.events).toEqual(b.events);
    expect(a.state.critState).toBe(b.state.critState);
  });

  it('an enemy can crit a soldier too (reaction fire uses the same fireShot)', () => {
    const s = makeState(corridorRows('P.E'));
    s.turn = 'enemy';
    unit(s, 'e1').facing = 6;
    unit(s, 'p1').hp = unit(s, 'p1').maxHp = 100;
    s.rngState = HIT();
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'e1', targetId: 'p1' }));
    expect(unit(r.state, 'p1').hp).toBe(100 - 45); // e1 carries a rifle
  });
});
