# Story Mode Story Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scene system to STORY mode: 18 triggered, saved, skippable text-box scenes voiced by the four mercenaries, three of them with a choice.

**Architecture:** Scenes are plain data in `src/core/world/story.ts` with a pure trigger predicate over `World`; the world records `seen` and `chosen`. A small pure state machine (`src/sceneplay.ts`) steps through lines, a choice and a reply. A new `scene` screen draws it; `App` shows pending scenes (at most 3) at the moments a story action finishes. Tutorial and Campaign are untouched.

**Tech Stack:** TypeScript strict, Canvas 2D, Vitest, Vite. Run: `npm test`, `npm run typecheck`, `npm run build`, `npm run balance`.

**Spec:** `docs/superpowers/specs/2026-11-24-laser-tribute-story-mode-story-spine-design.md`

## Global Constraints

- Pure `src/core`: scenes are plain data; the world stays plain JSON (`seen: string[]`, `chosen: Record<string, 0 | 1>`).
- Menu space is 480x400 drawn with `drawFrame/drawButton/drawText`; font is the 5x7 bitmap; every scene string passes `unsupportedChars(text) === []`. Use only letters, digits and `, . ' ? ! : -` in prose.
- A scene is at most 6 lines; each line wraps to at most 2 rows of the text box; a choice reply is at most 3 lines.
- At most 3 scenes per stop. A scene plays once. SKIP never makes a choice for the player.
- `resolve` and `advance` keep their signatures; recorded enemy-turn fingerprints, campaign saves and the existing suite stay green.
- No gendered pronouns in prose (the mercenaries are referred to by name or "they").
- Story save becomes version 3; versions 1 and 2 still load (migration marks already-true scenes as seen).

## Review Focus

- A mercenary falls mid-story: scenes keep their voices (next preference, else `RECRUIT`) and never go silent (Task 1, 2).
- Reload in the middle of a scene or choice: a finished scene never replays and a made choice is never lost (Task 5).
- A very old save with the citadel already open, several regions held and a death: the migration must not replay that past (Task 3).
- A choice that costs more credits than the player has: credits clamp at 0, never negative (Task 1).
- A story that ends on a won or lost action: the victory or defeat scene plays before the end screen, not other pending scenes first (Task 2, 5).

---

### Task 1: Scene engine in the world

**Files:**
- Create: `src/core/world/story.ts`
- Modify: `src/core/world/world.ts` (World fields, `newWorld`, `clone`; export `clone` is not needed, `story.ts` uses its own copies)
- Test: `tests/storyscenes.test.ts`

**Interfaces:**
- Produces (all exported from `src/core/world/story.ts`):
  ```ts
  export const ORIGINALS = ['Alvarez', 'Brandt', 'Chen', 'Dubois'] as const;
  export interface SceneLine { by: string[]; text: string }
  export interface ChoiceEffect { credits?: number; days?: number; stash?: StashKey }
  export interface SceneChoice { label: string; effect: ChoiceEffect; reply: SceneLine[] }
  export interface Scene { id: string; when: (w: World) => boolean; lines: SceneLine[]; choice?: [SceneChoice, SceneChoice] }
  export const SCENES: Scene[];                       // empty here, filled in Task 2
  export function sceneById(id: string, table?: Scene[]): Scene | undefined;
  export function nextScene(w: World, table?: Scene[]): Scene | null;
  export function see(w: World, id: string): World;
  export function choose(w: World, scene: Scene, option: 0 | 1): World;
  export function speakerFor(w: World, line: SceneLine): string;   // a name from ORIGINALS, or 'RECRUIT'
  ```
- Modifies `World`: `seen: string[]`, `chosen: Record<string, 0 | 1>`.

