export const CAMP_ART_NAMES: readonly string[];
export interface CampArtIo {
  exists(path: string): boolean;
  list(dir: string): string[];
  read(path: string): Uint8Array;
}
export function buildCampManifest(dir: string, io?: CampArtIo): Record<string, string>;
export function renderCampModule(manifest: Record<string, string>): string;
