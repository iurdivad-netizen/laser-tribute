# Laser Tribute story mode, project 1: the planet map and strategic spine

## Intent and why

Rui wants an X-COM-like story mode as a third mode beside the Tutorial and the Campaign: between fights the player looks at a planet, chooses where to strike, and builds toward taking it back. The original 2026-10-01 plan listed an "X-COM-style base and research layer" as milestone item 4; it was never designed. The goal is a beautiful, well-built, enjoyable game, and new art is welcome.

**Status 2026-11-23:** project 1 implemented on branch `feature/story-planet` (plan: `docs/superpowers/plans/2026-11-23-story-mode-planet.md`).

Story mode is several projects, built and designed one at a time in this order:

1. **The planet map and strategic spine (this document):** regions, mission choice, time, difficulty presets, save format, screens.
2. **The base:** research (replaces the mission-number unlock ladder), barracks (a roster larger than four), a stockpiled economy.
3. **Story and art:** narrative, dialogue and scenes, planet and base art, portraits, audio.
4. **Balance:** extend the balance bot to the story mode and each difficulty preset.

## Theme (decided by Rui)

A frontier colony world. The squad is four mercenaries hired to take the planet back from a corporation's private army. Existing enemies (riflemen, officers, rushers, flankers, snipers), the five map looks and the ten map types all fit. The enemy capital is a citadel.

## Goals

- A hand-authored planet of 30 regions on the 480x400 canvas, with links between them, drawn as a place the player wants to look at.
- The player holds one start region and attacks regions linked to ground they hold.
- Each enemy-held region is a fixed tactical map (one of the 10 types x 5 variations, so a returning fight is a place the player knows), with a garrison size.
- Not all 30 regions are enemy-held, and not all need to be taken: some are neutral settlements and some are empty wilderness. Winning means taking the enemy capital, which sits behind a front line with more than one route.
- Time passes as the player acts. A difficulty setting decides how hard the planet pushes back.
- The existing tactical game, equipment screen, ranks, permadeath and stash are reused unchanged.

## Non-goals (this project)

Buildings, a research tree, a barracks or roster beyond four, a stockpiled money system, story text, dialogue or cutscenes, final art, defence missions (the enemy attacking you on a tactical map), rival factions, story-mode audio.

## Anti-goals

- Breaking or re-balancing the Tutorial or the Campaign: their saves, the recorded enemy-turn fingerprints and the 64-seed balance study stay valid.
- A planet that reads as a spreadsheet: the map is the main screen, and it has to work by tap on a phone as well as by mouse.
- A mode where the player must clear all 30 regions to win.

## Constraints from the code

- `src/core` is pure: commands in, events out, plain data, seeded randomness. The world rules follow the same pattern and know nothing about the browser.
- `Campaign` (`src/core/campaign.ts`) assumes a straight line: `missionIndex`, `missionsWon === missionIndex`, ten `variations`. `parseSave` (`src/save.ts`) enforces this strictly. The world state is therefore a separate type with its own save, not an extension of `Campaign`.
- `createMission(def, seed, roster, loadout, budget, stash, level)` and `generateMission(type, variation, difficulty)` already build a mission. Enemy roles and weapons come from `level` (roles from level 3 up); the tutorial pins level 1.
- Screens are the `Screen` union in `src/app.ts`; the planet becomes a new screen. The title screen gets a third entry.
- Map text and tile data are never saved; saves hold only state.

## Approaches considered

- **A. A new self-contained world module (chosen).** A pure world module owns regions, holders, garrisons, day count and difficulty. Attacking a region asks it for a mission specification, the tactical game plays it, and the finished state is folded back into the world. Own save slot and screens. Costs more new files and a second save validator, but isolates the working campaign.
- **B. Extend `Campaign` with an optional world.** Fewer files, but it loosens the strict checks that protect saves, ties the new mode to the linear ten-mission shape, and risks the balance study. Rejected.
- **Throwaway spike of the planet map.** Offered, declined by Rui; going straight to the written design.

## Decisions Rui made

Theme: option 2, frontier planet. About 30 regions, not all controlled. Difficulty is a dial with named presets: CALM and PRESSURE as the anchors, more levels welcome. Reading of "not all controlled" confirmed: enemy-held, neutral settlement, empty wilderness.

## Design

### Regions

