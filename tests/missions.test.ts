import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/core/campaign';
import type { Loadout } from '../src/core/loadout';
import { createMission1 } from '../src/core/mission1';
import { MISSIONS, createMission } from '../src/core/missions';
import { unit } from './helpers';

const ENEMY_COUNTS = [4, 6, 8];

function find(rows: string[], ch: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === ch) out.push({ x, y });
    }),
  );
  return out;
}

/** Tiles reachable from the first soldier start; doors count as passable. */
function reachable(rows: string[]): Set<string> {
  const start = find(rows, 'P')[0];
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (ny < 0 || ny >= rows.length || nx < 0 || nx >= rows[0].length) continue;
      if (rows[ny][nx] === '#' || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe('MISSIONS data', () => {
  it('has three missions with unique ids and names', () => {
    expect(MISSIONS).toHaveLength(3);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(3);
    expect(new Set(MISSIONS.map((m) => m.name)).size).toBe(3);
  });

  MISSIONS.forEach((m, index) => {
    describe(m.name, () => {
      it('is a 30x20 map with equal row widths', () => {
        expect(m.rows).toHaveLength(20);
        for (const row of m.rows) expect(row).toHaveLength(30);
      });

      it('has 4 soldier starts and the expected number of enemies', () => {
        expect(find(m.rows, 'P')).toHaveLength(4);
        expect(find(m.rows, 'E')).toHaveLength(ENEMY_COUNTS[index]);
      });

      it("has a patrol for every enemy that includes the enemy's own start", () => {
        const enemies = find(m.rows, 'E');
        expect(Object.keys(m.patrols).sort()).toEqual(enemies.map((_, i) => `e${i + 1}`).sort());
        enemies.forEach((pos, i) => {
          expect(m.patrols[`e${i + 1}`]).toContainEqual(pos);
        });
      });

      it('has every start, patrol point and item reachable from the soldiers', () => {
        const seen = reachable(m.rows);
        const points = [
          ...find(m.rows, 'P'), ...find(m.rows, 'E'),
          ...find(m.rows, 'r'), ...find(m.rows, 'p'), ...find(m.rows, 'g'),
          ...Object.values(m.patrols).flat(),
        ];
        for (const p of points) expect(seen.has(`${p.x},${p.y}`)).toBe(true);
        for (const p of Object.values(m.patrols).flat()) expect(m.rows[p.y][p.x]).not.toBe('#');
      });
    });
  });
});

describe('createMission', () => {
  const roster = newCampaign().roster;

  it('names the soldiers from the roster and sets the patrols', () => {
    const s = createMission(MISSIONS[1], 7, roster);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(s, id).name)).toEqual([
      'Alvarez', 'Brandt', 'Chen', 'Dubois',
    ]);
    expect(unit(s, 'e1').patrol).toEqual(MISSIONS[1].patrols.e1);
    expect(s.rngState).toBe(7);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(6);
    expect(s.units.every((u) => u.kills === 0)).toBe(true);
  });

  it('applies a loadout under a bigger budget', () => {
    const big: Loadout = [
      { weapon: 'rifle', grenades: 3, clips: 1 }, { weapon: 'rifle', grenades: 3, clips: 1 },
      { weapon: 'rifle', grenades: 3, clips: 1 }, { weapon: 'rifle', grenades: 3, clips: 1 },
    ]; // 196
    expect(() => createMission(MISSIONS[2], 1, roster, big)).toThrow(/budget/);
    const s = createMission(MISSIONS[2], 1, roster, big, 200);
    expect(unit(s, 'p4')).toMatchObject({ weapon: 'rifle', grenades: 3, clips: 1 });
  });

  it('starts with the squad area explored', () => {
    const s = createMission(MISSIONS[2], 1, roster);
    expect(s.explored[16][2]).toBe(true);
  });

  it('keeps Mission 1 exactly as it was', () => {
    const s = createMission1();
    expect(s.width).toBe(30);
    expect(s.height).toBe(20);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(4);
    expect(unit(s, 'e3').patrol).toEqual([{ x: 20, y: 9 }, { x: 23, y: 9 }]);
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', grenades: 1, name: 'P1' });
    expect(MISSIONS[0].patrols.e4).toEqual([{ x: 10, y: 15 }, { x: 24, y: 15 }]);
  });
});
