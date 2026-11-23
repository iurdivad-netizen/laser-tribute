import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { defaultLoadout } from '../src/core/loadout';
import { BASE_RULES, NODES } from '../src/core/world/base';
import { REGIONS } from '../src/core/world/planet';
import { attackable, newWorld } from '../src/core/world/world';
import type { GameState } from '../src/core/types';
import { BUILDINGS, type BuildingId } from '../src/screens/base';
import { PANEL } from '../src/screens/basepanels';
import { DIFFICULTY_SCREEN } from '../src/screens/difficulty';
import { PLANET } from '../src/screens/planet';
import { SQUAD } from '../src/screens/squad';
import { TITLE } from '../src/screens/title';
import { LastMode, SaveStore, type SaveStorage } from '../src/save';
import { STORY_SAVE_KEY, StoryStore } from '../src/storysave';
import { corridorRows, makeState } from './helpers';

const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const region = (id: number) => ({ x: PLANET.map.x + REGIONS[id].x, y: PLANET.map.y + REGIONS[id].y });
const START = { x: 240, y: 345 };
const RESULT_CONTINUE = { x: 240, y: 235 };

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

type Call = { roster: { name: string }[]; budget: number; level: any };

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
    createMission: (_def, _seed, roster, _loadout, budget, _stash, level) => {
      calls.push({ roster, budget, level });
      return makeState(corridorRows('PPPP.'));
    },
    ...opts,
  });
  const click = (p: { x: number; y: number }) => { t += 500; app.click(p); };
  const key = (k: string) => { t += 500; app.key(k); };
  const newStory = (preset: 'calm' | 'standard' | 'pressure' = 'calm') => {
    click(mid(TITLE.story));
    click(mid(DIFFICULTY_SCREEN[preset]));
  };
  const openBase = () => click(mid(PLANET.base));
  const openPanel = (id: BuildingId) => click(mid(BUILDINGS.find((b) => b.id === id)!));
  const row = (i: number) => click(mid(PANEL.rows[i]));
  const panelAct = () => click(mid(PANEL.act));
  /** Selects a region, attacks it, picks the default squad and arrives at equipment. */
  const attack = (id: number) => {
    click(region(id));
    click(mid(PLANET.act));
    click(mid(SQUAD.start));
  };
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
  return { app, storage, calls, click, key, newStory, openBase, openPanel, row, panelAct, attack, finishMission };
}

describe('the base hub', () => {
  it('opens from the planet and goes back', () => {
    const { app, newStory, openBase, openPanel } = setup();
    newStory();
    openBase();
    expect(app.screen).toBe('base');
    openPanel('planet');
    expect(app.screen).toBe('planet');
  });

  it('opens a panel from a tile and goes back to the hub with BACK and Escape', () => {
    const { app, newStory, openBase, openPanel, click, key } = setup();
    newStory();
    openBase();
    openPanel('lab');
    expect(app.screen).toBe('panel');
    click(mid(PANEL.back));
    expect(app.screen).toBe('base');
    openPanel('market');
    key('Escape');
    expect(app.screen).toBe('base');
    key('Escape');
    expect(app.screen).toBe('planet');
  });
});

describe('research', () => {
  it('starts a project, pays for it and finishes it as days pass through the planet', () => {
    const { app, newStory, openBase, openPanel, row, panelAct, click, attack, finishMission } = setup();
    newStory();
    openBase();
    openPanel('lab');
    row(0); // shotgun
    panelAct();
    expect(app.story?.credits).toBe(150 - 40);
    expect(app.story?.research.active).toEqual({ node: 'shotgun', daysLeft: 4 });
    click(mid(PANEL.back));
    openPanel('planet');
    attack(attackable(app.story!)[0]);
    finishMission('won');
    click(RESULT_CONTINUE);
    expect(app.story?.research.active?.daysLeft).toBe(1);
    attack(attackable(app.story!)[0]);
    finishMission('won');
    click(RESULT_CONTINUE);
    expect(app.story?.research.done).toContain('shotgun');
    expect(app.story?.research.active).toBeNull();
  });

  it('offers a researched weapon to the equipment rules', () => {
    const { app, calls, newStory, attack, click } = setup();
    newStory();
    app.story = { ...app.story!, research: { done: ['shotgun'], active: null } };
    attack(attackable(app.story)[0]);
    click(START);
    expect(calls[0].level.unlocks.weapons).toContain('shotgun');
    expect(calls[0].level.premium).toBe(BASE_RULES.premium);
  });
});

