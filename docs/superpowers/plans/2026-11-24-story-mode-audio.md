# Story Mode Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the story mode two music moods (a calm `planet` theme and a dark `base` theme) in the existing soundtrack engine, a screen-to-mood rule, and `victory` and `defeat` stingers that duck the music.

**Architecture:** `Mood` grows to four values and `Music` keeps one layer per mood with a generator per mood; a pure `moodFor(screen, ...)` replaces the title/tracker rule in the app. Stingers are a separate synth-segment table played through `Sound.stinger`, which asks `Music.duck` to dip the music. Everything stays behind the existing lazy start (no timer, no music nodes).

**Tech Stack:** TypeScript strict, Web Audio through the project's `AudioContextLike` fakes, Vitest, Vite. Run: `npm test`, `npm run typecheck`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-11-24-laser-tribute-story-mode-audio-design.md`

## Global Constraints

- Primitives are oscillators (`sine`, `triangle`, `square`, `sawtooth`), gains and the one-second noise buffer. No filters, no new audio node types, `AudioContextLike` unchanged. The `planet` and `base` moods use only `sine` and `triangle` oscillators plus noise (no `square`, no `sawtooth`).
- No change to `EFFECTS`, `BUS_OF`, the mission moods or `MoodTracker` rules; `tests/soundeffects.test.ts`, `tests/audiomix.test.ts` and the existing `tests/music.test.ts` tests stay green unchanged.
- Music starts only on the first gesture and only with a timer (the Nov 3 learning); silent layers start with fade times at `-Infinity` and gain `0.0001`; new `Sound` members go after the interface.
- Mute and volume 0 silence the new moods and the stingers; tests with no timer see no new nodes.
- All tunable numbers (scales, notes, levels, timings, fade times, duck depth) are named constants at the top of the file that owns them.
- Nobody working on this can hear the result: report measurements, not taste. Rui listens and tunes.

## Review Focus

- A leak between moods: after startup and after switching, only the current mood's parts are scheduled, and a silent layer schedules nothing (Task 2).
- Mute, volume 0 and "before the first gesture": the new moods and the stingers are silent and never throw (Tasks 2, 3).
- Scenes never change the music; Tutorial and Campaign screens never get `planet` or `base`; the end screen gets `planet` after its stinger (Tasks 1, 4).
- A stinger fired twice (two scenes in a row, a repeat) must not stack: the second is ignored while one plays (Task 3).
- Level: each new mood and each stinger measured offline against calm, action and the mission jingle; no clipping (Task 5).

---

### Task 1: Which mood each screen gets

**Files:**
- Create: `src/audio/moodfor.ts`
- Modify: `src/audio/music.ts` (the `Mood` and `FightMood` types and `MoodTracker`)
- Test: `tests/moodfor.test.ts`

**Interfaces:**
- Produces from `src/audio/music.ts`: `export type Mood = 'calm' | 'action' | 'planet' | 'base'`; `export type FightMood = 'calm' | 'action'`; `MoodTracker.mood` and `update` typed `FightMood`; `export const MOODS: readonly Mood[]` = `['calm', 'action', 'planet', 'base']`.
- Produces from `src/audio/moodfor.ts`:
  ```ts
  export interface StoryState { active: boolean; fight: boolean }   // a story is on; a story fight is being prepared (pendingSpec set)
  export function moodFor(screen: string, story: StoryState, tracked: FightMood, current: Mood): Mood;
  ```
  Rules: `title` is `action`; `difficulty` and `planet` are `planet`; `base`, `panel` and `squad` are `base`; `equipment` is `base` when `story.fight`, else `tracked`; `scene` is `current`; `end` is `planet` when `story.active`, else `tracked`; `mission`, `result` and any other screen are `tracked`.

