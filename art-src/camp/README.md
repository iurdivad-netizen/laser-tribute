# Camp and face art

Painted with PixelLab (`create_image_pixen`, 1 generation each, trial plan) on 2026-11-24 and processed with Pillow (colour
reduction, hard alpha on sprites, the small faces cut from the 64 px ones). The game bakes these PNGs into
`src/art/camp.generated.ts` with `npm run art`; file names are the art ids (see `CAMP_ART_IDS` in `src/screens/campart.ts`).

Settings: `view: high top-down`, no text. Sprites `no_background: true` with a single colour black outline; the backdrop is opaque,
lineless. Faces `view: side`, opaque, lineless, medium detail, shared style sentence "gritty hand-painted pixel portrait, head and
shoulders, dark moody lighting, scarred, worn, realistic proportions".

| File | Size | Prompt (shortened) | PixelLab job id |
|---|---|---|---|
| `camp_backdrop.png` | 480 x 400, 48 colours | fenced frontier military camp from directly above, dusty ground, timber and wire fence, a cross of dirt paths, a stone fire pit with embers, an open gate at the bottom, empty dirt where buildings stand, no buildings or people | `83645e8d-e637-4ce0-90b6-ee664488a8eb` |
| `lab_idle.png` | 120 x 72 | research laboratory: a domed roof with solar panels and a blue-lit door, quiet | `f7b3bfad-46e2-4f22-a3f2-fbb9fc30f21c` |
| `barracks.png` | 120 x 72 | long low timber bunkhouse, red-brown corrugated roof, a chimney | `384448e0-af66-4080-bd54-570c179b1c64` |
| `market.png` | 120 x 72 | trader stalls with striped awnings, crates and barrels | `949f4d6d-8707-4c79-945e-1b970fca4831` |
| `training_built.png` | 64 x 64 | round sand training ring with a low rail and two straw targets | `c690c266-735f-42a3-8995-1b6855381523` |
| `hospital_built.png` | 120 x 72 | white field hospital with a red cross on the roof | `c67a3175-4b98-46a7-9056-454f15f3aa5d` |
| `face_alvarez.png` (+ `_s`, 16 x 16) | 64 x 64 | steady middle-aged commander, short grey hair, deep lines, calm hard stare, dark green collar | `3d0732b9-0f9d-4be4-b01a-62fcc35cb0ec` |
| `training_plot.png` | 64 x 64 | empty sand training plot marked with four wooden stakes and rope, bare dusty ground | `5643eba9-9bef-45eb-8041-2fd24cffb8ec` |
| `hospital_plot.png` | 120 x 72 | empty cleared dirt plot for a field hospital, foundation posts and string lines | `e5e941cd-11f2-4eb2-a7f2-5d3b148b3f3e` |
| `face_brandt.png` (+ `_s`) | 64 x 64 | blunt broad-jawed veteran, shaved head, scar across the cheek, dark olive collar | `32f764e9-7e75-4359-bcb3-b5a758b35813` |
| `face_chen.png` (+ `_s`) | 64 x 64 | wry medic-tinkerer, round goggles pushed up, messy black hair, dark teal collar | `652162ed-ad30-4c25-8dbe-2c30a1f4d306` |
| `face_dubois.png` (+ `_s`) | 64 x 64 | young hopeful soldier, freckled face, crooked grin, messy ginger hair, dark brown collar | `1ab62128-4f4e-4046-90fb-f82c36215656` |

Not painted yet (the game falls back to its plain look for each): `face_recruit` (and `_s`), and the state sprites `lab_busy`,
`training_busy`, `hospital_busy`. Prompts for them are in `docs/superpowers/plans/2026-11-24-story-mode-camp-portraits.md` (Task 7).
The second batch (2026-11-25, five bonus generations, one attempt each) painted the three named faces and the two empty-plot sprites,
processed the same way as above.

The gate at the bottom and the fire pit in the middle are painted into the backdrop, so there is no `gate` sprite.

Raw downloads: `GET https://api.pixellab.ai/mcp/images/<job id>/download`. The processing step was a one-off Pillow script: the backdrop
median-cut to 48 colours; sprites to 24 colours with hard alpha (alpha >= 128 opaque); faces to 24 colours; the small faces a 4 x 4 box
downscale of the 64 px face, reduced to 16 colours.
