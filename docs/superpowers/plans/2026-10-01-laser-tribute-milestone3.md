# Laser Tribute Milestone 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single replayable mission into a three-mission campaign with a persistent squad: soldiers carry names and kills between missions, the shared equipment budget grows with won missions and with kills by living soldiers, fallen soldiers are replaced by rookies, and the run ends on Campaign complete or Campaign lost.

**Architecture:** New pure `core` modules hold the rules (`campaign`, `missions`) and kill crediting is added to the existing shot and grenade code. Loadout rules take the budget as a value. Missions become plain data records. The `App` owns the `Campaign` and drives four screens (equipment, mission, result, end). The mission `Controller` and all combat, vision and AI rules stay unchanged apart from kill crediting.

**Tech Stack:** TypeScript (strict), HTML5 Canvas 2D, Vite, Vitest. Existing project in `C:\claude\laser-tribute`.

**Spec:** `docs/superpowers/specs/2026-10-01-laser-tribute-milestone3-design.md`

## Global Constraints

- `core/` must not import anything from `render/`, `input/`, `screens/`, `controller.ts`, `app.ts` or the DOM.
- Budget for a mission = **120 base + 20 per mission won + 5 per kill by soldiers in the active roster**. Fallen soldiers' kills do not count.
- The roster always has **4 active soldiers**. A dead soldier moves to `fallen` and is replaced next mission by a rookie (new name, 0 kills). Gear does not carry over; it is re-bought each mission.
- Soldier names come from a fixed list of 12, each rookie takes the next unused name, and past the list a numeric suffix is added (`Alvarez 2`).
- A kill is credited to the shooter (including alert reaction fire) or grenade thrower, and **only for enemies**. Killing units of one's own side gives no credit.
- Three hand-made missions (4, 6 and 8 enemies). Each map is exactly 30x20 (the canvas shows 30x20 tiles; no scrolling).
- A mission is lost only when all four soldiers die; that ends the campaign. Winning the last mission ends it as complete. Partial casualties still count as a win.
- Each new mission and each new campaign starts from fresh state with a new random seed chosen outside `core`.
- Input reaches only the visible screen. The 0.3 second input guard applies to every screen switch.
- Mission 1 plays exactly as it does today. All existing tests keep passing, except the `App` tests which are rewritten in Task 6 for the campaign flow.
- Git commit after every task, on branch `milestone-3`. End every commit message with the `Co-Authored-By` trailer given in the session's attribution reminder.
- Do not push to GitHub without asking the user first. Remote: `https://github.com/iurdivad-netizen/laser-tribute`.
- Out of scope: soldier stat growth, new items, saving, generated maps, scrolling or larger maps, sound.

### Decisions this plan makes where the spec left room

- `recordMission(c, finished, missionCount)` takes a third argument (the number of missions) so `core/campaign.ts` does not import the mission list.
- Units get `name` (default `P1`, `E1`, ... until a roster name is applied) and `kills`.
- The end screen's "total kills" counts the roster and the fallen together (everything the squad achieved). The spec said "by the active roster"; the combined number is more informative.
- Result screen button reads "CONTINUE (Enter)". After a win with the campaign still active it goes to the next mission's equipment screen; otherwise to the end screen.
- Equipment screen: the soldier's name sits at the row's left with his kills under it; the mission title and budget breakdown replace the old heading. The panel shows the soldier's name instead of `P1`.
- `App` accepts injected `missions` and a `createMission(def, seed, roster, loadout, budget)` so the flow is testable with tiny maps.
- End-screen survivors are the roster only when the campaign was won (after a loss the roster slots hold rookies, so survivors are shown as none).

## Review Focus

Inputs and failure modes the spec implies that the happy-path tests do not exercise, most likely to bite first. Each has a test in the task that owns the code.

1. A budget that falls after a veteran dies must never start a mission over budget: the equipment screen falls back to the cheap kit (Tasks 2 and 6).
2. Friendly-fire kills must credit nobody, and a soldier killed by his own side's blast still counts as a casualty (Tasks 1 and 3).
3. Winning the last mission must go to Campaign complete and never to a non-existent Mission 4; a lost mission must go to Campaign lost (Tasks 3 and 6).
4. Every map must have exactly 4 soldier starts, the right enemy count, patrols that include each enemy's own start, and every start, patrol point and item reachable from the soldiers (Task 4).
5. Keys and clicks must not leak across the new end screen or chain screens through double-clicks and held Enter (Task 6).

## File Structure

```
src/
  app.ts                         MODIFY  campaign state, four screens, new flow
  core/
    types.ts                     MODIFY  Unit gains name and kills
    mission.ts                   MODIFY  units start with name and kills
    combat.ts                    MODIFY  fireShot credits kills
    actions/throw.ts             MODIFY  grenade credits kills
    loadout.ts                   MODIFY  budget parameter, cheapLoadout, fitLoadout
    campaign.ts                  NEW     campaign state, budget, recordMission
    missions.ts                  NEW     MissionDef, MISSIONS (3), createMission
    mission1.ts                  MODIFY  thin wrapper over createMission
  screens/
    equipment.ts                 MODIFY  budget parameter, EquipmentView, names and kills
    result.ts                    MODIFY  ResultView (fallen, next budget, mission name)
    end.ts                       NEW     campaign complete / lost screen
  render/panel.ts                MODIFY  show the soldier's name
  controller.ts                  MODIFY  alert message uses the name
tests/
  kills.test.ts, campaign.test.ts, missions.test.ts, endscreen.test.ts   NEW
  loadout.test.ts, equipment.test.ts, mission.test.ts                    MODIFY (additions)
  app.test.ts                                                            REWRITE
README.md                        MODIFY  describe the campaign
```

---

### Task 1: Unit names, kills and kill crediting

**Files:**
- Modify: `src/core/types.ts`, `src/core/mission.ts`, `src/core/combat.ts`, `src/core/actions/throw.ts`
- Modify: `tests/mission.test.ts`
- Test: `tests/kills.test.ts`

**Interfaces:**
- Consumes: existing `Unit`, `fireShot`, `handleThrow`, `applyReactionFire`.
- Produces: `Unit.name: string` (default `id.toUpperCase()`, e.g. `P1`), `Unit.kills: number` (mission kills, starts 0). A kill of a unit of the opposite side increments the shooter's `kills` (shots and alert reaction shots go through `fireShot`) or the thrower's `kills` (once per enemy killed by the blast). Kills of the same side credit nobody.

- [ ] **Step 1: Write the failing tests**

`tests/kills.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);
const MISS = () => seedForRoll((n) => n >= 0.96);

describe('kill crediting', () => {
  it('credits the shooter for a kill', () => {
    const s = makeState(corridorRows('P...E'));
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').hp = 20;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(1);
  });

  it('credits nothing for a hit that does not kill', () => {
    const s = makeState(corridorRows('P...E'));
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'p1').kills).toBe(0);
  });

  it('credits nothing for a miss', () => {
    const s = makeState(corridorRows('P...E'));
    s.rngState = MISS();
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').hp = 1;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'p1').kills).toBe(0);
  });

  it('credits the thrower for every enemy the blast kills', () => {
    const s = makeState(corridorRows('P.....EE')); // e1 at x=7, e2 at x=8
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 7, y: 1 } }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'e2').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(2);
  });

  it('does not credit killing his own side', () => {
    const s = makeState(corridorRows('P.PE..')); // p2 at x=3, e1 at x=4
    unit(s, 'p2').hp = 10;
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }));
    expect(unit(r.state, 'p2').alive).toBe(false);
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(1); // only the enemy counts
  });

  it('credits an alert reaction kill to the reacting soldier', () => {
    const s = makeState(corridorRows('P....E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alert = true;
    unit(s, 'e1').hp = 10;
    s.turn = 'enemy';
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'e1', to: { x: 5, y: 1 } }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').kills).toBe(1);
  });
});
```

Add to the existing `tests/mission.test.ts` assertions (inside the "creates units with default stats" test): add `name: 'P1', kills: 0` to the `p1` `toMatchObject` and `name: 'E1', kills: 0` to the `e1` `toMatchObject`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/kills.test.ts tests/mission.test.ts`
Expected: FAIL (`kills` is undefined; the mission test lacks `name`).

- [ ] **Step 3: Write the implementation**

In `src/core/types.ts`, add two fields to `Unit` (put `name` after `id` and `kills` after `alert`):

```ts
export interface Unit {
  id: string;
  /** Display name; campaign soldiers carry their roster name. */
  name: string;
  side: Side;
  pos: Pos;
  facing: Facing;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  weapon: WeaponId;
  grenades: number;
  alive: boolean;
  /** On alert: keeps AP for the other side's turn and fires at enemies that move into view. */
  alert: boolean;
  /** Enemies killed in this mission, credited to the shooter or grenade thrower. */
  kills: number;
  patrol: Pos[];
  patrolIndex: number;
}
```

In `src/core/mission.ts`, in `makeUnit` add `name: id.toUpperCase(),` right after `id,` and `kills: 0,` right after `alert: false,`.

In `src/core/combat.ts`, in `fireShot`, replace the final `if` block with:

```ts
  if (hit && target.hp <= 0) {
    target.alive = false;
    if (target.side !== shooter.side) shooter.kills += 1;
    events.push({ type: 'died', unitId: target.id, at: { ...target.pos } });
  }
