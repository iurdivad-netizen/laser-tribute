import { nextRandom } from '../src/core/rng';
import { parseMap } from '../src/core/mission';
import type { GameEvent, GameState, Result, Unit } from '../src/core/types';

export function makeState(rows: string[]): GameState {
  return parseMap(rows);
}

export function unit(s: GameState, id: string): Unit {
  const u = s.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
}

/** Finds a seed whose first random number satisfies pred, so tests can force hits and misses. */
export function seedForRoll(pred: (n: number) => boolean): number {
  for (let seed = 1; seed < 100000; seed++) {
    const probe = { rngState: seed } as GameState;
    if (pred(nextRandom(probe))) return seed;
  }
  throw new Error('no seed found');
}

/** One-row map: corridorRows('P...E') gives ['#######', '#P...E#', '#######'] (unit row is y = 1). */
export function corridorRows(inner: string): string[] {
  const wall = '#'.repeat(inner.length + 2);
  return [wall, `#${inner}#`, wall];
}

export function ok(r: Result): { state: GameState; events: GameEvent[] } {
  if (!r.ok) throw new Error(`Expected success, got: ${r.reason}`);
  return r;
}

export function reason(r: Result): string {
  if (r.ok) throw new Error('Expected failure, got success');
  return r.reason;
}
