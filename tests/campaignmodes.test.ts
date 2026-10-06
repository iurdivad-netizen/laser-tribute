import { describe, expect, it } from 'vitest';
import { newCampaign, recordMission } from '../src/core/campaign';
import { corridorRows, makeState, unit } from './helpers';

const finished = (won: boolean) => {
  const s = makeState(corridorRows('PPPPE'));
  s.status = won ? 'won' : 'lost';
  if (!won) for (const id of ['p1', 'p2', 'p3', 'p4']) unit(s, id).alive = false;
  return s;
};

describe('campaign modes', () => {
  it('a plain newCampaign is the tutorial with no variations', () => {
    const c = newCampaign();
    expect(c.mode).toBe('tutorial');
    expect(c.variations).toEqual([]);
  });

  it('a campaign keeps the variations it was started with, and copies them', () => {
    const v = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];
    const c = newCampaign('campaign', v);
    expect(c.mode).toBe('campaign');
    expect(c.variations).toEqual(v);
    v[0] = 4;
    expect(c.variations[0]).toBe(0);
  });

  it('recordMission carries the mode and the variations through a win and a loss', () => {
    const c = newCampaign('campaign', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const won = recordMission(c, finished(true), 10);
    expect(won.mode).toBe('campaign');
    expect(won.variations).toEqual(c.variations);
    expect(won.missionIndex).toBe(1);
    const lost = recordMission(c, finished(false), 10);
    expect(lost.mode).toBe('campaign');
    expect(lost.variations).toEqual(c.variations);
    expect(lost.status).toBe('lost');
  });

  it('a ten-mission campaign is won on the tenth win and not before', () => {
    let c = newCampaign('campaign', Array(10).fill(0));
    for (let i = 0; i < 9; i++) {
      c = recordMission(c, finished(true), 10);
      expect(c.status).toBe('active');
    }
    c = recordMission(c, finished(true), 10);
    expect(c.status).toBe('won');
    expect(c.missionsWon).toBe(10);
  });
});
