import type { FaceName, Portrait } from '../src/art/facemix';
export function preparePortraits(): Record<FaceName, Portrait>;
export function renderFacesModule(portraits: Record<FaceName, Portrait>): string;
