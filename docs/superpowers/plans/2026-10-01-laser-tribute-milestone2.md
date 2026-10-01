# Laser Tribute Milestone 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-mission equipment screen (per-soldier loadouts from one shared budget) and a mission-end result screen with "Play again", so the game has a complete flow: Equipment, Mission, Result, back to Equipment.

**Architecture:** Two new pure `core` modules (`loadout`, `result`) hold the rules and are unit-tested. Two canvas screens (`screens/equipment`, `screens/result`) each expose pure model and hit-testing functions plus a draw function. A new `App` class owns the current screen, creates a fresh mission per run, and routes all input to the visible screen. The milestone 1 mission `Controller` is reused unchanged.

**Tech Stack:** TypeScript (strict), HTML5 Canvas 2D, Vite, Vitest. Node 18 or newer. Existing project in `C:\claude\laser-tribute`.

**Spec:** `docs/superpowers/specs/2026-10-01-laser-tribute-milestone2-design.md` (builds on `2026-10-01-laser-tribute-milestone1-design.md`)

## Global Constraints

- `core/` must not import anything from `render/`, `input/`, `screens/`, `controller.ts`, `app.ts` or the DOM.
- Loadout budget 120 credits; prices pistol 10, rifle 25, grenade 8; each soldier has exactly one weapon (pistol or rifle) and 0 to 3 grenades; squad size 4.
- Default loadout: p1 and p2 rifle, p3 and p4 pistol, one grenade each (cost 102).
- An invalid loadout can never start a mission (Start disabled in the UI, and `applyLoadout` throws).
- Screens: Equipment (first), Mission, Result. Mission end to Result switch waits about 1 second (`RESULT_DELAY_MS = 1000`) and until the mission controller is idle (`ui.busy` false).
- Each mission starts from fresh state with a new random seed chosen outside `core`.
- Input reaches only the visible screen.
- Milestone 1 mission behaviour and rules are unchanged; all existing tests keep passing.
- Logical canvas stays 480x360, 16px tiles, existing palette, 8px monospace font.
- Git commit after every task, on branch `milestone-2`. End every commit message with the `Co-Authored-By` trailer given in the session's attribution reminder.
- Do not push to GitHub without asking the user first. Remote: `https://github.com/iurdivad-netizen/laser-tribute`.
- Out of scope: persistent squad, new item types, soldier names or stats, multiple missions, saving, sound, title screen.

### Decisions this plan makes where the spec left room

