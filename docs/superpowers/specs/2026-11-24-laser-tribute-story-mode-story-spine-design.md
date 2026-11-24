# Story mode, project 3a: the story spine (design)

Part of project 3 (story and art) of the STORY mode. Projects 1 (planet) and 2 (base) are merged. Project 3 is
split into four pieces, designed and built one at a time, in this order:

- **3a. Story spine** (this document): the scenes, how they are triggered, shown, saved and tested.
- 3b. Planet art. 3c. Base art and portraits. 3d. Audio. Each gets its own design later. 3a must leave clean
  places for them (a portrait slot, a scene backdrop slot, a sound cue per scene) and nothing more.

## Intent and why

Rui wants STORY to be "a beautiful, well built and enjoyable game". What a player should remember at the end:
*"I took a planet back with four people I came to care about, and some of them did not make it."* The story must
steer the player a little and never take over: it adds scenes at moments the game already tracks, three of those
scenes carry a real choice, and losses are felt (a memorial when a named mercenary falls).

## Goals

- A scene system: short text-box scenes with a speaker, lines, and optionally a choice, shown between actions.
- 18 scenes written (see the list), voiced by the four named mercenaries.
- Scenes fire from world state, play once, survive save and reload, and can be skipped.
- Three choice scenes whose effects are small and use only things the world already has.
- Fully deterministic and testable; the headless story bot keeps working and can pass through scenes.

## Non-goals

