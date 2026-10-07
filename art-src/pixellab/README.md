# PixelLab sources

The soldier and enemy figures in `src/art/figures.generated.ts` are converted from these PNGs by `node scripts/build-figures.mjs`.

- Generator: PixelLab (https://pixellab.ai), standard mode, 8 directions, size 32 (48x48 canvas), high top-down, black outline, flat shading, low detail, chibi proportions, no weapon. Terms: https://pixellab.ai/termsofservice
- `squad/`: character "Laser Tribute Standard 32", id `ee5cbe29-bf0c-4202-bfc9-3c82b21704cf`, generated 2026-10-07. Prompt: blue-uniform soldier with a big round blue helmet, arms at the sides, no weapon, chunky retro squad game sprite.
- `enemy/`: character "Laser Tribute Enemy 32", id `69bb7c81-d0e2-4243-8b26-3e4addeb32d3`, generated 2026-10-07. Prompt: enemy soldier in a dark red uniform with a black cap and a dark red vest, arms at the sides, no weapon, chunky retro squad game sprite.
- File names are the views the game uses: n, ne, e, se, s (PixelLab north, north-east, east, south-east, south). West-side facings are mirrors made in the game.
