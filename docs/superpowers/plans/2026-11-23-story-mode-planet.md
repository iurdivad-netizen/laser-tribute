# Story Mode, Project 1: Planet Map and Strategic Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third game mode, STORY: a 30-region frontier planet the player takes back region by region, with difficulty presets, its own save and screens, reusing the existing tactical game unchanged.

**Architecture:** A new pure module `src/core/world/` (planet data, difficulty presets, world state and actions) hands out mission specifications; the existing `generateMission` + `createMission` play them; the finished state is folded back into the world (reusing `recordMission` for roster and stash). New save slot `story`, new screens `planet` and `difficulty`, a STORY button on the title. The Campaign and Tutorial code paths are not changed.

**Tech Stack:** TypeScript (strict), Canvas 2D, Vite, Vitest. Run tests with `npm test`, types with `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-11-23-laser-tribute-story-mode-planet-design.md`

Work on a branch `feature/story-planet` cut from master (`03dbf2c`). The repo ships through PRs.

## Global Constraints

- `src/core/**` is pure: no DOM, no `Math.random`, plain data in and out, seeded randomness via `seededRandom` from `src/core/rng.ts`.
- Do not change the behaviour of the Tutorial or Campaign: `tests/aigolden.test.ts` fingerprints, `tests/campaign*.test.ts`, `tests/save*.test.ts` and the balance runner must pass untouched.
- Map text and tile data are never saved; saves hold only state. Story save is strict: any inconsistency parses to `null`.
- Planet: exactly 30 regions on the 480x400 canvas; links symmetric; the graph connected.
- Difficulty is one settings block; presets CALM, STANDARD, PRESSURE are only rows of values (IRON is a future row, not built).
- Budget is computed, not stockpiled: `120 + income x regions held + 5 x kills by living soldiers`. Gear level = `min(10, 1 + floor(regionsTaken / 3))`. Enemy level = the region's map type + 1.
- Lost mission = the squad is wiped: veterans to `fallen`, four fresh rookies, a time penalty, the region stays enemy-held. Defeat only when the player holds no region (holder `player`).
- Win = take the capital (a type 9 citadel), locked until the player holds at least 2 of the regions linked to it.
- Menus are drawn in the 480x400 menu space and must work by tap (touch slop as the other screens do it).
- Out of scope: buildings, research, barracks over four, stockpiled money, story text, final art, defence missions, rivals, story audio.

## Review Focus

Failure modes the spec implies that no feature task would otherwise test; each is pinned by a test in the task named.

1. A corrupt, wrong-version or old-planet story save must not crash the title or offer CONTINUE; it parses to `null` (Task 7, Task 9).
2. Attacking or visiting an illegal region (not linked to held ground, already held, the locked capital, a wrong kind) is rejected with no state change (Task 4, Task 5).
3. A lost mission on the very last held region under PRESSURE ends the game as defeat, and a lost mission elsewhere never ends it (Task 5, Task 6).
4. `advance(0)`, a very large `advance`, and repeated growth must terminate and respect caps (Task 6).
5. On touch, tapping near one region must not select its neighbour (Task 2 pins minimum spacing, Task 8 pins the hit test).

---

### Task 1: `createMission` takes a separate enemy level

The one `level` argument currently drives both the player's unlocks and the enemies' arms and roles. Story needs them apart.

**Files:**
- Modify: `src/core/missions.ts:135-167` (`createMission`)
- Modify: `src/app.ts:62-64` (`AppOptions.createMission` type) and its default wrapper at `src/app.ts:131-134`
- Test: `tests/storylevel.test.ts`

**Interfaces:**
- Produces: `createMission(def, seed?, roster?, loadout?, budget?, stash?, level?, enemyLevel?: number)` where `enemyLevel` defaults to `level`. `AppOptions.createMission` gets the same optional 8th parameter.

- [ ] **Step 1: Write the failing test** in `tests/storylevel.test.ts`: using `generateMission(9, 0)` (a citadel), build `createMission(def, 7, undefined, undefined, 500, undefined, 1, 10)` and `createMission(def, 7, undefined, undefined, 500, undefined, 1)`. Assert the first state has at least one enemy with a role or a weapon other than the level-1 enemies' (compare `s.units.filter(u => u.side==='enemy')` weapons/roles sets: `not.toEqual` the second), and that `createMission(def, 7, ..., 5, 5)` deep-equals `createMission(def, 7, ..., 5)` (default keeps today's behaviour).
- [ ] **Step 2: Run** `npx vitest run tests/storylevel.test.ts` → FAIL (extra argument ignored, states equal).
- [ ] **Step 3: Implement** the optional parameter: the `level > TUTORIAL_LEVEL` guard and `assignEnemyWeapons` / `assignEnemyRoles` use `enemyLevel`; `applyLoadout` keeps `level`. Update the App option type and default wrapper to pass it through.
- [ ] **Step 4: Run** `npm test` → all green (the golden fingerprints use level 1 and must be unchanged).
- [ ] **Step 5: Commit** `feat: createMission accepts a separate enemy level`.