- Equipment screen geometry: soldier rows start at y = 56 with a 52px step; weapon button x = 60 (90 wide), grenade minus x = 250, plus x = 310 (24 wide each), buttons 24 high; Start button at x = 170, y = 300, 140 by 30. Result card x = 110, y = 70, 260 by 180 with the Play again button at x = 190, y = 200, 100 by 26.
- The Result screen draws the final map under a dimmed overlay, so the player sees how the mission ended.
- `App` takes optional injected `newSeed` and `createMission` functions so the screen flow is testable with tiny maps. The `now` timestamp for the end-of-mission delay is passed into `App.update(now)` (the render loop's timestamp), so tests need no fake timers.
- Block reasons are short strings shown as hover hints: `Need N more credits`, `Max 3 grenades`, `No grenades to remove`.

## Review Focus

Inputs and failure modes the spec implies that the happy-path tests do not exercise, most likely to bite first. Each has a test in the task that owns the code.

1. The mission ends while the controller is still busy (an enemy turn or a multi-step move still running): the switch to Result must wait until it is idle (Task 5).
2. Playing again twice in a row: every run starts with fresh units and a new seed, nothing from the previous run leaks (Task 5).
3. Keys and clicks on a screen that is not showing, for example Space or a map click while the Result screen is up, must do nothing to the hidden mission (Task 5).
4. Invalid loadouts: wrong squad size, a fractional or NaN grenade count, a grenade count outside 0 to 3, or a total over budget must never start a mission (Tasks 1 and 3).
5. A lost mission (all soldiers dead) flows through the same Result and Play again path and reports "FAILED" (Tasks 2 and 5).

## File Structure

```
src/
  app.ts                       NEW  screen switcher, mission factory, input routing
  main.ts                      MODIFY  create App, forward frames to it
  core/
    loadout.ts                 NEW  prices, budget, validation, applying a loadout
    result.ts                  NEW  summarize() a finished GameState
    mission1.ts                MODIFY  createMission1(seed, loadout?)
  screens/
    equipment.ts               NEW  equipment model functions, hit testing, drawing
    result.ts                  NEW  result card hit testing and drawing
  input/input.ts               MODIFY  forward logical-pixel events to App
tests/
  loadout.test.ts, result.test.ts, equipment.test.ts,
  resultscreen.test.ts, app.test.ts     NEW
  mission1.test.ts             unchanged (still passes)
README.md                      MODIFY  describe the new screens
```

---

### Task 1: Loadout rules (core)

**Files:**
- Create: `src/core/loadout.ts`
- Modify: `src/core/mission1.ts` (optional `loadout` parameter)
- Test: `tests/loadout.test.ts`

**Interfaces:**
- Consumes: `GameState`, `WeaponId` (types); `createMission1`.
- Produces:
  - `LOADOUT = { budget: 120, prices: { pistol: 10, rifle: 25, grenade: 8 }, maxGrenades: 3 }`
  - `SQUAD_SIZE = 4`
  - `interface SoldierLoadout { weapon: WeaponId; grenades: number }`, `type Loadout = SoldierLoadout[]`
  - `defaultLoadout(): Loadout`
  - `soldierCost(s: SoldierLoadout): number`, `loadoutCost(l: Loadout): number`
  - `validateLoadout(l: Loadout): string | null` (null means valid, otherwise the reason)
  - `applyLoadout(state: GameState, l: Loadout): GameState` (returns a new state; throws on an invalid loadout or when the squad size does not match; never mutates the input)
  - `createMission1(seed?: number, loadout?: Loadout): GameState`

- [ ] **Step 1: Write the failing tests**

`tests/loadout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyLoadout, defaultLoadout, loadoutCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { createMission1 } from '../src/core/mission1';
import { corridorRows, makeState, unit } from './helpers';

const four = (weapon: 'pistol' | 'rifle', grenades: number): Loadout =>
  Array.from({ length: 4 }, () => ({ weapon, grenades }));

describe('loadout cost and validity', () => {
  it("default loadout is milestone 1's kit: costs 102 and is valid", () => {
    const l = defaultLoadout();
    expect(l.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
    expect(l.map((s) => s.grenades)).toEqual([1, 1, 1, 1]);
    expect(loadoutCost(l)).toBe(102);
    expect(validateLoadout(l)).toBeNull();
  });

  it('four rifles cost 100, leaving only 20 credits', () => {
    expect(loadoutCost(four('rifle', 0))).toBe(100);
    expect(validateLoadout(four('rifle', 2))).toBeNull(); // 116
  });

  it('accepts a loadout that spends exactly the budget', () => {
    const l: Loadout = [
      { weapon: 'pistol', grenades: 3 },
      { weapon: 'pistol', grenades: 3 },
      { weapon: 'pistol', grenades: 3 },
      { weapon: 'pistol', grenades: 1 },
    ];
    expect(loadoutCost(l)).toBe(120);
    expect(validateLoadout(l)).toBeNull();
  });

  it('rejects a loadout over budget', () => {
    const l = four('rifle', 0);
    l[0].grenades = 3; // 124
    expect(validateLoadout(l)).toMatch(/budget/);
    expect(validateLoadout(four('rifle', 3))).toMatch(/budget/);
  });

  it('rejects the wrong squad size', () => {
    expect(validateLoadout(four('pistol', 0).slice(0, 3))).toMatch(/exactly 4/);
  });

  it('rejects a missing or unknown weapon', () => {
    const l = four('pistol', 0);
    (l[1] as { weapon: string }).weapon = 'grenade';
    expect(validateLoadout(l)).toMatch(/Soldier 2 needs a weapon/);
  });

  it('rejects grenade counts below 0, above 3, fractional or NaN', () => {
    for (const bad of [-1, 4, 1.5, NaN]) {
      const l = four('pistol', 0);
      l[2].grenades = bad;
      expect(validateLoadout(l)).toMatch(/grenades/);
    }
  });
});

describe('applyLoadout', () => {
  const custom: Loadout = [
    { weapon: 'rifle', grenades: 0 },
    { weapon: 'pistol', grenades: 2 },
    { weapon: 'rifle', grenades: 1 },
    { weapon: 'pistol', grenades: 3 },
  ]; // cost 118

  it('sets weapon and grenades on the right soldiers without touching the input', () => {
    const s = createMission1();
    const next = applyLoadout(s, custom);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).weapon)).toEqual([
      'rifle', 'pistol', 'rifle', 'pistol',
    ]);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).grenades)).toEqual([0, 2, 1, 3]);
    expect(unit(s, 'p3').weapon).toBe('pistol'); // original untouched
    expect(unit(s, 'p1').grenades).toBe(1);
  });

  it('throws on an invalid loadout', () => {
    expect(() => applyLoadout(createMission1(), four('rifle', 3))).toThrow(/budget/);
  });

  it('throws when the squad size does not match the loadout', () => {
    const tiny = makeState(corridorRows('P..E')); // one soldier
    expect(() => applyLoadout(tiny, defaultLoadout())).toThrow(/squad/);
  });
});

describe('createMission1 with a loadout', () => {
  it('uses the loadout and the seed', () => {
    const s = createMission1(5, [
      { weapon: 'rifle', grenades: 0 },
      { weapon: 'pistol', grenades: 2 },
      { weapon: 'rifle', grenades: 1 },
      { weapon: 'pistol', grenades: 3 },
    ]);
    expect(s.rngState).toBe(5);
    expect(unit(s, 'p2')).toMatchObject({ weapon: 'pistol', grenades: 2 });
    expect(unit(s, 'p4')).toMatchObject({ weapon: 'pistol', grenades: 3 });
  });

  it('is unchanged without a loadout', () => {
    const s = createMission1();
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', grenades: 1 });
    expect(unit(s, 'p3')).toMatchObject({ weapon: 'pistol', grenades: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/loadout.test.ts`
Expected: FAIL with "Cannot find module '../src/core/loadout'".

- [ ] **Step 3: Write the implementation**

`src/core/loadout.ts`:

```ts
import type { GameState, WeaponId } from './types';

export const LOADOUT = {
  budget: 120,
  prices: { pistol: 10, rifle: 25, grenade: 8 },
  maxGrenades: 3,
} as const;

export const SQUAD_SIZE = 4;

export interface SoldierLoadout {
  weapon: WeaponId;
  grenades: number;
}

export type Loadout = SoldierLoadout[];

export function defaultLoadout(): Loadout {
  return [
    { weapon: 'rifle', grenades: 1 },
    { weapon: 'rifle', grenades: 1 },
    { weapon: 'pistol', grenades: 1 },
    { weapon: 'pistol', grenades: 1 },
  ];
}

export function soldierCost(s: SoldierLoadout): number {
  return LOADOUT.prices[s.weapon] + LOADOUT.prices.grenade * s.grenades;
}

export function loadoutCost(l: Loadout): number {
  return l.reduce((sum, s) => sum + soldierCost(s), 0);
}

export function validateLoadout(l: Loadout): string | null {
  if (l.length !== SQUAD_SIZE) return `A loadout needs exactly ${SQUAD_SIZE} soldiers`;
  for (const [i, s] of l.entries()) {
    if (s.weapon !== 'pistol' && s.weapon !== 'rifle') return `Soldier ${i + 1} needs a weapon`;
    if (!Number.isInteger(s.grenades) || s.grenades < 0 || s.grenades > LOADOUT.maxGrenades) {
      return `Soldier ${i + 1} must carry 0 to ${LOADOUT.maxGrenades} grenades`;
    }
  }
  const cost = loadoutCost(l);
  if (cost > LOADOUT.budget) return `Loadout costs ${cost}, budget is ${LOADOUT.budget}`;
  return null;
}

export function applyLoadout(state: GameState, l: Loadout): GameState {
  const error = validateLoadout(l);
  if (error) throw new Error(error);
  const soldiers = state.units.filter((u) => u.side === 'player');
  if (soldiers.length !== l.length) throw new Error('Loadout does not match the squad size');
  const next = structuredClone(state);
  next.units
    .filter((u) => u.side === 'player')
    .forEach((u, i) => {
      u.weapon = l[i].weapon;
      u.grenades = l[i].grenades;
    });
  return next;
}
```

In `src/core/mission1.ts` change the import, signature and body so the file reads:

```ts
import { applyLoadout, type Loadout } from './loadout';
import { parseMap } from './mission';
import type { GameState, Pos } from './types';
import { updateExplored } from './vision';
```

(keep `MISSION1_ROWS` and `PATROLS` exactly as they are) and replace `createMission1` with:

```ts
export function createMission1(seed = 1, loadout?: Loadout): GameState {
  let s = parseMap(MISSION1_ROWS, seed);
  for (const u of s.units) {
    if (PATROLS[u.id]) u.patrol = PATROLS[u.id].map((p) => ({ ...p }));
  }
  if (loadout) s = applyLoadout(s, loadout);
  updateExplored(s);
  return s;
}
```

- [ ] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS (milestone 1 tests included), type check clean. The message check for the wrong squad size is `/exactly 4/` and for the mismatch is `/squad/`; if either regex fails, fix the message in `loadout.ts`, not the test.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): add loadout rules and apply them to Mission 1"
```

---

### Task 2: Mission result summary (core)

**Files:**
- Create: `src/core/result.ts`
- Test: `tests/result.test.ts`

**Interfaces:**
- Consumes: `GameState` (types).
- Produces: `interface MissionResult { won: boolean; survivors: number; squadSize: number; enemiesKilled: number; enemyCount: number; turns: number }` and `summarize(state: GameState): MissionResult`.

- [ ] **Step 1: Write the failing tests**

`tests/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { summarize } from '../src/core/result';
import { makeState, unit } from './helpers';

