import { describe, expect, it } from 'vitest';
import { findPath, pathCost } from '../src/core/path';
import { corridorRows, makeState } from './helpers';

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
});