- [ ] **Step 1: Write the failing tests** in `tests/storyscenes.test.ts`, using small injected tables (not `SCENES`) built with a helper `scene(id, when, extra)`:
  - `nextScene` returns the first unseen scene whose `when` holds, in table order; returns `null` when none; skips a seen scene; returns null when `when` is false.
  - `see` returns a new world with the id appended once (idempotent for a repeated id) and leaves the input world untouched (compare JSON before and after).
  - `choose(w, sceneWithChoice, 1)` records `chosen[id] = 1`, marks it seen, and applies the effect; for option `{credits: 60, days: 3}` on a fresh world credits rise by 60 and `day` rises by 3 (via `advance`, so income also arrives: assert `day` only and `credits >= before + 60`); `{credits: -999}` leaves `credits === 0`; `{stash: 'medkit'}` raises `stash.medkit` by 1 (capped by `capStash`); a scene without a `choice` throws `'scene has no choice'`.
  - `speakerFor`: the first name in `by` that is in `w.soldiers` wins; if Alvarez is not in `soldiers` (dead) and `by = ['Alvarez', 'Brandt']` it returns `'Brandt'`; with none present it returns `'RECRUIT'`; a name not in `ORIGINALS` is never returned even if it is in `soldiers`.
  - `newWorld(1, 'calm')` has `seen: []` and `chosen: {}`, and `JSON.parse(JSON.stringify(w))` equals `w`.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/storyscenes.test.ts`
  Expected: FAIL (module `../src/core/world/story` not found).
- [ ] **Step 3: Add the world fields** in `src/core/world/world.ts`: `World.seen: string[]` and `World.chosen: Record<string, 0 | 1>` with doc comments; `newWorld` sets `seen: []`, `chosen: {}`; the private `clone` copies both (`seen: [...w.seen]`, `chosen: { ...w.chosen }`). Fix every other place that builds a `World` literal so `npm run typecheck` is clean (`src/storysave.ts` is done in Task 3; add `seen: [], chosen: {}` there temporarily).
- [ ] **Step 4: Implement `story.ts`** per the Interfaces block. `choose` clones the world with `{ ...w, seen, chosen }`, applies `credits` as `Math.max(0, w.credits + n)`, `stash` as `capStash(addStash(w.stash, stashOf({ [key]: 1 })))` (`stashOf` from `../stash`, `addStash`/`capStash` from `../loot`), then `days` via `advance(next, days)` last so income and garrisons run on the already-updated world. `see` and `choose` never mutate their input. `nextScene` filters on `!w.seen.includes(s.id) && s.when(w)`.
- [ ] **Step 5: Run to see it pass**
  Run: `npx vitest run tests/storyscenes.test.ts` then `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 6: Run the whole suite**
  Run: `npm test`
  Expected: all green (existing tests that deep-equal a world still pass because both sides come from `newWorld`; fix any that build the literal by hand).
- [ ] **Step 7: Commit**
  ```bash
  git add src/core/world/story.ts src/core/world/world.ts tests/storyscenes.test.ts src/storysave.ts
  git commit -m "feat: scene engine (nextScene, see, choose, speakerFor)"
  ```

---

### Task 2: The 18 scenes

**Files:**
- Modify: `src/core/world/story.ts` (fill `SCENES`)
- Test: `tests/storycontent.test.ts`

**Interfaces:**
- Consumes: Task 1 types, `capitalOpen`, `regionsHeld` from `world.ts`.
- Produces: `SCENES` in this table order: `landing, first-blood, friends, first-lab, wounded, recruits, offer, memorial-Alvarez, memorial-Brandt, memorial-Chen, memorial-Dubois, halfway, refugees, one-left, citadel-open, deserter, victory, defeat`.

Every scene except `victory` and `defeat` has a trigger that also requires `w.status === 'active'`; `victory` needs `w.status === 'won'`, `defeat` needs `'lost'`. Triggers:

| id | when (besides active) |
|---|---|
| landing | always |
| first-blood | `regionsHeld(w) >= 2` |
| friends | any region with holder `'allied'` |
| first-lab | `w.research.done.length >= 1` |
| wounded | any soldier `status === 'wounded'` |
| recruits | any soldier whose name is not in `ORIGINALS` |
| offer | `regionsHeld(w) >= 6 && w.day >= 20` |
| memorial-X | `w.fallen.some((f) => f.name === X)` |
| halfway | `regionsHeld(w) >= 10` |
| refugees | `regionsHeld(w) >= 12` and any allied region |
| one-left | `regionsHeld(w) === 1 && w.day >= 10` |
| citadel-open | `capitalOpen(w)` |
| deserter | `capitalOpen(w) && w.seen.includes('citadel-open')` |

Line text (the prose Rui reviews). `by` lists below are in order of preference; write each line so any listed speaker can say it.

```
landing            [Alvarez,Brandt]  "Meridian Holdings took this colony with a private army. The settlers hired us to take it back."
                   [Brandt,Alvarez]  "Four of us against an army. I have seen worse odds. Not many."
                   [Dubois,Chen]     "Where do we start?"
                   [Alvarez,Brandt]  "Ashfall Ridge. Then the next one. Then the one after that."
first-blood        [Brandt,Alvarez]  "One down. Sixteen to go."
                   [Dubois,Chen]     "Is it going to be like this every time?"
                   [Alvarez,Brandt]  "Every time. Eat something."
friends            [Dubois,Chen]     "They thanked us. Nobody has thanked me for anything in years."
                   [Alvarez,Brandt]  "Enjoy it. Do not get used to it."
first-lab          [Chen,Dubois]     "The lab finished its first job. Do not ask what it cost."
                   [Alvarez,Brandt]  "I am asking."
                   [Chen,Dubois]     "Less than a funeral."
wounded            [Chen,Alvarez]    "Someone is hurt. The field hospital earned its beds today."
                   [Alvarez,Brandt]  "Then keep them for the living."
recruits           [Dubois,Chen]     "New faces. I will show them where the coffee is."
                   [Brandt,Alvarez]  "I will show them where the cover is."
offer (CHOICE)     [Alvarez,Brandt]  "A Meridian courier left an envelope at the gate."
                   [Chen,Dubois]     "A ceasefire. Sixty credits and three quiet days, if we sit still."
                   [Brandt,Alvarez]  "They will use those days. You know they will."
   0 "TAKE IT"  {credits: 60, days: 3}   reply [Alvarez,Brandt] "We take the money. We pay for it later."
   1 "BURN IT"  {}                       reply [Brandt,Alvarez] "Good. I was hoping you would say that."
memorial-Alvarez   [Brandt,Chen,Dubois] "Alvarez never raised a voice. Not even at the end."
                   [Chen,Dubois]        "I will miss the quiet."
memorial-Brandt    [Alvarez,Chen,Dubois] "Brandt said the things we were all afraid to say."
                   [Dubois,Chen]         "Somebody will have to be rude for us now."
memorial-Chen      [Alvarez,Brandt,Dubois] "Chen kept us alive and kept us laughing."
                   [Dubois,Brandt]         "The lab is very quiet."
memorial-Dubois    [Alvarez,Brandt,Chen] "Dubois believed we would win. Somebody has to keep believing."
                   [Chen,Brandt]         "Then we carry that now."
halfway            [Alvarez,Brandt]  "Ten regions. Count who is still standing."
                   [Chen,Dubois]     "I counted twice. I would like to keep counting."
refugees (CHOICE)  [Dubois,Chen]     "There are families at the gate. They have nowhere else."
                   [Brandt,Alvarez]  "Every mouth we feed is a mouth that is not a gun."
   0 "SHELTER THEM" {credits: -30, stash: 'medkit'}  reply [Dubois,Chen] "They left us a medkit and the best soup I ever had."
   1 "MOVE ON"      {}                               reply [Alvarez,Brandt] "We move on. We do not talk about it."
one-left           [Alvarez,Brandt,Chen,Dubois] "One region left. This is the thin line."
                   [Brandt,Alvarez]             "Then we hold it."
citadel-open       [Brandt,Alvarez]  "That is Meridian Citadel. Two gates are ours. One road in."
                   [Alvarez,Brandt]  "If anyone wants to stay behind, now is the time."
                   [Dubois,Chen]     "Nobody is staying behind."
deserter (CHOICE)  [Chen,Dubois]     "A Meridian officer is at the fence. They say they have the gate codes."
                   [Brandt,Alvarez]  "Or they have a rope and a very patient friend."
   0 "TRUST THEM"    {days: 2, stash: 'scanner'}  reply [Chen,Dubois] "The codes were real. So was the scanner they left behind."
   1 "SEND THEM AWAY" {}                          reply [Brandt,Alvarez] "No codes. No trap. I can live with that."
victory            [Alvarez,Brandt,Chen,Dubois] "The Citadel is ours. The colony is free."
                   [Brandt,Dubois,Chen,Alvarez] "Four against an army, they said."
                   [Dubois,Chen,Alvarez,Brandt] "Remember the ones who did not make it up here."
defeat             [Alvarez,Brandt,Chen,Dubois] "The last light is out."
                   [Brandt,Alvarez,Chen,Dubois] "We held as long as we could."
```

