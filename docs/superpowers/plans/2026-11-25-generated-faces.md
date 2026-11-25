# Generated Faces and Random Recruit Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every non-original Story soldier gets a face composed from parts and a random surname, both reproducible.

**Architecture:** A pure `faceSpec(name)` in core picks part indices from a name hash. A pure compositor in `src/art` turns a spec into RGBA pixels (64x64 and 16x16). A screens helper `faceImage(art, name, small)` returns the painted image for the four originals, a cached canvas for everyone else, and the existing `face_recruit` image when no canvas exists (node tests). `hire` picks names from a surname pool by hashing `world.seed` and `namesUsed`.

**Tech Stack:** TypeScript strict, Vitest (node env), Canvas 2D, 5x7 font.

**Spec:** `docs/superpowers/specs/2026-11-25-laser-tribute-generated-faces-design.md`

## Global Constraints

- Tutorial and Campaign unchanged: `soldierName`, `newCampaign`, `recordMission` and their tests keep passing untouched.
- `newWorld` still starts with the four originals; only `hire` changes naming.
- `src/core` stays free of DOM/canvas imports; the canvas is created only in `src/screens`.
- No new save fields, no save version bump. Old saves load and draw.
- Names: ASCII letters only (`unsupportedChars(name)` is empty), at most 10 characters, at least 100 in the pool, none equal to an original or to an entry of `SOLDIER_NAMES`.
- The four painted faces and `face_recruit` art are not touched.
- Whole suite and `npx tsc --noEmit` before each commit; `trail check` before pushing. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Same name gives the same face, always; same (seed, namesUsed, taken) gives the same name.
- A hired name is never an original, a current soldier or a fallen one, even with a full roster and after many hires.
- Every pool name fits the 120 px name column (`NAME_W`) and the font.
- In node (no canvas) the barracks and scene still draw `face_recruit` / `face_recruit_s`, so existing face tests stay valid.
- A generated face is never drawn for an original, and the painted id is still used for them.
- An old save with `Eriksen` or `Alvarez 2` loads and draws a generated face without error.

---

### Task 1: Random recruit names

**Files:**
- Create: `src/core/world/names.ts`
- Modify: `src/core/world/barracks.ts` (`hire`)
- Test: `tests/recruitnames.test.ts` (create); update `tests/barracks*.test.ts` only if a hire test asserts the old name

**Interfaces:**
- Consumes: `ORIGINALS` (story.ts), `SOLDIER_NAMES` (campaign.ts), `World` (`seed`, `namesUsed`, `soldiers`, `fallen`).
- Produces: `RECRUIT_SURNAMES: readonly string[]`; `recruitName(w: World): string` — deterministic from `w.seed` and `w.namesUsed`, skips names taken by `w.soldiers` and `w.fallen`, and falls back to `<SURNAME> <n>` (n = 2, 3, …) only when every pool name is taken.

- [ ] **Step 1: Write failing tests** in `tests/recruitnames.test.ts`:
  - pool has at least 100 entries, all unique, each at most 10 chars, `unsupportedChars` empty, none in `ORIGINALS` or `SOLDIER_NAMES` (case-insensitive).
  - `recruitName(w)` is the same for the same world, differs for different `namesUsed` in at least 20 of 30 consecutive values.
  - never returns a name present in `w.soldiers` or `w.fallen`: hire 40 times on a world with `credits` and beds raised, assert all names distinct and none an original.
  - with every pool name already in `fallen`, returns a `<NAME> 2` style name that is still unique.
  - `hire(w).soldiers.at(-1).name` equals `recruitName(w)`; `newWorld(1,'calm').soldiers` names are still `['Alvarez','Brandt','Chen','Dubois']`.
- [ ] **Step 2: Run** `npx vitest run tests/recruitnames.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `src/core/world/names.ts` (pool of mixed-origin surnames chosen by the builder; index from a small integer hash of `seed` and `namesUsed`, then linear probe past taken names) and change `hire` to use `recruitName(w)`.
- [ ] **Step 4: Run** the new test plus `npx vitest run` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** "feat: random recruit names".

### Task 2: faceSpec in core

**Files:**
- Create: `src/core/world/faces.ts`
- Test: `tests/facespec.test.ts` (create)

**Interfaces:**
- Produces: `FACE_PARTS` (counts per part: `skin`, `hairStyle`, `hairColour`, `eyes`, `brows`, `mouth`, `beard`, `extra`, where `beard` and `extra` include a "none" choice); `interface FaceSpec` with one integer per part; `faceSpec(name: string): FaceSpec`.

- [ ] **Step 1: Write failing tests:** every field of `faceSpec(name)` is an integer in `[0, FACE_PARTS[field])`; `faceSpec('Haddad')` equals itself on repeat calls and is independent of call order; among 300 generated-style names (use `RECRUIT_SURNAMES` plus `"<name> 2"`), at least 250 distinct specs; each part value occurs at least once across those names (no dead part values); `faceSpec('')` does not throw.
- [ ] **Step 2: Run** `npx vitest run tests/facespec.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `faceSpec` with a string hash (FNV-1a or similar) and a separate hash stream per part so parts are not correlated. Start with roughly: 6 skin, 8 hair styles, 8 hair colours, 5 eyes, 4 brows, 4 mouths, 4 beards, 5 extras.
- [ ] **Step 4: Run** the test, whole suite and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** "feat: faceSpec from a name".

