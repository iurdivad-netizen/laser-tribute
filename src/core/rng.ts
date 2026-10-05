import type { GameState } from './types';

function step(seed: number): { next: number; value: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return { next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

export function nextRandom(state: GameState): number {
  const r = step(state.rngState);
  state.rngState = r.next;
  return r.value;
}

/** The critical-hit stream: the same generator on its own state, so crits never shift hit and miss rolls. */
export function nextCrit(state: GameState): number {
  const r = step(state.critState);
  state.critState = r.next;
  return r.value;
}