- [ ] **Step 1: Write the failing tests** in `tests/storycontent.test.ts` against `SCENES`:
  - ids are unique, the table has exactly 18 scenes in the order above, and exactly `offer`, `refugees`, `deserter` have a `choice`.
  - Every `text` and every choice `label` passes `unsupportedChars(...) === []`; every label is at most 14 characters.
  - Fit: using `wrapText` from `src/screens/scene.ts` is not available yet, so test with an inline greedy wrap of width `floor(340 / ADVANCE)` characters (`ADVANCE` from `src/ui/font.ts`): each line wraps to at most 2 rows; each scene has at most 6 lines; each reply at most 3 lines; every `by` list is non-empty and holds only `ORIGINALS` names.
  - Triggers on crafted worlds (helper `hold(w, ids, holder)` as in `tests/worldresolve.test.ts`, `CAPITAL_GATES` from `planet.ts`): on `newWorld(1,'calm')` only `landing` is pending; holding region 1 adds `first-blood`; one allied region (id 5) adds `friends`; a world with `research.done = ['shotgun']` adds `first-lab`; a soldier with `status: 'wounded', daysLeft: 3` adds `wounded`; a soldier named `Eriksen` adds `recruits`; `regionsHeld = 6` and `day = 20` adds `offer`; each `fallen: [{name: X, kills: 0, trained: 0}]` adds exactly `memorial-X`; `regionsHeld = 10` adds `halfway`; 12 held plus an allied adds `refugees`; one held region and `day = 10` adds `one-left`; both capital gates held adds `citadel-open` but not `deserter`, and `deserter` appears once `seen` contains `citadel-open`; `status: 'won'` yields only `victory` pending (no other scene), `status: 'lost'` only `defeat`.
  - Play-through: repeatedly `see(w, nextScene(w)!.id)` on a world that satisfies many triggers terminates and shows each scene once.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/storycontent.test.ts`
  Expected: FAIL (`SCENES` is empty).
- [ ] **Step 3: Fill `SCENES`** in table order with the prose and effects above, using a local helper `active = (f) => (w) => w.status === 'active' && f(w)`. Helpers for the trigger bodies may be local consts.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/storycontent.test.ts tests/storyscenes.test.ts`
  Expected: PASS. If a line fails the fit test, shorten that line (keep the voice), do not loosen the test.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test` and `npm run typecheck`
  Expected: green; typecheck exits 0.
- [ ] **Step 6: Commit**
  ```bash
  git add src/core/world/story.ts tests/storycontent.test.ts
  git commit -m "feat: the 18 story scenes"
  ```

---

### Task 3: Save version 3 and migration

**Files:**
- Modify: `src/storysave.ts`
- Test: `tests/storysave.test.ts`, `tests/storysavev1.test.ts` (edit), `tests/storysavev2.test.ts` (create)

**Interfaces:**
- Consumes: `SCENES`, `nextScene`, `sceneById` from Task 1/2.
- Produces: `STORY_SAVE_VERSION = 3`; `parseStory` accepts versions 1, 2 and 3.

- [ ] **Step 1: Write the failing tests.**
  - In `tests/storysavev2.test.ts`: a version 2 save as project 2 wrote it (`{ version: 2, world: <newWorld JSON without seen and chosen>, loadout }`) loads into a world with `chosen: {}` and `seen` containing `'landing'` (a trigger already true at day 0). A v2 save whose world has `fallen: [{ name: 'Brandt', kills: 1, trained: 0 }]` and two capital gates held loads with `seen` containing `memorial-Brandt` and `citadel-open`, and so does `deserter` (the migration loop re-evaluates `when` after each `see`, so a scene that unlocks another is marked too); `nextScene(loaded.world)` is `null`, and `chosen` is `{}` even though `deserter` is seen.
  - A v1 save also gets `seen` filled by the same rule.
  - In `tests/storysave.test.ts`: change `good()` to `version: 3`; a v3 world round-trips `seen` and `chosen`; reject: `seen` not an array, an unknown id, a duplicate id; `chosen` key not a choice scene, value not 0 or 1, a chosen key whose scene is not in `seen`; the existing "wrong version" test now uses version 4.
  - A migrated or v3 world with `status: 'won'` or `'lost'` still parses (ended stories are normally cleared, but the validator must not choke on them).
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/storysave.test.ts tests/storysavev1.test.ts tests/storysavev2.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement.** In `parseStory`, accept `raw.version` 1, 2 or 3. For version 3 read `seen` (array of unique strings, each a known scene id) and `chosen` (object whose keys are scene ids having a `choice` and are in `seen`, values `0 | 1`). For versions 1 and 2, start from the parsed world with `seen: []`, `chosen: {}`, then loop: `let s = nextScene(world); while (s) { world = see(world, s.id); s = nextScene(world); }`, which marks every already-true scene as seen. `StoryStore.save` writes `STORY_SAVE_VERSION`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/storysave.test.ts tests/storysavev1.test.ts tests/storysavev2.test.ts`
  Expected: PASS.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test` and `npm run typecheck`
  Expected: green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/storysave.ts tests/storysave.test.ts tests/storysavev1.test.ts tests/storysavev2.test.ts
  git commit -m "feat: story save version 3 with scene record and migration"
  ```