describe('the barracks', () => {
  it('hires a rookie for credits', () => {
    const { app, newStory, openBase, openPanel, panelAct } = setup();
    newStory();
    openBase();
    openPanel('barracks');
    panelAct();
    expect(app.story?.soldiers).toHaveLength(5);
    expect(app.story?.credits).toBe(150 - BASE_RULES.hireCost);
  });

  it('sends a soldier to train and fields a loaned mercenary in his place', () => {
    const { app, calls, newStory, openBase, openPanel, row, panelAct, click, attack } = setup();
    newStory();
    app.story = { ...app.story!, research: { done: ['training1'], active: null } };
    openBase();
    openPanel('training');
    row(0);
    panelAct();
    expect(app.story?.soldiers[0].status).toBe('training');
    click(mid(PANEL.back));
    openPanel('planet');
    attack(attackable(app.story!)[0]);
    click(START);
    expect(calls[0].roster.map((r) => r.name)).toEqual(['Brandt', 'Chen', 'Dubois', 'Loan 1']);
  });

  it('lets the squad be changed before equipment', () => {
    const { app, calls, newStory, click } = setup();
    newStory();
    app.story = { ...app.story!, soldiers: [...app.story!.soldiers, { name: 'Eriksen', kills: 9, trained: 0, status: 'ready', daysLeft: 0 }] };
    click(region(attackable(app.story)[0]));
    click(mid(PLANET.act));
    expect(app.screen).toBe('squad');
    click(mid(SQUAD.rows[0])); // drop Alvarez
    click(mid(SQUAD.rows[4])); // add Eriksen
    click(mid(SQUAD.start));
    expect(app.screen).toBe('equipment');
    click(START);
    expect(calls[0].roster.map((r) => r.name)).toEqual(['Brandt', 'Chen', 'Dubois', 'Eriksen']);
  });

  it('goes back from the squad step and from equipment', () => {
    const { app, newStory, click, key } = setup();
    newStory();
    click(region(attackable(app.story!)[0]));
    click(mid(PLANET.act));
    expect(app.screen).toBe('squad');
    click(mid(SQUAD.start));
    expect(app.screen).toBe('equipment');
    key('Escape');
    expect(app.screen).toBe('squad');
    click(mid(SQUAD.back));
    expect(app.screen).toBe('planet');
    expect(app.story?.day).toBe(0);
  });
});

describe('time and fights', () => {
  it('waits three days and pays the income', () => {
    const { app, newStory, openBase, openPanel, row, panelAct } = setup();
    newStory();
    openBase();
    openPanel('wait');
    row(1);
    panelAct();
    expect(app.story?.day).toBe(3);
    expect(app.story?.credits).toBe(150 + 3 * 4);
  });

  it('keeps credits non-negative and still starts a fight after a wiped squad', () => {
    const { app, calls, newStory, attack, finishMission, click } = setup();
    newStory();
    attack(attackable(app.story!)[0]);
    finishMission('lost');
    click(RESULT_CONTINUE);
    expect(app.story?.soldiers).toEqual([]);
    expect(app.story?.credits).toBeGreaterThanOrEqual(0);
    attack(attackable(app.story!)[0]);
    click(START);
    expect(app.screen).toBe('mission');
    expect(calls[1].roster.map((r) => r.name)).toEqual(['Loan 1', 'Loan 2', 'Loan 3', 'Loan 4']);
  });
});

describe('saving and old saves', () => {
  it('keeps research, the pool and credits across a reload', () => {
    const storage = memory();
    const first = setup(storage);
    first.newStory();
    first.openBase();
    first.openPanel('barracks');
    first.panelAct();
    const second = setup(storage);
    second.click(mid(TITLE.story));
    expect(second.app.screen).toBe('planet');
    expect(second.app.story?.soldiers).toHaveLength(5);
    expect(second.app.story?.credits).toBe(110);
  });

  it('continues a project 1 save', () => {
    const storage = memory();
    const w = newWorld(7, 'standard');
    const { credits: _c, research: _r, soldiers, squad: _s, ...rest } = w;
    storage.setItem(STORY_SAVE_KEY, JSON.stringify({
      version: 1, world: { ...rest, roster: soldiers.map((s) => ({ name: s.name, kills: s.kills })) }, loadout: defaultLoadout(),
    }));
    const { app, click } = setup(storage);
    click(mid(TITLE.story));
    expect(app.screen).toBe('planet');
    expect(app.story?.soldiers.map((s) => s.name)).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(app.story?.credits).toBe(BASE_RULES.startCredits);
    expect(NODES.length).toBe(22);
  });
});
