# Laser Tribute Milestone 4 Implementation Plan (ranks, soldier accuracy, combat knife)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soldiers earn ranks from kills (more max HP, max AP and a new accuracy stat), and every soldier carries a combat knife with a new STAB action.

**Architecture:** `src/core` stays pure (commands in, events out). A new `ranks.ts` holds the rank table and applies a rank to a unit when a mission is created from the campaign roster. `Unit` gets `accuracy` and `rank`; `hitChance` adds the soldier accuracy. A new `Stab` command and `stab` event follow the shot pattern. The controller, panel, effects and screens gain the matching UI. Rank is derived from the roster's persistent kills, so the campaign needs no new saved data.

**Tech Stack:** TypeScript, HTML5 Canvas, Vite, Vitest (run with `npx vitest run`, type-check with `npx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-04-laser-tribute-milestone4-design.md` (read it first).

## Global Constraints

- `src/core` has no browser imports (no `window`, `document`, canvas).
- Rank table (kills, max HP, max AP, accuracy bonus): Rookie 0/50/60/+0, Private 2/60/64/+0.04, Sergeant 5/70/68/+0.08, Captain 9/80/72/+0.12.
- Hit chance is `min(0.95, weaponAccuracy + shooter.accuracy) * rangeFactor * coverFactor`; the cap applies to the weapon-plus-soldier part.
- Knife: 20 AP, damage 60, hit chance `min(0.95, 0.90 + shooter.accuracy)`, range and cover do not apply, target must be an adjacent living enemy (Chebyshev distance 1), key `K`, button label `K STAB`. Enemies never use it.
- Enemies and replacement rookies are Rookies. Enemies have no rank (`rank: ''`) and `accuracy: 0`.
- Co-author trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Existing tests (250) must keep passing after every task. Work on branch `milestone-4` (already created, spec committed).

## Review Focus

- A soldier exactly at a threshold (2, 5, 9 kills) gets the rank; one kill short (1, 4, 8) does not. Test in Task 1.
- A Captain's best shot never exceeds 95% hit chance (weapon 0.85 + 0.12 would be 0.97). Tests in Tasks 1 and 3.
- Stab at distance 2, on your own side, on a dead unit, and with 19 AP must be rejected with a clear reason and no AP spent. Tests in Task 3.
- A soldier who dies in the mission is replaced by a Rookie with no promotion announced for them. Test in Task 5.
- Rank bonuses must last the whole mission: AP refills to the rank's max at turn start and enemies are not affected by soldier ranks. Tests in Tasks 2.

## File Structure

- Create `src/core/ranks.ts`: `RANKS`, `rankFor`, `rankShort`, `applyRank`, `promotions`.
- Create `src/core/actions/stab.ts`: `stabChance`, `handleStab`.
- Modify `src/core/types.ts`, `config.ts`, `combat.ts`, `apply.ts`, `mission.ts`, `missions.ts`.
- Modify `src/input/uiState.ts`, `src/controller.ts`, `src/render/panel.ts`, `src/render/effects.ts`.
- Modify `src/screens/equipment.ts`, `src/screens/result.ts`, `src/app.ts`, `README.md`.
- Tests: `tests/ranks.test.ts`, `tests/knife.test.ts`, `tests/knifeui.test.ts`, `tests/panel.test.ts`, append to `tests/app.test.ts`.

---

### Task 1: Ranks, soldier accuracy and hit chance

**Files:**
- Create: `src/core/ranks.ts`
- Modify: `src/core/types.ts` (Unit), `src/core/config.ts`, `src/core/combat.ts` (`hitChance`), `src/core/mission.ts` (`makeUnit`)
- Test: `tests/ranks.test.ts`

**Interfaces:**
- Consumes: `CONFIG.soldierHp`, `CONFIG.maxAp`, `Unit`.
- Produces: `interface Rank { name: string; short: string; minKills: number; hp: number; ap: number; accuracy: number }`; `RANKS: readonly Rank[]`; `rankFor(kills: number): Rank`; `rankShort(rankName: string): string` (`''` for unknown or empty); `applyRank(u: Unit, kills: number): void` (sets `rank`, `maxHp`, `hp`, `maxAp`, `ap`, `accuracy`); `Unit.accuracy: number`; `Unit.rank: string`; `CONFIG.maxHitChance = 0.95`; `CONFIG.knife = { apCost: 20, damage: 60, accuracy: 0.9 }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ranks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hitChance } from '../src/core/combat';
import { RANKS, applyRank, rankFor, rankShort } from '../src/core/ranks';
import { corridorRows, makeState, unit } from './helpers';

describe('rankFor', () => {
  it('promotes exactly at 2, 5 and 9 kills', () => {
    const name = (k: number) => rankFor(k).name;
    expect([0, 1].map(name)).toEqual(['Rookie', 'Rookie']);
    expect([2, 3, 4].map(name)).toEqual(['Private', 'Private', 'Private']);
    expect([5, 8].map(name)).toEqual(['Sergeant', 'Sergeant']);
    expect([9, 20].map(name)).toEqual(['Captain', 'Captain']);
  });

  it('has the bonuses from the design table', () => {
    expect(RANKS.map((r) => [r.name, r.minKills, r.hp, r.ap, r.accuracy])).toEqual([
      ['Rookie', 0, 0, 0, 0],
      ['Private', 2, 10, 4, 0.04],
      ['Sergeant', 5, 20, 8, 0.08],
      ['Captain', 9, 30, 12, 0.12],
    ]);
  });

  it('has three-letter short forms', () => {
    expect(rankShort('Sergeant')).toBe('Sgt');
    expect(rankShort('Captain')).toBe('Cpt');
    expect(rankShort('')).toBe('');
    expect(rankShort('Nonsense')).toBe('');
  });
});

describe('applyRank', () => {
  it('sets max and current HP/AP and accuracy from the rank', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    p.hp = 10;
    p.ap = 5;
    applyRank(p, 9);
    expect(p).toMatchObject({ rank: 'Captain', maxHp: 80, hp: 80, maxAp: 72, ap: 72, accuracy: 0.12 });
  });

  it('leaves a Rookie at the base stats', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    applyRank(p, 0);
    expect(p).toMatchObject({ rank: 'Rookie', maxHp: 50, hp: 50, maxAp: 60, ap: 60, accuracy: 0 });
  });
});

describe('default units', () => {
  it('soldiers start as Rookies with no accuracy bonus, enemies have no rank', () => {
    const s = makeState(corridorRows('P..E'));
    expect(unit(s, 'p1')).toMatchObject({ rank: 'Rookie', accuracy: 0 });
    expect(unit(s, 'e1')).toMatchObject({ rank: '', accuracy: 0 });
  });
});

describe('hitChance with soldier accuracy', () => {
  // P at x=1, E at x=3: distance 2, no wall beside the target that is closer, so no cover.
  const setup = () => {
    const s = makeState(corridorRows('P.E'));
    return { s, p: unit(s, 'p1'), e: unit(s, 'e1') };
  };

  it('is unchanged for a Rookie', () => {
    const { s, p, e } = setup();
    p.weapon = 'rifle';
    expect(hitChance(s, p, e, 'aimed')).toBeCloseTo(0.85 * (1 - 0.5 * (2 / 14)), 5);
  });

  it('adds the soldier accuracy to the weapon accuracy', () => {
    const { s, p, e } = setup();
    p.weapon = 'pistol';
    applyRank(p, 9); // +0.12
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo((0.55 + 0.12) * (1 - 0.5 * (2 / 8)), 5);
  });

  it('caps weapon plus soldier accuracy at 95% before range', () => {
    const { s, p, e } = setup();
    p.weapon = 'rifle';
    applyRank(p, 9); // 0.85 + 0.12 = 0.97, capped to 0.95
    expect(hitChance(s, p, e, 'aimed')).toBeCloseTo(0.95 * (1 - 0.5 * (2 / 14)), 5);
  });

  it('does not change enemy hit chances', () => {
    const { s, p, e } = setup();
    e.weapon = 'rifle';
    applyRank(p, 9);
    expect(hitChance(s, e, p, 'aimed')).toBeCloseTo(0.85 * (1 - 0.5 * (2 / 14)), 5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ranks.test.ts`
Expected: FAIL (cannot find module `../src/core/ranks`).

- [ ] **Step 3: Implement**

In `src/core/config.ts` replace the `grenade` line and add constants:

```ts
  maxHitChance: 0.95,
  grenade: { apCost: 24, range: 8, damage: 40, radius: 1 },
  knife: { apCost: 20, damage: 60, accuracy: 0.9 },
```

In `src/core/types.ts`, in `interface Unit`, after `alert: boolean;` block add (keep existing fields):

```ts
  /** Added to the weapon's accuracy. 0 for Rookies and enemies. */
  accuracy: number;
  /** Rank name for soldiers ('Rookie', 'Private', ...); '' for enemies. */
  rank: string;
```

In `src/core/mission.ts` `makeUnit`, after `kills: 0,` add:

```ts
    accuracy: 0,
    rank: side === 'player' ? 'Rookie' : '',
```

In `src/core/combat.ts` change `hitChance`:

```ts
export function hitChance(s: GameState, shooter: Unit, target: Unit, mode: ShotMode): number {
  const w = WEAPONS[shooter.weapon];
  const weaponAccuracy = mode === 'snap' ? w.snapAccuracy : w.aimedAccuracy;
  const base = Math.min(CONFIG.maxHitChance, weaponAccuracy + shooter.accuracy);
  const rangeFactor = 1 - 0.5 * (distance(shooter.pos, target.pos) / w.range);
  const cover = isCovered(s, shooter.pos, target.pos) ? CONFIG.coverMultiplier : 1;
  return base * rangeFactor * cover;
}
```

(`CONFIG` is already imported in `combat.ts` because `coverMultiplier` is used; if not, add it to the `./config` import.)

Create `src/core/ranks.ts`:

```ts
import { CONFIG } from './config';
import type { Unit } from './types';

export interface Rank {
  name: string;
  short: string;
  minKills: number;
  /** Bonuses over a Rookie. */
  hp: number;
  ap: number;
  accuracy: number;
}

export const RANKS: readonly Rank[] = [
  { name: 'Rookie', short: 'Rke', minKills: 0, hp: 0, ap: 0, accuracy: 0 },
  { name: 'Private', short: 'Pvt', minKills: 2, hp: 10, ap: 4, accuracy: 0.04 },
  { name: 'Sergeant', short: 'Sgt', minKills: 5, hp: 20, ap: 8, accuracy: 0.08 },
  { name: 'Captain', short: 'Cpt', minKills: 9, hp: 30, ap: 12, accuracy: 0.12 },
];

/** The highest rank whose kill threshold is met. */
export function rankFor(kills: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) if (kills >= r.minKills) rank = r;
  return rank;
}

export function rankShort(rankName: string): string {
  return RANKS.find((r) => r.name === rankName)?.short ?? '';
}

/** Gives a soldier the stats of the rank earned by `kills`, at full health and AP. */
export function applyRank(u: Unit, kills: number): void {
  const r = rankFor(kills);
  u.rank = r.name;
  u.maxHp = CONFIG.soldierHp + r.hp;
  u.hp = u.maxHp;
  u.maxAp = CONFIG.maxAp + r.ap;
  u.ap = u.maxAp;
  u.accuracy = r.accuracy;
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass (250 old + new), no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core tests/ranks.test.ts
git commit -m "feat(core): add ranks, soldier accuracy and capped hit chance

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Apply ranks when a campaign mission is created

**Files:**
- Modify: `src/core/missions.ts` (`createMission`)
- Test: `tests/ranks.test.ts` (append)

**Interfaces:**
- Consumes: `applyRank` (Task 1), `RosterSoldier {name, kills}`.
- Produces: `createMission(def, seed, roster, ...)` now gives each soldier the rank of `roster[i].kills`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ranks.test.ts` (add `import { applyCommand } from '../src/core/apply';`, `import { MISSIONS, createMission } from '../src/core/missions';` and `import { ok } from './helpers';` at the top, merging with the existing helper import):

```ts
describe('createMission applies ranks from the roster', () => {
  const roster = [
    { name: 'Vet', kills: 9 },
    { name: 'Sarge', kills: 5 },
    { name: 'Pvt', kills: 2 },
    { name: 'New', kills: 0 },
  ];

  it('gives each soldier the stats of their rank', () => {
    const s = createMission(MISSIONS[0], 1, roster);
    const soldiers = s.units.filter((u) => u.side === 'player');
    expect(soldiers.map((u) => u.rank)).toEqual(['Captain', 'Sergeant', 'Private', 'Rookie']);
    expect(soldiers.map((u) => [u.maxHp, u.hp, u.maxAp, u.ap])).toEqual([
      [80, 80, 72, 72],
      [70, 70, 68, 68],
      [60, 60, 64, 64],
      [50, 50, 60, 60],
    ]);
    expect(soldiers.map((u) => u.accuracy)).toEqual([0.12, 0.08, 0.04, 0]);
    expect(soldiers.map((u) => u.name)).toEqual(['Vet', 'Sarge', 'Pvt', 'New']);
  });

  it('does not touch enemies', () => {
    const s = createMission(MISSIONS[0], 1, roster);
    for (const e of s.units.filter((u) => u.side === 'enemy')) {
      expect(e).toMatchObject({ rank: '', accuracy: 0, maxHp: 40, maxAp: 60 });
    }
  });

  it('without a roster every soldier is a Rookie', () => {
    const s = createMission(MISSIONS[0], 1);
    expect(s.units.filter((u) => u.side === 'player').every((u) => u.rank === 'Rookie' && u.maxHp === 50)).toBe(true);
  });

  it('refills AP to the rank maximum at the start of the next player turn', () => {
    const s = makeState(corridorRows('P..E'));
    applyRank(unit(s, 'p1'), 9);
    unit(s, 'p1').ap = 0;
    const r1 = ok(applyCommand(s, { type: 'EndTurn' }));
    const r2 = ok(applyCommand(r1.state, { type: 'EndTurn' }));
    expect(unit(r2.state, 'p1').ap).toBe(72);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ranks.test.ts`
Expected: FAIL (ranks not applied; Captain expected).

- [ ] **Step 3: Implement**

In `src/core/missions.ts` add `import { applyRank } from './ranks';` and change the roster block of `createMission`:

```ts
  if (roster) {
    s.units
      .filter((u) => u.side === 'player')
      .forEach((u, i) => {
        if (roster[i]) {
          u.name = roster[i].name;
          applyRank(u, roster[i].kills);
        }
      });
  }
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/missions.ts tests/ranks.test.ts
git commit -m "feat(core): soldiers start each mission with the rank their kills earned

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Combat knife (Stab command, event, rules)

**Files:**
- Create: `src/core/actions/stab.ts`
- Modify: `src/core/types.ts` (Command, GameEvent), `src/core/apply.ts` (dispatch)
- Test: `tests/knife.test.ts`

**Interfaces:**
- Consumes: `CONFIG.knife`, `CONFIG.maxHitChance`, `Unit.accuracy`, `chebyshev` (from `../geometry`), `nextRandom` (from `../rng`), `NOT_ENOUGH_AP`.
- Produces: `Command` gains `{ type: 'Stab'; unitId: string; targetId: string }`; `GameEvent` gains `{ type: 'stab'; unitId: string; targetId: string; hit: boolean; damage: number; from: Pos; at: Pos }`; `stabChance(u: Unit): number`; `handleStab(s, cmd, unit, events): string | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/knife.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { stabChance } from '../src/core/actions/stab';
import { applyRank } from '../src/core/ranks';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const stab = (unitId = 'p1', targetId = 'e1') => ({ type: 'Stab' as const, unitId, targetId });

/** P and E side by side: P at x=1, E at x=2. */
const adjacent = () => makeState(corridorRows('PE'));

describe('stabChance', () => {
  it('is 90% for a Rookie and adds rank accuracy, capped at 95%', () => {
    const s = adjacent();
    const p = unit(s, 'p1');
    expect(stabChance(p)).toBeCloseTo(0.9, 5);
    applyRank(p, 2); // +0.04
    expect(stabChance(p)).toBeCloseTo(0.94, 5);
    applyRank(p, 9); // +0.12 would be 1.02
    expect(stabChance(p)).toBe(0.95);
  });
});

describe('Stab command', () => {
  it('kills an adjacent enemy on a hit, spends 20 AP and credits the kill', () => {
    const s = adjacent();
    s.rngState = seedForRoll((n) => n < 0.9);
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').ap).toBe(40);
    expect(unit(r.state, 'p1').kills).toBe(1);
    expect(r.events).toContainEqual({
      type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60,
      from: { x: 1, y: 1 }, at: { x: 2, y: 1 },
    });
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 2, y: 1 } });
  });

  it('can miss: spends the AP, no damage, no kill', () => {
    const s = adjacent();
    s.rngState = seedForRoll((n) => n >= 0.95);
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'e1')).toMatchObject({ alive: true, hp: 40 });
    expect(unit(r.state, 'p1')).toMatchObject({ ap: 40, kills: 0 });
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'stab', hit: false, damage: 0 }));
    expect(r.events.some((e) => e.type === 'died')).toBe(false);
  });

  it('works on a diagonal neighbour', () => {
    const s = makeState(['####', '#P.#', '#.E#', '####']);
    s.rngState = seedForRoll((n) => n < 0.9);
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'e1').alive).toBe(false);
  });

  it('rejects a target two tiles away and spends nothing', () => {
    const s = makeState(corridorRows('P.E'));
    const res = applyCommand(s, stab());
    expect(reason(res)).toBe('Stab needs an adjacent enemy');
    expect(unit(s, 'p1').ap).toBe(60);
  });

  it('rejects your own side, a dead target and an unknown target', () => {
    const s = makeState(corridorRows('PP.E'));
    expect(reason(applyCommand(s, stab('p1', 'p2')))).toBe('Cannot stab your own side');
    expect(reason(applyCommand(s, stab('p1', 'nobody')))).toBe('No such target');
    const t = adjacent();
    unit(t, 'e1').alive = false;
    expect(reason(applyCommand(t, stab()))).toBe('No such target');
  });

  it('needs 20 AP', () => {
    const s = adjacent();
    unit(s, 'p1').ap = 19;
    expect(reason(applyCommand(s, stab()))).toBe('Not enough action points');
    unit(s, 'p1').ap = 20;
    s.rngState = seedForRoll((n) => n < 0.9);
    expect(ok(applyCommand(s, stab())).state.units.find((u) => u.id === 'p1')!.ap).toBe(0);
  });

  it('ends the soldier alert like any other action', () => {
    const s = adjacent();
    unit(s, 'p1').alert = true;
    const r = ok(applyCommand(s, stab()));
    expect(unit(r.state, 'p1').alert).toBe(false);
  });

  it('a rank bonus raises the chance: a roll of 0.93 misses a Rookie but hits a Private', () => {
    const roll = seedForRoll((n) => n >= 0.9 && n < 0.94);
    const rookie = adjacent();
    rookie.rngState = roll;
    expect(unit(ok(applyCommand(rookie, stab())).state, 'e1').alive).toBe(true);
    const pvt = adjacent();
    pvt.rngState = roll;
    applyRank(unit(pvt, 'p1'), 2);
    expect(unit(ok(applyCommand(pvt, stab())).state, 'e1').alive).toBe(false);
  });

  it('wins the mission when the last enemy dies', () => {
    const s = adjacent();
    s.rngState = seedForRoll((n) => n < 0.9);
    const r = ok(applyCommand(s, stab()));
    expect(r.state.status).toBe('won');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/knife.test.ts`
Expected: FAIL (cannot find module `stab`).

- [ ] **Step 3: Implement**

In `src/core/types.ts` add to `Command` (after `AimedShot`):

```ts
  | { type: 'Stab'; unitId: string; targetId: string }
```

and to `GameEvent` (after the `shot` member):

```ts
  | { type: 'stab'; unitId: string; targetId: string; hit: boolean; damage: number; from: Pos; at: Pos }
```

Create `src/core/actions/stab.ts`:

```ts
import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev } from '../geometry';
import { nextRandom } from '../rng';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function stabChance(u: Unit): number {
  return Math.min(CONFIG.maxHitChance, CONFIG.knife.accuracy + u.accuracy);
}

/** Every soldier carries a knife: an adjacent living enemy can be stabbed for very high damage. */
export function handleStab(
  s: GameState,
  cmd: Extract<Command, { type: 'Stab' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const target = s.units.find((u) => u.id === cmd.targetId);
  if (!target || !target.alive) return 'No such target';
  if (target.side === unit.side) return 'Cannot stab your own side';
  if (chebyshev(unit.pos, target.pos) !== 1) return 'Stab needs an adjacent enemy';
  if (unit.ap < CONFIG.knife.apCost) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.knife.apCost;
  const hit = nextRandom(s) < stabChance(unit);
  const damage = hit ? CONFIG.knife.damage : 0;
  if (hit) target.hp = Math.max(0, target.hp - damage);
  events.push({
    type: 'stab',
    unitId: unit.id,
    targetId: target.id,
    hit,
    damage,
    from: { ...unit.pos },
    at: { ...target.pos },
  });
  if (hit && target.hp <= 0) {
    target.alive = false;
    unit.kills += 1;
    events.push({ type: 'died', unitId: target.id, at: { ...target.pos } });
  }
  return null;
}
```

In `src/core/apply.ts` add `import { handleStab } from './actions/stab';` and in `dispatch` after the `AimedShot` case:

```ts
    case 'Stab':
      return handleStab(s, cmd, unit, events);
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If `tsc` reports a non-exhaustive `switch` somewhere else for `GameEvent` or `Command`, add the missing case there (the controller and effects are handled in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/core tests/knife.test.ts
git commit -m "feat(core): add the combat knife (Stab command and stab event)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Stab in the controller, panel and effects

**Files:**
- Modify: `src/input/uiState.ts`, `src/controller.ts`, `src/render/panel.ts`, `src/render/effects.ts`
- Test: `tests/knifeui.test.ts`, `tests/panel.test.ts`

**Interfaces:**
- Consumes: `Stab` command and `stab` event (Task 3); `rankShort` (Task 1); `CONFIG.knife`.
- Produces: `Mode` gains `'stab'`; `ButtonId` gains `'stab'`; `PANEL_BUTTONS` has 8 buttons (order: snap, aimed, throw, stab, door, pickup, alert, end; step 38 px, width 36 px, y = `VIEW.mapHeight + 13`, h 13); `actionCost(u, 'stab') === CONFIG.knife.apCost`; key `k` enters stab mode; `Effects` draws a slash for `stab` events.

- [ ] **Step 1: Write the failing tests**

Create `tests/panel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config';
import { PANEL_BUTTONS, actionCost, buttonAt } from '../src/render/panel';
import { VIEW } from '../src/render/layout';
import { corridorRows, makeState, unit } from './helpers';

describe('panel buttons', () => {
  it('has eight buttons including STAB, all inside the panel and not overlapping', () => {
    expect(PANEL_BUTTONS.map((b) => b.id)).toEqual(
      ['snap', 'aimed', 'throw', 'stab', 'door', 'pickup', 'alert', 'end'],
    );
    for (const b of PANEL_BUTTONS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(VIEW.width);
      expect(b.y + b.h).toBeLessThanOrEqual(VIEW.height);
    }
    for (let i = 1; i < PANEL_BUTTONS.length; i++) {
      const prev = PANEL_BUTTONS[i - 1];
      expect(PANEL_BUTTONS[i].x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
  });

  it('hit-tests every button by its centre', () => {
    for (const b of PANEL_BUTTONS) {
      expect(buttonAt(b.x + b.w / 2, b.y + b.h / 2)).toBe(b.id);
    }
    expect(buttonAt(10, 10)).toBeNull();
  });

  it('shows the knife AP cost', () => {
    const s = makeState(corridorRows('P.E'));
    expect(actionCost(unit(s, 'p1'), 'stab')).toBe(CONFIG.knife.apCost);
    expect(CONFIG.knife.apCost).toBe(20);
  });
});
```

Create `tests/knifeui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Controller } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { corridorRows, makeState, seedForRoll, unit } from './helpers';

function make(inner: string, seeded = true) {
  const s = makeState(corridorRows(inner));
  if (seeded) s.rngState = seedForRoll((n) => n < 0.9); // the first roll is a knife hit
  return new Controller(s, createUiState('p1'), new Effects());
}

describe('stab in the controller', () => {
  it('K enters stab mode with a hint', () => {
    const c = make('PE');
    expect(c.key('k')).toBe(true);
    expect(c.ui.mode).toBe('stab');
    expect(c.ui.message).toMatch(/Stab, 20 AP/);
  });

  it('clicking an adjacent enemy stabs it and returns to move mode', () => {
    const c = make('PE');
    c.key('k');
    c.clickTile({ x: 2, y: 1 });
    expect(c.state.units.find((u) => u.id === 'e1')!.alive).toBe(false);
    expect(unit(c.state, 'p1').ap).toBe(40);
    expect(c.ui.mode).toBe('move');
  });

  it('the STAB button does the same as the key', () => {
    const c = make('PE');
    c.pressButton('stab');
    expect(c.ui.mode).toBe('stab');
  });

  it('clicking an enemy two tiles away says it needs an adjacent enemy and spends nothing', () => {
    const c = make('P.E');
    c.key('k');
    c.clickTile({ x: 3, y: 1 });
    expect(c.ui.message).toBe('Stab needs an adjacent enemy');
    expect(unit(c.state, 'p1').ap).toBe(60);
    expect(c.ui.mode).toBe('move');
  });

  it('clicking an empty tile says to click an adjacent enemy', () => {
    const c = make('P.E');
    c.key('k');
    c.clickTile({ x: 2, y: 1 });
    expect(c.ui.message).toBe('Click an adjacent enemy');
    expect(c.ui.mode).toBe('move');
  });

  it('Escape leaves stab mode', () => {
    const c = make('PE');
    c.key('k');
    c.key('Escape');
    expect(c.ui.mode).toBe('move');
  });
});

describe('stab effects', () => {
  it('draws a line for a stab event and removes it afterwards', () => {
    const fx = new Effects();
    fx.add(
      [{ type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } }],
      0,
    );
    let strokes = 0;
    const ctx = {
      beginPath() {}, moveTo() {}, lineTo() {}, fillRect() {}, arc() {}, fill() {},
      stroke() { strokes += 1; },
      set strokeStyle(_v: string) {}, set fillStyle(_v: string) {}, set lineWidth(_v: number) {},
    } as unknown as CanvasRenderingContext2D;
    fx.draw(ctx, 50);
    expect(strokes).toBe(1);
    strokes = 0;
    fx.draw(ctx, 5000);
    expect(strokes).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/panel.test.ts tests/knifeui.test.ts`
Expected: FAIL (no `stab` button / mode).

- [ ] **Step 3: Implement**

`src/input/uiState.ts`: `export type Mode = 'move' | 'snap' | 'aimed' | 'throw' | 'door' | 'stab';`

`src/controller.ts`:
- Change the config import to `import { CONFIG, WEAPONS } from './core/config';`.
- In `clickTile`, extend the mode dispatch after the `snap`/`aimed` branch:

```ts
    } else if (mode === 'stab') {
      if (!clicked || clicked.side !== 'enemy') {
        this.say('Click an adjacent enemy');
        return;
      }
      this.run({ type: 'Stab', unitId: sel.id, targetId: clicked.id });
    } else if (mode === 'throw') {
```

(Replace the existing `} else if (mode === 'throw') {` line with the block above so the chain stays intact.)
- In `setMode`'s `hint` record add: `stab: \`Stab, ${CONFIG.knife.apCost} AP: click an adjacent enemy\`,`
- In `pressButton` add `case 'stab': this.setMode('stab'); break;`
- In `key` add `case 'k': this.setMode('stab'); return true;`
- In `eventVisible` add `case 'stab': return seen(ev.from) || seen(ev.at);`

`src/render/effects.ts`:
- Add to the `Effect` union: `| { kind: 'slash'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }`
- In `add`, after the `shot` branch:

```ts
      } else if (e.type === 'stab') {
        this.list.push({ kind: 'slash', from: e.from, to: e.at, hit: e.hit, start: now, dur: 220 });
        if (e.hit) this.list.push({ kind: 'flash', at: e.at, color: '255,80,80', start: now + 60, dur: 300 });
```

- In `draw`, after the `shot` branch:

```ts
      } else if (e.kind === 'slash') {
        const a = center(e.from);
        const b = center(e.to);
        ctx.strokeStyle = e.hit ? '#ff5555' : '#9aa0b5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.lineWidth = 1;
```

`src/render/panel.ts`:
- Imports: `import { CONFIG, WEAPONS } from '../core/config';` (already) and `import { rankShort } from '../core/ranks';`.
- `ButtonId`: add `'stab'`.
- `DEFS`: insert `['stab', 'STAB', 'K'],` after the `throw` entry.
- Geometry: `x: 172 + i * 38, y: VIEW.mapHeight + 13, w: 36, h: 13,`
- `actionCost`: add `case 'stab': return CONFIG.knife.apCost;`
- `MODE_NAMES`: add `stab: 'Stab',`
- Label and cost text offsets: `ctx.fillText(\`${b.key} ${b.label}\`, b.x + 2, b.y + 3);` and `ctx.fillText(\`${cost} AP\`, b.x + 2, b.y + 15);`
- Soldier line: replace the first `fillText` in the `if (u)` block with:

```ts
    const tag = rankShort(u.rank);
    ctx.fillText(`${tag ? `${tag} ` : ''}${u.name}  HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}`, 4, top + 4);
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests/panel.test.ts tests/knifeui.test.ts
git commit -m "feat: STAB button, K key, stab mode, slash effect and rank on the panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rank on the equipment screen, promotions on the result screen

**Files:**
- Modify: `src/core/ranks.ts` (add `promotions`), `src/screens/equipment.ts`, `src/screens/result.ts`, `src/app.ts`
- Test: `tests/ranks.test.ts` (append), `tests/app.test.ts` (append)

**Interfaces:**
- Consumes: `rankFor`, `RosterSoldier`.
- Produces: `promotions(before: RosterSoldier[], after: RosterSoldier[]): string[]` returning `'Name (Rank)'` for each soldier present in both rosters (matched by name) whose rank threshold rose; `soldierLines(who): string[]` in `equipment.ts`; `EquipmentView.soldiers` items gain optional `rank?: string`; `ResultView.promoted: string[]`; public `App.promoted: string[]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ranks.test.ts` (add `promotions` to the `../src/core/ranks` import and `import { soldierLines } from '../src/screens/equipment';`):

```ts
describe('promotions', () => {
  const r = (name: string, kills: number) => ({ name, kills });

  it('lists soldiers whose rank went up, by name', () => {
    const before = [r('A', 1), r('B', 4), r('C', 8), r('D', 0)];
    const after = [r('A', 2), r('B', 5), r('C', 9), r('D', 1)];
    expect(promotions(before, after)).toEqual(['A (Private)', 'B (Sergeant)', 'C (Captain)']);
  });

  it('ignores more kills without a new rank and soldiers not in the new roster', () => {
    expect(promotions([r('A', 2), r('Dead', 4)], [r('A', 4), r('Rookie', 0)])).toEqual([]);
  });

  it('a skipped rank still announces the rank reached', () => {
    expect(promotions([r('A', 0)], [r('A', 6)])).toEqual(['A (Sergeant)']);
  });
});

describe('soldierLines', () => {
  it('shows name, rank and kills on separate lines, so long names stay clear of the buttons', () => {
    expect(soldierLines({ name: 'Chen', kills: 6, rank: 'Sergeant' })).toEqual(['Chen', 'Sergeant', '6 kills']);
  });

  it('works without a rank', () => {
    expect(soldierLines({ name: 'P1', kills: 0 })).toEqual(['P1', '0 kills']);
  });
});
```

Append to `tests/app.test.ts`:

```ts
describe('promotions after a mission', () => {
  it('announces a soldier whose kills reach a new rank', () => {
    const { app } = make({
      createMission: () => {
        const s = winTiny();
        unit(s, 'p1').kills = 2; // two kills this mission: Rookie to Private
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    expect(app.screen).toBe('result');
    expect(app.promoted).toEqual(['Alvarez (Private)']);
  });

  it('announces nothing for a soldier who died, who is replaced by a Rookie', () => {
    const { app } = make({
      createMission: () => {
        const s = winTiny();
        unit(s, 'p1').kills = 9;
        unit(s, 'p1').alive = false;
        return s;
      },
    });
    app.click(START);
    endWin(app, 1000);
    expect(app.promoted).toEqual([]);
    expect(app.campaign.roster[0].kills).toBe(0); // the replacement rookie
  });

  it('a later mission without promotions clears the list', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    endWin(app, 1000);
    expect(app.promoted).toEqual([]);
    wait();
    app.click(CONTINUE);
    expect(app.promoted).toEqual([]);
  });
});
```

(`unit` is already imported in `tests/app.test.ts`; `make`, `endWin`, `START`, `CONTINUE`, `winTiny` already exist there.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ranks.test.ts tests/app.test.ts`
Expected: FAIL (`promotions`, `soldierLines`, `app.promoted` missing).

- [ ] **Step 3: Implement**

`src/core/ranks.ts` append (add `import type { RosterSoldier } from './campaign';` at the top):

```ts
/** "Name (Rank)" for every soldier in both rosters whose rank rose, matched by name. */
export function promotions(before: RosterSoldier[], after: RosterSoldier[]): string[] {
  const out: string[] = [];
  for (const now of after) {
    const old = before.find((b) => b.name === now.name);
    if (!old) continue;
    const was = rankFor(old.kills);
    const is = rankFor(now.kills);
    if (is.minKills > was.minKills) out.push(`${now.name} (${is.name})`);
  }
  return out;
}
```

`src/screens/equipment.ts`:
- `EquipmentView.soldiers` type becomes `{ name: string; kills: number; rank?: string }[]`.
- Add and export:

```ts
/** The text lines beside a soldier's row: name, rank (if known), kills. */
export function soldierLines(who: { name: string; kills: number; rank?: string }): string[] {
  return who.rank ? [who.name, who.rank, `${who.kills} kills`] : [who.name, `${who.kills} kills`];
}
```

- In `drawEquipment` replace the name/kills drawing:

```ts
    const who = view.soldiers[i];
    if (who) {
      soldierLines(who).forEach((line, n) => {
        ctx.fillStyle = n === 0 ? '#e8e8f0' : '#8a8fa8';
        ctx.fillText(line, 8, y + 3 + n * 11);
      });
    } else {
      ctx.fillStyle = '#e8e8f0';
      ctx.fillText(`P${i + 1}`, 8, y + 3);
    }
```

(this replaces the existing `const who = ...`, the `fillStyle`/`fillText(who ? who.name : ...)` and the `if (who) { ... kills ... }` block.)

`src/screens/result.ts`:
- `ResultView` gains `promoted: string[];`
- In `drawResult`, after the "Next mission budget" `fillText`, add:

```ts
  if (v.promoted.length > 0) {
    ctx.fillStyle = '#7dff9a';
    ctx.fillText(clip(`Promoted: ${v.promoted.join(', ')}`, 44), c.x + 30, c.y + 132);
  }
```

(The card has room for one line above the Continue button; promotions are joined and clipped.)

`src/app.ts`:
- Import: `import { promotions, rankFor } from './core/ranks';`
- Field: `promoted: string[] = [];` (public, next to `result`).
- In `update`, around `recordMission`:

```ts
      const fallenBefore = this.campaign.fallen.length;
      const rosterBefore = this.campaign.roster;
      this.result = summarize(c.state);
      this.campaign = recordMission(this.campaign, c.state, this.missions.length, this.usedLoadout);
      this.promoted = promotions(rosterBefore, this.campaign.roster);
```

(keep the existing `fallenNow` line after it.)
- In `equipmentView`: `soldiers: c.roster.map((r) => ({ ...r, rank: rankFor(r.kills).name })),`
- In `draw` for the result screen add `promoted: this.promoted,` to the object passed to `drawResult`.
- In `newCampaignScreen` and `startMission` reset `this.promoted = [];` (add the line next to `this.result = null;` in both).

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: show ranks on the equipment screen and announce promotions

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and end-to-end check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Read `README.md` and update the controls and rules sections: add the STAB action (`K`, 20 AP, adjacent enemy, very high damage), the ranks table (Private 2 kills, Sergeant 5, Captain 9, with bonuses), and a sentence that every action button shows its AP cost. Keep the file's existing style.

- [ ] **Step 2: Full verification**

Run: `npx vitest run` then `npx tsc --noEmit` then `npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 3: Check it in the browser**

Start the dev server with `preview_start` (`laser-tribute` from `.claude/launch.json`). In the page console (`window.app` exists in dev):
1. Set `app.campaign.roster[0].kills = 9; app.campaign.roster[1].kills = 5; app.campaign.roster[2].kills = 2;` then `app.draw(canvas ctx, performance.now())` and screenshot the equipment screen: ranks and kill counts are visible and do not overlap the weapon buttons.
2. Start the mission: the panel shows the rank before the name (for example `Cpt Alvarez  HP 80/80  AP 72/72`), eight buttons including `K STAB` with `20 AP`, and the status line shows `Stab: 20 AP` after pressing `K`. Take a screenshot.
3. Move an enemy next to a soldier via the console (`app.controller.state.units`), press `K`, click the enemy, and confirm the slash effect and that the enemy dies on a hit (or AP drops by 20 on a miss).
Report what you saw. Stop the server with `preview_stop`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe ranks and the combat knife

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** ranks table and `rankFor`/`applyRank` (Task 1); accuracy stat and capped `hitChance` (Task 1); ranks applied at mission creation, enemies and rookies unaffected, AP refill (Task 2); knife rules, command, event, kill credit, AP, adjacency, own side, cap (Task 3); STAB mode/key/button, panel rank text, slash effect, narrower buttons, status line and cost row (Task 4); equipment rank, promotions on the result screen, result text (Task 5); README and a browser check (Task 6). Spec deviations: the result screen joins promotions into one clipped line because the card has room for one line; the equipment screen shows the rank on its own line instead of in front of the name, which avoids overlapping the weapon button.

**Placeholders:** none; every code step contains the code.

**Type consistency:** `rank` is the full rank name on `Unit`; `rankShort` converts it for the panel; `promotions` and `rankFor` use `RosterSoldier`; `stabChance`, `handleStab`, `Stab` command and `stab` event names match across Tasks 3 and 4; `soldierLines`, `ResultView.promoted` and `App.promoted` match across Task 5.

**Review Focus coverage:** thresholds (Task 1), 95% cap (Tasks 1 and 3), stab rejections (Task 3), dead soldier not promoted (Task 5), rank bonuses lasting through the mission and enemies unaffected (Task 2).
