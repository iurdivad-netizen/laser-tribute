import { writeFileSync } from 'node:fs';
import { buildFigureData, renderModule } from './figures-lib.mjs';

const data = buildFigureData('art-src/pixellab');
writeFileSync('src/art/figures.generated.ts', renderModule(data));
console.log(`wrote src/art/figures.generated.ts: ${data.width}x${data.height}`);
