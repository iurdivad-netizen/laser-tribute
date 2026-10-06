# Laser Tribute Milestone 13: Generated Campaign Maps

Date: 2026-10-06. Status: design approved in chat by Rui (sections 1 to 3), spec awaiting review.

## Goal

Add a **campaign of ten generated missions** (ten map types, five variations each) and keep today's three hand-drawn missions as a **Tutorial** mode. Missions get bigger and harder along the campaign. The map generator takes `(type, variation, difficulty)` and knows nothing about campaign order, so a later X-COM-style mission picker can call it directly.

## Decisions (Rui, 2026-10-06)

- Tutorial = the existing three hand-drawn missions, played exactly as today.
- Campaign = ten map types x five variations. Variations are produced by fixed seeds, not drawn by hand and not re-rolled each play (option A).
- Structure: ten missions, one per type, in a fixed order of rising difficulty; each new campaign draws one variation (0 to 4) per type. Winning mission 10 wins the campaign.
- Two save slots, one per mode; existing saves load as Tutorial progress.
- Difficulty = enemy count and layout only (no new enemy types or gear). Enemy stats unchanged.
- Map size grows from 30x20 to 48x32.
- Approach: one shared builder and ten recipes (not ten separate generators).

## Non-goals

New enemy types or enemy gear, persistent wounds, research or base layer, a fresh random seed per play, a minimap, touch-friendly menus. Listed as open items.

## The ten types

| # | Name | Size | Enemies | Style |
|---|------|------|---------|-------|
| 1 | Outpost | 30x20 | 4 | rooms around a yard |
| 2 | Warehouse | 30x20 | 5 | long aisles, crates |
| 3 | Compound | 30x20 | 6 | walled courtyard, buildings |
| 4 | Bunker | 32x22 | 6 | narrow corridors, many doors |
| 5 | Village | 36x24 | 7 | small houses, open streets |
| 6 | Factory | 38x26 | 8 | halls, machinery blocks |
| 7 | Station | 40x26 | 9 | ring corridor, central hub |
| 8 | Mine | 42x28 | 10 | winding tunnels, dead ends |
| 9 | Fortress | 46x30 | 11 | outer wall, inner keep |
| 10 | Citadel | 48x32 | 12 | large mixed complex |

The hand-drawn missions keep their own names (Outpost, Warehouse, Compound) in Tutorial. The generated campaign types reuse the names; the screen shows "Mission n of 10" and the mode, so there is no ambiguity.

## Architecture

New folder `src/core/gen/` (pure, seeded by the existing RNG; no DOM):

- `recipes.ts`: `RECIPES: Recipe[]` (ten entries): id, name, width, height, enemies, items (counts of rifle/pistol/grenade pickups), style function.
- `build.ts`: shared toolkit on a mutable grid of chars: carve room, corridor, yard, cover block, pillars, door placement; squad placement (four `P` tiles in one corner area); enemy placement (`E`, ids follow reading order, so `e1..eN` match patrol keys); item placement (`r`, `p`, `g`); patrol creation (two-point routes, walkable).
- `check.ts`: `checkMission(def): string[]` returns the list of broken rules (empty means playable). Used by the generator and by tests.
- `index.ts`: `generateMission(type: number, variation: number, difficulty?: number): MissionDef`. The internal seed is a pure function of `(type, variation)`. If `checkMission` finds a broken rule the generator retries with the next internal attempt number (bounded, throws after 50 attempts, which tests treat as a failure). The result is deterministic for a given `(type, variation)`.

Output is the existing `MissionDef` (`id`, `name`, `rows`, `patrols`). Legend unchanged: `#` wall, `.` floor, `+` door, `P` squad, `E` enemy, `r` rifle, `p` pistol, `g` grenade. `createMission` and `parseMap` are unchanged.

`difficulty` (1 to 10, default = type number + 1) currently only sets enemy and item counts when the caller overrides it; it exists as the hook for later gear or enemy types.

### Playability rules (`checkMission`)

