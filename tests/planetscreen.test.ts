import { describe, expect, it } from 'vitest';
import { CAPITAL_REGION, REGIONS, START_REGION } from '../src/core/world/planet';
import { newWorld } from '../src/core/world/world';
import { DIFFICULTY_SCREEN, difficultyHit, drawDifficulty } from '../src/screens/difficulty';
import { PLANET, actLabel, drawPlanet, planetHit, type PlanetView } from '../src/screens/planet';
import { unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

function collect(draw: (ctx: CanvasRenderingContext2D) => void) {
  const runs: { text: string; x: number; width: number; align: string }[] = [];
  const stop = onText((r) => runs.push(r));
  draw(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D);
  stop();
  return runs;
}

const at = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const view = (selected: number | null, w = newWorld(1, 'calm')): PlanetView => ({ world: w, selected, armedAbandon: false, notice: '' });

describe('planetHit', () => {
  it('hits every region at its own position', () => {
    for (const r of REGIONS) expect(planetHit(at(r.id).x, at(r.id).y)).toEqual({ kind: 'region', id: r.id });
  });

  it('misses empty map and widens with touch slop', () => {
    expect(planetHit(PLANET.map.x + 2, PLANET.map.y + 2)).toBeNull();
    const p = at(START_REGION);
    expect(planetHit(p.x + 14, p.y)).toBeNull();
    expect(planetHit(p.x + 14, p.y, 6)).toEqual({ kind: 'region', id: START_REGION });
  });

  it('never picks a third region between the two closest', () => {
    let best: [number, number] = [0, 1];
    let d = Infinity;
    for (const a of REGIONS) for (const b of REGIONS) {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (a.id < b.id && dist < d) { d = dist; best = [a.id, b.id]; }
    }
    const mid = { x: (at(best[0]).x + at(best[1]).x) / 2, y: (at(best[0]).y + at(best[1]).y) / 2 };
    const hit = planetHit(mid.x, mid.y, 6);
    if (hit) expect(best).toContain((hit as { id: number }).id);
  });

  it('hits the three buttons and keeps them clear of every region', () => {
    expect(planetHit(centre(PLANET.act).x, centre(PLANET.act).y)).toEqual({ kind: 'act' });
    expect(planetHit(centre(PLANET.abandon).x, centre(PLANET.abandon).y)).toEqual({ kind: 'abandon' });
    expect(planetHit(centre(PLANET.back).x, centre(PLANET.back).y)).toEqual({ kind: 'back' });
    for (const r of REGIONS) {
      for (const b of [PLANET.act, PLANET.abandon, PLANET.back]) {
        const p = at(r.id);
        const near = p.x >= b.x - 10 && p.x < b.x + b.w + 10 && p.y >= b.y - 10 && p.y < b.y + b.h + 10;
        expect(near).toBe(false);
      }
    }
  });
});

describe('actLabel', () => {
  it('says what the action button does', () => {
    expect(actLabel(view(null))).toBeNull();
    expect(actLabel(view(START_REGION))).toBeNull();
    expect(actLabel(view(1))).toBe('ATTACK');
    expect(actLabel(view(5))).toBe('VISIT');
    expect(actLabel(view(CAPITAL_REGION))).toBe('LOCKED');
  });
});

describe('difficulty screen', () => {
  it('hits each preset and BACK', () => {
    expect(difficultyHit(centre(DIFFICULTY_SCREEN.calm).x, centre(DIFFICULTY_SCREEN.calm).y)).toBe('calm');
    expect(difficultyHit(centre(DIFFICULTY_SCREEN.standard).x, centre(DIFFICULTY_SCREEN.standard).y)).toBe('standard');
    expect(difficultyHit(centre(DIFFICULTY_SCREEN.pressure).x, centre(DIFFICULTY_SCREEN.pressure).y)).toBe('pressure');
    expect(difficultyHit(centre(DIFFICULTY_SCREEN.back).x, centre(DIFFICULTY_SCREEN.back).y)).toBe('back');
    expect(difficultyHit(1, 1)).toBeNull();
  });
});

describe('drawing', () => {
  it('draws the planet for a new world, a selection and an armed abandon without unsupported characters', () => {
    for (const v of [view(null), view(1), view(5), view(CAPITAL_REGION), { ...view(1), armedAbandon: true, notice: 'Found a clip.' }]) {
      const runs = collect((ctx) => drawPlanet(ctx, v));
      expect(runs.length).toBeGreaterThan(3);
      for (const r of runs) expect(unsupportedChars(r.text), r.text).toEqual([]);
    }
  });

  it('draws every region name through the panel without unsupported characters and inside the panel', () => {
    for (const r of REGIONS) {
      const runs = collect((ctx) => drawPlanet(ctx, view(r.id)));
      for (const run of runs) {
        expect(unsupportedChars(run.text), run.text).toEqual([]);
        if (run.x >= PLANET.panel.x) expect(run.x + run.width).toBeLessThanOrEqual(PLANET.panel.x + PLANET.panel.w);
      }
    }
  });

  it('draws the difficulty screen with all presets', () => {
    const runs = collect((ctx) => drawDifficulty(ctx));
    for (const name of ['CALM', 'STANDARD', 'PRESSURE']) expect(runs.some((r) => r.text.includes(name))).toBe(true);
    for (const r of runs) expect(unsupportedChars(r.text), r.text).toEqual([]);
  });
});
