import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildManifest, renderManifestModule } from './art-lib.mjs';

const FACES = ['face_alvarez', 'face_brandt', 'face_chen', 'face_dubois', 'face_recruit'];

/** The camp art ids (kept equal to CAMP_ART_IDS in src/screens/campart.ts by a test). */
export const CAMP_ART_NAMES = [
  'camp_backdrop',
  'lab_idle', 'lab_busy', 'barracks', 'market',
  'training_plot', 'training_built', 'training_busy',
  'hospital_plot', 'hospital_built', 'hospital_busy',
  ...FACES, ...FACES.map((f) => `${f}_s`),
];

/** Reads `<id>.png` files from `dir` into data URIs, in `CAMP_ART_NAMES` order; a missing folder gives an empty manifest. */
export const buildCampManifest = (dir, io) => buildManifest(dir, CAMP_ART_NAMES, 'camp art', io);

export const renderCampModule = (manifest) => renderManifestModule({
  script: 'build-camp-art.mjs', dir: 'art-src/camp', typeName: 'CampArtId', typeFrom: '../screens/campart', constName: 'CAMP_ART_DATA',
}, manifest);

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const manifest = buildCampManifest('art-src/camp');
  writeFileSync('src/art/camp.generated.ts', renderCampModule(manifest));
  console.log(`wrote src/art/camp.generated.ts: ${Object.keys(manifest).length} images`);
}
