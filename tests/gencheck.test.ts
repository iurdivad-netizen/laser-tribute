import { describe, expect, it } from 'vitest';
import { checkMission, expectFor, type Expect } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';
import type { MissionDef } from '../src/core/missions';

const WANT: Expect = { width: 22, height: 5, enemies: 1, items: { r: 0, p: 0, g: 0 } };

const GOOD_ROWS = [
  '######################',
  '#PP.......#.....E....#',
  '#PP.......+..........#',
  '#.........#..........#',
  '######################',
];

const def = (rows: string[], patrols: MissionDef['patrols'] = { e1: [{ x: 12, y: 3 }, { x: 16, y: 1 }] }): MissionDef => ({
  id: 't', name: 'T', rows, patrols,
});

describe('checkMission', () => {
  it('accepts a good map', () => {
    expect(checkMission(def(GOOD_ROWS), WANT)).toEqual([]);
  });

  it('builds the expectation from a recipe, with the enemy count overridable', () => {
    expect(expectFor(RECIPES[3])).toEqual({ width: 32, height: 22, enemies: 6, items: { r: 1, p: 1, g: 3 } });
    expect(expectFor(RECIPES[3], 9).enemies).toBe(9);
  });

  it('rejects the wrong size', () => {
    expect(checkMission(def(GOOD_ROWS), { ...WANT, width: 30 })[0]).toMatch(/size/);
    expect(checkMission(def([...GOOD_ROWS.slice(0, 4), '#####', '#']), WANT)[0]).toMatch(/size/);
  });

  it('rejects a squad that is not four soldiers', () => {
    const rows = GOOD_ROWS.map((r) => r.replace('#PP.', '#P..'));
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/squad/);
  });

  it('rejects the wrong enemy and item counts', () => {
    expect(checkMission(def(GOOD_ROWS), { ...WANT, enemies: 2 }).join('|')).toMatch(/enemies/);
    expect(checkMission(def(GOOD_ROWS), { ...WANT, items: { r: 1, p: 0, g: 0 } }).join('|')).toMatch(/item r/);
  });

  it('rejects an open border', () => {
    const rows = [...GOOD_ROWS];
    rows[0] = '#####.################';
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/border/);
  });

  it('rejects floor that cannot be reached from the squad', () => {
    const rows = GOOD_ROWS.map((r) => r.replace('+', '#')); // the only door is walled up
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/reach/);
  });

  it('rejects a door that is not in a wall gap', () => {
    const rows = [...GOOD_ROWS];
    rows[3] = '#....+....#..........#'; // a door standing in open floor
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/door at 5,3/);
  });

  it('counts a unit or pickup beside a door as floor', () => {
    const rows = [...GOOD_ROWS];
    rows[2] = '#PP.......+g.........#'; // a grenade lies right behind the door
    expect(checkMission(def(rows), { ...WANT, items: { r: 0, p: 0, g: 1 } })).toEqual([]);
  });

  it('rejects an enemy within 8 tiles of the squad', () => {
    const rows = GOOD_ROWS.map((r) => r.replace('E', '.'));
    rows[3] = '#.....E...#..........#';
    expect(checkMission(def(rows, { e1: [{ x: 12, y: 3 }, { x: 6, y: 3 }] }), WANT).join('|')).toMatch(/within 8/);
  });

  it('rejects an enemy that has a line of sight to the squad', () => {
    const open = [
      '####################',
      '#PP................#',
      '#PP.............E..#',
      '#..................#',
      '####################',
    ];
    const out = checkMission(def(open, { e1: [{ x: 10, y: 3 }, { x: 16, y: 2 }] }), { ...WANT, width: 20 });
    expect(out.join('|')).toMatch(/sees/);
  });

  it('rejects missing, short and off-map patrols', () => {
    expect(checkMission(def(GOOD_ROWS, {}), WANT).join('|')).toMatch(/patrol e1/);
    expect(checkMission(def(GOOD_ROWS, { e1: [{ x: 16, y: 1 }] }), WANT).join('|')).toMatch(/patrol e1/);
    expect(checkMission(def(GOOD_ROWS, { e1: [{ x: 10, y: 1 }, { x: 16, y: 1 }] }), WANT).join('|')).toMatch(/patrol e1/); // a wall tile
    expect(checkMission(def(GOOD_ROWS, { e1: [{ x: 12, y: 3 }, { x: 16, y: 1 }], e2: [{ x: 12, y: 3 }, { x: 16, y: 1 }] }), WANT).join('|')).toMatch(/patrol e2/);
  });

  it('rejects a patrol point that an enemy can only reach through a closed door', () => {
    // enemies patrol with doors closed: e1 stands east of the door, the point is west of it
    const out = checkMission(def(GOOD_ROWS, { e1: [{ x: 5, y: 3 }, { x: 16, y: 1 }] }), WANT);
    expect(out.join('|')).toMatch(/patrol e1/);
    expect(out.join('|')).toMatch(/door/);
  });

  it('rejects a squad that starts scattered', () => {
    const rows = [
      '######################',
      '#PP.......#.....E....#',
      '#P........+..........#',
      '#.........#.........P#',
      '######################',
    ];
    expect(checkMission(def(rows), WANT).join('|')).toMatch(/squad start is scattered/);
  });
});
