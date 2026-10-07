# PixelLab sources

The soldier and enemy figures in `src/art/figures.generated.ts` are converted from these PNGs by `node scripts/build-figures.mjs`.

- Generator: PixelLab (https://pixellab.ai), standard mode, 8 directions, size 32 (48x48 canvas), high top-down, black outline, flat shading, low detail, chibi proportions, no weapon. Terms: https://pixellab.ai/termsofservice
- `squad/`: character "Laser Tribute Standard 32", id `ee5cbe29-bf0c-4202-bfc9-3c82b21704cf`, generated 2026-10-07. Prompt: blue-uniform soldier with a big round blue helmet, arms at the sides, no weapon, chunky retro squad game sprite.
- `enemy/`: character "Laser Tribute Enemy 32", id `69bb7c81-d0e2-4243-8b26-3e4addeb32d3`, generated 2026-10-07. Prompt: enemy soldier in a dark red uniform with a black cap and a dark red vest, arms at the sides, no weapon, chunky retro squad game sprite.
- File names are the views the game uses: n, ne, e, se, s (PixelLab north, north-east, east, south-east, south). West-side facings are mirrors made in the game.

## Stage 2 (2026-10-08)

- `tiles/wall.png`: PixelLab top-down tileset id `1b08e4ca-a47c-4521-8d0e-995b68c071ee` (standard mode, 16 px, high top-down, medium detail, flat shading, single colour outline, lower "dark worn metal floor panels with faint seams", upper "grey brick wall, seen from above"); the all-upper tile. Terms: https://pixellab.ai/termsofservice
- Tried and rejected: the same tileset's floor (olive, with rows of black slots that read as a grating), a second tileset `0a4a6dae-a63a-4049-b414-0a95ede242dd` (calmer blue-grey floor, but its wall came out pale blue), and a 16 px rifle from `create_object_pro_flash` (object `7879f9be-72ca-4945-bd6f-7da5abf60f3b`: it drew the rifle standing upright and unreadable; this tool costs about 4 generations per piece, and `create_map_object` cannot go below 32 px).
- Hand-drawn in `scripts/hand-images.mjs` (palette per piece, in the style of the soldiers): `floor_a` (dark neutral panels; the mirrored and turned variants are made by the converter), both doors, the three items and both corpses.
