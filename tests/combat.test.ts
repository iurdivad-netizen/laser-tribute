import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { hitChance, isCovered } from '../src/core/combat';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);
const MISS = () => seedForRoll((n) => n >= 0.96);

describe('isCovered', () => {
  it('is covered with a wall beside the target nearer the shooter', () => {
    const s = makeState(['#######', '#P.#E.#', '#######']);
    expect(isCovered(s, { x: 1, y: 1 }, { x: 4, y: 1 })).toBe(true);
  });

  it('is not covered in the open', () => {
    const s = makeState(['#######', '#P...E#', '#######']);
    expect(isCovered(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
  });

  it('is covered when standing in an open doorway', () => {
    const s = makeState(corridorRows('P.+E'));
    s.tiles[1][3].open = true;
    expect(isCovered(s, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });
});

describe('hitChance', () => {
  it('uses accuracy, distance and cover', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(6) + 'E')); // distance 7
    const p1 = unit(s, 'p1');
    const e1 = unit(s, 'e1');
    expect(hitChance(s, p1, e1, 'snap')).toBeCloseTo(0.375, 4);
    expect(hitChance(s, p1, e1, 'aimed')).toBeCloseTo(0.6375, 4);
    p1.weapon = 'pistol'; // range 8
    expect(hitChance(s, p1, e1, 'snap')).toBeCloseTo(0.55 * (1 - 0.5 * (7 / 8)), 4);
  });

  it('is lowered by cover', () => {
    const s = makeState(['#######', '#P.#E.#', '#######']);
    expect(hitChance(s, unit(s, 'p1'), unit(s, 'e1'), 'snap')).toBeCloseTo(0.267857, 4);
  });
});

describe('SnapShot and AimedShot', () => {
  const rows = corridorRows('P...E'); // distance 4

  it('a hit damages the target and spends AP', () => {
    const s = makeState(rows);
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(10);
    expect(unit(r.state, 'p1').ap).toBe(45);
    expect(r.events).toEqual([
      {
        type: 'shot', unitId: 'p1', targetId: 'e1', mode: 'snap', hit: true, crit: false, damage: 30,
        from: { x: 1, y: 1 }, impact: { x: 5, y: 1 },
      },
    ]);
  });

  it('a miss does no damage and lands elsewhere', () => {
    const s = makeState(rows);
    s.rngState = MISS();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(40);
    const shot = r.events.find((e) => e.type === 'shot');
    expect(shot).toMatchObject({ hit: false, damage: 0 });
  });

  it('an aimed shot costs more AP', () => {
    const s = makeState(rows);
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'p1').ap).toBe(30);
    expect(r.events[0]).toMatchObject({ type: 'shot', mode: 'aimed' });
  });

  it('killing the last enemy wins the mission', () => {
    const s = makeState(rows);
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').hp = 20;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 5, y: 1 } });
    expect(r.events).toContainEqual({ type: 'gameOver', winner: 'player' });
    expect(r.state.status).toBe('won');
  });

  it('rejects a target out of range', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(8) + 'E')); // distance 9
    unit(s, 'p1').weapon = 'pistol'; // range 8
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /range/,
    );
  });

  it('rejects a target behind a closed door', () => {
    const s = makeState(corridorRows('P.+.E'));
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /not visible/,
    );
  });

  it('rejects shooting at its own side', () => {
    const s = makeState(['#######', '#PP..E#', '#######']);
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'p2' }))).toMatch(
      /own side/,
    );
  });

  it('rejects a shot without enough AP', () => {
    const s = makeState(rows);
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').ap = 10;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /action points/,
    );
  });

  it('rejects an unknown or dead target', () => {
    const s = makeState(rows);
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'zz' }))).toMatch(
      /No such target/,
    );
    unit(s, 'e1').alive = false;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /No such target/,
    );
  });
});

describe('Throw', () => {
  it('kills an enemy caught in the blast', () => {
    const s = makeState(corridorRows('P.....E')); // e1 at x=7, distance 6
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 7, y: 1 } }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').grenades).toBe(0);
    expect(unit(r.state, 'p1').ap).toBe(36);
    expect(r.events[0]).toEqual({
      type: 'grenade', kind: 'frag', hazards: [], stunned: [], unitId: 'p1', at: { x: 7, y: 1 },
      hits: [{ unitId: 'e1', damage: 40 }], doorsDestroyed: [],
    });
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 7, y: 1 } });
    expect(r.state.status).toBe('won');
  });

  it('hurts the thrower too when the blast reaches them', () => {
    const s = makeState(corridorRows('P....E'));
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 2, y: 1 } }));
    expect(unit(r.state, 'p1').hp).toBe(10);
  });

  it('destroys doors in the blast radius', () => {
    const s = makeState(corridorRows('P..+.E'));
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 4, y: 1 } }));
    expect(r.state.tiles[1][4].kind).toBe('floor');
    expect(r.events[0]).toMatchObject({ type: 'grenade', doorsDestroyed: [{ x: 4, y: 1 }] });
  });

  it('rejects a throw with no grenades', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').grenades = 0;
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }))).toMatch(
      /grenades/,
    );
  });

  it('rejects a throw at a wall', () => {
    const s = makeState(corridorRows('P...E'));
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 0, y: 1 } }))).toMatch(
      /wall/,
    );
  });

  it('rejects a throw out of range', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(11) + 'E'));
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 12, y: 1 } }))).toMatch(
      /range/,
    );
  });

  it('rejects a throw when the path is blocked', () => {
    const s = makeState(corridorRows('P.#..E'));
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 5, y: 1 } }))).toMatch(
      /blocked/,
    );
  });

  it('rejects a throw without enough AP', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').ap = 20;
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }))).toMatch(
      /action points/,
    );
  });
});

describe('reaction fire', () => {
  const rows = corridorRows('P....E'); // distance 5

  it('does nothing when the enemy is not on alert', () => {
    const s = makeState(rows);
    unit(s, 'e1').facing = 6;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('lets an alerted enemy with spare AP shoot a soldier who moves into view', () => {
    const s = makeState(rows);
    unit(s, 'e1').alert = true;
    unit(s, 'e1').facing = 6;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'shot']);
    expect(unit(r.state, 'e1').ap).toBe(45);
    expect(unit(r.state, 'p1').hp).toBe(20);
  });

  it('does not fire without the AP for a snap shot', () => {
    const s = makeState(rows);
    unit(s, 'e1').alert = true;
    unit(s, 'e1').facing = 6;
    unit(s, 'e1').ap = 5;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('can kill the mover and end the mission', () => {
    const s = makeState(rows);
    unit(s, 'e1').alert = true;
    unit(s, 'e1').facing = 6;
    unit(s, 'p1').hp = 10;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(unit(r.state, 'p1').alive).toBe(false);
    expect(r.state.status).toBe('lost');
  });
});
