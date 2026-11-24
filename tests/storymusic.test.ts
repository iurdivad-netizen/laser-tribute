import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import type { Mood } from '../src/audio/music';
import type { SoundPlayer } from '../src/audio/sound';
import type { StingerName } from '../src/audio/effects';
import { CAPITAL_GATES, CAPITAL_REGION, REGIONS } from '../src/core/world/planet';
import { SCENES } from '../src/core/world/story';
import { type Holder, type World } from '../src/core/world/world';
import { LastMode, SaveStore, type SaveStorage } from '../src/save';
import { BUILDINGS } from '../src/screens/base';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PANEL } from '../src/screens/basepanels';
import { PLANET } from '../src/screens/planet';
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

function memory(): SaveStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** A sound player that records the moods it is given and the stingers it is asked for. */
function recorder(withStinger = true) {
  const moods: Mood[] = [];
  const stingers: StingerName[] = [];
  const sound: SoundPlayer = {
    play() {}, unlock() {}, toggleMute: () => '', changeVolume: () => '', muted: false, volume: 1,
    setMood: (m) => { moods.push(m); },
    ...(withStinger ? { stinger: (n: StingerName) => { stingers.push(n); } } : {}),
  };
  return { sound, moods, stingers };
}

function setup(opts: AppOptions = {}, withStinger = true) {
  const storage = memory();
  const rec = recorder(withStinger);
  let t = 0;
  const app = new App({
    clock: () => t,
    newSeed: () => 5,
    store: new SaveStore(storage, 3),
    campaignStore: new SaveStore(storage, CAMPAIGN_LENGTH, 'campaign'),
    storyStore: new StoryStore(storage),
    last: new LastMode(storage),
    createMission: () => makeState(corridorRows('PPPP.')),
    sound: rec.sound,
    scenes: false,
    ...opts,
  });
  const click = (p: { x: number; y: number }) => { t += 500; app.click(p); app.update(t); };
  const press = (k: string) => { t += 500; app.key(k); app.update(t); };
  const last = () => rec.moods[rec.moods.length - 1];
  const finish = (status: 'won' | 'lost') => {
    click(START);
    const state = app.controller!.state;
    if (status === 'won') app.controller!.key('e');
    else {
      for (const u of state.units) if (u.side === 'player') u.alive = false;
      state.status = 'lost';
    }
    app.update(1000);
    app.update(2200);
  };
  return { app, ...rec, click, press, last, finish };
}

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});
const ALL_BUT = (...keep: string[]) => SCENES.map((s) => s.id).filter((id) => !keep.includes(id));

describe('the story chooses its music', () => {
  it('gives the planet theme to the difficulty screen and the map, and the base theme to the base side', () => {
    const { app, click, press, last } = setup();
    click(mid(TITLE.story));
    expect(last()).toBe('planet');
    click(mid(DIFFICULTY_SCREEN.calm));
    expect(app.screen).toBe('planet');
    expect(last()).toBe('planet');
    click(mid(PLANET.base));
    expect(last()).toBe('base');
    click(mid(BUILDINGS.find((b) => b.id === 'barracks')!));
    expect(app.screen).toBe('panel');
    expect(last()).toBe('base');
    press('Escape');
    press('Escape');
    expect(app.screen).toBe('planet');
    expect(last()).toBe('planet');
  });

  it('prepares a fight with the base theme, plays the mission as calm, and returns to the planet theme', () => {
    const { app, click, last, finish } = setup();
    click(mid(TITLE.story));
    click(mid(DIFFICULTY_SCREEN.calm));
    click(region(1));
    click(mid(PLANET.act));
    expect(app.screen).toBe('squad');
    expect(last()).toBe('base');
    click(mid(SQUAD.start));
    expect(app.screen).toBe('equipment');
    expect(last()).toBe('base');
    finish('won');
    expect(app.screen).toBe('result');
    expect(last()).toBe('calm');
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('planet');
    expect(last()).toBe('planet');
  });

  it('never gives the Tutorial the planet or base theme', () => {
    const { app, moods } = setup({ skipTitle: true });
    app.update(1000);
    app.update(2000);
    expect(app.screen).toBe('equipment');
    expect(moods).not.toContain('planet');
    expect(moods).not.toContain('base');
  });

  it('never changes the music for a scene', () => {
    const { app, click, last } = setup({ scenes: true });
    click(mid(TITLE.story));
    click(mid(DIFFICULTY_SCREEN.calm));
    expect(app.screen).toBe('scene');
    expect(last()).toBe('planet'); // the landing scene came up over the planet theme
    for (let i = 0; i < 8 && app.screen === 'scene'; i++) click(NEXT);
    expect(app.screen).toBe('planet');
    // a scene opened from the base side keeps the base theme
    app.story = { ...app.story!, seen: ALL_BUT('landing') };
    click(mid(PLANET.base));
    click(mid(BUILDINGS.find((b) => b.id === 'wait')!));
    click(mid(PANEL.rows[0]));
    click(mid(PANEL.act));
    expect(app.screen).toBe('scene');
    expect(last()).toBe('base');
  });
});