- No art: portraits are a framed placeholder (the speaker's initial) until 3c. No planet or base art (3b, 3c). No
  audio (3d), apart from reusing the existing click sound.
- No branching plot, no dialogue trees, no variables beyond the saved scene record. No voice, no translation.
- No change to Tutorial or Campaign, to mission generation, to enemy AI, or to any balance number except the three
  choice effects, which are flagged for project 4.

## Anti-goals (failure even if it works)

- A scene that blocks play: every scene is skippable in one press, and a lost or won story never waits on a scene.
- A story that makes the bot, the saves or the recorded enemy-turn fingerprints non-deterministic.
- Walls of text. A scene is at most 6 lines of at most 2 text-box rows each; most are 2 to 4 lines.

## Constraints from the code

- Pure `src/core`: scenes live as plain data in `src/core/world/story.ts`; the world stays plain JSON.
- The menu space is 480x400, drawn with `drawFrame/drawButton/drawText`. The font is a 5x7 bitmap, uppercase, with
  a limited character set: every scene string must pass `unsupportedChars`, and wrap inside the box.
- `src/app.ts` owns the flow (`Screen` union). Story actions end in `finishStoryMission`, `actOnRegion` (visit),
  `doPanelAction` (wait/research/hire/train) and `afterTimePassed`; those are the moments scenes can appear.
- The save is `laser-tribute-story` version 2 with a version 1 loader; it must gain a version 3 with a loader for 2.
- `resolve` and `advance` must stay pure and keep their signatures (they are used by the bot and many tests).

## Approaches considered

1. **Scripted beats (chosen by Rui).** A data table of scenes, each with a trigger predicate over world state, lines
   and optional choice. Deterministic, testable, small. Cannot react to anything not listed as a trigger.
2. Branching dialogue engine. Far more machinery than ~22 scenes need; harder to keep saves and the bot deterministic.
3. Text feed only (log lines). Cheap, but cannot deliver the "some did not make it" feeling.

## Design

### The cast and the setting (the writer's frame)

- **Meridian Holdings**, a corporation, took the colony by force with a private army and runs it from the
  **Meridian Citadel**. The colony's people are scattered: neutral settlements (Tinker's Rest, Greenwater,
  Marrow Springs, Harbor of Ash, Last Light, Pilgrim's Rest) can be won over, the wilds are empty.
- The four mercenaries, hired by the settlers, each with one clear voice:
  - **Alvarez**: the leader. Steady, dry, speaks last, never raises their voice.
  - **Brandt**: blunt, a tactician. Says what the others avoid.
  - **Chen**: the medic and tinkerer. Wry humour, owns the lab and the hospital scenes.
  - **Dubois**: the youngest. Hopeful, asks the questions the player is asking.
- Tone: grounded and a little grim, with dry humour, never parody. Their lines are the thing players remember.

### Scene data (`src/core/world/story.ts`)

```ts
export interface SceneLine { by: string[]; text: string }   // by = speakers in order of preference
export interface SceneChoice { label: string; effect: ChoiceEffect; reply: SceneLine[] }
export interface Scene {
  id: string;
  when: (w: World) => boolean;     // pure, reads world state only
  lines: SceneLine[];
  choice?: [SceneChoice, SceneChoice];
}
export type ChoiceEffect = { credits?: number; days?: number; stash?: StashKey };
```

- `World` gains `seen: string[]` (ids of scenes already shown) and `chosen: Record<string, number>` (the option
  taken per choice scene). Both start empty.
- `nextScene(w): Scene | null` returns the first scene in table order that is unseen and whose `when(w)` holds.
- `see(w, id): World` marks a scene seen (pure, returns a new world).
- `choose(w, id, option): World` marks it seen, records the option, and applies the effect with the existing
  primitives (credits floored at 0, `advance` for days, stash capped as elsewhere). It is the only way a scene changes
  the world, and a scene without a choice never changes anything but `seen`.
- `speakersFor(w)`: a line's speaker is the first name in `by` that is in the barracks as a ready, wounded or
  training soldier of the original four, otherwise the generic `RECRUIT`. A scene is therefore never silent just
  because someone fell. The text of a line may differ per speaker only by writing separate alternatives, so scenes
  are written so that any of their `by` speakers can say the line.

### Triggers (all pure predicates on `World`)

| Scene | When | Voices / gist |
|---|---|---|
| landing | always (day 1, first screen) | Alvarez briefs: Meridian took the colony; four against an army; start at Ashfall |
| first-blood | held regions >= 2 | Brandt: one down, 16 to go; Dubois asks if it will be like this every time |
| friends | any allied region | Dubois and a settler, first people to say thank you; Alvarez warns not to get used to it |
| first-lab | research done >= 1 | Chen on what the lab found, and what it costs |
| wounded | any soldier wounded | Chen: the field hospital earned its beds |
| recruits | barracks holds more than the four originals | Dubois welcomes a new face; Brandt tests them |
| offer (CHOICE) | held >= 6 and day >= 20 | Meridian sends a ceasefire envelope: take it (+60 credits, 3 days pass, garrisons grow) or burn it (nothing, but Brandt approves) |
| halfway | held >= 10 | Alvarez counts what was lost on the way; Chen jokes badly |
| refugees (CHOICE) | held >= 12 and any allied region | people at the gate: shelter them (-30 credits, +1 medkit-class stash item) or move on (nothing; Dubois is quiet) |
| one-left | exactly 1 region held and day >= 10 | everyone: this is the thin line; Alvarez: we do not retreat from here |
| citadel-open | capital attackable (`capitalOpen`) | Brandt lays out the Citadel; Alvarez asks if anyone wants to stay behind |
| deserter (CHOICE) | capital attackable (`capitalOpen`) | a Meridian officer offers the gate codes: trust them (+1 stash item, 2 days pass) or do not (nothing; Chen notes the trap that was not) |
| memorial-X (x4) | name X is in `fallen` | the remaining three; short, specific, different per person |
| victory | status `won` | the four (or whoever is left) on the Citadel roof; fixed epilogue (static text; the end screen that follows lists who made it) |
| defeat | status `lost` | the last light going out; plain, short |

That is 14 scenes plus 4 memorials = 18. All line text is drafted in the implementation plan and
**reviewed by Rui before it is built into tests**; this document fixes triggers, voices and effects, not prose.

### Showing scenes (`src/screens/scene.ts`, `src/app.ts`)

- New `Screen` value `scene`. The app holds a short `sceneQueue` of scene ids and a `sceneThen` target screen.
- `app.showScenes(then)`: ask `nextScene` repeatedly (a scene seen is removed from consideration, so a state that
  satisfies several scenes plays them in table order, one after another, at most 3 per stop; the rest wait for the
  next stop). If none, go straight to `then`. Called at: the end of `continueFromResult` (before the planet or end
  screen), after a visit, and after any panel action or wait (before returning to the base or planet).
- The screen: the existing frame, a placeholder portrait block (framed square with the speaker's initial), the
  speaker name, the line text wrapped in a text box, and a prompt: `CLICK OR SPACE`. A click, Space or Enter shows the
  next line. A SKIP button (and Escape) marks a scene without a choice seen and goes on; on a scene with a choice it
  jumps to the two choice buttons (skipping never makes a choice for the player; only the bot takes option 0). Choice scenes show two buttons after the last line; a choice shows its reply lines, then continues.
- Saved after each scene is seen or chosen (`saveStory`), so closing mid-scene never replays a finished scene and
  never loses a choice.
- When the story is over (`won` / `lost`) the victory or defeat scene plays first, then the end screen, which is
  unchanged.

### Save

- Story save version 3: world gains `seen` and `chosen`. The loader for version 2 migrates by marking as seen every
  scene whose trigger already holds at load time (so an existing story does not replay its past), and sets
  `chosen` empty. Strict validation: `seen` ids must exist in the table, `chosen` keys must be choice scenes,
  values 0 or 1.

### The bot and the tests

- `sim/story.ts` plays scenes by always taking the default option (0), via `choose`. Without choices the bot run is
  byte-identical except for the three choice effects.
- Tests (all pure, no canvas): every scene has a unique id; every string passes `unsupportedChars` and wraps within
  the box (width and at most 6 lines x 2 rows); `nextScene` plays each scene exactly once; `choose` applies each effect
  and clamps; a fallen speaker is replaced by the next in `by`, else `RECRUIT`; the version 2 to 3 migration; drawing
  the scene screen stays inside 480x400; across 3 bot seeds every non-memorial scene except `defeat` is reachable.
- The recorded enemy-turn fingerprints, the campaign saves and the full existing suite stay green.

## What is left to the builder

- The prose of every line (within the voices and triggers above), flagged for Rui to review as one block.
- Exact layout of the scene screen inside the existing frame; the wrapping helper (reuse the existing text wrapper
  if there is one).
- Which stash item each choice grants, within the existing stash keys.
- Whether the queue lives on `App` or in a small `scenes.ts` module.

## Calls I made (for Rui to check)

- Scenes read world state only, never "what just happened", so the bot and the save stay simple.
- The three choices use only credits, days and one stash item, to avoid touching balance; project 4 owns the numbers.
- A cap of 3 scenes per stop so a player is never buried after a long wait.
- Fallen speakers fall back to the next voice, then to RECRUIT, so scenes never go silent.
- The version 2 migration marks already-true scenes as seen, so existing stories do not replay their past.
