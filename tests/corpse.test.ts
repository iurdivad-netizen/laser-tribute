import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { bodyFigure, type Figure } from '../src/art/figure';
import { POOL_COLOUR, corpseLook, corpsePose, rotateCCW, rotateCW } from '../src/art/corpse';
import { imageOf } from '../src/art/image';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { corridorRows, makeState } from './helpers';

const FLOOR = '#34353a';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const opaque = (f: Figure) => f.pixels.filter((p) => p !== null).length;

/** A dead enemy in a corridor, `before` floor tiles to its west and `after` to its east. */
function dead(before: number, after: number, id = 'e1') {
  const s = makeState(corridorRows('.'.repeat(before) + 'E' + '.'.repeat(after)));
  const u = s.units[0];
  u.id = id;
  u.alive = false;
  return { s, u };
}

describe('rotating a figure', () => {
  const f = bodyFigure('squad', 's');
  it('turns 16x32 into 32x16 and keeps every pixel', () => {
    for (const r of [rotateCW(f), rotateCCW(f)]) {
      expect([r.width, r.height]).toEqual([32, 16]);
      expect(opaque(r)).toBe(opaque(f));
    }
  });

  it('moves each pixel to the place a quarter turn gives it', () => {
    const n = f.pixels.findIndex((p) => p !== null);
    const [x, y] = [n % 16, Math.floor(n / 16)];
    expect(rotateCW(f).pixels[x * 32 + (31 - y)]).toBe(f.pixels[n]); // the top of the figure ends at the right
    expect(rotateCCW(f).pixels[(15 - x) * 32 + y]).toBe(f.pixels[n]); // and at the left the other way
  });

  it('is reversible', () => {
    expect(rotateCCW(rotateCW(f)).pixels).toEqual(f.pixels);
    expect(rotateCW(rotateCCW(f)).pixels).toEqual(f.pixels);
  });
});

describe('the lying poses', () => {
  for (const side of ['squad', 'enemy'] as const) {
    it(`give ten different 32x16 poses for the ${side}`, () => {
      const poses = Array.from({ length: 10 }, (_, i) => corpsePose(side, i));
      for (const p of poses) expect([p.width, p.height]).toEqual([32, 16]);
      expect(new Set(poses.map((p) => p.name)).size).toBe(10);
      expect(new Set(poses.map((p) => p.pixels.join('|'))).size).toBe(10);
      expect(corpsePose(side, 3)).toBe(corpsePose(side, 3));
    });
  }

  it('show the soldier a little darker than alive, with a pool wider than the body behind him', () => {
    const src = bodyFigure('squad', 's').pixels.find((p) => p !== null)!;
    const dim = '#' + [1, 3, 5].map((i) => Math.round(parseInt(src.slice(i, i + 2), 16) * 0.8).toString(16).padStart(2, '0')).join('');
    const pose = corpsePose('squad', 0);
    expect(pose.pixels).toContain(dim);
    expect(pose.pixels.filter((p) => p === POOL_COLOUR.base).length).toBeGreaterThan(30);
    expect(pose.pixels.filter((p) => p === POOL_COLOUR.light).length).toBeGreaterThan(0);
  });

  it('use a blood colour that stands out from the floor, in the poses and the one-tile fallback alike', () => {
    expect(contrast(POOL_COLOUR.base, FLOOR)).toBeGreaterThanOrEqual(1.8);
    for (const name of ['corpse_player', 'corpse_enemy'] as const) expect(imageOf(name).pixels).toContain(POOL_COLOUR.base);
  });
});

