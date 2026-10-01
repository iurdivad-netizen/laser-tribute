import { describe, expect, it } from 'vitest';
import {
  canSee, computeVisible, hasLineOfSight, updateEnemyMemory, updateExplored, visibleToSide,
} from '../src/core/vision';
import { corridorRows, makeState, unit } from './helpers';

describe('hasLineOfSight', () => {
  it('is clear along an open corridor', () => {
    const s = makeState(corridorRows('P...E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(true);
  });

  it('is blocked by a wall', () => {
    const s = makeState(corridorRows('P.#.E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
  });

  it('is blocked by a closed door and clear once it is open', () => {
    const s = makeState(corridorRows('P.+.E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
    s.tiles[1][3].open = true;
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(true);
  });

  it('can see the blocking wall itself', () => {
    const s = makeState(corridorRows('P.#.E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });
});

describe('canSee', () => {
  const room = ['#####', '#...#', '#.P.#', '#...#', '#.E.#', '#####'];

  it('does not see behind itself', () => {
    const s = makeState(room); // p1 at (2,2) faces north, e1 at (2,4) is behind
    expect(canSee(s, unit(s, 'p1'), { x: 2, y: 4 })).toBe(false);
  });

  it('sees in front once turned', () => {
    const s = makeState(room);
    unit(s, 'p1').facing = 4;
    expect(canSee(s, unit(s, 'p1'), { x: 2, y: 4 })).toBe(true);
  });

  it('always notices adjacent tiles, even behind', () => {
    const s = makeState(['#####', '#.P.#', '#.E.#', '#####']);
    expect(canSee(s, unit(s, 'p1'), { x: 2, y: 2 })).toBe(true);
  });

  it('respects the sight range', () => {
    const far = makeState(corridorRows(`P${'.'.repeat(11)}E`)); // e1 at distance 12
    unit(far, 'p1').facing = 2;
    expect(canSee(far, unit(far, 'p1'), unit(far, 'e1').pos)).toBe(false);
    const near = makeState(corridorRows(`P${'.'.repeat(8)}E`)); // e1 at distance 9
    unit(near, 'p1').facing = 2;
    expect(canSee(near, unit(near, 'p1'), unit(near, 'e1').pos)).toBe(true);
  });

  it('dead units see nothing', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alive = false;
    expect(canSee(s, unit(s, 'p1'), { x: 5, y: 1 })).toBe(false);
  });
});

describe('side visibility and fog of war', () => {
  it('reports whether any unit of a side sees a tile', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').facing = 2; // e1 faces away, so it cannot see p1 behind it
    expect(visibleToSide(s, 'player', { x: 5, y: 1 })).toBe(true);
    expect(visibleToSide(s, 'enemy', { x: 1, y: 1 })).toBe(false);
  });

  it('computes a visibility grid indexed [y][x]', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    const vis = computeVisible(s, 'player');
    expect(vis[1][1]).toBe(true);
    expect(vis[1][5]).toBe(true);
  });

  it('remembers explored tiles after they leave view', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    updateExplored(s);
    expect(s.explored[1][5]).toBe(true);
    unit(s, 'p1').facing = 6;
    updateExplored(s);
    expect(s.explored[1][5]).toBe(true);
  });
});

describe('updateEnemyMemory', () => {
  it('remembers where a soldier was last seen', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'e1').facing = 6;
    updateEnemyMemory(s);
    expect(s.enemyMemory).toEqual({ x: 1, y: 1 });
  });

  it('stays empty when no soldier has been seen', () => {
    const s = makeState(corridorRows('P.#.E'));
    unit(s, 'e1').facing = 6;
    updateEnemyMemory(s);
    expect(s.enemyMemory).toBeNull();
  });

  it('forgets a remembered spot once an enemy stands on it', () => {
    const s = makeState(corridorRows('P.#.E'));
    s.enemyMemory = { x: 5, y: 1 }; // e1 is standing there
    updateEnemyMemory(s);
    expect(s.enemyMemory).toBeNull();
  });
});
