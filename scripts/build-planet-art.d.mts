export const PLANET_ART_NAMES: readonly string[];
export interface PlanetArtIo {
  exists(path: string): boolean;
  list(dir: string): string[];
  read(path: string): Uint8Array;
}
export function buildPlanetManifest(dir: string, io?: PlanetArtIo): Record<string, string>;
export function renderPlanetModule(manifest: Record<string, string>): string;