- [ ] **Step 1: Write the failing tests** (`tests/moodfor.test.ts`): the full table above with `story = { active: true, fight: false }` and `tracked = 'calm'`, then with `tracked = 'action'` (only `mission`, `result`, `equipment` without a fight and other screens follow it); `equipment` with `fight: true` gives `base`; `scene` returns whatever `current` is for each of the four moods; `end` gives `planet` for an active story and `tracked` otherwise; with `story = { active: false, fight: false }` (Tutorial and Campaign) no screen in `['equipment', 'mission', 'result', 'end', 'scene']` returns `planet` or `base` for `tracked = 'calm'`; an unknown screen name returns `tracked`. In `tests/music.test.ts`'s style, `MOODS` has four entries and `MoodTracker` still returns only `calm` or `action`.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/moodfor.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement.** Widen `Mood`, add `FightMood` and `MOODS` in `music.ts` and retype `MoodTracker`; write `moodfor.ts`. `Music` and `Sound` still compile because `Mood` is a superset (the `Record<Mood, Layer>` change is Task 2, so for this task `Music` may keep working through a temporary cast; the task ends with `npm run typecheck` clean).
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/moodfor.test.ts tests/music.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/audio tests/moodfor.test.ts
  git commit -m "feat: the four moods and which screen gets which"
  ```

---

### Task 2: The planet and base themes, and ducking, in the engine

**Files:**
- Modify: `src/audio/music.ts`
- Test: `tests/music.test.ts` (extend with new `describe` blocks)

**Interfaces:**
- Consumes: `Mood`, `MOODS` (Task 1).
- Produces: `Music` with a layer per mood (`Record<Mood, Layer>`), generators `calmBar`, `actionStep`, `planetBar(layer, t): number` and `baseBar(layer, t): number` (each returns the next start time), `setMood` for all four moods, and `duck(seconds: number): void`. New exported constants: `FADE_TO_PLANET = 2.5`, `FADE_TO_BASE = 2.5`, `DUCK_DEPTH = 0.3`, `DUCK_RECOVER = 1`.

Musical content (all numbers are named constants; values here are the starting point):
- `planetBar` (returns `t + 8` for 10 s bars that overlap): pad of sine swells at D3 146.83, A3 220 and D4 293.66, peak 0.08, edge 3 s, length 10 s; a triangle at A3 times 1.003 peak 0.03; wind as 8 overlapping noise bursts of about 1.2 s spaced 1.1 s with a swell envelope, peak 0.012 (the noise buffer is one second long, like `hat` uses it); up to 3 plucked notes per bar from `[293.66, 329.63, 369.99, 440, 493.88, 587.33]`, each present when `random() <= 0.6`, placed at `t + 0.5 + random() * 6`, with echoes at +0.7 s and +1.4 s (peaks 0.09, 0.04, 0.02) via `ping`. No drums.
- `baseBar` (returns `t + 7.2`): sine drone D1 36.71 peak 0.12 and D2 73.42 peak 0.09 (length 9 s, edge 3 s), a triangle at D2 times 1.006 peak 0.04; on every other bar a sine pair D2 73.42 and E-flat 77.78 swell, peak 0.05, length 6 s; four heartbeat pulses at `t + i * 1.8` (a sine `blip` gliding 60 to 38 Hz, 0.35 s, peak 0.3); a metallic ping on a bar when `random() < 0.4`: three sine pings at `f`, `f * 2.76`, `f * 5.4` (with `f` between 600 and 900 Hz), peaks 0.05, 0.03, 0.015 and a 3 s decay. No melody.
- `duck(seconds)`: on the output gain, from now: ramp to `level * DUCK_DEPTH` over 0.15 s, hold until `now + seconds`, ramp back to `level` over `DUCK_RECOVER` seconds; uses only `setValueAtTime`, `exponentialRampToValueAtTime` and the optional `cancelScheduledValues`; does nothing when the level is 0.

- [ ] **Step 1: Write the failing tests**, extending the fake context of `tests/music.test.ts` to also record each gain's calls (`setValueAtTime` and `exponentialRampToValueAtTime` with their arguments, in creation order: the output gain first, then one gain per layer in `MOODS` order) and each oscillator's wave and starting frequency:
  - Startup does not leak: a new `Music` (default mood calm) with `random = () => 0.99` and one tick at time 0 creates exactly 4 oscillators (the calm drone), and the four layer gains were created with initial values `[1, 0.0001, 0.0001, 0.0001]`.
  - `setMood('planet')`, clock moved to 3.1 s (past the fade plus the 0.5 s tail) and one tick: every oscillator created after the switch has wave `sine` or `triangle`, at least one is created, and none starts at a calm-only or action-only frequency (`MELODY` calm notes are shared with the pentatonic, so assert on the wave types and on `73.42`/`36.71` being absent for planet); `setMood('base')` likewise: only `sine` or `triangle`, and a `36.71` Hz oscillator is created; with `random = () => 0.99` the planet bar creates no plucked notes and the base bar no metallic pings (counts).
  - Settling away: after `planet` has been current and the clock is past the fade, switching to `calm` stops new planet notes (oscillator count per tick returns to the calm count with `random = () => 0.99`).
  - `setLevel(0)` schedules nothing in any of the four moods (oscillator count stays 0 over a tick).
  - `duck(3)` at time 0 with level 0.5: the output gain records a ramp down to `0.5 * 0.5 * 0.3` (the engine's `MUSIC_GAIN` times the level times `DUCK_DEPTH`) by 0.15 s and a ramp back up to `0.5 * MUSIC_GAIN` by `3 + 1` s; `duck` with level 0 records nothing.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/music.test.ts`
  Expected: FAIL (new tests only).