---

### Task 4: The scene screen and the play state machine

**Files:**
- Create: `src/screens/scene.ts`, `src/sceneplay.ts`
- Test: `tests/scenescreen.test.ts`, `tests/sceneplay.test.ts`

**Interfaces:**
- Consumes: `Scene`, `SceneLine`, `speakerFor` (Task 1); `drawFrame/drawButton/UI` from `../ui/frame`, `drawText` and `onText` from `../ui/text`, `ADVANCE` from `../ui/font`, `VIEW` from `../render/layout`.
- Produces from `src/sceneplay.ts`:
  ```ts
  export type Phase = 'lines' | 'choice' | 'reply';
  export interface ScenePlay { scene: Scene; phase: Phase; index: number; picked: 0 | 1 | null }
  export function startPlay(scene: Scene): ScenePlay;
  export function shownLine(p: ScenePlay): SceneLine | null;            // null in the 'choice' phase
  export function forward(p: ScenePlay): ScenePlay | 'done';            // next line; last line of a choice scene goes to 'choice'; last line of a plain scene or a reply is 'done'; in 'choice' it stays (a click must pick)
  export function pick(p: ScenePlay, option: 0 | 1): ScenePlay;         // only valid in 'choice': goes to 'reply' (or 'done' is reached by forward on the last reply line)
  export function skip(p: ScenePlay): ScenePlay | 'done';               // plain scene or reply: 'done'; lines of a choice scene: jumps to 'choice'
  ```
