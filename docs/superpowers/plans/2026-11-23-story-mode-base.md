# Story Mode, Project 2: The Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give story mode a base: a credit stockpile with daily income, a research tree (credits and days), a marketplace premium on unresearched gear, a barracks pool you pick four from (hired for credits, loaned mercenaries, training, a hospital second chance), and a hub screen to run it all.

**Architecture:** The base state joins the existing story `World` (`src/core/world/world.ts`), so one `advance(days)` runs income, research, training and wounds. Gear availability becomes an `Unlocks` set plus a premium (`GearRules`), threaded through the existing loadout and equipment code behind an adapter so Tutorial and Campaign behave exactly as before. New pure modules hold the tables (`base.ts`), research actions and barracks actions; new screens draw a hub of tiles and panels; the story save goes to version 2 with a loader for version 1.

**Tech Stack:** TypeScript (strict), Canvas 2D, Vite, Vitest. Tests: `npm test`; types: `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-11-23-laser-tribute-story-mode-base-design.md`

Work on branch `feature/story-base` cut from master (which contains PR #54, project 1).

## Global Constraints

- `src/core/**` is pure: no DOM, no `Math.random`; seeded randomness only (`seededRandom` from `src/core/rng.ts`, `missionSeed` from `src/core/world/world.ts`).
- Tutorial and Campaign must not change: `tests/aigolden.test.ts`, `tests/campaign*.test.ts`, `tests/save*.test.ts`, `tests/loadout*.test.ts`, `tests/equipment*.test.ts` and the balance runner pass untouched. `unlocksFromLevel(level)` must reproduce today's sets for every level 1 to 10 (gadgets and the scope unlocked at every level).
- Project 1's story tests (`tests/world*.test.ts`, `tests/storyapp.test.ts`, `tests/storysave.test.ts`, `tests/storysim.test.ts`, `tests/difficulty.test.ts`) may be edited only where this plan says the rule changed (roster to pool, budget to credits, income per day).
- The squad is always exactly four units: a soldier on leave is covered by a loaned mercenary, never by a smaller squad.
- Training points are rank-only: rank is `rankFor(kills + trained)`, `trained` never feeds credits or `kills`.
- Saves hold only state. The story save becomes version 2; a version 1 save loads with defaults; anything inconsistent parses to `null`.
- Menus are drawn in the 480x400 menu space with `drawFrame`/`drawButton`/`drawText`, usable by tap with the existing touch slop; every drawn character must be supported by the font (`unsupportedChars(text)` is empty).
- All numbers below are starting values (tuned in project 4) and live in one table, `BASE_RULES`, plus the difficulty rows.
- Out of scope: drawn base art, stat training, specialisms, wound system for survivors, owned armoury, story text, new audio, new gear.

## Review Focus

1. A version 1 story save loads into a valid version 2 world, and corrupt or inconsistent version 2 saves (duplicate soldier names, pool over the bed count, squad naming a non-ready soldier, unknown research ids, a research id whose prerequisite is missing, active project already done) parse to `null` (Task 8).
2. Pool invariants hold after any action: names unique, pool never over the bed count, the squad only ever names ready soldiers, and a pool with fewer than four ready soldiers (even none) still yields a four-soldier deployment with loaned mercenaries and never leaves the player stuck (Tasks 6, 7, 9).
3. A broke player can always fight: loaned fees never take credits below 0, free kit (pistol, rifle, frag, medkit) validates at 0 credits (Tasks 4, 9).
4. Time-driven state is safe: `advance(0)`, a very large `advance`, two projects started at once, a second training while one runs, finishing research on the same day income arrives (Tasks 5, 6, 7).
5. Pricing cannot be gamed: a premium item covered by the stash is free, the premium applies only to unresearched gear, kit cost equals what the equipment screen shows, and a loadout is rejected when credits (minus mercenary fees) fall short (Tasks 2, 3).

---

### Task 1: `Unlocks`, `GearRules` and the level adapter

**Files:**
- Create: `src/core/gear.ts`
- Test: `tests/gear.test.ts`

**Interfaces:**
- Produces:
  - `interface Unlocks { weapons: readonly WeaponId[]; throwables: readonly ThrowableId[]; gadgets: readonly GadgetId[]; attachments: readonly AttachmentId[] }`
  - `interface GearRules { unlocks: Unlocks; premium: number | null }` (`premium` null: locked gear cannot be carried; a number: locked gear can be carried at base price times that number)
  - `type GearArg = number | GearRules` (a number is a unlock level, today's behaviour)
  - `unlocksFromLevel(level: number): Unlocks` (weapons from `unlockedWeapons(level)`, throwables from `unlockedThrowables(level)`, all gadgets in `GADGET_IDS`, all attachments in `ATTACHMENT_IDS`)
  - `gearRulesOf(arg: GearArg): GearRules` (a number gives `{ unlocks: unlocksFromLevel(n), premium: null }`)
  - `unlocked(rules: GearRules, kind: 'weapon' | 'throwable' | 'gadget' | 'attachment', id: string): boolean`
  - `priceFactor(rules: GearRules, kind, id): number` (1 when unlocked or `premium` is null; `premium` when locked)

- [ ] **Step 1: Write the failing tests** in `tests/gear.test.ts`: for each level 1 to 10, `gearRulesOf(level).unlocks.weapons` deep-equals `unlockedWeapons(level)` and `.throwables` equals `unlockedThrowables(level)`, `.gadgets` equals `GADGET_IDS`, `.attachments` equals `ATTACHMENT_IDS`, `premium` is `null`. `gearRulesOf(rules)` returns the same object. With `{ unlocks: { weapons: ['pistol','rifle'], throwables: ['frag'], gadgets: ['medkit'], attachments: [] }, premium: 1.5 }`: `unlocked(r,'weapon','rifle')` true, `unlocked(r,'weapon','sniper')` false, `priceFactor(r,'weapon','sniper') === 1.5`, `priceFactor(r,'weapon','rifle') === 1`, `priceFactor(r,'attachment','scope') === 1.5`; with `premium: null` the factor is 1 everywhere.
- [ ] **Step 2: Run** `npx vitest run tests/gear.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `src/core/gear.ts` as above.
- [ ] **Step 4: Run** the test → PASS; `npm run typecheck` clean.
- [ ] **Step 5: Commit** `feat: unlocks and gear rules with a level adapter`.

---

### Task 2: Pricing and validation take `GearArg`

Thread `GearArg` through `src/core/loadout.ts` and `createMission` so a story can price and allow locked gear, with numbers behaving exactly as today.

**Files:**
- Modify: `src/core/loadout.ts` (`soldierCost`, `loadoutCost`, `netSoldierCost`, `validateLoadout`, `fitLoadout`, `applyLoadout`), `src/core/missions.ts:135-170` (`createMission`'s `level` becomes `GearArg`; `enemyLevel` stays a number), `src/app.ts` option type for `createMission`
- Test: `tests/gearloadout.test.ts`

**Interfaces:**
- Consumes: `GearArg`, `GearRules`, `gearRulesOf`, `unlocked`, `priceFactor` (Task 1)
- Produces: every `level: number = TUTORIAL_LEVEL` parameter in `loadout.ts` becomes `gear: GearArg = TUTORIAL_LEVEL`; `soldierCost(s, rules?: GearRules)`, `loadoutCost(l, stash?, rules?)`, `netSoldierCost(l, i, stash?, rules?)`. Prices of weapon, throwable, gadget and attachment are multiplied by `priceFactor` (rounded to an integer, minimum 1) when `rules` is given; the stash covers an item at its premium price too. `validateLoadout` accepts an item that is locked but premium-priced; with `premium: null` it rejects locked weapons and throwables as today, and it rejects locked gadgets and attachments (which a level adapter never locks).

- [ ] **Step 1: Write the failing tests** in `tests/gearloadout.test.ts`: (a) with level numbers 1 and 6, `validateLoadout`, `fitLoadout`, `loadoutCost` give the same results as before for a handful of kits (compare against values computed by the old behaviour: sniper locked at level 1 with message `Soldier 1: the Sniper is locked`, allowed at level 6). (b) With `rules = { unlocks: { weapons:['pistol','rifle'], throwables:['frag'], gadgets:['medkit'], attachments:[] }, premium: 1.5 }`: a kit with one sniper costs `Math.round(WEAPONS.sniper.price * 1.5)` for that weapon, `validateLoadout(kit, 500, emptyStash(), rules)` is `null`, with budget 50 it names the cost; a rifle is unchanged in price; a scope and armour cost 1.5x; the same kit with `stashOf({ sniper: 1 })` costs the sniper at 0 and `netSoldierCost` drops by the premium price. (c) `premium: null` plus a locked sniper → `Soldier 1: the Sniper is locked`. (d) `createMission(def, 1, undefined, kitWithSniper, 500, undefined, rules, 1)` builds a state whose first soldier has `weapon === 'sniper'`.
- [ ] **Step 2: Run** `npx vitest run tests/gearloadout.test.ts` → FAIL.
- [ ] **Step 3: Implement** the threading. One price helper per item kind inside `loadout.ts` that applies `priceFactor` only when `rules` is passed; keep the old signatures working for numbers.
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` → all green (golden fingerprints and campaign suites unchanged).
- [ ] **Step 5: Commit** `feat: loadout pricing and validation take gear rules`.

---

### Task 3: Equipment screen takes `GearArg`

**Files:**
- Modify: `src/screens/equipment.ts` (`level` parameters in `nextWeapon`, `nextThrowable`, `toggleBlockReason`, `toggleWeapon`, `throwableBlockReason`, `cycleThrowable`, `blockReasonFor`, `applyEquipmentHit`, `cycleGadget`, `toggleScope`, `EquipmentView.level`), `src/app.ts` call sites
- Test: `tests/gearequipment.test.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2 exports.
- Produces: `EquipmentView.level` becomes `level: GearArg` (name kept to leave existing tests untouched); with `GearRules` the weapon and throwable cycles include locked items when `premium !== null`, the gadget and scope cycles include only unlocked items, and prices shown next to items use the factor. Numbers behave as today.

- [ ] **Step 1: Write the failing tests**: with level numbers the option cycles equal today's (`nextWeapon` at levels 1 and 6 for a rifle soldier); with rules (premium 1.5, weapons `['pistol','rifle']`) `nextWeapon` after `rifle` reaches `shotgun` (a locked weapon becomes selectable); with `premium: null` it does not; `cycleGadget` skips a locked `armour` and `toggleScope` is refused (`scopeBlockReason` non-null) when `attachments` is empty; `drawEquipment` with such a view runs against a stub context without throwing and every drawn text is font-supported.
- [ ] **Step 2: Run** `npx vitest run tests/gearequipment.test.ts` → FAIL.
- [ ] **Step 3: Implement** by replacing each `unlockedWeapons(level)` / `unlockedThrowables(level)` use with `unlocked(rules, ...)` and the premium rule above; gadget and attachment cycling respect `unlocks`.
- [ ] **Step 4: Run** `npm test` and typecheck → green (existing equipment tests untouched).
- [ ] **Step 5: Commit** `feat: equipment screen offers premium gear`.

---

### Task 4: Rank training points

**Files:**
- Modify: `src/core/campaign.ts:14-17` (`RosterSoldier` gains `trained?: number`), `recordMission` (keep `trained` when folding kills), `src/core/missions.ts` (`createMission` applies `applyRank(u, kills + (trained ?? 0))`)
- Test: `tests/trained.test.ts`

**Interfaces:**
- Produces: `RosterSoldier { name: string; kills: number; trained?: number }`; absent `trained` means 0, so existing saves and rosters are valid unchanged.

- [ ] **Step 1: Write the failing tests**: `createMission(def, 1, [{ name:'A', kills: 0, trained: 2 }, ...])` gives soldier 0 `rank === 'Private'` and the Private `maxHp`; `{ kills: 3, trained: 2 }` gives `'Sergeant'`; a roster with no `trained` gives today's ranks. `recordMission` on a campaign whose roster soldier has `trained: 2` keeps `trained: 2` on the survivor and its `kills` is only old kills plus the unit's kills (training never added to `kills`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (spread the old soldier in `recordMission`'s `updated`). **Step 4: Run** `npm test` → green (campaign and save suites unchanged; `parseSave` ignores the extra field, which a campaign never has).
- [ ] **Step 5: Commit** `feat: rank-only training points on roster soldiers`.

---

### Task 5: Base tables and derived levels

**Files:**
- Create: `src/core/world/base.ts`
- Test: `tests/basetables.test.ts`

**Interfaces:**
- Consumes: `GearRules`, `Unlocks` (Task 1); `WeaponId`, `ThrowableId`, `GadgetId`, `AttachmentId`.
- Produces:
  - `interface ResearchNode { id: string; name: string; cost: number; days: number; needs: readonly string[]; gives: { weapon?: WeaponId; throwable?: ThrowableId; gadget?: GadgetId; attachment?: AttachmentId; beds?: number; labs?: number; contracts?: number; hospital?: number; training?: number } }`
  - `const NODES: readonly ResearchNode[]` with exactly these (id: cost, days, needs): `shotgun` 40,4,[]; `smg` 70,5,[shotgun]; `sniper` 110,6,[smg]; `smoke` 30,3,[]; `flash` 45,4,[smoke]; `incendiary` 70,5,[flash]; `armour` 50,4,[]; `scanner` 45,4,[]; `scope` 40,3,[]; `beds1` 60,4,[]; `beds2` 100,5,[beds1]; `beds3` 140,6,[beds2]; `labs1` 80,5,[]; `labs2` 140,6,[labs1]; `contracts1` 70,4,[]; `contracts2` 110,5,[contracts1]; `contracts3` 160,6,[contracts2]; `hospital1` 80,5,[]; `hospital2` 140,6,[hospital1]; `training1` 80,5,[]; `training2` 140,6,[training1]; `training3` 200,7,[training2]. Each base node's `gives` names its track level (`beds: 1`, `beds: 2`, ...); a gear node's `gives` names the item.
  - `const BASE_RULES = { startCredits: 150, premium: 1.5, bounty: 5, startBeds: 6, bedsPerLevel: 2, hireCost: 40, mercFee: 10, trainDays: 4, woundedDays: 6, hospitalChance: [0, 0.25, 0.5], trainCaps: [2, 5, 9], labFactor: [1, 0.75, 0.5], waitOptions: [1, 3] } as const`; `trainCaps` are the effective-kill ceilings for training levels 1 to 3 (Private, Sergeant, Captain).
  - `interface BaseLevels { beds: number; labs: number; contracts: number; hospital: number; training: number }`
  - `levelsOf(done: readonly string[]): BaseLevels` (the highest level reached in each track, 0 when none)
  - `bedCount(done): number` (`startBeds + bedsPerLevel * levels.beds`)
  - `researchDays(node: ResearchNode, done): number` (`max(1, ceil(node.days * labFactor[levels.labs]))`)
  - `unlocksOf(done: readonly string[]): Unlocks` (the start set: weapons `pistol`, `rifle`; throwable `frag`; gadget `medkit`; no attachments; plus every researched gear node's item)
  - `storyGearRules(done): GearRules` (`{ unlocks: unlocksOf(done), premium: BASE_RULES.premium }`)
  - `nodeById(id: string): ResearchNode | undefined`

- [ ] **Step 1: Write the failing tests**: ids unique; every `needs` id exists; no cycles (a topological walk visits all 22); the 22 ids and costs/days/needs match the table above; the gear nodes cover exactly `shotgun, smg, sniper, smoke, flash, incendiary, armour, scanner, scope`; `levelsOf([])` all zero; `levelsOf(['beds1','beds2','labs1'])` gives `beds 2, labs 1`; `bedCount([])` 6 and `bedCount(['beds1','beds2','beds3'])` 12; `researchDays(nodeById('sniper')!, [])` 6, with `labs1` done `5` (ceil 4.5), with `labs1`,`labs2` `3`; `researchDays` of a 3-day node with `labs2` is 2; `unlocksOf([])` equals the start set; `unlocksOf(['shotgun','armour'])` adds `shotgun` and `armour`; `storyGearRules([]).premium === 1.5`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: base research tree and rule tables`.

---

### Task 6: World state: pool, credits, research (replaces roster and budget)

The largest task: the story world swaps its four-soldier `roster` and the per-mission budget for a pool and a stockpile. Project 1's code and tests adapt.

**Files:**
- Modify: `src/core/world/world.ts` (`World`, `newWorld`, queries, `resolve`, `advance`), `src/core/world/difficulty.ts` (`income` becomes credits per region per day: calm 4, standard 3, pressure 2; name `income` kept), `src/storysave.ts` (temporary: compile against the new `World`; Task 8 finishes it), `src/app.ts`, `src/sim/story.ts`, tests of project 1 that read `roster`, `namesUsed`, `storyBudget` or `gearLevel`
- Create: `src/core/world/barracks.ts`
- Test: `tests/worldbase.test.ts`; update `tests/world.test.ts`, `tests/worldresolve.test.ts`, `tests/worldtime.test.ts`, `tests/difficulty.test.ts`, `tests/storyapp.test.ts`, `tests/storysim.test.ts`, `tests/storysave.test.ts` as the compiler directs.

**Interfaces:**
- Consumes: Task 5 exports; `RosterSoldier` with `trained` (Task 4).
- Produces in `world.ts`:
  - `interface PoolSoldier { name: string; kills: number; trained: number; status: 'ready' | 'training' | 'wounded'; daysLeft: number }`
  - `World` gains `credits: number`, `research: { done: string[]; active: { node: string; daysLeft: number } | null }`, `soldiers: PoolSoldier[]`, `squad: string[]`; it loses `roster`. `fallen`, `namesUsed`, `stash` stay. `newWorld(seed, difficulty)` gives `credits: BASE_RULES.startCredits`, `research: { done: [], active: null }`, four ready rookies `soldierName(0..3)` with `kills 0, trained 0, daysLeft 0`, `squad` those four names.
  - `incomePerDay(w: World): number` = `(regions held + allied) * (DIFFICULTIES[w.difficulty].income + levelsOf(done).contracts)`
  - `advance(w, days)` also, each day: adds `incomePerDay`; ticks the active research (`daysLeft - 1`, at 0 the node's id is appended to `done` and `active` cleared); ticks each `training` and `wounded` soldier (`daysLeft - 1`; at 0 status `ready`, and a finishing training adds its points, see Task 9). Order inside a day: income, then ticks.
  - `storyBudget` and `gearLevel` are removed.
  - `barracks.ts` (this task): `deployed(w: World): { roster: RosterSoldier[]; mercs: number }`: the first four ready soldiers named in `w.squad` (ready, in pool), in squad order, as `{ name, kills, trained }`, topped up to exactly four with `{ name: 'Loan 1', kills: 0 }`, `'Loan 2'`, ... and `mercs` the number added; `autoSquad(w: World): string[]` = the four ready soldiers with the most effective kills (`kills + trained`, ties by pool order), fewer if fewer are ready; `setSquad(w: World, names: string[]): World` throws unless at most four, unique, all in the pool and ready.
  - `kitBudget(w: World): number` = `max(0, w.credits - BASE_RULES.mercFee * deployed(w).mercs)` (what the equipment screen can spend after loan fees).
  - `resolve(w, spec, finished, used, kitCost: number): World` (kitCost is the `loadoutCost` the player paid): deducts `kitCost + mercFee * mercs` from credits (never below 0), credits `bounty * kills` by the squad's units, folds each real soldier's kills into the pool by unit index (squad order), moves a dead soldier to `fallen` (the hospital in Task 9 can save him), applies stash loot/consumption as `recordMission` does for a win (`capStash(addStash(nextStash(w.stash, used, finished), lootFrom(finished)))`), sets `squad` to `autoSquad`, takes the region on a win and sets `status` as in project 1, and spends the same days (`DAYS.attack` plus `DAYS.lossPenalty` on a loss). No free replacements: a wiped squad leaves the pool short and the player hires or borrows.

- [ ] **Step 1: Write the failing tests** in `tests/worldbase.test.ts`: `newWorld` has `credits 150`, four soldiers, `squad` of four names, `research` empty. `incomePerDay` on calm with 1 region is 4, with `contracts1` done 5; allied region counts. `advance(w, 3)` on calm adds `3 * incomePerDay`. A started research (set `research.active = { node: 'shotgun', daysLeft: 2 }` directly) completes on day 2: `done` contains `shotgun`, `active` null; a 1-day node never leaves `daysLeft` 0. Soldier with `status: 'training', daysLeft: 1` is `ready` after `advance(w,1)`. `deployed` with a squad of 3 ready soldiers gives 4 roster entries, `mercs === 1`, last named `Loan 1`; with an empty squad and an empty pool `roster` is four `Loan` entries and `mercs === 4`; a soldier named in `squad` who is `training` is skipped (mercenary used). `autoSquad` prefers higher `kills + trained`. `setSquad` throws on 5 names, duplicates, unknown or non-ready names. `kitBudget` = credits minus `10 * mercs`, never negative. `resolve`: win credits the bounty (`5 * kills`), deducts `kitCost`, keeps credits at least 0 when `kitCost + fees` exceed them, adds kills to pool soldiers in squad order, a dead soldier is in `fallen` and not in `soldiers`; a wiped loss leaves `soldiers` empty and `squad` empty and the world `active` while a region is held; `squad` after resolve equals `autoSquad`.
- [ ] **Step 2: Run** `npx vitest run tests/worldbase.test.ts` → FAIL.
- [ ] **Step 3: Implement** the state change, the new functions and the `advance` and `resolve` changes; follow the compiler through `app.ts` and `src/sim/story.ts` (use `kitBudget`/credits where `storyBudget` was, `storyGearRules(world.research.done)` where `gearLevel` was) and update the listed project 1 tests to the new rules (expected numbers: budget on calm at start is now `kitBudget` 150, income per day replaces the per-mission income, a wiped squad no longer brings four rookies).
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` → all green.
- [ ] **Step 5: Commit** `feat: story world gets a soldier pool and a credit stockpile`.

---

### Task 7: Research actions

**Files:**
- Create: `src/core/world/research.ts`
- Test: `tests/research.test.ts`

**Interfaces:**
- Consumes: `World` (Task 6), `NODES`, `nodeById`, `researchDays` (Task 5).
- Produces: `canResearch(w: World, id: string): boolean` (world active, node exists and is not done, all `needs` done, `research.active` null, `credits >= node.cost`); `researchOptions(w: World): string[]` (ids that satisfy `canResearch`, in `NODES` order); `startResearch(w: World, id: string): World` (throws `Error('cannot research <id>')` unless `canResearch`; deducts the cost, sets `active = { node: id, daysLeft: researchDays(node, done) }`).

- [ ] **Step 1: Write the failing tests**: with 150 credits `canResearch(w,'shotgun')` true and `startResearch` leaves 110 credits and `active.daysLeft 4`; a second start while one is active throws; `'smg'` is refused until `shotgun` is done; a node already done, an unknown id, and a node costing more than the credits are refused with the world unchanged (deep-equal copy); `researchOptions` on a new world lists every root affordable at 150: the five gear roots (shotgun, smoke, armour, scanner, scope) and the five base roots (beds1, labs1, contracts1, hospital1, training1), in table order; after `advance` completes `shotgun`, `unlocksOf(done)` includes it and `researchOptions` now includes `smg`; with `labs1` done a 5-day node takes `ceil(5 * 0.75) = 4` days. A started project is not refundable (no cancel function exists).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → green.
- [ ] **Step 5: Commit** `feat: research actions`.

---

### Task 8: Story save version 2

**Files:**
- Modify: `src/storysave.ts` (`STORY_SAVE_VERSION = 2`, `parseStory`)
- Test: update `tests/storysave.test.ts`; add `tests/storysavev1.test.ts`

**Interfaces:**
- Consumes: Task 5 (`NODES`, `bedCount`), Task 6 (`World`).
- Produces: `parseStory(text)` accepts version 2 (strict: `credits` integer 0 to 999999; `research.done` unique known ids with every prerequisite in `done`; `research.active` null or `{ node, daysLeft }` with a known node, not in `done`, prerequisites done, `daysLeft` integer 1 to 30; `soldiers` unique names, 0 to `bedCount(done)` of them, each `kills`/`trained` integers 0 to 9999, `status` one of the three, `daysLeft` integer 0 to 30 and `0` exactly when `ready`; `squad` unique names, at most 4, each a ready soldier in `soldiers`; `fallen`, `namesUsed >= fallen.length + soldiers.length`) and version 1 (the old shape with `roster`): a version 1 world loads with `credits` = `BASE_RULES.startCredits`, `research` empty, `soldiers` = the four roster soldiers as ready with `trained 0`, `squad` = their names; everything else unchanged and still validated as before. `StoryStore.save` always writes version 2.

- [ ] **Step 1: Write the failing tests**: round trip of a new world and of a world after `startResearch`, a hire and `advance`; `tests/storysavev1.test.ts` builds the exact old JSON (copy of a project 1 save: `version: 1`, `world` with `roster`, no base fields) and expects a valid v2 world with the four soldiers ready and 150 credits; one rejection test each for: duplicate soldier names, pool over the bed count, a squad naming a training soldier, a squad of 5, unknown research id, `smg` done without `shotgun`, active node already done, active with missing prerequisite, `daysLeft` 0 on a training soldier, `ready` with `daysLeft` 3, negative credits, `namesUsed` too small, version 3. Existing `tests/storysave.test.ts` cases adapt to version 2 field names.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run tests/storysave.test.ts tests/storysavev1.test.ts tests/save.test.ts tests/savemodes.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: story save version 2 with a version 1 loader`.

---

### Task 9: Barracks actions, training, hospital, wait

**Files:**
- Modify: `src/core/world/barracks.ts`, `src/core/world/world.ts` (`resolve`, `advance`)
- Test: `tests/barracks.test.ts`

**Interfaces:**
- Consumes: Tasks 5 to 7; `rankFor`, `RANKS` from `src/core/ranks.ts`; `seededRandom`, `missionSeed`.
- Produces in `barracks.ts`:
  - `canHire(w: World): boolean` (active, `soldiers.length < bedCount(done)`, `credits >= BASE_RULES.hireCost`); `hire(w: World): World` (throws `Error('cannot hire')`; deducts the cost; appends a ready rookie named `soldierName(namesUsed)`; increments `namesUsed`)
  - `canTrain(w: World, name: string): boolean`: training level `L = levelsOf(done).training >= 1`, soldier exists and is `ready`, no soldier is currently `training`, and `kills + trained < trainCaps[L - 1]`
  - `startTraining(w: World, name: string): World` (throws unless `canTrain`; status `training`, `daysLeft = trainDays`; the soldier is removed from `squad`)
  - `wait(w: World, days: number): World` (throws `RangeError` unless `days` is one of `waitOptions`; `advance(w, days)`)
  In `world.ts`: when a training soldier's `daysLeft` reaches 0 inside `advance`, he becomes `ready` and `trained` is raised so `kills + trained` equals the next rank threshold above his current effective kills (2, 5 or 9), never beyond `trainCaps[training level - 1]` (use `RANKS`); `resolve` adds the hospital: after a **won** mission each dead real soldier (not a loaned mercenary) is rolled once with `seededRandom(missionSeed(w.seed, spec.region, attempts, 77))`; with `roll < hospitalChance[levelsOf(done).hospital]` he stays in `soldiers` as `wounded`, `daysLeft = woundedDays`, keeping name, kills and trained, instead of going to `fallen`; a lost mission never saves anyone.

- [ ] **Step 1: Write the failing tests**: `hire` on a new world with 6 beds, 4 soldiers: 2 hires succeed (credits `150 - 80 = 70`), the third throws (beds); a hire with 39 credits throws; names are `Eriksen`, `Fontaine`; with `beds1` done a 7th and 8th soldier fit. `canTrain` is false with `training1` missing; with `training1` a soldier with 0 kills trains: after `advance(w, 4)` he is `ready` with `kills + trained === 2` (Private); a second stint reaches no higher than 2 at level 1 (`canTrain` false once at the cap); with `training2` it reaches 5 (so `trained` 5 with 0 kills after two more stints), with `training3` 9; a soldier with 3 kills at level 2 trains to 5; training a second soldier while one trains is refused; the trained soldier is removed from `squad` and `deployed` uses a mercenary for his slot until he returns. `wait(w,1)` and `wait(w,3)` advance 1 and 3 days and pay income; `wait(w,2)` throws; on PRESSURE the garrison growth and counterattacks of `advance` still apply (growth after `wait(w,3)` twice equals `advance(w,6)`). Hospital: with `hospital2` (chance 0.5) a world and a won fight where every squad soldier died: over seeds 1 to 200 the number of `wounded` soldiers is between 70 and 130 of 800 rolled (the chance is applied), the same inputs give identical results, a wounded soldier is `ready` again after `woundedDays`, his rank (kills) is unchanged; with no hospital nobody is saved; a lost mission saves nobody even at level 2; loaned mercenaries are never saved or added to `fallen`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` → green.
- [ ] **Step 5: Commit** `feat: barracks, training, hospital and wait`.

---

### Task 10: Base screen hub

**Files:**
- Create: `src/screens/base.ts`
- Test: `tests/basescreen.test.ts`

**Interfaces:**
- Consumes: `World`, `incomePerDay`, `levelsOf`, `bedCount`, `researchOptions`; `nodeById`; `VIEW`, `UI`, `drawFrame`, `drawButton`, `drawText`, `clipText`.
- Produces:
  - `type BuildingId = 'lab' | 'barracks' | 'market' | 'training' | 'hospital' | 'wait' | 'planet'`
  - `interface Building { id: BuildingId; name: string; x: number; y: number; w: number; h: number }`, `const BUILDINGS: readonly Building[]` (seven entries as data; the tiles are a 3-column grid under a title strip, with PLANET the way back; project 3 can draw these as a map from the same list)
  - `buildingStatus(w: World, id: BuildingId): string[]` (two short lines per tile: lab `researching name, n days left` or `idle, n options`; barracks `soldiers/beds`, `n ready`; market `premium +50%`; training `name, n days left` or `level L` / `not built`; hospital `level L, NN% second chance` or `not built`; wait `1 or 3 days`; planet `day D, credits C`)
  - `baseHit(px: number, py: number, slop?: number): BuildingId | null`; `drawBase(ctx, world: World, notice: string): void`

- [ ] **Step 1: Write the failing tests**: `baseHit` at each building's centre returns its id, an empty point returns null, touch slop 5 widens without hitting a neighbour (gaps are at least 12); no two buildings overlap and all are inside 480x400; `buildingStatus` for a new world: lab `idle`, barracks `4/6`, training `not built`, hospital `not built`, planet shows `DAY 0` and `150`; after setting `research.active` the lab line names the node; every status line is at most 22 characters and font-supported; `drawBase` runs against the stub context for a new world and a played one without throwing and every drawn text is supported and inside the 480 px width.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: base hub screen`.

---

### Task 11: Base panels (lab, market, barracks, training, hospital) and the squad step

**Files:**
- Create: `src/screens/basepanels.ts`, `src/screens/squad.ts`
- Test: `tests/basepanels.test.ts`, `tests/squadscreen.test.ts`

**Interfaces:**
- Consumes: Tasks 5 to 10 exports.
- Produces in `basepanels.ts`: `type PanelId = 'lab' | 'market' | 'barracks' | 'training' | 'hospital'`; for each panel a pure view builder and a hit function and one `drawPanel(ctx, id: PanelId, w: World, selected: number | null, notice: string): void`; `panelHit(id: PanelId, px, py, w: World, slop?): PanelHit | null` with `PanelHit = { kind: 'row'; index: number } | { kind: 'act' } | { kind: 'back' }`; `panelRows(id: PanelId, w: World): { label: string; detail: string; enabled: boolean }[]` (lab: every node with cost and days, locked ones greyed with what they need; market: every gear node with base price, premium price and the saving from research; barracks: the pool (`name rank status`) and a HIRE action; training: the soldiers who can train; hospital: level, chance, and the next node's cost); `panelAction(id, w, selected): string | null` is the act-button label (`START`, `HIRE`, `TRAIN`, or null).
  In `squad.ts`: `SQUAD` rectangles, `squadView(w: World, picked: string[])`, `squadHit(px, py, w, slop?): { kind: 'soldier'; name: string } | { kind: 'start' } | { kind: 'auto' } | { kind: 'back' } | null`, `drawSquad(ctx, w: World, picked: string[]): void` (the pool with ready soldiers tappable, picked ones marked, a line `LOANED: n` for empty slots, AUTO to fill the best four, START to go to equipment, BACK).

- [ ] **Step 1: Write the failing tests**: `panelRows('lab', newWorld)` has 22 rows in table order, rows with unmet prerequisites are disabled, `shotgun` enabled at 150 credits; the market rows list the 9 gear nodes with `premium price = round(base * 1.5)` and the saving; `panelAction('lab', w, <shotgun row>)` is `START`, disabled rows give null; barracks `HIRE` is null when the pool is full or credits are short; every panel's rows fit their rectangle (at most 9 visible rows with a scroll offset in the view, or paging via `selected`; the builder chooses, the test asserts no drawn text leaves the screen and all text is font-supported); `panelHit` returns row indices at row centres and `back`/`act` at their buttons with no overlap. `squadHit` returns the soldier at his row, `auto`, `start`, `back`; a training soldier row is not tappable (returns null); `drawSquad` with 0 ready soldiers shows `LOANED: 4`; font-supported and within 480x400.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: base panels and squad step`.

---

### Task 12: Wire the base into the App

**Files:**
- Modify: `src/app.ts` (`Screen`, state, `click`, `key`, `update`/`finishStoryMission`, `startStoryMission`, `actOnRegion`, `equipmentView`, `drawScreen`, `draw`'s menu test), `src/screens/planet.ts` (a BASE button in the panel; `PlanetHit` gains `{ kind: 'base' }`)
- Test: `tests/baseapp.test.ts`; adapt `tests/storyapp.test.ts` for the squad step

**Interfaces:**
- Consumes: Tasks 5 to 11.
- Produces: `Screen` gains `'base' | 'panel' | 'squad'`. Flow: planet BASE button opens `base`; a tile opens `panel` (lab, market, barracks, training, hospital), the WAIT tile opens a small panel with two buttons, `WAIT 1 DAY` and `WAIT 3 DAYS`, calling `wait(1)` and `wait(3)`, PLANET returns to the planet. ATTACK on the planet now opens `squad` (picked = `world.squad`, filled by `autoSquad` when empty), START there calls `setSquad` and opens `equipment`. The equipment screen uses `kitBudget(world)` as the budget, `storyGearRules(done)` as the `level` argument everywhere it used the old level, and soldiers from `deployed(world).roster`. Starting the mission passes the same rules and `deployed(world).roster` to `createMission`; finishing it calls `resolve(world, spec, state, usedLoadout, loadoutCost(used, world.stash, rules))`. Every base action saves the story. The result screen's promotions line uses the pool. ABANDON and BACK behave as in project 1. Escape on `panel`, `squad` and `base` goes back one step.

- [ ] **Step 1: Write the failing tests** in `tests/baseapp.test.ts` (setup as in `tests/storyapp.test.ts`; stub `createMission`): BASE opens the hub and PLANET returns; the lab panel starts `shotgun`: credits drop by 40, the lab tile then shows researching, `advance` through two attacks (3 days each) completes it and the equipment screen then offers the shotgun at base price while an unresearched sniper is offered at `round(base * 1.5)`; hiring in the barracks adds a soldier and costs 40; training with `training1` takes a soldier out, the squad step then shows `LOANED: 1` and the stubbed `createMission` receives a roster whose last name is `Loan 1`; wait 3 days pays income and saves; a won mission pays the bounty and keeps credits above 0; a lost wiped mission leaves an empty squad step with four loaned slots and the next mission still starts; STORY continue after a reload keeps research, pool and credits; a version 1 save in storage continues as a valid story; with the stub, Campaign and Tutorial flows are unchanged (re-run `tests/campaignapp.test.ts`).
- [ ] **Step 2: Run** `npx vitest run tests/baseapp.test.ts` → FAIL. **Step 3: Implement** the wiring in small branches; move helpers to `src/storyflow.ts` if `app.ts` grows unwieldy. **Step 4: Run** `npm test` and `npm run typecheck` → green.
- [ ] **Step 5: Commit** `feat: base flow in the app`.

---

### Task 13: Headless base policy

**Files:**
- Modify: `src/sim/story.ts`, `sim/story.sim.ts`
- Test: `tests/storysim.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 6 to 9.
- Produces: `runStory` also, before each fight: `startResearch` the cheapest option from `researchOptions(w)` while credits stay at least 60 afterward; `hire` while ready soldiers are fewer than four and `canHire`; `startTraining` the first trainable soldier when `canTrain`; then `setSquad(autoSquad)`; the loadout is `chooseLoadout(kitBudget(w), w.stash, storyGearRules(done))`-style: build it with the existing `chooseLoadout` adapted to take `GearArg`, and pass `loadoutCost` to `resolve`. The `PlayMission` type is `(spec, world, loadout, roster) => GameState` using `deployed(world).roster`.

- [ ] **Step 1: Write the failing test**: with a win stub on every preset and seeds 1 to 3 the story ends `won` within 300 steps, `run.status === 'won'`; with a lose stub on CALM for 40 steps the pool is never over the beds, credits are never negative and the world stays `active` (the policy keeps hiring and borrowing); a story run records at least one researched node and one hire (extend `StoryRun` with `researched: number`, `hired: number`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run tests/storysim.test.ts` → PASS; then `npm run balance -- sim/story.sim.ts` with `STORY_RUNS=2` and read the lines; if the careful bot no longer wins on CALM, report it, do not retune silently.
- [ ] **Step 5: Commit** `feat: base policy in the headless story run`.

---

### Task 14: Regression, build, browser check, docs

**Files:**
- Modify: `README.md` (a Story base paragraph), `docs/superpowers/specs/2026-11-23-laser-tribute-story-mode-base-design.md` (a status line)
- No new tests.

- [ ] **Step 1: Run** `npm test`, `npm run typecheck`, `npm run build`; all green, and `tests/aigolden.test.ts`, campaign, save, loadout and equipment suites were not edited.
- [ ] **Step 2: Browser check** with `preview_start` on `laser-tribute-dev`: start a CALM story, open the base, research the shotgun, hire a soldier, train one, wait 3 days, attack with a loaned mercenary in the squad, win or lose; check the hub, each panel and the squad step at 480x400 and at phone-landscape; screenshot the hub and the squad step; fix any overlap before continuing.
- [ ] **Step 3: Update** the README and the spec status line; run `trail build`.
- [ ] **Step 4: Commit** `docs: story mode base` and open the PR from `feature/story-base` only when Rui asks.
