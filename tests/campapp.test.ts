import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import type { Art } from '../src/art/planetimages';
import { CAMP_ART_IDS, type CampArtId } from '../src/screens/campart';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { LastMode, SaveStore, type SaveStorage } from '../src/save';
import { BUILDINGS } from '../src/screens/base';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET } from '../src/screens/planet';
import { TITLE } from '../src/screens/title';
import { StoryStore } from '../src/storysave';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function memory(): SaveStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
const every: Art<CampArtId> = { image: (id) => ({ id } as unknown as CanvasImageSource) };

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
    ...opts,
  });
  const click = (p: { x: number; y: number }) => { t += 500; app.click(p); };
  const press = (k: string) => { t += 500; app.key(k); };
  click(mid(TITLE.story));
  click(mid(DIFFICULTY_SCREEN.calm));
  return { app, click, press };
}

function drawn(app: App): string[] {
  const names: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, name: string) => (...args: unknown[]) => { if (name === 'drawImage') names.push((args[0] as { id: string }).id); },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  app.draw(ctx, 0);
  return names;
}
const building = (id: string) => mid(BUILDINGS.find((b) => b.id === id)!);

describe('the camp and faces in the app', () => {
  it('draws the painted camp on the base screen when the app has art', () => {
    const { app, click } = setup({ campArt: every, scenes: false });
    click(mid(PLANET.base));
    expect(app.screen).toBe('base');
    const names = drawn(app);
    expect(names).toContain('camp_backdrop');
    expect(names).toContain('lab_idle');
    for (const n of names) expect(CAMP_ART_IDS as readonly string[]).toContain(n);
  });

  it('draws the small faces in the barracks list', () => {
    const { app, click } = setup({ campArt: every, scenes: false });
    click(mid(PLANET.base));
    click(building('barracks'));
    expect(app.screen).toBe('panel');
    expect(drawn(app)).toEqual(['face_alvarez_s', 'face_brandt_s', 'face_chen_s', 'face_dubois_s']);
  });

  it('draws the speaker\'s face in a story scene', () => {
    const { app } = setup({ campArt: every });
    expect(app.screen).toBe('scene');
    expect(drawn(app)).toEqual(['face_alvarez']);
  });

  it('still opens the lab by its painted building and returns by the gate', () => {
    const { app, click } = setup({ campArt: every, scenes: false });
    click(mid(PLANET.base));
    click(building('lab'));
    expect(app.screen).toBe('panel');
    const empty = setup({ campArt: every, scenes: false });
    empty.click(mid(PLANET.base));
    empty.click({ x: 10, y: 395 }); // empty ground on the base: nothing happens
    expect(empty.app.screen).toBe('base');
    const back = setup({ campArt: every, scenes: false });
    back.click(mid(PLANET.base));
    back.click(building('planet'));
    expect(back.app.screen).toBe('planet');
  });

  it('draws no images in tests that pass their own stores and no art', () => {
    const { app, click } = setup({ scenes: false });
    click(mid(PLANET.base));
    expect(drawn(app)).toEqual([]);
    click(building('barracks'));
    expect(drawn(app)).toEqual([]);
  });

  it('starts with the real art options without throwing', () => {
    expect(() => new App({ clock: () => 0, scenes: false })).not.toThrow();
  });
});
