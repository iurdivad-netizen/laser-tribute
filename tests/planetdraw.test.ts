import { describe, expect, it } from 'vitest';
import { NO_ART, type PlanetArt } from '../src/art/planetimages';
import { CAPITAL_REGION, REGIONS } from '../src/core/world/planet';
import { newWorld, type Holder, type World } from '../src/core/world/world';
import { PLANET, drawPlanet } from '../src/screens/planet';
import { EMBLEM_IDS, FOOTPRINT, PLANET_ART_IDS, regionLook, type PlanetArtId } from '../src/screens/planetart';
import { UI } from '../src/ui/frame';
import { onText } from '../src/ui/text';

interface Call { name: string; args: unknown[]; fill: string }

/** A context that records every call with the fill colour at the time, and hands back a recording gradient. */
function recorder() {
  const calls: Call[] = [];
  const stops: string[][] = [];
  const state: Record<string, unknown> = { fillStyle: '' };
  const ctx = new Proxy({}, {
    get: (_t, name: string) => {
      if (name in state) return state[name];
      if (name === 'createRadialGradient') {
        return (...args: unknown[]) => {
          calls.push({ name, args, fill: String(state.fillStyle) });
          const list: string[] = [];
          stops.push(list);
          return { addColorStop: (_o: number, c: string) => list.push(c) };
        };
      }
      return (...args: unknown[]) => { calls.push({ name, args, fill: String(state.fillStyle) }); };
    },
    set: (_t, name: string, value) => { state[name] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, stops };
}

const artWith = (ids: readonly PlanetArtId[]): PlanetArt => ({
  image: (id) => (ids.includes(id) ? ({ id } as unknown as CanvasImageSource) : null),
});
const ALL = artWith(PLANET_ART_IDS);
const fresh = () => newWorld(1, 'calm');
const view = (world: World, selected: number | null = null) => ({ world, selected, armedAbandon: false, notice: '' });
const where = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const images = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');
const idOf = (c: Call) => (c.args[0] as { id: string }).id;
const COLOURS: string[] = [UI.red, UI.green, UI.blue, UI.accent, UI.dim];
const squares = (calls: Call[]) =>
  calls.filter((c) => c.name === 'fillRect' && (c.args[2] === 9 || c.args[2] === 13) && c.args[2] === c.args[3] && COLOURS.includes(c.fill));

describe('the plain map (no art)', () => {
  it('draws no images, one square per region, and no tint', () => {
    const { ctx, calls } = recorder();
    drawPlanet(ctx, view(fresh()), NO_ART);
    expect(images(calls)).toHaveLength(0);
    expect(calls.filter((c) => c.name === 'createRadialGradient')).toHaveLength(0);
    expect(squares(calls)).toHaveLength(REGIONS.length);
  });

  it('works with every enemy region held and with the default art argument', () => {
    const w = fresh();
    const taken = { ...w, regions: w.regions.map((r, i) => (REGIONS[i].kind === 'enemy' ? { ...r, holder: 'player' as Holder } : r)) };
    expect(() => drawPlanet(recorder().ctx, view(taken, 3))).not.toThrow();
  });
});

describe('the painted map', () => {
  it('draws the backdrop once, an emblem per region and a stamp per stamped region, and no squares', () => {
    const w = fresh();
    const { ctx, calls } = recorder();
    drawPlanet(ctx, view(w), ALL);
    const drawn = images(calls);
    const back = drawn.filter((c) => idOf(c) === 'backdrop');
    expect(back).toHaveLength(1);
    expect(back[0].args.slice(1)).toEqual([PLANET.map.x, PLANET.map.y, PLANET.map.w, PLANET.map.h]);
    expect(drawn.filter((c) => (EMBLEM_IDS as readonly string[]).includes(idOf(c)))).toHaveLength(REGIONS.length);
    const stamped = REGIONS.filter((r) => regionLook(w, r.id).stamp !== null).length;
    expect(drawn.filter((c) => idOf(c).startsWith('stamp_'))).toHaveLength(stamped);
    expect(squares(calls)).toHaveLength(0);
  });

  it('centres each emblem on its place at its footprint', () => {
    const w = fresh();
    const { ctx, calls } = recorder();
    drawPlanet(ctx, view(w), ALL);
    const emblems = images(calls).filter((c) => (EMBLEM_IDS as readonly string[]).includes(idOf(c)));
    for (const r of REGIONS) {
      const look = regionLook(w, r.id);
      const f = FOOTPRINT[look.emblem];
      const p = where(r.id);
      const found = emblems.some((c) => idOf(c) === look.emblem && c.args[1] === p.x - f / 2 && c.args[2] === p.y - f / 2 && c.args[3] === f && c.args[4] === f);
      expect(found, r.name).toBe(true);
    }
  });

  it('falls back to a square for an emblem that is missing, and keeps the backdrop', () => {
    const { ctx, calls } = recorder();
    drawPlanet(ctx, view(fresh()), artWith(['backdrop']));
    expect(images(calls)).toHaveLength(1);
    expect(squares(calls)).toHaveLength(REGIONS.length);
  });

  it('tints every place that is not wild, in its owner colour', () => {
    const w = fresh();
    const { ctx, stops } = recorder();
    drawPlanet(ctx, view(w), ALL);
    const nonWild = REGIONS.filter((r) => r.kind !== 'wild');
    expect(stops).toHaveLength(nonWild.length);
    const expected = nonWild.map((r) => hex(regionLook(w, r.id).tint).join(',')).sort();
    const got = stops.map((s) => (s[0].match(/\d+/g) ?? []).slice(0, 3).join(',')).sort();
    expect(got).toEqual(expected);
  });

  it('clips everything painted to the map rectangle, before the first image', () => {
    const { ctx, calls } = recorder();
    drawPlanet(ctx, view(fresh()), ALL);
    const names = calls.map((c) => c.name);
    const clip = names.indexOf('clip');
    expect(clip).toBeGreaterThan(-1);
    expect(clip).toBeLessThan(names.indexOf('drawImage'));
    const rect = calls.slice(0, clip).filter((c) => c.name === 'rect').pop();
    expect(rect?.args).toEqual([PLANET.map.x, PLANET.map.y, PLANET.map.w, PLANET.map.h]);
    expect(names.lastIndexOf('restore')).toBeGreaterThan(names.lastIndexOf('drawImage'));
  });

  it('sizes the selection frame to the emblem', () => {
    const w = fresh();
    const { ctx, calls } = recorder();
    drawPlanet(ctx, view(w, CAPITAL_REGION), ALL);
    const p = where(CAPITAL_REGION);
    const f = FOOTPRINT[regionLook(w, CAPITAL_REGION).emblem] + 6;
    const stroke = calls.filter((c) => c.name === 'strokeRect').pop();
    expect(stroke?.args).toEqual([p.x - f / 2, p.y - f / 2, f, f]);
  });

  it('keeps the panel text the same whatever art is there', () => {
    const text = (art: PlanetArt) => {
      const out: string[] = [];
      const stop = onText((r) => out.push(r.text));
      drawPlanet(recorder().ctx, view(fresh(), 1), art);
      stop();
      return out;
    };
    expect(text(ALL)).toEqual(text(NO_ART));
  });
});