---

### Task 2: The planet data

**Files:**
- Create: `src/core/world/planet.ts`
- Test: `tests/planet.test.ts`

**Interfaces:**
- Produces:
  - `type RegionKind = 'start' | 'enemy' | 'neutral' | 'wild'`
  - `interface Region { id: number; name: string; x: number; y: number; links: number[]; kind: RegionKind; type: number; variation: number; garrison: number; maxGarrison: number }` (`x`,`y` are map-local, see Task 8's `PLANET.map`; neutral and wild regions carry `type 0, variation 0, garrison 0, maxGarrison 0`)
  - `const PLANET_VERSION = 1`, `const REGIONS: readonly Region[]` (index equals `id`), `const START_REGION: number`, `const CAPITAL_REGION: number`, `const CAPITAL_GATES: readonly number[]` (the capital's links), `const CAPITAL_UNLOCK = 2`
  - `missionDifficulty(r: Region, garrison: number): number` returns `r.type + 1 + (garrison - RECIPES[r.type].enemies)`, the `difficulty` argument for `generateMission`.

Hand-authored data (names, positions, links, types, variations are the builder's call) must satisfy these tests. My call in the plan: 1 start + 17 enemy-held (including the capital) + 6 neutral + 6 wild = 30. Base `garrison` equals `RECIPES[type].enemies`; `maxGarrison` is base + 5. Map types rise with distance from the start; the start region is a type 0 map so it can be retaken after a counterattack.

- [ ] **Step 1: Write the failing tests** in `tests/planet.test.ts`:
  - `REGIONS.length === 30`; `REGIONS.every((r, i) => r.id === i)`.
  - kind counts: 1 `start`, 17 `enemy`, 6 `neutral`, 6 `wild`.
  - links are symmetric and in range, no self-links; a breadth-first search from `START_REGION` reaches all 30.
  - `REGIONS[CAPITAL_REGION]` is `enemy`, `type === 9`; `CAPITAL_GATES.length >= 3`; every gate is not the start region; `CAPITAL_UNLOCK === 2`.
  - Every region: `x` in `[12, 318]`, `y` in `[12, 360]`; every pair of regions at least 26 px apart (a finger cannot hit two); names unique and non-empty.
  - Every enemy-held and start region: `garrison === RECIPES[type].enemies`, `maxGarrison === garrison + 5`, `variation` in `[0, 4]`.
  - For every enemy-held and start region, `generateMission(r.type, r.variation, missionDifficulty(r, r.maxGarrison))` does not throw and has at least `r.maxGarrison` enemy spawns (count `E` glyphs or use `createMission` and count `units` with `side === 'enemy'`).
  - Regions linked to `START_REGION` are all type 0..2 (the opening is easy).
- [ ] **Step 2: Run** `npx vitest run tests/planet.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/core/world/planet.ts` with the 30 authored regions and `missionDifficulty`; derive `CAPITAL_GATES` from `REGIONS[CAPITAL_REGION].links`. Lay the map out as a recognisable continent: start in one corner region, the capital deep on the far side behind at least three gate regions, neutrals and wilds scattered off the main routes so some routes are optional.
- [ ] **Step 4: Run** the test file → PASS. If a high-garrison map fails to generate, lower that region's `maxGarrison` cap and keep the `+5` rule in the test replaced by `maxGarrison >= garrison + 2` for that region only (note it in a comment).
- [ ] **Step 5: Commit** `feat: story planet data (30 regions)`.

---

### Task 3: Difficulty presets

**Files:**
- Create: `src/core/world/difficulty.ts`
- Test: `tests/difficulty.test.ts`

**Interfaces:**
- Produces:
  - `type DifficultyId = 'calm' | 'standard' | 'pressure'`; `const DIFFICULTY_IDS: readonly DifficultyId[]`
  - `interface Difficulty { name: string; blurb: string; growthEvery: number | null; growthCap: number; counterEvery: number | null; income: number }`
  - `const DIFFICULTIES: Record<DifficultyId, Difficulty>`
  - `const DAYS = { attack: 3, visit: 2, lossPenalty: 6 } as const`

Values (starting values, tuned in project 4): CALM `{ growthEvery: null, growthCap: 0, counterEvery: null, income: 8 }`; STANDARD `{ 12, 3, null, 6 }`; PRESSURE `{ 6, 5, 15, 4 }`. Names are `CALM`, `STANDARD`, `PRESSURE`; `blurb` is one short line shown on the difficulty screen (at most 34 characters).

- [ ] **Step 1: Write the failing test**: the three ids exist; the exact values above; `DAYS` equals `{ attack: 3, visit: 2, lossPenalty: 6 }`; only PRESSURE has a non-null `counterEvery`; income strictly decreases calm > standard > pressure; every `blurb.length <= 34`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: story difficulty presets`.

---

### Task 4: World state, queries, mission specification

**Files:**
- Create: `src/core/world/world.ts`
- Test: `tests/world.test.ts`

**Interfaces:**
- Consumes: `REGIONS`, `START_REGION`, `CAPITAL_REGION`, `CAPITAL_GATES`, `CAPITAL_UNLOCK`, `missionDifficulty` (Task 2); `DIFFICULTIES`, `DifficultyId` (Task 3); `CAMPAIGN`, `soldierName`, `totalKills`, `RosterSoldier` from `src/core/campaign.ts`; `emptyStash`, `Stash` from `src/core/stash.ts`.
- Produces:
  - `type Holder = 'enemy' | 'player' | 'allied' | 'neutral' | 'wild'`
  - `interface RegionState { holder: Holder; garrison: number; visited: boolean; attempts: number }`
  - `type WorldStatus = 'active' | 'won' | 'lost'`
  - `interface World { planetVersion: number; seed: number; difficulty: DifficultyId; day: number; status: WorldStatus; regions: RegionState[]; roster: RosterSoldier[]; fallen: RosterSoldier[]; namesUsed: number; stash: Stash }`
  - `interface MissionSpec { region: number; type: number; variation: number; difficulty: number; enemyLevel: number; seed: number }`
  - `newWorld(seed: number, difficulty: DifficultyId): World` (day 0; start region `player`; enemy regions `enemy` with their base garrison; neutral regions `neutral`; wild regions `wild`; four rookies named `soldierName(0..3)`; `namesUsed` 4; empty stash)
  - `regionsHeld(w: World): number` (count of holder `player`)
  - `incomeRegions(w: World): number` (count of holder `player` or `allied`)
  - `storyBudget(w: World): number` = `CAMPAIGN.baseBudget + DIFFICULTIES[w.difficulty].income * incomeRegions(w) + CAMPAIGN.killBonus * totalKills(roster)` (use a small adapter, `totalKills` takes a `Campaign`; sum `roster` kills directly instead)
  - `gearLevel(w: World): number` = `min(10, 1 + floor(takenCount / 3))` where `takenCount` is the number of regions the player has taken from the enemy (holder `player`, excluding `START_REGION`'s initial hold: count `player` holders whose region kind is `enemy`)
  - `capitalOpen(w: World): boolean` (at least `CAPITAL_UNLOCK` of `CAPITAL_GATES` have holder `player`)
  - `canAttack(w: World, id: number): boolean`: `status === 'active'`, region holder `enemy`, linked to a region with holder `player` or `allied`, and if `id === CAPITAL_REGION` then `capitalOpen(w)`
  - `canVisit(w: World, id: number): boolean`: `status === 'active'`, holder `neutral` or `wild` (and not `visited`), linked to a `player` or `allied` region
  - `attackable(w: World): number[]` (ids ascending where `canAttack`)
  - `missionFor(w: World, id: number): MissionSpec`: throws `Error('cannot attack region <id>')` unless `canAttack`. `type`/`variation` from the region; `difficulty = missionDifficulty(region, garrison)`; `enemyLevel = region.type + 1`; `seed = missionSeed(w.seed, id, attempts)` (exported, a deterministic 31-bit mix, never 0).

- [ ] **Step 1: Write the failing tests** in `tests/world.test.ts`:
  - `newWorld(1,'calm')`: 4 soldiers, `day === 0`, `status === 'active'`, start region holder `player`, `regionsHeld === 1`, `storyBudget === 128` (120 + 8 x 1), `gearLevel === 1`, `attackable` equals the enemy regions linked to the start (sorted), `capitalOpen === false`.
  - `storyBudget(newWorld(1,'pressure')) === 124`; with a roster soldier holding 3 kills on calm: `128 + 15`.
  - `missionFor(w, id)` for an attackable id: `type/variation` match the region, `enemyLevel === type + 1`, `seed` is the same on two calls, differs after `attempts` is bumped, and `generateMission(spec.type, spec.variation, spec.difficulty)` succeeds.
  - Rejections, each with `expect(() => missionFor(...)).toThrow()` and `canAttack === false` and the world object unchanged (`toEqual` a deep copy taken before): the capital while locked, an enemy region not linked to held ground, the start region (held), a neutral region, an invalid id (`-1`, `30`, `1.5`).
  - `canVisit`: true for a neutral or wild region linked to the start (pick from data), false for an enemy region, false for an unlinked neutral.
  - `gearLevel`: set 3 enemy regions to `player` → 2; set 27 → capped at 10 (clone the world and edit `regions` directly).
  - `capitalOpen`: false with 1 gate `player`, true with 2.
- [ ] **Step 2: Run** `npx vitest run tests/world.test.ts` → FAIL. **Step 3: Implement** the module. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: story world state and mission specs`.

---

### Task 5: Visit and resolve (win, loss, defeat)

**Files:**
- Modify: `src/core/world/world.ts`
- Test: `tests/worldresolve.test.ts`

**Interfaces:**
- Consumes: Task 4's exports; `recordMission`, `Campaign` from `src/core/campaign.ts`; `DAYS` (Task 3); `addStash`, `capStash`, `emptyStash` (`src/core/loot.ts`, `src/core/stash.ts`); `GameState` from `src/core/types.ts`; `Loadout`.
- Produces:
  - `visit(w: World, id: number): World`. Throws `Error('cannot visit region <id>')` unless `canVisit`. A neutral region becomes `allied`; a wild region becomes `visited: true` (holder stays `wild`) and adds one stash item chosen by `id % 3` (0 rifle, 1 pistol, 2 clip) through `capStash(addStash(...))`. Costs `DAYS.visit` days through `advance`.
  - `resolve(w: World, spec: MissionSpec, finished: GameState, used: Loadout): World`. Throws if `finished.status === 'playing'`.
    - Folds the result into roster, fallen, namesUsed and stash by building a temporary `Campaign` from the world (`mode: 'campaign'`, `missionIndex: 0`, `missionsWon: 0`, `variations: []`, `status: 'active'`) and calling `recordMission(c, finished, 99, used)`; copy `roster`, `fallen`, `namesUsed`, `stash` back.
    - Won: the region becomes `player` with `garrison 0`; costs `DAYS.attack`. If it is `CAPITAL_REGION`, `status = 'won'`.
    - Lost: the region stays `enemy`; after `recordMission` (which leaves only survivors in the roster) top the roster up to `CAMPAIGN.rosterSize` with fresh rookies using `soldierName(namesUsed)` and increment `namesUsed`; costs `DAYS.attack + DAYS.lossPenalty`.
    - Always: that region's `attempts + 1`; then `advance` the cost (Task 6; until then a stub that only adds days) and finally set `status = 'lost'` when no region has holder `player`.

Task 6 supplies `advance`; implement `resolve` and `visit` now against an `advance` that just adds days and replace it in Task 6 (the exported name and signature are fixed: `advance(w: World, days: number): World`).

- [ ] **Step 1: Write the failing tests** in `tests/worldresolve.test.ts`, building finished states with `makeState`/`corridorRows` from `tests/helpers.ts` (as `tests/campaignapp.test.ts` does) or by editing `createMission`'s result: set `status` to `'won'`/`'lost'` and `alive` flags on the four player units.
  - Win on a gate-adjacent enemy region (calm): holder `player`, `garrison 0`, `day === 3`, `attempts === 1`, `regionsHeld === 2`, kills of living soldiers added to roster, a dead soldier moved to `fallen` and replaced by a rookie with `soldierName(namesUsed)`, the original world object not mutated.
  - Win on the capital (set the world up with the capital open and the capital as the target, or patch holders): `status === 'won'`.
  - Loss with all four dead: roster is four rookies with `kills 0` and new names, `fallen.length === 4`, region still `enemy`, `day === 9`, `status === 'active'` (start region still held), stash unchanged.
  - Loss when `regionsHeld === 1` and PRESSURE counterattacks have already taken nothing: still `active`. Then a world where the only `player` region is a conquered region and `resolve` is a loss does not end the game (the region is still held).
  - Defeat: a world with no region holder `player` after resolve (build by setting every region holder to `enemy` except an allied one) gives `status === 'lost'`.
  - `resolve` with a `playing` state throws; `resolve` on a world with `status !== 'active'` throws.
  - `visit` neutral: holder `allied`, `day === 2`, `incomeRegions` +1, budget up by the preset's income; `visit` wild twice: second throws; stash grows by one item at the first visit only; `visit` an enemy region throws and the world is unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: story world resolve and visit`.

---

### Task 6: Time: growth and counterattacks

**Files:**
- Modify: `src/core/world/world.ts`
- Test: `tests/worldtime.test.ts`

**Interfaces:**
- Produces:
  - `advance(w: World, days: number): World`. For each day `d` from `w.day + 1` to `w.day + days` (integer, `days >= 0`; throws `RangeError` otherwise): if `growthEvery` and `d % growthEvery === 0`, every `enemy` region with `garrison < base + growthCap` gets `garrison + 1` (base is `REGIONS[id].garrison`); if `counterEvery` and `d % counterEvery === 0`, call `counterattack(w, roll)` with `roll` drawn from `seededRandom(missionSeed(w.seed, 1000 + d, 0))`. Sets `day`.
  - `counterattack(w: World, roll: number): World`. Target = among regions with holder `player` that link to at least one `enemy` region, the one with the lowest base `garrison` (tie: lowest id); none means no change. `attackers` = the highest current garrison among its linked `enemy` regions; `defenders = REGIONS[target].garrison + 1`; `chance = clamp(attackers / (attackers + defenders), 0.1, 0.9)`. If `roll < chance` the target becomes `enemy` with `garrison = max(1, base)`; then, if no region has holder `player`, `status = 'lost'`.

- [ ] **Step 1: Write the failing tests** in `tests/worldtime.test.ts`:
  - CALM: `advance(newWorld(1,'calm'), 400)` leaves every garrison at its base; `day === 400`.
  - STANDARD: `advance(w, 11)` unchanged garrisons; `advance(w, 12)` every enemy region base + 1; `advance(w, 12 * 10)` every enemy region base + 3 (cap), never more.
  - PRESSURE: `advance(w, 6)` base + 1; `advance(w, 6 * 20)` base + 5.
  - `advance(w, 0)` returns an equal world; negative or non-integer days throw `RangeError`; the input world is never mutated; same world and same days give deep-equal results (determinism).
  - `counterattack(w, 0)` on a PRESSURE world where the player holds the start and one adjacent conquered region: the lowest-base-garrison region touching the enemy flips to `enemy` with `garrison === max(1, base)`; `counterattack(w, 0.99)` changes nothing (chance is at most 0.9).
  - `counterattack` on a world where the player holds nothing touching the enemy changes nothing.
  - Defeat: a PRESSURE world where the start region is the only `player` region and touches enemy ground: `counterattack(w, 0)` gives `status === 'lost'`, holders unchanged elsewhere.
  - CALM and STANDARD worlds never change a holder through `advance(w, 1000)`.
  - `advance` on a PRESSURE world for 15 days from a world holding the start plus conquered regions: only holder changes allowed are `player -> enemy` on at most one region.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `advance` (replace the Task 5 stub) and `counterattack`. **Step 4: Run** the new file and `tests/worldresolve.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: story time, garrison growth and counterattacks`.

---

### Task 7: Story save

**Files:**
- Modify: `src/save.ts:24-88` (export the existing validators `isObj`, `isInt`, `soldiers`, `stash`, `loadout`; no behaviour change)
- Create: `src/storysave.ts`
- Test: `tests/storysave.test.ts`

**Interfaces:**
- Consumes: `World`, `Holder`, `RegionState`, `WorldStatus` (Task 4); `REGIONS`, `PLANET_VERSION` (Task 2); `DIFFICULTY_IDS` (Task 3); `SaveStorage` from `src/save.ts`; `Loadout`.
- Produces:
  - `const STORY_SAVE_KEY = 'laser-tribute-story'`, `const STORY_SAVE_VERSION = 1`
  - `interface StorySave { world: World; loadout: Loadout }`
  - `parseStory(text: string | null): StorySave | null`: strict. Rejects non-JSON, wrong `version`, `planetVersion !== PLANET_VERSION`, unknown difficulty, `regions.length !== 30`, a holder impossible for the region kind (an `enemy` or `player` holder is legal for `start` and `enemy` kinds; `neutral`, `allied` only for `neutral`; `wild` only for `wild`), `garrison` outside `[0, maxGarrison]`, `visited` not boolean, negative `attempts` or `day`, non-integer numbers, roster not exactly 4 valid soldiers, bad `fallen`, `namesUsed < 4`, bad stash, `status` not one of the three, `status === 'won'` while the capital is not `player`, `status === 'active'` while no region is `player`.
  - `class StoryStore { constructor(storage: SaveStorage | null); load(): StorySave | null; save(world: World, loadout: Loadout): void; clear(): void }`; storage errors are swallowed as `SaveStore` does.
  - `defaultStoryStore(): StoryStore | null` (browser storage, like `defaultCampaignStore`).

- [ ] **Step 1: Write the failing tests** in `tests/storysave.test.ts`: round trip `StoryStore` with `newWorld(3,'standard')` and `defaultLoadout()` through an in-memory `SaveStorage` (copy the `memory()` helper from `tests/campaignapp.test.ts`) → `load()` deep-equals the saved value; a world after a few `resolve`/`advance` calls round-trips too. Then one rejection test per rule listed above (mutate a valid JSON object and expect `parseStory(JSON.stringify(bad)) === null`): version, planetVersion, difficulty, region count, impossible holder, garrison over max, non-boolean visited, roster of 3, `status` won with capital not held, active with nothing held; plus `parseStory(null)`, `parseStory('')`, `parseStory('{not json')` all `null`. `clear()` makes `load()` null; a storage whose `getItem` throws gives `load() === null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run tests/storysave.test.ts tests/save.test.ts tests/savemodes.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: story save slot`.

---

### Task 8: Planet and difficulty screens

**Files:**
- Create: `src/screens/planet.ts`, `src/screens/difficulty.ts`
- Test: `tests/planetscreen.test.ts`

**Interfaces:**
- Consumes: `World`, `canAttack`, `canVisit`, `regionsHeld`, `storyBudget`, `capitalOpen` (Task 4); `REGIONS`, `CAPITAL_REGION` (Task 2); `DIFFICULTIES`, `DIFFICULTY_IDS`; `VIEW` from `src/render/layout.ts`; `UI`, `drawFrame`, `drawButton` from `src/ui/frame.ts`; `drawText`, `clipText`; `themeOfMap` and `RECIPES` for the look name.
- Produces:
  - `const PLANET = { map: { x: 6, y: 22, w: 330, h: 372 }, panel: { x: 342, y: 22, w: 132, h: 372 }, act: { x: 350, y: 300, w: 116, h: 28 }, abandon: { x: 350, y: 340, w: 116, h: 22 }, back: { x: 350, y: 368, w: 116, h: 20 } }` (the builder may nudge the rectangles; keep the names)
  - `interface PlanetView { world: World; selected: number | null; armedAbandon: boolean; notice: string }`
  - `type PlanetHit = { kind: 'region'; id: number } | { kind: 'act' } | { kind: 'abandon' } | { kind: 'back' }`
  - `planetHit(px: number, py: number, slop?: number): PlanetHit | null`: a region is hit when `(px, py)` is within `10 + slop` of its map position (`PLANET.map.x + r.x`, `PLANET.map.y + r.y`); if two qualify, the nearer wins; buttons use plain rectangle tests widened by `slop`.
  - `actLabel(view: PlanetView): string | null`: `ATTACK` when `canAttack(selected)`, `VISIT` when `canVisit`, `LOCKED` for the capital while not `capitalOpen`, `null` when nothing is selected or nothing can be done.
  - `drawPlanet(ctx: CanvasRenderingContext2D, v: PlanetView): void`: code-drawn placeholder art: a framed map with links as lines, regions as markers coloured by holder (enemy, player, allied, neutral, wild each distinct, the capital drawn larger), a selection ring; the side panel shows DAY, regions held, budget, the selected region's name, kind, garrison, map look (`Region.type` name from `RECIPES`), its day cost, the action button, an ABANDON button (label `SURE?` when `armedAbandon`) and BACK. `v.notice` shows in the panel's bottom line.
  - `DIFFICULTY_SCREEN` rectangles (three buttons plus BACK), `difficultyHit(px, py, slop?): DifficultyId | 'back' | null`, `drawDifficulty(ctx: CanvasRenderingContext2D): void` (each button: preset name and its `blurb`).

- [ ] **Step 1: Write the failing tests** in `tests/planetscreen.test.ts`:
  - `planetHit` at the exact map position of every region returns `{ kind: 'region', id }` for that region (loop over all 30); a point in the map frame far from any region returns `null`; with `slop` 6 a point 14 px from region A and farther from every other region still returns A (use any region, offset right by 14).
  - A point exactly midway between the two closest regions returns one of them (never `null` is not required) but never a third.
  - `planetHit` at the centre of `PLANET.act`, `abandon` and `back` returns the matching kinds; buttons do not overlap regions' hit circles (assert no region's centre lies inside any button rectangle widened by 10).
  - `actLabel`: `ATTACK` for an attackable region, `VISIT` for a visitable neutral, `LOCKED` for the capital in a new world, `null` for the held start region and for `selected: null`.
  - `difficultyHit` returns each of the three ids at its button centre and `'back'` at the back button.
  - Smoke render: `drawPlanet` and `drawDifficulty` run against a stub 2D context (reuse whatever `tests/screens.test.ts` uses) for a new world and for a world with some regions held, without throwing.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: planet and difficulty screens`.

---

### Task 9: STORY on the title screen

**Files:**
- Modify: `src/screens/title.ts:7-35` (`TitleView`, `TITLE`, `titleHit`, `titleSummary` stays) and the button drawing in `drawTitle` (`src/screens/title.ts:37-83`)
- Test: `tests/storytitle.test.ts` (and run `tests/title.test.ts`, `tests/titleart.test.ts` unchanged)

**Interfaces:**
- Produces: `TITLE.story = { x: 160, y: 250, w: 160, h: 28 }`; `TitleView` gains `story: { day: number; held: number } | null` (a continuable story save); `titleHit` returns `'story'` for that button (after the existing three, with the same slop rule).

- [ ] **Step 1: Write the failing tests**: `titleHit(240, 264, false) === 'story'`; the three existing buttons still return what they did at their centres; `drawTitle` runs with `story: null` and with `story: { day: 12, held: 4 }` against the stub context (label `STORY` and `STORY: DAY 12, 4 HELD`); the story button lies inside the title card and does not overlap another button.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Update existing call sites that build a `TitleView` (App, tests) to pass `story`. **Step 4: Run** `npm test` → green.
- [ ] **Step 5: Commit** `feat: STORY button on the title`.

---

### Task 10: Wire the story flow into the App

**Files:**
- Modify: `src/app.ts` (`Screen`, options, state, `click`, `key`, `update`, `startMission`, `continueFromResult`, `equipmentView`, `drawScreen`, `draw`'s menu test, `titleView`), `src/screens/end.ts` (an optional heading override on `EndView`), `src/main.ts` only if it builds `AppOptions`
- Test: `tests/storyapp.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 9.
- Produces:
  - `Screen` gains `'planet' | 'difficulty'`. `AppOptions` gains `storyStore?: StoryStore | null` (undefined uses the browser, null turns saving off, as `campaignStore` does).
  - App state: `story: World | null` (public for tests), `selectedRegion: number | null`, `pendingSpec: MissionSpec | null`.
  - Flow: title STORY with a save: load `world`, `loadout = fitLoadout(save.loadout, storyBudget(world), world.stash, gearLevel(world))`, screen `planet`. STORY without a save: screen `difficulty`; choosing a preset calls `newWorld(this.newSeed(), id)`, sets `loadout = defaultLoadout()`, saves, screen `planet`; BACK returns to the title. Planet: clicking a region selects it; ACT on an attackable region sets `pendingSpec = missionFor(world, id)` and goes to `equipment`; ACT on a visitable region calls `visit`, saves, shows a notice (`Found a clip.` style, or `<name> joins you.`); BACK (and Escape) returns to the title; ABANDON needs a second press within `NEW_CONFIRM_MS`, then clears the store and goes to `difficulty`.
  - Equipment while `pendingSpec` is set: `equipmentView()` returns budget `storyBudget`, title `<REGION NAME> - <GARRISON> ENEMIES`, breakdown `Base 120 + regions <n> + kills <n>`, soldiers from `world.roster`, `stash: world.stash`, `level: gearLevel(world)`; `applyEquipmentHit`/`validateLoadout` use that same budget, stash and level; START builds the mission with `this.createMission(generateMission(spec.type, spec.variation, spec.difficulty), spec.seed, world.roster, loadout, storyBudget(world), world.stash, gearLevel(world), spec.enemyLevel)` and sets `playedName` to the region name.
  - On the mission finishing (`update`): `world = resolve(world, pendingSpec, c.state, usedLoadout)`, `fallenNow`, `promoted`, `loot` computed from the world's before/after as the campaign path does, story saved (or cleared when `world.status !== 'active'`), screen `result`. `drawResult`'s `nextBudget` is `storyBudget(world)` while active, else null. `continueFromResult` goes to `planet` while active, else to `end`.
  - End screen: `drawCampaignEnd` gets a heading override (`EndView.heading?: string`): `PLANET TAKEN` on a win, `THE PLANET IS LOST` on defeat; `missionsWon` shows regions taken, `missionCount` the number of enemy-held regions in `REGIONS` (17). Its button returns to the title.
  - The menu-space predicate in `draw` includes `planet` and `difficulty`. The Campaign and Tutorial code paths must behave as before when `story === null`.

- [ ] **Step 1: Write the failing tests** in `tests/storyapp.test.ts`, following `tests/campaignapp.test.ts` (its `setup`, `winMission`, fake clock; pass `storyStore: new StoryStore(storage)` and a `createMission` stub that returns `makeState(corridorRows('P..'))`-style states so a mission can be won by the player pressing `e`, or forced lost by setting all player units dead):
  - Title shows STORY; with no story save, clicking it opens the `difficulty` screen; clicking CALM creates a world (`app.story?.difficulty === 'calm'`, `screen === 'planet'`) and writes the story key.
  - On the planet, selecting a region with `canAttack` then ACT goes to `equipment` with the story budget (`128`); START enters `mission`; the stub receives `enemyLevel === type + 1` and `level === 1`.
  - Win then Continue returns to `planet`, the region is `player`, `day === 3`, the story key is saved, tutorial and campaign keys are untouched.
  - Lost mission: world keeps the region `enemy`, four new rookies, back on `planet`.
  - Selecting a neutral linked to the start and ACT `visit`s it (`allied`, `day === 2`).
  - ACT on a non-attackable region does nothing (no screen change).
  - Taking the capital (patch `app.story` holders so the capital is open and the capital is the target) ends on `end` with the story key cleared; defeat (patch so the lost mission removes the last held region) also ends on `end` and clears the key.
  - A page reload (new `App` over the same storage) shows STORY as continuable and CONTINUE-ing returns to the same `day` and regions; a corrupt story key leaves STORY as a fresh start (opens `difficulty`) and does not throw.
  - ABANDON: the first press arms (no change), the second within the window clears the save and opens `difficulty`.
  - BACK on `planet` returns to the title with the save kept.
  - A Campaign run in the same storage still plays exactly as in `tests/campaignapp.test.ts` (re-run that file).
- [ ] **Step 2: Run** `npx vitest run tests/storyapp.test.ts` → FAIL. **Step 3: Implement** the wiring. Keep each branch small; if a helper grows past a few lines, move it to `src/storyflow.ts` and unit-test it there. **Step 4: Run** `npm test` and `npm run typecheck` → green.
- [ ] **Step 5: Commit** `feat: story mode flow in the app`.

---

### Task 11: Headless story run

**Files:**
- Create: `src/sim/story.ts`, `sim/story.sim.ts`
- Test: `tests/storysim.test.ts`

**Interfaces:**
- Consumes: `newWorld`, `attackable`, `missionFor`, `resolve`, `storyBudget`, `gearLevel`, `visit`, `canVisit` (Tasks 4 to 6); `chooseLoadout`, `TURN_LIMIT` from `src/sim/campaign.ts`; `botTurn`, `BotMode` from `src/sim/bot.ts`; `runEnemyTurn` from `src/core/ai.ts`; `generateMission`; `createMission`.
- Produces:
  - `type PlayMission = (spec: MissionSpec, world: World, loadout: Loadout) => GameState` (returns a finished state)
  - `playWithBot(mode?: BotMode): PlayMission` (the loop from `runCampaign`: build the state with `createMission(def, spec.seed, world.roster, loadout, storyBudget(world), world.stash, gearLevel(world), spec.enemyLevel)`, alternate `botTurn` and `runEnemyTurn`, a turn past `TURN_LIMIT` counts as lost)
  - `interface StoryRun { status: WorldStatus; steps: number; day: number; held: number; losses: number }`
  - `runStory(seed: number, difficulty: DifficultyId, play: PlayMission, maxSteps = 300): StoryRun`: each step the policy is: if the capital is attackable attack it; else attack the lowest-id `attackable` region; if none are attackable, `visit` the lowest-id visitable region; if nothing at all is possible stop with the current status. Loadout from `chooseLoadout(storyBudget, world.stash, gearLevel)`.

- [ ] **Step 1: Write the failing test** in `tests/storysim.test.ts` with a stub `PlayMission` that always returns a won state (a copy of `createMission`'s state with `status: 'won'`): `runStory(1, 'calm', stub)` ends with `status === 'won'` and `steps <= 300`, and the same holds for seeds 1 to 5 on all three difficulties; a stub that always loses on `'calm'` ends at `maxSteps` with `status === 'active'` and `losses === steps` (the run is bounded, never infinite); a stub that always loses on `'pressure'` may end `lost` or `active` but never throws and `steps <= maxSteps`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `src/sim/story.ts`, and `sim/story.sim.ts` (picked up by `vitest.sim.config.ts`): for seeds 1 to 4 on `calm`, run `runStory(seed, 'calm', playWithBot('careful'))`, print `seed status steps day held losses`, and assert only that no run throws and each ends within `maxSteps`. **Step 4: Run** `npx vitest run tests/storysim.test.ts` → PASS, then `npm run balance -- sim/story.sim.ts` and read the output: if the bot never reaches `won` on calm, report the finding to Rui (the world is bot-beatable or not; tuning is project 4) and do not silently change the numbers.
- [ ] **Step 5: Commit** `feat: headless story run with the bot`.

---

### Task 12: Regression, build, docs and visual check

**Files:**
- Modify: `README.md` (one short Story mode paragraph), `docs/superpowers/specs/2026-11-23-laser-tribute-story-mode-planet-design.md` (add a line under Intent: implemented, with the PR)
- No new tests.

- [ ] **Step 1: Run** `npm test` (whole suite, including `tests/aigolden.test.ts` and `tests/balance.test.ts`), `npm run typecheck` and `npm run build`. All must pass with no change to any pre-existing test file other than those the earlier tasks list.
- [ ] **Step 2: Visual check** with `preview_start` on the dev server: open the title (STORY button present, art not overlapped), start a CALM story, check the planet at 480x400, at a phone width (resize preset `mobile`, both orientations) and tap-select regions; play one attack through, win or lose, and confirm the planet updates; screenshot the planet and the result. Fix any overlap before continuing.
- [ ] **Step 3: Update** the README and the spec line; run `trail build` to refresh the repo graph.
- [ ] **Step 4: Commit** `docs: story mode planet map` and open the PR from `feature/story-planet` only when Rui asks.