- [ ] **Step 3: Implement** in `music.ts`: layers as a record built over `MOODS` (the `calm` layer on, the rest silent with `-Infinity` fade times); `setMood` fades every layer toward 1 or silent with the duration `FADE_TO_ACTION` for `action`, `FADE_TO_PLANET` for `planet`, `FADE_TO_BASE` for `base` and `FADE_TO_CALM` for `calm`; `tick` iterates `MOODS` and schedules each audible layer through a generator table (`calm`: `calmBar`, `action`: `actionStep`, `planet`: `planetBar`, `base`: `baseBar`), keeping the existing "resume in time with the clock" resets; add `duck`. A private `wind` helper builds the noise breath.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/music.test.ts tests/soundeffects.test.ts tests/audiomix.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/audio/music.ts tests/music.test.ts
  git commit -m "feat: planet and base themes and music ducking in the soundtrack engine"
  ```

---

### Task 3: The stingers

**Files:**
- Modify: `src/audio/effects.ts` (add `STINGERS`), `src/audio/sound.ts` (`Sound.stinger`, `SoundPlayer.stinger?`)
- Test: `tests/stingers.test.ts`

**Interfaces:**
- Consumes: `Segment`, `Bus` (existing); `Music.duck` (Task 2).
- Produces from `src/audio/effects.ts`:
  ```ts
  export const STINGER_NAMES = ['victory', 'defeat'] as const;
  export type StingerName = (typeof STINGER_NAMES)[number];
  export const STINGERS: Record<StingerName, Segment[]>;
  export const STINGER_BUS: Bus;          // 'ui'
  export const STINGER_LEVEL: number;     // 0.9, scales the segment gains with the volume
  export function stingerDuration(name: StingerName): number;   // the last segment end, in seconds
  ```
  and from `src/audio/sound.ts`: `SoundPlayer.stinger?(name: StingerName): void` and `Sound.stinger(name)`.

Starting content (constants at the top of the table):
- `victory` (ends at 3.2 s): triangle notes D4 293.66, A4 440, D5 587.33, F#5 739.99 at 0, 0.22, 0.44, 0.66 s, 0.5 s each (the last 1.0 s), gain 0.32; a low drum blip triangle 140 to 45 Hz, 0 to 0.35 s, gain 0.5; from 1.0 s a held D major chord of triangles at D5 587.33, F#5 739.99, A5 880 and D4 293.66, each 2.2 s, gain 0.22, and a sawtooth D3 146.83, 2.2 s, gain 0.12.
- `defeat` (ends at 3.6 s): triangle notes A4 440, F4 349.23, D4 293.66 at 0, 0.5, 1.0 s (0.5 s each), A3 220 at 1.5 s for 0.8 s, gain 0.3; a low triangle 73.42 gliding to 55 Hz from 1.6 s for 2.0 s, gain 0.3; a noise sweep from 1.5 s for 1.8 s, gain 0.12.

- [ ] **Step 1: Write the failing tests** (`tests/stingers.test.ts`, using the fake context style of `tests/music.test.ts` and a `Sound` built with that context factory and no timer):
  - Table: both names exist; `stingerDuration('victory')` is between 2.8 and 3.6 and `stingerDuration('defeat')` between 3.0 and 4.0; every segment's frequencies are positive and every gain is at most 0.5; `victory` contains the segments at 293.66, 440, 587.33 and 739.99 Hz in start order; `defeat` starts with 440 and descends (each later note's frequency lower than the previous, for the four notes); `STINGER_BUS` is a member of `BUSES`; `STINGER_NAMES` and `SOUND_NAMES` share no names; `EFFECTS` has no stinger name.
  - `Sound.stinger('victory')` after `unlock()` creates one oscillator per tone segment (and a buffer source per noise segment); `stinger` before `unlock()` (no context) does nothing and does not throw; muted: nothing; volume 0: nothing.
  - A second `stinger` call while one is playing (the clock short of `stingerDuration`) creates nothing; after the clock passes the end a new call plays again.
  - With a manual timer so the music exists, `vi.spyOn(Music.prototype, 'duck')` is called once with the stinger's duration; without music (no timer) `stinger` still plays and does not throw.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/stingers.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement** the table and helpers in `effects.ts` (after `EFFECTS`; do not touch `EFFECTS`, `SOUND_NAMES` or `BUS_OF`), and in `sound.ts` (members after the interface) a `private stingerEnd = -Infinity` and `stinger(name)`: return when there is no context or the sound is muted or the volume is 0 or `ctx.currentTime < this.stingerEnd`; set `stingerEnd`; play every segment through the existing private `segment` with the stinger bus and `volume * STINGER_LEVEL`, detune factor 1; call `this.music?.duck(stingerDuration(name))`. Add the optional `stinger?` to `SoundPlayer`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/stingers.test.ts tests/soundeffects.test.ts tests/audiomix.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run the whole suite**
  Run: `npm test`
  Expected: all green.
- [ ] **Step 6: Commit**
  ```bash
  git add src/audio tests/stingers.test.ts
  git commit -m "feat: victory and defeat stingers that duck the music"
  ```

---

### Task 4: The app chooses the music and plays the stingers

**Files:**
- Modify: `src/app.ts` (`updateMusic`, the scene start)
- Test: `tests/storymusic.test.ts`

**Interfaces:**
- Consumes: `moodFor`, `StoryState` (Task 1); `StingerName`, `SoundPlayer.stinger?` (Task 3); `Mood` (Task 1).
- Produces: the app calls `this.sound.setMood?.(mood)` with the mood from `moodFor(this.screen, { active: this.story !== null, fight: this.story !== null && this.pendingSpec !== null }, trackedMood, this.soundMood)`, and `this.sound.stinger?.('victory' | 'defeat')` when a scene with that id starts.

- [ ] **Step 1: Write the failing tests** (`tests/storymusic.test.ts`: the `setup` pattern of `tests/sceneapp.test.ts` with a fake sound `{ play() {}, unlock() {}, toggleMute: () => '', changeVolume: () => '', setMood: (m) => moods.push(m), stinger: (n) => stingers.push(n), muted: false, volume: 1 }`, calling `app.update(t)` after each step so the music rule runs): the mood after each screen of a story — difficulty and planet `planet`, base and a panel and the squad step `base`, equipment of a story fight `base`, a scene opened from the planet keeps `planet` and one opened from the base keeps `base`, a mission `calm`, back on the planet `planet`; Tutorial and Campaign equipment screens never produce `planet` or `base`; the title still gives `action`; the story's end screen gives `planet`. Stingers: with a crafted world (as `tests/sceneapp.test.ts` builds them) a won story plays `victory` exactly once when the victory scene starts and not again on the end screen, a lost one plays `defeat` once; an ordinary scene (`landing`) plays no stinger; with `scenes: false` no stinger is ever played; a fake sound with no `stinger` method does not break the app.
- [ ] **Step 2: Run to see it fail**
  Run: `npx vitest run tests/storymusic.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement.** In `updateMusic`: compute the tracked mood as today (`this.mood.update(seen, now)`), then `const mood = moodFor(this.screen, story, tracked, this.soundMood as Mood)` and keep the `soundMood` change check. Type `soundMood` as `Mood`. In `nextSceneOrLeave`, after `startPlay(next)`, call `this.sound.stinger?.(next.id)` when `next.id` is `'victory'` or `'defeat'`.