describe('corpseLook', () => {
  it('is the same every time for a unit, and different units get different poses', () => {
    const { s, u } = dead(4, 4);
    expect(corpseLook(s, u)).toEqual(corpseLook(s, u));
    const names = new Set<string>();
    for (let i = 0; i < 60; i++) names.add(corpseLook(s, { ...u, id: `e${i}` }).image.name);
    expect(names.size).toBeGreaterThanOrEqual(8);
  });

  it('lies over a free neighbour: the west one or the east one', () => {
    const sides = new Set<number>();
    const { s, u } = dead(4, 4);
    for (let i = 0; i < 40; i++) {
      const look = corpseLook(s, { ...u, id: `e${i}` });
      expect(look.image.width).toBe(32);
      sides.add(look.extend);
    }
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it('turns to the other side when the preferred one is a wall', () => {
    for (let i = 0; i < 20; i++) {
      expect(corpseLook(dead(0, 4, `e${i}`).s, dead(0, 4, `e${i}`).u).extend).toBe(1);
      expect(corpseLook(dead(4, 0, `e${i}`).s, dead(4, 0, `e${i}`).u).extend).toBe(-1);
    }
  });

  it('falls back to the one-tile corpse between two walls, beside a door, or over an item', () => {
    const one = dead(0, 0);
    expect(corpseLook(one.s, one.u)).toEqual({ image: imageOf('corpse_enemy'), extend: 0 });
    const door = dead(0, 2);
    door.s.tiles[1][door.u.pos.x + 1].kind = 'door';
    expect(corpseLook(door.s, door.u).extend).toBe(0);
    const east = dead(0, 2);
    east.s.items.push({ id: 'i1', pos: { x: east.u.pos.x + 1, y: 1 }, kind: 'rifle' });
    expect(corpseLook(east.s, east.u).extend).toBe(0);
    const own = dead(3, 3);
    own.s.items.push({ id: 'i1', pos: { ...own.u.pos }, kind: 'rifle' });
    expect(corpseLook(own.s, own.u).image.name).toBe('corpse_enemy'); // a pickup under the body must stay visible
  });

  it('gives the squad its own colours', () => {
    const { s, u } = dead(4, 4);
    u.side = 'player';
    expect(corpseLook(s, u).image.name).toMatch(/^corpse_player/);
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

function drawCorpseHalves(s: ReturnType<typeof makeState>) {
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const drawn: { name: string; x: number; y: number }[] = [];
  const real = atlas.drawImage.bind(atlas);
  atlas.drawImage = (c, fig, x, y, opts = {}) => {
    if (fig.name.startsWith('corpse_')) drawn.push({ name: fig.name, x, y });
    return real(c, fig, x, y, opts);
  };
  drawGame(ctx, s, createUiState('p1'), new Effects(), 0, atlas);
  return drawn;
}

describe('drawing a lying corpse', () => {
  function seen(id: string) {
    const s = makeState(corridorRows('P' + '.'.repeat(18)));
    const u = { ...s.units[0], id, side: 'enemy' as const, alive: false, pos: { x: 6, y: 1 } };
    s.units.push(u);
    s.explored = s.explored.map((row) => row.map(() => true));
    return { s, u };
  }

  it('draws two 16x16 halves over two neighbouring tiles', () => {
    const { s, u } = seen('e1');
    const look = corpseLook(s, u);
    expect(look.extend).not.toBe(0);
    const drawn = drawCorpseHalves(s);
    expect(drawn).toHaveLength(2);
    const x0 = (u.pos.x + Math.min(0, look.extend)) * 16;
    expect(drawn.map((d) => d.x).sort((a, b) => a - b)).toEqual([x0, x0 + 16]);
    expect(new Set(drawn.map((d) => d.y))).toEqual(new Set([16]));
  });

  it('draws the whole corpse as one image when it lies on one tile', () => {
    const { s, u } = seen('e1');
    s.items.push({ id: 'i9', pos: { ...u.pos }, kind: 'rifle' });
    expect(drawCorpseHalves(s).map((d) => d.name)).toEqual(['corpse_enemy']);
  });

  it('does not draw the half over a tile the player has not explored', () => {
    for (let i = 0; i < 12; i++) {
      const { s, u } = seen(`e${i}`);
      const look = corpseLook(s, u);
      if (look.extend === 0) continue;
      s.explored[1][u.pos.x + look.extend] = false;
      const drawn = drawCorpseHalves(s);
      expect(drawn.map((d) => d.x / 16)).toEqual([u.pos.x]);
    }
  });
});
