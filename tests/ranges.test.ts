import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { blastTiles, blastVictims, shotTiles, throwTiles } from '../src/render/ranges';
import type { GameState, Pos } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const has = (tiles: Pos[], x: number, y: number) => tiles.some((t) => t.x === x && t.y === y);

/** A long one-row corridor: the soldier P at x = 1 facing east. */
function lane(weapon: 'pistol' | 'rifle' | 'sniper' = 'rifle'): GameState {
  const s = makeState(corridorRows('P' + '.'.repeat(18)));
  const p = unit(s, 'p1');
  p.weapon = weapon;
  p.facing = 2;
  return s;
}

describe('shotTiles: where the selected soldier could shoot', () => {
  it('stops at the weapon range', () => {
    const pistol = shotTiles(lane('pistol'), unit(lane('pistol'), 'p1'));
    expect(has(pistol, 1 + 8, 1)).toBe(true);
    expect(has(pistol, 1 + 9, 1)).toBe(false);
  });

  it('stops at the sight range for the rifle and reaches 14 tiles for the sniper', () => {
    const rifle = lane('rifle');
    const tiles = shotTiles(rifle, unit(rifle, 'p1'));
    expect(has(tiles, 1 + 10, 1)).toBe(true);
    expect(has(tiles, 1 + 11, 1)).toBe(false);
    const sniper = lane('sniper');
    const far = shotTiles(sniper, unit(sniper, 'p1'));
    expect(has(far, 1 + 14, 1)).toBe(true);
    expect(has(far, 1 + 15, 1)).toBe(false);
  });

  it('leaves out tiles behind the soldier (beyond the next tile)', () => {
    const s = makeState(corridorRows('..P......')); // the soldier stands at x = 3
    unit(s, 'p1').facing = 2;
    const tiles = shotTiles(s, unit(s, 'p1'));
    expect(has(tiles, 6, 1)).toBe(true);
    expect(has(tiles, 2, 1)).toBe(true); // the tile next to him counts
    expect(has(tiles, 1, 1)).toBe(false);
    expect(has(tiles, 3, 1)).toBe(false); // his own tile
    unit(s, 'p1').facing = 6;
    expect(has(shotTiles(s, unit(s, 'p1')), 1, 1)).toBe(true);
    expect(has(shotTiles(s, unit(s, 'p1')), 7, 1)).toBe(false);
  });

  it('leaves out tiles behind a wall and wall tiles themselves', () => {
    const s = makeState(['#########', '#P..#...#', '#########']);
    unit(s, 'p1').facing = 2;
    const tiles = shotTiles(s, unit(s, 'p1'));
    expect(has(tiles, 3, 1)).toBe(true);
    expect(has(tiles, 4, 1)).toBe(false); // the wall
    expect(has(tiles, 6, 1)).toBe(false); // behind it
  });

  it('is stopped by smoke, like a shot is', () => {
    const s = lane('rifle');
    s.hazards.push({ pos: { x: 4, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    const tiles = shotTiles(s, unit(s, 'p1'));
    expect(has(tiles, 3, 1)).toBe(true);
    expect(has(tiles, 7, 1)).toBe(false);
  });
});

describe('throwTiles: where the selected soldier could throw', () => {
  it('stops at the range of the kind', () => {
    const s = lane();
    const tiles = throwTiles(s, unit(s, 'p1'));
    expect(has(tiles, 1 + 8, 1)).toBe(true);
    expect(has(tiles, 1 + 9, 1)).toBe(false);
  });

  it('does not need the soldier to face the tile', () => {
    const s = makeState(corridorRows('......P....'));
    const p = unit(s, 'p1');
    p.facing = 2;
    expect(has(throwTiles(s, p), 3, 1)).toBe(true);
  });

  it('leaves out walls and tiles behind them, but not tiles behind smoke', () => {
    const s = makeState(['#########', '#P..#...#', '#########']);
    const p = unit(s, 'p1');
    expect(has(throwTiles(s, p), 4, 1)).toBe(false);
    expect(has(throwTiles(s, p), 6, 1)).toBe(false);
    const open = lane();
    open.hazards.push({ pos: { x: 4, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    expect(has(throwTiles(open, unit(open, 'p1')), 7, 1)).toBe(true);
  });

  it('uses the range of the kind carried', () => {
    const s = lane();
    unit(s, 'p1').throwable = 'smoke';
    expect(has(throwTiles(s, unit(s, 'p1')), 9, 1)).toBe(true); // all kinds have range 8: 1 + 8
    expect(has(throwTiles(s, unit(s, 'p1')), 10, 1)).toBe(false);
  });
});

describe('blastTiles', () => {
  const room = () => makeState(['#########', '#.......#', '#.......#', '#.......#', '#########']);

  it('is the square of the kind radius, without walls', () => {
    expect(blastTiles(room(), { x: 4, y: 2 }, 1)).toHaveLength(9);
    expect(blastTiles(room(), { x: 4, y: 2 }, 2)).toHaveLength(15); // 5 wide, the room is 3 tall
    expect(blastTiles(room(), { x: 1, y: 1 }, 1)).toHaveLength(4); // a corner
  });
});

describe('blastVictims', () => {
  function setup(kind: 'frag' | 'smoke' | 'flash') {
    const s = makeState(['###########', '#P........#', '#.........#', '###########']);
    const p = unit(s, 'p1');
    p.facing = 2;
    p.throwable = kind;
    s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[1]), id: 'e1', pos: { x: 5, y: 1 } });
    s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[0]), id: 'p2', pos: { x: 4, y: 2 } });
    return { s, p };
  }

  it('lists the visible units in the blast, enemies and friends apart', () => {
    const { s, p } = setup('frag');
    const v = blastVictims(s, p, { x: 5, y: 2 });
    expect(v.map((x) => [x.unit.id, x.friend]).sort()).toEqual([['e1', false], ['p2', true]]);
  });

  it('includes the thrower when he stands in the blast', () => {
    const { s, p } = setup('flash');
    const v = blastVictims(s, p, { x: 2, y: 1 });
    expect(v.some((x) => x.unit.id === 'p1' && x.friend)).toBe(true);
  });

  it('lists nobody for smoke, which does no damage and no stun', () => {
    const { s, p } = setup('smoke');
    expect(blastVictims(s, p, { x: 5, y: 2 })).toEqual([]);
  });

  it('never lists an enemy the player cannot see', () => {
    const { s, p } = setup('frag');
    const e = unit(s, 'e1');
    p.facing = 6; // looking away: the enemy two tiles behind is not seen
    e.pos = { x: 4, y: 1 };
    s.units.find((u) => u.id === 'p2')!.pos = { x: 1, y: 2 };
    s.units.find((u) => u.id === 'p2')!.facing = 6;
    expect(blastVictims(s, p, { x: 4, y: 2 }).some((x) => x.unit.id === 'e1')).toBe(false);
  });

});

