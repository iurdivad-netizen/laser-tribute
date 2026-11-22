import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { hitChance, officerAura } from '../src/core/combat';
import { ROLES } from '../src/core/config';
import { assignEnemyRoles } from '../src/core/enemyArms';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import { corridorRows, makeState, unit } from './helpers';

const roles = (type: number, level: number) =>
  createMission(generateMission(type, 0), type + 1, undefined, undefined, undefined, undefined, level)
    .units.filter((u) => u.side === 'enemy')
    .map((u) => u.role ?? 'plain');
const count = (r: string[], k: string) => r.filter((x) => x === k).length;

describe('enemy roles are handed out by level', () => {
  it('gives no roles in the tutorial level', () => {
    expect(roles(2, 1).every((r) => r === 'plain')).toBe(true);
  });

  it('adds officers from mission 3, rushers from 4 and snipers from 6', () => {
    expect(count(roles(2, 3), 'officer')).toBe(1);
    expect(count(roles(2, 3), 'rusher')).toBe(0);
    expect(count(roles(4, 5), 'rusher')).toBeGreaterThan(0);
    expect(count(roles(4, 5), 'sniper')).toBe(0);
    expect(count(roles(6, 7), 'sniper')).toBe(1);
    expect(count(roles(9, 10), 'sniper')).toBe(2);
  });

  it('always leaves a plain rifleman and is the same every time', () => {
    for (let type = 0; type < 10; type++) {
      const r = roles(type, type + 1);
      expect(count(r, 'plain')).toBeGreaterThanOrEqual(1);
      expect(roles(type, type + 1)).toEqual(r);
    }
  });

  it('arms snipers with the sniper rifle and rushers with the SMG', () => {
    const s = createMission(generateMission(6, 0), 7, undefined, undefined, undefined, undefined, 7);
    for (const u of s.units.filter((x) => x.side === 'enemy')) {
      if (u.role === 'sniper') expect(u.weapon).toBe('sniper');
      if (u.role === 'rusher') expect(u.weapon).toBe('smg');
    }
  });

  it('does nothing on a map with a single enemy', () => {
    const s = makeState(corridorRows('P...E'));
    assignEnemyRoles(s, 10);
    expect(unit(s, 'e1').role).toBeUndefined();
  });
});

describe('officer aura', () => {
  it('raises the accuracy of nearby enemies, but only while the officer lives', () => {
    const s = makeState(corridorRows('P..E.E'));
    const [a, b] = s.units.filter((u) => u.side === 'enemy');
    const p = unit(s, 'p1');
    const before = hitChance(s, a, p, 'snap');
    b.role = 'officer';
    expect(officerAura(s, a)).toBe(ROLES.officerBonus);
    expect(hitChance(s, a, p, 'snap')).toBeGreaterThan(before);
    b.alive = false;
    expect(hitChance(s, a, p, 'snap')).toBeCloseTo(before);
  });

  it('does not help the squad', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    p.role = 'officer';
    expect(officerAura(s, p)).toBe(0);
  });

  it('does not reach enemies beyond the radius', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(12) + 'E.E'));
    const [near, far] = s.units.filter((u) => u.side === 'enemy');
    near.role = 'officer';
    far.pos = { x: near.pos.x + ROLES.officerRadius + 1, y: near.pos.y };
    expect(officerAura(s, far)).toBe(0);
    far.pos = { x: near.pos.x + ROLES.officerRadius, y: near.pos.y };
    expect(officerAura(s, far)).toBe(ROLES.officerBonus);
  });
});

describe('enemy behaviour', () => {
  it('a sniper holds its post even when told where the squad is', () => {
    const s = makeState(corridorRows('P..........E'));
    const e = unit(s, 'e1');
    e.role = 'sniper';
    s.enemyMemory = { ...unit(s, 'p1').pos };
    s.turn = 'enemy';
    const before = { ...e.pos };
    const after = runEnemyTurn(s).state.units.find((u) => u.id === 'e1')!;
    expect(after.pos).toEqual(before);
  });

  it('a hurt plain enemy backs off the squad but a hurt rusher keeps coming', () => {
    const run = (role?: 'rusher') => {
      const s = makeState(corridorRows('P......E'));
      const e = unit(s, 'e1');
      e.hp = 5;
      e.role = role;
      s.turn = 'enemy';
      return runEnemyTurn(s).state.units.find((u) => u.id === 'e1')!;
    };
    const p1x = 1;
    expect(run().pos.x).toBeGreaterThanOrEqual(run('rusher').pos.x);
    expect(run('rusher').pos.x).toBeGreaterThan(p1x);
  });
});
