import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { newCampaign } from '../src/core/campaign';
import { CAMPAIGN_LENGTH, drawVariations } from '../src/core/gen';
import { defaultLoadout } from '../src/core/loadout';
import {
  CAMPAIGN_SAVE_KEY, LAST_KEY, LastMode, SAVE_KEY, SaveStore, type SaveStorage,
} from '../src/save';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState } from './helpers';

const CONTINUE = { x: 240, y: 144 };
const CAMPAIGN = { x: 240, y: 184 };
const TUTORIAL = { x: 240, y: 224 };
const START = { x: 240, y: 345 };
const RESULT_CONTINUE = { x: 240, y: 235 };

const winTiny = (): GameState => makeState(corridorRows('P..'));

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
    last: new LastMode(storage),
    ...opts,
  });
  return { app, storage, wait: () => { t += 500; } };
}

/** From the equipment screen: start, win with no enemies, and press Continue on the result card. */
function winMission(app: App, wait: () => void): void {
  wait();
  app.click(START);
  app.controller!.key('e');
  app.update(1000);
  app.update(2200);
  wait();
  app.click(RESULT_CONTINUE);
  wait();
}

const campaignSave = (index: number) => ({ ...newCampaign('campaign', drawVariations(5)), missionIndex: index, missionsWon: index });

describe('start-up', () => {
  it('shows the title with no continue when there is no save', () => {
    const { app } = setup();
    expect(app.screen).toBe('title');
    app.click(CONTINUE); // nothing there
    expect(app.screen).toBe('title');
  });

  it('skipTitle goes straight to the tutorial equipment screen when there is no save', () => {
    const { app } = setup(memory(), { skipTitle: true });
    expect(app.screen).toBe('equipment');
    expect(app.campaign.mode).toBe('tutorial');
  });

  it('skipTitle does not hide a real save', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    expect(setup(mem, { skipTitle: true }).app.screen).toBe('title');
  });

  it('TUTORIAL starts the hand-drawn tutorial, NEW CAMPAIGN a generated one', () => {
    const t = setup();
    t.app.click(TUTORIAL);
    expect(t.app.screen).toBe('equipment');
    expect(t.app.campaign.mode).toBe('tutorial');
    const c = setup();
    c.app.click(CAMPAIGN);
    expect(c.app.screen).toBe('equipment');
    expect(c.app.campaign.mode).toBe('campaign');
    expect(c.app.campaign.variations).toEqual(drawVariations(5));
  });

  it('the keys N, T and Enter do the same as the buttons', () => {
    const n = setup();
    n.app.key('n');
    expect(n.app.campaign.mode).toBe('campaign');
    const t = setup();
    t.app.key('T');
    expect(t.app.campaign.mode).toBe('tutorial');
    expect(t.app.screen).toBe('equipment');
    const e = setup();
    e.app.key('Enter'); // no save: nothing happens
    expect(e.app.screen).toBe('title');
  });
});

describe('a campaign mission', () => {
  it('is the generated Outpost for mission 1: 30x20 with 4 enemies', () => {
    const { app, wait } = setup();
    app.click(CAMPAIGN);
    wait();
    app.click(START);
    const s = app.controller!.state;
    expect([s.width, s.height]).toEqual([30, 20]);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(4);
  });

  it('mission 10 is the 48x32 Citadel with 12 enemies, and the camera stays inside it', () => {
    const mem = memory();
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(9), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CONTINUE);
    wait();
    app.click(START);
    const s = app.controller!.state;
    expect([s.width, s.height]).toEqual([48, 32]);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(12);
    expect(app.camera.cx).toBeGreaterThanOrEqual(0);
    expect(app.camera.cx).toBeLessThanOrEqual(48);
    expect(app.camera.cy).toBeGreaterThanOrEqual(0);
    expect(app.camera.cy).toBeLessThanOrEqual(32);
  });

  it('winning the tenth mission ends the campaign as won and clears its save', () => {
    const mem = memory();
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(9), defaultLoadout());
    const { app, wait } = setup(mem, { createMission: winTiny });
    app.click(CONTINUE);
    winMission(app, wait);
    expect(app.screen).toBe('end');
    expect(app.campaign.status).toBe('won');
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
  });

  it('winning mission 1 saves to the campaign slot only and remembers the mode', () => {
    const { app, wait, storage } = setup(memory(), { createMission: winTiny });
    app.click(CAMPAIGN);
    winMission(app, wait);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
    expect(storage.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);
    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(storage.data.get(LAST_KEY)).toBe('campaign');
  });
});

