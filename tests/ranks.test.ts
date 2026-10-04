import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { hitChance } from '../src/core/combat';
import { MISSIONS, createMission } from '../src/core/missions';
import { RANKS, applyRank, promotions, rankFor, rankShort } from '../src/core/ranks';
import { soldierLines } from '../src/screens/equipment';
import { corridorRows, makeState, ok, unit } from './helpers';

describe('rankFor', () => {
  it('promotes exactly at 2, 5 and 9 kills', () => {
    const name = (k: number) => rankFor(k).name;
    expect([0, 1].map(name)).toEqual(['Rookie', 'Rookie']);
    expect([2, 3, 4].map(name)).toEqual(['Private', 'Private', 'Private']);
    expect([5, 8].map(name)).toEqual(['Sergeant', 'Sergeant']);
    expect([9, 20].map(name)).toEqual(['Captain', 'Captain']);
  });

  it('has the bonuses from the design table', () => {
    expect(RANKS.map((r) => [r.name, r.minKills, r.hp, r.ap, r.accuracy])).toEqual([
      ['Rookie', 0, 0, 0, 0],
      ['Private', 2, 10, 4, 0.04],
      ['Sergeant', 5, 20, 8, 0.08],
      ['Captain', 9, 30, 12, 0.12],
    ]);
  });

  it('has three-letter short forms', () => {
    expect(rankShort('Sergeant')).toBe('Sgt');
    expect(rankShort('Captain')).toBe('Cpt');
    expect(rankShort('')).toBe('');
    expect(rankShort('Nonsense')).toBe('');
  });
});

describe('applyRank', () => {
  it('sets max and current HP/AP and accuracy from the rank', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    p.hp = 10;
    p.ap = 5;
    applyRank(p, 9);
    expect(p).toMatchObject({ rank: 'Captain', maxHp: 80, hp: 80, maxAp: 72, ap: 72, accuracy: 0.12 });
  });

  it('leaves a Rookie at the base stats', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    applyRank(p, 0);
    expect(p).toMatchObject({ rank: 'Rookie', maxHp: 50, hp: 50, maxAp: 60, ap: 60, accuracy: 0 });
  });
});

describe('default units', () => {
  it('soldiers start as Rookies with no accuracy bonus, enemies have no rank', () => {
    const s = makeState(corridorRows('P..E'));
    expect(unit(s, 'p1')).toMatchObject({ rank: 'Rookie', accuracy: 0 });
    expect(unit(s, 'e1')).toMatchObject({ rank: '', accuracy: 0 });
  });
});

describe('hitChance with soldier accuracy', () => {
  // P at x=1, E at x=3: distance 2, no wall beside the target that is closer, so no cover.
  const setup = () => {
    const s = makeState(corridorRows('P.E'));
    return { s, p: unit(s, 'p1'), e: unit(s, 'e1') };
  };

  it('is unchanged for a Rookie', () => {
    const { s, p, e } = setup();
    p.weapon = 'rifle';
    expect(hitChance(s, p, e, 'aimed')).toBeCloseTo(0.85 * (1 - 0.5 * (2 / 14)), 5);
  });

  it('adds the soldier accuracy to the weapon accuracy', () => {
    const { s, p, e } = setup();
    p.weapon = 'pistol';
    applyRank(p, 9); // +0.12
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo((0.55 + 0.12) * (1 - 0.5 * (2 / 8)), 5);
  });

  it('caps weapon plus soldier accuracy at 95% before range', () => {
    const { s, p, e } = setup();
    p.weapon = 'rifle';
    applyRank(p, 9); // 0.85 + 0.12 = 0.97, capped to 0.95
    expect(hitChance(s, p, e, 'aimed')).toBeCloseTo(0.95 * (1 - 0.5 * (2 / 14)), 5);
  });

  it('does not change enemy hit chances', () => {
    const { s, p, e } = setup();
    e.weapon = 'rifle';
    applyRank(p, 9);
    expect(hitChance(s, e, p, 'aimed')).toBeCloseTo(0.85 * (1 - 0.5 * (2 / 14)), 5);
  });
});

describe('createMission applies ranks from the roster', () => {
  const roster = [
    { name: 'Vet', kills: 9 },
    { name: 'Sarge', kills: 5 },
    { name: 'Pvt', kills: 2 },
    { name: 'New', kills: 0 },
  ];

  it('gives each soldier the stats of their rank', () => {
    const s = createMission(MISSIONS[0], 1, roster);
    const soldiers = s.units.filter((u) => u.side === 'player');
    expect(soldiers.map((u) => u.rank)).toEqual(['Captain', 'Sergeant', 'Private', 'Rookie']);
    expect(soldiers.map((u) => [u.maxHp, u.hp, u.maxAp, u.ap])).toEqual([
      [80, 80, 72, 72],
      [70, 70, 68, 68],
      [60, 60, 64, 64],
      [50, 50, 60, 60],
    ]);
    expect(soldiers.map((u) => u.accuracy)).toEqual([0.12, 0.08, 0.04, 0]);
    expect(soldiers.map((u) => u.name)).toEqual(['Vet', 'Sarge', 'Pvt', 'New']);
  });

  it('does not touch enemies', () => {
    const s = createMission(MISSIONS[0], 1, roster);
    for (const e of s.units.filter((u) => u.side === 'enemy')) {
      expect(e).toMatchObject({ rank: '', accuracy: 0, maxHp: 40, maxAp: 60 });
    }
  });

  it('without a roster every soldier is a Rookie', () => {
    const s = createMission(MISSIONS[0], 1);
    expect(s.units.filter((u) => u.side === 'player').every((u) => u.rank === 'Rookie' && u.maxHp === 50)).toBe(true);
  });

  it('refills AP to the rank maximum at the start of the next player turn', () => {
    const s = makeState(corridorRows('P..E'));
    applyRank(unit(s, 'p1'), 9);
    unit(s, 'p1').ap = 0;
    const r1 = ok(applyCommand(s, { type: 'EndTurn' }));
    const r2 = ok(applyCommand(r1.state, { type: 'EndTurn' }));
    expect(unit(r2.state, 'p1').ap).toBe(72);
  });
});

describe('promotions', () => {
  const r = (name: string, kills: number) => ({ name, kills });

  it('lists soldiers whose rank went up, by name', () => {
    const before = [r('A', 1), r('B', 4), r('C', 8), r('D', 0)];
    const after = [r('A', 2), r('B', 5), r('C', 9), r('D', 1)];
    expect(promotions(before, after)).toEqual(['A (Private)', 'B (Sergeant)', 'C (Captain)']);
  });

  it('ignores more kills without a new rank and soldiers not in the new roster', () => {
    expect(promotions([r('A', 2), r('Dead', 4)], [r('A', 4), r('Rookie', 0)])).toEqual([]);
  });

  it('a skipped rank still announces the rank reached', () => {
    expect(promotions([r('A', 0)], [r('A', 6)])).toEqual(['A (Sergeant)']);
  });
});

describe('soldierLines', () => {
  it('shows name, rank and kills on separate lines, so long names stay clear of the buttons', () => {
    expect(soldierLines({ name: 'Chen', kills: 6, rank: 'Sergeant' })).toEqual(['Chen', 'Sergeant', '6 kills']);
  });

  it('works without a rank', () => {
    expect(soldierLines({ name: 'P1', kills: 0 })).toEqual(['P1', '0 kills']);
  });
});