- Produces from `src/screens/scene.ts`:
  ```ts
  export interface SceneView { speaker: string; text: string; choices: [string, string] | null; skippable: boolean }
  export const SCENE: { box: Rect; portrait: Rect; skip: Rect; choices: [Rect, Rect] };
  export type SceneHitResult = 'next' | 'skip' | { kind: 'choice'; index: 0 | 1 };
  export function wrapText(text: string, maxPx: number): string[];
  export function sceneHit(px: number, py: number, view: Pick<SceneView, 'choices'>, slop?: number): SceneHitResult | null;
  export function drawScene(ctx: CanvasRenderingContext2D, v: SceneView): void;
  ```
  with `Rect` from `../ui/frame`.

- [ ] **Step 1: Write the failing tests.**
  - `sceneplay.test.ts` with an injected plain scene (2 lines) and a choice scene (2 lines, choice replies of 2 lines): `forward` walks line 0, line 1, then `'done'` for the plain scene; for the choice scene the last line moves to phase `'choice'` with `shownLine === null`; `forward` in `'choice'` returns the same play (no skipping a choice); `pick(p, 1)` gives phase `'reply'`, `picked 1`, `index 0`, showing the first reply line; `forward` through the reply ends `'done'`; `skip` on a plain scene is `'done'`, on a choice scene's lines it is `{phase: 'choice'}`, never `'done'`, and during a reply it is `'done'`.
  - `scenescreen.test.ts`: `wrapText` never exceeds `maxPx` per row (`textWidth` from the font), splits on spaces, keeps a single over-long word whole on its own row; `sceneHit` returns `'skip'` on the skip button, `'next'` elsewhere when there are no choices, `{kind:'choice', index}` on each choice rect and `null` for a click outside nothing (every point is `'next'` or a button in the lines phase, so assert the choice phase: a click outside both choice buttons and skip returns `null`); `SCENE` rects lie inside 480x400 and the two choice rects and the skip rect do not overlap each other or the portrait; `drawScene` with a stub context records only supported characters (use `onText` as `tests/squadscreen.test.ts` does), keeps every run inside 0..480, and draws the speaker's name and the portrait letter.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/sceneplay.test.ts tests/scenescreen.test.ts`
  Expected: FAIL (modules not found).
- [ ] **Step 3: Implement `src/sceneplay.ts`** per the Interfaces block (plain immutable data, no canvas).
- [ ] **Step 4: Implement `src/screens/scene.ts`.** Layout (all inside 480x400; adjust only if the overlap test fails): full black background; text box `SCENE.box = { x: 20, y: 250, w: 440, h: 130 }` drawn with `drawFrame(..., 'raised')`; portrait `SCENE.portrait = { x: 32, y: 262, w: 64, h: 64 }` drawn as an `'inset'` frame with the speaker's first letter at scale 3 centred (the portrait slot for project 3c); the speaker name at `x: 108, y: 264` in `UI` accent colour (use the colour the planet screen uses for headings); the line text wrapped to `340` px, rows `10` px apart starting `y: 282`; `SCENE.skip = { x: 384, y: 356, w: 64, h: 18 }` labelled `SKIP` (hidden when `skippable` is false); `SCENE.choices = [{ x: 108, y: 326, w: 216, h: 20 }, { x: 108, y: 350, w: 216, h: 20 }]` drawn as buttons only when `choices` is not null, and then the line text is hidden. When there are no choices, draw the hint `CLICK OR SPACE` at the bottom-left of the box in the dim colour. `sceneHit` order: skip, then choices (when present), then `'next'` only when `choices` is null.
- [ ] **Step 5: Run to see it pass**
  Run: `npx vitest run tests/sceneplay.test.ts tests/scenescreen.test.ts`
  Expected: PASS.
