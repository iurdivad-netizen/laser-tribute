import { describe, expect, it } from 'vitest';
import { summarize } from '../src/core/result';
import { corridorRows, makeState, unit } from './helpers';

const rows = corridorRows('PP..EE'); // p1 p2 e1 e2

describe('summarize', () => {
  it('reports a won mission', () => {
    const s = makeState(rows);
    s.status = 'won';
    s.turnNumber = 4;
    unit(s, 'e1').alive = false;
    unit(s, 'e2').alive = false;
    unit(s, 'p2').alive = false;
    expect(summarize(s)).toEqual({
      won: true, survivors: 1, squadSize: 2, enemiesKilled: 2, enemyCount: 2, turns: 4,
    });
  });

  it('reports a lost mission', () => {
    const s = makeState(rows);
    s.status = 'lost';
    unit(s, 'p1').alive = false;
    unit(s, 'p2').alive = false;
    unit(s, 'e1').alive = false;
    expect(summarize(s)).toEqual({
      won: false, survivors: 0, squadSize: 2, enemiesKilled: 1, enemyCount: 2, turns: 1,
    });
  });

  it('is not won while the mission is still being played', () => {
    expect(summarize(makeState(rows)).won).toBe(false);
  });
});