describe('two slots', () => {
  it('a tutorial save and a campaign save live side by side, and CONTINUE resumes the last played', () => {
    const mem = memory();
    const first = setup(mem, { createMission: winTiny });
    first.app.click(TUTORIAL);
    winMission(first.app, first.wait);
    const second = setup(mem, { createMission: winTiny });
    second.app.click(CAMPAIGN); // no campaign save yet: starts at once even though a tutorial save exists
    expect(second.app.campaign.mode).toBe('campaign');
    winMission(second.app, second.wait);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);

    const reloaded = setup(mem);
    expect(reloaded.app.screen).toBe('title');
    reloaded.app.click(CONTINUE);
    expect(reloaded.app.campaign.mode).toBe('campaign'); // played last
    expect(JSON.parse(mem.data.get(SAVE_KEY)!).campaign.missionIndex).toBe(1); // tutorial slot untouched
  });

  it('CONTINUE falls back to the other slot when the last-played mode has no save', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    mem.setItem(LAST_KEY, 'campaign'); // but there is no campaign save
    const { app } = setup(mem);
    app.click(CONTINUE);
    expect(app.campaign.mode).toBe('tutorial');
    expect(app.campaign.missionIndex).toBe(1);
  });

  it('an old save with no mode loads as the tutorial', () => {
    const mem = memory();
    const old: Record<string, unknown> = { ...newCampaign(), missionIndex: 1, missionsWon: 1 };
    delete old.mode;
    delete old.variations;
    mem.setItem(SAVE_KEY, JSON.stringify({ version: 1, campaign: old, loadout: defaultLoadout() }));
    const { app } = setup(mem);
    expect(app.screen).toBe('title');
    app.click(CONTINUE);
    expect(app.campaign.mode).toBe('tutorial');
    expect(app.campaign.missionIndex).toBe(1);
  });

  it('a corrupt campaign slot is ignored and the tutorial save still continues', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    mem.setItem(CAMPAIGN_SAVE_KEY, '{broken');
    const { app } = setup(mem);
    app.click(CONTINUE);
    expect(app.campaign.mode).toBe('tutorial');
  });

  it('NEW CAMPAIGN over a campaign save needs a second press, which replaces only that slot', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(3), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CAMPAIGN);
    expect(app.screen).toBe('title'); // armed
    wait();
    app.click(CAMPAIGN);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
  });

  it('pressing the other button disarms, and TUTORIAL over no tutorial save starts at once', () => {
    const mem = memory();
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(3), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CAMPAIGN); // armed
    wait();
    app.click(TUTORIAL); // no tutorial save: starts at once
    expect(app.screen).toBe('equipment');
    expect(app.campaign.mode).toBe('tutorial');
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(true); // not replaced
  });

  it('two presses of different buttons are not a confirmation', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign').save(campaignSave(3), defaultLoadout());
    const { app, wait } = setup(mem);
    app.click(CAMPAIGN); // armed for the campaign
    wait();
    app.click(TUTORIAL); // arms the tutorial instead
    expect(app.screen).toBe('title');
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(true);
    expect(mem.data.has(SAVE_KEY)).toBe(true);
  });
});

describe('screens by mode', () => {
  it('the end screen of a finished tutorial offers a new tutorial', () => {
    const t = setup(memory(), { createMission: () => makeState(corridorRows('PPPPE')) });
    t.app.click(TUTORIAL);
    expect(t.app.campaign.mode).toBe('tutorial');
    t.app.campaign = { ...t.app.campaign, status: 'lost' };
    t.app.screen = 'end';
    t.wait();
    t.app.click({ x: 240, y: 252 }); // NEW CAMPAIGN button of the end screen
    expect(t.app.campaign.mode).toBe('tutorial');
    expect(t.app.screen).toBe('equipment');
  });
});
