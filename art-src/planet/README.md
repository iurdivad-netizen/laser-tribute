# Planet map art

Painted with PixelLab (`create_image_pixen`, 1 generation each, the free plan's trial) on 2026-11-24 and processed with
Pillow (crop, colour reduction, soft stamp edges). The game bakes these PNGs into `src/art/planet.generated.ts` with
`npm run art`; file names are the art ids (see `PLANET_ART_IDS` in `src/screens/planetart.ts`).

Common settings: `view: high top-down`, no text. Emblems and stamps `no_background: true`.

| File | Size | Prompt (shortened) | PixelLab job id |
|---|---|---|---|
| `backdrop.png` | 330 x 372 (generated 332 x 372, cropped; 48 colours) | top-down painted frontier colony land: dust flats south, marsh and steppe west, grey industrial wasteland east, glass barrens centre, dark ground north; no buildings, roads or text. lineless, medium detail, opaque | `7cceae52-2522-4c58-ab4d-f3f1bf1744b7` |
| `outpost_enemy.png` | 20 | enemy military outpost: grey watchtower and canvas tent with a red flag | `75128bbc-e60d-4d0a-8d66-388e4d65ef29` |
| `outpost_taken.png` | 20 | captured outpost: ruined stone walls with a green banner | `e76068f1-6044-46cd-ba04-d4694df95033` |
| `settlement_neutral.png` | 20 | tiny frontier village: three houses with orange clay roofs and a well (second attempt) | `74f153df-f01f-4254-b03c-1143dc63b2cf` |
| `settlement_allied.png` | 20 | thriving village: three houses with blue roofs, lit yellow windows, a blue flag (second attempt) | `1bb1eaa9-83d6-486b-8db1-7383ab78b9dd` |
| `wild_a.png` | 20 | wilderness: dry trees and rocks | `d2af9754-030e-48bf-92e2-641e42eafc81` |
| `wild_b.png` | 20 | wilderness: boulders and scrub | `e23733bd-6f2b-4bc4-b5b0-96ef5537a3d5` |
| `wild_visited.png` | 20 | picked-over wilderness: an empty open crate and a grey rock | `8ae3f3cc-86a1-46a9-be6b-e7832fe7e717` |
| `start_ship.png` | 24 | landed grey dropship with a green beacon | `5e04cd16-af11-46af-80a9-a3ad729f8eb9` |
| `citadel_enemy.png` | 32 | corporate fortress: dark tower, walled keep, red warning lights | `70602ebf-009e-4812-8f54-49042f5690f9` |
| `citadel_taken.png` | 32 | the same fortress with a large green banner | `e7a0ea0d-6954-4e95-9111-87fd5bbefa9d` |
| `stamp_scorch.png` | 48 | soft round patch of scorched black earth (edges softened and darkened after) | `e5ea3ce2-be76-4eba-9374-2dd86799cc23` |
| `stamp_cleared.png` | 48 | soft round patch of cleared green grass (edges softened, desaturated after) | `9f20ea77-9672-4b4b-9abb-96da4038950f` |
| `stamp_fields.png` | 48 | soft round patch of tilled fields (edges softened after) | `f7dbb17c-a54e-4517-abdb-ed132ffec775` |

Raw downloads: `GET https://api.pixellab.ai/mcp/images/<job id>/download`. The processing script (crop to 330 x 372, median-cut
to 48 colours for the backdrop and 24 for sprites with hard alpha, smoothstep alpha falloff on the stamps) was a one-off
Pillow script; to redo an asset, download the raw image again, apply the same steps, and run `npm run art`.
