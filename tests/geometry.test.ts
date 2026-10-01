import { describe, expect, it } from 'vitest';
import { chebyshev, distance, facingFromDelta, posEq, turnSteps } from '../src/core/geometry';

describe('geometry', () => {
  it('maps a movement delta to a facing', () => {
    expect(facingFromDelta(0, -1)).toBe(0);
    expect(facingFromDelta(1, -1)).toBe(1);
    expect(facingFromDelta(5, 0)).toBe(2);
    expect(facingFromDelta(1, 1)).toBe(3);
    expect(facingFromDelta(0, 3)).toBe(4);
    expect(facingFromDelta(-1, 1)).toBe(5);
    expect(facingFromDelta(-3, 0)).toBe(6);
    expect(facingFromDelta(-1, -1)).toBe(7);
  });

  it('counts the 45 degree steps needed to turn', () => {
    expect(turnSteps(0, 0)).toBe(0);
    expect(turnSteps(0, 1)).toBe(1);
    expect(turnSteps(0, 7)).toBe(1);
    expect(turnSteps(0, 2)).toBe(2);
    expect(turnSteps(0, 4)).toBe(4);
    expect(turnSteps(2, 6)).toBe(4);
    expect(turnSteps(1, 3)).toBe(2);
  });

  it('measures distances', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
    expect(posEq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(posEq({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
});
