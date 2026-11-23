import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { CAPITAL_GATES, CAPITAL_REGION, REGIONS, START_REGION } from '../src/core/world/planet';
import { type Holder, type World } from '../src/core/world/world';
import type { GameState } from '../src/core/types';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET, STORY_EQUIPMENT_BACK } from '../src/screens/planet';
import { TITLE } from '../src/screens/title';
import { CAMPAIGN_SAVE_KEY, LAST_KEY, LastMode, SAVE_KEY, SaveStore, type SaveStorage } from '../src/save';
import { STORY_SAVE_KEY, StoryStore } from '../src/storysave';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const region = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const START = { x: 240, y: 345 };
const RESULT_CONTINUE = { x: 240, y: 235 };
const END_BUTTON = { x: 240, y: 253 };

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

type Call = { seed: number; roster: unknown; budget: number; level: unknown; enemyLevel: number | undefined };

function setup(storage = memory(), opts: AppOptions = {}) {
  let t = 0;
  const calls: Call[] = [];
  const app = new App({
    clock: () => t,
    newSeed: () => 5,
    store: new SaveStore(storage, 3),
    campaignStore: new SaveStore(storage, CAMPAIGN_LENGTH, 'campaign'),
    storyStore: new StoryStore(storage),
    last: new LastMode(storage),
    createMission: (_def, seed, roster, _loadout, budget, _stash, level, enemyLevel) => {
      calls.push({ seed, roster, budget, level, enemyLevel });
      return makeState(corridorRows('PPPP.'));
    },
    ...opts,
  });
  const wait = () => { t += 500; };
  const click = (p: { x: number; y: number }) => { wait(); app.click(p); };
  const newStory = (preset: 'calm' | 'standard' | 'pressure' = 'calm') => {
    click(mid(TITLE.story));
    click(mid(DIFFICULTY_SCREEN[preset]));
  };
  /** Selects a region and presses the action button. */
  const act = (id: number) => { click(region(id)); click(mid(PLANET.act)); };
  const finishMission = (status: 'won' | 'lost') => {
    click(START);
    const state: GameState = app.controller!.state;
    if (status === 'won') app.controller!.key('e');
    else {
      for (const u of state.units) if (u.side === 'player') u.alive = false;
      state.status = 'lost';
    }
    app.update(1000);
    app.update(2200);
  };
  return { app, storage, calls, click, newStory, act, finishMission, wait };
}

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});

describe('starting a story', () => {
  it('opens the difficulty screen from STORY, then the planet, and saves', () => {
    const { app, storage, click } = setup();
    expect(app.screen).toBe('title');
    click(mid(TITLE.story));
    expect(app.screen).toBe('difficulty');
    click(mid(DIFFICULTY_SCREEN.standard));
    expect(app.screen).toBe('planet');
    expect(app.story?.difficulty).toBe('standard');
    expect(app.story?.seed).toBe(5);
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(true);
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(storage.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
    expect(storage.data.has(LAST_KEY)).toBe(false);
  });

  it('goes back from the difficulty screen to the title', () => {
    const { app, click } = setup();
    click(mid(TITLE.story));
    click(mid(DIFFICULTY_SCREEN.back));
    expect(app.screen).toBe('title');
    expect(app.story).toBeNull();
  });
});

describe('the planet', () => {
  it('attacks a region: equipment with the story budget, then the mission with split levels', () => {
    const { app, calls, newStory, act, click } = setup();
    newStory();
    act(1);
    expect(app.screen).toBe('equipment');
    click(START);
    expect(app.screen).toBe('mission');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ budget: 128, level: 1, enemyLevel: REGIONS[1].type + 1 });
  });

  it('does nothing when the action is not possible', () => {
    const { app, newStory, act, storage } = setup();
    newStory();
    const before = storage.data.get(STORY_SAVE_KEY);
    act(12); // far from held ground
    act(CAPITAL_REGION); // locked
    act(START_REGION); // already held
    expect(app.screen).toBe('planet');
    expect(storage.data.get(STORY_SAVE_KEY)).toBe(before);
  });

  it('visits a neutral settlement: allied, two days, a notice, saved', () => {
    const { app, newStory, act, storage } = setup();
    newStory();
    act(5);
    expect(app.screen).toBe('planet');
    expect(app.story?.regions[5].holder).toBe('allied');
    expect(app.story?.day).toBe(2);
    expect(JSON.parse(storage.data.get(STORY_SAVE_KEY)!).world.day).toBe(2);
  });

  it('goes back to the title and keeps the save; STORY then continues it', () => {
    const { app, newStory, click, storage } = setup();
    newStory();
    click(mid(PLANET.back));
    expect(app.screen).toBe('title');
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(true);
    click(mid(TITLE.story));
    expect(app.screen).toBe('planet');
  });

  it('needs two presses to abandon, then clears the save and asks for a difficulty', () => {
    const { app, newStory, click, storage } = setup();
    newStory();
    click(mid(PLANET.abandon));
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(true);
    click(mid(PLANET.abandon));
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(false);
    expect(app.screen).toBe('difficulty');
  });
});

