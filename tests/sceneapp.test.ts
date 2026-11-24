import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { CAPITAL_GATES, CAPITAL_REGION, REGIONS } from '../src/core/world/planet';
import { SCENES } from '../src/core/world/story';
import { type Holder, type World } from '../src/core/world/world';
import { CAMPAIGN_SAVE_KEY, LastMode, SaveStore, type SaveStorage } from '../src/save';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET } from '../src/screens/planet';
import { SCENE } from '../src/screens/scene';
import { SQUAD } from '../src/screens/squad';
import { TITLE } from '../src/screens/title';
import { StoryStore } from '../src/storysave';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const region = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const START = { x: 240, y: 345 };
const RESULT_CONTINUE = { x: 240, y: 235 };
const NEXT = { x: 10, y: 10 };

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function setup(storage = memory(), opts: AppOptions = {}) {
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
  const press = (k: string) => { t += 500; return app.key(k); };
  const newStory = () => {
    click(mid(TITLE.story));
    click(mid(DIFFICULTY_SCREEN.calm));
  };
  const playing = () => (app as unknown as { scenePlay: { scene: { id: string }; phase: string; index: number } | null }).scenePlay;
  /** Clicks through scenes (taking option 1 at a choice) until the screen is no longer a scene; returns the ids shown. */
  const drain = (): string[] => {
    const ids: string[] = [];
    for (let guard = 0; guard < 60 && app.screen === 'scene'; guard++) {
      const p = playing()!;
      if (ids[ids.length - 1] !== p.scene.id) ids.push(p.scene.id);
      click(p.phase === 'choice' ? mid(SCENE.choices[1]) : NEXT);
    }
    return ids;
  };
  return { app, storage, click, press, newStory, playing, drain };
}

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});
const ALL_BUT = (...keep: string[]) => SCENES.map((s) => s.id).filter((id) => !keep.includes(id));

describe('scenes in the app', () => {
  it('shows the landing on a new story, advances by click, saves it as seen, and does not replay on reload', () => {
    const { app, storage, click, newStory, playing } = setup();
    newStory();
    expect(app.screen).toBe('scene');
    expect(playing()?.scene.id).toBe('landing');
    click(NEXT);
    expect(playing()?.index).toBe(1);
    click(NEXT);
    click(NEXT);
    click(NEXT);
    expect(app.screen).toBe('planet');
    expect(app.story?.seen).toEqual(['landing']);
    const again = setup(storage);
    again.click(mid(TITLE.story));
    expect(again.app.screen).toBe('planet');
    expect(again.app.story?.seen).toEqual(['landing']);
  });

  it('Space and Enter advance a line, Escape skips a plain scene', () => {
    const { app, press, newStory, playing } = setup();
    newStory();
    expect(press(' ')).toBe(true);
    expect(playing()?.index).toBe(1);
    expect(press('Enter')).toBe(true);
    expect(playing()?.index).toBe(2);
    press('Escape');
    expect(app.screen).toBe('planet');
    expect(app.story?.seen).toContain('landing');
  });

  it('never enters the scene screen when scenes are off', () => {
    const { app, newStory } = setup(memory(), { scenes: false });
    newStory();
    expect(app.screen).toBe('planet');
    expect(app.story?.seen).toEqual([]);
  });

  it('shows first-blood after the first won fight, then the planet', () => {
    const { app, click, newStory, drain } = setup();
    newStory();
    drain();
    click(region(1));
    click(mid(PLANET.act));
    click(mid(SQUAD.start));
    click(START);
    app.controller!.key('e');
    app.update(1000);
    app.update(2200);
    expect(app.screen).toBe('result');
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('scene');
    expect(drain()).toEqual(['first-blood']);
    expect(app.screen).toBe('planet');
  });

  it('Escape on a choice scene shows the choice and never makes it; picking applies, saves and replies', () => {
    const { app, storage, click, press, newStory, drain, playing } = setup();
    newStory();
    drain();
    const w = hold(app.story!, [1, 2, 4, 6, 7]);
    app.story = { ...w, day: 20, seen: ALL_BUT('offer') };
    click(region(5));
    click(mid(PLANET.act));
    expect(app.screen).toBe('scene');
    expect(playing()?.scene.id).toBe('offer');
    press('Escape');
    expect(app.screen).toBe('scene');
    expect(playing()?.phase).toBe('choice');
    expect(app.story?.seen).not.toContain('offer');
    const before = app.story!.credits;
    click(mid(SCENE.choices[0]));
    expect(app.story?.chosen).toEqual({ offer: 0 });
    expect(app.story!.credits).toBeGreaterThanOrEqual(before + 60);
    expect(playing()?.phase).toBe('reply');
    click(NEXT);
    expect(app.screen).toBe('planet');
    const again = setup(storage);
    again.click(mid(TITLE.story));
    expect(again.app.screen).toBe('planet');
    expect(again.app.story?.chosen).toEqual({ offer: 0 });
    expect(again.app.story?.seen).toContain('offer');
  });

  it('shows at most 3 scenes per stop and the rest at the next one', () => {
    const { app, click, newStory, drain } = setup();
    newStory();
    drain();
    const w = hold(app.story!, [1, 2, 4, 6, 7]);
    app.story = {
      ...w, day: 20, seen: [], fallen: [{ name: 'Brandt', kills: 0, trained: 0 }],
      soldiers: w.soldiers.filter((s) => s.name !== 'Brandt'), squad: ['Alvarez', 'Chen', 'Dubois'], namesUsed: 5,
    };
    click(region(5));
    click(mid(PLANET.act));
    expect(drain()).toHaveLength(3);
    expect(app.screen).toBe('planet');
    const left = app.story!.seen.length;
    // another stop: a visit to the wild region 3
    app.story = hold(app.story!, [2]);
    click(region(3));
    click(mid(PLANET.act));
    expect(drain().length).toBeGreaterThan(0);
    expect(app.story!.seen.length).toBeGreaterThan(left);
  });

  it('plays the victory scene before the end screen when the capital falls', () => {
    const { app, click, newStory, drain } = setup();
    newStory();
    drain();
    app.story = { ...hold(app.story!, CAPITAL_GATES.slice(0, 2)), seen: ALL_BUT('victory', 'defeat') };
    click(region(CAPITAL_REGION));
    click(mid(PLANET.act));
    click(mid(SQUAD.start));
    click(START);
    app.controller!.key('e');
    app.update(1000);
    app.update(2200);
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('scene');
    expect(drain()).toEqual(['victory']);
    expect(app.screen).toBe('end');
  });

  it('leaves the campaign save alone', () => {
    const { storage, newStory, drain } = setup();
    newStory();
    drain();
    expect(storage.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
  });
});
