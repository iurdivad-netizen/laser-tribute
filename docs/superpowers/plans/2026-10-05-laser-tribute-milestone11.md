# Laser Tribute Milestone 11: Gadgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One gadget slot per soldier (medkit, body armour, motion scanner): bought on the equipment screen, carried through the stash rules, used in missions with a HEAL/SCAN panel button, with map markers and two sounds.

**Architecture:** Rules live in pure `src/core` (new `GADGETS` config, `Unit.gadget`, `GameState.scanned`, `Heal` and `Scan` commands, a `damageTaken` helper for armour, gadget fields in loadout and stash). The save parser accepts the new optional fields. UI work is the equipment button, one context button on the panel, a heal targeting mode, scan dots and an armour pip on the map, and two synthesized sounds.

**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-05-laser-tribute-milestone11-design.md`

## Global Constraints

- `src/core` stays pure and deterministic; gadgets use no randomness.
- Numbers (from the spec): medkit 12 cr, 12 AP, heals 25 (up to max HP), one use; armour 20 cr, every hit does 30% less damage computed as `raw - floor(raw * 30 / 100)` and never below 1 (30→21, 18→13, 40→28, 60→42); scanner 15 cr, 10 AP, radius 8 (Chebyshev), one use; heal range: self or adjacent (Chebyshev 1).
- One gadget per soldier: none, medkit, armour or scanner. `SoldierLoadout.gadget?: GadgetId` (absent means none) so the many existing loadout literals stay valid. `Unit.gadget: GadgetId | null`.
- Stash gains required `medkit`, `armour`, `scanner` counts; fix every `Stash` literal the typechecker reports by adding `medkit: 0, armour: 0, scanner: 0`.
- No gadget loot, enemies carry none. With no gadget chosen, behaviour, costs and saves are exactly as in milestone 10.
- Saves stay at version 1; new fields are optional on read.
- All on-screen text through `drawText`, characters the 5x7 font supports; canvas 480x400 unchanged.
- New test files: `tests/gadgetcore.test.ts`, `tests/healscan.test.ts`, `tests/gadgetstash.test.ts`, `tests/gadgetequip.test.ts`, `tests/gadgetpanel.test.ts`, `tests/gadgetmission.test.ts` (check each name is free with `ls tests`); otherwise append to existing files, never overwrite one.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Armour applies on all three damage paths (shot, grenade splash, stab) and never reduces a hit below 1; an unarmoured unit is unchanged.
- Heal and Scan reject cleanly (no gadget, low AP, wrong target) and consume the gadget only on success; heal never exceeds max HP; scan dots disappear when the player ends the turn and are never read by the enemy AI.
- Stash accounting: used gadgets vanish, unused or worn ones of survivors return (also when they were bought), the dead lose theirs, a lost mission changes nothing, the cap is 4 per gadget; the equipment price total equals the sum of the row prices with gadgets.
- Old saves (no gadget fields) still load; a bad gadget id or a negative stash gadget count is rejected or defaulted, never crashes.
- The panel still fits: ten buttons, no overlap, every label inside its button, longest names on the equipment screen and panel.

## File Structure

- Modify `src/core/types.ts`, `config.ts`, `mission.ts`, `combat.ts`, `actions/stab.ts`, `actions/throw.ts`, `actions/endTurn.ts`, `apply.ts`, `loadout.ts`, `stash.ts`, `loot.ts`, `src/save.ts`, `src/screens/equipment.ts`, `src/render/panel.ts`, `src/input/uiState.ts`, `src/controller.ts`, `src/render/renderer.ts`, `src/render/effects.ts`, `src/audio/effects.ts`, `src/audio/mapping.ts`.
- Create `src/core/actions/heal.ts`, `src/core/actions/scan.ts`.

---

### Task 1: Gadget data, armour and scan state

**Files:**
- Modify: `src/core/types.ts`, `src/core/config.ts`, `src/core/mission.ts`, `src/core/combat.ts`, `src/core/actions/stab.ts`, `src/core/actions/throw.ts`, `src/core/actions/endTurn.ts`
- Test: create `tests/gadgetcore.test.ts`

**Interfaces:**
- Produces: `type GadgetId = 'medkit' | 'armour' | 'scanner'` (types.ts); `Unit.gadget: GadgetId | null`; `GameState.scanned: Pos[]`; `GADGET_IDS: readonly GadgetId[]` and `GADGETS` (config.ts); `damageTaken(target: Unit, raw: number): number` (combat.ts).

- [ ] **Step 1: Write the failing tests**

Create `tests/gadgetcore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { damageTaken } from '../src/core/combat';
import { GADGETS, GADGET_IDS } from '../src/core/config';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

describe('gadget data', () => {
  it('lists the three gadgets with the agreed numbers', () => {
    expect([...GADGET_IDS]).toEqual(['medkit', 'armour', 'scanner']);
    expect(GADGETS.medkit).toMatchObject({ price: 12, apCost: 12, heal: 25 });
    expect(GADGETS.armour).toMatchObject({ price: 20, reductionPct: 30 });
    expect(GADGETS.scanner).toMatchObject({ price: 15, apCost: 10, radius: 8 });
  });

  it('every unit starts with no gadget and the state with no scan', () => {
    const s = makeState(corridorRows('P.E'));
    expect(s.units.every((u) => u.gadget === null)).toBe(true);
    expect(s.scanned).toEqual([]);
  });
});

describe('damageTaken', () => {
  it('is the raw damage without armour', () => {
    const s = makeState(corridorRows('P.E'));
    expect(damageTaken(unit(s, 'p1'), 30)).toBe(30);
  });

  it('takes 30% off, rounded so the soldier gets the benefit of the floor, and never below 1', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    p.gadget = 'armour';
    expect([30, 18, 40, 60].map((d) => damageTaken(p, d))).toEqual([21, 13, 28, 42]);
    expect(damageTaken(p, 1)).toBe(1);
    expect(damageTaken(p, 2)).toBe(2);
  });

  it('other gadgets do not reduce damage', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    p.gadget = 'medkit';
    expect(damageTaken(p, 30)).toBe(30);
  });
});