### Task 3: Face compositor

**Files:**
- Create: `src/art/facegen.ts`
- Test: `tests/facegen.test.ts` (create)

**Interfaces:**
- Consumes: `FaceSpec`, `FACE_PARTS`.
- Produces: `interface Pixels { w: number; h: number; rgba: Uint8ClampedArray }`; `renderFace(spec: FaceSpec, size: 64 | 16): Pixels`. Pure, no DOM. Parts are authored as char-and-palette grids at one size, in the format the sprite code already uses: skin, nose, eyes, brows and mouth are shared simple grids recoloured by palette; hair styles and the extras (headband, glasses, scar, helmet-like headgear) are the more detailed templates. The 16x16 face is derived from the same layers.

- [ ] **Step 1: Write failing tests:** output sizes are exactly 64x64x4 and 16x16x4 bytes; the same spec gives identical bytes; specs that differ in any single part differ in pixels (loop over each part's values with other parts fixed); the face is opaque in the centre and has the dark outline/background rule the painted faces use (check how `face_alvarez` pixels are framed in `art-src/camp/README.md` and match it); at most 24 distinct opaque colours in a 64x64 render and at most 16 in a 16x16 render.
- [ ] **Step 2: Run** `npx vitest run tests/facegen.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/art/facegen.ts`. Look at the four painted faces (`art-src/camp/face_*.png`) for head shape, scale and palette mood so recruits sit beside them; the code-drawn faces may be simpler.
- [ ] **Step 4: Run** the test, whole suite and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** "feat: face compositor".

### Task 4: Wire faces into scene and barracks

**Files:**
- Create: `src/screens/faces.ts`
- Modify: `src/screens/scene.ts` (portrait), `src/screens/basepanels.ts` (barracks row and its gutter test)
- Test: `tests/faceimage.test.ts` (create); existing `tests/facedraw.test.ts`, `tests/campapp.test.ts` must stay green unchanged

**Interfaces:**
- Consumes: `faceFor`, `faceSpec`, `renderFace`, `ORIGINALS`, `Art<CampArtId>`.
- Produces: `faceImage(art: Art<CampArtId>, name: string, small: boolean, make?: (p: Pixels) => CanvasImageSource | null): CanvasImageSource | null`. Originals: `art.image(faceFor(name) + (small ? '_s' : ''))`. Others: a per-name, per-size cached image from `make(renderFace(...))`; `make` defaults to a canvas builder that returns `null` when `document` is undefined; when `make` yields null, fall back to `art.image('face_recruit' or 'face_recruit_s')`. `drawScene` and `drawPanel` call `faceImage` instead of `art.image(faceFor(...))`, and the barracks gutter condition uses it too.

- [ ] **Step 1: Write failing tests** in `tests/faceimage.test.ts` with an injected `make` that returns a tagged object: an original gets the painted art id and `make` is not called; a recruit gets the made image, and a second call returns the same object (cache hit, `make` called once per name and size); `small` and big are cached separately; with `make` returning null, a recruit falls back to `face_recruit` / `face_recruit_s`; with no art for the fallback it returns null. In `tests/facedraw.test.ts` style, add one test that `drawScene` for speaker `RECRUIT` and `drawPanel('barracks')` for a world with a hired soldier still draw the recruit ids in node.
- [ ] **Step 2: Run** `npx vitest run tests/faceimage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/screens/faces.ts` and swap the call sites. The default `make` creates a canvas with `document.createElement('canvas')`, writes `ImageData`, and is skipped when `document` is undefined.
- [ ] **Step 4: Run** whole suite and `npx tsc --noEmit`. Expected: all green, including the unchanged face and camp tests.
- [ ] **Step 5: Verify in the browser pane:** start `laser-tribute-dev`, open Story, hire a few soldiers in Barracks and open scenes or the squad; confirm each hire has a different face and name, faces are legible at 16x16, no console errors. Screenshot one barracks list with several faces.
- [ ] **Step 6: Update** `art-src/camp/README.md` with a short note: recruits get generated faces (`src/art/facegen.ts`), `face_recruit` is only the node/fallback image. Commit "feat: generated recruit faces in scene and barracks".
