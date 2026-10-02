import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/core/mission';

describe('parseMap', () => {
  const rows = ['#####', '#P.E#', '#+r.#', '#####'];

  it('reads size, tiles and doors', () => {
    const s = parseMap(rows);
    expect(s.width).toBe(5);
    expect(s.height).toBe(4);
    expect(s.tiles[0][0].kind).toBe('wall');
    expect(s.tiles[1][1].kind).toBe('floor');
    expect(s.tiles[2][1]).toEqual({ kind: 'door', open: false });
  });

  it('creates units with default stats', () => {
    const s = parseMap(rows);
    const p1 = s.units.find((u) => u.id === 'p1')!;
    const e1 = s.units.find((u) => u.id === 'e1')!;
    expect(p1).toMatchObject({
      side: 'player', pos: { x: 1, y: 1 }, facing: 0, hp: 50, maxHp: 50,
      ap: 60, maxAp: 60, weapon: 'rifle', grenades: 1, alive: true, alert: false,
      name: 'P1', kills: 0,
    });
    expect(e1).toMatchObject({
      side: 'enemy', pos: { x: 3, y: 1 }, facing: 4, hp: 40, maxHp: 40,
      ap: 60, weapon: 'rifle', grenades: 0, alive: true, name: 'E1', kills: 0,
    });
  });

  it('creates floor items', () => {
    const s = parseMap(rows);
    expect(s.items).toEqual([{ id: 'i1', pos: { x: 2, y: 2 }, kind: 'rifle' }]);
  });

  it('starts as a fresh game', () => {
    const s = parseMap(rows, 9);
    expect(s.turn).toBe('player');
    expect(s.turnNumber).toBe(1);
    expect(s.status).toBe('playing');
    expect(s.rngState).toBe(9);
    expect(s.reacted).toEqual([]);
    expect(s.enemyMemory).toBeNull();
    expect(s.explored.length).toBe(4);
    expect(s.explored[0].length).toBe(5);
  });

  it('rejects ragged rows', () => {
    expect(() => parseMap(['####', '###'])).toThrow(/wide/);
  });
});