- [ ] **Step 6: Run the whole suite**
  Run: `npm test` and `npm run typecheck`
  Expected: green.
- [ ] **Step 7: Commit**
  ```bash
  git add src/sceneplay.ts src/screens/scene.ts tests/sceneplay.test.ts tests/scenescreen.test.ts
  git commit -m "feat: scene screen and scene play state machine"
  ```

---

### Task 5: App wiring

**Files:**
- Modify: `src/app.ts`, `tests/storyapp.test.ts`, `tests/baseapp.test.ts` (and any other test file that builds an `App` and drives the story; find them with `grep -ln "storyStore" tests`)
- Test: `tests/sceneapp.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1, 2, 4.
- Produces: `AppOptions.scenes?: boolean` (default `true`); `Screen` gains `'scene'`; private `App.showScenes(then?: Screen): void`; scene keys: Space or Enter advance, Escape skips.

Stops where `showScenes` runs: end of `startStory` (the landing); `continueFromResult`'s story branch (target `'planet'` or `'end'`); after a visit in `actOnRegion` and after `doPanelAction` (after `afterTimePassed`, with `then = this.screen`, which is already `'end'` if the world is over). `showScenes`: if `!this.sceneOn` or no pending scene, set `this.screen = then` and return; otherwise take `nextScene(this.story)`, start a `ScenePlay`, remember `sceneThen = then` and a counter `scenesThisStop` (reset to 0 at the first call of a stop, capped at 3). When a scene finishes (`'done'`): `story = see(story, id)` for a plain scene, or `choose(story, scene, picked)` for a choice scene; `saveStory()`; if `scenesThisStop < 3` and `nextScene` is non-null start it, else `screen = sceneThen`. If the story is no longer `active` while scenes are pending, `victory`/`defeat` are the only ones `nextScene` returns (guaranteed by Task 2).

- [ ] **Step 1: Write the failing test file `tests/sceneapp.test.ts`** reusing the `setup` helper pattern from `tests/storyapp.test.ts` (copy its `memory`, `setup`, `click`, `newStory`, `act`, `attack`, `finishMission` helpers into the new file with `scenes: true` and add a `press(key)` that calls `app.key`). Tests:
  - starting a new story shows `screen === 'scene'` (landing); clicking through its 4 lines ends on `'planet'`; the world's `seen` contains `landing`; reloading from the same storage skips the landing (a new `App` over the same `memory` goes to the planet after STORY).
  - Escape during a plain scene finishes it (`seen` has it) and goes on; Escape during the lines of a choice scene shows the choice (screen still `'scene'`, play phase `'choice'`) and does not mark it seen.
  - Winning the first region shows `first-blood` after the result screen's continue, then the planet.
  - A choice: setting up a world where `offer` is pending (use `app.story = {...}` crafted with held >= 6 and day >= 20, then trigger a stop through a visit), clicking choice 0 makes `credits >= before + 60`, shows the reply, and records `chosen.offer === 0`; saving and reloading keeps `chosen` and does not replay `offer`.
  - A stop never shows more than 3 scenes: with a world satisfying 5 scenes at a stop, exactly 3 play, then the planet shows; the remaining 2 play at the next stop.
  - When the capital falls (`status` becomes `'won'`), `victory` plays and then the end screen shows.
  - `new App({ scenes: false })` never enters `'scene'`.
  - Space and Enter advance a line; the input lock (300 ms) does not eat the first click of a scene (scenes are shown after `lock()`; assert that a click after `wait()` works as in the other helpers).
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/sceneapp.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement the wiring in `src/app.ts`.**
  - Add `'scene'` to `Screen`; `scenes?: boolean` to `AppOptions`; fields `sceneOn`, `scenePlay: ScenePlay | null`, `sceneThen: Screen`, `scenesThisStop`.
  - Mouse: in the click handler add `case 'scene'` using `sceneHit`; `'next'` calls a private `sceneForward()`, `'skip'` calls `sceneSkip()`, a choice hit calls `scenePick(index)`.
  - Keys: `case 'scene'`: Space and Enter call `sceneForward()` (unless locked), Escape calls `sceneSkip()`. A scene screen counts as a menu screen in `draw` (add it to the `menu` list) and is drawn through `inMenuSpace` with a `SceneView` built from the current `ScenePlay` and `speakerFor(this.story, line)` (the replies use the same speaker rule).
  - Call `showScenes` at the four stops listed above; in `continueFromResult` and `startStory` compute the target screen first and pass it.
  - Title screen: leaving the scene screen via any route that sets another screen (toTitle) clears `scenePlay`.
  - Existing tests: in every test file that builds the story `App`, add `scenes: false` to the options (for example in `setup(...)` in `tests/storyapp.test.ts` and `tests/baseapp.test.ts`); do not edit assertions.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/sceneapp.test.ts tests/storyapp.test.ts tests/baseapp.test.ts`
  Expected: PASS.
