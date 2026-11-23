import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { newCampaign, recordMission } from '../src/core/campaign';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import type { GameState } from '../src/core/types';

const squad = (s: GameState) => s.units.filter((u) => u.side === 'player');

describe('training points count toward rank only', () => {
  const def = generateMission(0, 0);

  it('promotes a soldier by kills plus training points', () => {
    const s = createMission(def, 1, [
      { name: 'A', kills: 0, trained: 2 },
      { name: 'B', kills: 3, trained: 2 },
      { name: 'C', kills: 0 },
      { name: 'D', kills: 1, trained: 8 },
    ]);
    expect(squad(s).map((u) => u.rank)).toEqual(['Private', 'Sergeant', 'Rookie', 'Captain']);
    expect(squad(s)[0].maxHp).toBe(CONFIG.soldierHp + 10);
  });

  it('keeps today\'s ranks when no soldier is trained', () => {
    const s = createMission(def, 1, [
      { name: 'A', kills: 2 }, { name: 'B', kills: 5 }, { name: 'C', kills: 9 }, { name: 'D', kills: 0 },
    ]);
    expect(squad(s).map((u) => u.rank)).toEqual(['Private', 'Sergeant', 'Captain', 'Rookie']);
  });

  it('keeps trained points when kills are folded in, and never adds them to kills', () => {
    const c = {
      ...newCampaign('campaign', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      roster: [{ name: 'A', kills: 1, trained: 2 }, { name: 'B', kills: 0 }, { name: 'C', kills: 0 }, { name: 'D', kills: 0 }],
    };
    const s = createMission(def, 1, c.roster);
    s.status = 'won';
    squad(s)[0].kills = 3;
    const next = recordMission(c, s, 10);
    expect(next.roster[0]).toEqual({ name: 'A', kills: 4, trained: 2 });
    expect(next.roster[1]).toEqual({ name: 'B', kills: 0 });
  });
});
