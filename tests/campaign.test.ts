import { describe, expect, it } from 'vitest';
import {
  SOLDIER_NAMES, budgetBreakdown, campaignBudget, newCampaign, recordMission, soldierName,
  totalKills,
} from '../src/core/campaign';
import { corridorRows, makeState, unit } from './helpers';

/** A finished 4-soldier mission with no enemies left. */
function finishedWin() {
  const s = makeState(corridorRows('PPPP'));
  s.status = 'won';
  return s;
}

describe('names', () => {
  it('uses the fixed list, then adds a numeric suffix', () => {
    expect(SOLDIER_NAMES).toHaveLength(12);
    expect(soldierName(0)).toBe('Alvarez');
    expect(soldierName(11)).toBe('Lindqvist');
    expect(soldierName(12)).toBe('Alvarez 2');
    expect(soldierName(13)).toBe('Brandt 2');
    expect(soldierName(24)).toBe('Alvarez 3');
  });
});

describe('newCampaign and budget', () => {
  it('starts with four named soldiers and the base budget', () => {
    const c = newCampaign();
    expect(c.roster.map((r) => r.name)).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(c).toMatchObject({ missionIndex: 0, missionsWon: 0, fallen: [], namesUsed: 4, status: 'active' });
    expect(campaignBudget(c)).toBe(120);
    expect(budgetBreakdown(c)).toBe('Base 120 + wins 0 + kills 0');
  });

  it('grows with won missions and with kills by living soldiers only', () => {
    const c = newCampaign();
    c.missionsWon = 1;
    c.roster[0].kills = 3;
    c.roster[1].kills = 1;
    c.fallen.push({ name: 'Gone', kills: 9 });
    expect(totalKills(c)).toBe(4);
    expect(campaignBudget(c)).toBe(160); // 120 + 20 + 4 * 5
    expect(budgetBreakdown(c)).toBe('Base 120 + wins 20 + kills 20');
  });
});

describe('recordMission', () => {
  it('adds mission kills to the roster and advances after a win', () => {
    const c = newCampaign();
    c.roster[0].kills = 2;
    const s = finishedWin();
    unit(s, 'p1').kills = 3;
    unit(s, 'p2').kills = 1;
    const next = recordMission(c, s, 3);
    expect(next.roster[0]).toEqual({ name: 'Alvarez', kills: 5 });
    expect(next.roster[1]).toEqual({ name: 'Brandt', kills: 1 });
    expect(next).toMatchObject({ missionsWon: 1, missionIndex: 1, status: 'active', fallen: [] });
  });

  it('moves a dead soldier to the fallen list and replaces him with a rookie', () => {
    const s = finishedWin();
    unit(s, 'p1').kills = 3;
    unit(s, 'p3').kills = 2;
    unit(s, 'p3').alive = false;
    const next = recordMission(newCampaign(), s, 3);
    expect(next.fallen).toEqual([{ name: 'Chen', kills: 2 }]);
    expect(next.roster[2]).toEqual({ name: 'Eriksen', kills: 0 });
    expect(next.roster[0].kills).toBe(3);
    expect(next.namesUsed).toBe(5);
    expect(campaignBudget(next)).toBe(155); // 120 + 20 + 3 * 5, the dead man's kills are gone
  });

  it('gives every replacement a new, unused name', () => {
    const s = finishedWin();
    for (const id of ['p1', 'p2', 'p3']) unit(s, id).alive = false;
    const next = recordMission(newCampaign(), s, 3);
    expect(next.roster.map((r) => r.name)).toEqual(['Eriksen', 'Fontaine', 'Garcia', 'Dubois']);
    expect(next.fallen.map((r) => r.name)).toEqual(['Alvarez', 'Brandt', 'Chen']);
  });

  it('completes the campaign after winning the last mission', () => {
    const c = { ...newCampaign(), missionIndex: 2, missionsWon: 2 };
    const next = recordMission(c, finishedWin(), 3);
    expect(next).toMatchObject({ status: 'won', missionsWon: 3, missionIndex: 3 });
  });

  it('keeps no rookie in the roster when the campaign is over', () => {
    const c = { ...newCampaign(), missionIndex: 2, missionsWon: 2 };
    const s = finishedWin();
    unit(s, 'p2').alive = false;
    unit(s, 'p2').kills = 2;
    const next = recordMission(c, s, 3);
    expect(next.status).toBe('won');
    expect(next.roster.map((r) => r.name)).toEqual(['Alvarez', 'Chen', 'Dubois']); // survivors only
    expect(next.fallen).toEqual([{ name: 'Brandt', kills: 2 }]);
    expect(next.namesUsed).toBe(4);
  });

  it('loses the campaign when the mission is lost', () => {
    const s = makeState(corridorRows('PPPPE'));
    s.status = 'lost';
    for (const id of ['p1', 'p2', 'p3', 'p4']) unit(s, id).alive = false;
    const next = recordMission(newCampaign(), s, 3);
    expect(next).toMatchObject({ status: 'lost', missionsWon: 0, missionIndex: 0 });
    expect(next.fallen).toHaveLength(4);
    expect(next.roster).toEqual([]); // nobody is left, and no rookies are made for a campaign that is over
  });

  it('never mutates its inputs', () => {
    const c = newCampaign();
    const before = JSON.stringify(c);
    const s = finishedWin();
    unit(s, 'p1').kills = 4;
    unit(s, 'p2').alive = false;
    recordMission(c, s, 3);
    expect(JSON.stringify(c)).toBe(before);
    expect(unit(s, 'p1').kills).toBe(4);
  });

  it('throws when the mission is still being played', () => {
    expect(() => recordMission(newCampaign(), makeState(corridorRows('PPPPE')), 3)).toThrow(
      /not finished/,
    );
  });

  it('leaves roster slots without a matching unit untouched (small test maps)', () => {
    const s = makeState(corridorRows('P..')); // one soldier only
    s.status = 'won';
    unit(s, 'p1').kills = 2;
    const next = recordMission(newCampaign(), s, 3);
    expect(next.roster[0].kills).toBe(2);
    expect(next.roster.slice(1).map((r) => r.name)).toEqual(['Brandt', 'Chen', 'Dubois']);
  });
});
