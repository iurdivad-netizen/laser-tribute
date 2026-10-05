import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { damageTaken } from '../src/core/combat';
import { GADGETS, GADGET_IDS } from '../src/core/config';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

describe('gadget data', () => {
  it('lists the three gadgets with the agreed numbers', () => {
    expect([...GADGET_IDS]).toEqual(['medkit', 'armour', 'scanner']);
    expect(GADGETS.medkit).toMatchObject({ price: 12, apCost: 12, heal: 25 });
    expect(GADGETS.armour).toMatchObject({ price: 20, reductionPct: 30 });
    expect(GADGETS.scanner).toMatchObject({ price: 15, apCost: 10, radius: 8 });
  });

  it('every unit starts with no gadget and the state with no scan', () => {
    const s = makeState(corridorRows('P.E'));
    expect(s.units.every((u) => u.gadget === null)).toBe(true);
    expect(s.scanned).toEqual([]);
  });
});

describe('damageTaken', () => {
  it('is the raw damage without armour', () => {
    const s = makeState(corridorRows('P.E'));
    expect(damageTaken(unit(s, 'p1'), 30)).toBe(30);
  });

  it('takes 30% off, rounded so the soldier gets the benefit of the floor, and never below 1', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    p.gadget = 'armour';
    expect([30, 18, 40, 60].map((d) => damageTaken(p, d))).toEqual([21, 13, 28, 42]);
    expect(damageTaken(p, 1)).toBe(1);
    expect(damageTaken(p, 2)).toBe(2);
  });

  it('other gadgets do not reduce damage', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    p.gadget = 'medkit';
    expect(damageTaken(p, 30)).toBe(30);
  });
});

describe('armour in combat', () => {
  it('reduces a rifle hit', () => {
    const s = makeState(corridorRows('P.E'));
    s.rngState = seedForRoll((n) => n < 0.05);
    unit(s, 'p1').facing = 2;
    const e = unit(s, 'e1');
    e.hp = e.maxHp = 100;
    e.gadget = 'armour';
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(79); // rifle 30 -> 21
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: true, damage: 21 }));
  });

  it('reduces a stab and grenade splash', () => {
    const stab = makeState(corridorRows('PE'));
    stab.rngState = seedForRoll((n) => n < 0.9);
    const e = unit(stab, 'e1');
    e.hp = e.maxHp = 100;
    e.gadget = 'armour';
    const r = ok(applyCommand(stab, { type: 'Stab', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(58); // knife 60 -> 42

    const nade = makeState(corridorRows('P..E'));
    const t = unit(nade, 'e1');
    t.hp = t.maxHp = 100;
    t.gadget = 'armour';
    const g = ok(applyCommand(nade, { type: 'Throw', unitId: 'p1', at: { x: 4, y: 1 } }));
    expect(unit(g.state, 'e1').hp).toBe(72); // grenade 40 -> 28
  });
});

describe('scan state', () => {
  it('is cleared when the player ends the turn', () => {
    const s = makeState(corridorRows('P.E'));
    s.scanned = [{ x: 3, y: 1 }];
    const r = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(r.state.scanned).toEqual([]);
  });
});
