import { describe, expect, it } from 'vitest';
import { nextRandom } from '../src/core/rng';
import type { GameState } from '../src/core/types';

const fresh = (seed: number) => ({ rngState: seed }) as GameState;

describe('nextRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = fresh(42);
    const b = fresh(42);
    const seqA = [nextRandom(a), nextRandom(a), nextRandom(a)];
    const seqB = [nextRandom(b), nextRandom(b), nextRandom(b)];
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(nextRandom(fresh(1))).not.toBe(nextRandom(fresh(2)));
  });

  it('stays in [0, 1)', () => {
    const s = fresh(7);
    for (let i = 0; i < 1000; i++) {
      const n = nextRandom(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
