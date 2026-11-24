# Story mode, project 3c: the painted camp and the portraits (design)

Part of project 3 (story and art). 3a (story spine) and 3b (planet map art) are merged. 3c paints the base screen as a
camp you click, and gives the mercenaries faces. 3d (audio) comes later and gets its own design.

## Intent and why

Rui wants STORY to be "a beautiful, well built and enjoyable game". Today the base is six flat status tiles. Rui chose
**a painted base scene you click, not tiles; for now**: a fenced camp seen from above (the same viewpoint as the planet
map), with the buildings painted and clickable, so the base feels like a place and shows what is going on in it. Rui
also wants **portraits in the story scenes and in the barracks list, as gritty painted faces**, so the four named
mercenaries become people and a loss means something.

## Goals

- The base screen is a painted camp: ground, fence, paths and a fire pit as one backdrop, with a painted sprite for each
  building. The six buildings and the gate back to the planet are clickable on the painting. The tiles go away
  (a tile is only the per-building fallback when its sprite is missing).
- The camp shows state: Training and Hospital are an empty plot until researched, then a building; the Lab glows while
  it researches; the training ring shows a soldier while someone trains; the Hospital shows beds while someone is wounded.
- Five gritty painted faces (Alvarez, Brandt, Chen, Dubois, and a generic recruit). Each shows in the story scene's
  64 x 64 portrait slot and as a small face in each row of the BARRACKS panel list.
- Art can ship in phases: any image that is not baked yet falls back to today's look for that piece only.

## Non-goals

- No change to rules, costs, the status text under each building (it stays, printed over the painting), the panels'
  layout apart from the face in the barracks rows, or Tutorial and Campaign.
- No animation, no day/night, no characters walking about in the camp, no portraits on the squad-selection screen
  (a possible follow-up), no per-name faces for later hires (they all use the recruit face).
- No audio (3d).

## Anti-goals

- A camp where the click areas do not match the painted buildings.
- Status text that is hard to read over the painting.
- Four faces that look like the same person, or faces that look pasted on (clean bright cartoons next to the gritty planet).
- A fallback that leaves a black screen: a camp with no art must still be a usable base.

## Constraints from the code and tools

- The base screen is `drawBase` in `src/screens/base.ts`, laid out from `BUILDINGS` (six tiles of 140 x 92 and a bar) on
  the 480x400 menu space; hit testing is `baseHit`; status lines come from `buildingStatus` (`levelsOf(done)` gives
  `training` and `hospital` levels, `w.research.active`, soldier `status` `'training' | 'wounded'`). Tests cover the
  current rectangles.
- The scene portrait slot is `SCENE.portrait` (64 x 64) in `src/screens/scene.ts` (a framed initial today); the speaker
  name comes from `speakerFor` (`ORIGINALS` or `RECRUIT`).
- The barracks panel rows are 444 x 21 px (`PANEL.rows` in `src/screens/basepanels.ts`); a face must fit inside a row.
- Art pipeline from 3b: PNG files in `art-src/...`, a bake script (`npm run art`) writes a generated manifest of data URIs,
  a loader (`src/art/planetimages.ts`) decodes lazily, screens draw with a plain fallback and tests run with no art.
  3c reuses it (generalised so one loader serves the planet, camp and face sets).
- Tests draw with a stub context and no canvas: drawing must never throw without art.
- The build must not grow by more than about 250 KB for the whole camp and face set.
- **Art budget:** PixelLab is a trial: 7 plan generations left plus 4 bonus today (the bonus refills about 5 a night, up
  to 20). `create_image_pixen` is 1 generation per image (opaque backdrops up to 262,144 px area, sprites with
  transparency up to 256 x 256; the free plan runs one job at a time). The full set below is about 17 images before retries.

## Approaches considered

1. **Backdrop plus building sprites with states (chosen by Rui).** One painted camp backdrop; each building its own small
   painting per state; code places them from a layout list. Shows what is happening; about 12 camp images; ships in phases.
2. One static painted camp with no states: about 1 generation, but "not built" and "busy" stay text only.
3. A camp built from tiles: more reshaping but needs tilesets, a composer and seam work; dropped (as for the planet).

## Design

### The camp layout (data)

`CAMP` replaces `BUILDINGS` as the layout (same ids, same `Building` shape: `id`, `name`, rect), laid out on the
480x400 space like the approved sketch B (a fence with paths in a cross):

| id | rect (x, y, w, h) | painted as |
|---|---|---|
| `lab` | 46, 56, 130, 90 | top left building |
| `barracks` | 300, 56, 130, 90 | top right building |
| `market` | 46, 206, 130, 100 | bottom left stalls |
| `hospital` | 300, 206, 130, 100 | bottom right building |
| `wait` | 206, 150, 68, 58 | the fire pit in the middle (painted into the backdrop; clickable) |
| `training` | 206, 226, 68, 68 | the ring below the fire |
| `planet` | 190, 322, 100, 60 | the gate at the bottom edge |

