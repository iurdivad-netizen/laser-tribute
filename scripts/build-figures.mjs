import { writeFileSync } from 'node:fs';
import { buildFigureData, buildImageData, renderImagesModule, renderModule } from './figures-lib.mjs';

const data = buildFigureData('art-src/pixellab');
writeFileSync('src/art/figures.generated.ts', renderModule(data));
console.log(`wrote src/art/figures.generated.ts: ${data.width}x${data.height}`);

const images = buildImageData('art-src/pixellab');
writeFileSync('src/art/images.generated.ts', renderImagesModule(images));
console.log(`wrote src/art/images.generated.ts: ${Object.keys(images.images).length} images`);
