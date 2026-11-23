import { describe, expect, it } from 'vitest';
import { REGIONS, START_REGION } from '../src/core/world/planet';
import { advance, counterattack, newWorld, type Holder, type World } from '../src/core/world/world';

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});
const enemies = REGIONS.filter((r) => r.kind === 'enemy');
const garrisons = (w: World) => enemies.map((r) => w.regions[r.id].garrison);
const base = enemies.map((r) => r.garrison);
const plus = (n: number) => base.map((b) => b + n);

describe('advance: garrison growth', () => {
  it('never grows on CALM', () => {
    const w = advance(newWorld(1, 'calm'), 400);
    expect(w.day).toBe(400);
    expect(garrisons(w)).toEqual(base);
  });

  it('grows by one every 12 days on STANDARD, up to +3', () => {
    const w = newWorld(1, 'standard');
    expect(garrisons(advance(w, 11))).toEqual(base);
    expect(garrisons(advance(w, 12))).toEqual(plus(1));
    expect(garrisons(advance(w, 120))).toEqual(plus(3));
  });

  it('grows by one every 6 days on PRESSURE, up to +5', () => {
    const w = newWorld(1, 'pressure');
    expect(garrisons(advance(w, 6))).toEqual(plus(1));
    expect(garrisons(advance(w, 120))).toEqual(plus(5));
  });

  it('counts days across calls, not per call', () => {
    const w = advance(advance(newWorld(1, 'standard'), 7), 5);
    expect(w.day).toBe(12);
    expect(garrisons(w)).toEqual(plus(1));
  });

  it('only grows enemy-held garrisons', () => {
    const w = advance(hold(newWorld(1, 'standard'), [enemies[0].id]), 12);
    expect(w.regions[enemies[0].id].garrison).toBe(base[0]);
    expect(w.regions[enemies[1].id].garrison).toBe(base[1] + 1);
  });
});

describe('advance: guards', () => {
  it('returns an equal world for 0 days and never mutates its input', () => {
    const w = newWorld(1, 'pressure');
    const before = JSON.parse(JSON.stringify(w));
    expect(advance(w, 0)).toEqual(w);
    advance(w, 90);
    expect(JSON.parse(JSON.stringify(w))).toEqual(before);
  });

  it('rejects negative and fractional days', () => {
    const w = newWorld(1, 'calm');
    expect(() => advance(w, -1)).toThrow(RangeError);
    expect(() => advance(w, 1.5)).toThrow(RangeError);
    expect(() => advance(w, Number.NaN)).toThrow(RangeError);
  });

  it('is deterministic', () => {
    const w = hold(newWorld(9, 'pressure'), [1, 2]);
    expect(advance(w, 200)).toEqual(advance(w, 200));
  });

  it('never changes a holder on CALM or STANDARD', () => {
    for (const id of ['calm', 'standard'] as const) {
      const w = hold(newWorld(3, id), [1, 2, 6]);
      expect(advance(w, 1000).regions.map((r) => r.holder)).toEqual(w.regions.map((r) => r.holder));
    }
  });
});

describe('counterattack', () => {
  const w = hold(newWorld(1, 'pressure'), [1]); // start and region 1 held; region 2 and 6 are enemy

  it('retakes the weakest liberated region touching enemy ground when the roll is low', () => {
    const next = counterattack(w, 0);
    const flipped = next.regions.flatMap((r, i) => (r.holder !== w.regions[i].holder ? [i] : []));
    expect(flipped).toHaveLength(1);
    const lost = REGIONS[flipped[0]];
    expect(next.regions[lost.id]).toMatchObject({ holder: 'enemy', garrison: Math.max(1, lost.garrison) });
    expect(next.status).toBe('active');
  });

  it('changes nothing on a high roll (the chance is at most 0.9)', () => {
    expect(counterattack(w, 0.99)).toEqual(w);
  });

  it('changes nothing when no held region touches the enemy', () => {
    const everything = hold(newWorld(1, 'pressure'), REGIONS.map((r) => r.id));
    expect(counterattack(everything, 0)).toEqual(everything);
  });

  it('loses the game when the last held region falls', () => {
    const only = newWorld(1, 'pressure');
    expect(only.regions[START_REGION].holder).toBe('player');
    const next = counterattack(only, 0);
    expect(next.regions[START_REGION].holder).toBe('enemy');
    expect(next.status).toBe('lost');
  });

  it('flips at most one region in 15 days of PRESSURE', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const start = hold(newWorld(seed, 'pressure'), [1, 2, 6]);
      const flips = advance(start, 15).regions.filter((r, i) => start.regions[i].holder === 'player' && r.holder === 'enemy');
      expect(flips.length).toBeLessThanOrEqual(1);
    }
  });
});
