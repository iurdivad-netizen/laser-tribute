# Story Mode Planet Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the planet screen's placeholder backdrop and coloured squares with painted terrain: a PixelLab-painted land picture, painted emblems per place and state, and ground stamps that change as the player conquers.

**Architecture:** A pure `regionLook(world, id)` says which emblem, stamp and tint each region has. A small loader hands out decoded images from a generated manifest of data URIs (built by a script from `art-src/planet/*.png`). `drawPlanet` composes backdrop, stamps, tint, roads, emblems, and falls back to today's plain map when an image is missing. The art itself is produced with PixelLab in Task 4.

**Tech Stack:** TypeScript strict, Canvas 2D, Vitest, Vite, PixelLab MCP (`mcp__pixellab__*`). Run: `npm test`, `npm run typecheck`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-11-24-laser-tribute-story-mode-planet-art-design.md`

## Global Constraints

- Region positions, names, links and rules do not change; the info panel and the buttons do not move. Hit radius stays `REGION_HIT = 10`, except the citadel, `14`.
- Map rect is `PLANET.map = { x: 6, y: 22, w: 330, h: 372 }` in the 480x400 menu space; nothing painted may spill outside it (clip).
- Emblem footprint at most 24 x 24 px (the citadel 32 x 32); stamps about 44 to 48 px. No text inside any image.
- Owner stays readable: the code-drawn tint is drawn under every non-wild place, in the holder's UI colour.
- The build grows by at most about 250 KB; the checked-in manifest must regenerate byte for byte from `art-src/planet`.
- With no image decoded, or no canvas, the planet screen draws exactly as today (plain backdrop, squares) and never throws.
- Tutorial and Campaign are untouched. At most 2 backdrop generations without asking Rui; PixelLab trial budget is 23 generations plus a nightly bonus (backdrop 10 to 25, each emblem or stamp 1).

## Review Focus

- Art missing, not yet decoded, or a failed decode: the plain map still draws and clicks still work (Task 3, 5).
- Every holder and `visited` combination of every region yields a valid emblem and a stamp that exists (Task 1).
- The citadel emblem (32 px at y = 18) and edge regions would paint outside the map rect: clipped, not spilled over the title or panel (Task 3).
- Owner readable on every ground: tint is drawn for every non-wild place whatever the art is (Task 3); judged by screenshot in Task 5.
- Image decode finishing after the first frame: the screen redraws without waiting for input (Task 5).

---

### Task 1: What each place looks like

**Files:**
- Create: `src/screens/planetart.ts`
- Test: `tests/planetart.test.ts`

**Interfaces:**
- Consumes: `World`, `Holder` from `../core/world/world`; `REGIONS`, `CAPITAL_REGION`, `START_REGION` from `../core/world/planet`; `UI` from `../ui/frame`.
- Produces from `src/screens/planetart.ts`:
  ```ts
  export type EmblemId = 'outpost_enemy' | 'outpost_taken' | 'settlement_neutral' | 'settlement_allied'
    | 'wild_a' | 'wild_b' | 'wild_visited' | 'start_ship' | 'citadel_enemy' | 'citadel_taken';
  export type StampId = 'scorch' | 'cleared' | 'fields';
  export const EMBLEM_IDS: readonly EmblemId[];
  export const STAMP_IDS: readonly StampId[];
  export type PlanetArtId = 'backdrop' | EmblemId | `stamp_${StampId}`;
  export const PLANET_ART_IDS: readonly PlanetArtId[];            // backdrop, the 10 emblems, the 3 stamps as 'stamp_scorch' etc.
  export const FOOTPRINT: Record<EmblemId, number>;               // px, 20 for places, 26 for the landing ship, 32 for both citadels
  export interface RegionLook { stamp: StampId | null; emblem: EmblemId; tint: string }
  export function regionLook(w: World, id: number): RegionLook;
  ```

- [ ] **Step 1: Write the failing tests** (`tests/planetart.test.ts`), on `newWorld(1, 'calm')` with a local `hold(w, ids, holder)` helper:
  - Fresh world: region 0 (start, holder `player`) is `{ emblem: 'start_ship', stamp: 'cleared' }`; region 1 (enemy outpost) `{ emblem: 'outpost_enemy', stamp: 'scorch' }`; region 5 (neutral settlement) `{ emblem: 'settlement_neutral', stamp: null }`; region 3 (wild) `{ emblem: 'wild_b', stamp: null }` and region 10 (wild) `{ emblem: 'wild_a' }` (variant `id % 2`: odd id `wild_b`, even `wild_a`); region 25 (capital) `{ emblem: 'citadel_enemy', stamp: 'scorch' }`.
  - After `hold(w, [1], 'player')`: region 1 is `{ emblem: 'outpost_taken', stamp: 'cleared' }`; after `hold(w, [5], 'allied')`: region 5 is `{ emblem: 'settlement_allied', stamp: 'fields' }`; a wild region with `visited: true` is `wild_visited` with no stamp; capital held by the player is `citadel_taken` with stamp `cleared`.
  - `tint` equals `UI.red` for enemy, `UI.green` for player, `UI.blue` for allied, `UI.accent` for neutral, `UI.dim` for wild.
  - Exhaustive: for every region id and every holder allowed for its kind (start: player/enemy; enemy: enemy/player; neutral: neutral/allied; wild: wild) and both `visited` values, `regionLook` returns an emblem in `EMBLEM_IDS`, a stamp that is null or in `STAMP_IDS`, and `FOOTPRINT[emblem]` is at most 32.
  - `PLANET_ART_IDS` has 14 entries: `backdrop`, the 10 emblems and `stamp_scorch`, `stamp_cleared`, `stamp_fields`, with no duplicates.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/planetart.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/screens/planetart.ts`** per the Interfaces block. The mapping: kind `start` is `start_ship` always; kind `enemy` is `outpost_enemy` while enemy-held, `outpost_taken` once `player`; the capital (`CAPITAL_REGION`) uses `citadel_enemy` / `citadel_taken` instead; kind `neutral` is `settlement_neutral` or `settlement_allied`; kind `wild` is `wild_visited` when `visited`, else `wild_a` / `wild_b` by `id % 2`. Stamps: `scorch` for holder `enemy`, `cleared` for `player`, `fields` for `allied`, `null` otherwise. `FOOTPRINT`: 20 for every place emblem, 26 for `start_ship`, 32 for the two citadels.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/planetart.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/screens/planetart.ts tests/planetart.test.ts
  git commit -m "feat: regionLook, the emblem and stamp for every place"
  ```

---

### Task 2: Baking the art and loading it

**Files:**
- Create: `scripts/build-planet-art.mjs`, `src/art/planet.generated.ts` (generated, empty manifest for now), `src/art/planetimages.ts`
- Modify: `package.json` (add script `"art": "node scripts/build-figures.mjs && node scripts/build-planet-art.mjs"`)
- Test: `tests/planetbake.test.ts`, `tests/planetimages.test.ts`

**Interfaces:**
- Consumes: `PLANET_ART_IDS`, `PlanetArtId` (Task 1).
- Produces:
  - `scripts/build-planet-art.mjs` exports `buildPlanetManifest(dir: string): Record<string, string>` (PNG file `<id>.png` in `dir` to `data:image/png;base64,...`, only for files present; throws if a file name is not an id in the list or is not a PNG) and `renderPlanetModule(manifest): string`; run as a script it reads `art-src/planet` and writes `src/art/planet.generated.ts`.
  - `src/art/planet.generated.ts`: `export const PLANET_ART_DATA: Partial<Record<PlanetArtId, string>>`.
  - `src/art/planetimages.ts`:
    ```ts
    export interface PlanetArt { image(id: PlanetArtId): CanvasImageSource | null }
    export function createPlanetArt(data: Partial<Record<PlanetArtId, string>>, onLoad: () => void,
      make?: () => { src: string; onload: (() => void) | null; onerror: (() => void) | null; complete: boolean; naturalWidth: number }): PlanetArt;
    export const NO_ART: PlanetArt;   // image() always null
    ```
    `image(id)` starts decoding on first request, returns the image only once it has loaded (`complete && naturalWidth > 0`), else `null`; a failed decode stays `null` and is not retried; `onLoad` is called once per image that finishes decoding. When `Image` does not exist (node tests) and no `make` is given, `image()` returns `null`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/planetbake.test.ts`: in a temp dir write a hard-coded 1x1 PNG (bytes of base64 `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==`) as `backdrop.png` and `stamp_scorch.png`; `buildPlanetManifest(dir)` has exactly those two keys, values start with `data:image/png;base64,`; two calls give identical results; a file `unknown.png` throws `unknown planet art`; a non-PNG named `wild_a.png` throws `not a PNG`; an empty dir gives `{}`. `renderPlanetModule` output begins with the generated-file comment and `export const PLANET_ART_DATA`, and rendering twice is identical. A test also checks the committed `src/art/planet.generated.ts` equals `renderPlanetModule(buildPlanetManifest('art-src/planet'))` (a missing `art-src/planet` dir counts as `{}`).
  - `tests/planetimages.test.ts` with an injected fake `make`: `image('backdrop')` is `null` before the fake loads, returns the fake after it loads (`complete = true`, `naturalWidth = 1`, `onload()` called) and `onLoad` fires once; a fake that calls `onerror` keeps returning `null` and `onLoad` never fires; an id with no data returns `null` and creates nothing; two requests for the same id create one image; `NO_ART.image('backdrop')` is `null`.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/planetbake.test.ts tests/planetimages.test.ts`
  Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** the three files and the `package.json` script. The script validates the PNG signature (first 8 bytes), sorts ids in `PLANET_ART_IDS` order for stable output, and writes LF line endings. `src/art/planet.generated.ts` is generated by running `node scripts/build-planet-art.mjs` (the manifest is empty until Task 4); the loader uses `new Image()` when `typeof Image !== 'undefined'`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/planetbake.test.ts tests/planetimages.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite and build**
  Run: `npm test` and `npm run build`
  Expected: green; build succeeds.
- [ ] **Step 6: Commit**
  ```bash
  git add scripts/build-planet-art.mjs src/art/planet.generated.ts src/art/planetimages.ts package.json tests/planetbake.test.ts tests/planetimages.test.ts
  git commit -m "feat: planet art manifest script and image loader"
  ```

---

### Task 3: Drawing the painted map

**Files:**
- Modify: `src/screens/planet.ts` (`drawPlanet`, `drawBackdrop`, `REGION_HIT` for the citadel)
- Test: `tests/planetdraw.test.ts`, `tests/planetscreen.test.ts` (edit)

**Interfaces:**
- Consumes: `regionLook`, `FOOTPRINT`, `PlanetArtId` (Task 1); `PlanetArt`, `NO_ART` (Task 2).
- Produces: `drawPlanet(ctx, v: PlanetView, art: PlanetArt = NO_ART): void` (a third optional parameter); `planetHit` uses radius 14 for `CAPITAL_REGION` and 10 for the rest.

Drawing order inside the map rect, with `ctx.save(); ctx.beginPath(); ctx.rect(map); ctx.clip();` around layers 1 to 5 and `ctx.restore()` before the panel: (1) backdrop image at the map origin, else today's plain backdrop; (2) per region with a stamp and a stamp image: stamp centred on the place; (3) tint: a radial gradient (or a filled disc with low alpha) in `regionLook(...).tint`, radius 22 (capital 28), for every region except wild; (4) the roads as today; (5) emblems: the emblem image centred on the place at `FOOTPRINT[emblem]` size, and when the image is `null` the old coloured square (9 px, capital 13) so a missing image never hides a place; (6) the selection frame sized `FOOTPRINT + 6`.

- [ ] **Step 1: Write the failing tests** (`tests/planetdraw.test.ts`) with a recording fake context (every method records its name and arguments; `createRadialGradient` returns an object with `addColorStop`) and a fake `PlanetArt` that returns a distinct object per id from a set of available ids:
  - With `NO_ART`: no `drawImage` call; 30 squares are drawn (a `fillRect` of size 9 or 13 per region); no exception for a fresh world and for a world with every enemy region held.
  - With all art available: exactly 1 backdrop `drawImage` at the map origin (6, 22, 330, 372); exactly 30 emblem draws; stamp draws equal the number of regions whose look has a stamp; the squares are not drawn.
  - Fallback per image: with only `backdrop` available, emblems fall back to squares (30 squares) and the backdrop is drawn.
  - Tint: for each non-wild region one tint fill in the holder's colour; none for wild regions.
  - Clip: a `clip` call happens before the first `drawImage`, and the clip rect equals the map rect.
  - Selection: with `selected` set, the selection stroke rect is `FOOTPRINT + 6` wide, centred on the place.
  - The text drawn (collect with `onText` as in `tests/squadscreen.test.ts`) is unchanged by art availability.
  - In `tests/planetscreen.test.ts` add: the citadel is hit at 13 px from its centre and missed at 15 px; every other region is hit at 9 px and missed at 11 px; the hit circles of all region pairs do not overlap (`distance > r1 + r2`).
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/planetdraw.test.ts tests/planetscreen.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement** in `src/screens/planet.ts` per the layer order above; import `regionLook`/`FOOTPRINT` from `./planetart` and `NO_ART`/`PlanetArt` from `../art/planetimages`. Keep the info panel and everything after the map exactly as it is. `planetHit`: replace the constant radius with `r.id === CAPITAL_REGION ? 14 : 10`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/planetdraw.test.ts tests/planetscreen.test.ts tests/storyapp.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/screens/planet.ts tests/planetdraw.test.ts tests/planetscreen.test.ts
  git commit -m "feat: draw the planet map from painted layers, with a plain fallback"
  ```

