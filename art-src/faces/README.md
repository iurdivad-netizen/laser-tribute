# Mixed faces

Four straight-front portraits painted with PixelLab (`create_image_pixen`, 1 generation each, trial plan) on 2026-11-27,
64 x 64, saved as downloaded. `scripts/mix-faces.mjs` mixes them with the archived `chen` and `dubois` portraits
(`art-src/archive/pixellab-faces/`). The game does not use any of this yet: it draws faces in code (`src/art/facegen.ts`).

```
node scripts/mix-faces.mjs sheet.png
```

writes every allowed face (337, the six originals included) to one contact sheet.

## Prompts

Settings: `direction: south`, no `view`, opaque, lineless, medium detail. Every prompt starts with "gritty hand-painted pixel
portrait, head and shoulders, dark moody lighting, scarred, worn, realistic proportions" and ends with "plain very dark
background". All but `woman` also say "passport photo pose, strict front view, face not turned, both ears equally visible,
shoulders level and square to the camera, symmetrical face looking straight at the camera, nose centred"; `woman` says
"strict front view, symmetrical face looking straight at the camera, nose centred".

| File | Character part of the prompt | PixelLab job id |
|---|---|---|
| `face_woman.png` | Weathered woman soldier, cropped black hair, thin scar over one eyebrow, dark olive collar | `a34f4966-3847-480d-8bf2-74fa8e316ebb` |
| `face_veteran.png` | Veteran man soldier, short grey crew cut, clean-shaven, broad jaw, scar across one cheek, dark grey collar | `0ff69c2c-e34f-47eb-b80d-5e39e37b97c6` |
| `face_man.png` | Young man soldier, dark brown skin, short black hair, narrow face, small scar through one eyebrow, dark brown collar | `748665d3-df9c-4a0e-a8c9-37cb6bb4d537` |
| `face_blonde.png` | Young woman soldier, blonde hair tied back tight, round face, small scar on the chin, dark blue collar | `0d3c4fa5-dc8f-4e78-a2ac-901e6b55afbf` |

One other attempt (the veteran without the pose wording, job `9f2368cf-c556-4fd3-9eca-a0df08fc030f`) came out turned and was
not kept.

## Swaps that are never drawn

Judged by eye on 2026-11-27; the lists follow `SOURCES` in `scripts/mix-faces.mjs`. A face may always keep its own parts.

| Part | Rule | Why |
|---|---|---|
| Eyes | only `dubois`, `man` and `blonde` lend theirs | `chen`: blank with a dark bar; `woman`: look like black eyes; `veteran`: bring a red nose mark |
| Mouth | only `woman`, `veteran` and `man` lend theirs | `chen`: black stroke by the lips; `dubois`: grin drips black; `blonde`: blood-like mark |
| Mouth | `woman` and `blonde` heads never take the `veteran` mouth | stubble |
| Clothes | `chen` and `man` heads never wear the `woman` or `veteran` collar | black block under the chin |
| Clothes | the `blonde` head never wears the `woman` collar | black block under the chin |

## Adding a portrait

It must face straight front. Add its file to `SOURCES` with the background colour, the eye and mouth rows and the jaw
points (measured by hand on an enlarged copy), then look at its swaps and extend the rules.