describe('the story endings play their stinger', () => {
  const toCapital = (s: ReturnType<typeof setup>) => {
    s.click(mid(TITLE.story));
    s.click(mid(DIFFICULTY_SCREEN.calm));
    s.app.story = { ...hold(s.app.story!, CAPITAL_GATES.slice(0, 2)), seen: ALL_BUT('victory', 'defeat') };
    s.click(region(CAPITAL_REGION));
    s.click(mid(PLANET.act));
    s.click(mid(SQUAD.start));
  };

  it('plays the victory stinger once, when the victory scene starts, and ends on the planet theme', () => {
    const s = setup({ scenes: true });
    s.click(mid(TITLE.story));
    s.click(mid(DIFFICULTY_SCREEN.calm));
    for (let i = 0; i < 8 && s.app.screen === 'scene'; i++) s.click(NEXT); // the landing scene
    s.stingers.length = 0;
    s.app.story = { ...hold(s.app.story!, CAPITAL_GATES.slice(0, 2)), seen: ALL_BUT('victory', 'defeat') };
    s.click(region(CAPITAL_REGION));
    s.click(mid(PLANET.act));
    s.click(mid(SQUAD.start));
    s.finish('won');
    expect(s.stingers).toEqual([]);
    s.click(RESULT_CONTINUE);
    expect(s.app.screen).toBe('scene');
    expect(s.stingers).toEqual(['victory']);
    for (let i = 0; i < 6 && s.app.screen === 'scene'; i++) s.click(NEXT);
    expect(s.app.screen).toBe('end');
    s.app.update(99999);
    expect(s.stingers).toEqual(['victory']);
    expect(s.last()).toBe('planet');
  });

  it('plays the defeat stinger when the planet is lost', () => {
    const s = setup({ scenes: true });
    s.click(mid(TITLE.story));
    s.click(mid(DIFFICULTY_SCREEN.calm));
    for (let i = 0; i < 8 && s.app.screen === 'scene'; i++) s.click(NEXT);
    s.stingers.length = 0;
    // the landing point has fallen and one friendly village is left: losing a fight there ends the story
    s.app.story = { ...hold(hold(s.app.story!, [0], 'enemy'), [5], 'allied'), seen: ALL_BUT('defeat', 'victory') };
    s.click(region(1));
    s.click(mid(PLANET.act));
    s.click(mid(SQUAD.start));
    s.finish('lost');
    s.click(RESULT_CONTINUE);
    expect(s.app.screen).toBe('scene');
    expect(s.stingers).toEqual(['defeat']);
  });

  it('plays no stinger for an ordinary scene, or when scenes are off', () => {
    const on = setup({ scenes: true });
    on.click(mid(TITLE.story));
    on.click(mid(DIFFICULTY_SCREEN.calm));
    expect(on.app.screen).toBe('scene'); // the landing
    expect(on.stingers).toEqual([]);
    const off = setup({ scenes: false });
    toCapital(off);
    off.finish('won');
    off.click(RESULT_CONTINUE);
    expect(off.app.screen).toBe('end');
    expect(off.stingers).toEqual([]);
  });

  it('works with a sound player that has no stinger method', () => {
    const s = setup({ scenes: true }, false);
    s.click(mid(TITLE.story));
    s.click(mid(DIFFICULTY_SCREEN.calm));
    for (let i = 0; i < 8 && s.app.screen === 'scene'; i++) s.click(NEXT);
    s.app.story = { ...hold(s.app.story!, CAPITAL_GATES.slice(0, 2)), seen: ALL_BUT('victory', 'defeat') };
    s.click(region(CAPITAL_REGION));
    s.click(mid(PLANET.act));
    s.click(mid(SQUAD.start));
    s.finish('won');
    expect(() => s.click(RESULT_CONTINUE)).not.toThrow();
    expect(s.app.screen).toBe('scene');
  });
});
