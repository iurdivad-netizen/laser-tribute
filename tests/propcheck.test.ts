import { describe, expect, it } from 'vitest';
import { checkMission, type Expect } from '../src/core/gen/check';
import { isSolid } from '../src/core/gen/grid';
import type { MissionDef } from '../src/core/missions';

const def = (rows: string[], patrols: MissionDef['patrols']): MissionDef => ({ id: 't', name: 'T', rows, patrols });
const want = (width: number, height: number, items = { r: 0, p: 0, g: 0 }): Expect => ({ width, height, enemies: 1, items });

describe('isSolid', () => {
  it('is true for a wall and for both props, false for floor, doors, units and items', () => {
    for (const c of ['#', 'x', 'y']) expect(isSolid(c)).toBe(true);
    for (const c of ['.', '+', 'P', 'E', 'r', 'p', 'g', undefined]) expect(isSolid(c as string | undefined)).toBe(false);
  });
});

describe('checkMission with props', () => {
  const ROWS = [
    '######################',
    '#PP.......#.....E....#',
    '#PP.......+..........#',
    '#.........#..........#',
    '######################',
  ];
  const patrol = { e1: [{ x: 12, y: 3 }, { x: 16, y: 1 }] };

  it('accepts a map with props standing in the open', () => {
    const rows = [...ROWS];
    rows[2] = rows[2].replace('+..........', '+..x.....y.');
    expect(checkMission(def(rows, patrol), want(22, 5))).toEqual([]);
  });

  it('does not count a floor tile enclosed by props as reachable', () => {
    const closed = [
      '######################',
      '#PP.......#.....E....#',
      '#PP.......+.xxx......#',
      '#.........#.x.x......#',
      '######################',
    ];
    // the floor tile between the props (x = 14, y = 3) is walled in by props on three sides and the wall below
    expect(checkMission(def(closed, patrol), want(22, 5)).join('|')).toMatch(/cannot be reached/);
  });

  it('refuses a patrol point on a prop', () => {
    const rows = [...ROWS];
    rows[3] = rows[3].replace('..........#', '...x......#');
    const bad = { e1: [{ x: 14, y: 3 }, { x: 16, y: 1 }] };
    expect(checkMission(def(rows, bad), want(22, 5)).join('|')).toMatch(/cannot be walked to/);
  });

  it('finds that an enemy sees the squad across a prop, as across open floor', () => {
    const rows = [
      '#############',
      '#PP.....x.E.#',
      '#PP.........#',
      '#...........#',
      '#############',
    ];
    const problems = checkMission(def(rows, { e1: [{ x: 9, y: 2 }, { x: 10, y: 3 }] }), want(13, 5)).join('|');
    expect(problems).toMatch(/sees the squad|within 8 tiles/);
  });
});