The exact numbers are a builder's call within these rules: no two rectangles overlap, every one is at least 44 px
on its short side (touch targets), all lie inside the fence, and the base header line stays free. `baseHit` and the
tests use `CAMP`.

### Layers, drawn in this order

1. **Backdrop** `camp_backdrop` (480 x 400): ground, fence, paths, the fire pit and the footprint of each plot. Plain dark
   fill when missing.
2. **Building sprites**, centred in their rectangle, chosen by the pure function `campLook(w): Record<BuildingId, CampSprite | null>`:
   - `lab`: `lab_busy` while `w.research.active`, else `lab_idle`
   - `barracks`: `barracks`; `market`: `market`
   - `training`: `training_plot` while `levelsOf(done).training === 0`, `training_busy` while any soldier is `'training'`,
     else `training_built`
   - `hospital`: `hospital_plot` while `levelsOf(done).hospital === 0`, `hospital_busy` while any soldier is `'wounded'`,
     else `hospital_built`
   - `wait`: `null` (the fire is in the backdrop); `planet`: `gate`
   A building whose sprite is missing is drawn as today's status tile inside its `CAMP` rectangle (name and two lines;
   for the small rectangles just the name and the first line).
3. **Labels**: over each painted building a dark chip with its name and the two status lines from `buildingStatus`,
   clipped to the rectangle width, so the text stays readable on any painting. The notice line and the header stay.

### Portraits

- Ids `face_alvarez`, `face_brandt`, `face_chen`, `face_dubois`, `face_recruit` (64 x 64, opaque, gritty painted bust,
  head and shoulders, each clearly a different person: age, hair, scars, gear; the recruit a nervous young face).
  Small versions `face_*_s` (16 x 16) are produced from the 64 px files by a box downscale in the bake step, so the
  five faces stay one set.
- `faceFor(name: string): FaceId` (pure): the original's face for the four names, `face_recruit` for anything else.
- Scene: the portrait slot draws `faceFor(speaker)` at 64 x 64 inside the inset frame; when the image is missing, the
  speaker's initial as today.
- Barracks panel: each soldier row draws the small face at the row's left (inside the 21 px height) and the text moves
  right by the face width; the face is `faceFor(soldier.name)`; when missing, no face and the text where it is today.

### Art production and baking

- Sources in `art-src/camp/` (backdrop and sprites, named by id) and `art-src/faces/` (the five 64 px faces), with a README
  of prompts and PixelLab job ids as in `art-src/planet`. Sprites and backdrop quantised to a small palette shared with the
  planet art where it helps; faces to about 24 colours.
- The bake step generalises the 3b script (a list of sets, each with its ids and folder) into one generated manifest per set
  or one combined; the loader becomes generic over the id type. The existing planet behaviour and its tests keep working.
- Phases (images that exist are baked, the rest fall back): **Phase 1**: `camp_backdrop`, `lab_idle`, `barracks`, `market`,
  `training_built`, `hospital_built`, `gate`, and the four named faces (11 images, about the budget available now).
  **Phase 2**: `lab_busy`, `training_plot`, `training_busy`, `hospital_plot`, `hospital_busy`, `face_recruit` (6 images) as
  credits allow.

### Acceptance (checked in the browser pane as well as by tests)

Screenshots of the base at game start (Training and Hospital as plots), after researching them, while the Lab researches,
and with a soldier training and one wounded; a story scene for each of the four voices; the barracks panel with a full
barracks. The clicks land on the painted buildings, the status text is readable, the four faces are clearly different
people and fit the planet's gritty look.

## Budget and decisions that are Rui's

- Phase 1 uses about the 11 generations available now; Phase 2 needs about 6 more plus retries. Waiting for the nightly
  refill (about 5 a night) or topping up the plan is Rui's call; the builder stops and asks when generations run out, and
  each phase ships on its own.
- If a first backdrop or face is not good enough, one retry per image; a second failure: ask.

## What is left to the builder

- Exact rectangles (within the rules), prompts and retries, palette size, label chip design, how the loader is
  generalised, and whether the faces' small versions are baked as separate ids or derived at load time.

## Calls I made (for Rui to check)

- Missing art falls back per building to the old tile, so the camp can ship in phases and never leaves a black screen.
- Faces for later hires all use the recruit face; the squad-selection screen gets no faces yet.
- Small faces are derived from the 64 px faces so the set stays consistent (16 px, fits the 21 px rows).
- The wait button is the fire pit and the training button the ring, both painted into the backdrop; their sprites are
  `null` / state sprites only for the ring.
- The status text stays printed in the game (not painted) so it stays readable and accurate.
