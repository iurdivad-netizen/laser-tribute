# Story mode, project 3d: the story's music and stingers (design)

Last piece of project 3 (story and art). 3a (story spine), 3b (planet map art) and 3c (camp and portraits) are merged.
3d gives the story mode its own music and two endings.

## Intent and why

Rui wants STORY to be "a beautiful, well built and enjoyable game". Today every story screen plays the same calm mood
as a mission, and the end of the story is silent apart from the plain click. Rui asked for: **a calm planet theme, a
dark base, and stingers for victory and defeat**, built as **new moods in the existing soundtrack engine** (all sound in
the game is synthesised in code; no recorded audio, no credits).

## Goals

- Two new music moods, `planet` and `base`, in the existing `Music` engine, with the engine's crossfades, volume and mute.
- The app picks the mood from the screen: the planet map (and the difficulty screen) get the planet theme; the base,
  its panels, the squad step and the story equipment screen get the base theme.
- Two stingers, `victory` and `defeat`, about 3 to 4 seconds each, played when the victory or defeat scene starts, with the
  music dipping under them.
- Everything obeys mute and the volume keys, and does not change how Tutorial, Campaign or missions sound.

## Non-goals

- No change to the mission music (calm and action) or its mood tracker rules; no change to any existing effect.
- No new sound effects for gameplay events (a conquest, a mercenary falling, the citadel opening), no scene blips or voices,
  no music for the Tutorial or Campaign screens.
- No recorded or generated audio files.

## Anti-goals

- A new mood louder or quieter than the existing ones, or one that clips: they must sit at the same average level.
- A mood that leaks into another at startup (see the learning on silent layers) or plays when muted.
- Stingers that cut off the music abruptly or that pile up on top of each other.
- New audio nodes appearing in tests that have no timer (the existing audio-mix tests count nodes).

## Constraints from the code

- `src/audio/music.ts`: `type Mood = 'calm' | 'action'`; `Music` holds one `Layer` per mood (a gain with fade bookkeeping),
  `setMood` fades layers (action fades in over 1 s, calm over 2.5 s), and `tick` (every 120 ms, 0.6 s look-ahead) schedules
  notes for each audible layer, hard-wired as `m === 'calm' ? calmBar : actionStep`. Primitives available are oscillators
  (sine, triangle, square, sawtooth), gains and a noise buffer; there are no filters.
- `MoodTracker` (calm or action from enemy visibility) is typed as `Mood`; `Sound.setMood` and the optional
  `SoundPlayer.setMood?` carry it.
- `src/app.ts` `updateMusic`: the title plays `action`; every other screen uses the tracker (so, calm).
- `src/audio/effects.ts`: `EFFECTS` is a table of synth segments per `SoundName`, on the `sfx` or `ui` bus;
  `tests/soundeffects.test.ts` requires the table to match its design list and **every effect to last at most 1.5 s**.
  `win` and `lose` (about 0.6 and 0.8 s) already exist for mission results.
- Learning (Nov 3): music starts lazily on the first gesture and only when a real timer exists, so audio tests see no
  extra nodes; a silent layer must start with fade times at `-Infinity`; new members of `Sound` go after the interface.
- Nobody working on this can hear it. Tuning is by constants in one place, by measurement (level) and by Rui's ear.

## Approaches considered

1. **New moods in the existing engine (chosen by Rui).** Reuses the layers, crossfades, volume and mute. The engine file grows.
2. A separate story-music class. Isolated, but duplicates timers and mixing and can fight over volume and mute.
3. Generated or recorded audio. More realistic, but needs credits, adds download size, and does not match the synthesised game.

## Design

### Moods and where they play

`export type Mood = 'calm' | 'action' | 'planet' | 'base'`; the tracker returns the subset `'calm' | 'action'`
(`FightMood`). The app maps screens to moods in one pure function `moodFor(screen, inStory, tracked)`:

| Screen | Mood |
|---|---|
| title | `action` (as today) |
| `difficulty`, `planet` | `planet` |
| `base`, `panel`, `squad`, and `equipment` while a story fight is being prepared | `base` |
| `scene` | the mood already playing (a scene never changes the music) |
| `mission`, `result` | the tracker (`calm` / `action`), as today |
| `end` of a story | `planet` |
| any other screen (Tutorial, Campaign) | the tracker, as today |

