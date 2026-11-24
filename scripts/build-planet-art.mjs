import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildManifest, renderManifestModule } from './art-lib.mjs';

/** The planet art ids, in drawing order (kept equal to PLANET_ART_IDS in src/screens/planetart.ts by a test). */
export const PLANET_ART_NAMES = [
  'backdrop',
  'outpost_enemy', 'outpost_taken', 'settlement_neutral', 'settlement_allied',
  'wild_a', 'wild_b', 'wild_visited', 'start_ship', 'citadel_enemy', 'citadel_taken',
  'stamp_scorch', 'stamp_cleared', 'stamp_fields',
];

/** Reads `<id>.png` files from `dir` into data URIs, in `PLANET_ART_NAMES` order; a missing folder gives an empty manifest. */
export const buildPlanetManifest = (dir, io) => buildManifest(dir, PLANET_ART_NAMES, 'planet art', io);

export const renderPlanetModule = (manifest) => renderManifestModule({
  script: 'build-planet-art.mjs', dir: 'art-src/planet', typeName: 'PlanetArtId', typeFrom: '../screens/planetart', constName: 'PLANET_ART_DATA',
}, manifest);

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const manifest = buildPlanetManifest('art-src/planet');
  writeFileSync('src/art/planet.generated.ts', renderPlanetModule(manifest));
  console.log(`wrote src/art/planet.generated.ts: ${Object.keys(manifest).length} images`);
}
