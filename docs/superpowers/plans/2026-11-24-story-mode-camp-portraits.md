# Story Mode Camp and Portraits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the base screen into a painted, clickable camp whose buildings show state, and give the four mercenaries (and a generic recruit) painted faces in story scenes and the barracks list.

**Architecture:** Pure `campLook(world)` picks a sprite per building and `faceFor(name)` picks a face. The 3b image loader is generalised so one loader serves the planet, camp and face sets. `drawBase`, `drawPanel` and `drawScene` take an optional art object and fall back to today's look for each piece whose image is missing. Art is produced with PixelLab, baked from `art-src/camp` by a script, in two phases.

**Tech Stack:** TypeScript strict, Canvas 2D, Vitest, Vite, PixelLab MCP (`mcp__pixellab__*`), Pillow for the post-processing. Run: `npm test`, `npm run typecheck`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-11-24-laser-tribute-story-mode-camp-portraits-design.md`

## Global Constraints

- Rules, costs, status text and panel layouts do not change, apart from the camp rectangles and the face in barracks rows. Tutorial and Campaign are untouched.
- The `BUILDINGS` export keeps its name and shape (`id`, `name`, `x`, `y`, `w`, `h`); only the rectangles change, to the camp layout in Task 3. Rectangles: no overlaps with a gap of at least 12 px (existing test), each at least 44 px on its short side, all inside 480x400 and clear of the header line (y >= 28).
- With no image decoded, or no canvas, every screen draws as it does today (tiles on black, an initial in the scene slot, no faces) and never throws.
- Image sizes: `camp_backdrop` 480x400 opaque; sprites with transparency: `lab_idle`, `lab_busy`, `barracks`, `market`, `hospital_plot`, `hospital_built`, `hospital_busy` 120x72; `training_plot`, `training_built`, `training_busy` 64x64; `gate` 96x48; faces `face_alvarez`, `face_brandt`, `face_chen`, `face_dubois`, `face_recruit` 64x64 opaque and `face_*_s` 16x16.
- The camp and face set adds at most 250 KB of base64 text to the build.
- PixelLab trial: 7 plan generations plus the bonus (4 on 2026-11-24, refilling about 5 a night); the free plan runs one job at a time; `create_image_pixen` is 1 generation per image. Phase 1 is 11 images. Never go past the balance without asking Rui; one retry per image, a second failure: ask.

## Review Focus

- Backdrop missing, or a single sprite missing: the camp is still usable (black ground with tiles, or a tile in that building's rectangle) (Task 3).
- The clickable rectangles and the painted positions agree, never overlap, and a touch slop of 5 never reaches a neighbour (Task 3).
- `campLook` gives a valid sprite or null for every combination of research level, active research, training and wounded soldiers (Task 1).
- Faces: a fallen original (scene speaker RECRUIT) and hires named like `Alvarez 2` get the recruit face, never an original's (Task 1, 4).
- Status text stays readable and inside the screen whatever is painted behind it: every painted building has a dark chip behind its text (Task 3).

---

### Task 1: What each building and face looks like

**Files:**
- Create: `src/screens/campart.ts`
- Test: `tests/campart.test.ts`

**Interfaces:**
- Consumes: `World` from `../core/world/world`; `levelsOf` from `../core/world/base`; `ORIGINALS` from `../core/world/story`; `BuildingId` from `./base`.
- Produces from `src/screens/campart.ts`:
  ```ts
  export type CampSpriteId = 'lab_idle' | 'lab_busy' | 'barracks' | 'market' | 'training_plot' | 'training_built' | 'training_busy'
    | 'hospital_plot' | 'hospital_built' | 'hospital_busy' | 'gate';
  export type FaceId = 'face_alvarez' | 'face_brandt' | 'face_chen' | 'face_dubois' | 'face_recruit';
  export type CampArtId = 'camp_backdrop' | CampSpriteId | FaceId | `${FaceId}_s`;
  export const CAMP_SPRITE_IDS: readonly CampSpriteId[];
  export const FACE_IDS: readonly FaceId[];
  export const CAMP_ART_IDS: readonly CampArtId[];            // backdrop, 11 sprites, 5 faces, 5 small faces = 22, in that order
  export const SPRITE_SIZE: Record<CampSpriteId, { w: number; h: number }>;   // from Global Constraints
  export function campLook(w: World): Record<BuildingId, CampSpriteId | null>;
  export function faceFor(name: string): FaceId;               // exact original name, else face_recruit
  ```

- [ ] **Step 1: Write the failing tests** (`tests/campart.test.ts`), on `newWorld(1, 'calm')`:
  - New world: `lab: 'lab_idle'`, `barracks: 'barracks'`, `market: 'market'`, `training: 'training_plot'`, `hospital: 'hospital_plot'`, `wait: null`, `planet: 'gate'`.
  - `research: { done: ['training1', 'hospital1'], active: null }` gives `training_built` and `hospital_built`; an active research (`{ node: 'shotgun', daysLeft: 3 }`) gives `lab_busy`.
  - With `training1` done and a soldier `status: 'training', daysLeft: 2` gives `training_busy`; with `hospital1` done and a soldier `status: 'wounded', daysLeft: 3` gives `hospital_busy`. A wounded soldier with no hospital (level 0) still gives `hospital_plot`, and a training soldier with no training facility gives `training_plot`.
  - Exhaustive: for `done` in `[[], ['training1'], ['hospital1'], ['training1','hospital1']]`, `active` in `[null, shotgun]`, soldiers none / one training / one wounded, every result value is `null` or in `CAMP_SPRITE_IDS` and every `BuildingId` key is present.
  - `faceFor`: the four original names give their `face_*`; `'RECRUIT'`, `'Eriksen'`, `'Alvarez 2'`, `'alvarez'` and `''` give `face_recruit`.
  - `CAMP_ART_IDS` has 22 unique entries starting with `camp_backdrop`; `SPRITE_SIZE` has a positive width and height for each sprite id, 120x72 for the Lab, Barracks, Market and Hospital sprites, 64x64 for the Training ones and 96x48 for `gate`.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/campart.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/screens/campart.ts`** per the Interfaces block. Rules in `campLook`: `lab` is `lab_busy` when `w.research.active`, else `lab_idle`; `training` is `training_plot` when `levelsOf(done).training === 0`, else `training_busy` when any soldier is `'training'`, else `training_built`; `hospital` likewise with `hospital` and `'wounded'`; `barracks`, `market` fixed; `wait` null; `planet` `gate`. `faceFor` matches the four `ORIGINALS` names exactly (case-sensitive).
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/campart.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/screens/campart.ts tests/campart.test.ts
  git commit -m "feat: campLook and faceFor, the ids of the camp and face art"
  ```

---

### Task 2: One loader for every art set, and the camp bake

**Files:**
- Modify: `src/art/planetimages.ts` (generalise), `scripts/build-planet-art.mjs` (extract the shared part), `package.json` (`art` script)
- Create: `scripts/build-camp-art.mjs`, `scripts/build-camp-art.d.mts`, `src/art/camp.generated.ts` (generated, empty for now)
- Test: `tests/planetimages.test.ts` (extend), `tests/campbake.test.ts`

**Interfaces:**
- Consumes: `CAMP_ART_IDS` (Task 1).
- Produces:
  - `src/art/planetimages.ts`: `export interface Art<Id extends string> { image(id: Id): CanvasImageSource | null }`; `export type PlanetArt = Art<PlanetArtId>`; `export function createArt<Id extends string>(data: Partial<Record<Id, string>>, onLoad: () => void, make?): Art<Id>` (the current `createPlanetArt` body; it preloads every id in `data`); `export const createPlanetArt = createArt<PlanetArtId>` kept so existing callers and tests work; `NO_ART` typed so it is accepted wherever an `Art<Id>` is (`{ image: () => null }`).
  - `scripts/build-planet-art.mjs` exports a shared `buildManifest(dir, names, io?)` and `renderManifestModule({ importType, importPath, constName, source }, manifest)`; `buildPlanetManifest` and `renderPlanetModule` stay as they are (planet tests keep passing).
  - `scripts/build-camp-art.mjs` exports `CAMP_ART_NAMES` (the 22 ids), `buildCampManifest(dir, io?)`, `renderCampModule(manifest)`; run as a script it reads `art-src/camp` and writes `src/art/camp.generated.ts` with `export const CAMP_ART_DATA: Partial<Record<CampArtId, string>>`.

- [ ] **Step 1: Write the failing tests.**
  - Extend `tests/planetimages.test.ts`: `createArt` with a string-literal id type behaves like `createPlanetArt` (preloads every key in `data`, returns the image only after decode, one image per id); `createPlanetArt` still exists and behaves the same.
  - `tests/campbake.test.ts` (in-memory `io` like `tests/planetbake.test.ts`, the same 1x1 PNG bytes): `CAMP_ART_NAMES` equals `CAMP_ART_IDS`; the manifest of a folder with `camp_backdrop.png` and `face_chen_s.png` has exactly those two keys in id order with `data:image/png;base64,` values; an unknown file name throws `unknown camp art`; a non-PNG throws `not a PNG`; a missing folder gives `{}`; the rendered text is identical whatever the listing order, has no carriage return, starts with `// Generated by scripts/build-camp-art.mjs` and contains `export const CAMP_ART_DATA`; and `CAMP_ART_DATA` equals the PNGs found in `art-src/camp` through `import.meta.glob('../art-src/camp/*.png', { query: '?inline', import: 'default', eager: true })` (an absent folder gives `{}`).
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/planetimages.test.ts tests/campbake.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement.** Move the common loop of `buildPlanetManifest` into `buildManifest(dir, names, io)` (the error text uses a label argument: pass `'planet art'` / `'camp art'` so messages read `unknown planet art` and `unknown camp art`); write `build-camp-art.mjs` on top of it (main-module detection with `pathToFileURL(process.argv[1]).href === import.meta.url`); rename the body of `createPlanetArt` to `createArt` and keep the old name as an alias; add `scripts/build-camp-art.d.mts`; extend the `art` script to `node scripts/build-figures.mjs && node scripts/build-planet-art.mjs && node scripts/build-camp-art.mjs`; run `node scripts/build-camp-art.mjs` once to create the empty `src/art/camp.generated.ts`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/planetimages.test.ts tests/campbake.test.ts tests/planetbake.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite and build**
  Run: `npm test` and `npm run build`
  Expected: green; build succeeds.
