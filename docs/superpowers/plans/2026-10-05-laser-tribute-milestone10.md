# Laser Tribute Milestone 10: Enemy Door-Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enemies hunting a visible soldier or the squad's last-known position open closed doors on their route (2 AP each), but only when the route is at most 12 tiles long.

**Architecture:** Route planning gains an `openDoors` mode (a `doorsOpen` flag on `stepBlockedReason` plus a door cost in `findPath`). The AI plans hunting goals in that mode and turns a closed door on the route into an `OpenDoor` command; patrol goals keep door-blind planning. No UI, audio or map change: enemy `doorChanged` events already flow through the controller.

**Tech Stack:** TypeScript, Vitest (node), pure `src/core`.

**Spec:** `docs/superpowers/specs/2026-10-05-laser-tribute-milestone10-design.md`

## Global Constraints

- `src/core` stays pure and deterministic: no randomness in door decisions.
- `CONFIG.doorCost` = 2 AP, `CONFIG.moveCost` = 4 AP (existing). New constant `CONFIG.huntRadius = 12`.
- Real movement (`Move`, player pathing) never opens doors and keeps today's rules; only the AI's hunting plans pass `openDoors`.
- Patrolling and idle enemies never open doors; enemies never close doors.
- A route that crosses a closed door and is longer than `huntRadius` tiles gives no step; routes without a closed door are not limited.
- The AI must not pathfind for enemies that cannot afford any step (existing test `does not pathfind for enemies that cannot afford a step` must keep passing).
- Test files: append to `tests/path.test.ts` and `tests/ai.test.ts` (never overwrite); `tests/aidoors.test.ts` and `tests/missiondoors.test.ts` are new (check the names are free with `ls tests`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- An enemy with 2 or 3 AP next to a door can open it (but cannot move); with 1 AP it ends its turn cleanly; no infinite command loop in `runEnemyTurn`.
- A unit standing in a doorway: no route is planned through it and the turn still ends.
- A route through an already open door is not limited by the radius and issues plain moves.
- Patrol enemies and enemies far from the squad stay behind their doors (Warehouse and Compound rooms).
- The existing test `falls back to patrol when the last seen position is unreachable` used a closed door as the "unreachable" case; it must now use a wall, or it silently tests the wrong thing.

## File Structure

- Modify `src/core/movement.ts` (`doorsOpen` parameter), `src/core/path.ts` (`openDoors` option), `src/core/config.ts` (`huntRadius`), `src/core/ai.ts` (hunting through doors).
- Tests: append to `tests/path.test.ts`, `tests/ai.test.ts`; create `tests/aidoors.test.ts`, `tests/missiondoors.test.ts`.

---

### Task 1: Planning through closed doors

**Files:**
- Modify: `src/core/movement.ts`, `src/core/path.ts`
- Test: append to `tests/path.test.ts`

**Interfaces:**
- Consumes: `isBlocking`, `tileAt` (`geometry.ts`), `CONFIG.doorCost`.
- Produces:
  - `stepBlockedReason(s, from, to, ignoreUnits = false, doorsOpen = false): string | null`
  - `PathOptions.openDoors?: boolean` on `findPath`

- [ ] **Step 1: Write the failing tests**

Append to `tests/path.test.ts` (add `stepBlockedReason` import from `'../src/core/movement'` and `unit` from `'./helpers'` to the existing imports):

```ts
describe('findPath through closed doors', () => {
  it('treats a closed door as a wall by default and as passable with openDoors', () => {
    const s = makeState(corridorRows('P.+.E')); // P x1, door x3, goal x4
    expect(findPath(s, 'p1', { x: 4, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 4, y: 1 }, { openDoors: true })).toEqual([
      { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 },
    ]);
  });

  it('still refuses walls, and a doorway with a unit in it', () => {
    const wall = makeState(corridorRows('P.#.E'));
    expect(findPath(wall, 'p1', { x: 4, y: 1 }, { openDoors: true })).toBeNull();
    const blocked = makeState(corridorRows('P.+.E'));
    unit(blocked, 'e1').pos = { x: 3, y: 1 };
    expect(findPath(blocked, 'p1', { x: 4, y: 1 }, { openDoors: true })).toBeNull();
  });

  it('charges extra for a closed door, so an open way of the same length wins', () => {
    const rows = ['#######', '#..+..#', '#P.#.E#', '#..+..#', '#######'];
    const through = (s: ReturnType<typeof makeState>) =>
      findPath(s, 'p1', { x: 5, y: 2 }, { openDoors: true })!.map((p) => `${p.x},${p.y}`);
    const openLower = makeState(rows);
    openLower.tiles[3][3].open = true;
    expect(through(openLower)).toContain('3,3');
    expect(through(openLower)).not.toContain('3,1');
    const openUpper = makeState(rows);
    openUpper.tiles[1][3].open = true;
    expect(through(openUpper)).toContain('3,1');
    expect(through(openUpper)).not.toContain('3,3');
  });
});

describe('stepBlockedReason with doorsOpen', () => {
  it('only the closed-door check is skipped', () => {
    const s = makeState(corridorRows('P.+.E'));
    expect(stepBlockedReason(s, { x: 2, y: 1 }, { x: 3, y: 1 })).toBe('The door is closed');
    expect(stepBlockedReason(s, { x: 2, y: 1 }, { x: 3, y: 1 }, false, true)).toBeNull();
    const wall = makeState(corridorRows('P.#.E'));
    expect(stepBlockedReason(wall, { x: 2, y: 1 }, { x: 3, y: 1 }, false, true)).toBe('A wall blocks the way');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/path.test.ts`
Expected: FAIL (the `openDoors` tests return null; `doorsOpen` is ignored).

- [ ] **Step 3: Implement**

`src/core/movement.ts`: add a fifth parameter `doorsOpen = false` to `stepBlockedReason` and change the door line to:

```ts
  if (tile.kind === 'door' && !tile.open && !doorsOpen) return 'The door is closed';
```

`src/core/path.ts`: import `CONFIG` from `./config` and `tileAt` from `./geometry`; add to `PathOptions`:

```ts
  /** Plan as if closed doors could be opened on the way (each costs the door action); real moves never do this. */
  openDoors?: boolean;
```

In the neighbour loop replace the blocked check and cost lines with:

```ts
      if (stepBlockedReason(s, cur, next, ignoreUnits, !!opts.openDoors) !== null) continue;
      const nk = key(next);
      const nextTile = tileAt(s, next);
      const doorExtra = opts.openDoors && nextTile.kind === 'door' && !nextTile.open ? CONFIG.doorCost : 0;
      const nd = dist.get(ck)! + stepCost(cur, next) + doorExtra;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/path.test.ts`
Expected: PASS (new and existing path tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/movement.ts src/core/path.ts tests/path.test.ts
git commit -m "feat(core): plan routes through closed doors"
```

---

### Task 2: Enemies hunt through doors

**Files:**
- Modify: `src/core/config.ts`, `src/core/ai.ts`
- Test: create `tests/aidoors.test.ts`; modify one existing test in `tests/ai.test.ts`

**Interfaces:**
- Consumes: `findPath(..., { openDoors })` (Task 1), `tileAt` (`geometry.ts`), `CONFIG`.
- Produces: `CONFIG.huntRadius = 12`; AI candidates may now be `{ type: 'OpenDoor', unitId, at }`.

- [ ] **Step 1: Fix the existing test whose meaning changes, and write the new tests**

In `tests/ai.test.ts` change the test `falls back to patrol when the last seen position is unreachable` so the obstacle is a wall (a closed door is now reachable):

```ts
  it('falls back to patrol when the last seen position is unreachable', () => {
    const s = enemyTurn(corridorRows('E...#.P')); // a wall between e1 and the memory
```

(the rest of that test is unchanged.)

Create `tests/aidoors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { CONFIG } from '../src/core/config';
import { corridorRows, makeState, ok, unit } from './helpers';

function enemyTurn(rows: string[]) {
  const s = makeState(rows);
  s.turn = 'enemy';
  return s;
}

describe('enemies hunting through doors', () => {
  it('walks to the door, opens it for 2 AP, then goes through', () => {
    const s = enemyTurn(corridorRows('E...+.P')); // door at x5
    s.enemyMemory = { x: 6, y: 1 };
    let state = s;
    for (let i = 0; i < 3; i++) {
      const cmd = aiNextCommand(state);
      expect(cmd).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2 + i, y: 1 } });
      state = ok(applyCommand(state, cmd)).state;
    }
    const before = unit(state, 'e1').ap;
    const open = aiNextCommand(state);
    expect(open).toEqual({ type: 'OpenDoor', unitId: 'e1', at: { x: 5, y: 1 } });
    const r = ok(applyCommand(state, open));
    expect(r.events).toContainEqual({ type: 'doorChanged', at: { x: 5, y: 1 }, open: true });
    expect(unit(r.state, 'e1').ap).toBe(before - CONFIG.doorCost);
    expect(aiNextCommand(r.state)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 5, y: 1 } });
  });

  it('hunts a route of exactly 12 tiles through a door, but not one of 13', () => {
    const near = enemyTurn(corridorRows('E.....+......P')); // P at x13: 12 steps
    near.enemyMemory = { x: 13, y: 1 };
    expect(aiNextCommand(near)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
    const far = enemyTurn(corridorRows('E.....+.......P')); // P at x14: 13 steps
    far.enemyMemory = { x: 14, y: 1 };
    expect(aiNextCommand(far)).toEqual({ type: 'EndTurn' });
  });

  it('is not limited on a route with no closed door', () => {
    const s = enemyTurn(corridorRows('E' + '.'.repeat(17) + 'P'));
    s.enemyMemory = { x: 18, y: 1 };
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('walks through a door that is already open, with no limit', () => {
    const s = enemyTurn(corridorRows('E' + '.'.repeat(5) + '+' + '.'.repeat(9) + 'P'));
    s.tiles[1][7].open = true;
    s.enemyMemory = { x: 16, y: 1 };
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('a patrolling enemy with no memory never opens a door', () => {
    const s = enemyTurn(corridorRows('E...+.P'));
    unit(s, 'e1').patrol = [{ x: 6, y: 1 }, { x: 1, y: 1 }];
    expect(aiNextCommand(s)).toEqual({ type: 'EndTurn' });
    expect(runEnemyTurn(s).events.some((e) => e.type === 'doorChanged')).toBe(false);
  });

  it('with 2 AP next to the door it can open it; with 1 AP it ends the turn', () => {
    const rows = corridorRows('E+..P');
    const two = enemyTurn(rows);
    two.enemyMemory = { x: 4, y: 1 };
    unit(two, 'e1').ap = 2;
    expect(aiNextCommand(two)).toEqual({ type: 'OpenDoor', unitId: 'e1', at: { x: 2, y: 1 } });
    const one = enemyTurn(rows);
    one.enemyMemory = { x: 4, y: 1 };
    unit(one, 'e1').ap = 1;
    expect(aiNextCommand(one)).toEqual({ type: 'EndTurn' });
  });

  it('with 3 AP next to the door it opens it but cannot step yet', () => {
    const s = enemyTurn(corridorRows('E+..P'));
    s.enemyMemory = { x: 4, y: 1 };
    unit(s, 'e1').ap = 3;
    const after = ok(applyCommand(s, aiNextCommand(s))).state;
    expect(unit(after, 'e1').ap).toBe(1);
    expect(aiNextCommand(after)).toEqual({ type: 'EndTurn' });
  });

  it('a unit in the doorway: no open command, and the enemy turn still ends', () => {
    const s = enemyTurn(corridorRows('E+..P'));
    s.units.push({ ...unit(s, 'e1'), id: 'e2', pos: { x: 2, y: 1 } });
    s.enemyMemory = { x: 4, y: 1 };
    const r = runEnemyTurn(s);
    expect(r.state.turn).toBe('player');
  });

  it('never closes a door', () => {
    const s = enemyTurn(corridorRows('E...+.P'));
    s.tiles[1][5].open = true;
    s.enemyMemory = { x: 6, y: 1 };
    const events = runEnemyTurn(s).events;
    expect(events.filter((e) => e.type === 'doorChanged')).toEqual([]);
  });

  it('a whole enemy turn: the enemy opens the door and ends up on the far side', () => {
    const s = enemyTurn(corridorRows('E...+..P'));
    s.enemyMemory = { x: 6, y: 1 };
    const r = runEnemyTurn(s);
    expect(r.events.filter((e) => e.type === 'doorChanged')).toHaveLength(1);
    expect(unit(r.state, 'e1').pos.x).toBeGreaterThanOrEqual(5);
  });
});
```

Notes for the executor: `corridorRows` puts the first character at x = 1. `'E...+.P'` gives E x1, door x5, P x7; `'E.....+......P'` gives door x7 and P x13 (12 steps); `'E.....+.......P'` gives P x14 (13 steps). In the "unit in the doorway" test the pushed enemy copies `e1` (check it has all required `Unit` fields); if the copy is rejected by the type checker, build it with the same fields `makeState` uses. If any expected step coordinate differs by one because of how a route is counted, fix the test to match the spec's rule ("at most 12 tiles, each door tile counting as one") and ledger it as a Ruling.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/aidoors.test.ts tests/ai.test.ts`
Expected: the new door tests FAIL (the AI returns `EndTurn` or a plain `Move`); the modified wall test passes.

- [ ] **Step 3: Implement**

`src/core/config.ts`: add `huntRadius: 12,` after `doorCost: 2,`.

`src/core/ai.ts`: import `tileAt` with the other geometry imports; replace `firstStep` with:

```ts
/**
 * The next command on the way to `goal`, or null. A hunting goal plans through closed doors: when the
 * next tile is one it returns OpenDoor (the enemy is adjacent to it), and a route that crosses a closed
 * door and is longer than the hunt radius gives no step, so enemies far from the squad stay put.
 */
function stepToward(s: GameState, unit: Unit, goal: Pos, hunting: boolean): Command | null {
  const path = findPath(s, unit.id, goal, { ignoreOccupantAtGoal: true, openDoors: hunting });
  if (!path || path.length === 0) return null;
  const next = path[0];
  if (hunting) {
    const closed = (p: Pos) => {
      const t = tileAt(s, p);
      return t.kind === 'door' && !t.open;
    };
    if (path.length > CONFIG.huntRadius && path.some(closed)) return null;
    if (closed(next)) {
      return unit.ap >= CONFIG.doorCost ? { type: 'OpenDoor', unitId: unit.id, at: { ...next } } : null;
    }
  }
  return unit.ap >= CONFIG.moveCost ? { type: 'Move', unitId: unit.id, to: next } : null;
}
```

In `candidates`, replace the two lines in the target branch

```ts
    const step = unit.ap >= CONFIG.moveCost ? firstStep(s, unit, target.pos) : null;
    if (step) out.push({ type: 'Move', unitId: unit.id, to: step });
```

with

```ts
    const step = unit.ap >= CONFIG.doorCost ? stepToward(s, unit, target.pos, true) : null;
    if (step) out.push(step);
```

and replace everything from `if (unit.ap < CONFIG.moveCost) return out;` to the end of the function (the patrol and memory loop) with:

```ts
  const patrolGoal = unit.patrol.length > 0 ? unit.patrol[unit.patrolIndex] : null;
  const goals: [Pos | null, boolean][] = [[s.enemyMemory, true], [patrolGoal, false]];
  for (const [goal, hunting] of goals) {
    if (!goal || posEq(unit.pos, goal)) continue;
    // a patrol step needs a move; a hunting goal may only need to open a door
    if (unit.ap < (hunting ? CONFIG.doorCost : CONFIG.moveCost)) continue;
    const step = stepToward(s, unit, goal, hunting);
    if (step) {
      out.push(step);
      break;
    }
  }
  return out;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/aidoors.test.ts tests/ai.test.ts`
Expected: PASS, including `does not pathfind for enemies that cannot afford a step`.

- [ ] **Step 5: Whole suite and commit**

Run: `npx vitest run; npx tsc --noEmit`
Expected: all tests pass; typecheck clean. Fix any other test that relied on enemies not opening doors (read the failure; a test whose scenario now legitimately differs gets a ledgered Ruling and a wall in place of the closed door, as above).

```bash
git add src/core/config.ts src/core/ai.ts tests/aidoors.test.ts tests/ai.test.ts
git commit -m "feat(core): hunting enemies open doors within 12 tiles"
```

---

### Task 3: Mission-level check and a look in the browser

**Files:**
- Test: create `tests/missiondoors.test.ts`

**Interfaces:**
- Consumes: `createMission`, `MISSIONS` (`src/core/missions.ts`), `applyCommand`, `runEnemyTurn`.

- [ ] **Step 1: Write the test**

Create `tests/missiondoors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { MISSIONS, createMission } from '../src/core/missions';
import { ok, unit } from './helpers';

describe('Warehouse: doors and the hunt radius', () => {
  it('the nearby room opens its door and comes out; the far room stays shut', () => {
    const start = createMission(MISSIONS[1], 1);
    const enemyTurn = ok(applyCommand(start, { type: 'EndTurn' })).state;
    enemyTurn.enemyMemory = { x: 6, y: 7 }; // the corridor below the first room
    const r = runEnemyTurn(enemyTurn);
    const tile = (x: number, y: number) => r.state.tiles[y][x];
    expect(tile(12, 5).open).toBe(true); // e1's room door
    expect(unit(r.state, 'e1').pos.y).toBeGreaterThanOrEqual(5);
    expect(tile(22, 5).open).toBe(false); // e2's room: route longer than 12
    expect(tile(17, 3).open).toBe(false);
  });

  it('with nothing known, no door opens on any mission', () => {
    for (const def of MISSIONS) {
      const start = createMission(def, 1);
      const enemyTurn = ok(applyCommand(start, { type: 'EndTurn' })).state;
      const r = runEnemyTurn(enemyTurn);
      expect(r.events.some((e) => e.type === 'doorChanged'), def.name).toBe(false);
    }
  });
});
```

If the first test's coordinates are off (e.g. route lengths differ from the estimate), print the two routes with `findPath(..., { openDoors: true })` from `e1` and `e2` to the memory tile, keep the memory tile where e1's route is <= 12 and e2's is > 12 (try `{ x: 6, y: 7 }` first), and ledger the adjustment as a Ruling.

- [ ] **Step 2: Run, then fix the scenario if needed**

Run: `npx vitest run tests/missiondoors.test.ts`
Expected: PASS. (These cases pass only because Tasks 1 and 2 exist; to prove the test can fail, temporarily set `huntRadius` to 99 and confirm the first test fails on the `(22, 5)` assertion, then restore 12.)

- [ ] **Step 3: Whole suite, typecheck, build, commit**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: all pass, clean.

```bash
git add tests/missiondoors.test.ts
git commit -m "test: Warehouse door hunt and the radius"
```

- [ ] **Step 4: Look at it in the Browser pane**

`preview_start` the `laser-tribute-dev` server. In the page (dev hook `window.app`): press Enter to start Mission 1, or set `app.campaign.missionIndex = 1` first to play Warehouse. In the console set `app.controller.state.enemyMemory = { x: 6, y: 7 }` and end the turn with `app.controller.key('e')`; wait for the enemy phase. Expected: the door at (12, 5) is open afterwards (`app.controller.state.tiles[5][12].open === true`), no console errors, and (when the door is in view) the door sound plays and the door is drawn open. Reset the viewport if resized, stop the server.

- [ ] **Step 5: Commit any fix** found in the browser (test first); otherwise nothing to commit.
