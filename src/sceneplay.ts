import type { Scene, SceneLine } from './core/world/story';

export type Phase = 'lines' | 'choice' | 'reply';

/** Where the player is inside one scene: its lines, the choice, or the reply to the choice made. */
export interface ScenePlay {
  scene: Scene;
  phase: Phase;
  index: number;
  picked: 0 | 1 | null;
}

export const startPlay = (scene: Scene): ScenePlay => ({ scene, phase: 'lines', index: 0, picked: null });

/** The line on screen, or null while the choice buttons are up. */
export function shownLine(p: ScenePlay): SceneLine | null {
  if (p.phase === 'lines') return p.scene.lines[p.index] ?? null;
  if (p.phase === 'reply' && p.picked !== null) return p.scene.choice?.[p.picked].reply[p.index] ?? null;
  return null;
}

/** The next line; after the last line of a choice scene the choice, which only `pick` can leave. */
export function forward(p: ScenePlay): ScenePlay | 'done' {
  if (p.phase === 'choice') return p;
  const length = p.phase === 'lines' ? p.scene.lines.length : p.scene.choice?.[p.picked ?? 0].reply.length ?? 0;
  if (p.index + 1 < length) return { ...p, index: p.index + 1 };
  if (p.phase === 'lines' && p.scene.choice) return { ...p, phase: 'choice', index: 0 };
  return 'done';
}

/** Takes one option of the choice; only valid while the choice is up. */
export function pick(p: ScenePlay, option: 0 | 1): ScenePlay {
  if (p.phase !== 'choice') throw new Error('no choice to pick');
  return { ...p, phase: 'reply', index: 0, picked: option };
}

/** Skips ahead. A scene with a choice stops at the choice: skipping never picks for the player. */
export function skip(p: ScenePlay): ScenePlay | 'done' {
  if (p.phase === 'choice') return p;
  if (p.phase === 'lines' && p.scene.choice) return { ...p, phase: 'choice', index: 0 };
  return 'done';
}