const rows = ['#######', '#PP..EE#', '#######']; // p1 p2 e1 e2

describe('summarize', () => {
  it('reports a won mission', () => {
    const s = makeState(rows);
    s.status = 'won';
    s.turnNumber = 4;
    unit(s, 'e1').alive = false;
    unit(s, 'e2').alive = false;
    unit(s, 'p2').alive = false;
    expect(summarize(s)).toEqual({
      won: true, survivors: 1, squadSize: 2, enemiesKilled: 2, enemyCount: 2, turns: 4,
    });
  });

  it('reports a lost mission', () => {
    const s = makeState(rows);
    s.status = 'lost';
    unit(s, 'p1').alive = false;
    unit(s, 'p2').alive = false;
    unit(s, 'e1').alive = false;
    expect(summarize(s)).toEqual({
      won: false, survivors: 0, squadSize: 2, enemiesKilled: 1, enemyCount: 2, turns: 1,
    });
  });

  it('is not won while the mission is still being played', () => {
    expect(summarize(makeState(rows)).won).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/result.test.ts`
Expected: FAIL with "Cannot find module '../src/core/result'".

- [ ] **Step 3: Write the implementation**

`src/core/result.ts`:

```ts
import type { GameState } from './types';

export interface MissionResult {
  won: boolean;
  survivors: number;
  squadSize: number;
  enemiesKilled: number;
  enemyCount: number;
  turns: number;
}

export function summarize(state: GameState): MissionResult {
  const players = state.units.filter((u) => u.side === 'player');
  const enemies = state.units.filter((u) => u.side === 'enemy');
  return {
    won: state.status === 'won',
    survivors: players.filter((u) => u.alive).length,
    squadSize: players.length,
    enemiesKilled: enemies.filter((u) => !u.alive).length,
    enemyCount: enemies.length,
    turns: state.turnNumber,
  };
}
```

- [ ] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): add mission result summary"
```

---

### Task 3: Equipment screen (model, hit testing, drawing)

**Files:**
- Create: `src/screens/equipment.ts`
- Test: `tests/equipment.test.ts`

**Interfaces:**
- Consumes: `Loadout`, `LOADOUT`, `SQUAD_SIZE`, `loadoutCost`, `soldierCost`, `validateLoadout`, `WEAPONS`, `VIEW`.
- Produces:
  - `type EquipmentHit = { kind: 'weapon' | 'minus' | 'plus'; index: number } | { kind: 'start' }`
  - `toggleBlockReason(l: Loadout, i: number): string | null`, `toggleWeapon(l: Loadout, i: number): Loadout`
  - `grenadeBlockReason(l: Loadout, i: number, delta: 1 | -1): string | null`, `changeGrenades(l: Loadout, i: number, delta: 1 | -1): Loadout`
  - All change functions return a new array when they change something and return the same array object when the change is blocked. They never mutate the input.
  - `equipmentHit(px: number, py: number): EquipmentHit | null` (logical canvas pixels)
  - `blockReasonFor(l: Loadout, hit: EquipmentHit): string | null`
  - `applyEquipmentHit(l: Loadout, hit: EquipmentHit): Loadout` (start returns `l` unchanged)
  - `drawEquipment(ctx: CanvasRenderingContext2D, l: Loadout, hover: EquipmentHit | null): void`

- [ ] **Step 1: Write the failing tests**

`tests/equipment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import {
  applyEquipmentHit, blockReasonFor, changeGrenades, equipmentHit, grenadeBlockReason,
  toggleBlockReason, toggleWeapon,
} from '../src/screens/equipment';

describe('weapon toggle', () => {
  it('swaps pistol to rifle when there are enough credits', () => {
    const l = toggleWeapon(defaultLoadout(), 2); // +15: 102 -> 117
    expect(l[2].weapon).toBe('rifle');
    expect(loadoutCost(l)).toBe(117);
  });

  it('blocks a swap that would break the budget and returns the same loadout', () => {
    const l = toggleWeapon(defaultLoadout(), 2);
    expect(toggleBlockReason(l, 3)).toBe('Need 12 more credits');
    expect(toggleWeapon(l, 3)).toBe(l);
  });

  it('always allows rifle to pistol and frees credits', () => {
    const l = toggleWeapon(defaultLoadout(), 0);
    expect(l[0].weapon).toBe('pistol');
    expect(loadoutCost(l)).toBe(87);
  });

  it('does not mutate the input', () => {
    const l = defaultLoadout();
    toggleWeapon(l, 2);
    expect(l[2].weapon).toBe('pistol');
  });
});

describe('grenades', () => {
  it('adds grenades up to the cap of 3', () => {
    let l = changeGrenades(defaultLoadout(), 0, 1); // 2 grenades, cost 110
    l = changeGrenades(l, 0, 1); // 3 grenades, cost 118
    expect(l[0].grenades).toBe(3);
    expect(grenadeBlockReason(l, 0, 1)).toBe('Max 3 grenades');
    expect(changeGrenades(l, 0, 1)).toBe(l);
  });

  it('is blocked when the credits run out', () => {
    let l = changeGrenades(defaultLoadout(), 0, 1);
    l = changeGrenades(l, 0, 1); // cost 118
    expect(grenadeBlockReason(l, 1, 1)).toBe('Need 6 more credits');
    expect(changeGrenades(l, 1, 1)).toBe(l);
  });

  it('cannot go below zero', () => {
    const l = changeGrenades(defaultLoadout(), 0, -1);
    expect(l[0].grenades).toBe(0);
    expect(grenadeBlockReason(l, 0, -1)).toBe('No grenades to remove');
    expect(changeGrenades(l, 0, -1)).toBe(l);
  });
});

describe('equipmentHit', () => {
  it('finds the weapon, minus, plus and start buttons', () => {
    expect(equipmentHit(100, 68)).toEqual({ kind: 'weapon', index: 0 });
    expect(equipmentHit(100, 120)).toEqual({ kind: 'weapon', index: 1 });
    expect(equipmentHit(260, 172)).toEqual({ kind: 'minus', index: 2 });
    expect(equipmentHit(320, 224)).toEqual({ kind: 'plus', index: 3 });
    expect(equipmentHit(240, 315)).toEqual({ kind: 'start' });
  });

  it('returns null over empty space', () => {
    expect(equipmentHit(5, 5)).toBeNull();
    expect(equipmentHit(200, 68)).toBeNull();
  });
});

describe('blockReasonFor and applyEquipmentHit', () => {
  it('explains a blocked control and applies an allowed one', () => {
    const l = toggleWeapon(defaultLoadout(), 2);
    expect(blockReasonFor(l, { kind: 'weapon', index: 3 })).toBe('Need 12 more credits');
    expect(blockReasonFor(l, { kind: 'weapon', index: 0 })).toBeNull();
    expect(applyEquipmentHit(l, { kind: 'weapon', index: 3 })).toBe(l);
    expect(applyEquipmentHit(l, { kind: 'minus', index: 0 })[0].grenades).toBe(0);
    expect(blockReasonFor(l, { kind: 'plus', index: 0 })).toBe('Need 5 more credits'); // 117 + 8
    expect(applyEquipmentHit(l, { kind: 'plus', index: 0 })).toBe(l);
    const base = defaultLoadout();
    expect(applyEquipmentHit(base, { kind: 'plus', index: 0 })[0].grenades).toBe(2);
  });

  it('start is allowed for a valid loadout and leaves it unchanged', () => {
    const l = defaultLoadout();
    expect(blockReasonFor(l, { kind: 'start' })).toBeNull();
    expect(applyEquipmentHit(l, { kind: 'start' })).toBe(l);
  });

  it('start is blocked for an invalid loadout', () => {
    const l = defaultLoadout();
    l[0].grenades = 9;
    expect(blockReasonFor(l, { kind: 'start' })).toMatch(/grenades/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/equipment.test.ts`
Expected: FAIL with "Cannot find module '../src/screens/equipment'".

- [ ] **Step 3: Write the implementation**

`src/screens/equipment.ts`:

```ts
import { WEAPONS } from '../core/config';
import {
  LOADOUT, SQUAD_SIZE, loadoutCost, soldierCost, validateLoadout, type Loadout,
} from '../core/loadout';
import type { WeaponId } from '../core/types';
import { VIEW } from '../render/layout';

export type EquipmentHit =
  | { kind: 'weapon' | 'minus' | 'plus'; index: number }
  | { kind: 'start' };

export const EQ = {
  rowTop: 56,
  rowStep: 52,
  btnH: 24,
  weapon: { x: 60, w: 90 },
  minus: { x: 250, w: 24 },
  plus: { x: 310, w: 24 },
  start: { x: 170, y: 300, w: 140, h: 30 },
} as const;

const rowY = (i: number) => EQ.rowTop + i * EQ.rowStep;
const inRect = (px: number, py: number, x: number, y: number, w: number, h: number) =>
  px >= x && px < x + w && py >= y && py < y + h;

function swapped(l: Loadout, i: number): WeaponId {
  return l[i].weapon === 'pistol' ? 'rifle' : 'pistol';
}

export function toggleBlockReason(l: Loadout, i: number): string | null {
  const extra = LOADOUT.prices[swapped(l, i)] - LOADOUT.prices[l[i].weapon];
  const need = loadoutCost(l) + extra - LOADOUT.budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleWeapon(l: Loadout, i: number): Loadout {
  if (toggleBlockReason(l, i)) return l;
  return l.map((s, j) => (j === i ? { ...s, weapon: swapped(l, i) } : s));
}

export function grenadeBlockReason(l: Loadout, i: number, delta: 1 | -1): string | null {
  const next = l[i].grenades + delta;
  if (next < 0) return 'No grenades to remove';
  if (next > LOADOUT.maxGrenades) return `Max ${LOADOUT.maxGrenades} grenades`;
  if (delta === 1) {
    const need = loadoutCost(l) + LOADOUT.prices.grenade - LOADOUT.budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeGrenades(l: Loadout, i: number, delta: 1 | -1): Loadout {
  if (grenadeBlockReason(l, i, delta)) return l;
  return l.map((s, j) => (j === i ? { ...s, grenades: s.grenades + delta } : s));
}

export function equipmentHit(px: number, py: number): EquipmentHit | null {
  const s = EQ.start;
  if (inRect(px, py, s.x, s.y, s.w, s.h)) return { kind: 'start' };
  for (let i = 0; i < SQUAD_SIZE; i++) {
    const y = rowY(i);
    if (inRect(px, py, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH)) return { kind: 'weapon', index: i };
    if (inRect(px, py, EQ.minus.x, y, EQ.minus.w, EQ.btnH)) return { kind: 'minus', index: i };
    if (inRect(px, py, EQ.plus.x, y, EQ.plus.w, EQ.btnH)) return { kind: 'plus', index: i };
  }
  return null;
}

export function blockReasonFor(l: Loadout, hit: EquipmentHit): string | null {
  switch (hit.kind) {
    case 'weapon': return toggleBlockReason(l, hit.index);
    case 'minus': return grenadeBlockReason(l, hit.index, -1);
    case 'plus': return grenadeBlockReason(l, hit.index, 1);
    case 'start': return validateLoadout(l);
  }
}

export function applyEquipmentHit(l: Loadout, hit: EquipmentHit): Loadout {
  switch (hit.kind) {
    case 'weapon': return toggleWeapon(l, hit.index);
    case 'minus': return changeGrenades(l, hit.index, -1);
    case 'plus': return changeGrenades(l, hit.index, 1);
    case 'start': return l;
  }
}

function button(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, enabled: boolean, hot: boolean,
): void {
  ctx.fillStyle = !enabled ? '#1c1f2e' : hot ? '#4da6ff' : '#2a2f45';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = !enabled ? '#555a70' : hot ? '#000' : '#e8e8f0';
  ctx.fillText(label, x + 4, y + (h - 8) / 2);
}

export function drawEquipment(
  ctx: CanvasRenderingContext2D,
  l: Loadout,
  hover: EquipmentHit | null,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const cost = loadoutCost(l);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText("EQUIPMENT - choose each soldier's kit", 20, 8);
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Credits ${cost}/${LOADOUT.budget}  (${LOADOUT.budget - cost} left)`, 20, 22);
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(20, 34, 440, 8);
  ctx.fillStyle = cost <= LOADOUT.budget ? '#4da6ff' : '#ff5555';
  ctx.fillRect(20, 34, 440 * Math.min(1, cost / LOADOUT.budget), 8);

  l.forEach((s, i) => {
    const y = rowY(i);
    const hot = (kind: 'weapon' | 'minus' | 'plus') =>
      hover !== null && hover.kind !== 'start' && hover.kind === kind && hover.index === i;
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`P${i + 1}`, 20, y + 8);
    button(
      ctx, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH,
      `${WEAPONS[s.weapon].name} (${LOADOUT.prices[s.weapon]})`,
      toggleBlockReason(l, i) === null, hot('weapon'),
    );
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText('Grenades', 180, y + 8);
    button(ctx, EQ.minus.x, y, EQ.minus.w, EQ.btnH, '-', grenadeBlockReason(l, i, -1) === null, hot('minus'));
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${s.grenades}`, 286, y + 8);
    button(ctx, EQ.plus.x, y, EQ.plus.w, EQ.btnH, '+', grenadeBlockReason(l, i, 1) === null, hot('plus'));
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText(`${soldierCost(s)} cr`, 380, y + 8);
  });

  const reason = hover ? blockReasonFor(l, hover) : null;
  ctx.fillStyle = reason ? '#ff9a4d' : '#6a6f88';
  ctx.fillText(reason ?? 'Click a weapon to swap it, + and - for grenades', 20, 272);

  const valid = validateLoadout(l) === null;
  const st = EQ.start;
  button(ctx, st.x, st.y, st.w, st.h, 'START MISSION (Enter)', valid, hover?.kind === 'start');
}
```

- [ ] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean. If the `blockReasonFor` "invalid loadout" test message differs, it matches `/grenades/` because `validateLoadout` words it "must carry 0 to 3 grenades".

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(screens): add equipment screen model, hit testing and drawing"
```

---

### Task 4: Result screen (hit testing, drawing)

**Files:**
- Create: `src/screens/result.ts`
- Test: `tests/resultscreen.test.ts`

**Interfaces:**
- Consumes: `MissionResult`, `VIEW`.
- Produces: `RESULT` (card and button rectangles), `resultHit(px: number, py: number): 'again' | null`, `drawResult(ctx: CanvasRenderingContext2D, r: MissionResult): void` (draws a dim overlay and the card; the caller draws whatever is underneath).

- [ ] **Step 1: Write the failing tests**

`tests/resultscreen.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resultHit } from '../src/screens/result';

describe('resultHit', () => {
  it('finds the Play again button', () => {
    expect(resultHit(240, 213)).toBe('again');
    expect(resultHit(190, 200)).toBe('again');
  });

  it('ignores clicks elsewhere on the card or screen', () => {
    expect(resultHit(240, 100)).toBeNull();
    expect(resultHit(10, 10)).toBeNull();
    expect(resultHit(290, 226)).toBeNull(); // just outside the button
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/resultscreen.test.ts`
Expected: FAIL with "Cannot find module '../src/screens/result'".

- [ ] **Step 3: Write the implementation**

`src/screens/result.ts`:

```ts
import type { MissionResult } from '../core/result';
import { VIEW } from '../render/layout';

export const RESULT = {
  card: { x: 110, y: 70, w: 260, h: 180 },
  again: { x: 190, y: 200, w: 100, h: 26 },
} as const;

export function resultHit(px: number, py: number): 'again' | null {
  const b = RESULT.again;
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h ? 'again' : null;
}

export function drawResult(ctx: CanvasRenderingContext2D, r: MissionResult): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = RESULT.card;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = '#3a3f55';
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = r.won ? '#7dff9a' : '#ff5555';
  ctx.fillText(r.won ? 'MISSION COMPLETE' : 'MISSION FAILED', c.x + 70, c.y + 20);
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`Survivors     ${r.survivors} of ${r.squadSize}`, c.x + 50, c.y + 60);
  ctx.fillText(`Enemies down  ${r.enemiesKilled} of ${r.enemyCount}`, c.x + 50, c.y + 80);
  ctx.fillText(`Turns taken   ${r.turns}`, c.x + 50, c.y + 100);

  const b = RESULT.again;
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#000';
  ctx.fillText('PLAY AGAIN (Enter)', b.x + 6, b.y + (b.h - 8) / 2);
}
```

- [ ] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(screens): add mission result screen"
```

---

### Task 5: App screen flow, input routing and wiring

**Files:**
- Create: `src/app.ts`
- Modify: `src/input/input.ts`, `src/main.ts`
- Test: `tests/app.test.ts`

**Interfaces:**
- Consumes: `Controller`, `createMission1`, `defaultLoadout`, `validateLoadout`, `Loadout`, `summarize`, `MissionResult`, `GameState`, `Pos`, `createUiState`, `Effects`, `screenToTile`, `drawGame`, `buttonAt`, equipment screen functions, result screen functions.
- Produces:
  - `type Screen = 'equipment' | 'mission' | 'result'`
  - `interface AppOptions { newSeed?: () => number; createMission?: (seed: number, loadout: Loadout) => GameState }`
  - `class App` with public `screen: Screen`, `loadout: Loadout`, `controller: Controller | null`, `result: MissionResult | null`, and methods `click(p: Pos)`, `move(p: Pos)`, `leave()`, `key(k: string): boolean`, `cancel()`, `update(now: number)`, `draw(ctx: CanvasRenderingContext2D, now: number)`.
  - `attachInput(canvas: HTMLCanvasElement, app: App): void`
  - A playable game that starts on the Equipment screen.

- [ ] **Step 1: Write the failing tests**

`tests/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const START = { x: 240, y: 315 }; // Start mission button
const AGAIN = { x: 240, y: 213 }; // Play again button

/** A tiny winnable map: no enemies, so the first command ends the mission as a win. */
const winTiny = (): GameState => makeState(corridorRows('P..'));

/** A tiny lost map: the only soldier is dead and it is the enemy's turn. */
const loseTiny = (): GameState => {
  const s = makeState(corridorRows('P..E'));
  unit(s, 'p1').alive = false;
  s.turn = 'enemy';
  return s;
};

function finish(app: App, t: number): void {
  app.controller!.key('e'); // winTiny: a Turn command ends the mission as a win
  app.update(t); // starts the end-of-mission delay
}

describe('App flow', () => {
  it('opens on the equipment screen with the default loadout', () => {
    const app = new App();
    expect(app.screen).toBe('equipment');
    expect(app.loadout.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
    expect(app.controller).toBeNull();
  });

  it('starts a mission with the chosen loadout', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // weapon button of P3: pistol to rifle
    expect(app.loadout[2].weapon).toBe('rifle');
    app.click(START);
    expect(app.screen).toBe('mission');
    expect(unit(app.controller!.state, 'p3').weapon).toBe('rifle');
    expect(unit(app.controller!.state, 'p4').weapon).toBe('pistol');
  });

  it('Enter starts the mission from the equipment screen', () => {
    const app = new App();
    expect(app.key('Enter')).toBe(true);
    expect(app.screen).toBe('mission');
  });

  it('a blocked equipment click changes nothing', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // P3 to rifle: credits 117
    const before = app.loadout;
    app.click({ x: 100, y: 224 }); // P4 to rifle needs 12 more credits
    expect(app.loadout).toBe(before);
  });

  it('shows the result a second after the mission ends', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    expect(app.controller!.state.status).toBe('won');
    app.update(1500);
    expect(app.screen).toBe('mission'); // still within the delay
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: true, survivors: 1, squadSize: 1 });
  });

  it('waits until the controller is idle before showing the result', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.controller!.ui.busy = true;
    app.update(9000);
    expect(app.screen).toBe('mission');
    app.controller!.ui.busy = false;
    app.update(9100);
    expect(app.screen).toBe('result');
  });

  it('reports a lost mission through the same flow', () => {
    const app = new App({ createMission: loseTiny });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: false, survivors: 0 });
  });

  it('Play again returns to equipment with the default loadout', () => {
    const app = new App({ createMission: winTiny });
    app.click({ x: 100, y: 172 }); // change P3 so a reset is visible
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    app.click(AGAIN);
    expect(app.screen).toBe('equipment');
    expect(app.loadout[2].weapon).toBe('pistol');
    expect(app.controller).toBeNull();
    expect(app.result).toBeNull();
  });

  it('Enter on the result screen plays again', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    expect(app.key('Enter')).toBe(true);
    expect(app.screen).toBe('equipment');
  });

  it('gives every run a fresh state and a new seed', () => {
    const seeds = [111, 222, 333];
    const app = new App({ newSeed: () => seeds.shift()!, createMission: (seed) => {
      const s = winTiny();
      s.rngState = seed;
      return s;
    } });
    app.click(START);
    const first = app.controller!.state;
    expect(first.rngState).toBe(111);
    finish(app, 1000);
    app.update(2100);
    app.click(AGAIN);
    app.click(START);
    expect(app.controller!.state.rngState).toBe(222);
    expect(app.controller!.state).not.toBe(first);
    expect(app.controller!.state.status).toBe('playing');
  });
});

describe('input routing', () => {
  it('ignores keys and clicks meant for the hidden mission while the result is showing', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    finish(app, 1000);
    app.update(2100);
    const state = app.controller!.state;
    expect(app.key(' ')).toBe(false);
    expect(app.key('e')).toBe(false);
    app.click({ x: 40, y: 40 }); // a map tile under the card
    app.move({ x: 40, y: 40 });
    app.cancel();
    expect(app.controller!.state).toBe(state);
    expect(app.screen).toBe('result');
  });

  it('does not send equipment clicks to a running mission', () => {
    const app = new App();
    app.click(START);
    const before = app.loadout;
    app.click({ x: 100, y: 172 }); // same pixels as P3's weapon button
    expect(app.loadout).toBe(before);
  });

  it('does not start a mission from the result or mission screens', () => {
    const app = new App({ createMission: winTiny });
    app.click(START);
    const controller = app.controller;
    app.click(START); // pixels of the Start button, but a mission is showing
    expect(app.controller).toBe(controller);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app.test.ts`
Expected: FAIL with "Cannot find module '../src/app'".

- [ ] **Step 3: Write App**

`src/app.ts`:

```ts
import { Controller } from './controller';
import { defaultLoadout, validateLoadout, type Loadout } from './core/loadout';
import { createMission1 } from './core/mission1';
import { summarize, type MissionResult } from './core/result';
import type { GameState, Pos } from './core/types';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import { screenToTile } from './render/layout';
import { buttonAt } from './render/panel';
import { drawGame } from './render/renderer';
import {
  applyEquipmentHit, drawEquipment, equipmentHit, type EquipmentHit,
} from './screens/equipment';
import { drawResult, resultHit } from './screens/result';

export type Screen = 'equipment' | 'mission' | 'result';

const RESULT_DELAY_MS = 1000;

export interface AppOptions {
  newSeed?: () => number;
  createMission?: (seed: number, loadout: Loadout) => GameState;
}

export class App {
  screen: Screen = 'equipment';
  loadout: Loadout = defaultLoadout();
  controller: Controller | null = null;
  result: MissionResult | null = null;

  private hover: EquipmentHit | null = null;
  private endedAt: number | null = null;
  private readonly newSeed: () => number;
  private readonly createMission: (seed: number, loadout: Loadout) => GameState;

  constructor(opts: AppOptions = {}) {
    this.newSeed = opts.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));
    this.createMission = opts.createMission ?? ((seed, loadout) => createMission1(seed, loadout));
  }

  private startMission(): void {
    if (validateLoadout(this.loadout) !== null) return;
    const state = this.createMission(this.newSeed(), this.loadout);
    this.controller = new Controller(state, createUiState('p1'), new Effects());
    this.result = null;
    this.endedAt = null;
    this.screen = 'mission';
  }

  private playAgain(): void {
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.endedAt = null;
    this.hover = null;
    this.screen = 'equipment';
  }

  click(p: Pos): void {
    switch (this.screen) {
      case 'equipment': {
        const hit = equipmentHit(p.x, p.y);
        if (!hit) return;
        if (hit.kind === 'start') {
          this.startMission();
          return;
        }
        this.loadout = applyEquipmentHit(this.loadout, hit);
        return;
      }
      case 'mission': {
        const c = this.controller;
        if (!c) return;
        const button = buttonAt(p.x, p.y);
        if (button) {
          c.pressButton(button);
          return;
        }
        const t = screenToTile(p.x, p.y, c.state.width, c.state.height);
        if (t) c.clickTile(t);
        return;
      }
      case 'result':
        if (resultHit(p.x, p.y) === 'again') this.playAgain();
        return;
    }
  }

  move(p: Pos): void {
    if (this.screen === 'equipment') {
      this.hover = equipmentHit(p.x, p.y);
    } else if (this.screen === 'mission' && this.controller) {
      const c = this.controller;
      c.hover(screenToTile(p.x, p.y, c.state.width, c.state.height));
    }
  }

  leave(): void {
    this.hover = null;
    if (this.screen === 'mission') this.controller?.hover(null);
  }

  key(k: string): boolean {
    switch (this.screen) {
      case 'equipment':
        if (k === 'Enter') {
          this.startMission();
          return true;
        }
        return false;
      case 'mission':
        return this.controller ? this.controller.key(k) : false;
      case 'result':
        if (k === 'Enter') {
          this.playAgain();
          return true;
        }
        return false;
    }
  }

  cancel(): void {
    if (this.screen === 'mission') this.controller?.cancel();
  }

  /** Call once per frame. Switches to the result screen shortly after the mission ends. */
  update(now: number): void {
    const c = this.controller;
    if (this.screen !== 'mission' || !c) return;
    if (c.state.status === 'playing') {
      this.endedAt = null;
      return;
    }
    if (this.endedAt === null) this.endedAt = now;
    if (now - this.endedAt >= RESULT_DELAY_MS && !c.ui.busy) {
      this.result = summarize(c.state);
      this.screen = 'result';
      this.endedAt = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.screen === 'equipment') {
      drawEquipment(ctx, this.loadout, this.hover);
      return;
    }
    const c = this.controller;
    if (!c) return;
    drawGame(ctx, c.state, c.ui, c.effects, now);
    if (this.screen === 'result' && this.result) drawResult(ctx, this.result);
  }
}
```

- [ ] **Step 4: Rewrite input.ts and main.ts**

`src/input/input.ts` (replace the whole file):

```ts
import type { App } from '../app';

export function attachInput(canvas: HTMLCanvasElement, app: App): void {
  const toLogical = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  };

  canvas.addEventListener('mousemove', (e) => app.move(toLogical(e)));
  canvas.addEventListener('mouseleave', () => app.leave());
  canvas.addEventListener('click', (e) => app.click(toLogical(e)));
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    app.cancel();
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.key(e.key)) e.preventDefault();
  });
}
```

`src/main.ts` (replace the whole file):

```ts
import { App } from './app';
import { attachInput } from './input/input';
import { VIEW } from './render/layout';

const canvas = document.createElement('canvas');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
document.getElementById('app')!.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

const app = new App();
attachInput(canvas, app);
if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;

function frame(now: number): void {
  app.update(now);
  app.draw(ctx, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 5: Run the tests, type check and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all PASS (milestone 1 and 2 tests), type check clean, build succeeds. If `finish()` fails because `controller.key('e')` is rejected, check that the tiny map's soldier is selected (`createUiState('p1')`) and the turn is the player's.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add App screen flow with equipment, mission and result screens"
```

---

### Task 6: Playtest to the end, README, vault log, and the push question

**Files:**
- Modify: `README.md`; any file where the playtest finds a defect (add a regression test first)

**Interfaces:**
- Consumes: the whole game.
- Produces: a verified, documented milestone 2.

- [ ] **Step 1: Run the full automated checks**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, no type errors, `dist/` produced.

- [ ] **Step 2: Playtest the whole flow in the browser**

Run `npm run dev` (or `play.bat`) and open the printed local address. In dev mode the app is exposed as `window.app`. Check each item and fix defects test-first:

- The game opens on the equipment screen with credits `102/120 (18 left)`.
- Clicking a pistol button on P3 swaps to Rifle and credits go to 117; the same on P4 is greyed out and hovering it shows "Need 12 more credits".
- `+` and `-` change grenades, stop at 3 and 0, and hovering a blocked one shows the reason.
- Start mission (button or Enter) shows the map with the chosen weapons (select a soldier and read the panel).
- **Play a mission to the end.** You can speed this up in the console: `app.controller.state.units.filter(u => u.side === 'enemy').forEach(u => { u.alive = false })`, then press `E` to turn a soldier (any command ends the mission as a win). After about a second the Result card appears over the dimmed map showing survivors, enemies down and turns.
- Play again (button or Enter) returns to the equipment screen with the default loadout, and the next mission starts with fresh units.
- Repeat once more, and once with all soldiers dead (set `alive = false` on the player units, then press Space to end the turn so the enemy turn ends the mission) to see "MISSION FAILED".
- Space or clicks on the map while the Result card is showing do nothing.

- [ ] **Step 3: Update README.md**

In the Play section, add after the `npm run dev` block:

```markdown
The game opens on an **equipment screen**: spend a 120-credit budget on each soldier's weapon (pistol 10, rifle 25) and grenades (8 each, up to 3), then press Start (or Enter). When the mission ends a result screen shows how it went; Play again (or Enter) returns to the equipment screen.
```

- [ ] **Step 4: Commit**

```bash
git add README.md src tests
git commit -m "docs: describe the equipment and result screens; playtest fixes"
```

- [ ] **Step 5: Ask the user before pushing**

Do not push on your own. Ask: "Milestone 2 is playable and committed on branch `milestone-2`. Shall I push it to https://github.com/iurdivad-netizen/laser-tribute and tell you when it is ready for a pull request?" On a clear yes:

```bash
git push -u origin "$(git branch --show-current)"
```

(Pushing may need the user to be signed in to GitHub in the browser; if it hangs, stop the stuck git processes and ask the user to sign in, then retry.)

- [ ] **Step 6: Write the vault Dev Log**

Per the user's global instructions, after reading `C:\Users\User\Documents\SecondBrain\_CLAUDE.md` and `index.md`, write `Dev Logs/2026-10-01 - Laser Tribute Milestone 2.md` in the SecondBrain vault (ai-first frontmatter, "For future agent" preamble, wikilinks to `[[Games/Laser Tribute]]` and `[[Dev Logs/2026-10-01 - Laser Tribute Milestone 1]]`), add a Recent Activity line and update the Open items in `Games/Laser Tribute.md`, add the dev log to `index.md`, and append a line to `Logs/YYYY-MM-DD.md`.

---

## Self-Review

**Spec coverage**

- Purpose and the mission-end gap are Tasks 5 and 6 (Result screen and the end-to-end playtest).
- Screen flow (Equipment, Mission, Result, Play again) is Task 5 (`App`), with the 1 second delay and idle check in `update`.
- Architecture: `core/loadout.ts` Task 1, `core/result.ts` Task 2, `screens/equipment.ts` Task 3, `screens/result.ts` Task 4, `app.ts`, `input.ts`, `main.ts` Task 5. `createMission1(seed, loadout?)` Task 1.
- Loadout rules (budget 120, prices, 0 to 3 grenades, default 102, validity, apply by index) are Task 1.
- Result summary is Task 2.
- Equipment screen (rows, weapon toggle, grenade controls, credits bar, Start, disabled buttons with hover reasons, Enter) is Task 3.
- Result screen (card, stats, Play again, Enter) is Task 4 (drawing) and Task 5 (Enter).
- Edge cases: fresh state and new seed (Task 5 test), wait until idle (Task 5 test), invalid loadout cannot start (Task 1 tests, Task 3 Start disabled, Task 5 `startMission` guard), input routed only to the visible screen (Task 5 tests).
- Testing section: pure rule tests Tasks 1 and 2, equipment model Task 3, flow Task 5 (with injected `now` rather than fake timers, called out under the plan's decisions), drawing and clicks by playtest Task 6.
- Success criteria are Task 6 Step 2. Milestone 1 behaviour unchanged is checked by running the full suite in every task.

**Placeholders:** none. Every code step has full code. The only deliberate omission is that `mission1.ts` keeps its existing `MISSION1_ROWS` and `PATROLS` unchanged, which Task 1 says explicitly.

**Type consistency:** `Loadout`, `EquipmentHit`, `MissionResult`, `AppOptions` and the function names match across tasks. `Controller` API used (`key`, `run`, `pressButton`, `clickTile`, `hover`, `cancel`, `ui.busy`, `state`) is the existing milestone 1 API. Test coordinates (weapon button P3 at (100,172), Start at (240,315), Play again at (240,213)) match the geometry constants in Tasks 3 and 4.

**Review Focus:** item 1 is tested in Task 5 ("waits until the controller is idle"), item 2 in Task 5 ("fresh state and a new seed"), item 3 in Task 5 (input routing tests), item 4 in Tasks 1 and 3, item 5 in Tasks 2 and 5 ("reports a lost mission").