```

In `src/core/actions/throw.ts`, replace the `if (u.hp <= 0)` block inside the blast loop with:

```ts
    if (u.hp <= 0) {
      u.alive = false;
      died.push(u);
      if (u.side !== unit.side) unit.kills += 1;
    }
```

- [ ] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): give units names and credit kills to shooters and throwers"
```

---

### Task 2: Budget-aware loadouts and the equipment screen

**Files:**
- Modify: `src/core/loadout.ts`
- Replace: `src/screens/equipment.ts`
- Test: add to `tests/loadout.test.ts` and `tests/equipment.test.ts`

**Interfaces:**
- Consumes: existing loadout and equipment code.
- Produces:
  - `validateLoadout(l: Loadout, budget?: number)`, `applyLoadout(state: GameState, l: Loadout, budget?: number)` (budget defaults to `LOADOUT.budget` = 120)
  - `cheapLoadout(): Loadout` (pistol and one grenade each, cost 72), `fitLoadout(previous: Loadout, budget: number): Loadout` (returns `previous` itself when valid under `budget`, otherwise `cheapLoadout()`)
  - In `equipment.ts` every logic function gains a trailing `budget` parameter defaulting to 120: `toggleBlockReason`, `toggleWeapon`, `grenadeBlockReason`, `changeGrenades`, `blockReasonFor`, `applyEquipmentHit`
  - `interface EquipmentView { budget: number; title: string; breakdown: string; soldiers: { name: string; kills: number }[] }`, `DEFAULT_VIEW`, and `drawEquipment(ctx, l, hover, view?: EquipmentView)` showing the view's title, breakdown, budget and each soldier's name and kills

- [ ] **Step 1: Write the failing tests**

Append to `tests/loadout.test.ts` (and add `cheapLoadout`, `fitLoadout` to its import from `../src/core/loadout`):

```ts
describe('budget parameter', () => {
  it('a bigger budget allows a bigger kit', () => {
    const big = four('rifle', 3); // 196
    expect(loadoutCost(big)).toBe(196);
    expect(validateLoadout(big, 196)).toBeNull();
    expect(validateLoadout(big, 195)).toMatch(/budget is 195/);
    expect(validateLoadout(big)).toMatch(/budget is 120/);
  });

  it('applyLoadout uses the given budget', () => {
    const s = createMission1();
    const next = applyLoadout(s, four('rifle', 3), 200);
    expect(unit(next, 'p4')).toMatchObject({ weapon: 'rifle', grenades: 3 });
    expect(() => applyLoadout(s, four('rifle', 3), 150)).toThrow(/budget/);
  });
});

describe('fitLoadout', () => {
  it('keeps the previous kit when it still fits', () => {
    const prev = defaultLoadout();
    expect(fitLoadout(prev, 160)).toBe(prev);
  });

  it('falls back to the cheap kit when the budget has fallen below the previous kit', () => {
    const fitted = fitLoadout(four('rifle', 3), 160);
    expect(fitted).toEqual(cheapLoadout());
    expect(loadoutCost(fitted)).toBe(72);
    expect(validateLoadout(fitted)).toBeNull(); // fits even the base budget
  });
});
```

Append to `tests/equipment.test.ts` (and import `blockReasonFor` is already imported):

```ts
describe('with a bigger budget', () => {
  it('lets more weapons be swapped and grenades added', () => {
    let l = toggleWeapon(defaultLoadout(), 2, 160); // 117
    l = toggleWeapon(l, 3, 160); // 132
    expect(l.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'rifle', 'rifle']);
    expect(toggleBlockReason(defaultLoadout(), 2, 160)).toBeNull();
    l = changeGrenades(l, 0, 1, 160); // 140
    expect(l[0].grenades).toBe(2);
    expect(grenadeBlockReason(l, 1, 1, 130)).toBe('Need 18 more credits'); // 140 + 8 - 130
  });

  it('reports the start block against the given budget', () => {
    const l = defaultLoadout();
    l[0].grenades = 3;
    l[1].grenades = 3;
    l[2].weapon = 'rifle';
    l[3].weapon = 'rifle'; // cost 100 + 8*8 = 164
    expect(blockReasonFor(l, { kind: 'start' }, 120)).toMatch(/budget/);
    expect(blockReasonFor(l, { kind: 'start' }, 200)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/loadout.test.ts tests/equipment.test.ts`
Expected: FAIL (`cheapLoadout`/`fitLoadout` do not exist; budget arguments ignored).

- [ ] **Step 3: Update loadout.ts**

In `src/core/loadout.ts` replace `validateLoadout` and `applyLoadout` and add the two new functions (leave the rest of the file as it is):

