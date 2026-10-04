import { describe, expect, it } from 'vitest';
import { hitChance } from '../src/core/combat';
import { RANKS, applyRank, rankFor, rankShort } from '../src/core/ranks';
import { corridorRows, makeState, unit } from './helpers';

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
