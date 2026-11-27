export type FaceName = 'chen' | 'dubois' | 'woman' | 'veteran' | 'man' | 'blonde';
export interface FacePick { head: FaceName; eyes: FaceName; mouth: FaceName; clothes: FaceName }
export const FACES: readonly FaceName[];
export function isAllowed(pick: FacePick): boolean;
export function allowedPicks(): FacePick[];
export function mixFace(pick: FacePick): { width: number; height: number; rgba: Uint8Array };