1. All rows are the same width, and the size equals the recipe size.
2. Exactly four `P`; enemy count and item counts equal the recipe.
3. Every non-wall tile is reachable from the first `P` (doors count as passable).
4. Every `+` has wall on two opposite sides and floor on the other two.
5. No `E` is within 8 tiles of any `P`, and none has line of sight to any `P` at start (using the game's own line-of-sight function).
6. Every patrol has at least two points, all on non-wall tiles, and consecutive points are connected by a walkable path.
7. The outer border is wall.
8. The squad's start area has at least four free tiles and is not inside a closed room with no door.

## Campaign, saves and title screen

- `Campaign` gains `mode: 'tutorial' | 'campaign'` and `variations: number[]` (campaign only; ten integers 0 to 4, drawn once at campaign start from a seeded draw and saved).
- Mission list: tutorial uses `MISSIONS` (3); campaign uses `generateMission(i, variations[i])` for `i` 0..9. The campaign passes `missionCount` 10 to `recordMission` (tutorial 3). Budget curve unchanged (base 120, +20 per win, +5 per kill).
- Result and end screens show "Mission n of N" and the map name from the def.
- Saves: tutorial slot keeps the key `laser-tribute-save` (existing saves load as tutorial progress, no migration; a missing `mode` means tutorial). Campaign slot: `laser-tribute-campaign`, with a `version` number. A small `laser-tribute-last` key records the last mode played for CONTINUE.
- Strict validation as in milestone 9: wrong `variations` length or values, unknown mode or a corrupt campaign slot is ignored without touching the tutorial slot.
- Title screen: CONTINUE (when a save exists; shows mode and mission), NEW CAMPAIGN, TUTORIAL. NEW CAMPAIGN and TUTORIAL each need two presses if the matching slot already has a save (as NEW CAMPAIGN does today).

## Engine and UI impact

- Core (vision, path, AI, combat, loot) already reads size from the state. `src/app.ts:106` creates the camera with a hard-coded 30x20 and must use the mission's size.
- Desktop and mobile both use the milestone 14 camera for big maps (close zoom follows the soldier; ZOOM shows the whole map). Whole-map tiles on a 48x32 map on a small phone are tiny; accepted as an overview.
- Performance: pathfinding, fog and a 12-enemy turn on 48x32 must run in a reasonable time; tests measure and fail on an obvious blow-up.

## Testing

- All 50 maps (5 variations x 10 types): `checkMission` returns nothing; identical output on a second call; the five variations of a type are all different; counts and sizes match the recipe.
- Mutation checks: break each playability rule in a generator or a copied map and confirm `checkMission` reports it (a test per rule).
- Campaign: mode and variations are set; ten missions; a win on mission 10 ends the campaign as won; a loss ends it as lost; variations saved and loaded; invalid campaign slot ignored while the tutorial slot survives; an old save loads as tutorial; CONTINUE picks the last mode.
- Title screen: buttons, two-press rule per slot.
- Large-map tests at 48x32: fog update, pathfinding across the map, one enemy turn with 12 enemies, camera creation from the real size, the whole-map zoom choice.
- Game test: start each type's variation 0 through `createMission`, run an enemy turn, and check the state is valid.

## Review focus (for the plan and final review)

1. A map where the squad can be cut off by a door that enemies never open (enemies open doors only when hunting): check that rule 3 holds with all doors counted passable, and that nothing important is only reachable through a long door chain.
2. Variation count of five with fixed seeds: if the retry loop changes the attempt number, make sure "same (type, variation) gives the same map" survives across code changes (a stored fingerprint test would pin it).
3. An old save with a `missionIndex` that is valid for the tutorial only.
4. Squad start near the map edge with the camera clamped (large map, close zoom).
5. A mission with 12 enemies: enemy turn length and the camera follow (`trackCamera`) on a big map.

## Open items after this milestone

Touch-friendly menus; enemy gear or new enemy types scaling with difficulty; persistent wounds; research and base layer; a "random seed per play" option; a minimap; real-phone check of mobile play.
