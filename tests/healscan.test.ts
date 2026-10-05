import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

const heal = (unitId = 'p1', targetId = 'p2') => ({ type: 'Heal' as const, unitId, targetId });
const scan = (unitId = 'p1') => ({ type: 'Scan' as const, unitId });

/** p1 (medic) beside p2, enemy further along. */
function squad() {
  const s = makeState(corridorRows('PP..E'));
  unit(s, 'p1').gadget = 'medkit';
  unit(s, 'p2').hp = 20;
  return s;
}

describe('Heal', () => {
  it('heals an adjacent teammate by 25, spends 12 AP and uses up the medkit', () => {
    const r = ok(applyCommand(squad(), heal()));
    expect(unit(r.state, 'p2').hp).toBe(45);
    expect(unit(r.state, 'p1').ap).toBe(60 - 12);
    expect(unit(r.state, 'p1').gadget).toBeNull();
    expect(r.events).toContainEqual({ type: 'healed', unitId: 'p1', targetId: 'p2', amount: 25, at: { x: 2, y: 1 } });
  });

  it('never goes above max HP, and reports the amount actually healed', () => {
    const s = squad();
    unit(s, 'p2').hp = 40;
    const r = ok(applyCommand(s, heal()));
    expect(unit(r.state, 'p2').hp).toBe(50);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'healed', amount: 10 }));
  });

  it('can heal the medic itself', () => {
    const s = squad();
    unit(s, 'p1').hp = 10;
    const r = ok(applyCommand(s, heal('p1', 'p1')));
    expect(unit(r.state, 'p1').hp).toBe(35);
  });

  it('counts a diagonal neighbour as adjacent', () => {
    const s = makeState(['#####', '#P..#', '#.P.#', '#..E#', '#####']);
    unit(s, 'p1').gadget = 'medkit';
    unit(s, 'p2').hp = 10;
    expect(applyCommand(s, heal()).ok).toBe(true);
  });

  it('rejects: no medkit, wrong gadget, too far, full health, dead, enemy, low AP', () => {
    const none = squad();
    unit(none, 'p1').gadget = null;
    expect(reason(applyCommand(none, heal()))).toBe('No medkit');
    const scanner = squad();
    unit(scanner, 'p1').gadget = 'scanner';
    expect(reason(applyCommand(scanner, heal()))).toBe('No medkit');
    const far = makeState(corridorRows('P.P.E'));
    unit(far, 'p1').gadget = 'medkit';
    unit(far, 'p2').hp = 10;
    expect(reason(applyCommand(far, heal()))).toBe('The target is too far away');
    const full = squad();
    unit(full, 'p2').hp = 50;
    expect(reason(applyCommand(full, heal()))).toBe('Already at full health');
    const dead = squad();
    unit(dead, 'p2').alive = false;
    expect(reason(applyCommand(dead, heal()))).toBe('No such target');
    expect(reason(applyCommand(squad(), heal('p1', 'e1')))).toBe('Can only heal your own side');
    const low = squad();
    unit(low, 'p1').ap = 11;
    expect(reason(applyCommand(low, heal()))).toBe('Not enough action points');
  });

  it('a failed heal keeps the medkit and the AP', () => {
    const s = squad();
    unit(s, 'p2').hp = 50;
    expect(applyCommand(s, heal()).ok).toBe(false);
    expect(unit(s, 'p1').gadget).toBe('medkit');
    expect(unit(s, 'p1').ap).toBe(60);
  });
});

describe('Scan', () => {
  it('marks living enemies within 8 tiles through walls, spends 10 AP and uses up the scanner', () => {
    const s = makeState(['###########', '#P.#..E...#', '###########']);
    unit(s, 'p1').gadget = 'scanner';
    const r = ok(applyCommand(s, scan()));
    expect(r.state.scanned).toEqual([{ x: 6, y: 1 }]);
    expect(unit(r.state, 'p1').ap).toBe(50);
    expect(unit(r.state, 'p1').gadget).toBeNull();
    expect(r.events).toContainEqual({ type: 'scanned', unitId: 'p1', found: [{ x: 6, y: 1 }] });
  });

  it('includes an enemy exactly 8 tiles away and excludes one 10 away and the dead', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(7) + 'E.E')); // E at distance 8 and 10
    unit(s, 'p1').gadget = 'scanner';
    const r = ok(applyCommand(s, scan()));
    expect(r.state.scanned).toEqual([{ x: 9, y: 1 }]);
    const dead = makeState(corridorRows('P..E'));
    unit(dead, 'p1').gadget = 'scanner';
    unit(dead, 'e1').alive = false;
    expect(ok(applyCommand(dead, scan())).state.scanned).toEqual([]);
  });

  it('with nobody in range it still spends the scanner and the AP', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(12) + 'E'));
    unit(s, 'p1').gadget = 'scanner';
    const r = ok(applyCommand(s, scan()));
    expect(r.state.scanned).toEqual([]);
    expect(unit(r.state, 'p1').gadget).toBeNull();
    expect(unit(r.state, 'p1').ap).toBe(50);
  });

  it('rejects without a scanner or with too little AP, and changes nothing', () => {
    const none = makeState(corridorRows('P..E'));
    expect(reason(applyCommand(none, scan()))).toBe('No scanner');
    const low = makeState(corridorRows('P..E'));
    unit(low, 'p1').gadget = 'scanner';
    unit(low, 'p1').ap = 9;
    expect(reason(applyCommand(low, scan()))).toBe('Not enough action points');
    expect(unit(low, 'p1').gadget).toBe('scanner');
  });
});