---

### Task 4: Painting the art with PixelLab

**Files:**
- Create: 14 PNG files in `art-src/planet/` named by art id (`backdrop.png`, `outpost_enemy.png`, `stamp_scorch.png` and so on), and `art-src/planet/README.md`
- Modify: `src/art/planet.generated.ts` (regenerated by `node scripts/build-planet-art.mjs`)
- Test: `tests/planetart-assets.test.ts`

**Interfaces:**
- Consumes: `PLANET_ART_IDS` (Task 1), the build script (Task 2).
- Produces: the 14 PNG files, a README recording for each: the PixelLab tool, the prompt and the job id.

This task is creative and costs generations. Work in this order and stop to ask Rui if a limit below is hit.

- [ ] **Step 1: Check the budget.** Call `mcp__pixellab__get_balance`; write the result in the ledger. If fewer than 25 generations (plan plus daily bonus) remain, stop and ask Rui before generating (the free route in the spec is the fallback). Call `mcp__pixellab__search_help` with `tool='create_image_pro'` and `tool='create_image_pixen'` for exact option names and prices.
- [ ] **Step 2: Paint the backdrop.** `create_image_pro` at width 330, height 372, `no_background=False`: a top-down painted pixel-art land of a frontier colony, with dust flats in the south, marsh and steppe in the west, grey scarred industrial land in the east middle, pale glass barrens in the centre, dark ground in the north, no buildings, no roads, no text, no water bodies at the very edge, moderately dark and muted so bright markers read on top. Save as `art-src/planet/backdrop.png`. Judge it against the sketch (`.superpowers/brainstorm/*/content/planet-art-directions.html`, panel B): zones readable, not too bright, no visible grid or text. One retry allowed if it fails; a second failure: stop and ask Rui.
- [ ] **Step 3: Paint the stamps and emblems.** `create_image_pixen` (transparent background): the 3 stamps at 48 x 48 (`stamp_scorch`: dark burnt ground with soft edges; `stamp_cleared`: cleared greener ground; `stamp_fields`: small tilled fields), the places at 20 x 20 (`outpost_enemy`: red-flagged tent and watch post; `outpost_taken`: ruined walls with a green banner; `settlement_neutral`: small yellow-roofed houses; `settlement_allied`: houses with lit windows and a blue banner; `wild_a`, `wild_b`: trees and rocks; `wild_visited`: the same grey and plain), `start_ship` at 24 x 24 (a landed ship with a green marker), the citadels at 32 x 32 (`citadel_enemy`: dark tower fortress with red lights; `citadel_taken`: the same with a green banner). Keep one consistent top-down three-quarter pixel style; regenerate a single sprite at most once if it is unreadable at its size (1 generation each).
- [ ] **Step 4: Reduce colours.** Quantise the backdrop and each sprite to a small palette (about 48 colours for the backdrop, 16 per sprite) with `reduce_colors` or `pixelart_workbench`, keep transparency, and save the PNGs in `art-src/planet/` (palette-indexed PNG if the tool offers it). Record every prompt and job id in `art-src/planet/README.md`.
- [ ] **Step 5: Write the asset test.** `tests/planetart-assets.test.ts`: every file in `art-src/planet` is `<id>.png` with an id in `PLANET_ART_IDS`; all 14 ids are present; `backdrop.png` is 330 x 372; emblem sizes equal their `FOOTPRINT` (20, 26 or 32) and stamps are 48 x 48 (read width and height from the PNG header IHDR bytes 16 to 24); the summed file size of `art-src/planet/*.png` is under 250000 bytes. Run it: it fails until the files exist.
  Run: `npx vitest run tests/planetart-assets.test.ts`
  Expected: PASS once Steps 2 to 4 are done (FAIL before).
