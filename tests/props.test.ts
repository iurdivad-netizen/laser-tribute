import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { isCovered } from '../src/core/combat';
import { findPath } from '../src/core/path';
import { canSee, computeVisible, hasLineOfSight } from '../src/core/vision';
import { makeState, ok, reason, unit } from './helpers';

describe('props in the map text', () => {
  it('reads x and y as low wall tiles of the two variants, and # as a plain wall', () => {
    const s = makeState(['#####', '#x.y#', '#####']);
    expect(s.tiles[1][1]).toEqual({ kind: 'wall', open: false, low: true, prop: 0 });
    expect(s.tiles[1][3]).toEqual({ kind: 'wall', open: false, low: true, prop: 1 });
    expect(s.tiles[0][0]).toEqual({ kind: 'wall', open: false });
    expect(s.tiles[1][2].kind).toBe('floor');
  });
});

describe('sight over a prop', () => {
  const row = (mid: string) => makeState(['#######', `#P.${mid}.E#`, '#######']);

  it('passes a prop but not a wall or a closed door', () => {
    const over = row('x');
    const p = unit(over, 'p1');
    p.facing = 2;
    expect(hasLineOfSight(over, p.pos, unit(over, 'e1').pos)).toBe(true);
    expect(canSee(over, p, unit(over, 'e1').pos)).toBe(true);
    for (const blocker of ['#', '+']) {
      const s = row(blocker);
      expect(hasLineOfSight(s, unit(s, 'p1').pos, unit(s, 'e1').pos), blocker).toBe(false);
    }
  });

  it('lets the visibility grid and the squad see tiles behind a prop', () => {
    const s = row('y');
    unit(s, 'p1').facing = 2;
    const seen = computeVisible(s, 'player');
    expect(seen[1][5]).toBe(true); // the enemy tile, behind the prop at x = 3
    expect(seen[1][3]).toBe(true); // the prop tile itself
  });
});

describe('a prop is a wall for everything but sight', () => {
  it('refuses a step onto a prop and routes around it', () => {
    const s = makeState(['#######', '#.....#', '#Px..E#', '#.....#', '#######']);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }))).toMatch(/wall/i);
    const path = findPath(s, 'p1', { x: 5, y: 2 }, { ignoreOccupantAtGoal: true })!;
    expect(path.some((p) => p.x === 2 && p.y === 2)).toBe(false);
    expect(path.length).toBeGreaterThan(0);
  });

  it('refuses to cut a corner past a prop', () => {
    const s = makeState(['#####', '#P..#', '#x..#', '#####']);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }))).toMatch(/corner/i);
  });

  it('gives cover to a unit with a prop on the shooter side', () => {
    const s = makeState(['#########', '#P.x...E#', '#########']);
    const shooter = unit(s, 'p1').pos;
    // the target stands directly behind the prop, seen from the shooter: the prop is a wall next to it, nearer to the shooter
    const behind = makeState(['#########', '#P..xE..#', '#########']);
    expect(isCovered(behind, unit(behind, 'p1').pos, unit(behind, 'e1').pos)).toBe(true);
    expect(isCovered(s, shooter, unit(s, 'e1').pos)).toBe(false);
  });

  it('cannot be thrown onto, but a throw can pass it', () => {
    const s = makeState(['#########', '#P.x....#', '#########']);
    const p = unit(s, 'p1');
    p.facing = 2;
    p.grenades = 2;
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }))).toMatch(/wall/i);
    ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 6, y: 1 } }));
  });
});
