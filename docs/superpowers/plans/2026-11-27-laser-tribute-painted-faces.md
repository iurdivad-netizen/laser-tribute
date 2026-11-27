# Painted Faces In Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The story scene and barracks show painted, mixed faces for every soldier instead of code-drawn ones.

**Architecture:** `scripts/build-faces.mjs` cleans the six PNG portraits and bakes them into `src/art/faces.generated.ts`. The mixing code moves from the script to `src/art/facemix.ts`, used by the game and by the contact-sheet script. `src/art/facepick.ts` turns a name into a face; `src/screens/faces.ts` draws it.

**Tech Stack:** TypeScript, Canvas, Vite, vitest, Node scripts (`.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-27-laser-tribute-painted-faces-design.md`

## Global Constraints

- Work on branch `art/painted-faces-ingame`. No commit, push or PR unless Rui asks. Leave `graft/` untracked.
- No new portraits, no PixelLab spend, no new save fields, no change to swap rules or to camp, planet or figure art.
- `faceImage(name: string, small: boolean, make?)` stays synchronous with the same signature.
- Tests run without a DOM and without `@types/node`; a `.mjs` script imported by a test needs a `.d.mts`.
- `src/art/facemix.ts` has no imports and only erasable TypeScript syntax, so Node (22.18 or later) can load it from a script.
- Fixed faces (head, eyes, mouth, clothes): Alvarez `veteran, veteran, veteran, woman`; Brandt `man, man, veteran, man`; Chen and Dubois their own portrait.
- Hire heads: `woman`, `veteran`, `man`, `blonde`. Never `veteran` head with `woman` clothes, never `man` head with `man` clothes. 180 hire faces: 48, 60, 27, 45.

## Review Focus

1. A saved soldier named `constructor`, `__proto__` or empty: an ordinary hire face, no crash (Task 2).
2. Near-matches of originals (`Alvarez 2`, `alvarez`) and the `RECRUIT` speaker: a hire face, never an original's (Task 2).
3. Faces changed by the move to `src/`: all 337 stay pixel-identical (Task 1, step 1 and 6).
4. The generated module out of date with the PNGs: a test fails (Task 1).
5. No canvas available: scene initial and barracks layout as before (existing `tests/faceimage.test.ts`).

---

### Task 1: Baked portraits and one copy of the mixing code

**Files:**
- Create: `src/art/facemix.ts`, `src/art/portraits.ts`, `src/art/faces.generated.ts` (script output), `scripts/build-faces.mjs`, `scripts/build-faces.d.mts`, `tests/facesbake.test.ts`
- Modify: `scripts/mix-faces.mjs` (keep only the contact-sheet command), `tests/facemix.test.ts`, `package.json` (`art` script ends with `&& node scripts/build-faces.mjs`), `.gitattributes` (`src/art/faces.generated.ts text eol=lf`)
- Delete: `scripts/mix-faces.d.mts`

**Interfaces produced:**

```ts
// src/art/facemix.ts
export type FaceName = 'chen' | 'dubois' | 'woman' | 'veteran' | 'man' | 'blonde';
export interface FacePick { head: FaceName; eyes: FaceName; mouth: FaceName; clothes: FaceName }
export interface Pixels { w: number; h: number; rgba: Uint8ClampedArray }
export interface Measures { skin: number[]; eyes: number; mouth: number; jaw: number[][]; locks?: number }
export interface Portrait extends Measures { rgba: Uint8ClampedArray }          // 64 x 64, cleaned
export interface BakedPortrait extends Measures { palette: string[]; rows: string[] } // 'rrggbb'; 64 strings of 64
export const BACKGROUND: readonly [20, 18, 19];
export const FACES: readonly FaceName[];                                       // order as in FaceName
export function isAllowed(pick: FacePick): boolean;
export function allowedPicks(): FacePick[];
export function mixFace(portraits: Record<FaceName, Portrait>, pick: FacePick): Pixels;
// src/art/portraits.ts
export const PORTRAITS: Record<FaceName, Portrait>;                            // decoded once from FACE_DATA
// scripts/build-faces.mjs
export function preparePortraits(): Record<FaceName, Portrait>;
export function renderFacesModule(portraits: Record<FaceName, Portrait>): string; // exports FACE_DATA: Record<FaceName, BakedPortrait>
```

- [ ] **Step 1: Record the current faces.** A scratchpad script imports the present `mix-faces.mjs` and writes one SHA-256 per allowed pick, in `allowedPicks()` order, to a scratchpad file.

- [ ] **Step 2: Write the failing tests**

```ts
// tests/facesbake.test.ts
it('bakes the portraits the PNG files give', () => {
  expect(PORTRAITS).toEqual(preparePortraits());
});
it('refuses a portrait with more colours than the format holds', () => {
  const portraits = preparePortraits();
  for (let i = 0; i < 63; i++) portraits.chen.rgba.set([i, 0, 0, 255], i * 4);
  expect(() => renderFacesModule(portraits)).toThrow('colours');
});
```

In `tests/facemix.test.ts` import from `../src/art/facemix`, call `mixFace(PORTRAITS, pick)`, and read `w`/`h` instead of `width`/`height`. The four existing assertions stay.

- [ ] **Step 3: Run** `npx vitest run tests/facesbake.test.ts tests/facemix.test.ts`. Expected: FAIL, modules not found.

- [ ] **Step 4: Move the code.** `SOURCES` and `prepare` go to `build-faces.mjs`; rules, `jaw`, `tone`, `isSkin`, `dress`, `PATCHES` and the pixel helpers go to `facemix.ts`, comments kept. Pixel rows use the 62 characters `0-9a-zA-Z` as palette indexes. `mix-faces.mjs` imports `../src/art/facemix.ts` and `preparePortraits`.

- [ ] **Step 5: Generate** with `node scripts/build-faces.mjs`. Expected: `wrote src/art/faces.generated.ts: 6 portraits`. Run step 3's command: PASS.

- [ ] **Step 6: Verify** the 337 hashes equal step 1's, and `node scripts/mix-faces.mjs <scratchpad>/sheet.png` prints `337 faces`.

### Task 2: Name to face

**Files:** Create `src/art/facepick.ts`, `tests/facepick.test.ts`

**Interfaces:** Consumes `allowedPicks`, `FacePick`. Produces `export function facePick(name: string): FacePick`.

- [ ] **Step 1: Write the failing tests**

```ts
const hire = (p: FacePick) => ['woman', 'veteran', 'man', 'blonde'].includes(p.head)
  && !(p.head === 'veteran' && p.clothes === 'woman') && !(p.head === 'man' && p.clothes === 'man') && isAllowed(p);

it('gives the originals their fixed faces', () => {
  expect(facePick('Alvarez')).toEqual({ head: 'veteran', eyes: 'veteran', mouth: 'veteran', clothes: 'woman' });
  expect(facePick('Brandt')).toEqual({ head: 'man', eyes: 'man', mouth: 'veteran', clothes: 'man' });
  expect(facePick('Chen')).toEqual(own('chen'));
  expect(facePick('Dubois')).toEqual(own('dubois'));
});
it('gives everyone else an allowed hire face, the same every time', () => {
  const names = [...RECRUIT_SURNAMES.filter((n) => !(ORIGINALS as readonly string[]).includes(n)),
    'RECRUIT', 'Alvarez 2', 'alvarez', 'constructor', '__proto__', 'toString', ''];
  for (const n of names) { expect(hire(facePick(n)), n).toBe(true); expect(facePick(n)).toEqual(facePick(n)); }
});
it('picks each head about equally often and reaches all 180 hire faces', () => {
  const picks = Array.from({ length: 20_000 }, (_, i) => facePick(`Hire ${i}`));
  for (const head of ['woman', 'veteran', 'man', 'blonde']) {
    const share = picks.filter((p) => p.head === head).length / picks.length;
    expect(share, head).toBeGreaterThan(0.22); expect(share, head).toBeLessThan(0.28);
  }
  expect(new Set(picks.map((p) => JSON.stringify(p))).size).toBe(180);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/facepick.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `facePick`.** Originals in a `Map`. For hires copy `hash` (FNV-1a) and `stream(h, salt)` from `src/core/world/faces.ts`, which Task 4 deletes: `stream(h, 0)` picks the head, `stream(h, 1)` picks within that head's list. Build the four lists once.
- [ ] **Step 4: Run** step 2's command. Expected: PASS.

### Task 3: The screens draw painted faces

**Files:** Modify `src/art/facemix.ts`, `src/screens/faces.ts`, `tests/faceimage.test.ts`

**Interfaces:** Produces `export function shrinkFace(face: Pixels): Pixels` (64 x 64 to 16 x 16).

- [ ] **Step 1: Write the failing tests** in `tests/faceimage.test.ts` (`Pixels` now from `../src/art/facemix`)

```ts
it('shrinks the middle 48 x 48 of a face, three pixels to one', () => {
  const big = { w: 64, h: 64, rgba: new Uint8ClampedArray(64 * 64 * 4).fill(255) };
  big.rgba.set([0, 0, 0, 255], (6 * 64 + 8) * 4);   // top left pixel of the window
  big.rgba.set([0, 0, 0, 255], (5 * 64 + 7) * 4);   // just outside it
  const small = shrinkFace(big);
  expect([small.w, small.h, small.rgba.length]).toEqual([16, 16, 1024]);
  expect([...small.rgba.slice(0, 4)]).toEqual([227, 227, 227, 255]); // round(255 * 8 / 9)
  expect([...small.rgba.slice(4, 8)]).toEqual([255, 255, 255, 255]);
});
it('draws the painted face the name picks, at both sizes', () => {
  const seen: Pixels[] = [];
  const make = (p: Pixels) => { seen.push(p); return tagged(p); };
  faceImage('Chen', false, make);
  faceImage('Chen', true, make);
  const chen = mixFace(PORTRAITS, { head: 'chen', eyes: 'chen', mouth: 'chen', clothes: 'chen' });
  expect(seen).toEqual([chen, shrinkFace(chen)]);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/faceimage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `shrinkFace`: window at column 8, row 6, size 48; each small pixel is the rounded mean of its 3 x 3 block, opaque. In `faceImage` replace `renderFace(faceSpec(name), …)` with `mixFace(PORTRAITS, facePick(name))`, shrunk when `small`.
- [ ] **Step 4: Run** `npx vitest run tests/faceimage.test.ts tests/campapp.test.ts`. Expected: PASS.

### Task 4: Remove the code-drawn generator

**Files:**
- Delete: `src/art/facegen.ts`, `src/core/world/faces.ts`, `tests/facegen.test.ts`, `tests/facespec.test.ts`
- Modify: `art-src/faces/README.md`, `README.md` (art paragraph)

- [ ] **Step 1:** Delete the four files.
- [ ] **Step 2:** README: the game uses these faces; how to rebuild (`node scripts/build-faces.mjs`); rules now live in `src/art/facemix.ts`; who gets which face.
- [ ] **Step 3: Run** `npm run typecheck`; `npm test`. Expected: no errors, all tests pass. Search `src`, `tests`, `scripts` for `facegen|faceSpec|FACE_PARTS`: no hits.

### Task 5: Verify in the running game

- [ ] **Step 1: Run** `npm run build`. Expected: success. Note the bundle size against a build of `origin/master`.
- [ ] **Step 2:** Start `laser-tribute-dev`, open a story scene (Alvarez or Brandt speaking) and the barracks with at least one hire; screenshot both; no console errors.
- [ ] **Step 3:** Send Rui the screenshots.
- [ ] **Step 4:** Review the whole diff with the Code Reviewer agent, fix real findings, rerun `npm test`.
- [ ] **Step 5:** `trail build`.
