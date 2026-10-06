import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/core/rng';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('gives different sequences for different seeds', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays in [0, 1) and moves on every call', () => {
    const r = seededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(990);
  });
});
