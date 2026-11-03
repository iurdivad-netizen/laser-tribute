import { describe, expect, it } from 'vitest';
import {
  FAR_DARK, GLOW_PEAK, LIGHT_REACH, REMEMBERED_DARK, darknessGrid, drawLight, glowGrid, lightFalloff, shadeFloor, tileNoise,
} from '../src/render/lighting';
import { computeVisible } from '../src/core/vision';
import { corridorRows, makeState } from './helpers';

const recorder = () => {
  const fills: { style: string; x: number; y: number; w: number; h: number }[] = [];
  let style = '';
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === 'fillStyle' ? style : k === 'fillRect'
      ? (x: number, y: number, w: number, h: number) => fills.push({ style, x, y, w, h })
      : () => ({ width: 0 })),
    set: (_t, k, v) => { if (k === 'fillStyle') style = String(v); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
};

describe('light falloff', () => {
  it('is dark-free beside a soldier and settles at the far level, never past it', () => {
    expect(lightFalloff(0)).toBe(0);
    expect(lightFalloff(LIGHT_REACH)).toBeCloseTo(FAR_DARK, 10);
    expect(lightFalloff(LIGHT_REACH * 3)).toBeCloseTo(FAR_DARK, 10);
  });

  it('never gets lighter as the distance grows', () => {
    let last = -1;
    for (let d = 0; d <= LIGHT_REACH + 2; d += 0.25) {
      const v = lightFalloff(d);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe('darkness and glow grids', () => {
  const lit = () => {
    const s = makeState(corridorRows('P........'));
    s.explored = s.explored.map((row) => row.map(() => true));
    return { s, visible: computeVisible(s, 'player') };
  };

  it('a tile in sight next to the soldier is bright and a far one is darker', () => {
    const { s, visible } = lit();
    const d = darknessGrid(s, visible);
    const y = s.units[0].pos.y;
    const x0 = s.units[0].pos.x;
    expect(d[y][x0 + 1]).toBeLessThan(d[y][x0 + 7]);
    expect(d[y][x0 + 7]).toBeLessThanOrEqual(FAR_DARK);
  });

  it('a tile seen before but out of sight is the remembered dark', () => {
    const { s, visible } = lit();
    visible[1][3] = false;
    expect(darknessGrid(s, visible)[1][3]).toBe(REMEMBERED_DARK);
  });

  it('the glow is strongest at the soldier, fades out, and is nothing out of sight', () => {
    const { s, visible } = lit();
    const g = glowGrid(s, visible);
    const { x, y } = s.units[0].pos;
    expect(g[y][x]).toBeCloseTo(GLOW_PEAK, 10);
    expect(g[y][x + 3]).toBeLessThan(g[y][x + 1]);
    visible[y][x + 2] = false;
    expect(glowGrid(s, visible)[y][x + 2]).toBe(0);
  });
});

describe('floor shading', () => {
  it('the same tile always gets the same speckle, in [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const n = tileNoise(i, i * 3);
      expect(n).toBe(tileNoise(i, i * 3));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('a floor tile under a wall gets a shadow along its top, and one in the open gets none', () => {
    const s = makeState(['#####', '#...#', '#...#', '#####']);
    const under = recorder();
    shadeFloor(under.ctx, s, 2, 1);
    expect(under.fills.some((f) => f.x === 32 && f.y === 16 && f.w === 16 && f.h === 2)).toBe(true);
    const open = recorder();
    shadeFloor(open.ctx, s, 2, 2); // the wall is at its south: only the faint bottom edge
    expect(open.fills.some((f) => f.y === 32 && f.w === 16 && f.h === 2 && f.style === 'rgba(0,0,0,0.34)')).toBe(false);
  });
});

describe('drawLight without a canvas', () => {
  it('paints unexplored tiles solid black and does not throw', () => {
    const s = makeState(corridorRows('P....'));
    const visible = computeVisible(s, 'player');
    s.explored = s.explored.map((row) => row.map(() => false));
    const r = recorder();
    expect(() => drawLight(r.ctx, s, visible)).not.toThrow();
    expect(r.fills.filter((f) => f.style === '#000' && f.w === s.width * 16 && f.h === 16)).toHaveLength(s.height);
  });
});
