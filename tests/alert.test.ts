import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);

describe('Alert command', () => {
  const rows = corridorRows('P...E');

  it('puts a soldier on alert for free when he has the AP for a snap shot', () => {
    const s = makeState(rows);
    const r = ok(applyCommand(s, { type: 'Alert', unitId: 'p1', on: true }));
    expect(unit(r.state, 'p1').alert).toBe(true);
    expect(unit(r.state, 'p1').ap).toBe(60);
    expect(r.events).toEqual([{ type: 'alert', unitId: 'p1', on: true }]);
  });

  it('needs enough AP for a snap shot', () => {
    const s = makeState(rows);
    unit(s, 'p1').ap = 10; // rifle snap shot costs 15
    expect(reason(applyCommand(s, { type: 'Alert', unitId: 'p1', on: true }))).toMatch(
      /action points/,
    );
  });

  it('rejects going on alert twice, or off alert when not on alert', () => {
    const s = makeState(rows);
    expect(reason(applyCommand(s, { type: 'Alert', unitId: 'p1', on: false }))).toMatch(/not on alert/i);
    const on = ok(applyCommand(s, { type: 'Alert', unitId: 'p1', on: true })).state;
    expect(reason(applyCommand(on, { type: 'Alert', unitId: 'p1', on: true }))).toMatch(/already/i);
  });

  it('can be switched off again', () => {
    const on = ok(applyCommand(makeState(rows), { type: 'Alert', unitId: 'p1', on: true })).state;
    const off = ok(applyCommand(on, { type: 'Alert', unitId: 'p1', on: false }));
    expect(unit(off.state, 'p1').alert).toBe(false);
    expect(off.events).toEqual([{ type: 'alert', unitId: 'p1', on: false }]);
  });

  it('is cancelled when the soldier spends AP on anything else', () => {
    const on = ok(applyCommand(makeState(rows), { type: 'Alert', unitId: 'p1', on: true })).state;
    const turned = ok(applyCommand(on, { type: 'Turn', unitId: 'p1', facing: 2 }));
    expect(unit(turned.state, 'p1').alert).toBe(false);
  });

  it('survives into the enemy turn and ends when his side next turn starts', () => {
    const on = ok(applyCommand(makeState(rows), { type: 'Alert', unitId: 'p1', on: true })).state;
    const enemyTurn = ok(applyCommand(on, { type: 'EndTurn' })).state;
    expect(unit(enemyTurn, 'p1').alert).toBe(true);
    const playerTurn = ok(applyCommand(enemyTurn, { type: 'EndTurn' })).state;
    expect(unit(playerTurn, 'p1').alert).toBe(false);
  });
});

describe('alert reaction fire', () => {
  /** p1 faces east on alert; it is the enemy's turn with e1 about to walk west. */
  function setup(inner = 'P....E') {
    const s = makeState(corridorRows(inner));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alert = true;
    s.turn = 'enemy';
    unit(s, 'e1').hp = 100;
    unit(s, 'e1').maxHp = 100;
    return s;
  }
  const west = (id: string, x: number) =>
    ({ type: 'Move', unitId: id, to: { x, y: 1 } }) as const;

  it('fires one snap shot at an enemy that moves into view', () => {
    const s = setup();
    s.rngState = HIT();
    const r = ok(applyCommand(s, west('e1', 5)));
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'shot']);
    expect(r.events[1]).toMatchObject({ type: 'shot', unitId: 'p1', targetId: 'e1', mode: 'snap', hit: true });
    expect(unit(r.state, 'p1').ap).toBe(45);
    expect(unit(r.state, 'e1').hp).toBe(70);
  });

  it('fires at most once per soldier per enemy per turn', () => {
    const s = setup();
    s.rngState = HIT();
    const first = ok(applyCommand(s, west('e1', 5)));
    const second = ok(applyCommand(first.state, west('e1', 4)));
    expect(second.events.map((e) => e.type)).toEqual(['moved']);
    expect(unit(second.state, 'p1').ap).toBe(45);
  });

  it('every alerted soldier gets his own shot', () => {
    const s = makeState(corridorRows('PP...E'));
    for (const id of ['p1', 'p2']) {
      unit(s, id).facing = 2;
      unit(s, id).alert = true;
    }
    s.turn = 'enemy';
    unit(s, 'e1').hp = 100;
    unit(s, 'e1').maxHp = 100;
    const r = ok(applyCommand(s, west('e1', 5)));
    const shooters = r.events.filter((e) => e.type === 'shot').map((e) => (e as { unitId: string }).unitId);
    expect(shooters).toEqual(['p1', 'p2']);
  });

  it('does nothing when the soldier is not on alert', () => {
    const s = setup();
    unit(s, 'p1').alert = false;
    const r = ok(applyCommand(s, west('e1', 5)));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('does nothing without the AP for a snap shot', () => {
    const s = setup();
    unit(s, 'p1').ap = 5;
    const r = ok(applyCommand(s, west('e1', 5)));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('does nothing when the soldier is facing away', () => {
    const s = setup();
    unit(s, 'p1').facing = 6;
    const r = ok(applyCommand(s, west('e1', 5)));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('does nothing when the enemy is out of weapon range', () => {
    const s = setup('P' + '.'.repeat(9) + 'E'); // e1 ends 9 tiles away after one step
    unit(s, 'p1').weapon = 'pistol'; // range 8
    const r = ok(applyCommand(s, west('e1', 10)));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('a reaction kill can end the mission', () => {
    const s = setup();
    unit(s, 'e1').hp = 10;
    unit(s, 'e1').maxHp = 10;
    s.rngState = HIT();
    const r = ok(applyCommand(s, west('e1', 5)));
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 5, y: 1 } });
    expect(r.state.status).toBe('won');
  });

  it('drops the alert once the soldier cannot afford another snap shot', () => {
    const s = setup();
    unit(s, 'p1').ap = 20; // one snap shot (15) leaves 5
    s.rngState = HIT();
    const r = ok(applyCommand(s, west('e1', 5)));
    expect(unit(r.state, 'p1').ap).toBe(5);
    expect(unit(r.state, 'p1').alert).toBe(false);
  });

  it('allows a fresh reaction shot on a later turn', () => {
    const s = setup();
    s.rngState = HIT();
    const first = ok(applyCommand(s, west('e1', 5))).state;
    expect(first.reacted).toEqual(['p1>e1']);
    const playerTurn = ok(applyCommand(first, { type: 'EndTurn' })).state;
    expect(playerTurn.reacted).toEqual([]);
  });
});
