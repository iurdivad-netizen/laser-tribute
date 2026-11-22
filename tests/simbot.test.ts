import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { createMission, MISSIONS } from '../src/core/missions';
import { botTurn } from '../src/sim/bot';
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