- [ ] **Step 6: Bake and check size.**
  Run: `node scripts/build-planet-art.mjs` then `npm run build`
  Expected: `src/art/planet.generated.ts` lists 14 entries; the built JS grows by under 250 KB compared with the build before this task (record both sizes in the ledger).
- [ ] **Step 7: Run the whole suite**
  Run: `npm test` and `npm run typecheck`
  Expected: green (the Task 2 test comparing the committed manifest passes against the new files).
- [ ] **Step 8: Commit**
  ```bash
  git add art-src/planet src/art/planet.generated.ts tests/planetart-assets.test.ts
  git commit -m "art: painted planet backdrop, emblems and ground stamps"
  ```

---

### Task 5: Wire into the app and judge it on screen

**Files:**
- Modify: `src/app.ts` (`AppOptions.planetArt?: PlanetArt`, the planet draw call, redraw on load)
- Test: `tests/planetapp.test.ts`

**Interfaces:**
- Consumes: `createPlanetArt`, `NO_ART`, `PlanetArt` (Task 2); `PLANET_ART_DATA` (Task 2/4); `drawPlanet` third parameter (Task 3).
- Produces: `AppOptions.planetArt?: PlanetArt` (default: `createPlanetArt(PLANET_ART_DATA, () => this.wake())` in the real game, `NO_ART` when the options are test options, i.e. when `opts.store !== undefined`, matching how `App` already decides `real`).

