# Research Upgrade Info Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping the name of a Lab upgrade row (the 13 base-level nodes) opens an info card with what the upgrade does, its cost, days, prerequisite and status.

**Architecture:** Add a `{ kind: 'node'; id: string }` variant to `ItemRef`, so `itemCard`, `panelItem`, `panelHit` and the app's existing `cardItem` modal work unchanged. `ALL_ITEMS` stays the 13 gear items.

**Tech Stack:** TypeScript strict, Vitest, Canvas 2D (menu space 480x400, 5x7 uppercase font).

**Spec:** `docs/superpowers/specs/2026-11-24-laser-tribute-research-info-design.md`

## Global Constraints

- Tutorial and Campaign unchanged; pure `src/core` stays free of screen/DOM imports.
- Every number comes from `NODES`, `BASE_RULES`, `levelsOf`, `researchDays`, never a literal.
- Card row labels at most 10 chars, values at most 22, only characters the font supports (`unsupportedChars(...)` is empty), goodFor has no digits, 2 to 12 rows.
- Run the whole suite and `npx tsc --noEmit` before each commit; `trail check` before pushing.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Training III shows cap 9 (Captain) and Barracks III shows 12 beds in total: top levels read from the tables.
- Lab page 2 upgrade rows (absolute index 9 and up) open the right node's card.
- The node being researched says IN PROGRESS; a researched node says RESEARCHED; a node whose prerequisite is missing says LOCKED and names the prerequisite in NEEDS.
- DAYS follows the labs level (Labs I shortens a node's days).
- Double-clicking BACK on an upgrade card does not press ACT or BACK on the Lab (the lock on close exists; pin it for an upgrade row).
- `itemCard` for a node with no world (`null`) does not crash and shows no STATUS row.

---

### Task 1: nodeCard in core

**Files:**
- Modify: `src/core/world/iteminfo.ts`
- Test: `tests/researchinfo.test.ts` (create)

**Interfaces:**
- Consumes: `NODES`, `BASE_RULES`, `levelsOf`, `researchDays`, `nodeById` from `./base`; `rankFor(kills: number): Rank` from `src/core/ranks.ts` (`.name`); `World.research: { done: string[]; active: { node: string; daysLeft: number } | null }`.
- Produces: `ItemRef` gains `{ kind: 'node'; id: string }`; `nodeCard(nodeId: string, w: World | null): ItemCard | null` (null for gear nodes and unknown ids); `itemCard(ref, w)` returns `nodeCard(ref.id, w)` for `kind: 'node'` (a null result for a node ref is a programming error: throw).

- [ ] **Step 1: Write the failing tests** in `tests/researchinfo.test.ts`, with helpers `fresh = () => newWorld(1, 'calm')` and `withResearch(done, active = null)`:
  - `nodeCard` is non-null for exactly the 13 non-gear node ids and null for `shotgun`, `scope` and `'nope'`.
  - `nodeCard('beds2')!.title === 'BARRACKS II'`.
  - EFFECT values: `beds1` `+2 BEDS (TOTAL 8)`, `beds3` `+2 BEDS (TOTAL 12)`; `labs1` `RESEARCH 75% OF DAYS`, `labs2` `RESEARCH 50% OF DAYS`; `contracts2` `+1 CREDIT/DAY/REGION`; `hospital1` `25% SECOND CHANCE`, `hospital2` `50% SECOND CHANCE`; `training3` `CAP 9 (CAPTAIN)`, `training1` `CAP 2 (<rank name uppercased>)` from `rankFor(BASE_RULES.trainCaps[0])`. Also loop over all 13 and compare against a string built from the tables.
  - COST equals `node.cost`; DAYS equals `researchDays(node, done)` for `done = []` and `['labs1']`; the NEEDS row is absent for level I nodes and is the prerequisite's name uppercased otherwise (`beds2` -> `BARRACKS I`).
  - STATUS with a world: `AVAILABLE` for `beds1`; `RESEARCHED` when done includes it; `IN PROGRESS` when `research.active.node` is it; `LOCKED` for `beds2` on a fresh world. No STATUS row when `w` is null.
  - Every card passes the card contract (2 to 12 rows, label <= 10, value <= 22, `unsupportedChars` empty, goodFor non-empty with no digits), with and without a world.
  - `itemCard({ kind: 'node', id: 'beds1' }, w)` equals `nodeCard('beds1', w)`; `ALL_ITEMS` still has length 13.
- [ ] **Step 2: Run** `npx vitest run tests/researchinfo.test.ts`. Expected: FAIL (`nodeCard` not exported).
- [ ] **Step 3: Implement** `nodeCard` and the `itemCard` branch in `src/core/world/iteminfo.ts`. Rows in order: `EFFECT`, `COST`, `DAYS`, `NEEDS` (only when the node has `needs`), `STATUS` (only with a world). A node's track is the one key set in `gives` (beds, labs, contracts, hospital, training) and its level is that value. Effects: beds total is `BASE_RULES.startBeds + BASE_RULES.bedsPerLevel * level`; labs uses `labFactor[level]`; hospital uses `hospitalChance[level]`; training cap is `trainCaps[level - 1]` with the rank name. goodFor per track (no digits): beds "More beds let you keep more soldiers on the roster."; labs "Research finishes sooner, so new gear arrives earlier."; contracts "More credits every day from the regions you hold."; hospital "A better chance to save a soldier who falls in a won fight."; training "Raises how far a soldier can be trained between fights." Keep the gear helpers (`gearKind`, `idOf`) typed to gear refs only. `npx tsc --noEmit` must pass; give any other `switch` over `ItemRef` the minimal `node` case.
- [ ] **Step 4: Run** `npx vitest run tests/researchinfo.test.ts tests/iteminfo.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** "feat: research upgrade cards in core" (files `src/core/world/iteminfo.ts tests/researchinfo.test.ts`).

### Task 2: Lab rows and app wiring

**Files:**
- Modify: `src/screens/basepanels.ts` (`panelItem`); `src/app.ts` only if tsc requires it
- Modify tests: `tests/iteminfohits.test.ts`, and `tests/iteminfoapp.test.ts` / `tests/baseinfohits.test.ts` if they fail
- Test: `tests/researchinfoapp.test.ts` (create; reuse the `priv()` helper pattern of `tests/iteminfoapp.test.ts`)

**Interfaces:**
- Consumes: `ItemRef` node variant, `itemOfNode`, `NODES`.
- Produces: `panelItem('lab', i)` is `itemOfNode(id)` for gear nodes and `{ kind: 'node', id }` for upgrade nodes (null past the end); `panelHit('lab', ...)` returns `{ kind: 'name' }` for the name area of every Lab row. Market is unchanged.

- [ ] **Step 1: Update and add tests (red).** In `tests/iteminfohits.test.ts`: `panelItem('lab', 9)` equals `{ kind: 'node', id: 'beds1' }`; every `NODES[i]` gives a non-null `panelItem('lab', i)`; "never gives a name hit to a Lab upgrade row" becomes "gives a name hit to a Lab upgrade row" (`{ kind: 'name', index: 9 }` in the name area, `{ kind: 'row', index: 9 }` right of it); the second-page test expects `name` for every row. In `tests/researchinfoapp.test.ts`: clicking the name of the `beds1` Lab row sets `cardItem` to the node ref and the card draws the title `BARRACKS I`; a click, BACK, Enter or Escape closes it with credits unchanged and no research started; a double-click on BACK neither starts research nor leaves the Lab (model it on the existing Lab double-click test); a click right of the name still selects the row.
- [ ] **Step 2: Run** the three test files. Expected: FAIL on the changed expectations.
- [ ] **Step 3: Implement** the `lab` branch of `panelItem` as `itemOfNode(node.id) ?? { kind: 'node', id: node.id }`. Then `npx tsc --noEmit`; the app already holds any `ItemRef` in `cardItem` and draws `itemCard(this.cardItem, w)`, so only type fixes are expected there.
- [ ] **Step 4: Run the whole suite** (`npx vitest run`) and `npx tsc --noEmit`. Expected: all green.
- [ ] **Step 5: Verify in the browser pane:** start the dev server from `.claude/launch.json`, open Story, go to the Lab, tap a Barracks name and a Training name on page 2; confirm the text fits the box, BACK closes it, and the console has no errors.
- [ ] **Step 6: Commit** "feat: Lab upgrade rows open an info card" (all touched files).