- [ ] **Step 6: Commit**
  ```bash
  git add src/art scripts package.json tests/planetimages.test.ts tests/campbake.test.ts
  git commit -m "feat: one art loader for every set, and the camp art bake"
  ```

---

### Task 3: The camp on the base screen

**Files:**
- Modify: `src/screens/base.ts` (`BUILDINGS` rectangles, `drawBase`)
- Test: `tests/basescreen.test.ts` (edit and extend), `tests/campdraw.test.ts`

**Interfaces:**
- Consumes: `campLook`, `SPRITE_SIZE`, `CampArtId`, `CampSpriteId` (Task 1); `Art`, `NO_ART` (Task 2).
- Produces: `BUILDINGS` with the camp rectangles; `drawBase(ctx, w, notice, art?: Art<CampArtId>)`.

Camp rectangles (x, y, w, h) in `BUILDINGS` order `lab, barracks, market, training, hospital, wait, planet` (keep this order): `lab 46,56,130,90`; `barracks 300,56,130,90`; `market 46,206,130,100`; `training 206,226,68,68`; `hospital 300,206,130,100`; `wait 206,150,68,58`; `planet 190,322,100,60`. (The rectangles satisfy the Global Constraints; the builder may move one by a few pixels if a test demands it.)

Drawing: (1) black fill, then `camp_backdrop` at (0, 0, 480, 400) when the image is available; (2) the header text as today; (3) per building: if its `campLook` sprite is non-null and its image is available, draw the sprite centred horizontally in the rectangle and bottom-aligned above the chip, at `SPRITE_SIZE`, then a **chip** (dark `rgba(8,10,18,0.85)` rectangle across the rectangle's width, at its bottom, 26 px high for the six big ones) holding the building name in accent colour and the two `buildingStatus` lines clipped to the width; if there is no sprite (null, or image missing) draw today's tile in that rectangle (frame, name, two lines; for `wait`, `training` and `planet`, whose rectangles are small, name and first line only, centred); the `planet` gate always shows its status line `DAY n   n CR` in its chip; (4) the notice and hint lines as today ("TAP A TILE TO OPEN IT" becomes "TAP A BUILDING TO OPEN IT").

- [ ] **Step 1: Write the failing tests.**
  - `tests/basescreen.test.ts`: update the layout test to the camp rectangles (same ids in the same order; inside the screen; at least 12 px apart; each at least 44 px on its short side; `y >= 28`); keep the hit tests (centre of each hits its id, `baseHit(1,1)` and `baseHit(240, 395)` are null, touch slop 5 never reaches a neighbour, `baseHit(lab.x - 3, ...)` is null without slop and `'lab'` with slop 5); the existing text-fit test runs unchanged; the `drawBase` test also runs with an art argument.
  - `tests/campdraw.test.ts` (recording fake context as in `tests/planetdraw.test.ts`, fake art returning `{ id }` for the available ids): with `NO_ART` no `drawImage` and one tile frame per building; with all art: one `drawImage` for the backdrop at (0, 0, 480, 400) and one per building that has a sprite (5 on a new world: lab, barracks, market, training_plot, hospital_plot, gate = 6) with width and height equal to `SPRITE_SIZE[sprite]`, each centred horizontally in its rectangle and inside it; with only the backdrop available no sprites and a tile for every building; with all art except `lab_idle` the Lab (and only the Lab) is a tile; every painted building also gets a chip (a `fillRect` of the chip colour spanning the rectangle's width); state: with `training1` and `hospital1` researched and a wounded soldier the images drawn are `training_built` and `hospital_busy`; every text drawn passes `unsupportedChars` and lies inside 0..480 (collect with `onText`); the text drawn is the same set of strings for `NO_ART` and for full art, apart from the hint line.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/basescreen.test.ts tests/campdraw.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement** the rectangles and `drawBase` as described. Keep `baseHit`, `buildingStatus` and the `Building` type unchanged. Layers draw in the order above; all coordinates integers.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/basescreen.test.ts tests/campdraw.test.ts tests/baseapp.test.ts` and `npm run typecheck`
  Expected: PASS (baseapp clicks the building centres through `BUILDINGS`, so it follows the new rectangles); typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/screens/base.ts tests/basescreen.test.ts tests/campdraw.test.ts
  git commit -m "feat: the base screen as a painted camp, with a tile for any missing sprite"
  ```

---

### Task 4: Faces in scenes and the barracks list

**Files:**
- Modify: `src/screens/scene.ts` (`drawScene`), `src/screens/basepanels.ts` (`drawPanel`)
- Test: `tests/scenescreen.test.ts` (extend), `tests/basepanels.test.ts` (extend), `tests/facedraw.test.ts`

**Interfaces:**
- Consumes: `faceFor`, `FaceId`, `CampArtId` (Task 1); `Art`, `NO_ART` (Task 2).
- Produces: `drawScene(ctx, v: SceneView, art?: Art<CampArtId>)`; `drawPanel(ctx, id, w, selected, page, notice, art?: Art<CampArtId>)`.

Scene: when `art.image(faceFor(v.speaker))` is available, draw it at the portrait slot (`SCENE.portrait`, 64 x 64) inside a 1 px border instead of the framed initial; otherwise exactly as today. Barracks panel: for each soldier row, when `art.image(`${faceFor(soldier.name)}_s`)` is available draw it 16 x 16 at (row.x + 3, row.y + 2) and draw the label at `row.x + 26` instead of `row.x + 8` (clip width 172 instead of 190); no face, no shift otherwise; other panels are unchanged.

- [ ] **Step 1: Write the failing tests** (`tests/facedraw.test.ts`, recording context and fake art):
  - Scene with the speaker `ALVAREZ` and art for `face_alvarez`: one `drawImage` with the image `face_alvarez` and arguments `(img, 20 + ..)` equal to `(SCENE.portrait.x, SCENE.portrait.y, 64, 64)`; the speaker `RECRUIT` draws `face_recruit`; a speaker whose face is missing draws the initial (the text `A` for ALVAREZ) and no image; with `NO_ART` the scene draws exactly the same text runs as before.
  - Barracks panel for a new world: four `drawImage` calls of 16 x 16 for `face_alvarez_s`, `face_brandt_s`, `face_chen_s`, `face_dubois_s` at each row's left, and each label drawn at `row.x + 26`; a hired `Eriksen` and a soldier named `Alvarez 2` get `face_recruit_s`; with `NO_ART` the labels are at `row.x + 8` and no image is drawn; the lab, market, training, hospital and wait panels draw no images even with all art.
  - All text stays inside 0..480 and in supported characters for a full barracks (12 soldiers, as `tests/squadscreen.test.ts` builds one).
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/facedraw.test.ts tests/scenescreen.test.ts tests/basepanels.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement** the two drawing changes as described; the `SceneView` shape does not change.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/facedraw.test.ts tests/scenescreen.test.ts tests/basepanels.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/screens/scene.ts src/screens/basepanels.ts tests/facedraw.test.ts tests/scenescreen.test.ts tests/basepanels.test.ts
  git commit -m "feat: painted faces in story scenes and the barracks list"
  ```

---

### Task 5: Wire the camp art into the app

**Files:**
- Modify: `src/app.ts` (`AppOptions.campArt`, three draw calls)
- Test: `tests/campapp.test.ts`

**Interfaces:**
- Consumes: `createArt`, `NO_ART`, `Art` (Task 2); `CAMP_ART_DATA` (Task 2); the three draw signatures (Tasks 3 and 4).
- Produces: `AppOptions.campArt?: Art<CampArtId>` (default: `createArt(CAMP_ART_DATA, () => this.wake())` in the real game, `NO_ART` when `opts.store !== undefined`, as for `planetArt`).

- [ ] **Step 1: Write the failing tests** (`tests/campapp.test.ts`, the `setup` pattern of `tests/planetapp.test.ts` with `scenes: false`, plus a way to open the base: click `PLANET.base`): with a fake `campArt` returning `{ id }` for every id, the base screen draws the backdrop and a sprite for each building (`drawImage` ids include `camp_backdrop` and `lab_idle`); the barracks panel draws four `_s` faces; a story scene (use a crafted world as in `tests/sceneapp.test.ts`, scenes on) draws `face_alvarez` at the portrait slot; with the default test options no `drawImage` happens on the base, the barracks panel or a scene; clicking the centre of the Lab rectangle still opens the lab panel and the gate still returns to the planet with art on; `new App({ clock: () => 0, scenes: false })` (real art options) does not throw.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/campapp.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement** the option and pass `this.campArt` as the last argument of `drawBase`, `drawPanel` and `drawScene`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/campapp.test.ts tests/baseapp.test.ts tests/sceneapp.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run everything**
  Run: `npm test` and `npm run build`
  Expected: green; build succeeds.
- [ ] **Step 6: Commit**
  ```bash
  git add src/app.ts tests/campapp.test.ts
  git commit -m "feat: show the camp and faces in the app"
  ```

---

### Task 6: Phase 1 art (11 images) and a look at it on screen

**Files:**
- Create: `art-src/camp/<id>.png` for the Phase 1 ids and their small faces, `art-src/camp/README.md`
- Modify: `src/art/camp.generated.ts` (regenerated)
- Test: `tests/campart-assets.test.ts`

**Interfaces:**
- Consumes: `CAMP_ART_IDS`, `SPRITE_SIZE` (Task 1); the bake script (Task 2).
- Produces: the Phase 1 files: `camp_backdrop`, `lab_idle`, `barracks`, `market`, `training_built`, `hospital_built`, `gate`, `face_alvarez`, `face_brandt`, `face_chen`, `face_dubois`, and `face_alvarez_s`, `face_brandt_s`, `face_chen_s`, `face_dubois_s` (the small faces cost nothing: downscaled from the 64 px ones).

This task is creative and costs generations. Work in this order and stop to ask Rui at any limit below.

- [ ] **Step 1: Check the budget.** `mcp__pixellab__get_balance`; write the result in the ledger. Phase 1 needs 11; if fewer remain, generate as many as fit in the order below and stop (a missing image falls back), then ask Rui. Use `create_image_pixen` for everything (1 generation each; one job at a time: download each result with `GET https://api.pixellab.ai/mcp/images/<job_id>/download`, retrying until it returns 200).
- [ ] **Step 2: Paint the backdrop** (480 x 400, `no_background: false`, `view: high top-down`, `outline: lineless`, `detail: medium detail`): a fenced frontier military camp seen from directly above, dusty brown ground, a timber and wire fence around the edge, a cross of trodden dirt paths, a stone fire pit with glowing embers at the centre, an open gate gap in the fence at the bottom centre, large empty dirt areas where buildings will stand, no buildings, no people, no text, muted and a little dark so bright markers read. Compare with the approved sketch (panel B in `.superpowers/brainstorm/*/content/base-scene-directions.html`): fire pit centre, paths cross, gate at the bottom. Save the raw file outside the repo; one retry allowed.
- [ ] **Step 3: Paint the six sprites** (`no_background: true`, `view: high top-down`, `outline: single color black outline`): `lab_idle` 120 x 72 a domed research lab with solar panels and a blue-lit door, quiet; `barracks` 120 x 72 a long low timber bunkhouse with a red-brown roof; `market` 120 x 72 a trader's stall with striped awnings and crates; `training_built` 64 x 64 a round sand training ring with straw targets; `hospital_built` 120 x 72 a white field hospital with a red cross on its roof; `gate` 96 x 48 a wooden double gate with two watch posts seen from above, ajar. Same gritty, muted palette as the backdrop.
- [ ] **Step 4: Paint the four faces** (64 x 64 `no_background: false`, `view: side`, `outline: lineless`, `detail: medium detail`; one shared style sentence "gritty hand-painted pixel portrait, head and shoulders, dark moody lighting, scarred, worn, realistic proportions"): Alvarez a steady middle-aged commander with short grey hair and a calm hard stare; Brandt a blunt broad-jawed veteran with a shaved head and a scar across the cheek; Chen a wry medic-tinkerer with round goggles pushed up and messy black hair; Dubois a young hopeful soldier with a freckled face and a crooked grin. Pick the best, make sure the four look like four different people.
- [ ] **Step 5: Process** with a one-off Pillow script (kept in the scratchpad, described in the README): backdrop median-cut to 48 colours; sprites to 24 colours with hard alpha (alpha >= 128 is opaque); faces to 24 colours; the four small faces from the 64 px faces with a 4 x 4 box downscale and the same palette step; check every size equals `SPRITE_SIZE` or 64 / 16. Write `art-src/camp/README.md` (tool, prompt, job id and attempt for every image, as in `art-src/planet/README.md`).
- [ ] **Step 6: Write the asset test** `tests/campart-assets.test.ts`: every file in `art-src/camp` is `<id>.png` with an id in `CAMP_ART_IDS`; the 15 Phase 1 files above are all present; `camp_backdrop` is 480 x 400, each sprite equals its `SPRITE_SIZE`, faces are 64 x 64 and small faces 16 x 16 (read from the PNG header as `tests/planetart-assets.test.ts` does); the summed length of the base64 data URIs is under 250000.
  Run: `npx vitest run tests/campart-assets.test.ts`
  Expected: FAIL before the files exist, PASS after Steps 2 to 5.
- [ ] **Step 7: Bake and check size.**
  Run: `node scripts/build-camp-art.mjs` then `npm run build`
  Expected: `src/art/camp.generated.ts` lists 15 entries; the built JS grows by under 250 KB (record the before and after sizes in the ledger).
- [ ] **Step 8: Judge it on screen.** `preview_start laser-tribute-dev`, craft a story save in the page (import the world and story modules in the browser console as in the planet check), open BASE and screenshot: a new world (Training and Hospital are tiles because their plots are Phase 2), one with `training1`/`hospital1` researched, and one with research active; open a story scene for each of the four voices and the barracks panel with four soldiers and a hired recruit. Check the clicks land on the painted buildings, the chips are readable, the four faces look like four different people and fit the planet's gritty look, nothing overlaps at phone width. Fix chip colour, sprite offset or rectangle position in code (re-run Task 3's tests) rather than regenerating art; if an image itself is the problem, ask Rui before spending generations. Clear the crafted save from `localStorage` afterwards.
- [ ] **Step 9: Run the whole suite**
  Run: `npm test` and `npm run typecheck`
  Expected: green.
- [ ] **Step 10: Commit**
  ```bash
  git add art-src/camp src/art/camp.generated.ts tests/campart-assets.test.ts
  git commit -m "art: painted camp backdrop, building sprites and four faces (phase 1)"
  ```

---

### Task 7: Phase 2 art (run only when Rui says credits are available)

**Files:**
- Create: `art-src/camp/<id>.png` for `lab_busy`, `training_plot`, `training_busy`, `hospital_plot`, `hospital_busy`, `face_recruit` and `face_recruit_s`; update `art-src/camp/README.md`, `src/art/camp.generated.ts`
- Modify: `tests/campart-assets.test.ts` (the required list grows to all 22)

- [ ] **Step 1: Ask Rui** whether the PixelLab balance allows 6 more images (`get_balance`); do not start without a yes.
- [ ] **Step 2: Paint** (`create_image_pixen`, same settings and palette as Task 6): `lab_busy` 120 x 72 the lab with its door and dome glowing bright blue and steam; `training_plot` 64 x 64 an empty sand plot marked with four stakes and rope; `training_busy` 64 x 64 the ring with one small soldier mid-drill; `hospital_plot` 120 x 72 an empty cleared plot with foundation posts and string lines; `hospital_busy` 120 x 72 the field hospital with two stretchers and beds visible in front; `face_recruit` 64 x 64 a nervous young recruit with a fresh uniform, wide eyes and a dirty cheek (the same style sentence as Task 6). Process as in Task 6 Step 5 (plus `face_recruit_s`).
- [ ] **Step 3: Update the asset test** so all 22 ids are required; run it, bake with `node scripts/build-camp-art.mjs`, run `npm test`, `npm run typecheck`, `npm run build` and record the size.
- [ ] **Step 4: Judge on screen** as in Task 6 Step 8, now with plots on a new world, a researching Lab, a training soldier, a wounded soldier and the recruit face on a hire.
- [ ] **Step 5: Commit**
  ```bash
  git add art-src/camp src/art/camp.generated.ts tests/campart-assets.test.ts
  git commit -m "art: camp states and the recruit face (phase 2)"
  ```