Static data in one hand-authored file (names, canvas position, links, kind, map type 0-9, variation 0-4, base garrison). Proposed split (builder's call on exact counts and names): about 18 enemy-held including the capital, 6 neutral settlements, 6 wilderness. Garrison and map type rise with distance from the start region; the capital is a type 9 citadel. Each region's theme comes from its map type through `themeOfMap`.

Dynamic state per region (what is saved): holder (`enemy`, `player`, `allied`, `neutral`, `wild`), current garrison, and whether it has been visited.

### Actions

All pure functions on the world state; each returns the new state plus events.

- **attack(region):** allowed when the region is enemy-held and linked to a region the player holds or has allied. Returns a mission specification (map type, variation, enemy count from the garrison, level, seed). The seed is derived from the world seed, region and attempt number, so replays are reproducible.
- **resolve(mission result):** a won mission makes the region the player's, folds kills and deaths into the roster exactly as `recordMission` does, adds loot to the stash, and advances time. A lost mission follows the defeat rule below.
- **visit(region):** for neutral and wild regions, no tactical fight. A neutral settlement becomes allied and pays income; a wilderness region yields one stash item once. Placeholder content, enriched in project 3.
- **advance(days):** applies the difficulty rules.

### Time and difficulty

A mission or visit costs a fixed number of days. Difficulty is one settings block; the presets are only values of it:

| Setting | CALM | STANDARD | PRESSURE |
|---|---|---|---|
| Unfought garrisons grow | never | +1 enemy per region every ~12 days, capped | +1 every ~6 days, higher cap |
| Counterattack on a liberated region | never | never | every ~15 days, on the weakest liberated region touching enemy ground; resolved without a tactical map by comparing strength; a lost region flips back to the enemy |
| Income per held region | generous | normal | tight |

A fourth preset (IRON: PRESSURE plus a tighter budget) can be added by writing one more row. The numbers above are starting values, to be tuned in project 4.

### Budget and gear in this project

The equipment screen is reused. Its budget is computed as today (base + income from held regions + kills by living soldiers), not stockpiled; stockpiling is project 2. The gear and enemy-role level is an interim rule, replaced by research in project 2: player gear level = 1 + regions taken / 3, capped at 10; enemy level comes from the region's garrison tier.

### Win and defeat

Win: take the capital. It stays locked until the player holds a minimum number of regions on the front line (builder to tune, so that two or more routes lead to it).

A lost mission means the squad was wiped: the veterans are gone, a fresh rookie squad takes their place after a time penalty, and the region stays enemy-held. Defeat (game over) happens only when the player holds no region at all, which can only occur under PRESSURE counterattacks. See the open question in the hand-over note.

### Save

A new store key `story` with its own version. It holds only dynamic state keyed by region id, plus the world seed, difficulty, day, roster, fallen, stash and last loadout. A strict validator in the style of `parseSave` rejects anything inconsistent; a planet-definition version number in the save invalidates old saves if the region list is ever changed.

### Screens and flow

`title -> planet -> equipment -> mission -> result -> planet`, with `end` on a win or defeat. The title screen gets a STORY entry next to Tutorial and Campaign (continue works as for the others). The planet screen draws the 30 regions and their links as a map, coloured by holder, with the day, the held count and a detail panel for the selected region (garrison, map look, what an action costs). It must be usable by tap. In this project the drawing is simple code-drawn placeholder art; the finished planet art belongs to project 3.

## Testing and acceptance

- Unit tests for each world function, including every difficulty preset, determinism from the seed, save round trip and rejection of corrupt saves.
- Regression: the full existing test suite, the recorded enemy-turn fingerprints and the campaign balance runner are unchanged.
- A headless smoke run: the existing bot plays the story world on CALM from several seeds with a trivial strategic policy (always attack the nearest legal region) and the world reaches a win or a defined end without errors or stalls.
- Typecheck clean.

## Left to the builder

The exact 30 regions (names, positions, links, kinds, map types, variations); the numeric values in the difficulty table; how garrison size maps to the generator's `difficulty` parameter; the day cost of each action; the screen layout; the capital's unlock threshold.

## My calls (not Rui's decisions, flagged for checking)

Hand-authored planet; one fixed map per region; the 18/6/6 split; STANDARD as a middle preset; days as the unit of time; the interim gear rule; neutral and wilderness visits as placeholder events; the defeat rule above.
