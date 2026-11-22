import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { createMission, MISSIONS } from '../src/core/missions';
import { botTurn, nearestFrontier } from '../src/sim/bot';
import { chooseLoadout } from '../src/sim/campaign';
import { emptyStash } from '../src/core/stash';
import { validateLoadout } from '../src/core/loadout';

describe('the balance bot', () => {
  it('finishes the first tutorial mission in a sane number of turns without getting stuck', () => {
    let s = createMission(MISSIONS[0], 1);
    for (let i = 0; i < 60 && s.status === 'playing'; i++) {
      s = botTurn(s);
      if (s.status === 'playing' && s.turn === 'enemy') s = runEnemyTurn(s).state;
    }
    expect(s.status).not.toBe('playing');
  });

  it('always buys a legal kit and spends most of a large budget', () => {
    for (const [budget, level] of [[120, 1], [200, 4], [320, 8]] as const) {
      const kit = chooseLoadout(budget, emptyStash(), level);
      expect(validateLoadout(kit, budget, emptyStash(), level)).toBeNull();
    }
  });
});

describe('the careful bot', () => {
  it('finishes the first tutorial mission without knowing where the enemies are', () => {
    let s = createMission(MISSIONS[0], 1);
    for (let i = 0; i < 80 && s.status === 'playing'; i++) {
      s = botTurn(s, 'careful');
      if (s.status === 'playing' && s.turn === 'enemy') s = runEnemyTurn(s).state;
    }
    expect(s.status).not.toBe('playing');
  });

  it('finds the nearest edge of the explored map and nothing once everything is explored', () => {
    const s = createMission(MISSIONS[0], 1);
    const from = s.units.find((u) => u.side === 'player')!.pos;
    expect(nearestFrontier(s, from)).not.toBeNull();
    s.explored = s.explored.map((row) => row.map(() => true));
    expect(nearestFrontier(s, from)).toBeNull();
  });
});
