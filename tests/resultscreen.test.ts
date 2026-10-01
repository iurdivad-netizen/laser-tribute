import { describe, expect, it } from 'vitest';
import { resultHit } from '../src/screens/result';

describe('resultHit', () => {
  it('finds the Play again button', () => {
    expect(resultHit(240, 213)).toBe('again');
    expect(resultHit(190, 200)).toBe('again');
  });

  it('ignores clicks elsewhere on the card or screen', () => {
    expect(resultHit(240, 100)).toBeNull();
    expect(resultHit(10, 10)).toBeNull();
    expect(resultHit(290, 226)).toBeNull(); // just outside the button
  });
});
