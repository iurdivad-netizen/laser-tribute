import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { defaultLoadout } from '../src/core/loadout';
import { MISSIONS, createMission } from '../src/core/missions';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

describe('gadgets in a mission', () => {
  it('a medic heals a wounded teammate', () => {
    const wounded = makeState(corridorRows('PPE'));
    unit(wounded, 'p1').gadget = 'medkit';
    unit(wounded, 'p2').hp = 15;
    const r = ok(applyCommand(wounded, { type: 'Heal', unitId: 'p1', targetId: 'p2' }));
    expect(unit(r.state, 'p2').hp).toBe(40);
    expect(unit(r.state, 'p1').gadget).toBeNull();
  });

  it('a scan shows an enemy behind a wall and the dot goes when the turn ends', () => {
    const s = makeState(['#########', '#P.#.E..#', '#########']);
    unit(s, 'p1').gadget = 'scanner';
    const scanned = ok(applyCommand(s, { type: 'Scan', unitId: 'p1' })).state;
    expect(scanned.scanned).toEqual([{ x: 5, y: 1 }]);
    const ended = ok(applyCommand(scanned, { type: 'EndTurn' })).state;
    expect(ended.scanned).toEqual([]);
  });

  it('an armoured soldier survives one more rifle hit than an unarmoured one', () => {
    const hitsToKill = (armour: boolean): number => {
      let s = makeState(corridorRows('E.P'));
      unit(s, 'p1').gadget = armour ? 'armour' : null;
      s.turn = 'enemy';
      let hits = 0;
      for (let i = 0; i < 20 && unit(s, 'p1').alive; i++) {
        s.rngState = seedForRoll((n) => n < 0.05);
        unit(s, 'e1').ammo = 5;
        unit(s, 'e1').ap = 60;
        unit(s, 'e1').weapon = 'rifle';
        unit(s, 'e1').facing = 2;
        s = ok(applyCommand(s, { type: 'SnapShot', unitId: 'e1', targetId: 'p1' })).state;
        hits += 1;
      }
      return hits;
    };
    expect(hitsToKill(false)).toBe(2); // 50 HP, rifle 30
    expect(hitsToKill(true)).toBe(3); // rifle 21: 50 -> 29 -> 8 -> dead
  });

  it('Warehouse starts with no gadgets, so nothing changes for a squad without them', () => {
    const s = createMission(MISSIONS[1], 1, undefined, defaultLoadout());
    expect(s.units.every((u) => u.gadget === null)).toBe(true);
    expect(s.scanned).toEqual([]);
  });
});
