import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import type { PlanetArt } from '../src/art/planetimages';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { REGIONS } from '../src/core/world/planet';
import { LastMode, SaveStore, type SaveStorage } from '../src/save';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET } from '../src/screens/planet';
import { PLANET_ART_IDS, EMBLEM_IDS } from '../src/screens/planetart';
import { TITLE } from '../src/screens/title';
import { StoryStore } from '../src/storysave';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const region = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });

function memory(): SaveStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const every: PlanetArt = { image: (id) => ({ id } as unknown as CanvasImageSource) };

function setup(opts: AppOptions = {}) {
  const storage = memory();
  let t = 0;
  const app = new App({
    clock: () => t,
    newSeed: () => 5,
    store: new SaveStore(storage, 3),
    campaignStore: new SaveStore(storage, CAMPAIGN_LENGTH, 'campaign'),
    storyStore: new StoryStore(storage),
    last: new LastMode(storage),
    createMission: () => makeState(corridorRows('PPPP.')),
    scenes: false,
    ...opts,
  });
  const click = (p: { x: number; y: number }) => { t += 500; app.click(p); };
  click(mid(TITLE.story));
  click(mid(DIFFICULTY_SCREEN.calm));
  return { app, click };
}

function draws(app: App): string[] {
  const names: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name: string) => {
      if (name === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      return (...args: unknown[]) => { if (name === 'drawImage') names.push((args[0] as { id: string }).id); };
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  app.draw(ctx, 0);
  return names;
}

describe('the planet screen in the app', () => {
  it('draws the painted layers when the app has art', () => {
    const { app } = setup({ planetArt: every });
    expect(app.screen).toBe('planet');
    const names = draws(app);
    expect(names).toContain('backdrop');
    expect(names.filter((n) => (EMBLEM_IDS as readonly string[]).includes(n))).toHaveLength(REGIONS.length);
    for (const n of names) expect(PLANET_ART_IDS as readonly string[]).toContain(n);
  });

  it('draws no images in tests that pass their own stores and no art', () => {
    const { app } = setup();
    expect(draws(app)).toEqual([]);
  });

  it('still selects a region by clicking its place when art is on', () => {
    const { app, click } = setup({ planetArt: every });
    click(region(1));
    expect((app as unknown as { selectedRegion: number | null }).selectedRegion).toBe(1);
  });

  it('starts with the real art options without throwing, even with no way to decode images', () => {
    expect(() => new App({ clock: () => 0, scenes: false })).not.toThrow();
  });
});