```ts
export function cheapLoadout(): Loadout {
  return Array.from({ length: SQUAD_SIZE }, () => ({ weapon: 'pistol' as const, grenades: 1 }));
}

export function validateLoadout(l: Loadout, budget: number = LOADOUT.budget): string | null {
  if (l.length !== SQUAD_SIZE) return `A loadout needs exactly ${SQUAD_SIZE} soldiers`;
  for (const [i, s] of l.entries()) {
    if (s.weapon !== 'pistol' && s.weapon !== 'rifle') return `Soldier ${i + 1} needs a weapon`;
    if (!Number.isInteger(s.grenades) || s.grenades < 0 || s.grenades > LOADOUT.maxGrenades) {
      return `Soldier ${i + 1} must carry 0 to ${LOADOUT.maxGrenades} grenades`;
    }
  }
  const cost = loadoutCost(l);
  if (cost > budget) return `Loadout costs ${cost}, budget is ${budget}`;
  return null;
}

/** The previous kit if it still fits the budget, otherwise the cheap fallback kit. */
export function fitLoadout(previous: Loadout, budget: number): Loadout {
  return validateLoadout(previous, budget) === null ? previous : cheapLoadout();
}

export function applyLoadout(state: GameState, l: Loadout, budget: number = LOADOUT.budget): GameState {
  const error = validateLoadout(l, budget);
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

- [ ] **Step 4: Replace src/screens/equipment.ts**

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

export interface EquipmentView {
  budget: number;
  title: string;
  breakdown: string;
  soldiers: { name: string; kills: number }[];
}

export const DEFAULT_VIEW: EquipmentView = {
  budget: LOADOUT.budget,
  title: "EQUIPMENT - choose each soldier's kit",
  breakdown: '',
  soldiers: [],
};

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

export function toggleBlockReason(l: Loadout, i: number, budget: number = LOADOUT.budget): string | null {
  const extra = LOADOUT.prices[swapped(l, i)] - LOADOUT.prices[l[i].weapon];
  const need = loadoutCost(l) + extra - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleWeapon(l: Loadout, i: number, budget: number = LOADOUT.budget): Loadout {
  if (toggleBlockReason(l, i, budget)) return l;
  return l.map((s, j) => (j === i ? { ...s, weapon: swapped(l, i) } : s));
}

export function grenadeBlockReason(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget,
): string | null {
  const next = l[i].grenades + delta;
  if (next < 0) return 'No grenades to remove';
  if (next > LOADOUT.maxGrenades) return `Max ${LOADOUT.maxGrenades} grenades`;
  if (delta === 1) {
    const need = loadoutCost(l) + LOADOUT.prices.grenade - budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeGrenades(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget,
): Loadout {
  if (grenadeBlockReason(l, i, delta, budget)) return l;
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

export function blockReasonFor(l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget): string | null {
  switch (hit.kind) {
    case 'weapon': return toggleBlockReason(l, hit.index, budget);
    case 'minus': return grenadeBlockReason(l, hit.index, -1, budget);
    case 'plus': return grenadeBlockReason(l, hit.index, 1, budget);
    case 'start': return validateLoadout(l, budget);
  }
}

export function applyEquipmentHit(l: Loadout, hit: EquipmentHit, budget: number = LOADOUT.budget): Loadout {
  switch (hit.kind) {
    case 'weapon': return toggleWeapon(l, hit.index, budget);
    case 'minus': return changeGrenades(l, hit.index, -1, budget);
    case 'plus': return changeGrenades(l, hit.index, 1, budget);
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
  view: EquipmentView = DEFAULT_VIEW,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const cost = loadoutCost(l);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(view.title, 20, 8);
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Credits ${cost}/${view.budget}  (${view.budget - cost} left)`, 20, 22);
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(20, 34, 440, 8);
  ctx.fillStyle = cost <= view.budget ? '#4da6ff' : '#ff5555';
  ctx.fillRect(20, 34, 440 * Math.min(1, cost / view.budget), 8);
  ctx.fillStyle = '#6a6f88';
  ctx.fillText(view.breakdown, 20, 45);

  l.forEach((s, i) => {
    const y = rowY(i);
    const hot = (kind: 'weapon' | 'minus' | 'plus') =>
      hover !== null && hover.kind !== 'start' && hover.kind === kind && hover.index === i;
    const who = view.soldiers[i];
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(who ? who.name : `P${i + 1}`, 8, y + 3);
    if (who) {
      ctx.fillStyle = '#8a8fa8';
      ctx.fillText(`${who.kills} kills`, 8, y + 14);
    }
    button(
      ctx, EQ.weapon.x, y, EQ.weapon.w, EQ.btnH,
      `${WEAPONS[s.weapon].name} (${LOADOUT.prices[s.weapon]})`,
      toggleBlockReason(l, i, view.budget) === null, hot('weapon'),
    );
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText('Grenades', 180, y + 8);
    button(ctx, EQ.minus.x, y, EQ.minus.w, EQ.btnH, '-', grenadeBlockReason(l, i, -1, view.budget) === null, hot('minus'));
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${s.grenades}`, 286, y + 8);
    button(ctx, EQ.plus.x, y, EQ.plus.w, EQ.btnH, '+', grenadeBlockReason(l, i, 1, view.budget) === null, hot('plus'));
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText(`${soldierCost(s)} cr`, 380, y + 8);
  });

  const reason = hover ? blockReasonFor(l, hover, view.budget) : null;
  ctx.fillStyle = reason ? '#ff9a4d' : '#6a6f88';
  ctx.fillText(reason ?? 'Click a weapon to swap it, + and - for grenades', 20, 272);

  const valid = validateLoadout(l, view.budget) === null;
  const st = EQ.start;
  button(ctx, st.x, st.y, st.w, st.h, 'START MISSION (Enter)', valid, hover?.kind === 'start');
}
```

- [ ] **Step 5: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean. In the new equipment test the `grenadeBlockReason(l, 1, 1, 130)` line expects 18 more credits because the loadout already costs 140 (132 plus one grenade), and 140 + 8 - 130 = 18.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: make loadout rules and the equipment screen budget-aware"
```

---

### Task 3: Campaign rules (core)

**Files:**
- Create: `src/core/campaign.ts`
- Test: `tests/campaign.test.ts`

**Interfaces:**
- Consumes: `GameState` (types).
- Produces:
  - `CAMPAIGN = { baseBudget: 120, winBonus: 20, killBonus: 5, rosterSize: 4 }`, `SOLDIER_NAMES` (12 names)
  - `interface RosterSoldier { name: string; kills: number }`
  - `interface Campaign { missionIndex: number; missionsWon: number; roster: RosterSoldier[]; fallen: RosterSoldier[]; namesUsed: number; status: 'active' | 'won' | 'lost' }`
  - `soldierName(index: number): string`, `newCampaign(): Campaign`, `totalKills(c: Campaign): number` (active roster only), `campaignBudget(c: Campaign): number`, `budgetBreakdown(c: Campaign): string` (e.g. `Base 120 + wins 20 + kills 15`)
  - `recordMission(c: Campaign, finished: GameState, missionCount: number): Campaign` (pure, never mutates its inputs, throws if the mission is still `playing`)

- [ ] **Step 1: Write the failing tests**

`tests/campaign.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  SOLDIER_NAMES, budgetBreakdown, campaignBudget, newCampaign, recordMission, soldierName,
  totalKills,
} from '../src/core/campaign';
import { corridorRows, makeState, unit } from './helpers';

/** A finished 4-soldier mission with no enemies left. */
function finishedWin() {
  const s = makeState(corridorRows('PPPP'));
  s.status = 'won';
  return s;
}

describe('names', () => {
  it('uses the fixed list, then adds a numeric suffix', () => {
    expect(SOLDIER_NAMES).toHaveLength(12);
    expect(soldierName(0)).toBe('Alvarez');
    expect(soldierName(11)).toBe('Lindqvist');
    expect(soldierName(12)).toBe('Alvarez 2');
    expect(soldierName(13)).toBe('Brandt 2');
    expect(soldierName(24)).toBe('Alvarez 3');
  });
});

describe('newCampaign and budget', () => {
  it('starts with four named soldiers and the base budget', () => {
    const c = newCampaign();
    expect(c.roster.map((r) => r.name)).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(c).toMatchObject({ missionIndex: 0, missionsWon: 0, fallen: [], namesUsed: 4, status: 'active' });
    expect(campaignBudget(c)).toBe(120);
    expect(budgetBreakdown(c)).toBe('Base 120 + wins 0 + kills 0');
  });

  it('grows with won missions and with kills by living soldiers only', () => {
    const c = newCampaign();
    c.missionsWon = 1;
    c.roster[0].kills = 3;
    c.roster[1].kills = 1;
    c.fallen.push({ name: 'Gone', kills: 9 });
    expect(totalKills(c)).toBe(4);
    expect(campaignBudget(c)).toBe(160); // 120 + 20 + 4 * 5
    expect(budgetBreakdown(c)).toBe('Base 120 + wins 20 + kills 20');
  });
});

describe('recordMission', () => {
  it('adds mission kills to the roster and advances after a win', () => {
    const c = newCampaign();
    c.roster[0].kills = 2;
    const s = finishedWin();
    unit(s, 'p1').kills = 3;
    unit(s, 'p2').kills = 1;
    const next = recordMission(c, s, 3);
    expect(next.roster[0]).toEqual({ name: 'Alvarez', kills: 5 });
    expect(next.roster[1]).toEqual({ name: 'Brandt', kills: 1 });
    expect(next).toMatchObject({ missionsWon: 1, missionIndex: 1, status: 'active', fallen: [] });
  });

  it('moves a dead soldier to the fallen list and replaces him with a rookie', () => {
    const s = finishedWin();
    unit(s, 'p1').kills = 3;
    unit(s, 'p3').kills = 2;
    unit(s, 'p3').alive = false;
    const next = recordMission(newCampaign(), s, 3);
    expect(next.fallen).toEqual([{ name: 'Chen', kills: 2 }]);
    expect(next.roster[2]).toEqual({ name: 'Eriksen', kills: 0 });
    expect(next.roster[0].kills).toBe(3);
    expect(next.namesUsed).toBe(5);
    expect(campaignBudget(next)).toBe(155); // 120 + 20 + 3 * 5, the dead man's kills are gone
  });

  it('gives every replacement a new, unused name', () => {
    const s = finishedWin();
    for (const id of ['p1', 'p2', 'p3']) unit(s, id).alive = false;
    const next = recordMission(newCampaign(), s, 3);
    expect(next.roster.map((r) => r.name)).toEqual(['Eriksen', 'Fontaine', 'Garcia', 'Dubois']);
    expect(next.fallen.map((r) => r.name)).toEqual(['Alvarez', 'Brandt', 'Chen']);
  });

  it('completes the campaign after winning the last mission', () => {
    const c = { ...newCampaign(), missionIndex: 2, missionsWon: 2 };
    const next = recordMission(c, finishedWin(), 3);
    expect(next).toMatchObject({ status: 'won', missionsWon: 3, missionIndex: 3 });
  });

  it('loses the campaign when the mission is lost', () => {
    const s = makeState(corridorRows('PPPPE'));
    s.status = 'lost';
    for (const id of ['p1', 'p2', 'p3', 'p4']) unit(s, id).alive = false;
    const next = recordMission(newCampaign(), s, 3);
    expect(next).toMatchObject({ status: 'lost', missionsWon: 0, missionIndex: 0 });
    expect(next.fallen).toHaveLength(4);
  });

  it('never mutates its inputs', () => {
    const c = newCampaign();
    const before = JSON.stringify(c);
    const s = finishedWin();
    unit(s, 'p1').kills = 4;
    unit(s, 'p2').alive = false;
    recordMission(c, s, 3);
    expect(JSON.stringify(c)).toBe(before);
    expect(unit(s, 'p1').kills).toBe(4);
  });

  it('throws when the mission is still being played', () => {
    expect(() => recordMission(newCampaign(), makeState(corridorRows('PPPPE')), 3)).toThrow(
      /not finished/,
    );
  });

  it('leaves roster slots without a matching unit untouched (small test maps)', () => {
    const s = makeState(corridorRows('P..')); // one soldier only
    s.status = 'won';
    unit(s, 'p1').kills = 2;
    const next = recordMission(newCampaign(), s, 3);
    expect(next.roster[0].kills).toBe(2);
    expect(next.roster.slice(1).map((r) => r.name)).toEqual(['Brandt', 'Chen', 'Dubois']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/campaign.test.ts`
Expected: FAIL with "Cannot find module '../src/core/campaign'".

- [ ] **Step 3: Write the implementation**

`src/core/campaign.ts`:

```ts
import type { GameState } from './types';

export const CAMPAIGN = { baseBudget: 120, winBonus: 20, killBonus: 5, rosterSize: 4 } as const;

export const SOLDIER_NAMES = [
  'Alvarez', 'Brandt', 'Chen', 'Dubois', 'Eriksen', 'Fontaine',
  'Garcia', 'Haddad', 'Ivanov', 'Jensen', 'Kowalski', 'Lindqvist',
];

export interface RosterSoldier {
  name: string;
  kills: number;
}

export interface Campaign {
  missionIndex: number;
  missionsWon: number;
  roster: RosterSoldier[];
  fallen: RosterSoldier[];
  namesUsed: number;
  status: 'active' | 'won' | 'lost';
}

export function soldierName(index: number): string {
  const base = SOLDIER_NAMES[index % SOLDIER_NAMES.length];
  const round = Math.floor(index / SOLDIER_NAMES.length);
  return round === 0 ? base : `${base} ${round + 1}`;
}

export function newCampaign(): Campaign {
  return {
    missionIndex: 0,
    missionsWon: 0,
    roster: Array.from({ length: CAMPAIGN.rosterSize }, (_, i) => ({ name: soldierName(i), kills: 0 })),
    fallen: [],
    namesUsed: CAMPAIGN.rosterSize,
    status: 'active',
  };
}

/** Kills by the soldiers still in the roster (fallen soldiers' kills do not count). */
export function totalKills(c: Campaign): number {
  return c.roster.reduce((sum, r) => sum + r.kills, 0);
}

export function campaignBudget(c: Campaign): number {
  return CAMPAIGN.baseBudget + CAMPAIGN.winBonus * c.missionsWon + CAMPAIGN.killBonus * totalKills(c);
}

export function budgetBreakdown(c: Campaign): string {
  return (
    `Base ${CAMPAIGN.baseBudget} + wins ${CAMPAIGN.winBonus * c.missionsWon}` +
    ` + kills ${CAMPAIGN.killBonus * totalKills(c)}`
  );
}

/** Folds a finished mission into the campaign. Pure: returns a new Campaign. */
export function recordMission(c: Campaign, finished: GameState, missionCount: number): Campaign {
  if (finished.status === 'playing') throw new Error('The mission is not finished');
  const players = finished.units.filter((u) => u.side === 'player');
  const roster: RosterSoldier[] = [];
  const fallen = c.fallen.map((f) => ({ ...f }));
  let namesUsed = c.namesUsed;

  c.roster.forEach((soldier, i) => {
    const unit = players[i];
    if (!unit) {
      roster.push({ ...soldier });
      return;
    }
    const updated = { name: soldier.name, kills: soldier.kills + unit.kills };
    if (unit.alive) {
      roster.push(updated);
    } else {
      fallen.push(updated);
      roster.push({ name: soldierName(namesUsed), kills: 0 });
      namesUsed += 1;
    }
  });

  const won = finished.status === 'won';
  const missionsWon = c.missionsWon + (won ? 1 : 0);
  const missionIndex = won ? c.missionIndex + 1 : c.missionIndex;
  const status = !won ? 'lost' : missionIndex >= missionCount ? 'won' : 'active';
  return { missionIndex, missionsWon, roster, fallen, namesUsed, status };
}
```

- [ ] **Step 4: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): add campaign rules, budget and mission recording"
```

---

### Task 4: Missions as data

**Files:**
- Create: `src/core/missions.ts`
- Modify: `src/core/mission1.ts`
- Test: `tests/missions.test.ts`

**Interfaces:**
- Consumes: `parseMap`, `applyLoadout`, `LOADOUT`, `updateExplored`, `RosterSoldier` (type only).
- Produces:
  - `interface MissionDef { id: string; name: string; rows: string[]; patrols: Record<string, Pos[]> }`
  - `MISSIONS: MissionDef[]` (3 entries: Outpost, Warehouse, Compound)
  - `MISSION1_ROWS` (exported, same rows as before)
  - `createMission(def: MissionDef, seed?: number, roster?: RosterSoldier[], loadout?: Loadout, budget?: number): GameState` (builds the state, sets patrols, applies the loadout with the budget, names the player units from the roster, computes explored tiles)
  - `createMission1(seed?, loadout?)` stays and delegates to `createMission(MISSIONS[0], ...)`

- [ ] **Step 1: Write the failing tests**

`tests/missions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/core/campaign';
import type { Loadout } from '../src/core/loadout';
import { createMission1 } from '../src/core/mission1';
import { MISSIONS, createMission } from '../src/core/missions';
import { unit } from './helpers';

const ENEMY_COUNTS = [4, 6, 8];

function find(rows: string[], ch: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === ch && out.push({ x, y })));
  return out;
}

/** Tiles reachable from the first soldier start; doors count as passable. */
function reachable(rows: string[]): Set<string> {
  const start = find(rows, 'P')[0];
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (ny < 0 || ny >= rows.length || nx < 0 || nx >= rows[0].length) continue;
      if (rows[ny][nx] === '#' || seen.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe('MISSIONS data', () => {
  it('has three missions with unique ids and names', () => {
    expect(MISSIONS).toHaveLength(3);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(3);
    expect(new Set(MISSIONS.map((m) => m.name)).size).toBe(3);
  });

  MISSIONS.forEach((m, index) => {
    describe(m.name, () => {
      it('is a 30x20 map with equal row widths', () => {
        expect(m.rows).toHaveLength(20);
        for (const row of m.rows) expect(row).toHaveLength(30);
      });

      it('has 4 soldier starts and the expected number of enemies', () => {
        expect(find(m.rows, 'P')).toHaveLength(4);
        expect(find(m.rows, 'E')).toHaveLength(ENEMY_COUNTS[index]);
      });

      it("has a patrol for every enemy that includes the enemy's own start", () => {
        const enemies = find(m.rows, 'E');
        expect(Object.keys(m.patrols).sort()).toEqual(enemies.map((_, i) => `e${i + 1}`).sort());
        enemies.forEach((pos, i) => {
          expect(m.patrols[`e${i + 1}`]).toContainEqual(pos);
        });
      });

      it('has every start, patrol point and item reachable from the soldiers', () => {
        const seen = reachable(m.rows);
        const points = [
          ...find(m.rows, 'P'), ...find(m.rows, 'E'),
          ...find(m.rows, 'r'), ...find(m.rows, 'p'), ...find(m.rows, 'g'),
          ...Object.values(m.patrols).flat(),
        ];
        for (const p of points) expect(seen.has(`${p.x},${p.y}`)).toBe(true);
        for (const p of Object.values(m.patrols).flat()) expect(m.rows[p.y][p.x]).not.toBe('#');
      });
    });
  });
});

describe('createMission', () => {
  const roster = newCampaign().roster;

  it('names the soldiers from the roster and sets the patrols', () => {
    const s = createMission(MISSIONS[1], 7, roster);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(s, id).name)).toEqual([
      'Alvarez', 'Brandt', 'Chen', 'Dubois',
    ]);
    expect(unit(s, 'e1').patrol).toEqual(MISSIONS[1].patrols.e1);
    expect(s.rngState).toBe(7);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(6);
    expect(s.units.every((u) => u.kills === 0)).toBe(true);
  });

  it('applies a loadout under a bigger budget', () => {
    const big: Loadout = [
      { weapon: 'rifle', grenades: 3 }, { weapon: 'rifle', grenades: 3 },
      { weapon: 'rifle', grenades: 3 }, { weapon: 'rifle', grenades: 3 },
    ]; // 196
    expect(() => createMission(MISSIONS[2], 1, roster, big)).toThrow(/budget/);
    const s = createMission(MISSIONS[2], 1, roster, big, 200);
    expect(unit(s, 'p4')).toMatchObject({ weapon: 'rifle', grenades: 3 });
  });

  it('starts with the squad area explored', () => {
    const s = createMission(MISSIONS[2], 1, roster);
    expect(s.explored[16][2]).toBe(true);
  });

  it('keeps Mission 1 exactly as it was', () => {
    const s = createMission1();
    expect(s.width).toBe(30);
    expect(s.height).toBe(20);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(4);
    expect(unit(s, 'e3').patrol).toEqual([{ x: 20, y: 9 }, { x: 23, y: 9 }]);
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', grenades: 1, name: 'P1' });
    expect(MISSIONS[0].patrols.e4).toEqual([{ x: 10, y: 15 }, { x: 24, y: 15 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/missions.test.ts`
Expected: FAIL with "Cannot find module '../src/core/missions'".

- [ ] **Step 3: Write missions.ts**

`src/core/missions.ts` (the Mission 2 and Mission 3 maps below were generated by a script and checked: all rows 30 wide, 4 soldier starts, 6 and 8 enemies, every start, patrol point and item reachable from the soldiers' start):

```ts
import type { RosterSoldier } from './campaign';
import { LOADOUT, applyLoadout, type Loadout } from './loadout';
import { parseMap } from './mission';
import type { GameState, Pos } from './types';
import { updateExplored } from './vision';

export interface MissionDef {
  id: string;
  name: string;
  rows: string[];
  /** Patrol routes by enemy id (e1, e2, ... in reading order). Each unit heads for patrol[patrolIndex]. */
  patrols: Record<string, Pos[]>;
}

export const MISSION1_ROWS: string[] = [
  '##############################',
  '#....#.........#.............#',
  '#....#.........#...E.....E...#',
  '#.p..#....r....#.............#',
  '#....+.........+.............#',
  '#....#....g....#.............#',
  '#....#.........#.............#',
  '##+#######+###########+#######',
  '#............................#',
  '#......................E.....#',
  '#....###........###..........#',
  '#....#............#..........#',
  '#....+............+..........#',
  '#....#............#..........#',
  '#....###........###..........#',
  '#.......................E....#',
  '#............................#',
  '#.P.P........................#',
  '#..P.P.......................#',
  '##############################',
];

const pt = (x: number, y: number): Pos => ({ x, y });

const MISSION_1: MissionDef = {
  id: 'outpost',
  name: 'Outpost',
  rows: MISSION1_ROWS,
  patrols: {
    e1: [pt(19, 5), pt(19, 2)],
    e2: [pt(25, 5), pt(25, 2)],
    e3: [pt(20, 9), pt(23, 9)],
    e4: [pt(10, 15), pt(24, 15)],
  },
};

const MISSION_2: MissionDef = {
  id: 'warehouse',
  name: 'Warehouse',
  rows: [
    '##############################',
    '#......#.........#...........#',
    '#..p...#....E....#......E....#',
    '#......+....r....+...........#',
    '#......#.........#......g....#',
    '####+#######+#########+#######',
    '#............................#',
    '#....................E.......#',
    '#.......................##...#',
    '#......####.............##...#',
    '#.g....####..................#',
    '#.................####.......#',
    '#.............E...####.......#',
    '#..........................E.#',
    '#............................#',
    '#............###.............#',
    '#............###.............#',
    '#.P.P....................E...#',
    '#..P.P.......................#',
    '##############################',
  ],
  patrols: {
    e1: [pt(12, 4), pt(12, 2)],
    e2: [pt(24, 4), pt(24, 2)],
    e3: [pt(16, 7), pt(21, 7)],
    e4: [pt(8, 12), pt(14, 12)],
    e5: [pt(27, 16), pt(27, 13)],
    e6: [pt(18, 17), pt(25, 17)],
  },
};

const MISSION_3: MissionDef = {
  id: 'compound',
  name: 'Compound',
  rows: [
    '##############################',
    '#........#..........#........#',
    '#...E....#....E.....#...E....#',
    '#........+.......r..+........#',
    '#........#..........#........#',
    '#........#..........#........#',
    '####+#########+#########+#####',
    '#........#..........#........#',
    '#........#..........#........#',
    '#...E....+....E.....+...E....#',
    '#.....p..#..........#........#',
    '#........#..........#...g....#',
    '#........#..........#........#',
    '####+##########+########+#####',
    '#............#......#........#',
    '#.....g......#......#........#',
    '#.P.P........+..E...+....E...#',
    '#..P.P.......#......#........#',
    '#............#......#........#',
    '##############################',
  ],
  patrols: {
    e1: [pt(4, 4), pt(4, 2)],
    e2: [pt(18, 2), pt(14, 2)],
    e3: [pt(26, 4), pt(24, 2)],
    e4: [pt(7, 11), pt(4, 9)],
    e5: [pt(14, 11), pt(14, 9)],
    e6: [pt(26, 11), pt(24, 9)],
    e7: [pt(18, 17), pt(16, 16)],
    e8: [pt(27, 17), pt(25, 16)],
  },
};

export const MISSIONS: MissionDef[] = [MISSION_1, MISSION_2, MISSION_3];

/**
 * Builds a playable state from a mission record. Without a roster the soldiers keep the default
 * names P1..P4; without a loadout they keep the default kit.
 */
export function createMission(
  def: MissionDef,
  seed = 1,
  roster?: RosterSoldier[],
  loadout?: Loadout,
  budget: number = LOADOUT.budget,
): GameState {
  let s = parseMap(def.rows, seed);
  for (const u of s.units) {
    const patrol = def.patrols[u.id];
    if (patrol) u.patrol = patrol.map((p) => ({ ...p }));
  }
  if (loadout) s = applyLoadout(s, loadout, budget);
  if (roster) {
    s.units
      .filter((u) => u.side === 'player')
      .forEach((u, i) => {
        if (roster[i]) u.name = roster[i].name;
      });
  }
  updateExplored(s);
  return s;
}
```

- [ ] **Step 4: Make mission1.ts a thin wrapper**

Replace the whole of `src/core/mission1.ts` with:

```ts
import type { Loadout } from './loadout';
import { MISSIONS, createMission } from './missions';
import type { GameState } from './types';

export { MISSION1_ROWS } from './missions';

export function createMission1(seed = 1, loadout?: Loadout): GameState {
  return createMission(MISSIONS[0], seed, undefined, loadout);
}
```

- [ ] **Step 5: Run the tests and the whole suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS (the existing Mission 1 tests in `tests/mission1.test.ts` and the AI and controller tests still pass), type check clean. If a map test fails, fix the map row, not the test.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(core): make missions data and add Missions 2 and 3"
```

---

### Task 5: Result and campaign-end screens, soldier names in the panel

**Files:**
- Replace: `src/screens/result.ts`
- Create: `src/screens/end.ts`
- Modify: `src/render/panel.ts`, `src/controller.ts`
- Test: `tests/resultscreen.test.ts` (unchanged and still passing), `tests/endscreen.test.ts`

**Interfaces:**
- Consumes: `MissionResult`, `VIEW`.
- Produces:
  - `interface ResultView { result: MissionResult; missionName: string; fallen: string[]; nextBudget: number | null }`; `resultHit(px, py): 'again' | null` (same button rectangle as before); `drawResult(ctx, view: ResultView)`
  - `interface EndView { won: boolean; missionsWon: number; missionCount: number; totalKills: number; survivors: string[]; fallen: string[] }`; `END` (card and button rectangles); `endHit(px, py): 'new' | null`; `clip(text: string, max: number): string`; `drawCampaignEnd(ctx, view: EndView)`
  - Panel and alert message show `unit.name`.

- [ ] **Step 1: Write the failing tests**

`tests/endscreen.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clip, endHit } from '../src/screens/end';

describe('endHit', () => {
  it('finds the New campaign button', () => {
    expect(endHit(240, 252)).toBe('new');
    expect(endHit(175, 240)).toBe('new');
  });

  it('ignores clicks elsewhere', () => {
    expect(endHit(240, 100)).toBeNull();
    expect(endHit(305, 266)).toBeNull(); // just outside the button
    expect(endHit(10, 10)).toBeNull();
  });
});

describe('clip', () => {
  it('leaves short text alone and shortens long text with dots', () => {
    expect(clip('short', 8)).toBe('short');
    expect(clip('abcdefghij', 8)).toBe('abcde...');
    expect(clip('abcdefgh', 8)).toBe('abcdefgh');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/endscreen.test.ts`
Expected: FAIL with "Cannot find module '../src/screens/end'".

- [ ] **Step 3: Replace src/screens/result.ts**

```ts
import type { MissionResult } from '../core/result';
import { VIEW } from '../render/layout';
import { clip } from './end';

export interface ResultView {
  result: MissionResult;
  missionName: string;
  fallen: string[];
  /** Budget for the next mission, or null when the campaign is over. */
  nextBudget: number | null;
}

export const RESULT = {
  card: { x: 110, y: 50, w: 260, h: 210 },
  again: { x: 190, y: 200, w: 100, h: 26 },
} as const;

export function resultHit(px: number, py: number): 'again' | null {
  const b = RESULT.again;
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h ? 'again' : null;
}

export function drawResult(ctx: CanvasRenderingContext2D, v: ResultView): void {
  const r = v.result;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = RESULT.card;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = '#3a3f55';
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = r.won ? '#7dff9a' : '#ff5555';
  ctx.fillText(r.won ? 'MISSION COMPLETE' : 'MISSION FAILED', c.x + c.w / 2, c.y + 14);
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(v.missionName, c.x + c.w / 2, c.y + 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`Survivors     ${r.survivors} of ${r.squadSize}`, c.x + 30, c.y + 52);
  ctx.fillText(`Enemies down  ${r.enemiesKilled} of ${r.enemyCount}`, c.x + 30, c.y + 68);
  ctx.fillText(`Turns taken   ${r.turns}`, c.x + 30, c.y + 84);
  ctx.fillText(`Fallen: ${clip(v.fallen.length > 0 ? v.fallen.join(', ') : 'none', 30)}`, c.x + 30, c.y + 100);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(
    v.nextBudget === null ? 'The campaign is over' : `Next mission budget: ${v.nextBudget}`,
    c.x + 30, c.y + 116,
  );

  const b = RESULT.again;
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#000';
  ctx.fillText('CONTINUE (Enter)', b.x + 6, b.y + (b.h - 8) / 2);
}
```

- [ ] **Step 4: Create src/screens/end.ts**

```ts
import { VIEW } from '../render/layout';

export interface EndView {
  won: boolean;
  missionsWon: number;
  missionCount: number;
  /** Kills by the roster and the fallen together. */
  totalKills: number;
  survivors: string[];
  fallen: string[];
}

export const END = {
  card: { x: 90, y: 30, w: 300, h: 260 },
  again: { x: 175, y: 240, w: 130, h: 26 },
} as const;

export function endHit(px: number, py: number): 'new' | null {
  const b = END.again;
  return px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h ? 'new' : null;
}

/** Shortens text to at most `max` characters, ending in "..." when it was cut. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

export function drawCampaignEnd(ctx: CanvasRenderingContext2D, v: EndView): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const c = END.card;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = '#3a3f55';
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = v.won ? '#7dff9a' : '#ff5555';
  ctx.fillText(v.won ? 'CAMPAIGN COMPLETE' : 'CAMPAIGN LOST', c.x + c.w / 2, c.y + 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e8f0';
  ctx.fillText(`Missions won  ${v.missionsWon} of ${v.missionCount}`, c.x + 30, c.y + 60);
  ctx.fillText(`Total kills   ${v.totalKills}`, c.x + 30, c.y + 80);
  ctx.fillText(
    `Survivors: ${clip(v.survivors.length > 0 ? v.survivors.join(', ') : 'none', 38)}`,
    c.x + 30, c.y + 110,
  );
  ctx.fillText(
    `Fallen (${v.fallen.length}): ${clip(v.fallen.length > 0 ? v.fallen.join(', ') : 'none', 34)}`,
    c.x + 30, c.y + 130,
  );

  const b = END.again;
  ctx.fillStyle = '#4da6ff';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#000';
  ctx.fillText('NEW CAMPAIGN (Enter)', b.x + 6, b.y + (b.h - 8) / 2);
}
```

- [ ] **Step 5: Show names in the panel and the alert message**

In `src/render/panel.ts` replace the line `ctx.fillText(\`${u.id.toUpperCase()}  HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}\`, 4, top + 4);` with:

```ts
    ctx.fillText(`${u.name}  HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}`, 4, top + 4);
```

In `src/controller.ts`, in `toggleAlert`, replace `${sel.id.toUpperCase()} on alert:` with `${sel.name} on alert:`.

- [ ] **Step 6: Run the tests, type check and build**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS (the existing `tests/resultscreen.test.ts` still passes because the button rectangle is unchanged; the `drawResult` callers in `app.ts` do not compile yet, so `tsc` reports errors only in `src/app.ts`: they are fixed in Task 6).

If `tsc` reports errors in `src/app.ts` only, that is expected here. Note it in the commit message.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(screens): add result view, campaign end screen and soldier names (app wiring follows)"
```

---

### Task 6: App campaign flow

**Files:**
- Replace: `src/app.ts`
- Replace: `tests/app.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 to 5, plus `Controller`, `Effects`, `createUiState`, `summarize`.
- Produces:
  - `type Screen = 'equipment' | 'mission' | 'result' | 'end'`
  - `interface AppOptions { newSeed?: () => number; missions?: MissionDef[]; createMission?: (def: MissionDef, seed: number, roster: RosterSoldier[], loadout: Loadout, budget: number) => GameState; clock?: () => number }`
  - `class App` with public `screen`, `campaign: Campaign`, `loadout`, `controller`, `result` and the same `click`, `move`, `leave`, `key(k, repeat?)`, `cancel`, `update(now)`, `draw(ctx, now)` methods.
  - Flow: Start mission builds the current mission with `campaignBudget`; when the mission ends (after the 1 second delay and idle) the campaign records it and the Result screen shows; Continue goes to the next mission's equipment screen (loadout `fitLoadout` to the new budget) when the campaign is active, otherwise to the end screen; New campaign resets everything.

- [ ] **Step 1: Write the tests (rewrite tests/app.test.ts)**

```ts
import { describe, expect, it } from 'vitest';
import { App, type AppOptions } from '../src/app';
import { campaignBudget } from '../src/core/campaign';
import { cheapLoadout, defaultLoadout, type Loadout } from '../src/core/loadout';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const START = { x: 240, y: 315 }; // Start mission button
const CONTINUE = { x: 240, y: 213 }; // Continue button on the result screen
const NEW_CAMPAIGN = { x: 240, y: 252 }; // New campaign button on the end screen

/** A tiny winnable map: no enemies, so the first command ends the mission as a win. */
const winTiny = (): GameState => makeState(corridorRows('P..'));

/** Four soldiers, no enemies: the first command wins. p2 dead with 3 kills, p1 has 2 kills. */
const winWithCasualty = (): GameState => {
  const s = makeState(corridorRows('PPPP'));
  unit(s, 'p2').alive = false;
  unit(s, 'p2').kills = 3;
  unit(s, 'p1').kills = 2;
  return s;
};

/** All four soldiers dead on the enemy's turn: the first enemy command loses the mission. */
const loseAll = (): GameState => {
  const s = makeState(corridorRows('PPPPE'));
  for (const id of ['p1', 'p2', 'p3', 'p4']) unit(s, id).alive = false;
  s.turn = 'enemy';
  return s;
};

/** An App with a clock the test controls, so post-switch input locks can be waited out. */
function make(opts: AppOptions = {}) {
  let t = 0;
  const app = new App({ clock: () => t, ...opts });
  return { app, wait: () => { t += 500; } };
}

/** Ends a winTiny-style mission: a Turn command wins, then the delay elapses. */
function endWin(app: App, t: number): void {
  app.controller!.key('e');
  app.update(t);
  app.update(t + 1100);
}

/** Plays one winTiny mission and presses Continue. */
function playWin(app: App, wait: () => void, t: number): void {
  app.click(START);
  endWin(app, t);
  wait();
  app.click(CONTINUE);
  wait();
}

describe('App flow', () => {
  it('opens on the equipment screen for Mission 1 with the default loadout', () => {
    const app = new App();
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
    expect(app.loadout).toEqual(defaultLoadout());
    expect(app.controller).toBeNull();
  });

  it('starts a mission with the chosen loadout and the roster names', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // weapon button of the third soldier: pistol to rifle
    expect(app.loadout[2].weapon).toBe('rifle');
    app.click(START);
    expect(app.screen).toBe('mission');
    expect(unit(app.controller!.state, 'p3').weapon).toBe('rifle');
    expect(unit(app.controller!.state, 'p4').weapon).toBe('pistol');
    expect(unit(app.controller!.state, 'p1').name).toBe('Alvarez');
  });

  it('Enter starts the mission from the equipment screen', () => {
    const app = new App();
    expect(app.key('Enter')).toBe(true);
    expect(app.screen).toBe('mission');
  });

  it('a blocked equipment click changes nothing', () => {
    const app = new App();
    app.click({ x: 100, y: 172 }); // third soldier to rifle: credits 117
    const before = app.loadout;
    app.click({ x: 100, y: 224 }); // fourth soldier to rifle needs 12 more credits
    expect(app.loadout).toBe(before);
  });

  it('records the mission and shows the result a second after it ends', () => {
    const { app } = make({ createMission: winTiny });
    app.click(START);
    app.controller!.key('e');
    app.update(1000);
    expect(app.controller!.state.status).toBe('won');
    app.update(1500);
    expect(app.screen).toBe('mission'); // still within the delay
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: true, survivors: 1, squadSize: 1 });
    expect(app.campaign).toMatchObject({ missionsWon: 1, missionIndex: 1, status: 'active' });
  });

  it('waits until the controller is idle before showing the result', () => {
    const { app } = make({ createMission: winTiny });
    app.click(START);
    app.controller!.key('e');
    app.update(1000);
    app.controller!.ui.busy = true;
    app.update(9000);
    expect(app.screen).toBe('mission');
    app.controller!.ui.busy = false;
    app.update(9100);
    expect(app.screen).toBe('result');
  });

  it('Continue after a win opens the next mission with a bigger budget and the same kit', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click({ x: 100, y: 172 }); // change the third soldier so the kept kit is visible
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
    expect(campaignBudget(app.campaign)).toBe(140); // 120 + 20 for the win, no kills
    expect(app.loadout[2].weapon).toBe('rifle'); // the previous kit still fits
    expect(app.controller).toBeNull();
  });

  it('kills by living soldiers raise the next budget', () => {
    const { app, wait } = make({
      createMission: () => {
        const s = winTiny();
        unit(s, 'p1').kills = 2;
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(campaignBudget(app.campaign)).toBe(150); // 120 + 20 + 2 * 5
  });

  it('replaces a fallen soldier with a rookie and his kills leave the budget', () => {
    const { app, wait } = make({ createMission: winWithCasualty });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.campaign.fallen).toEqual([{ name: 'Brandt', kills: 3 }]);
    expect(app.campaign.roster[1]).toEqual({ name: 'Eriksen', kills: 0 });
    expect(campaignBudget(app.campaign)).toBe(150); // 120 + 20 + 2 kills by Alvarez; Brandt's 3 are gone
  });

  it('falls back to the cheap kit when the previous kit no longer fits the budget', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    const bigKit: Loadout = Array.from({ length: 4 }, () => ({ weapon: 'rifle' as const, grenades: 3 }));
    app.loadout = bigKit; // 196, more than the next budget of 140
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.loadout).toEqual(cheapLoadout());
  });

  it('a lost mission ends the campaign: Continue shows the end screen, New campaign resets', () => {
    const { app, wait } = make({ createMission: loseAll });
    app.click({ x: 100, y: 172 });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    expect(app.screen).toBe('result');
    expect(app.result).toMatchObject({ won: false, survivors: 0 });
    expect(app.campaign.status).toBe('lost');
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('end');
    wait();
    app.click(NEW_CAMPAIGN);
    expect(app.screen).toBe('equipment');
    expect(app.campaign).toMatchObject({ missionIndex: 0, missionsWon: 0, status: 'active', fallen: [] });
    expect(app.loadout).toEqual(defaultLoadout());
  });

  it('winning the last mission shows Campaign complete, never a fourth mission', () => {
    const { app, wait } = make({ createMission: winTiny });
    playWin(app, wait, 1000);
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(1);
    playWin(app, wait, 10000);
    expect(app.campaign.missionIndex).toBe(2);
    app.click(START);
    endWin(app, 20000);
    expect(app.campaign).toMatchObject({ status: 'won', missionsWon: 3 });
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('end');
    wait();
    app.key('Enter'); // New campaign
    expect(app.screen).toBe('equipment');
    expect(app.campaign.missionIndex).toBe(0);
  });

  it('gives every mission a fresh state and a new seed', () => {
    const seeds = [111, 222, 333];
    const { app, wait } = make({
      newSeed: () => seeds.shift()!,
      createMission: (_def, seed) => {
        const s = winTiny();
        s.rngState = seed;
        return s;
      },
    });
    app.click(START);
    const first = app.controller!.state;
    expect(first.rngState).toBe(111);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    wait();
    app.click(START);
    expect(app.controller!.state.rngState).toBe(222);
    expect(app.controller!.state).not.toBe(first);
    expect(app.controller!.state.status).toBe('playing');
  });
});

describe('input routing', () => {
  it('ignores mission keys and clicks while the result is showing', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    wait(); // let the input guard expire so the clicks below really reach the result screen
    const state = app.controller!.state;
    expect(app.key(' ')).toBe(false);
    expect(app.key('e')).toBe(false);
    app.click({ x: 40, y: 40 });
    app.move({ x: 40, y: 40 });
    app.cancel();
    expect(app.controller!.state).toBe(state);
    expect(app.screen).toBe('result');
  });

  it('only Enter and the New campaign button act on the end screen', () => {
    const { app, wait } = make({ createMission: loseAll });
    app.click(START);
    app.controller!.run({ type: 'Turn', unitId: 'e1', facing: 6 });
    app.update(1000);
    app.update(2100);
    wait();
    app.click(CONTINUE);
    wait();
    expect(app.screen).toBe('end');
    expect(app.key(' ')).toBe(false);
    expect(app.key('e')).toBe(false);
    app.click({ x: 40, y: 40 });
    app.click(START); // the Start button pixels, but the end screen is showing
    expect(app.screen).toBe('end');
  });

  it('does not send equipment clicks to a running mission', () => {
    const { app, wait } = make();
    app.click(START);
    wait();
    const before = app.loadout;
    app.click({ x: 100, y: 172 });
    expect(app.loadout).toBe(before);
  });

  it('does not start a mission from the mission screen', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    const controller = app.controller;
    app.click(START);
    expect(app.controller).toBe(controller);
  });
});

describe('input guard after a screen switch', () => {
  it('ignores the second click of a double-click on Start instead of ordering a move', () => {
    const { app, wait } = make();
    app.click(START);
    const p1 = () => unit(app.controller!.state, 'p1').pos;
    const before = { ...p1() };
    app.click({ x: 200, y: 301 }); // top strip of the Start button is a map tile
    expect(p1()).toEqual(before);
    expect(app.controller!.ui.busy).toBe(false);
    wait();
    app.click({ x: 200, y: 301 });
    expect(app.controller!.ui.busy).toBe(true);
  });

  it('ignores a click right after Continue so it cannot change the new loadout', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.click(CONTINUE);
    expect(app.screen).toBe('equipment');
    app.click({ x: 260, y: 224 }); // fourth soldier's grenade minus, overlapping the Continue button
    expect(app.loadout[3].grenades).toBe(1);
    wait();
    app.click({ x: 260, y: 224 });
    expect(app.loadout[3].grenades).toBe(0);
  });

  it('does not chain Enter through screens, whether repeated or pressed twice quickly', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    wait();
    app.key('Enter'); // Result to Equipment
    expect(app.screen).toBe('equipment');
    app.key('Enter', true); // key auto-repeat
    expect(app.screen).toBe('equipment');
    app.key('Enter'); // pressed again within the guard
    expect(app.screen).toBe('equipment');
    wait();
    app.key('Enter');
    expect(app.screen).toBe('mission');
  });

  it('ignores Enter auto-repeat on the equipment screen too', () => {
    const app = new App();
    app.key('Enter', true);
    expect(app.screen).toBe('equipment');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app.test.ts`
Expected: FAIL (the old `App` has no campaign, `missions` option or end screen).

- [ ] **Step 3: Replace src/app.ts**

```ts
import { Controller } from './controller';
import {
  budgetBreakdown, campaignBudget, newCampaign, recordMission, totalKills,
  type Campaign, type RosterSoldier,
} from './core/campaign';
import { defaultLoadout, fitLoadout, validateLoadout, type Loadout } from './core/loadout';
import { MISSIONS, createMission, type MissionDef } from './core/missions';
import { summarize, type MissionResult } from './core/result';
import type { GameState, Pos } from './core/types';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import { screenToTile } from './render/layout';
import { buttonAt } from './render/panel';
import { drawGame } from './render/renderer';
import { drawCampaignEnd, endHit } from './screens/end';
import {
  applyEquipmentHit, drawEquipment, equipmentHit, type EquipmentHit, type EquipmentView,
} from './screens/equipment';
import { drawResult, resultHit } from './screens/result';

export type Screen = 'equipment' | 'mission' | 'result' | 'end';

const RESULT_DELAY_MS = 1000;
/** After any screen switch, clicks and Enter are ignored briefly so a double-click or held key cannot act on the next screen. */
const INPUT_LOCK_MS = 300;

export interface AppOptions {
  newSeed?: () => number;
  missions?: MissionDef[];
  createMission?: (
    def: MissionDef, seed: number, roster: RosterSoldier[], loadout: Loadout, budget: number,
  ) => GameState;
  clock?: () => number;
}

export class App {
  screen: Screen = 'equipment';
  campaign: Campaign = newCampaign();
  loadout: Loadout = defaultLoadout();
  controller: Controller | null = null;
  result: MissionResult | null = null;

  private hover: EquipmentHit | null = null;
  private endedAt: number | null = null;
  private lockedUntil = -Infinity;
  private fallenNow: string[] = [];
  private playedName = '';
  private readonly clock: () => number;
  private readonly newSeed: () => number;
  private readonly missions: MissionDef[];
  private readonly createMission: NonNullable<AppOptions['createMission']>;

  constructor(opts: AppOptions = {}) {
    this.clock = opts.clock ?? (() => performance.now());
    this.newSeed = opts.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));
    this.missions = opts.missions ?? MISSIONS;
    this.createMission =
      opts.createMission ??
      ((def, seed, roster, loadout, budget) => createMission(def, seed, roster, loadout, budget));
  }

  private lock(): void {
    this.lockedUntil = this.clock() + INPUT_LOCK_MS;
  }

  private locked(): boolean {
    return this.clock() < this.lockedUntil;
  }

  private mission(): MissionDef {
    return this.missions[Math.min(this.campaign.missionIndex, this.missions.length - 1)];
  }

  private budget(): number {
    return campaignBudget(this.campaign);
  }

  private startMission(): void {
    if (validateLoadout(this.loadout, this.budget()) !== null) return;
    const def = this.mission();
    const state = this.createMission(
      def, this.newSeed(), this.campaign.roster, this.loadout, this.budget(),
    );
    this.controller = new Controller(state, createUiState('p1'), new Effects());
    this.playedName = def.name;
    this.result = null;
    this.endedAt = null;
    this.screen = 'mission';
    this.lock();
  }

  /** From the result screen: the next mission's equipment while the campaign is active, else the end screen. */
  private continueFromResult(): void {
    if (this.campaign.status === 'active') {
      this.loadout = fitLoadout(this.loadout, this.budget());
      this.screen = 'equipment';
    } else {
      this.screen = 'end';
    }
    this.controller = null;
    this.endedAt = null;
    this.hover = null;
    this.lock();
  }

  private newCampaignScreen(): void {
    this.campaign = newCampaign();
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.endedAt = null;
    this.hover = null;
    this.screen = 'equipment';
    this.lock();
  }

  click(p: Pos): void {
    if (this.locked()) return;
    switch (this.screen) {
      case 'equipment': {
        const hit = equipmentHit(p.x, p.y);
        if (!hit) return;
        if (hit.kind === 'start') {
          this.startMission();
          return;
        }
        this.loadout = applyEquipmentHit(this.loadout, hit, this.budget());
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
        if (resultHit(p.x, p.y) === 'again') this.continueFromResult();
        return;
      case 'end':
        if (endHit(p.x, p.y) === 'new') this.newCampaignScreen();
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

  key(k: string, repeat = false): boolean {
    if (repeat && k === 'Enter') return true; // a held key must not chain screens
    switch (this.screen) {
      case 'equipment':
        if (k === 'Enter') {
          if (!this.locked()) this.startMission();
          return true;
        }
        return false;
      case 'mission':
        return this.controller ? this.controller.key(k) : false;
      case 'result':
        if (k === 'Enter') {
          if (!this.locked()) this.continueFromResult();
          return true;
        }
        return false;
      case 'end':
        if (k === 'Enter') {
          if (!this.locked()) this.newCampaignScreen();
          return true;
        }
        return false;
    }
  }

  cancel(): void {
    if (this.screen === 'mission') this.controller?.cancel();
  }

  /** Call once per frame. Records the finished mission and shows the result shortly after it ends. */
  update(now: number): void {
    const c = this.controller;
    if (this.screen !== 'mission' || !c) return;
    if (c.state.status === 'playing') {
      this.endedAt = null;
      return;
    }
    if (this.endedAt === null) this.endedAt = now;
    if (now - this.endedAt >= RESULT_DELAY_MS && !c.ui.busy) {
      const fallenBefore = this.campaign.fallen.length;
      this.result = summarize(c.state);
      this.campaign = recordMission(this.campaign, c.state, this.missions.length);
      this.fallenNow = this.campaign.fallen.slice(fallenBefore).map((f) => f.name);
      this.screen = 'result';
      this.endedAt = null;
      this.lock();
    }
  }

  private equipmentView(): EquipmentView {
    const c = this.campaign;
    return {
      budget: this.budget(),
      title: `MISSION ${c.missionIndex + 1} OF ${this.missions.length}: ${this.mission().name.toUpperCase()}`,
      breakdown: budgetBreakdown(c),
      soldiers: c.roster,
    };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.screen === 'equipment') {
      drawEquipment(ctx, this.loadout, this.hover, this.equipmentView());
      return;
    }
    if (this.screen === 'end') {
      const c = this.campaign;
      drawCampaignEnd(ctx, {
        won: c.status === 'won',
        missionsWon: c.missionsWon,
        missionCount: this.missions.length,
        totalKills: totalKills(c) + c.fallen.reduce((sum, f) => sum + f.kills, 0),
        survivors: c.status === 'won' ? c.roster.map((r) => r.name) : [],
        fallen: c.fallen.map((f) => f.name),
      });
      return;
    }
    const c = this.controller;
    if (!c) return;
    drawGame(ctx, c.state, c.ui, c.effects, now);
    if (this.screen === 'result' && this.result) {
      drawResult(ctx, {
        result: this.result,
        missionName: this.playedName,
        fallen: this.fallenNow,
        nextBudget: this.campaign.status === 'active' ? this.budget() : null,
      });
    }
  }
}
```

- [ ] **Step 4: Run the tests, type check and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all PASS, type check clean, build succeeds. If the test "falls back to the cheap kit" fails, check that `fitLoadout` is applied in `continueFromResult` and that the test assigns `app.loadout` after `app.click(START)` (so the mission start validation used the default kit).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: drive the campaign from App with result, end and next-mission flow"
```

---

### Task 7: Playtest the campaign, README, vault log, and the push question

**Files:**
- Modify: `README.md`; any file where the playtest finds a defect (add a regression test first)

**Interfaces:**
- Consumes: the whole game.
- Produces: a verified, documented milestone 3.

- [ ] **Step 1: Run the full automated checks**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, no type errors, `dist/` produced.

- [ ] **Step 2: Playtest the campaign in the browser**

Run `npm run dev` (or `play.bat`) and open the printed address. In dev mode the app is exposed as `window.app`. The browser pane may be hidden, which pauses animation frames: if the screen does not update, step the loop from the console with `app.update(performance.now()); app.draw(document.querySelector('canvas').getContext('2d'), performance.now())`. Check each item and fix defects test-first:

- The equipment screen shows `MISSION 1 OF 3: OUTPOST`, the budget line `Credits 102/120` and `Base 120 + wins 0 + kills 0`, and each row shows a soldier name (Alvarez, Brandt, Chen, Dubois) with `0 kills`.
- Start Mission 1; the panel shows the soldier's name. Win it quickly from the console: `app.controller.state.units.filter(u => u.side === 'enemy').forEach(u => { u.alive = false })`, give a soldier kills with `app.controller.state.units.find(u => u.id === 'p1').kills = 3`, then press `E`.
- The result card shows the mission name, survivors, `Fallen: none` and `Next mission budget: 155` (120 + 20 + 15). Continue shows `MISSION 2 OF 3: WAREHOUSE` with `Credits .../155` and `Alvarez` showing `3 kills`; the kit from Mission 1 is kept.
- Mission 2 has 6 enemies and the Warehouse layout; Mission 3 has 8 enemies and the Compound layout (check both render, soldiers start bottom-left, and enemies patrol).
- Make a casualty: kill a soldier from the console (`alive = false` with kills), win, and check the result lists him under Fallen, the next equipment screen shows a rookie with the next unused name and a lower budget.
- Win Mission 3: the screen after Continue is `CAMPAIGN COMPLETE` with missions won 3 of 3, total kills, survivors and fallen. New campaign (button or Enter) returns to `MISSION 1 OF 3` with `Alvarez` and a 120 budget.
- Lose a mission (set all soldiers `alive = false`, then press Space to end the turn so the enemy turn ends the mission): the result shows `MISSION FAILED`, Continue shows `CAMPAIGN LOST`, New campaign restarts.
- Space or a map click while the result card or end screen is showing does nothing.

- [ ] **Step 3: Update README.md**

In the Play section, replace the equipment-screen paragraph with:

```markdown
The game is a three-mission campaign with a persistent squad. Before each mission you equip four named soldiers from a shared budget (pistol 10, rifle 25, grenade 8, up to 3 grenades each) and press Start (or Enter). The budget starts at 120 and grows with each won mission (+20) and with each kill by soldiers who are still alive (+5), so protect your veterans. A soldier who dies is gone for good and replaced by a rookie. After each mission a result screen shows how it went; Continue (or Enter) moves on. Win all three missions for Campaign complete; if all four soldiers die the campaign is lost, and New campaign starts again.
```

- [ ] **Step 4: Commit**

```bash
git add README.md src tests
git commit -m "docs: describe the campaign; playtest fixes"
```

- [ ] **Step 5: Ask the user before pushing**

Do not push on your own. Ask: "Milestone 3 is playable and committed on branch `milestone-3`. Shall I push it to https://github.com/iurdivad-netizen/laser-tribute and open a pull request?" On a clear yes:

```bash
git push -u origin "$(git branch --show-current)"
```

(Pushing may need a GitHub sign-in in the browser; if it hangs, stop the stuck git processes and ask the user to sign in, then retry. Create the PR through the pre-filled compare URL on a desktop-size browser viewport, and do not merge it.)

- [ ] **Step 6: Write the vault Dev Log**

Per the user's global instructions, after reading `C:\Users\User\Documents\SecondBrain\_CLAUDE.md` and `index.md`, write `Dev Logs/2026-10-01 - Laser Tribute Milestone 3.md` in the SecondBrain vault (ai-first frontmatter, "For future agent" preamble, wikilinks to `[[Games/Laser Tribute]]` and the earlier dev logs), add a Recent Activity line and update the Open items in `Games/Laser Tribute.md`, add the dev log to `index.md`, and append a line to `Logs/YYYY-MM-DD.md`.

---

## Self-Review

**Spec coverage**

- Campaign flow (equipment, mission, result, next mission or end screens, New campaign): Task 6 (`App`), screens in Task 5.
- Soldiers carry over, gear does not; dead replaced by rookies with unique names from the 12-name list: Task 3 (`recordMission`, `soldierName`), Task 6 (equipment prefill and flow).
- Kill crediting (shots, reaction fire, grenade blasts, enemies only): Task 1.
- Budget formula and growth, fallen soldiers' kills leaving the budget: Task 3; breakdown line and display: Tasks 3 and 5/6.
- Missions as data (`MissionDef`, `MISSIONS`, `createMission`), Mission 1 unchanged, Missions 2 and 3 with 6 and 8 enemies, maps validated by tests: Task 4.
- Loadout rules take a budget and `fitLoadout` falls back to the cheap kit: Task 2 (rules) and Task 6 (flow).
- Screens: equipment (mission title, breakdown, names and kills), result (fallen, next budget, Continue), end screen (complete or lost, New campaign): Tasks 2, 5 and 6. Input guard applies to every switch: `lock()` in every `App` switch (Task 6).
- Edge cases: friendly-fire kill credited to nobody and still a casualty (Tasks 1 and 3), falling budget fallback (Tasks 2 and 6), last mission win goes to Campaign complete (Tasks 3 and 6), fresh state and seed per mission (Task 6 test), reload starts a new campaign (no saving, nothing to implement).
- Testing: pure rules in Tasks 1 to 4, maps in Task 4, screen flow in Task 6, playing in the browser in Task 7.
- Out of scope items (stat growth, items, saving, generated maps, scrolling) are not touched. Generated maps stay possible because missions are plain `MissionDef` records.

**Placeholders:** none. Every code step has full code. Task 5 Step 6 notes that `tsc` reports errors in `src/app.ts` only, until Task 6 replaces it.

**Type consistency:** `RosterSoldier`, `Campaign`, `MissionDef`, `Loadout`, `EquipmentView`, `ResultView`, `EndView` and the `App` option signature match across tasks. `recordMission` takes `(c, finished, missionCount)` everywhere. `createMission(def, seed, roster, loadout, budget)` has the same parameter order in `missions.ts`, `app.ts` and the tests. Test pixel coordinates (Start (240,315), Continue (240,213), New campaign (240,252), weapon button of the third soldier (100,172)) match the geometry constants in `equipment.ts`, `result.ts` and `end.ts`.

**Review Focus:** item 1 is tested in Task 2 (`fitLoadout`) and Task 6 ("falls back to the cheap kit"); item 2 in Task 1 ("does not credit killing his own side") and Task 3 (casualty recorded); item 3 in Task 3 ("completes the campaign") and Task 6 ("winning the last mission..." and the lost-campaign test); item 4 in Task 4 (map tests); item 5 in Task 6 ("input routing" and "input guard" tests).