describe('the tint is exactly what the rules allow (property tests)', () => {
  const MAP = [
    '###############',
    '#P............#',
    '#.....#.......#',
    '#.....#..###..#',
    '#.............#',
    '###############',
  ];

  it('a throw at a tile succeeds exactly when the tile is in throwTiles, own tile included', () => {
    const s = makeState(MAP);
    s.hazards.push({ pos: { x: 4, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    const p = unit(s, 'p1');
    p.grenades = 2;
    const tiles = throwTiles(s, p);
    let checked = 0;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const ok = applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x, y } }).ok;
        expect(has(tiles, x, y), `throw at ${x},${y}`).toBe(ok);
        checked++;
      }
    }
    expect(checked).toBe(MAP.length * MAP[0].length);
    expect(has(tiles, p.pos.x, p.pos.y)).toBe(true);
  });

  it('a shot at an enemy on a tile succeeds exactly when the tile is in shotTiles', () => {
    for (const facing of [0, 2, 4, 6] as const) {
      const s = makeState(MAP);
      s.hazards.push({ pos: { x: 4, y: 1 }, kind: 'smoke', turnsLeft: 3 });
      s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[1]), id: 'e1', pos: { x: 13, y: 4 }, hp: 999, maxHp: 999 });
      const p = unit(s, 'p1');
      p.facing = facing;
      const foe = unit(s, 'e1');
      const tiles = shotTiles(s, p);
      for (let y = 0; y < s.height; y++) {
        for (let x = 0; x < s.width; x++) {
          if (s.tiles[y][x].kind === 'wall' || (x === p.pos.x && y === p.pos.y)) continue;
          foe.pos = { x, y };
          const ok = applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }).ok;
          expect(has(tiles, x, y), `facing ${facing}, shot at ${x},${y}`).toBe(ok);
        }
      }
    }
  });
});
