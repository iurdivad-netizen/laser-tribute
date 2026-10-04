import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { CONFIG, WEAPONS } from '../src/core/config';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const snap = () => ({ type: 'SnapShot' as const, unitId: 'p1', targetId: 'e1' });
const aimed = () => ({ type: 'AimedShot' as const, unitId: 'p1', targetId: 'e1' });
const HIT = () => seedForRoll((n) => n < 0.05);
const MISS = () => seedForRoll((n) => n > 0.99);

describe('magazines and starting ammo', () => {
  it('weapons have magazine sizes and the reload constants exist', () => {
    expect(WEAPONS.pistol.magazine).toBe(8);
    expect(WEAPONS.rifle.magazine).toBe(5);
    expect(CONFIG.reloadAp).toBe(15);
    expect(CONFIG.spareClips).toBe(1);
    expect(CONFIG.maxClips).toBe(4);
  });

  it('every unit starts with a full magazine and one spare clip', () => {
    const s = makeState(corridorRows('P..E'));
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 1 });
    expect(unit(s, 'e1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 1 });
  });

  it('a pistol soldier starts with eight rounds', () => {
    const s = makeState(corridorRows('PPP.E'));
    expect(unit(s, 'p3')).toMatchObject({ weapon: 'pistol', ammo: 8, clips: 1 });
  });
});

describe('shooting uses ammo', () => {
  it('a hit spends one round', () => {
    const s = makeState(corridorRows('P..E'));
    s.rngState = HIT();
    const r = ok(applyCommand(s, snap()));
    expect(unit(r.state, 'p1').ammo).toBe(4);
    expect(unit(r.state, 'p1').ap).toBe(45);
  });

  it('a miss spends a round too, and so does an aimed shot', () => {
    const s = makeState(corridorRows('P..E'));
    s.rngState = MISS();
    expect(unit(ok(applyCommand(s, snap())).state, 'p1').ammo).toBe(4);
    expect(unit(ok(applyCommand(s, aimed())).state, 'p1').ammo).toBe(4);
  });

  it('a rifle fires five rounds and the sixth is refused without spending AP or a round', () => {
    let s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ap = 600; // plenty, so only ammo can stop the sixth shot
    unit(s, 'p1').maxAp = 600;
    unit(s, 'e1').hp = 999;
    unit(s, 'e1').maxHp = 999;
    for (let i = 0; i < 5; i++) s = ok(applyCommand(s, snap())).state;
    expect(unit(s, 'p1')).toMatchObject({ ammo: 0, ap: 600 - 5 * 15 });
    const sixth = applyCommand(s, snap());
    expect(sixth.ok).toBe(false);
    expect(reason(sixth)).toBe('Out of ammo');
  });

  it('the knife still works with an empty gun', () => {
    const s = makeState(corridorRows('PE'));
    unit(s, 'p1').ammo = 0;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Stab', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
  });
});

describe('alert reaction fire uses ammo', () => {
  /** p1 faces east on alert; it is the enemy's turn with e1 about to walk west. */
  function setup() {
    const s = makeState(corridorRows('P....E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alert = true;
    s.turn = 'enemy';
    unit(s, 'e1').hp = 100;
    unit(s, 'e1').maxHp = 100;
    return s;
  }
  const west = { type: 'Move', unitId: 'e1', to: { x: 5, y: 1 } } as const;

  it('spends a round', () => {
    const s = setup();
    s.rngState = HIT();
    const r = ok(applyCommand(s, west));
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'shot']);
    expect(unit(r.state, 'p1').ammo).toBe(4);
  });

  it('does not fire with an empty gun and keeps its AP', () => {
    const s = setup();
    unit(s, 'p1').ammo = 0;
    const r = ok(applyCommand(s, west));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
    expect(unit(r.state, 'p1').ap).toBe(60);
  });
});

describe('picking up a weapon', () => {
  it('arrives with a full magazine and keeps the spare clips', () => {
    const s = makeState(corridorRows('P..E'));
    // p1 is a rifleman on this map, so make p1 a pistol soldier first.
    const p = unit(s, 'p1');
    p.weapon = 'pistol';
    p.ammo = 2;
    p.clips = 3;
    s.items.push({ id: 'i1', pos: { ...p.pos }, kind: 'rifle' });
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' }));
    expect(unit(r.state, 'p1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 3 });
  });

  it('swapping back and forth never creates ammo: a weapon keeps the rounds it was dropped with', () => {
    let s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    p.weapon = 'pistol';
    p.ammo = 0;
    p.clips = 0;
    s.items.push({ id: 'i1', pos: { ...p.pos }, kind: 'rifle' }); // a map-placed rifle: full
    s = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' })).state;
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 0 });
    expect(s.items[0]).toMatchObject({ kind: 'pistol', ammo: 0 }); // the empty pistol stays empty on the floor
    s = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' })).state; // back to the empty pistol
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'pistol', ammo: 0, clips: 0 });
    expect(s.items[0]).toMatchObject({ kind: 'rifle', ammo: 5 }); // the rifle he dropped keeps its 5 rounds
  });

  it('a dropped weapon keeps its rounds for a teammate to pick up', () => {
    let s = makeState(corridorRows('PP.E'));
    const a = unit(s, 'p1');
    a.weapon = 'pistol';
    a.ammo = 3;
    s.items.push({ id: 'i1', pos: { ...a.pos }, kind: 'rifle' });
    s = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' })).state; // p1 now holds the rifle; his pistol (3 rounds) is on the floor
    expect(s.items[0]).toMatchObject({ kind: 'pistol', ammo: 3 });
    // p2 stands on the same tile and takes the pistol
    unit(s, 'p2').pos = { ...unit(s, 'p1').pos };
    unit(s, 'p2').weapon = 'rifle';
    s = ok(applyCommand(s, { type: 'PickUp', unitId: 'p2', itemId: 'i1' })).state;
    expect(unit(s, 'p2')).toMatchObject({ weapon: 'pistol', ammo: 3 });
  });
});