describe('changing your mind at the equipment screen', () => {
  it('goes back to the planet with Escape, spending nothing', () => {
    const { app, newStory, act, wait } = setup();
    newStory();
    act(1);
    expect(app.screen).toBe('equipment');
    wait();
    app.key('Escape');
    expect(app.screen).toBe('planet');
    expect(app.story?.day).toBe(0);
    act(1);
    expect(app.screen).toBe('equipment'); // the same region can be attacked again
  });

  it('goes back with the BACK button', () => {
    const { app, newStory, act, click } = setup();
    newStory();
    act(1);
    click(mid(STORY_EQUIPMENT_BACK));
    expect(app.screen).toBe('planet');
    expect(app.story?.day).toBe(0);
  });
});

describe('fighting', () => {
  it('a win takes the region, spends days, saves and returns to the planet', () => {
    const { app, newStory, act, finishMission, click, storage } = setup();
    newStory();
    act(1);
    finishMission('won');
    expect(app.screen).toBe('result');
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('planet');
    expect(app.story?.regions[1].holder).toBe('player');
    expect(app.story?.day).toBe(3);
    expect(JSON.parse(storage.data.get(STORY_SAVE_KEY)!).world.regions[1].holder).toBe('player');
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(storage.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
  });

  it('a wiped squad leaves the region enemy-held and brings four rookies', () => {
    const { app, newStory, act, finishMission, click } = setup();
    newStory();
    act(1);
    finishMission('lost');
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('planet');
    expect(app.story?.regions[1].holder).toBe('enemy');
    expect(app.story?.roster.map((r) => r.name)).toEqual(['Eriksen', 'Fontaine', 'Garcia', 'Haddad']);
    expect(app.story?.day).toBe(9);
  });

  it('taking the capital ends the story and clears the save', () => {
    const { app, newStory, act, finishMission, click, storage } = setup();
    newStory();
    app.story = hold(app.story!, CAPITAL_GATES.slice(0, 2));
    act(CAPITAL_REGION);
    expect(app.screen).toBe('equipment');
    finishMission('won');
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('end');
    expect(app.story?.status).toBe('won');
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(false);
    click(END_BUTTON);
    expect(app.screen).toBe('title');
  });

  it('losing the last region ends the story as a defeat', () => {
    const { app, newStory, act, finishMission, click, storage } = setup();
    newStory();
    app.story = hold(hold(app.story!, [START_REGION], 'enemy'), [5], 'allied');
    act(1);
    finishMission('lost');
    click(RESULT_CONTINUE);
    expect(app.screen).toBe('end');
    expect(app.story?.status).toBe('lost');
    expect(storage.data.has(STORY_SAVE_KEY)).toBe(false);
  });
});

describe('reloading', () => {
  it('shows STORY as continuable and resumes the same world', () => {
    const storage = memory();
    const first = setup(storage);
    first.newStory();
    first.act(5);
    const second = setup(storage);
    second.click(mid(TITLE.story));
    expect(second.app.screen).toBe('planet');
    expect(second.app.story?.day).toBe(2);
    expect(second.app.story?.regions[5].holder).toBe('allied');
  });

  it('treats a corrupt story save as no save and does not throw', () => {
    const storage = memory();
    storage.setItem(STORY_SAVE_KEY, '{"version":1,"world":{"nonsense":true}}');
    const { app, click } = setup(storage);
    expect(() => click(mid(TITLE.story))).not.toThrow();
    expect(app.screen).toBe('difficulty');
  });
});

describe('the other modes', () => {
  it('still start a campaign after a story without carrying the story over', () => {
    const { app, newStory, click } = setup();
    newStory();
    click(mid(PLANET.back));
    click(mid(TITLE.campaign));
    expect(app.screen).toBe('equipment');
    expect(app.story).toBeNull();
    expect(app.campaign.mode).toBe('campaign');
  });
});
