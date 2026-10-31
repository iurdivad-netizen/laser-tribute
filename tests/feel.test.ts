import { describe, expect, it } from 'vitest';
import { Effects, FEEL } from '../src/render/effects';
import type { GameEvent } from '../src/core/types';

const T = 16;
const shot = (over: Partial<Extract<GameEvent, { type: 'shot' }>> = {}): GameEvent => ({
  type: 'shot', unitId: 'p1', targetId: 'e1', mode: 'snap', hit: true, crit: false, damage: 30,
  from: { x: 2, y: 3 }, impact: { x: 6, y: 3 }, ...over,
});
const died: GameEvent = { type: 'died', unitId: 'e1', at: { x: 6, y: 3 } };
const texts = (fx: Effects, now: number) =>
  fx.frames(now).filter((d) => d.type === 'text') as { text: string; y: number; colour: string; alpha: number; scale: number }[];
const sideOf = (id: string) => (id.startsWith('p') ? ('player' as const) : ('enemy' as const));

describe('damage numbers', () => {
  it('a hit floats its damage above the target and rises as it ages', () => {
    const fx = new Effects();
    fx.add([shot()], 0, { sideOf });
    const early = texts(fx, 10)[0];
    const late = texts(fx, 400)[0];
    expect(early.text).toBe('30');
    expect(late.y).toBeLessThan(early.y);
    expect(texts(fx, 800)).toHaveLength(0);
  });

  it('is gold on an enemy, red on a soldier, grey MISS for a miss', () => {
    const fx = new Effects();
    fx.add([shot({ targetId: 'e1' })], 0, { sideOf });
    fx.add([shot({ unitId: 'e1', targetId: 'p1' })], 0, { sideOf });
    fx.add([shot({ hit: false, damage: 0 })], 0, { sideOf });
    const t = texts(fx, 10);
    expect(t.map((d) => d.colour)).toEqual(['#ffe14d', '#ff6b6b', '#9aa0b5']);
    expect(t[2].text).toBe('MISS');
  });

  it('a crit is drawn larger, and fades out at the end', () => {
    const fx = new Effects();
    fx.add([shot({ crit: true })], 0, { sideOf });
    expect(texts(fx, 10)[0].scale).toBe(2);
    expect(texts(fx, 90 + 690)[0].alpha).toBeLessThan(0.2); // 90 ms of crit freeze come first
  });

  it('shows nothing, shakes nothing and freezes nothing for what the player cannot see', () => {
    const fx = new Effects();
    fx.add([shot({ crit: true }), died], 0, { seen: [false, false] });
    expect(texts(fx, 10)).toHaveLength(0);
    expect(fx.shakeOffset(10)).toEqual({ x: 0, y: 0 });
  });
});

describe('screen shake', () => {
  it('a plain hit does not shake; a grenade does, then it settles by itself', () => {
    const fx = new Effects();
    fx.add([shot()], 0);
    expect(fx.shakeOffset(5)).toEqual({ x: 0, y: 0 });
    fx.add([{ type: 'grenade', kind: 'frag', at: { x: 5, y: 5 } } as unknown as GameEvent], 1000);
    const moved = [1010, 1030, 1050, 1070, 1090, 1110].some((t) => {
      const o = fx.shakeOffset(t);
      return o.x !== 0 || o.y !== 0;
    });
    expect(moved).toBe(true);
    expect(fx.shakeOffset(2000)).toEqual({ x: 0, y: 0 });
  });

  it('is whole pixels and never above the maximum', () => {
    const fx = new Effects();
    fx.addTrauma(0, 5);
    for (let t = 0; t < 400; t += 7) {
      const o = fx.shakeOffset(t);
      expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(8);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(8);
    }
  });

  it('reduced motion turns shake and hit-stop off but keeps the numbers', () => {
    const fx = new Effects();
    fx.reducedMotion = true;
    fx.add([shot({ crit: true }), died], 0, { sideOf });
    expect(fx.shakeOffset(10)).toEqual({ x: 0, y: 0 });
    expect(texts(fx, 10)).toHaveLength(1);
    expect(texts(fx, 700 + 5)).toHaveLength(0); // no freeze added to its life
  });
});

describe('hit-stop', () => {
  it('a kill holds every running effect for its freeze time, then they carry on', () => {
    const fx = new Effects();
    fx.add([shot()], 0, { sideOf });
    const before = texts(fx, 100)[0].y;
    fx.add([died], 100);
    const hold = FEEL.kill.freeze;
    expect(texts(fx, 100 + hold - 1)[0].y).toBe(before);
    expect(texts(fx, 100 + hold + 100)[0].y).toBeLessThan(before);
    expect(texts(fx, 700 + hold - 5)).toHaveLength(1);
    expect(texts(fx, 700 + hold + 5)).toHaveLength(0);
  });

  it('freezes do not stack: two kills at once freeze for the longer one only', () => {
    const fx = new Effects();
    fx.add([shot()], 0, { sideOf });
    fx.add([died, died], 100);
    expect(texts(fx, 700 + FEEL.kill.freeze - 5)).toHaveLength(1);
    expect(texts(fx, 700 + FEEL.kill.freeze + 5)).toHaveLength(0);
  });

  it('a unit stops sliding while the world is frozen', () => {
    const fx = new Effects();
    fx.add([{ type: 'moved', unitId: 'e1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }], 0);
    fx.hitStop(60, 80);
    expect(fx.unitOffset('e1', 60)).toEqual(fx.unitOffset('e1', 130));
  });

  it('is capped, so a long freeze can never lock the game', () => {
    const fx = new Effects();
    fx.add([shot()], 0, { sideOf });
    fx.hitStop(100, 10_000);
    expect(texts(fx, 700 + 125)).toHaveLength(0);
  });

  it('active() is true while anything is playing and false once it is all over', () => {
    const fx = new Effects();
    expect(fx.active(0)).toBe(false);
    fx.add([shot({ crit: true }), died], 0, { sideOf });
    expect(fx.active(100)).toBe(true);
    expect(fx.active(5000)).toBe(false);
  });
});

describe('eased moves', () => {
  const step = (x: number) => ({ type: 'moved' as const, unitId: 'e1', from: { x, y: 1 }, to: { x: x + 1, y: 1 } });

  it('a lone step eases out: it is past half way at half time', () => {
    const fx = new Effects();
    fx.add([step(1)], 0);
    expect(Math.abs(fx.unitOffset('e1', 60).x) / T).toBeLessThan(0.5);
  });

  it('steps of one walk stay linear: the second step is half way at half time', () => {
    const fx = new Effects();
    fx.add([step(1)], 0);
    fx.add([step(2)], 130);
    expect(Math.abs(fx.unitOffset('e1', 130 + 60).x) / T).toBeCloseTo(0.5, 5);
  });

  it('starts at the old tile and ends on the new one', () => {
    const fx = new Effects();
    fx.add([step(1)], 0);
    expect(fx.unitOffset('e1', 0).x).toBeCloseTo(-T, 5);
    expect(fx.unitOffset('e1', 121)).toEqual({ x: 0, y: 0 });
  });
});
