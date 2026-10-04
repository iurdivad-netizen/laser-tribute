import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

const reload = (unitId = 'p1') => ({ type: 'Reload' as const, unitId });

describe('Reload command', () => {
  it('fills the magazine, uses a clip and spends 15 AP', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 2;
    const r = ok(applyCommand(s, reload()));
    expect(unit(r.state, 'p1')).toMatchObject({ ammo: 5, clips: 0, ap: 45 });
    expect(r.events).toEqual([{ type: 'reloaded', unitId: 'p1', ammo: 5, at: { x: 1, y: 1 } }]);
  });

  it('refills a pistol to eight', () => {
    const s = makeState(corridorRows('PPP.E'));
    unit(s, 'p3').ammo = 0;
    expect(unit(ok(applyCommand(s, reload('p3'))).state, 'p3').ammo).toBe(8);
  });

  it('needs a spare clip', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 0;
    unit(s, 'p1').clips = 0;
    expect(reason(applyCommand(s, reload()))).toBe('No spare clips');
  });

  it('refuses a full magazine and spends nothing', () => {
    const s = makeState(corridorRows('P..E'));
    expect(reason(applyCommand(s, reload()))).toBe('Magazine is already full');
  });

  it('needs 15 AP: 14 fails, 15 works', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 0;
    unit(s, 'p1').ap = 14;
    expect(reason(applyCommand(s, reload()))).toBe('Not enough action points');
    unit(s, 'p1').ap = 15;
    expect(unit(ok(applyCommand(s, reload())).state, 'p1')).toMatchObject({ ammo: 5, ap: 0 });
  });

  it('reports "no spare clips" before "full magazine" and before AP', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').clips = 0;
    unit(s, 'p1').ap = 0;
    expect(reason(applyCommand(s, reload()))).toBe('No spare clips');
  });

  it('ends the soldier alert like any other action', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 1;
    unit(s, 'p1').alert = true;
    expect(unit(ok(applyCommand(s, reload())).state, 'p1').alert).toBe(false);
  });
});

describe('enemies and ammo', () => {
  /** Enemy turn with e1 able to see p1 four tiles away. */
  function enemyTurn() {
    const s = makeState(corridorRows('P...E'));
    s.turn = 'enemy';
    unit(s, 'e1').facing = 6;
    return s;
  }

  it('an enemy with an empty gun and a spare clip reloads before anything else', () => {
    const s = enemyTurn();
    unit(s, 'e1').ammo = 0;
    expect(aiNextCommand(s)).toEqual({ type: 'Reload', unitId: 'e1' });
  });

  it('a full enemy shoots as before', () => {
    expect(aiNextCommand(enemyTurn())).toMatchObject({ type: 'AimedShot', unitId: 'e1' });
  });

  it('an enemy with no ammo and no clips never shoots, and the turn still ends', () => {
    const s = enemyTurn();
    unit(s, 'e1').ammo = 0;
    unit(s, 'e1').clips = 0;
    const out = runEnemyTurn(s);
    expect(out.events.some((e) => e.type === 'shot')).toBe(false);
    expect(out.state.turn).toBe('player');
    expect(unit(out.state, 'p1').hp).toBe(50);
  });

  it('an enemy empties its gun, reloads once, and runs dry after its spare clip', () => {
    const s = enemyTurn();
    unit(s, 'e1').ap = 2000;
    unit(s, 'e1').maxAp = 2000;
    unit(s, 'p1').hp = 100000; // survive the whole volley
    unit(s, 'p1').maxHp = 100000;
    const out = runEnemyTurn(s);
    const shots = out.events.filter((e) => e.type === 'shot').length;
    const reloads = out.events.filter((e) => e.type === 'reloaded').length;
    expect(shots).toBe(10); // 5 + 5 with one reload in between
    expect(reloads).toBe(1);
    expect(unit(out.state, 'e1')).toMatchObject({ ammo: 0, clips: 0 });
    expect(out.state.turn).toBe('player');
  });
});
