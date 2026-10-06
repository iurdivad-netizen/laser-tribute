import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, drawVariations, generateMission } from '../src/core/gen';
import { checkMission, expectFor } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';

describe('constants', () => {
  it('has ten missions with five variations each', () => {
    expect(CAMPAIGN_LENGTH).toBe(10);
    expect(VARIATIONS).toBe(5);
  });
});

describe.each(RECIPES.map((r, i) => [r.name, i] as const))('generated %s', (_name, type) => {
  const r = RECIPES[type];

  it.each([0, 1, 2, 3, 4])('variation %i is playable, the right size, and the same every time', (v) => {
    const def = generateMission(type, v);
    expect(checkMission(def, expectFor(r))).toEqual([]);
    expect(def.rows).toHaveLength(r.height);
    expect(def.rows[0]).toHaveLength(r.width);
    expect(def.id).toBe(r.id);
    expect(generateMission(type, v)).toEqual(def);
  });

  it('has five different layouts', () => {
    const layouts = [0, 1, 2, 3, 4].map((v) => generateMission(type, v).rows.join('\n'));
    expect(new Set(layouts).size).toBe(5);
  });
});

describe('generateMission arguments', () => {
  it('rejects a type or variation out of range', () => {
    expect(() => generateMission(-1, 0)).toThrow(RangeError);
    expect(() => generateMission(10, 0)).toThrow(RangeError);
    expect(() => generateMission(0, 5)).toThrow(RangeError);
    expect(() => generateMission(0, 1.5)).toThrow(RangeError);
  });

  it('difficulty changes the enemy count and the map still passes the check', () => {
    const harder = generateMission(2, 0, 6); // type 2 is difficulty 3; +3 enemies
    const want = expectFor(RECIPES[2], RECIPES[2].enemies + 3);
    expect(checkMission(harder, want)).toEqual([]);
    const easy = generateMission(9, 0, 1); // 12 - 9 = 3 enemies
    expect(checkMission(easy, expectFor(RECIPES[9], 3))).toEqual([]);
  });
});

describe('drawVariations', () => {
  it('gives ten numbers from 0 to 4, the same for a seed', () => {
    const v = drawVariations(123);
    expect(v).toHaveLength(10);
    for (const n of v) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
    expect(drawVariations(123)).toEqual(v);
  });

  it('differs between seeds and uses every variation across many seeds', () => {
    const seen = new Set<number>();
    const lists = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const v = drawVariations(s);
      lists.add(v.join(','));
      v.forEach((n) => seen.add(n));
    }
    expect(lists.size).toBeGreaterThan(30);
    expect(seen.size).toBe(5);
  });
});
