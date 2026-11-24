import { levelsOf } from '../core/world/base';
import { ORIGINALS } from '../core/world/story';
import type { World } from '../core/world/world';
import type { BuildingId } from './base';

export type CampSpriteId =
  | 'lab_idle' | 'lab_busy' | 'barracks' | 'market'
  | 'training_plot' | 'training_built' | 'training_busy'
  | 'hospital_plot' | 'hospital_built' | 'hospital_busy';
export type FaceId = 'face_alvarez' | 'face_brandt' | 'face_chen' | 'face_dubois' | 'face_recruit';
/** Every image of the camp set: the backdrop, the building sprites, the faces and their small versions. */
export type CampArtId = 'camp_backdrop' | CampSpriteId | FaceId | `${FaceId}_s`;

export const CAMP_SPRITE_IDS: readonly CampSpriteId[] = [
  'lab_idle', 'lab_busy', 'barracks', 'market',
  'training_plot', 'training_built', 'training_busy',
  'hospital_plot', 'hospital_built', 'hospital_busy',
];
export const FACE_IDS: readonly FaceId[] = ['face_alvarez', 'face_brandt', 'face_chen', 'face_dubois', 'face_recruit'];
export const CAMP_ART_IDS: readonly CampArtId[] = [
  'camp_backdrop', ...CAMP_SPRITE_IDS, ...FACE_IDS, ...FACE_IDS.map((f) => `${f}_s` as const),
];

/** Pixel size of each building sprite. */
export const SPRITE_SIZE: Record<CampSpriteId, { w: number; h: number }> = {
  lab_idle: { w: 120, h: 72 }, lab_busy: { w: 120, h: 72 }, barracks: { w: 120, h: 72 }, market: { w: 120, h: 72 },
  training_plot: { w: 64, h: 64 }, training_built: { w: 64, h: 64 }, training_busy: { w: 64, h: 64 },
  hospital_plot: { w: 120, h: 72 }, hospital_built: { w: 120, h: 72 }, hospital_busy: { w: 120, h: 72 },
};

/** Which sprite each building shows now: a plot until the facility is researched, then built, busy while it is in use. */
export function campLook(w: World): Record<BuildingId, CampSpriteId | null> {
  const levels = levelsOf(w.research.done);
  const facility = (level: number, busy: 'training' | 'wounded', plot: CampSpriteId, built: CampSpriteId, inUse: CampSpriteId): CampSpriteId =>
    level === 0 ? plot : w.soldiers.some((s) => s.status === busy) ? inUse : built;
  return {
    lab: w.research.active ? 'lab_busy' : 'lab_idle',
    barracks: 'barracks',
    market: 'market',
    training: facility(levels.training, 'training', 'training_plot', 'training_built', 'training_busy'),
    hospital: facility(levels.hospital, 'wounded', 'hospital_plot', 'hospital_built', 'hospital_busy'),
    wait: null, // the fire pit and the gate are painted into the backdrop
    planet: null,
  };
}

/** The face for a name: the four mercenaries' own, and the recruit's for everyone else (later hires, a fallen speaker). */
export function faceFor(name: string): FaceId {
  const original = (ORIGINALS as readonly string[]).indexOf(name);
  return original >= 0 ? (`face_${name.toLowerCase()}` as FaceId) : 'face_recruit';
}