Layers fade over 2.5 s into `planet` or `base` (and 2.5 s out of them); entering `action` still takes 1 s.

### The planet theme (calm)

Slow and open, the opposite of the mission calm's unease: about 60 to 66 bpm, D dorian (or the pentatonic D E F# A B),
a soft pad of open fifths (D and A) that swells in and out over about 10 s bars, a few plucked bell-like notes from the
scale with long decaying echoes (reusing `ping`), and a faint breath of noise swelling under the pad like wind. No drums.

### The base theme (dark)

Low, close and slightly menacing: a low sine drone on D (about 37 and 73 Hz) with a slightly detuned triangle for slow
beating, a dissonant minor-second swell (D and E-flat) now and then, a slow pulse like a generator or heartbeat every
1.6 to 2 s (a short sine blip gliding down from about 60 to 38 Hz), and a distant metallic ping every few seconds built from
inharmonic partials (ratios about 1, 2.76, 5.4) with a long decay. No melody.

### Stingers

A separate table `STINGERS` in `src/audio/effects.ts` (the 1.5 s limit of `EFFECTS` stays), names `'victory' | 'defeat'`,
on the `ui` bus, each a list of the same `Segment`s:
- **victory** (about 3.2 s): four rising notes (D4, A4, D5, F#5) in a short fanfare that lands on a held D major chord
  that swells and fades, with a low drum-like blip under the first note.
- **defeat** (about 3.6 s): a descending D minor line (A4, F4, D4, A3) into a low D2 sine that fades away, with a muted
  noise sweep under the last note.

`Sound.stinger(name)` plays one (obeying mute and volume, never more than one at a time: a second call while one plays is
ignored) and tells the music to **duck**: `Music.duck(seconds)` ramps the music output down to about 30 % for the stinger's
length and back up over about a second. `SoundPlayer` gains an optional `stinger?(name)` so test fakes keep compiling.

The app plays `stinger('victory')` or `stinger('defeat')` when the scene with that id starts (3a's `victory` and `defeat`
scenes, which play before the end screen), once.

### Structure of the engine change

- `Music` layers become a record over all four moods; `tick` schedules each audible layer through a table of generators
  (`calm: calmBar`, `action: actionStep`, `planet: planetBar`, `base: baseBar`) instead of the two-way conditional.
- All sound constants for the new moods (scale, tempo, note levels, fade times, duck depth) are named constants at the top of
  `music.ts` / `effects.ts` so Rui can tune by ear in one place.
- New layers start silent with fade times at `-Infinity` (per the learning); everything stays behind the existing lazy
  start, so no new nodes appear without a timer.

### Acceptance

- Tests (pure and with fake contexts, as the existing music tests): the screen-to-mood table for every screen (and
  Tutorial/Campaign unchanged); layers for four moods, only the current one audible after a settle, no leak at startup;
  mute and zero volume schedule nothing; a scene never changes the mood; stingers exist with durations in range, play once
  and are ignored while one plays, are silent when muted, and duck then restore the music level; `STINGERS` is on the `ui`
  bus; the existing effect and audio-mix tests are unchanged and green.
- Level: each new mood and each stinger is rendered offline in the browser pane (as the earlier soundtrack work did) and
  its average and peak level compared with calm and action: the new moods within about 3 dB of calm, no clipping, stingers
  not louder than the mission `win` jingle by more than a few dB. The numbers go in the PR.
- Rui listens and tunes (the constants above); the builder reports what the measurements say, not that it sounds good.

## What is left to the builder

- The exact notes, levels and timings within the descriptions above; how to render offline in the browser pane and read the
  levels; the shape of `moodFor`; whether `duck` uses the existing `out` gain (it should).

## Calls I made (for Rui to check)

- The squad step and the story equipment screen use the base theme (preparing a fight is the barracks), and the end screen
  uses the planet theme after the stinger.
- A scene never changes the music, so a scene opened from the base keeps the base theme.
- Stingers live in their own table because `EFFECTS` is limited to 1.5 s by an existing test.
- Stingers sit on the `ui` bus (gain 0.8, like `win` and `lose`) and duck the music rather than stopping it.
