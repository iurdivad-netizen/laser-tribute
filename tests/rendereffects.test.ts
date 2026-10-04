import { describe, expect, it } from 'vitest';
import { Effects } from '../src/render/effects';

describe('Effects', () => {
  it('starts a moving unit one tile behind and settles at zero', () => {
    const fx = new Effects();
    fx.add([{ type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }], 1000);
    const start = fx.unitOffset('p1', 1000);
    expect(start.x).toBeCloseTo(-16);
    expect(start.y).toBeCloseTo(0);
    expect(fx.unitOffset('p1', 1500)).toEqual({ x: 0, y: 0 });
  });

  it('reports no offset for units that are not moving', () => {
    const fx = new Effects();
    expect(fx.unitOffset('p1', 0)).toEqual({ x: 0, y: 0 });
  });
});
