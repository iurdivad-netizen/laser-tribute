import { addStash, capStash } from '../loot';
import { stashOf, type StashKey } from '../stash';
import { advance, type World } from './world';

/** The four mercenaries the story is about. Later hires have no voice of their own. */
export const ORIGINALS = ['Alvarez', 'Brandt', 'Chen', 'Dubois'] as const;

/** One spoken line. `by` lists the speakers in order of preference; the first one still in the barracks says it. */
export interface SceneLine { by: string[]; text: string }

/** What a choice changes: credits (clamped at 0), days that pass, or one stash item. */
export interface ChoiceEffect { credits?: number; days?: number; stash?: StashKey }

export interface SceneChoice { label: string; effect: ChoiceEffect; reply: SceneLine[] }

export interface Scene {
  id: string;
  /** Pure: reads the world only. A scene plays once, the first time this holds. */
  when: (w: World) => boolean;
  lines: SceneLine[];
  choice?: [SceneChoice, SceneChoice];
}

/** Every story scene, in the order they are offered when several are pending. Filled in by the content module. */
export const SCENES: Scene[] = [];

export const sceneById = (id: string, table: Scene[] = SCENES): Scene | undefined => table.find((s) => s.id === id);

/** The first scene not yet seen whose trigger holds, or null. */
export function nextScene(w: World, table: Scene[] = SCENES): Scene | null {
  return table.find((s) => !w.seen.includes(s.id) && s.when(w)) ?? null;
}

/** The world with this scene marked as seen. */
export function see(w: World, id: string): World {
  return w.seen.includes(id) ? { ...w, seen: [...w.seen], chosen: { ...w.chosen } } : { ...w, seen: [...w.seen, id], chosen: { ...w.chosen } };
}

/** Takes one option of a choice scene: records it, marks the scene seen and applies the effect. */
export function choose(w: World, scene: Scene, option: 0 | 1): World {
  if (!scene.choice) throw new Error('scene has no choice');
  const effect = scene.choice[option].effect;
  let next: World = see(w, scene.id);
  next.chosen[scene.id] = option;
  if (effect.credits !== undefined) next = { ...next, credits: Math.max(0, next.credits + effect.credits) };
  if (effect.stash !== undefined) next = { ...next, stash: capStash(addStash(next.stash, stashOf({ [effect.stash]: 1 }))) };
  if (effect.days) next = advance(next, effect.days);
  return next;
}

/** Who says a line: the first preferred original still in the barracks, else a recruit. */
export function speakerFor(w: World, line: SceneLine): string {
  const here = (name: string): boolean => (ORIGINALS as readonly string[]).includes(name) && w.soldiers.some((s) => s.name === name);
  return line.by.find(here) ?? 'RECRUIT';
}
