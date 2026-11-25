# Generated faces and random recruit names — design

Small project, requested 2026-11-25. Approach 3 (hybrid) chosen in conversation.

## Intent
Only the four originals (Alvarez, Brandt, Chen, Dubois) have painted faces. Every other soldier shares one `face_recruit` image that is not even painted yet. Story-mode hires should each get their own face without anyone painting each one, and a name that is not the next entry of a fixed list.

## Goals
- Every Story-mode soldier who is not an original gets a face composed from parts, the same face every time for the same soldier, in both sizes (64x64 scene portrait, 16x16 roster face).
- New Story hires get random names. Same world seed and hire count give the same name, so a run is reproducible.
- The four painted originals stay exactly as they are.

## Non-goals
- Tutorial and Campaign: unchanged, including `soldierName` and their roster names.
- No face editor, no ageing, no face change on promotion, no PixelLab spend, no new save fields.

## Design
**Faces (hybrid).** A pure function `faceSpec(name): FaceSpec` in `src/core` hashes the name into part choices: skin tone, hair style, hair colour, eyes, brows, mouth, facial hair, one optional extra (scar, glasses, headband). The renderer in `src/art` composes pixel-grid layers (the same char-and-palette format as the sprites) onto an offscreen canvas and caches it per name. Skin, eyes, brows and mouth are simple shared grids recoloured by palette. Hair and headgear are a few more detailed templates, so silhouettes differ. One authoring size; the small face is derived from it. `faceFor(name)` keeps returning the painted id for originals and signals "generated" for everyone else. If no canvas is available (node tests), the drawing code falls back to `face_recruit`, as today.

**Names.** Story only. `hire` (and any Story replacement path) picks from a pool of about 120 surnames of mixed origin, at most 10 characters, chosen by a hash of (`world.seed`, `namesUsed`). The pool excludes the four originals and the 12 old list names, and a pick that collides with a current or fallen soldier is re-rolled. Old saves keep their names; their faces are generated from the name like any other.

**Why a name works as the seed.** Soldiers have no id; squad, saves and scenes already match by name. Names are unique within a world, so the name is a stable face key and nothing new is saved.

## Approaches
1. Code-drawn parts only: smallest, but every silhouette looks alike.
2. Painted layer sheets via PixelLab: best look, but parts will not line up reliably, it costs generations per part, and it needs 16x16 versions.
3. Hybrid (chosen): code-drawn recoloured basics plus a handful of distinct hair and headgear templates. Can be polished later by repainting templates without changing the structure.

## Left to the builder
Part counts and exact grids and palettes (aim for many thousand distinct faces, but start small), the pool's exact names, how the small face is derived, and how `Art` exposes a generated face while keeping the test fakes working.

## Review focus
- Same name always gives the same face and same seed plus hire count the same name.
- No generated name equals an original, a current soldier or a fallen one; every name fits the 120 px name column.
- Tutorial and Campaign naming and drawing unchanged.
- An old save with `Eriksen` or `Alvarez 2` still loads and draws.
