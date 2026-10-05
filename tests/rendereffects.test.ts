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

  it('a heal shows a green flash on the healed tile', () => {
    const fx = new Effects();
    fx.add([{ type: 'healed', unitId: 'p1', targetId: 'p2', amount: 25, at: { x: 3, y: 2 } }], 1000);
    const frames = fx.frames(1100);
    expect(frames.some((f) => f.type === 'rect' && f.x === 48 && f.y === 32 && f.color === '100,255,140')).toBe(true);
  });
});
