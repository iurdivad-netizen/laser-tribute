import { describe, expect, it } from 'vitest';
import { WEAPONS, CONFIG } from '../src/core/config';
import { applyCommand } from '../src/core/apply';
import { hitChance } from '../src/core/combat';
import { sightOf, canSee } from '../src/core/vision';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

function duel(weapon: 'pistol' | 'rifle' | 'shotgun' | 'smg' | 'sniper', gap: number) {
  const s = makeState(corridorRows('P' + '.'.repeat(gap - 1) + 'E'.padEnd(1) + '.'));
  const p = unit(s, 'p1');
  p.weapon = weapon;
  p.ammo = WEAPONS[weapon].magazine;
  p.facing = 2;
  return { s, p, e: unit(s, 'e1') };
}

describe('hit chance with the new fields', () => {
  it('uses the weapon falloff: the shotgun loses its accuracy with distance far faster than the rifle', () => {
    const near = duel('shotgun', 2);
    const far = duel('shotgun', 6);
    const nearChance = hitChance(near.s, near.p, near.e, 'snap');
    const farChance = hitChance(far.s, far.p, far.e, 'snap');
    expect(nearChance / farChance).toBeGreaterThan(4); // 1-0.9*2/6 = 0.7 against 1-0.9*6/6 = 0.1
    const r = duel('rifle', 6);
    expect(hitChance(r.s, r.p, r.e, 'snap')).toBeCloseTo(0.5 * (1 - 0.5 * 6 / 14), 5);
  });

  it('halves the sniper accuracy within 3 tiles', () => {
    const close = duel('sniper', 3);
    const wide = duel('sniper', 4);
    const w = WEAPONS.sniper;
    expect(hitChance(close.s, close.p, close.e, 'aimed')).toBeCloseTo(w.aimedAccuracy * 0.5 * (1 - 0.2 * 3 / w.range), 5);
    expect(hitChance(wide.s, wide.p, wide.e, 'aimed')).toBeCloseTo(w.aimedAccuracy * (1 - 0.2 * 4 / w.range), 5);
  });
});

describe('burst fire', () => {
  it('fires three rounds, one shot event each, and uses three rounds of ammo', () => {
    const { s, e } = duel('smg', 3);
    e.hp = 999; e.maxHp = 999;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(3);
    expect(unit(r.state, 'p1').ammo).toBe(WEAPONS.smg.magazine - 3);
    expect(unit(r.state, 'p1').ap).toBe(CONFIG.maxAp - WEAPONS.smg.snapAp); // one action, one AP cost
  });

  it('stops when the magazine runs dry', () => {
    const { s, p, e } = duel('smg', 3);
    p.ammo = 2; e.hp = 999;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(2);
    expect(unit(r.state, 'p1').ammo).toBe(0);
  });

  it('stops when the target dies and credits the kill once', () => {
    const { s, p, e } = duel('smg', 2);
    e.hp = 1;
    s.rngState = seedForRoll((n) => n < 0.05);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(1);
    expect(r.events.filter((x) => x.type === 'died')).toHaveLength(1);
    expect(unit(r.state, 'p1').kills).toBe(1);
    expect(unit(r.state, 'p1').ammo).toBe(WEAPONS.smg.magazine - 1);
    void p;
  });

  it('a one-round weapon still fires one round', () => {
    const { s } = duel('rifle', 3);
    unit(s, 'e1').hp = 999;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(1);
  });
});

describe('sniper sight', () => {
  it('sees 14 tiles, others 10', () => {
    expect(sightOf({ weapon: 'sniper' } as never)).toBe(14);
    expect(sightOf({ weapon: 'rifle' } as never)).toBe(CONFIG.sightRange);
    const s = makeState(corridorRows('P' + '.'.repeat(13) + 'E'));
    const p = unit(s, 'p1');
    p.facing = 2;
    const far = { x: unit(s, 'e1').pos.x, y: 1 };
    p.weapon = 'rifle';
    expect(canSee(s, p, far)).toBe(false);
    p.weapon = 'sniper';
    expect(canSee(s, p, far)).toBe(true);
  });

  it('a sniper can shoot a target 13 tiles away; a rifleman cannot see it', () => {
    const { s, p, e } = duel('sniper', 13);
    e.hp = 999;
    const r = ok(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.some((x) => x.type === 'shot')).toBe(true);
    p.weapon = 'rifle';
    expect(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }).ok).toBe(false);
  });
});