- [ ] **Step 4: Run to see it pass**
  Run: `npx vitest run tests/storymusic.test.ts tests/music.test.ts tests/soundapp.test.ts tests/sceneapp.test.ts` and `npm run typecheck`
  Expected: PASS; typecheck exits 0.
- [ ] **Step 5: Run everything**
  Run: `npm test` and `npm run build`
  Expected: green; build succeeds.
- [ ] **Step 6: Commit**
  ```bash
  git add src/app.ts tests/storymusic.test.ts
  git commit -m "feat: the story's screens choose the music, and the ending plays its stinger"
  ```

---

### Task 5: Measure it

**Files:**
- Create: none in the repo (a throwaway script in the scratchpad); the numbers go in the ledger and the PR
- Modify: none

- [ ] **Step 1: Render each mood offline in the browser pane.** `preview_start laser-tribute-dev`; in the page (through `javascript_tool`) import `/src/audio/music.ts`, build an `OfflineAudioContext(1, 44100 * 30, 44100)`, a `Music` on it with a manual scheduler, a noise buffer like `Sound.noiseBuffer` makes, `random = Math.random`, level 1 and the mood under test; render in half-second steps with `ctx.suspend(t)` calling the scheduler's tick at each step and then `ctx.resume()`; read the rendered buffer and compute the RMS and the peak of seconds 5 to 30. Do it for `calm`, `action`, `planet` and `base` (several runs each because the notes are random; report the mean RMS and the highest peak).
- [ ] **Step 2: Render the stingers and the mission jingle.** Build a `Sound` on an `OfflineAudioContext(1, 44100 * 6, 44100)` (`createContext` returns it, `unlock()`), call `stinger('victory')` (and separately `stinger('defeat')` and `play('win')`) at time 0, render 6 s, and read the peak and RMS of the first 4 s.
- [ ] **Step 3: Judge the numbers.** Targets: the mean RMS of `planet` and of `base` within about 3 dB of `calm` (ratio between 0.7 and 1.4) and not above `action`; no peak at or above 0.95 for any mood or stinger; each stinger's peak at most about 4 dB above the `win` jingle's. If a target is missed, change the named constants (levels, peaks) in `music.ts` or `effects.ts`, re-run the affected tests (`npx vitest run tests/music.test.ts tests/stingers.test.ts`), and measure again. Record every number (before and after tuning) in the ledger.
- [ ] **Step 4: Run the whole suite and build**
  Run: `npm test`, `npm run typecheck` and `npm run build`
  Expected: green; build succeeds.
- [ ] **Step 5: Look at the result in the app.** With the dev server, click through STORY (planet, base, a panel, a scene, a mission) and confirm there are no console errors and that the mood changes happen (read `app` state or the console, as audio cannot be heard here); state plainly in the report that the sound itself was not heard.
- [ ] **Step 6: Commit** (only if constants changed in Step 3)
  ```bash
  git add src/audio
  git commit -m "tune: story music and stinger levels from offline measurements"
  ```
