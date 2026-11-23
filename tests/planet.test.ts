import { describe, expect, it } from 'vitest';
import { RECIPES, generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import {
  CAPITAL_GATES, CAPITAL_REGION, CAPITAL_UNLOCK, PLANET_VERSION, REGIONS, START_REGION, missionDifficulty,
} from '../src/core/world/planet';

describe('planet data', () => {
  it('has 30 regions whose id is their index', () => {
    expect(REGIONS.length).toBe(30);
    expect(REGIONS.every((r, i) => r.id === i)).toBe(true);
    expect(PLANET_VERSION).toBe(1);
  });

  it('splits into 1 start, 17 enemy, 6 neutral and 6 wild regions', () => {
    const count = (k: string) => REGIONS.filter((r) => r.kind === k).length;
    expect([count('start'), count('enemy'), count('neutral'), count('wild')]).toEqual([1, 17, 6, 6]);
    expect(REGIONS[START_REGION].kind).toBe('start');
  });

  it('has symmetric links in range, no self-links, and one connected graph', () => {
    for (const r of REGIONS) {
      for (const l of r.links) {
        expect(l).not.toBe(r.id);
        expect(REGIONS[l]).toBeDefined();
        expect(REGIONS[l].links).toContain(r.id);
      }
      expect(new Set(r.links).size).toBe(r.links.length);
    }
    const seen = new Set<number>([START_REGION]);
    const queue = [START_REGION];
    while (queue.length) for (const l of REGIONS[queue.shift()!].links) if (!seen.has(l)) { seen.add(l); queue.push(l); }
    expect(seen.size).toBe(30);
  });

  it('puts a type 9 citadel capital behind at least three gates', () => {
    const cap = REGIONS[CAPITAL_REGION];
    expect(cap.kind).toBe('enemy');
    expect(cap.type).toBe(9);
    expect(CAPITAL_GATES.length).toBeGreaterThanOrEqual(3);
    expect(CAPITAL_GATES).not.toContain(START_REGION);
    expect(CAPITAL_UNLOCK).toBe(2);
  });

  it('keeps regions on the map and far enough apart for a finger', () => {
    for (const r of REGIONS) {
      expect(r.x).toBeGreaterThanOrEqual(12);
      expect(r.x).toBeLessThanOrEqual(318);
      expect(r.y).toBeGreaterThanOrEqual(12);
      expect(r.y).toBeLessThanOrEqual(360);
      expect(r.name.length).toBeGreaterThan(0);
    }
    expect(new Set(REGIONS.map((r) => r.name)).size).toBe(30);
    for (const a of REGIONS) for (const b of REGIONS) {
      if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(26);
    }
  });

  it('gives fightable regions a base garrison, a cap, and a legal map', () => {
    for (const r of REGIONS.filter((x) => x.kind === 'enemy' || x.kind === 'start')) {
      expect(r.garrison).toBe(RECIPES[r.type].enemies);
      expect(r.maxGarrison).toBe(r.garrison + 5);
      expect(r.variation).toBeGreaterThanOrEqual(0);
      expect(r.variation).toBeLessThanOrEqual(4);
    }
    for (const r of REGIONS.filter((x) => x.kind === 'neutral' || x.kind === 'wild')) {
      expect([r.type, r.variation, r.garrison, r.maxGarrison]).toEqual([0, 0, 0, 0]);
    }
  });

  it('generates every fightable region at its maximum garrison', () => {
    for (const r of REGIONS.filter((x) => x.kind === 'enemy' || x.kind === 'start')) {
      const def = generateMission(r.type, r.variation, missionDifficulty(r, r.maxGarrison));
      const s = createMission(def, 1);
      expect(s.units.filter((u) => u.side === 'enemy').length).toBeGreaterThanOrEqual(r.maxGarrison);
    }
  });

  it('keeps the opening easy', () => {
    for (const l of REGIONS[START_REGION].links) expect(REGIONS[l].type).toBeLessThanOrEqual(2);
  });

  it('maps garrison to the generator difficulty', () => {
    const r = REGIONS[REGIONS[START_REGION].links.find((l) => REGIONS[l].kind === 'enemy')!];
    expect(missionDifficulty(r, r.garrison)).toBe(r.type + 1);
    expect(missionDifficulty(r, r.garrison + 2)).toBe(r.type + 3);
  });
});
