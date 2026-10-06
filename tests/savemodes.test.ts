import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/core/campaign';
import { CAMPAIGN_LENGTH } from '../src/core/gen';
import { defaultLoadout } from '../src/core/loadout';
import {
  CAMPAIGN_SAVE_KEY, LAST_KEY, LastMode, SAVE_KEY, SaveStore, parseSave, type SaveStorage,
} from '../src/save';

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const VARS = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];
const campaignAt = (i: number) => ({ ...newCampaign('campaign', VARS), missionIndex: i, missionsWon: i });

describe('the campaign slot', () => {
  it('saves and loads a campaign with its variations, under its own key', () => {
    const mem = memory();
    const store = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    store.save(campaignAt(4), defaultLoadout());
    expect([...mem.data.keys()]).toEqual([CAMPAIGN_SAVE_KEY]);
    const back = store.load()!;
    expect(back.campaign.mode).toBe('campaign');
    expect(back.campaign.variations).toEqual(VARS);
    expect(back.campaign.missionIndex).toBe(4);
  });

  it('accepts mission 10 (index 9) but not index 10', () => {
    const mem = memory();
    const store = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    store.save(campaignAt(9), defaultLoadout());
    expect(store.load()!.campaign.missionIndex).toBe(9);
    store.save(campaignAt(10), defaultLoadout());
    expect(store.load()).toBeNull();
  });

  it.each([
    ['too few variations', VARS.slice(0, 9)],
    ['too many variations', [...VARS, 0]],
    ['a variation of 5', [...VARS.slice(0, 9), 5]],
    ['a negative variation', [...VARS.slice(0, 9), -1]],
    ['a fractional variation', [...VARS.slice(0, 9), 1.5]],
    ['a text variation', [...VARS.slice(0, 9), '2']],
  ])('rejects %s', (_label, variations) => {
    const text = JSON.stringify({ version: 1, campaign: { ...campaignAt(2), variations }, loadout: defaultLoadout() });
    expect(parseSave(text, CAMPAIGN_LENGTH, 'campaign')).toBeNull();
  });

  it('rejects a campaign text whose mode is not campaign, or whose variations are missing', () => {
    const base = { ...campaignAt(2) };
    expect(parseSave(JSON.stringify({ version: 1, campaign: { ...base, mode: 'tutorial' }, loadout: [] }), CAMPAIGN_LENGTH, 'campaign')).toBeNull();
    const { variations: _v, ...noVars } = base;
    expect(parseSave(JSON.stringify({ version: 1, campaign: noVars, loadout: [] }), CAMPAIGN_LENGTH, 'campaign')).toBeNull();
  });

  it('a corrupt campaign slot is ignored and leaves the tutorial slot alone', () => {
    const mem = memory();
    const tutorial = new SaveStore(mem, 3);
    const campaign = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    tutorial.save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    mem.setItem(CAMPAIGN_SAVE_KEY, '{not json');
    expect(campaign.load()).toBeNull();
    expect(tutorial.load()!.campaign.missionIndex).toBe(1);
  });

  it('clearing one slot leaves the other', () => {
    const mem = memory();
    const tutorial = new SaveStore(mem, 3);
    const campaign = new SaveStore(mem, CAMPAIGN_LENGTH, 'campaign');
    tutorial.save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    campaign.save(campaignAt(2), defaultLoadout());
    campaign.clear();
    expect(mem.data.has(CAMPAIGN_SAVE_KEY)).toBe(false);
    expect(tutorial.load()).not.toBeNull();
  });
});

describe('the tutorial slot', () => {
  it('loads an old save with no mode field as tutorial progress', () => {
    const old: Record<string, unknown> = { ...newCampaign(), missionIndex: 1, missionsWon: 1 };
    delete old.mode;
    delete old.variations;
    const back = parseSave(JSON.stringify({ version: 1, campaign: old, loadout: defaultLoadout() }), 3);
    expect(back!.campaign.mode).toBe('tutorial');
    expect(back!.campaign.variations).toEqual([]);
    expect(back!.campaign.missionIndex).toBe(1);
  });

  it('rejects a campaign-mode text in the tutorial slot', () => {
    const text = JSON.stringify({ version: 1, campaign: campaignAt(1), loadout: defaultLoadout() });
    expect(parseSave(text, 3)).toBeNull();
  });

  it('writes under the old key', () => {
    const mem = memory();
    new SaveStore(mem, 3).save({ ...newCampaign(), missionIndex: 1, missionsWon: 1 }, defaultLoadout());
    expect([...mem.data.keys()]).toEqual([SAVE_KEY]);
  });
});

describe('LastMode', () => {
  it('remembers the mode and ignores junk and storage errors', () => {
    const mem = memory();
    const last = new LastMode(mem);
    expect(last.get()).toBeNull();
    last.set('campaign');
    expect(mem.data.get(LAST_KEY)).toBe('campaign');
    expect(last.get()).toBe('campaign');
    mem.setItem(LAST_KEY, 'banana');
    expect(last.get()).toBeNull();
    const broken: SaveStorage = {
      getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => undefined,
    };
    const b = new LastMode(broken);
    expect(b.get()).toBeNull();
    expect(() => b.set('tutorial')).not.toThrow();
    expect(new LastMode(null).get()).toBeNull();
  });
});
