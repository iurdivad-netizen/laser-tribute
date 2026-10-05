import { describe, expect, it } from 'vitest';
import { Effects } from '../src/render/effects';

const T = 16;
const sprites = (fx: Effects, now: number) => fx.frames(now).filter((d) => d.type === 'sprite');
const names = (fx: Effects, now: number) => sprites(fx, now).map((d) => (d as { name: string }).name);

describe('shot effects', () => {
  const shot = (hit: boolean) => ({
    type: 'shot' as const, unitId: 'p1', targetId: 'e1', mode: 'snap' as const, hit, crit: false, damage: hit ? 30 : 0,
    from: { x: 2, y: 3 }, impact: { x: 6, y: 3 },
  });

  it('a shot flashes at the muzzle, half a tile out towards the target, in two frames', () => {
    const fx = new Effects();
    fx.add([shot(true)], 0);
    const first = sprites(fx, 10)[0] as { name: string; x: number; y: number };
    expect(first.name).toBe('flash_0');
    expect(first).toMatchObject({ x: 2 * T + 8, y: 3 * T });
    expect(names(fx, 70)).toContain('flash_1');
    expect(names(fx, 200)).not.toContain('flash_0');
    expect(names(fx, 200)).not.toContain('flash_1');
  });

  it('a hit shows a spark on the target that fades; a miss shows none', () => {
    const hit = new Effects();
    hit.add([shot(true)], 0);
    const spark = sprites(hit, 100).find((d) => (d as { name: string }).name === 'spark') as { x: number; y: number; alpha: number };
    expect(spark).toMatchObject({ x: 6 * T, y: 3 * T });
    expect(spark.alpha).toBeGreaterThan(0);
    expect(spark.alpha).toBeLessThanOrEqual(1);
    const miss = new Effects();
    miss.add([shot(false)], 0);
    expect(names(miss, 100)).not.toContain('spark');
  });

  it('the old tracer line is still drawn for the life of the shot, and gone afterwards', () => {
    const fx = new Effects();
    fx.add([shot(true)], 0);
    expect(fx.frames(50).some((d) => d.type === 'line')).toBe(true);
    expect(fx.frames(1000).some((d) => d.type === 'line')).toBe(false);
  });
});

describe('stab, death, grenade and reload effects', () => {
  it('a stab slashes the target in two frames and sparks on a hit', () => {
    const fx = new Effects();
    fx.add([{ type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } }], 0);
    expect(names(fx, 10)).toContain('slash_0');
    expect(names(fx, 150)).toContain('slash_1');
    expect(names(fx, 100)).toContain('spark');
    expect(fx.frames(5000)).toEqual([]);
  });

  it('a death splashes blood and fades out', () => {
    const fx = new Effects();
    fx.add([{ type: 'died', unitId: 'e1', at: { x: 4, y: 4 } }], 0);
    const splash = sprites(fx, 100)[0] as { name: string; x: number; y: number; alpha: number };
    expect(splash).toMatchObject({ name: 'splash', x: 4 * T, y: 4 * T });
    const early = (sprites(fx, 50)[0] as { alpha: number }).alpha;
    const late = (sprites(fx, 400)[0] as { alpha: number }).alpha;
    expect(late).toBeLessThan(early);
    expect(fx.frames(5000)).toEqual([]);
  });

  it('a grenade is a four-frame explosion, three tiles wide, centred on the blast', () => {
    const fx = new Effects();
    fx.add([{ type: 'grenade', unitId: 'p1', at: { x: 10, y: 5 }, hits: [], doorsDestroyed: [] }], 0);
    const seen = new Set<string>();
    for (let t = 0; t < 450; t += 10) {
      for (const d of sprites(fx, t)) {
        const s = d as { name: string; x: number; y: number; scale: number };
        seen.add(s.name);
        expect(s).toMatchObject({ x: 9 * T, y: 4 * T, scale: 3 });
      }
    }
    expect([...seen].sort()).toEqual(['boom_0', 'boom_1', 'boom_2', 'boom_3']);
    expect(fx.frames(5000)).toEqual([]);
  });

  it('the reload flash is still a rectangle that fades', () => {
    const fx = new Effects();
    fx.add([{ type: 'reloaded', unitId: 'p1', ammo: 5, at: { x: 1, y: 1 } }], 0);
    const rect = fx.frames(50).find((d) => d.type === 'rect') as { x: number; y: number; alpha: number };
    expect(rect).toMatchObject({ x: T, y: T });
    expect(rect.alpha).toBeLessThan(1);
  });

  it('never picks a frame outside the animation, at any moment of its life', () => {
    const fx = new Effects();
    fx.add([
      { type: 'grenade', unitId: 'p1', at: { x: 3, y: 3 }, hits: [], doorsDestroyed: [] },
      { type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } },
    ], 0);
    const allowed = new Set(['boom_0', 'boom_1', 'boom_2', 'boom_3', 'slash_0', 'slash_1', 'spark']);
    for (let t = -50; t < 600; t += 1) {
      for (const d of sprites(fx, t)) expect(allowed.has((d as { name: string }).name)).toBe(true);
    }
  });
});

describe('drawing the frames', () => {
  it('stamps sprites through the atlas with their scale and resets the alpha afterwards', () => {
    const fx = new Effects();
    fx.add([{ type: 'grenade', unitId: 'p1', at: { x: 3, y: 3 }, hits: [], doorsDestroyed: [] }], 0);
    const drawn: unknown[][] = [];
    const art = { draw: (...a: unknown[]) => { drawn.push(a); return true; } };
    const alphas: number[] = [];
    const ctx = {
      set globalAlpha(v: number) { alphas.push(v); },
      fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      set fillStyle(_v: string) {}, set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
    } as unknown as CanvasRenderingContext2D;
    fx.draw(ctx, 50, art as never);
    expect(drawn).toHaveLength(1);
    expect(drawn[0][1]).toBe('boom_0');
    expect(drawn[0][4]).toEqual({ scale: 3 });
    expect(alphas[alphas.length - 1]).toBe(1);
  });

  it('draws nothing for sprites when no atlas is given, and does not throw', () => {
    const fx = new Effects();
    fx.add([{ type: 'died', unitId: 'e1', at: { x: 4, y: 4 } }], 0);
    const ctx = { fillRect() {}, set globalAlpha(_v: number) {} } as unknown as CanvasRenderingContext2D;
    expect(() => fx.draw(ctx, 50)).not.toThrow();
  });
});
