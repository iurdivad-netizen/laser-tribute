import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import { findPath, type PathOptions } from '../src/core/path';
import type { GameState, Pos } from '../src/core/types';
import { referenceFindPath } from './pathReference';

/** A small deterministic random generator, so the goals are the same on every run. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function goalsFor(s: GameState, n: number, seed: number): Pos[] {
  const r = rng(seed);
  const out: Pos[] = [];
  for (const u of s.units) out.push({ ...u.pos }, ...u.patrol.map((p) => ({ ...p })));
  while (out.length < n) {
    const p = { x: Math.floor(r() * s.width), y: Math.floor(r() * s.height) };
    if (s.tiles[p.y][p.x].kind !== 'wall') out.push(p);
  }
  return out;
}

describe('the route search gives exactly the routes of the old search', () => {
  it('on every generated map type, for every option and many goals', () => {
    let compared = 0;
    for (let type = 0; type < 10; type++) {
      const s = createMission(generateMission(type, 0), type + 1);
      s.hazards.push({ pos: { ...s.units[4].pos, x: s.units[4].pos.x + 1 }, kind: 'fire', turnsLeft: 3 });
      const options: PathOptions[] = [
        {},
        { ignoreOccupantAtGoal: true },
        { ignoreOccupantAtGoal: true, openDoors: true },
        { seenBy: 'player', ignoreOccupantAtGoal: true },
        { seenBy: 'player', doorView: s.doorMemory },
      ];
      const goals = goalsFor(s, 24, type + 7);
      for (const unit of [s.units.find((u) => u.side === 'enemy')!, s.units.find((u) => u.side === 'player')!]) {
        for (const goal of goals) {
          for (const opts of options) {
            expect(findPath(s, unit.id, goal, opts), `type ${type} ${unit.id} to ${goal.x},${goal.y} ${JSON.stringify(opts).slice(0, 40)}`)
              .toEqual(referenceFindPath(s, unit.id, goal, opts));
            compared++;
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(1000);
  }, 120000);

  it('finds long routes on the biggest map clearly faster than the old search', () => {
    const s = createMission(generateMission(9, 0), 10);
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    const goals = goalsFor(s, 100, 3).filter((g) => g.x !== enemy.pos.x || g.y !== enemy.pos.y).slice(0, 60);
    const opts = { ignoreOccupantAtGoal: true, openDoors: true };
    const time = (f: typeof findPath) => {
      const t0 = performance.now();
      for (const g of goals) f(s, enemy.id, g, opts);
      return performance.now() - t0;
    };
    time(findPath); // warm up both
    time(referenceFindPath);
    const fast = Math.min(time(findPath), time(findPath));
    const slow = Math.min(time(referenceFindPath), time(referenceFindPath));
    expect(fast, 'new ' + fast.toFixed(0) + ' ms, old ' + slow.toFixed(0) + ' ms').toBeLessThan(slow * 0.7);
  });
});