describe('armour in combat', () => {
  it('reduces a rifle hit', () => {
    const s = makeState(corridorRows('P.E'));
    s.rngState = seedForRoll((n) => n < 0.05);
    unit(s, 'p1').facing = 2;
    const e = unit(s, 'e1');
    e.hp = e.maxHp = 100;
    e.gadget = 'armour';
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(79); // rifle 30 -> 21
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: true, damage: 21 }));
  });

  it('reduces a stab and grenade splash', () => {
    const stab = makeState(corridorRows('PE'));
    stab.rngState = seedForRoll((n) => n < 0.9);
    const e = unit(stab, 'e1');
    e.hp = e.maxHp = 100;
    e.gadget = 'armour';
    const r = ok(applyCommand(stab, { type: 'Stab', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(58); // knife 60 -> 42

    const nade = makeState(corridorRows('P..E'));
    const t = unit(nade, 'e1');
    t.hp = t.maxHp = 100;
    t.gadget = 'armour';
    const g = ok(applyCommand(nade, { type: 'Throw', unitId: 'p1', at: { x: 4, y: 1 } }));
    expect(unit(g.state, 'e1').hp).toBe(72); // grenade 40 -> 28
  });
});

describe('scan state', () => {
  it('is cleared when the player ends the turn', () => {
    const s = makeState(corridorRows('P.E'));
    s.scanned = [{ x: 3, y: 1 }];
    const r = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(r.state.scanned).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gadgetcore.test.ts`
Expected: FAIL (`damageTaken`, `GADGETS` not defined).

- [ ] **Step 3: Implement**

`src/core/types.ts`: add `export type GadgetId = 'medkit' | 'armour' | 'scanner';` next to `WeaponId`. In `Unit` add after `kills`:

```ts
  /** The one gadget carried: 'medkit' and 'scanner' are used up, 'armour' is worn for the whole mission. */
  gadget: GadgetId | null;
```

In `GameState` add after `enemyMemory`:

```ts
  /** Enemy positions found by a scan this turn; cleared when the player ends the turn. Never read by the AI. */
  scanned: Pos[];
```

`src/core/config.ts`: import `GadgetId` with `WeaponId`; add:

```ts
export const GADGET_IDS: readonly GadgetId[] = ['medkit', 'armour', 'scanner'];

export const GADGETS = {
  medkit: { name: 'Medkit', price: 12, apCost: 12, heal: 25 },
  armour: { name: 'Armour', price: 20, reductionPct: 30 },
  scanner: { name: 'Scanner', price: 15, apCost: 10, radius: 8 },
} as const;
```

`src/core/mission.ts`: in `makeUnit` add `gadget: null,` after `kills: 0,`; in the returned state add `scanned: [],` after `enemyMemory: null,`.

`src/core/combat.ts`: import `GADGETS` from `./config` (it already imports `WEAPONS`); add and export:

```ts
/** The damage a hit does to `target`: armour takes 30% off (rounded in the wearer's favour), never below 1. */
export function damageTaken(target: Unit, raw: number): number {
  if (target.gadget !== 'armour') return raw;
  return Math.max(1, raw - Math.floor((raw * GADGETS.armour.reductionPct) / 100));
}
```

In `fireShot` replace `damage = WEAPONS[shooter.weapon].damage;` with `damage = damageTaken(target, WEAPONS[shooter.weapon].damage);`.

`src/core/actions/stab.ts`: import `damageTaken` from `../combat`; replace `const damage = hit ? CONFIG.knife.damage : 0;` with `const damage = hit ? damageTaken(target, CONFIG.knife.damage) : 0;`.

`src/core/actions/throw.ts`: import `damageTaken` from `../combat`; in the loop replace the damage lines with:

```ts
    const dealt = damageTaken(u, g.damage);
    u.hp = Math.max(0, u.hp - dealt);
    hits.push({ unitId: u.id, damage: dealt });
```

`src/core/actions/endTurn.ts`: after `s.reacted = [];` add `s.scanned = [];`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/gadgetcore.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; whole suite green; typecheck clean (if a test builds a `GameState` or `Unit` literal, add `gadget: null` / `scanned: []`).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): gadget data, armour damage reduction, scan state"
```

---

### Task 2: Heal and Scan

**Files:**
- Create: `src/core/actions/heal.ts`, `src/core/actions/scan.ts`
- Modify: `src/core/types.ts`, `src/core/apply.ts`
- Test: create `tests/healscan.test.ts`

**Interfaces:**
- Consumes: `GADGETS`, `NOT_ENOUGH_AP` (config), `chebyshev`.
- Produces: commands `{ type: 'Heal'; unitId; targetId }` and `{ type: 'Scan'; unitId }`; events `{ type: 'healed'; unitId; targetId; amount: number; at: Pos }` and `{ type: 'scanned'; unitId; found: Pos[] }`; `handleHeal`, `handleScan`.

- [ ] **Step 1: Write the failing tests**

Create `tests/healscan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

const heal = (unitId = 'p1', targetId = 'p2') => ({ type: 'Heal' as const, unitId, targetId });
const scan = (unitId = 'p1') => ({ type: 'Scan' as const, unitId });

/** p1 (medic) beside p2, enemy further along. */
function squad() {
  const s = makeState(corridorRows('PP..E'));
  unit(s, 'p1').gadget = 'medkit';
  unit(s, 'p2').hp = 20;
  return s;
}

describe('Heal', () => {
  it('heals an adjacent teammate by 25, spends 12 AP and uses up the medkit', () => {
    const r = ok(applyCommand(squad(), heal()));
    expect(unit(r.state, 'p2').hp).toBe(45);
    expect(unit(r.state, 'p1').ap).toBe(60 - 12);
    expect(unit(r.state, 'p1').gadget).toBeNull();
    expect(r.events).toContainEqual({ type: 'healed', unitId: 'p1', targetId: 'p2', amount: 25, at: { x: 2, y: 1 } });
  });

  it('never goes above max HP, and reports the amount actually healed', () => {
    const s = squad();
    unit(s, 'p2').hp = 40;
    const r = ok(applyCommand(s, heal()));
    expect(unit(r.state, 'p2').hp).toBe(50);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'healed', amount: 10 }));
  });

  it('can heal the medic itself', () => {
    const s = squad();
    unit(s, 'p1').hp = 10;
    const r = ok(applyCommand(s, heal('p1', 'p1')));
    expect(unit(r.state, 'p1').hp).toBe(35);
  });

  it('counts a diagonal neighbour as adjacent', () => {
    const s = makeState(['#####', '#P..#', '#.P.#', '#..E#', '#####']);
    unit(s, 'p1').gadget = 'medkit';
    unit(s, 'p2').hp = 10;
    expect(applyCommand(s, heal()).ok).toBe(true);
  });

  it('rejects: no medkit, wrong gadget, too far, full health, dead, enemy, low AP', () => {
    const none = squad();
    unit(none, 'p1').gadget = null;
    expect(reason(applyCommand(none, heal()))).toBe('No medkit');
    const scanner = squad();
    unit(scanner, 'p1').gadget = 'scanner';
    expect(reason(applyCommand(scanner, heal()))).toBe('No medkit');
    const far = makeState(corridorRows('P.P.E'));
    unit(far, 'p1').gadget = 'medkit';
    unit(far, 'p2').hp = 10;
    expect(reason(applyCommand(far, heal()))).toBe('The target is too far away');
    const full = squad();
    unit(full, 'p2').hp = 50;
    expect(reason(applyCommand(full, heal()))).toBe('Already at full health');
    const dead = squad();
    unit(dead, 'p2').alive = false;
    expect(reason(applyCommand(dead, heal()))).toBe('No such target');
    expect(reason(applyCommand(squad(), heal('p1', 'e1')))).toBe('Can only heal your own side');
    const low = squad();
    unit(low, 'p1').ap = 11;
    expect(reason(applyCommand(low, heal()))).toBe('Not enough action points');
  });

  it('a failed heal keeps the medkit and the AP', () => {
    const s = squad();
    unit(s, 'p2').hp = 50;
    expect(applyCommand(s, heal()).ok).toBe(false);
    expect(unit(s, 'p1').gadget).toBe('medkit');
    expect(unit(s, 'p1').ap).toBe(60);
  });
});

describe('Scan', () => {
  it('marks living enemies within 8 tiles through walls, spends 10 AP and uses up the scanner', () => {
    const s = makeState(['###########', '#P.#..E...#', '###########']);
    unit(s, 'p1').gadget = 'scanner';
    const r = ok(applyCommand(s, scan()));
    expect(r.state.scanned).toEqual([{ x: 6, y: 1 }]);
    expect(unit(r.state, 'p1').ap).toBe(50);
    expect(unit(r.state, 'p1').gadget).toBeNull();
    expect(r.events).toContainEqual({ type: 'scanned', unitId: 'p1', found: [{ x: 6, y: 1 }] });
  });

  it('includes an enemy exactly 8 tiles away and excludes one 9 away and the dead', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(7) + 'E.E')); // E at distance 8 and 10
    unit(s, 'p1').gadget = 'scanner';
    const r = ok(applyCommand(s, scan()));
    expect(r.state.scanned).toEqual([{ x: 9, y: 1 }]);
    const dead = makeState(corridorRows('P..E'));
    unit(dead, 'p1').gadget = 'scanner';
    unit(dead, 'e1').alive = false;
    expect(ok(applyCommand(dead, scan())).state.scanned).toEqual([]);
  });

  it('with nobody in range it still spends the scanner and the AP', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(12) + 'E'));
    unit(s, 'p1').gadget = 'scanner';
    const r = ok(applyCommand(s, scan()));
    expect(r.state.scanned).toEqual([]);
    expect(unit(r.state, 'p1').gadget).toBeNull();
    expect(unit(r.state, 'p1').ap).toBe(50);
  });

  it('rejects without a scanner or with too little AP, and changes nothing', () => {
    const none = makeState(corridorRows('P..E'));
    expect(reason(applyCommand(none, scan()))).toBe('No scanner');
    const low = makeState(corridorRows('P..E'));
    unit(low, 'p1').gadget = 'scanner';
    unit(low, 'p1').ap = 9;
    expect(reason(applyCommand(low, scan()))).toBe('Not enough action points');
    expect(unit(low, 'p1').gadget).toBe('scanner');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/healscan.test.ts`
Expected: FAIL (the commands are unknown, type errors aside the AI/apply switch has no case).

- [ ] **Step 3: Implement**

`src/core/types.ts`: add to `Command`:

```ts
  | { type: 'Heal'; unitId: string; targetId: string }
  | { type: 'Scan'; unitId: string }
```

and to `GameEvent`:

```ts
  | { type: 'healed'; unitId: string; targetId: string; amount: number; at: Pos }
  | { type: 'scanned'; unitId: string; found: Pos[] }
```

Create `src/core/actions/heal.ts`:

```ts
import { GADGETS, NOT_ENOUGH_AP } from '../config';
import { chebyshev } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

/** A medkit heals the medic or an adjacent teammate by 25 HP (never above max) and is used up. */
export function handleHeal(
  s: GameState,
  cmd: Extract<Command, { type: 'Heal' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (unit.gadget !== 'medkit') return 'No medkit';
  const target = s.units.find((u) => u.id === cmd.targetId);
  if (!target || !target.alive) return 'No such target';
  if (target.side !== unit.side) return 'Can only heal your own side';
  if (chebyshev(unit.pos, target.pos) > 1) return 'The target is too far away';
  if (target.hp >= target.maxHp) return 'Already at full health';
  if (unit.ap < GADGETS.medkit.apCost) return NOT_ENOUGH_AP;

  unit.ap -= GADGETS.medkit.apCost;
  unit.gadget = null;
  const amount = Math.min(GADGETS.medkit.heal, target.maxHp - target.hp);
  target.hp += amount;
  events.push({ type: 'healed', unitId: unit.id, targetId: target.id, amount, at: { ...target.pos } });
  return null;
}
```

Create `src/core/actions/scan.ts`:

```ts
import { GADGETS, NOT_ENOUGH_AP } from '../config';
import { chebyshev } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

/** A scanner marks every living enemy within 8 tiles (walls do not matter) until the turn ends, and is used up. */
export function handleScan(
  s: GameState,
  _cmd: Extract<Command, { type: 'Scan' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (unit.gadget !== 'scanner') return 'No scanner';
  if (unit.ap < GADGETS.scanner.apCost) return NOT_ENOUGH_AP;

  unit.ap -= GADGETS.scanner.apCost;
  unit.gadget = null;
  const found = s.units
    .filter((u) => u.alive && u.side !== unit.side && chebyshev(unit.pos, u.pos) <= GADGETS.scanner.radius)
    .map((u) => ({ ...u.pos }));
  s.scanned = found;
  events.push({ type: 'scanned', unitId: unit.id, found: found.map((p) => ({ ...p })) });
  return null;
}
```

`src/core/apply.ts`: import both handlers and add to `dispatch`:

```ts
    case 'Heal':
      return handleHeal(s, cmd, unit, events);
    case 'Scan':
      return handleScan(s, cmd, unit, events);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/healscan.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean (`ai.ts` may need no change: it builds only existing command types).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): Heal and Scan commands"
```

---

### Task 3: Loadout and stash with gadgets

**Files:**
- Modify: `src/core/loadout.ts`, `src/core/stash.ts`, `src/core/loot.ts`, every `Stash` literal the typechecker reports (tests included)
- Test: create `tests/gadgetstash.test.ts`

**Interfaces:**
- Consumes: `GADGETS`, `GADGET_IDS` (Task 1), `GadgetId`.
- Produces: `SoldierLoadout.gadget?: GadgetId`; `LOADOUT.prices` untouched, gadget prices come from `GADGETS`; `Stash` with `medkit`, `armour`, `scanner`; `Cover.gadget: boolean`; `fitLoadout` drops gadgets after extra clips and before falling back to the cheap kit; `describeStash` lists gadgets; `capStash` caps each gadget at 4.

- [ ] **Step 1: Write the failing tests**

Create `tests/gadgetstash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyLoadout, defaultLoadout, fitLoadout, loadoutCost, netSoldierCost, soldierCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { addStash, capStash, lootFrom } from '../src/core/loot';
import { coverage, describeStash, emptyStash, nextStash } from '../src/core/stash';
import { corridorRows, makeState, unit } from './helpers';

const withGadget = (g: 'medkit' | 'armour' | 'scanner' | undefined, i = 0): Loadout =>
  defaultLoadout().map((s, j) => (j === i ? { ...s, gadget: g } : s));

describe('gadget prices', () => {
  it('add to the soldier and the loadout cost', () => {
    const base = soldierCost(defaultLoadout()[0]);
    expect(soldierCost(withGadget('medkit')[0])).toBe(base + 12);
    expect(soldierCost(withGadget('armour')[0])).toBe(base + 20);
    expect(soldierCost(withGadget('scanner')[0])).toBe(base + 15);
    expect(loadoutCost(withGadget('armour'))).toBe(loadoutCost(defaultLoadout()) + 20);
  });

  it('a stashed gadget is free, and the row prices still add up to the total', () => {
    const stash = { ...emptyStash(), armour: 1 };
    const l = withGadget('armour');
    expect(coverage(l, stash)[0].gadget).toBe(true);
    expect(loadoutCost(l, stash)).toBe(loadoutCost(defaultLoadout()));
    const rows = l.reduce((sum, _s, i) => sum + netSoldierCost(l, i, stash), 0);
    expect(rows).toBe(loadoutCost(l, stash));
  });

  it('the stash is handed out in soldier order', () => {
    const l = defaultLoadout().map((s) => ({ ...s, gadget: 'medkit' as const }));
    const cover = coverage(l, { ...emptyStash(), medkit: 2 });
    expect(cover.map((c) => c.gadget)).toEqual([true, true, false, false]);
  });
});

describe('validateLoadout and fitLoadout', () => {
  it('accepts no gadget and each known gadget, rejects an unknown id', () => {
    for (const g of [undefined, 'medkit', 'armour', 'scanner'] as const) {
      expect(validateLoadout(withGadget(g), 200)).toBeNull();
    }
    const bad = defaultLoadout().map((s) => ({ ...s, gadget: 'laser' as never }));
    expect(validateLoadout(bad, 200)).toMatch(/gadget/i);
  });

  it('drops gadgets after extra clips and before falling back to the cheap kit', () => {
    const l = defaultLoadout().map((s) => ({ ...s, gadget: 'armour' as const })); // 102 + 80 = 182
    const fitted = fitLoadout(l, 120);
    expect(fitted.every((s) => s.gadget === undefined)).toBe(true);
    expect(fitted.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
  });
});

describe('applyLoadout', () => {
  it('gives each soldier the chosen gadget', () => {
    const state = makeState(corridorRows('PPPPE'));
    const l = defaultLoadout();
    l[0].gadget = 'medkit';
    l[2] = { ...l[2], gadget: 'armour' };
    const next = applyLoadout(state, l, 200);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).gadget)).toEqual(['medkit', null, 'armour', null]);
  });
});

describe('stash with gadgets', () => {
  const finished = () => {
    const s = makeState(corridorRows('PPPPE'));
    s.status = 'won';
    return s;
  };

  it('starts empty and lists gadgets', () => {
    expect(emptyStash()).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
    expect(describeStash({ ...emptyStash(), medkit: 2, armour: 1, scanner: 1 })).toBe('2 medkits, 1 armour, 1 scanner');
  });

  it('returns an unused medkit or scanner and worn armour of survivors, bought or lent', () => {
    const used = defaultLoadout();
    used[0].gadget = 'medkit';
    used[1] = { ...used[1], gadget: 'armour' };
    used[2] = { ...used[2], gadget: 'scanner' };
    const s = finished();
    unit(s, 'p1').gadget = 'medkit';
    unit(s, 'p2').gadget = 'armour';
    unit(s, 'p3').gadget = 'scanner';
    const next = nextStash(emptyStash(), used, s);
    expect(next).toMatchObject({ medkit: 1, armour: 1, scanner: 1 });
  });

  it('a used gadget is gone, and a dead soldier loses theirs', () => {
    const used = defaultLoadout();
    used[0].gadget = 'medkit';
    used[1] = { ...used[1], gadget: 'armour' };
    const s = finished();
    unit(s, 'p1').gadget = null; // used up
    unit(s, 'p2').gadget = 'armour';
    unit(s, 'p2').alive = false;
    expect(nextStash(emptyStash(), used, s)).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
  });

  it('a lent gadget leaves the stash and comes back only if still carried', () => {
    const used = withGadget('medkit');
    const stash = { ...emptyStash(), medkit: 1 };
    const kept = finished();
    unit(kept, 'p1').gadget = 'medkit';
    expect(nextStash(stash, used, kept).medkit).toBe(1);
    const spent = finished();
    unit(spent, 'p1').gadget = null;
    expect(nextStash(stash, used, spent).medkit).toBe(0);
  });

  it('caps each gadget at 4 and loot carries no gadgets', () => {
    const big = { ...emptyStash(), medkit: 9, armour: 9, scanner: 9 };
    expect(capStash(big)).toMatchObject({ medkit: 4, armour: 4, scanner: 4 });
    expect(lootFrom(finished())).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
    expect(addStash(big, big)).toMatchObject({ medkit: 18, armour: 18, scanner: 18 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gadgetstash.test.ts`
Expected: FAIL (gadget fields and logic missing).

- [ ] **Step 3: Implement**

`src/core/loadout.ts`: import `GADGETS` and `GADGET_IDS` with the existing config imports and `GadgetId` from `./types`; add to `SoldierLoadout`:

```ts
  /** The one gadget carried; absent means none. */
  gadget?: GadgetId;
```

`soldierCost`: append `+ (s.gadget ? GADGETS[s.gadget].price : 0)`. In `loadoutCost`'s `free` reduce and in `netSoldierCost`, subtract the gadget price when `c.gadget` is true:

```ts
      sum + (c.weapon ? LOADOUT.prices[l[i].weapon] : 0) + c.grenades * LOADOUT.prices.grenade + c.clips * LOADOUT.prices.clip
        + (c.gadget && l[i].gadget ? GADGETS[l[i].gadget!].price : 0),
```

and in `netSoldierCost` add `- (c.gadget && l[i].gadget ? GADGETS[l[i].gadget!].price : 0)` to the expression. `validateLoadout`: inside the per-soldier loop add

```ts
    if (s.gadget !== undefined && !GADGET_IDS.includes(s.gadget)) return `Soldier ${i + 1} has an unknown gadget`;
```

`fitLoadout`: replace the tail with

```ts
  const trimmed = previous.map((s) => ({ ...s, clips: 1 }));
  if (validateLoadout(trimmed, budget, stash) === null) return trimmed;
  const bare = trimmed.map(({ gadget: _gadget, ...rest }) => rest);
  return validateLoadout(bare, budget, stash) === null ? bare : cheapLoadout();
```

`applyLoadout`: inside the soldier loop add `u.gadget = l[i].gadget ?? null;`.

`src/core/stash.ts`: import `GadgetId` from `./types` and `GADGET_IDS` from `./config`. Add to `Stash`:

```ts
  medkit: number;
  armour: number;
  scanner: number;
```

`emptyStash` returns `{ rifle: 0, pistol: 0, grenade: 0, clip: 0, medkit: 0, armour: 0, scanner: 0 }`. `Cover` gains `gadget: boolean`. In `coverage` replace the end of the map callback:

```ts
    const g = s.gadget;
    const gadget = !!g && left[g] > 0;
    if (gadget && g) left[g] -= 1;
    return { weapon, grenades, clips, gadget };
```

In `nextStash`: in the first loop add `if (cover[i].gadget && s.gadget) next[s.gadget] -= 1;`; in the survivors loop add `if (s.gadget && u.gadget === s.gadget) next[s.gadget] += 1; // carried through the mission: lent or bought, it comes back`. `describeStash`: append

```ts
    stash.medkit > 0 ? plural(stash.medkit, 'medkit', 'medkits') : '',
    stash.armour > 0 ? plural(stash.armour, 'armour', 'armour') : '',
    stash.scanner > 0 ? plural(stash.scanner, 'scanner', 'scanners') : '',
```

`src/core/loot.ts`: `addStash` adds the three new counts; `lootFrom` starts from `emptyStash()`-shaped zeros (import `emptyStash`); `capStash` returns `medkit: Math.min(s.medkit, 4)`, same for `armour` and `scanner` (add `gadgets: 4` to `STASH_CAP`).

Then run `npx tsc --noEmit` and fix every reported `Stash` literal by adding `medkit: 0, armour: 0, scanner: 0` (about 47 in `tests/app.test.ts`, `equipment.test.ts`, `layout.test.ts`, `loot.test.ts`, `save.test.ts`, `stash.test.ts`, plus `src/save.ts`, which Task 4 finishes: for now give its `stash()` return the three fields as `0`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/gadgetstash.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): gadgets in the loadout, prices and stash"
```

---

### Task 4: Saves

**Files:**
- Modify: `src/save.ts`
- Test: append to `tests/save.test.ts`

**Interfaces:**
- Consumes: Task 3's `Stash` and `SoldierLoadout.gadget`.
- Produces: `parseSave` accepts an optional `gadget` on each loadout entry and optional `medkit`/`armour`/`scanner` counts in the stash.

- [ ] **Step 1: Write the failing tests**

Append to `tests/save.test.ts`:

```ts
describe('gadgets in a save', () => {
  it('an old save without gadget fields still loads, with no gadgets and an empty gadget stash', () => {
    const save = parseSave(json((o) => {
      delete o.campaign.stash.medkit;
      delete o.campaign.stash.armour;
      delete o.campaign.stash.scanner;
    }), 3)!;
    expect(save.campaign.stash).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
    expect(save.loadout.every((s) => s.gadget === undefined)).toBe(true);
  });

  it('round-trips gadgets in the loadout and the stash', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    const c = played();
    c.stash = { ...c.stash, medkit: 2, armour: 1, scanner: 3 };
    const loadout = defaultLoadout();
    loadout[0] = { ...loadout[0], gadget: 'medkit' };
    loadout[3] = { ...loadout[3], gadget: 'armour' };
    store.save(c, loadout);
    expect(store.load()).toEqual({ campaign: c, loadout });
  });

  it('an unknown gadget id replaces the whole loadout with the default one', () => {
    const bad = defaultLoadout().map((s, i) => (i === 1 ? { ...s, gadget: 'laser' } : s));
    expect(parseSave(json((o) => { o.loadout = bad; }), 3)!.loadout).toEqual(defaultLoadout());
  });

  it('rejects a negative or huge gadget count in the stash', () => {
    expect(parseSave(json((o) => { o.campaign.stash.medkit = -1; }), 3)).toBeNull();
    expect(parseSave(json((o) => { o.campaign.stash.scanner = 100; }), 3)).toBeNull();
    expect(parseSave(json((o) => { o.campaign.stash.armour = 1.5; }), 3)).toBeNull();
  });
});
```

(`played()` already builds its stash from `recordMission`, which now includes the three counts.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/save.test.ts`
Expected: FAIL (the gadget fields are dropped or rejected).

- [ ] **Step 3: Implement**

In `src/save.ts` import `GADGET_IDS` from `./core/config`. In `stash(v)` read the new counts, defaulting to 0 when absent:

```ts
  const { rifle, pistol, grenade, clip } = v;
  const optional = (n: unknown): number | null => (n === undefined ? 0 : isInt(n, 0, 99) ? n : null);
  const medkit = optional(v.medkit);
  const armour = optional(v.armour);
  const scanner = optional(v.scanner);
  if (!isInt(rifle, 0, 99) || !isInt(pistol, 0, 99) || !isInt(grenade, 0, 99) || !isInt(clip, 0, 99)) return null;
  if (medkit === null || armour === null || scanner === null) return null;
  return { rifle, pistol, grenade, clip, medkit, armour, scanner };
```

In `loadout(v)` inside the loop, after the clips check:

```ts
    if (s.gadget !== undefined && !GADGET_IDS.includes(s.gadget as never)) return defaultLoadout();
    out.push({
      weapon: s.weapon, grenades: s.grenades, clips: s.clips,
      ...(s.gadget !== undefined ? { gadget: s.gadget as (typeof GADGET_IDS)[number] } : {}),
    });
```

(replace the existing `out.push(...)` line).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/save.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/save.ts tests/save.test.ts
git commit -m "feat: gadgets in saved campaigns"
```

---

### Task 5: The equipment screen

**Files:**
- Modify: `src/screens/equipment.ts`
- Test: create `tests/gadgetequip.test.ts`; append a case to `tests/layout.test.ts`

**Interfaces:**
- Consumes: `GADGETS`, `GADGET_IDS`, `coverage` with `gadget`, Task 3 pricing.
- Produces: `EquipmentHit` kind `'gadget'`; `EQ.gadget = { x: 76, w: 100 }`; `cycleGadget(l, i, budget, stash): Loadout`; the gadget button drawn on each row's second line, label `NO GADGET` / `MEDKIT (12)` / `ARMOUR (FREE)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/gadgetequip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { emptyStash } from '../src/core/stash';
import {
  EQ, applyEquipmentHit, blockReasonFor, cycleGadget, drawEquipment, equipmentHit,
} from '../src/screens/equipment';
import { onText } from '../src/ui/text';

describe('gadget button on the equipment screen', () => {
  it('sits under the weapon button of each row and is found by equipmentHit', () => {
    for (let i = 0; i < 4; i++) {
      const y = EQ.rowTop + i * EQ.rowStep + EQ.clipDy + 2;
      expect(equipmentHit(EQ.gadget.x + 2, y)).toEqual({ kind: 'gadget', index: i });
    }
    expect(equipmentHit(EQ.gadget.x + 2, EQ.rowTop + EQ.clipDy + 2)).toEqual({ kind: 'gadget', index: 0 });
  });

  it('cycles none, medkit, armour, scanner, none', () => {
    let l = defaultLoadout();
    const seen: (string | undefined)[] = [];
    for (let n = 0; n < 5; n++) {
      l = cycleGadget(l, 0, 500, emptyStash());
      seen.push(l[0].gadget);
    }
    expect(seen).toEqual(['medkit', 'armour', 'scanner', undefined, 'medkit']);
  });

  it('skips a gadget the budget cannot pay for', () => {
    const l = defaultLoadout();
    const budget = loadoutCost(l) + 13; // a medkit (12) fits, armour (20) does not, a scanner (15) does not
    const first = cycleGadget(l, 0, budget, emptyStash());
    expect(first[0].gadget).toBe('medkit');
    const second = cycleGadget(first, 0, budget, emptyStash());
    expect(second[0].gadget).toBeUndefined();
  });

  it('applyEquipmentHit cycles, and hovering never shows a block reason for the gadget button', () => {
    const l = defaultLoadout();
    expect(applyEquipmentHit(l, { kind: 'gadget', index: 2 }, 500, emptyStash())[2].gadget).toBe('medkit');
    expect(blockReasonFor(l, { kind: 'gadget', index: 2 }, 500, emptyStash())).toBeNull();
  });

  it('shows the label and price, FREE from the stash, and found gadgets in the line', () => {
    const l = defaultLoadout();
    l[0] = { ...l[0], gadget: 'armour' };
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawEquipment(ctx, l, null, {
      budget: 500, title: 'T', breakdown: '', soldiers: [], stash: { ...emptyStash(), armour: 1, medkit: 1 },
    });
    stop();
    expect(texts).toContain('ARMOUR (FREE)');
    expect(texts).toContain('NO GADGET');
    expect(texts.some((t) => t.includes('1 medkit') && t.includes('1 armour'))).toBe(true);
  });
});
```

Append to `tests/layout.test.ts` inside the main `describe`, before the checker-itself block:

```ts
  it('the equipment screen with gadgets, the longest names and a full stash line', () => {
    const l = defaultLoadout().map((s) => ({ ...s, gadget: 'scanner' as const }));
    check('equipment gadgets', collect(() => drawEquipment(ctx, l, null, {
      budget: 999, title: 'MISSION 3 OF 3: COMPOUND', breakdown: 'Base 120 + wins 40 + kills 55',
      soldiers: Array.from({ length: 4 }, () => ({ name: 'Lindqvist 2', kills: 9, rank: 'Captain' })),
      stash: { rifle: 4, pistol: 0, grenade: 9, clip: 4, medkit: 4, armour: 4, scanner: 4 },
    })));
  });
```

with `defaultLoadout` and `drawEquipment` imported in that file if not already.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gadgetequip.test.ts tests/layout.test.ts`
Expected: FAIL (`EQ.gadget`, `cycleGadget` missing).

- [ ] **Step 3: Implement**

In `src/screens/equipment.ts`: import `GADGETS`, `GADGET_IDS` from `../core/config` and `GadgetId` from `../core/types`. Extend `EquipmentHit`'s first variant with `'gadget'`. Add to `EQ`: `gadget: { x: 76, w: 100 },`. Add:

```ts
const GADGET_CYCLE: (GadgetId | undefined)[] = [undefined, ...GADGET_IDS];

/** The next gadget in the cycle none -> medkit -> armour -> scanner -> none that the budget can pay for. */
export function cycleGadget(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  const at = GADGET_CYCLE.indexOf(l[i].gadget);
  for (let step = 1; step <= GADGET_CYCLE.length; step++) {
    const gadget = GADGET_CYCLE[(at + step) % GADGET_CYCLE.length];
    const next = l.map((s, j) => (j === i ? { ...s, gadget } : s));
    if (loadoutCost(next, stash) <= budget) return next;
  }
  return l;
}
```

In `equipmentHit` loop add: `if (inRect(px, py, EQ.gadget.x, cy, EQ.gadget.w, EQ.btnH)) return { kind: 'gadget', index: i };` after the clip checks (it needs `cy`). In `blockReasonFor` add `case 'gadget': return null;`; in `applyEquipmentHit` add `case 'gadget': return cycleGadget(l, hit.index, budget, stash);`. In `drawEquipment`, after the clips plus button and before the price lines add:

```ts
    const g = s.gadget;
    drawButton(
      ctx, { x: EQ.gadget.x, y: cy, w: EQ.gadget.w, h: EQ.btnH },
      g ? `${GADGETS[g].name.toUpperCase()} (${cover.gadget ? 'FREE' : GADGETS[g].price})` : 'NO GADGET',
      buttonState(true, hot('gadget')),
    );
```

Also change the hint text to `'Click a weapon to swap it; + and - for grenades and clips; the gadget button cycles'` only if it fits 440 px (`textWidth <= 440`; if not, use `'Weapon swaps; + - grenades and clips; gadget cycles'`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/gadgetequip.test.ts tests/layout.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green (an existing equipment hit-table test may need `kind: 'gadget'` in a switch; fix it, ledger as a Ruling if anything changes meaning).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: gadget button on the equipment screen"
```

---

### Task 6: Panel button and controller

**Files:**
- Modify: `src/render/panel.ts`, `src/input/uiState.ts`, `src/controller.ts`
- Test: create `tests/gadgetpanel.test.ts`; update `tests/panel.test.ts` (nine buttons become ten, row 2 geometry)

**Interfaces:**
- Consumes: `Heal`/`Scan` commands and events (Task 2), `GADGETS`.
- Produces: `ButtonId` includes `'gadget'`; `Mode` includes `'heal'`; `PANEL_BUTTONS` has ten entries (row 2: door, pickup, alert, gadget, end with the widths below); `actionCost(u, 'gadget')`; key `g`; controller messages.

Row 2 geometry (all `y: TOP + 52, h: 22`): door `x: 156, w: 48`; pickup `x: 208, w: 48`; alert `x: 260, w: 52`; gadget `x: 316, w: 56`; end `x: 376, w: 78`. Row 1 is unchanged.

- [ ] **Step 1: Write the failing tests**

Create `tests/gadgetpanel.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../src/controller';
import { PANEL_BUTTONS, actionBlocked, actionCost, buttonAt, drawPanel } from '../src/render/panel';
import { Effects } from '../src/render/effects';
import { createUiState } from '../src/input/uiState';
import { onText } from '../src/ui/text';
import { corridorRows, makeState, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

function setup(rows = corridorRows('PP..E')) {
  const state = makeState(rows);
  return { state, c: new Controller(state, createUiState('p1'), new Effects()) };
}

describe('gadget button', () => {
  it('is the fourth button of the second row, fits and does not overlap its neighbours', () => {
    const b = PANEL_BUTTONS.find((x) => x.id === 'gadget')!;
    expect([b.x, b.y, b.w, b.h]).toEqual([316, 372, 56, 22]);
    expect(buttonAt(320, 380)).toBe('gadget');
    expect(PANEL_BUTTONS.map((x) => x.id).slice(-5)).toEqual(['door', 'pickup', 'alert', 'gadget', 'end']);
  });

  it('costs the gadget action, and is blocked without a usable gadget or AP', () => {
    const { state } = setup();
    const p = unit(state, 'p1');
    expect(actionCost(p, 'gadget')).toBeNull();
    expect(actionBlocked(p, 'gadget')).toBe(true);
    p.gadget = 'armour';
    expect(actionBlocked(p, 'gadget')).toBe(true);
    p.gadget = 'medkit';
    expect(actionCost(p, 'gadget')).toBe(12);
    expect(actionBlocked(p, 'gadget')).toBe(false);
    p.ap = 11;
    expect(actionBlocked(p, 'gadget')).toBe(true);
    p.gadget = 'scanner';
    p.ap = 10;
    expect(actionCost(p, 'gadget')).toBe(10);
    expect(actionBlocked(p, 'gadget')).toBe(false);
  });

  it('is labelled HEAL or SCAN for the gadgets, and the soldier line names the gadget', () => {
    for (const [gadget, label] of [['medkit', 'G HEAL'], ['scanner', 'G SCAN']] as const) {
      const { state } = setup();
      unit(state, 'p1').gadget = gadget;
      const texts: string[] = [];
      const stop = onText((r) => texts.push(r.text));
      const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
      drawPanel(ctx, state, createUiState('p1'), 0);
      stop();
      expect(texts).toContain(label);
      expect(texts.some((t) => t.toUpperCase().includes(gadget.toUpperCase()))).toBe(true);
    }
  });
});

describe('using gadgets from the controller', () => {
  it('G with a scanner scans at once and says how many enemies were found', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'scanner';
    c.key('g');
    expect(c.state.scanned).toEqual([{ x: 5, y: 1 }]);
    expect(c.ui.message).toMatch(/SCAN: 1 ENEMY NEARBY/i);
    expect(c.selected()!.gadget).toBeNull();
  });

  it('says so when nothing is nearby', () => {
    const { state, c } = setup(corridorRows('P' + '.'.repeat(12) + 'E'));
    unit(state, 'p1').gadget = 'scanner';
    c.key('g');
    expect(c.ui.message).toMatch(/NO ENEMIES NEARBY/i);
  });

  it('G with a medkit enters heal mode; clicking an adjacent wounded teammate heals them', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'medkit';
    unit(state, 'p2').hp = 20;
    c.key('g');
    expect(c.ui.mode).toBe('heal');
    c.clickTile({ x: 2, y: 1 });
    expect(unit(c.state, 'p2').hp).toBe(45);
    expect(c.ui.mode).toBe('move');
    expect(c.ui.message).toMatch(/HEALS/i);
  });

  it('clicking an enemy or empty tile in heal mode refuses, and Escape cancels the mode', () => {
    const { state, c } = setup();
    unit(state, 'p1').gadget = 'medkit';
    c.key('g');
    c.clickTile({ x: 5, y: 1 });
    expect(c.ui.message).toMatch(/click a soldier/i);
    expect(unit(c.state, 'p1').gadget).toBe('medkit');
    c.key('g');
    c.key('Escape');
    expect(c.ui.mode).toBe('move');
  });

  it('G with armour or no gadget refuses and spends nothing', () => {
    const { state, c } = setup();
    c.key('g');
    expect(c.ui.message).toMatch(/no gadget to use/i);
    unit(state, 'p1').gadget = 'armour';
    c.key('g');
    expect(c.ui.message).toMatch(/no gadget to use/i);
    expect(c.selected()!.ap).toBe(60);
  });
});
```

Update `tests/panel.test.ts`: the id list becomes `['snap','aimed','throw','stab','reload','door','pickup','alert','gadget','end']` (ten buttons, test name "has ten buttons"), `row(2)` becomes `PANEL_BUTTONS.slice(5, 10)` and the expected geometry `[[156,372,48,22],[208,372,48,22],[260,372,52,22],[316,372,56,22],[376,372,78,22]]`; keep the "label fits" check at `+ 6` (the gadget button's static label is `GADGET`, so `G GADGET` = 47 px + 6 <= 56; `SPC END TURN` = 71 + 6 <= 78; `L ALERT` = 41 + 6 <= 52; `D DOOR` and `P TAKE` = 35 + 6 <= 48).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gadgetpanel.test.ts tests/panel.test.ts`
Expected: FAIL (no `gadget` button, `heal` mode).

- [ ] **Step 3: Implement**

`src/input/uiState.ts`: `Mode` gains `'heal'`.

`src/render/panel.ts`:
- `ButtonId` gains `'gadget'`; `DEFS` gets `['gadget', 'GADGET', 'G']` between alert and end.
- Replace the geometry map with explicit rects:

```ts
const ROW2: [number, number][] = [[156, 48], [208, 48], [260, 52], [316, 56], [376, 78]];
export const PANEL_BUTTONS: PanelButton[] = DEFS.map(([id, label, key], i) =>
  i < 5
    ? { id, label, key, x: 156 + i * 64, y: TOP + 28, w: 60, h: 22 }
    : { id, label, key, x: ROW2[i - 5][0], y: TOP + 52, w: ROW2[i - 5][1], h: 22 },
);
```

- `actionCost` adds `case 'gadget': return u.gadget === 'medkit' ? GADGETS.medkit.apCost : u.gadget === 'scanner' ? GADGETS.scanner.apCost : null;` (import `GADGETS`).
- `actionBlocked` adds before the final `return false;`: `if (id === 'gadget') return u.gadget !== 'medkit' && u.gadget !== 'scanner' || (cost !== null && u.ap < cost);` (keep the earlier generic AP check as is).
- `MODE_NAMES` gains `heal: 'Heal'`.
- In `drawPanel` the button label becomes dynamic for the gadget: `const label = b.id === 'gadget' && u?.gadget === 'medkit' ? 'HEAL' : b.id === 'gadget' && u?.gadget === 'scanner' ? 'SCAN' : b.label;` and the text `${b.key} ${label}`. Active highlight: `modeButton` gains `heal: 'gadget'`. In the left well add, after the ALERT line: draw `GADGET ${GADGETS[u.gadget].name.toUpperCase()}` at `(8, TOP + 41)` when `u.gadget`, and move the ALERT text to `(100, TOP + 41)` (the gadget line is at most 13 characters, 77 px, ending before x 100).

`src/controller.ts`:
- `setMode` hint record gains `heal: \`Heal, ${GADGETS.medkit.apCost} AP: click yourself or an adjacent soldier\`` (import `GADGETS`).
- In `clickTile`'s mode branch add:

```ts
    } else if (mode === 'heal') {
      if (!clicked || clicked.side !== 'player') {
        this.refuse('Click a soldier');
        return;
      }
      this.run({ type: 'Heal', unitId: sel.id, targetId: clicked.id });
    }
```

(this must sit with the other mode branches; the existing code sets `this.ui.mode = 'move'` before them, so a refused click ends the mode, which matches the other modes.)
- `pressButton` adds `case 'gadget': this.useGadget(); break;` and the key switch adds `case 'g': this.useGadget(); return true;`.
- Add:

```ts
  private useGadget(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    if (sel.gadget === 'medkit') this.setMode('heal');
    else if (sel.gadget === 'scanner') this.run({ type: 'Scan', unitId: sel.id });
    else this.refuse('No gadget to use');
  }
```

- `onEvent` gains two branches:

```ts
    } else if (ev.type === 'healed') {
      const name = (id: string) => this.state.units.find((u) => u.id === id)?.name ?? id;
      this.say(`${name(ev.unitId)} heals ${name(ev.targetId)}: +${ev.amount} HP`, 3000);
    } else if (ev.type === 'scanned' && this.isOwn(ev, this.state)) {
      const n = ev.found.length;
      this.say(n === 0 ? 'SCAN: NO ENEMIES NEARBY' : `SCAN: ${n} ${n === 1 ? 'ENEMY' : 'ENEMIES'} NEARBY`, 3000);
    }
```

Check that `eventVisible` (switch with `default: return false`) needs no new case: `healed` and `scanned` fall to the default (not "visible", which only affects the enemy-turn camera pause); add `case 'healed': return seen(ev.at);` for completeness.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/gadgetpanel.test.ts tests/panel.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean (fix any test that asserted the old nine-button list or row-2 geometry; the layout checker's mission view must still pass).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: GADGET panel button, heal targeting and scan messages"
```

---

### Task 7: Map markers, heal effect and sounds

**Files:**
- Modify: `src/render/renderer.ts`, `src/render/effects.ts`, `src/audio/effects.ts`, `src/audio/mapping.ts`
- Test: append to `tests/soundmap.test.ts`, `tests/sound.test.ts` (or `tests/soundeffects.test.ts`, whichever lists `SOUND_NAMES`), `tests/rendereffects.test.ts`; create nothing new unless a file is missing (check with `ls tests`)

**Interfaces:**
- Consumes: `healed`, `scanned` events; `state.scanned`; `Unit.gadget`.
- Produces: sound names `'heal'` and `'scan'` in `SOUND_NAMES` and `EFFECTS`; `soundsFor` maps `healed` to `heal` and `scanned` to `scan` (audible rules below); `Effects.add` draws a green flash for `healed`; the renderer draws scan dots and an armour pip.

- [ ] **Step 1: Write the failing tests**

Append to `tests/soundmap.test.ts` (use that file's helpers; if it builds states with `makeState`, do the same):

```ts
describe('gadget sounds', () => {
  it('a heal chimes at full volume when audible, quietly otherwise; a scan pings only for the player', () => {
    const s = makeState(corridorRows('PP.E'));
    const heal = { type: 'healed', unitId: 'p1', targetId: 'p2', amount: 25, at: { x: 2, y: 1 } } as const;
    expect(soundsFor(heal, s, true)).toEqual([{ name: 'heal', volume: 1 }]);
    expect(soundsFor(heal, s, false)).toEqual([{ name: 'heal', volume: 0.35 }]);
    const scan = { type: 'scanned', unitId: 'p1', found: [] } as const;
    expect(soundsFor(scan, s, true)).toEqual([{ name: 'scan', volume: 1 }]);
    expect(soundsFor(scan, s, false)).toEqual([]);
  });
});
```

Append to the file that checks every `SOUND_NAMES` entry has a recipe (search `SOUND_NAMES` in `tests/`): expect `SOUND_NAMES` to contain `'heal'` and `'scan'` and `effectDuration('heal')` and `effectDuration('scan')` to be positive and under 1 second.

Append to `tests/rendereffects.test.ts` (match its helper style):

```ts
it('a heal shows a green flash on the healed tile', () => {
  const fx = new Effects();
  fx.add([{ type: 'healed', unitId: 'p1', targetId: 'p2', amount: 25, at: { x: 3, y: 2 } }], 1000);
  const frames = fx.frames(1100);
  expect(frames.some((f) => f.type === 'rect' && f.x === 48 && f.y === 32 && f.color.includes('100,255,140'))).toBe(true);
});
```

Add a renderer test (to `tests/artrender.test.ts`, matching how it draws with a recording canvas): with `state.scanned = [{x: 5, y: 1}]` and that tile not visible, drawing records a `fillRect` at `(5 * 16 + 6, 1 * 16 + 6, 4, 4)` with fill style `#ff4d4d`; a soldier with `gadget = 'armour'` records a `fillRect` with fill style `#4da6ff`; a soldier with no gadget records neither. Follow that file's existing recording-canvas pattern for reading fill styles.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/soundmap.test.ts tests/rendereffects.test.ts tests/artrender.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/audio/effects.ts`: add `'heal', 'scan'` to `SOUND_NAMES` (before `'win'`) and recipes:

```ts
  heal: [tone('triangle', 600, 900, 0, 0.1, 0.3), tone('triangle', 900, 1200, 0.1, 0.14, 0.3)],
  scan: [tone('sawtooth', 1400, 500, 0, 0.35, 0.22), tone('triangle', 700, 700, 0.4, 0.05, 0.2)],
```

`src/audio/mapping.ts`: add cases

```ts
    case 'healed':
      return [hit('heal', loud)];
    case 'scanned':
      return audible ? [hit('scan', VOLUME.full)] : [];
```

`src/render/effects.ts`: in `add` add

```ts
      } else if (e.type === 'healed') {
        this.list.push({ kind: 'flash', at: e.at, color: '100,255,140', start: now, dur: 300 });
```

(the existing flash kind draws a `rect` with `color`; verify the draw code passes the `color` string through unchanged, and if the test above shows `f.x`/`f.y` differ from the tile pixel corner, adjust the expected numbers to what the existing `reloaded` flash produces for the same tile.)

`src/render/renderer.ts`: in `COLORS` add `scan: '#ff4d4d', armour: '#4da6ff'`. After the units loop and before the preview dots add:

```ts
  ctx.fillStyle = COLORS.scan;
  for (const p of state.scanned) {
    if (!visible[p.y][p.x]) ctx.fillRect(p.x * T + 6, p.y * T + 6, 4, 4);
  }
```

and inside the unit loop's player branch, after the rank pips:

```ts
      if (u.gadget === 'armour') {
        ctx.fillStyle = COLORS.armour;
        ctx.fillRect(x0 + 1, y0 + 13, 2, 2);
      }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: PASS; suite green; typecheck clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: scan dots, armour pip, heal flash and gadget sounds"
```

---

### Task 8: A scripted mission and a look in the browser

**Files:**
- Test: create `tests/gadgetmission.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/gadgetmission.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { MISSIONS, createMission } from '../src/core/missions';
import { defaultLoadout } from '../src/core/loadout';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

describe('gadgets in a mission', () => {
  it('a medic heals a wounded teammate', () => {
    const wounded = makeState(corridorRows('PPE'));
    unit(wounded, 'p1').gadget = 'medkit';
    unit(wounded, 'p2').hp = 15;
    const r = ok(applyCommand(wounded, { type: 'Heal', unitId: 'p1', targetId: 'p2' }));
    expect(unit(r.state, 'p2').hp).toBe(40);
    expect(unit(r.state, 'p1').gadget).toBeNull();
  });

  it('a scan shows an enemy behind a wall and the dot goes when the turn ends', () => {
    const s = makeState(['#########', '#P.#.E..#', '#########']);
    unit(s, 'p1').gadget = 'scanner';
    const scanned = ok(applyCommand(s, { type: 'Scan', unitId: 'p1' })).state;
    expect(scanned.scanned).toEqual([{ x: 5, y: 1 }]);
    const ended = ok(applyCommand(scanned, { type: 'EndTurn' })).state;
    expect(ended.scanned).toEqual([]);
  });

  it('an armoured soldier survives one more rifle hit than an unarmoured one', () => {
    const hitsToKill = (armour: boolean): number => {
      let s = makeState(corridorRows('E.P'));
      unit(s, 'p1').gadget = armour ? 'armour' : null;
      s.turn = 'enemy';
      let hits = 0;
      for (let i = 0; i < 20 && unit(s, 'p1').alive; i++) {
        s.rngState = seedForRoll((n) => n < 0.05);
        unit(s, 'e1').ammo = 5;
        unit(s, 'e1').ap = 60;
        unit(s, 'e1').weapon = 'rifle';
        s = ok(applyCommand(s, { type: 'SnapShot', unitId: 'e1', targetId: 'p1' })).state;
        hits += 1;
      }
      return hits;
    };
    expect(hitsToKill(false)).toBe(2); // 50 HP, rifle 30
    expect(hitsToKill(true)).toBe(3); // rifle 21: 50 -> 29 -> 8 -> dead
  });

  it('Warehouse starts with no gadgets, so nothing changes for a squad without them', () => {
    const s = createMission(MISSIONS[1], 1, undefined, defaultLoadout());
    expect(s.units.every((u) => u.gadget === null)).toBe(true);
    expect(s.scanned).toEqual([]);
  });
});
```

Expected hit counts assume a hit probability the forced seed always satisfies; if the facing or range makes the first test shot illegal, set `unit(s, 'e1').facing = 2` (facing east toward `p1`).

- [ ] **Step 2: Run, then prove the armour test can fail**

Run: `npx vitest run tests/gadgetmission.test.ts`
Expected: PASS. Then temporarily make `damageTaken` return `raw` always and confirm the armour test fails; restore it.

- [ ] **Step 3: Whole suite, typecheck, build, commit**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: all green and clean.

```bash
git add tests/gadgetmission.test.ts
git commit -m "test: gadgets in scripted missions"
```

- [ ] **Step 4: Look at it in the Browser pane**

`preview_start` the `laser-tribute-dev` server. In the page (dev hook `window.app`): on the equipment screen click the gadget button of soldier 1 until it shows `MEDKIT (12)`, set soldier 2 to `SCANNER (15)` (click through the cycle), screenshot the equipment screen (row layout, prices, hover). Start the mission (Enter), then in the console set `app.controller.state.units.find(u => u.id === 'p2').hp = 20`, select p1 and press `G`, click p2; expect `+25 HP` and the HP bar refilled. Select the scanner soldier and press `G`: red dots appear on unseen enemy tiles and the panel message reads `SCAN: N ENEMIES NEARBY`; end the turn (Space) and the dots vanish. Check `read_console_messages` for errors and the panel screenshot for the HEAL/SCAN label and the gadget line. Reset the viewport, stop the server, clear `laser-tribute-save` from `localStorage`.

- [ ] **Step 5: Commit any fix** found in the browser (test first); otherwise nothing to commit.