- [ ] **Step 1: Write the failing tests** (`tests/planetapp.test.ts`, same `setup` pattern as `tests/storyapp.test.ts` with `scenes: false`): with a fake `planetArt` whose `image` returns a distinct object for every id, drawing the planet screen on a recording context calls `drawImage` for the backdrop and 30 emblems; with the default test options (no `planetArt`) the planet screen draws with no `drawImage` (art is off in tests); the fake art's `onLoad` path: an `App` built with `createPlanetArt(data, cb)` where `cb` is the app's wake: creating the App with real options and a fake `make` that loads later does not throw (assert `app.screen` is still `title`); the planet screen click behaviour (region select, act) is unchanged with art on (select region 1 by clicking its centre).
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/planetapp.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement** the option and pass `this.planetArt` as the third argument of `drawPlanet`. Create the real art with `createPlanetArt(PLANET_ART_DATA, () => this.wake())` so a late decode redraws the screen without input.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/planetapp.test.ts tests/storyapp.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run everything**
  Run: `npm test` and `npm run build`
  Expected: green; build succeeds.
- [ ] **Step 6: Judge it in the browser pane.** `preview_start laser-tribute-dev`, clear the story save (`localStorage.removeItem('laser-tribute-story')`), reload, start STORY on CALM (the first click on the title only unlocks audio; skip the landing scene), and take screenshots (a) at the start, (b) after conquering about a third of the colony (set it up through a crafted save in `localStorage` as version 3 JSON, or by playing), (c) with both citadel gates held, (d) at phone width. Check against the acceptance list in the spec: the five owner states can be told apart on every ground; no stamp seams or rectangles; the citadel stands out; the panel text is unaffected; the map fits its rect. Fix tint strength, road colour, stamp softness or emblem contrast in the code (not by regenerating art) and re-bake if a PNG is changed. Record what was checked in the ledger; if an art asset itself is the problem, ask Rui before spending more generations.
- [ ] **Step 7: Commit**
  ```bash
  git add src/app.ts tests/planetapp.test.ts
  git commit -m "feat: show the painted planet map in the app"
  ```
