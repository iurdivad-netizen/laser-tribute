import { describe, expect, it } from 'vitest';
import { createMission1 } from '../src/core/mission1';

describe('createMission1', () => {
  const s = createMission1();

  it('has the expected size and cast', () => {
    expect(s.width).toBe(30);
    expect(s.height).toBe(20);
    expect(s.units.filter((u) => u.side === 'player')).toHaveLength(4);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(4);
    expect(s.items).toHaveLength(3);
  });

  it('places every unit and item on a walkable tile', () => {
    for (const u of s.units) expect(s.tiles[u.pos.y][u.pos.x].kind).not.toBe('wall');
    for (const i of s.items) expect(s.tiles[i.pos.y][i.pos.x].kind).not.toBe('wall');
  });

  it('gives every enemy a walkable patrol route', () => {
    for (const e of s.units.filter((u) => u.side === 'enemy')) {
      expect(e.patrol.length).toBeGreaterThan(0);
      for (const p of e.patrol) expect(s.tiles[p.y][p.x].kind).toBe('floor');
    }
  });

  it('starts with the squad area explored', () => {
    expect(s.explored[17][2]).toBe(true);
    expect(s.explored[2][19]).toBe(false);
  });
});
