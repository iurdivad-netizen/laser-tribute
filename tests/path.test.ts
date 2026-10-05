import { describe, expect, it } from 'vitest';
import { findPath, pathCost } from '../src/core/path';
import { stepBlockedReason } from '../src/core/movement';
import { corridorRows, makeState, unit } from './helpers';

describe('findPath', () => {
  it('walks a straight corridor', () => {
    const s = makeState(corridorRows('P...'));
    const path = findPath(s, 'p1', { x: 3, y: 1 });
    expect(path).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(pathCost({ x: 1, y: 1 }, path!)).toBe(8);
  });

  it('goes around a wall without cutting corners', () => {
    const s = makeState(['#####', '#P#.#', '#...#', '#####']);
    const path = findPath(s, 'p1', { x: 3, y: 1 });
    expect(path).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }]);
    expect(pathCost({ x: 1, y: 1 }, path!)).toBe(16);
  });

  it('prefers a diagonal when it is cheaper', () => {
    const s = makeState(['#####', '#P..#', '#...#', '#..E#', '#####']);
    const path = findPath(s, 'p1', { x: 3, y: 3 }, { ignoreOccupantAtGoal: true });
    expect(path).toEqual([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
  });

  it('returns null when the goal is unreachable', () => {
    const s = makeState(['######', '#P#..#', '######']);
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toBeNull();
  });

  it('is blocked by a closed door and passes once it is open', () => {
    const s = makeState(corridorRows('P+..'));
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toBeNull();
    s.tiles[1][2].open = true;
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toHaveLength(2);
  });

  it('treats an occupied goal as blocked unless told otherwise', () => {
    const s = makeState(corridorRows('P.E'));
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 3, y: 1 }, { ignoreOccupantAtGoal: true })).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
  });

  it('returns null for the start tile, an unknown unit or an off-map goal', () => {
    const s = makeState(corridorRows('P..'));
    expect(findPath(s, 'p1', { x: 1, y: 1 })).toBeNull();
    expect(findPath(s, 'zz', { x: 2, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 40, y: 1 })).toBeNull();
  });

  it('ignores units the given side cannot see, but not visible ones', () => {
    const s = makeState(corridorRows('P..E')); // e1 at x=4
    s.units.find((u) => u.id === 'p1')!.facing = 6; // facing away: e1 is hidden
    expect(findPath(s, 'p1', { x: 4, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 4, y: 1 }, { seenBy: 'player' })).toHaveLength(3);
    s.units.find((u) => u.id === 'p1')!.facing = 2; // facing it: e1 is visible and blocks
    expect(findPath(s, 'p1', { x: 4, y: 1 }, { seenBy: 'player' })).toBeNull();
  });
});

describe('findPath through closed doors', () => {
  it('treats a closed door as a wall by default and as passable with openDoors', () => {
    const s = makeState(corridorRows('P.+.E')); // P x1, door x3, goal x4
    expect(findPath(s, 'p1', { x: 4, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 4, y: 1 }, { openDoors: true })).toEqual([
      { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    ]);
  });

  it('still refuses walls, and a doorway with a unit in it', () => {
    const wall = makeState(corridorRows('P.#.E'));
    expect(findPath(wall, 'p1', { x: 4, y: 1 }, { openDoors: true })).toBeNull();
    const blocked = makeState(corridorRows('P.+.E'));
    unit(blocked, 'e1').pos = { x: 3, y: 1 };
    expect(findPath(blocked, 'p1', { x: 4, y: 1 }, { openDoors: true })).toBeNull();
  });

  it('charges extra for a closed door, so an open way of the same length wins', () => {
    const rows = ['#######', '#..+..#', '#P.#.E#', '#..+..#', '#######'];
    const through = (s: ReturnType<typeof makeState>) =>
      findPath(s, 'p1', { x: 5, y: 2 }, { openDoors: true, ignoreOccupantAtGoal: true })!.map((p) => `${p.x},${p.y}`);
    const openLower = makeState(rows);
    openLower.tiles[3][3].open = true;
    expect(through(openLower)).toContain('3,3');
    expect(through(openLower)).not.toContain('3,1');
    const openUpper = makeState(rows);
    openUpper.tiles[1][3].open = true;
    expect(through(openUpper)).toContain('3,1');
    expect(through(openUpper)).not.toContain('3,3');
  });
});

describe('stepBlockedReason with doorsOpen', () => {
  it('only the closed-door check is skipped', () => {
    const s = makeState(corridorRows('P.+.E'));
    expect(stepBlockedReason(s, { x: 2, y: 1 }, { x: 3, y: 1 })).toBe('The door is closed');
    expect(stepBlockedReason(s, { x: 2, y: 1 }, { x: 3, y: 1 }, false, true)).toBeNull();
    const wall = makeState(corridorRows('P.#.E'));
    expect(stepBlockedReason(wall, { x: 2, y: 1 }, { x: 3, y: 1 }, false, true)).toBe('A wall blocks the way');
  });
});