- [ ] **Step 5: Run the whole suite, typecheck, build**
  Run: `npm test`, `npm run typecheck`, `npm run build`
  Expected: all green; build succeeds.
- [ ] **Step 6: Commit**
  ```bash
  git add src/app.ts tests/
  git commit -m "feat: show story scenes at the end of each story action"
  ```

---

### Task 6: The bot, reachability and the browser check

**Files:**
- Modify: `src/sim/story.ts`
- Test: `tests/storysim.test.ts` (edit), `tests/storysimscenes.test.ts` (create)

**Interfaces:**
- Consumes: `nextScene`, `see`, `choose` (Task 1/2).
- Produces: `runStory` plays pending scenes after every world change; `StoryRun` gains `scenes: string[]` (ids seen, in order).

- [ ] **Step 1: Write the failing test** `tests/storysimscenes.test.ts`: run `runStory(seed, 'calm', playWithBot('careful'))` for seeds 1 to 3 (60 s timeout, as `tests/storysim.test.ts` does); in each run `run.scenes` has no duplicate ids, `landing` is first, includes `first-blood` and `citadel-open`; a run that ended `won` ends its list with `victory`; the world is still `'won'`, `'lost'` or `'active'` consistent as before (assert `status` is one of them and `steps <= 300`); every choice scene in `run.scenes` has `run.final.chosen[id] === 0`.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/storysimscenes.test.ts`
  Expected: FAIL (`scenes` undefined).
- [ ] **Step 3: Implement.** Add a local `playScenes(w): World` in `src/sim/story.ts`: loop `nextScene(w)` until null, calling `choose(w, scene, 0)` for scenes with a choice and `see` otherwise; call it at the start of `runStory` and after every `resolve`, `visit` and `tendBase` result; collect ids into the run's `scenes` array. The bot must not be limited to 3 scenes per stop.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/storysimscenes.test.ts tests/storysim.test.ts`
  Expected: PASS.
- [ ] **Step 5: Run everything**
  Run: `npm test`, `npm run typecheck`, `npm run build`, `npm run balance`
  Expected: all green; balance prints the story runs without exceptions.
- [ ] **Step 6: Check it in the browser.** Start `laser-tribute-dev` with `preview_start`, press S, pick CALM, and confirm the landing scene appears with portrait, name and text, clicks advance, SKIP works; check at phone width too (`resize_window` mobile). Take a screenshot of a scene and of a choice scene (use `app.story` through the page's debug handle if the build exposes one; otherwise play to a visit that triggers `friends`).
- [ ] **Step 7: Refresh the graph and commit**
  ```bash
  trail build
  git add src/sim/story.ts tests/storysimscenes.test.ts tests/storysim.test.ts
  git commit -m "feat: story bot plays scenes; reachability tests"
  ```
