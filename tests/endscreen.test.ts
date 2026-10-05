import { describe, expect, it } from 'vitest';
import { endHit } from '../src/screens/end';

describe('endHit', () => {
  it('finds the New campaign button', () => {
    expect(endHit(240, 252)).toBe('new');
    expect(endHit(175, 240)).toBe('new');
  });

  it('ignores clicks elsewhere', () => {
    expect(endHit(240, 100)).toBeNull();
    expect(endHit(305, 266)).toBeNull(); // just outside the button
    expect(endHit(10, 10)).toBeNull();
  });
});
