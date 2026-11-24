import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import { soldierStats } from '../src/core/world/soldierinfo';
import { newWorld, type PoolSoldier, type World } from '../src/core/world/world';
import { unsupportedChars } from '../src/ui/font';

const fresh = () => newWorld(1, 'calm');
const soldier = (kills: number, trained: number, status: PoolSoldier['status'] = 'ready', daysLeft = 0): PoolSoldier =>
  ({ name: 'Alvarez', kills, trained, status, daysLeft });
const value = (rows: [string, string][], label: string): string | undefined => rows.find((r) => r[0] === label)?.[1];

describe('soldierStats ranks', () => {
  const cases: [number, number, string, string][] = [
    [0, 0, 'ROOKIE', 'PRIVATE IN 2'],
    [2, 0, 'PRIVATE', 'SERGEANT IN 3'],
    [4, 1, 'SERGEANT', 'CAPTAIN IN 4'],
    [1, 1, 'PRIVATE', 'SERGEANT IN 3'],
    [9, 0, 'CAPTAIN', 'TOP RANK'],
    [5, 6, 'CAPTAIN', 'TOP RANK'],
  ];
  it.each(cases)('kills %i and training %i give %s, next: %s', (kills, trained, rank, next) => {
    const stats = soldierStats(soldier(kills, trained), fresh());
    expect(stats.rank).toBe(rank);
    expect(value(stats.rows, 'RANK')).toBe(rank);
    expect(value(stats.rows, 'NEXT RANK')).toBe(next);
  });

  it('gives the same HP, AP and accuracy as a mission soldier of that rank', () => {
    for (const [kills, trained] of [[0, 0], [2, 0], [4, 1], [1, 1], [9, 0], [5, 6]]) {
      const def = generateMission(0, 0);
      const state = createMission(def, 1, [
        { name: 'Alvarez', kills, trained }, { name: 'B', kills: 0 }, { name: 'C', kills: 0 }, { name: 'D', kills: 0 },
      ]);
      const unit = state.units.filter((u) => u.side === 'player')[0];
      const stats = soldierStats(soldier(kills, trained), fresh());
      expect(stats.hp, `${kills}+${trained}`).toBe(unit.maxHp);
      expect(stats.ap, `${kills}+${trained}`).toBe(unit.maxAp);
      expect(stats.accuracy, `${kills}+${trained}`).toBe(Math.round(unit.accuracy * 100));
      expect(value(stats.rows, 'HP')).toBe(String(unit.maxHp));
      expect(value(stats.rows, 'ACCURACY')).toBe(`+${Math.round(unit.accuracy * 100)}%`);
    }
  });
});

describe('soldierStats rows', () => {
  it('shows kills, training points and the status with days left', () => {
    const w = fresh();
    expect(value(soldierStats(soldier(3, 2), w).rows, 'KILLS')).toBe('3');
    expect(value(soldierStats(soldier(3, 2), w).rows, 'TRAINED')).toBe('2');
    expect(value(soldierStats(soldier(0, 0), w).rows, 'STATUS')).toBe('READY');
    expect(value(soldierStats(soldier(0, 0, 'training', 2), w).rows, 'STATUS')).toBe('TRAINING 2D');
    expect(value(soldierStats(soldier(0, 0, 'wounded', 3), w).rows, 'STATUS')).toBe('WOUNDED 3D');
  });

  it('shows the training cap only once the facility is built, and says when the soldier is at it', () => {
    const none = soldierStats(soldier(0, 0), fresh());
    expect(value(none.rows, 'TRAIN CAP')).toBeUndefined();
    const built: World = { ...fresh(), research: { done: ['training1'], active: null } };
    expect(value(soldierStats(soldier(0, 0), built).rows, 'TRAIN CAP')).toBe('2');
    expect(value(soldierStats(soldier(1, 1), built).rows, 'TRAIN CAP')).toBe('AT CAP');
  });

  it('ends with the kit note, and keeps every label and value short and supported', () => {
    const w: World = { ...fresh(), research: { done: ['training3'], active: null } };
    for (const s of [soldier(0, 0), soldier(9999, 9999, 'wounded', 30), soldier(4, 1, 'training', 4)]) {
      const stats = soldierStats({ ...s, name: 'Lindqvist 12' }, w);
      expect(stats.note).toBe('KIT IS CHOSEN BEFORE EACH FIGHT');
      expect(stats.name).toBe('Lindqvist 12');
      for (const [label, v] of stats.rows) {
        expect(label.length, label).toBeLessThanOrEqual(10);
        expect(v.length, v).toBeLessThanOrEqual(22);
        expect(unsupportedChars(label + v), `${label} ${v}`).toEqual([]);
      }
      expect(unsupportedChars(stats.note)).toEqual([]);
    }
  });
});
