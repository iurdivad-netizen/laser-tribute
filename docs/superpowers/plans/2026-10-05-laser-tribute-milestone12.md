# Laser Tribute Milestone 12: Critical Shots and the Sightscope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hits can be critical (8% snap, 15% aimed, x1.5 damage, both sides), and a sightscope attachment (18 cr, +0.10 accuracy, +0.10 crit chance) in its own equipment slot, with feedback and tests.

**Architecture:** Pure `src/core`: a separate seeded `critState` stream (`nextCrit`) so existing hit sequences are untouched, `critChance`/`hitChance`/`fireShot` changes, and the attachment carried through loadout, stash and saves exactly like gadgets. UI: a SCOPE toggle on the equipment row, a SCOPE tag on the panel, crit spark/flash/message/sound.

**Tech Stack:** TypeScript, Canvas 2D, Vite, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-05-laser-tribute-milestone12-design.md`

## Global Constraints

- `src/core` stays pure and deterministic; crits use `nextCrit` only (never `nextRandom`, never `Math.random`); a crit number is drawn only when a shot hits.
- Numbers: `CRIT = { snap: 0.08, aimed: 0.15, multiplier: 1.5 }`; scope price 18, accuracy +0.10 (inside the 95% cap), crit +0.10; crit damage `floor(weapon damage * 1.5)` then `damageTaken` (armour); cap 4 scopes in the stash.
- `SoldierLoadout.attachment?: AttachmentId` is optional; `Stash.scope` is a required count (fix every `Stash` literal the typechecker reports by appending `, scope: 0`); the `shot` event gets a required `crit: boolean` (fix event literals the typechecker reports with `crit: false`).
- Saves stay at version 1; new fields optional on read; `critState` is never saved.
- Run `npx tsc --noEmit` before every commit (a commit with typecheck errors happened once in milestone 11).
- All on-screen text through `drawText`, characters the 5x7 font supports; canvas 480x400 unchanged.
- New test files: `tests/critcore.test.ts`, `tests/scopestash.test.ts`, `tests/scopeequip.test.ts`, `tests/critfeedback.test.ts`, `tests/critmission.test.ts` (check each name is free with `ls tests`); otherwise append to existing files, never overwrite one.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A crit is drawn from `critState` only on a hit, never changes `rngState`, and a miss leaves `critState` untouched; whole sequences stay deterministic.
- Armour reduces the crit damage; the event reports the damage actually dealt and `crit`; kill credit and rank progress are unchanged; reaction fire can crit.
- The scope bonus sits inside the 95% cap and scales with distance and cover; enemies never get a scope; `hitChance` is unchanged without one.
- Stash accounting for scopes: lent or bought returns only with a surviving soldier, the dead lose it, a lost mission changes nothing, cap 4; equipment row prices still add up to the total; `fitLoadout` drops scopes with gadgets.
- Existing tests that force a hit and expect damage 30 or 18 stay valid (the pinned quiet crit state) and no test now depends on an accidental crit.
- Old saves load; a bad attachment id or scope count never crashes; the equipment and panel layouts still fit with every control filled.

## File Structure

- Modify `src/core/types.ts`, `config.ts`, `rng.ts`, `mission.ts`, `combat.ts`, `loadout.ts`, `stash.ts`, `loot.ts`, `src/save.ts`, `src/screens/equipment.ts`, `src/render/panel.ts`, `src/render/effects.ts`, `src/controller.ts`, `src/audio/effects.ts`, `src/audio/mapping.ts`, `tests/helpers.ts`.
- Tests as listed in the constraints.

---

### Task 1: Crit rule, crit stream and the scope's combat effect

**Files:**
- Modify: `src/core/types.ts`, `src/core/config.ts`, `src/core/rng.ts`, `src/core/mission.ts`, `src/core/combat.ts`, `tests/helpers.ts`
- Test: create `tests/critcore.test.ts`

**Interfaces:**
- Produces: `AttachmentId = 'scope'` (types); `Unit.attachment: AttachmentId | null`; `GameState.critState: number`; `shot` event field `crit: boolean`; `CRIT`, `ATTACHMENTS`, `ATTACHMENT_IDS` (config); `nextCrit(state): number` (rng); `critChance(shooter, mode): number` (combat); test helpers `seedForCrit(pred)` and `quietCritState()`, with `makeState` pinning `critState` to the quiet value.

- [ ] **Step 1: Write the failing tests**

Create `tests/critcore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { critChance, hitChance } from '../src/core/combat';
import { ATTACHMENTS, ATTACHMENT_IDS, CRIT } from '../src/core/config';
import { nextCrit, nextRandom } from '../src/core/rng';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, ok, seedForCrit, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);

/** P and E two tiles apart with a tough enemy so damage is readable. */
function duel() {
  const s = makeState(corridorRows('P.E'));
  unit(s, 'p1').facing = 2;
  const e = unit(s, 'e1');
  e.hp = e.maxHp = 100;
  s.rngState = HIT();
  return s;
}

const snap = { type: 'SnapShot' as const, unitId: 'p1', targetId: 'e1' };
const aimed = { type: 'AimedShot' as const, unitId: 'p1', targetId: 'e1' };

describe('crit data and stream', () => {
  it('has the agreed numbers', () => {
    expect(CRIT).toEqual({ snap: 0.08, aimed: 0.15, multiplier: 1.5 });
    expect([...ATTACHMENT_IDS]).toEqual(['scope']);
    expect(ATTACHMENTS.scope).toMatchObject({ price: 18, accuracy: 0.1, crit: 0.1 });
  });

  it('every unit starts without an attachment', () => {
    expect(makeState(corridorRows('P.E')).units.every((u) => u.attachment === null)).toBe(true);
  });

  it('nextCrit is deterministic and independent of the hit stream', () => {
    const a = { rngState: 5, critState: 9 } as GameState;
    const b = { rngState: 5, critState: 9 } as GameState;
    expect(nextCrit(a)).toBe(nextCrit(b));
    const before = a.rngState;
    nextCrit(a);
    expect(a.rngState).toBe(before);
    const critBefore = a.critState;
    nextRandom(a);
    expect(a.critState).toBe(critBefore);
  });
});

describe('critChance and hitChance', () => {
  it('is 8% snap, 15% aimed, and 10 points more with a scope', () => {
    const s = makeState(corridorRows('P.E'));
    const p = unit(s, 'p1');
    expect(critChance(p, 'snap')).toBeCloseTo(0.08, 5);
    expect(critChance(p, 'aimed')).toBeCloseTo(0.15, 5);
    p.attachment = 'scope';
    expect(critChance(p, 'snap')).toBeCloseTo(0.18, 5);
    expect(critChance(p, 'aimed')).toBeCloseTo(0.25, 5);
  });

  it('a scope adds 10 points of base accuracy, scaled by distance, and respects the 95% cap', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(6) + 'E')); // distance 7, rifle range 14
    const p = unit(s, 'p1');
    const e = unit(s, 'e1');
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo(0.375, 4);
    p.attachment = 'scope';
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo(0.6 * 0.75, 4);
    p.accuracy = 0.5; // 1.0 already over the cap
    const capped = hitChance(s, p, e, 'snap');
    p.attachment = null;
    expect(hitChance(s, p, e, 'snap')).toBeCloseTo(capped, 6);
  });
});

describe('critical shots', () => {
  it('a hit with a low crit draw does 1.5x damage and reports crit', () => {
    const s = duel();
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, snap));
    expect(unit(r.state, 'e1').hp).toBe(100 - 45);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: true, crit: true, damage: 45 }));
  });

  it('a pistol crit does 27', () => {
    const s = duel();
    unit(s, 'p1').weapon = 'pistol';
    s.critState = seedForCrit((n) => n < 0.01);
    expect(unit(ok(applyCommand(s, snap)).state, 'e1').hp).toBe(100 - 27);
  });

  it('a hit with a high crit draw is a normal hit', () => {
    const s = duel();
    s.critState = seedForCrit((n) => n >= 0.5);
    const r = ok(applyCommand(s, snap));
    expect(unit(r.state, 'e1').hp).toBe(70);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', crit: false, damage: 30 }));
  });

  it('aimed shots crit more often than snap shots', () => {
    const draw = seedForCrit((n) => n >= 0.08 && n < 0.15);
    const a = duel();
    a.critState = draw;
    expect(ok(applyCommand(a, snap)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: false }));
    const b = duel();
    b.critState = draw;
    expect(ok(applyCommand(b, aimed)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: true }));
  });

  it('a scope turns a 0.12 draw into a snap-shot crit', () => {
    const draw = seedForCrit((n) => n >= 0.08 && n < 0.18);
    const plain = duel();
    plain.critState = draw;
    expect(ok(applyCommand(plain, snap)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: false }));
    const scoped = duel();
    unit(scoped, 'p1').attachment = 'scope';
    scoped.critState = draw;
    expect(ok(applyCommand(scoped, snap)).events).toContainEqual(expect.objectContaining({ type: 'shot', crit: true }));
  });

  it('armour reduces a critical hit', () => {
    const s = duel();
    unit(s, 'e1').gadget = 'armour';
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, snap));
    expect(unit(r.state, 'e1').hp).toBe(100 - 32); // 45 - floor(13.5) = 32
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', crit: true, damage: 32 }));
  });

  it('a miss never crits and leaves the crit stream alone', () => {
    const s = duel();
    s.rngState = seedForRoll((n) => n >= 0.96);
    s.critState = seedForCrit((n) => n < 0.01);
    const before = s.critState;
    const r = ok(applyCommand(s, snap));
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'shot', hit: false, crit: false, damage: 0 }));
    expect(r.state.critState).toBe(before);
  });

  it('a critical kill credits the kill, and the sequence is deterministic', () => {
    const run = () => {
      const s = duel();
      unit(s, 'e1').hp = unit(s, 'e1').maxHp = 40;
      s.critState = seedForCrit((n) => n < 0.01);
      return ok(applyCommand(s, snap));
    };
    const a = run();
    const b = run();
    expect(unit(a.state, 'e1').alive).toBe(false);
    expect(unit(a.state, 'p1').kills).toBe(1);
    expect(a.events).toEqual(b.events);
    expect(a.state.critState).toBe(b.state.critState);
  });

  it('an enemy can crit a soldier too (reaction fire uses the same fireShot)', () => {
    const s = makeState(corridorRows('P.E'));
    s.turn = 'enemy';
    unit(s, 'e1').facing = 6;
    unit(s, 'p1').hp = unit(s, 'p1').maxHp = 100;
    s.rngState = HIT();
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'e1', targetId: 'p1' }));
    expect(unit(r.state, 'p1').hp).toBe(100 - 45); // e1 carries a rifle
  });
});
```

Add to `tests/helpers.ts` (import `nextCrit` from `'../src/core/rng'` next to `nextRandom`, and `parseMap` is already imported):

```ts
/** Finds a crit state whose first draw satisfies pred, so tests can force a critical hit or none. */
export function seedForCrit(pred: (n: number) => boolean): number {
  for (let seed = 1; seed < 100000; seed++) {
    const probe = { critState: seed } as GameState;
    if (pred(nextCrit(probe))) return seed;
  }
  throw new Error('no crit seed found');
}

let quiet: number | null = null;

/** A crit state whose next 20 draws are all at least 0.25, above every crit chance, so existing tests never crit by accident. */
export function quietCritState(): number {
  if (quiet === null) {
    for (let seed = 1; seed < 1000000 && quiet === null; seed++) {
      const probe = { critState: seed } as GameState;
      let ok = true;
      for (let i = 0; i < 20 && ok; i++) ok = nextCrit(probe) >= 0.25;
      if (ok) quiet = seed;
    }
    if (quiet === null) throw new Error('no quiet crit state found');
  }
  return quiet;
}
```

and change `makeState` to:

```ts
export function makeState(rows: string[]): GameState {
  const s = parseMap(rows);
  s.critState = quietCritState();
  return s;
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/critcore.test.ts`
Expected: FAIL (`CRIT`, `nextCrit`, `critChance` not defined).

- [ ] **Step 3: Implement**

`src/core/types.ts`: add `export type AttachmentId = 'scope';` next to `GadgetId`. `Unit` gains after `gadget`:

```ts
  /** The weapon attachment carried (a sightscope), separate from the gadget; worn for the whole mission. */
  attachment: AttachmentId | null;
```

`GameState` gains after `rngState`: `/** A second seeded stream for critical-hit draws, so crits never change the hit and miss sequence. */ critState: number;`. The `shot` event gains `crit: boolean;` (after `hit: boolean;`).

`src/core/config.ts`: add

```ts
export const CRIT = { snap: 0.08, aimed: 0.15, multiplier: 1.5 } as const;

export const ATTACHMENT_IDS: readonly AttachmentId[] = ['scope'];

export const ATTACHMENTS = {
  scope: { name: 'Scope', price: 18, accuracy: 0.1, crit: 0.1 },
} as const;
```

(import `AttachmentId` with the other type imports).

`src/core/rng.ts`: refactor to share the generator:

```ts
function step(seed: number): { next: number; value: number } {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return { next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

export function nextRandom(state: GameState): number {
  const r = step(state.rngState);
  state.rngState = r.next;
  return r.value;
}

/** The critical-hit stream: the same generator on its own state, so crits never shift hit and miss rolls. */
export function nextCrit(state: GameState): number {
  const r = step(state.critState);
  state.critState = r.next;
  return r.value;
}
```

(the values `nextRandom` returns must be identical to before: the body is the same arithmetic.)

`src/core/mission.ts`: in `makeUnit` add `attachment: null,` after `gadget: null,`; in the returned state add `critState: (seed ^ 0x5bd1e995) | 0,` after `rngState: seed,`.

`src/core/combat.ts`: import `ATTACHMENTS`, `CRIT` from `./config` and `nextCrit` from `./rng`; add and use:

```ts
/** The chance that a hit is critical: 8% snap, 15% aimed, 10 points more with a sightscope. */
export function critChance(shooter: Unit, mode: ShotMode): number {
  return CRIT[mode] + (shooter.attachment === 'scope' ? ATTACHMENTS.scope.crit : 0);
}
```

In `hitChance` replace the `base` line with

```ts
  const scope = shooter.attachment === 'scope' ? ATTACHMENTS.scope.accuracy : 0;
  const base = Math.min(CONFIG.maxHitChance, weaponAccuracy + shooter.accuracy + scope);
```

In `fireShot` replace the hit branch:

```ts
  let damage = 0;
  let crit = false;
  let impact: Pos = { ...target.pos };
  if (hit) {
    const raw = WEAPONS[shooter.weapon].damage;
    crit = nextCrit(s) < critChance(shooter, mode);
    damage = damageTaken(target, crit ? Math.floor(raw * CRIT.multiplier) : raw);
    target.hp = Math.max(0, target.hp - damage);
  } else {
```

and add `crit,` to the pushed `shot` event (after `hit,`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/critcore.test.ts`
Expected: PASS (13 tests).

Then run `npx vitest run; npx tsc --noEmit`. Fix, in this order: `shot` event literals the typechecker reports (`tests/soundmap.test.ts`, `tests/arteffects.test.ts`, `tests/combat.test.ts` line 56: add `crit: false`); then any existing test that fails because a mission-built state (created with `createMission`, not `makeState`) hit a random crit: pin `s.critState = quietCritState()` in that test (import it from `./helpers`).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): critical shots on their own random stream, scope accuracy and crit chance"
```

---

### Task 2: Sightscope in the loadout and the stash

**Files:**
- Modify: `src/core/loadout.ts`, `src/core/stash.ts`, `src/core/loot.ts`, every `Stash` literal the typechecker reports
- Test: create `tests/scopestash.test.ts`

**Interfaces:**
- Consumes: `ATTACHMENTS`, `ATTACHMENT_IDS`, `AttachmentId` (Task 1).
- Produces: `SoldierLoadout.attachment?`; `Stash.scope`; `Cover.attachment`.

- [ ] **Step 1: Write the failing tests**

Create `tests/scopestash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyLoadout, defaultLoadout, fitLoadout, loadoutCost, netSoldierCost, soldierCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { addStash, capStash, lootFrom } from '../src/core/loot';
import { coverage, describeStash, emptyStash, nextStash } from '../src/core/stash';
import { corridorRows, makeState, unit } from './helpers';

const scoped = (i = 0): Loadout =>
  defaultLoadout().map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));

describe('scope price and cover', () => {
  it('adds 18 to the soldier and the loadout, and a gadget keeps its own price', () => {
    const base = soldierCost(defaultLoadout()[0]);
    expect(soldierCost(scoped()[0])).toBe(base + 18);
    expect(loadoutCost(scoped())).toBe(loadoutCost(defaultLoadout()) + 18);
    const both = defaultLoadout().map((s, j) => (j === 0 ? { ...s, gadget: 'armour' as const, attachment: 'scope' as const } : s));
    expect(soldierCost(both[0])).toBe(base + 20 + 18);
  });

  it('a stashed scope is free and the row prices still add up to the total', () => {
    const stash = { ...emptyStash(), scope: 1 };
    const l = scoped();
    expect(coverage(l, stash)[0].attachment).toBe(true);
    expect(loadoutCost(l, stash)).toBe(loadoutCost(defaultLoadout()));
    const rows = l.reduce((sum, _s, i) => sum + netSoldierCost(l, i, stash), 0);
    expect(rows).toBe(loadoutCost(l, stash));
  });

  it('the stash is handed out in soldier order', () => {
    const l = defaultLoadout().map((s) => ({ ...s, attachment: 'scope' as const }));
    expect(coverage(l, { ...emptyStash(), scope: 2 }).map((c) => c.attachment)).toEqual([true, true, false, false]);
  });
});

describe('validate, fit and apply', () => {
  it('accepts none and the scope, rejects an unknown id', () => {
    expect(validateLoadout(scoped(), 200)).toBeNull();
    const bad = defaultLoadout().map((s) => ({ ...s, attachment: 'laser' as never }));
    expect(validateLoadout(bad, 200)).toMatch(/attachment/i);
  });

  it('fitLoadout drops scopes (with gadgets) before the cheap kit, keeping weapons', () => {
    const l = defaultLoadout().map((s) => ({ ...s, attachment: 'scope' as const })); // 102 + 72 = 174
    const fitted = fitLoadout(l, 120);
    expect(fitted.every((s) => s.attachment === undefined)).toBe(true);
    expect(fitted.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
  });

  it('applyLoadout gives the chosen soldiers a scope', () => {
    const state = makeState(corridorRows('PPPPE'));
    const l = defaultLoadout();
    l[1] = { ...l[1], attachment: 'scope' };
    l[3] = { ...l[3], attachment: 'scope' };
    const next = applyLoadout(state, l, 200);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).attachment)).toEqual([null, 'scope', null, 'scope']);
  });
});

describe('stash with scopes', () => {
  const finished = () => {
    const s = makeState(corridorRows('PPPPE'));
    s.status = 'won';
    return s;
  };

  it('starts empty and lists scopes', () => {
    expect(emptyStash().scope).toBe(0);
    expect(describeStash({ ...emptyStash(), scope: 1 })).toBe('1 scope');
    expect(describeStash({ ...emptyStash(), scope: 3 })).toBe('3 scopes');
  });

  it('a survivor returns the scope, bought or lent; a dead soldier loses it', () => {
    const used = scoped();
    const alive = finished();
    unit(alive, 'p1').attachment = 'scope';
    expect(nextStash(emptyStash(), used, alive).scope).toBe(1);
    const lent = nextStash({ ...emptyStash(), scope: 1 }, used, alive);
    expect(lent.scope).toBe(1);
    const dead = finished();
    unit(dead, 'p1').attachment = 'scope';
    unit(dead, 'p1').alive = false;
    expect(nextStash({ ...emptyStash(), scope: 1 }, used, dead).scope).toBe(0);
    expect(nextStash(emptyStash(), used, dead).scope).toBe(0);
  });

  it('caps scopes at 4, adds them, and loot carries none', () => {
    const big = { ...emptyStash(), scope: 9 };
    expect(capStash(big).scope).toBe(4);
    expect(addStash(big, big).scope).toBe(18);
    expect(lootFrom(finished()).scope).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/scopestash.test.ts`
Expected: FAIL (no attachment support).

- [ ] **Step 3: Implement**

`src/core/loadout.ts`: import `ATTACHMENTS`, `ATTACHMENT_IDS` with the config imports and `AttachmentId` from `./types`. `SoldierLoadout` gains `/** The weapon attachment carried; absent means none. */ attachment?: AttachmentId;`. `soldierCost`: append `+ (s.attachment ? ATTACHMENTS[s.attachment].price : 0)`. In the `free` reduce and in `netSoldierCost`, subtract (or add into `free`) `c.attachment && l[i].attachment ? ATTACHMENTS[l[i].attachment!].price : 0`, mirroring the gadget lines. `validateLoadout`, in the per-soldier loop: `if (s.attachment !== undefined && !ATTACHMENT_IDS.includes(s.attachment)) return \`Soldier ${i + 1} has an unknown attachment\`;`. `fitLoadout`: change the `bare` line to drop both:

```ts
  const bare = trimmed.map(({ gadget: _gadget, attachment: _attachment, ...rest }) => rest);
```

`applyLoadout`: add `u.attachment = l[i].attachment ?? null;`.

`src/core/stash.ts`: `Stash` gains `scope: number;`; `emptyStash` returns `scope: 0`; `Cover` gains `attachment: boolean`; in `coverage` after the gadget lines:

```ts
    const a = s.attachment;
    const attachment = !!a && left[a] > 0;
    if (attachment && a) left[a] -= 1;
    return { weapon, grenades, clips, gadget, attachment };
```

(replace the existing `return` accordingly); `nextStash`: in the first loop `if (cover[i].attachment && s.attachment) next[s.attachment] -= 1;`; in the survivors loop `if (s.attachment && u.attachment === s.attachment) next[s.attachment] += 1;`; `describeStash` appends `stash.scope > 0 ? plural(stash.scope, 'scope', 'scopes') : ''`.

`src/core/loot.ts`: `addStash` adds `scope: a.scope + b.scope`; `capStash` returns `scope: Math.min(s.scope, STASH_CAP.gadgets)`.

Then `npx tsc --noEmit` and append `, scope: 0` to every reported `Stash` literal (for the many literals ending `scanner: 0 }` a regex replacing `scanner: (\d+) \}` with `scanner: $1, scope: 0 }` over the test files fixes most; give `src/save.ts`'s `stash()` return `scope: 0` for now, Task 3 finishes it).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/scopestash.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): the sightscope in the loadout, prices and stash"
```

---

### Task 3: Saves

**Files:**
- Modify: `src/save.ts`
- Test: append to `tests/save.test.ts`

**Interfaces:**
- Produces: `parseSave` accepts an optional `attachment` per loadout entry and an optional `scope` stash count.

- [ ] **Step 1: Write the failing tests**

Append to `tests/save.test.ts`:

```ts
describe('the sightscope in a save', () => {
  it('an old save without the fields still loads with no scope', () => {
    const save = parseSave(json((o) => { delete o.campaign.stash.scope; }), 3)!;
    expect(save.campaign.stash.scope).toBe(0);
    expect(save.loadout.every((s) => s.attachment === undefined)).toBe(true);
  });

  it('round-trips a scope in the loadout and the stash', () => {
    const mem = memory();
    const store = new SaveStore(mem, 3);
    const c = played();
    c.stash = { ...c.stash, scope: 2 };
    const loadout = defaultLoadout();
    loadout[1] = { ...loadout[1], attachment: 'scope', gadget: 'armour' };
    store.save(c, loadout);
    expect(store.load()).toEqual({ campaign: c, loadout });
  });

  it('an unknown attachment id replaces the whole loadout with the default one', () => {
    const bad = defaultLoadout().map((s, i) => (i === 2 ? { ...s, clips: 3, attachment: 'laser' } : s));
    expect(parseSave(json((o) => { o.loadout = bad; }), 3)!.loadout).toEqual(defaultLoadout());
  });

  it('rejects a negative, fractional or huge scope count', () => {
    for (const bad of [-1, 1.5, 100]) {
      expect(parseSave(json((o) => { o.campaign.stash.scope = bad; }), 3)).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/save.test.ts`
Expected: FAIL (the new fields are dropped or ignored).

- [ ] **Step 3: Implement**

In `src/save.ts` import `ATTACHMENT_IDS` with `GADGET_IDS`. In `stash(v)` read `const scope = optional(v.scope);`, add `|| scope === null` to the null check and return `scope` in the object. In `loadout(v)` inside the loop, after the gadget check:

```ts
    if (s.attachment !== undefined && !ATTACHMENT_IDS.includes(s.attachment as never)) return defaultLoadout();
```

and add to the `out.push({...})` object `...(s.attachment !== undefined ? { attachment: s.attachment as (typeof ATTACHMENT_IDS)[number] } : {}),`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/save.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean. Prove the "unknown attachment" test bites by running it against the previous `src/save.ts` (`git stash` the file or `git show HEAD:src/save.ts`): it must fail there.

- [ ] **Step 5: Commit**

```bash
git add src/save.ts tests/save.test.ts
git commit -m "feat: the sightscope in saved campaigns"
```

---

### Task 4: The SCOPE toggle on the equipment screen

**Files:**
- Modify: `src/screens/equipment.ts`
- Test: create `tests/scopeequip.test.ts`; append a case to `tests/layout.test.ts`

**Interfaces:**
- Produces: `EquipmentHit` kind `'scope'`; `EQ.scope = { x: 352, w: 100 }`; `toggleScope(l, i, budget, stash): Loadout`; `scopeBlockReason(l, i, budget, stash): string | null`; the button label `NO SCOPE` / `SCOPE (18)` / `SCOPE (FREE)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/scopeequip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { emptyStash } from '../src/core/stash';
import {
  EQ, applyEquipmentHit, blockReasonFor, drawEquipment, equipmentHit, scopeBlockReason, toggleScope,
} from '../src/screens/equipment';
import { onText } from '../src/ui/text';

describe('SCOPE toggle on the equipment screen', () => {
  it('sits at the right end of the second line of each row and is found by equipmentHit', () => {
    for (let i = 0; i < 4; i++) {
      const y = EQ.rowTop + i * EQ.rowStep + EQ.clipDy + 2;
      expect(equipmentHit(EQ.scope.x + 2, y)).toEqual({ kind: 'scope', index: i });
    }
  });

  it('toggles on and off', () => {
    const on = toggleScope(defaultLoadout(), 1, 500, emptyStash());
    expect(on[1].attachment).toBe('scope');
    const off = toggleScope(on, 1, 500, emptyStash());
    expect(off[1].attachment).toBeUndefined();
  });

  it('stays off when the budget cannot pay 18, and says why on hover', () => {
    const l = defaultLoadout();
    const budget = loadoutCost(l) + 17;
    expect(toggleScope(l, 0, budget, emptyStash())).toBe(l);
    expect(scopeBlockReason(l, 0, budget, emptyStash())).toBe('Need 1 more credits');
    expect(blockReasonFor(l, { kind: 'scope', index: 0 }, budget, emptyStash())).toBe('Need 1 more credits');
    expect(scopeBlockReason(l, 0, budget + 1, emptyStash())).toBeNull();
  });

  it('turning a scope off is always allowed, and applyEquipmentHit toggles', () => {
    const l = toggleScope(defaultLoadout(), 2, 500, emptyStash());
    expect(scopeBlockReason(l, 2, 0, emptyStash())).toBeNull();
    expect(applyEquipmentHit(defaultLoadout(), { kind: 'scope', index: 3 }, 500, emptyStash())[3].attachment).toBe('scope');
  });

  it('shows the label, the price and FREE from the stash, and found scopes in the line', () => {
    const l = toggleScope(defaultLoadout(), 0, 500, emptyStash());
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const view = { budget: 500, title: 'T', breakdown: '', soldiers: [] };
    drawEquipment(ctx, l, null, { ...view, stash: emptyStash() });
    expect(texts).toContain('SCOPE (18)');
    expect(texts).toContain('NO SCOPE');
    texts.length = 0;
    drawEquipment(ctx, l, null, { ...view, stash: { ...emptyStash(), scope: 2 } });
    stop();
    expect(texts).toContain('SCOPE (FREE)');
    expect(texts.some((t) => t.includes('2 scopes'))).toBe(true);
  });
});
```

Append to `tests/layout.test.ts` (before the checker-itself block), reusing its existing `drawEquipment` and `defaultLoadout` imports:

```ts
  it('the equipment screen with every control filled: weapon, gadget, scope, long names, a full stash', () => {
    const l = defaultLoadout().map((s) => ({ ...s, gadget: 'scanner' as const, attachment: 'scope' as const, clips: 4, grenades: 3 }));
    check('equipment full', collect(() => drawEquipment(ctx, l, null, {
      budget: 999, title: 'MISSION 3 OF 3: COMPOUND', breakdown: 'Base 120 + wins 40 + kills 55',
      soldiers: Array.from({ length: 4 }, () => ({ name: 'Lindqvist 2', kills: 99, rank: 'Captain' })),
      stash: { rifle: 4, pistol: 0, grenade: 9, clip: 4, medkit: 4, armour: 4, scanner: 4, scope: 4 },
    })));
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/scopeequip.test.ts tests/layout.test.ts`
Expected: FAIL (`EQ.scope`, `toggleScope` missing).

- [ ] **Step 3: Implement**

In `src/screens/equipment.ts`: import `ATTACHMENTS` with `GADGETS`. Extend `EquipmentHit`'s first variant with `'scope'`; add to `EQ`: `scope: { x: 352, w: 100 },`. Add:

```ts
export function scopeBlockReason(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  if (l[i].attachment) return null; // taking it off is always allowed
  const after = l.map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));
  const need = loadoutCost(after, stash) - budget;
  return need > 0 ? `Need ${need} more credits` : null;
}

export function toggleScope(
  l: Loadout, i: number, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  if (l[i].attachment) {
    return l.map((s, j) => {
      if (j !== i) return s;
      const { attachment: _attachment, ...rest } = s;
      return rest;
    });
  }
  if (scopeBlockReason(l, i, budget, stash)) return l;
  return l.map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));
}
```

`equipmentHit`: after the gadget rect add `if (inRect(px, py, EQ.scope.x, cy, EQ.scope.w, EQ.btnH)) return { kind: 'scope', index: i };`. `blockReasonFor`: `case 'scope': return scopeBlockReason(l, hit.index, budget, stash);`. `applyEquipmentHit`: `case 'scope': return toggleScope(l, hit.index, budget, stash);`. In `drawEquipment` after the gadget button:

```ts
    drawButton(
      ctx, { x: EQ.scope.x, y: cy, w: EQ.scope.w, h: EQ.btnH },
      s.attachment ? `SCOPE (${cover.attachment ? 'FREE' : ATTACHMENTS.scope.price})` : 'NO SCOPE',
      buttonState(scopeBlockReason(l, i, view.budget, view.stash) === null, hot('scope')),
    );
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/scopeequip.test.ts tests/layout.test.ts; npx vitest run; npx tsc --noEmit`
Expected: PASS; suite green; typecheck clean. If the layout checker reports an overlap or overflow, fix the layout (not the checker) and ledger it as a Ruling.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: SCOPE toggle on the equipment screen"
```

---

### Task 5: Panel tag and critical-hit feedback

**Files:**
- Modify: `src/render/panel.ts`, `src/render/effects.ts`, `src/controller.ts`, `src/audio/effects.ts`, `src/audio/mapping.ts`
- Test: create `tests/critfeedback.test.ts`; update `tests/soundeffects.test.ts` (design list)

**Interfaces:**
- Consumes: `shot.crit` (Task 1), `Unit.attachment`.
- Produces: sound `'crit'`; crit sprites in `Effects`; messages `CRITICAL HIT: N DAMAGE` and `ENEMY CRITICAL HIT: N DAMAGE`.

- [ ] **Step 1: Write the failing tests**

Create `tests/critfeedback.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VOLUME, soundsFor } from '../src/audio/mapping';
import { Controller } from '../src/controller';
import type { GameEvent } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawPanel } from '../src/render/panel';
import { onText } from '../src/ui/text';
import { corridorRows, makeState, seedForCrit, seedForRoll, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

const at = { x: 3, y: 1 };
const shot = (crit: boolean, hit = true): GameEvent => ({
  type: 'shot', unitId: 'p1', targetId: 'e1', mode: 'snap', hit, crit, damage: hit ? 45 : 0, from: { x: 1, y: 1 }, impact: at,
});

describe('crit effects and sound', () => {
  it('a critical hit draws a double-size spark and a yellow flash on the target tile', () => {
    const fx = new Effects();
    fx.add([shot(true)], 1000);
    const frames = fx.frames(1150);
    expect(frames.some((f) => f.type === 'sprite' && f.name === 'spark' && f.scale === 2)).toBe(true);
    expect(frames.some((f) => f.type === 'rect' && f.x === 48 && f.y === 16 && f.color === '255,225,77')).toBe(true);
  });

  it('a normal hit has neither, and a miss never shows a crit', () => {
    const normal = new Effects();
    normal.add([shot(false)], 1000);
    const frames = normal.frames(1150);
    expect(frames.some((f) => f.type === 'sprite' && f.scale === 2)).toBe(false);
    expect(frames.some((f) => f.type === 'rect' && f.color === '255,225,77')).toBe(false);
  });

  it('a crit adds the crit sound to the shot and thud when audible, and nothing when it is not', () => {
    const s = makeState(corridorRows('P..E'));
    const loud = soundsFor(shot(true), s, true).map((h) => h.name);
    expect(loud).toEqual(['rifle', 'hit', 'crit']);
    expect(soundsFor(shot(true), s, true).at(-1)).toEqual({ name: 'crit', volume: VOLUME.impact });
    expect(soundsFor(shot(true), s, false).map((h) => h.name)).toEqual(['rifle']);
    expect(soundsFor(shot(false), s, true).map((h) => h.name)).toEqual(['rifle', 'hit']);
  });
});

describe('crit messages and the scope tag', () => {
  function duel() {
    const state = makeState(corridorRows('P..EE')); // two enemies, so killing e1 does not end the mission
    unit(state, 'p1').facing = 2;
    state.rngState = seedForRoll((n) => n < 0.05);
    state.critState = seedForCrit((n) => n < 0.01);
    return { state, c: new Controller(state, createUiState('p1'), new Effects()) };
  }

  it('says CRITICAL HIT with the damage when your soldier crits', () => {
    const { c } = duel();
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(c.ui.message).toBe('CRITICAL HIT: 45 DAMAGE');
  });

  it('says ENEMY CRITICAL HIT when an enemy crits a soldier, with the damage after armour', () => {
    const { state, c } = duel();
    state.turn = 'enemy';
    const p = unit(state, 'p1');
    p.hp = p.maxHp = 100;
    p.gadget = 'armour';
    c.run({ type: 'SnapShot', unitId: 'e1', targetId: 'p1' });
    expect(c.ui.message).toBe('ENEMY CRITICAL HIT: 32 DAMAGE');
  });

  it('a normal hit sets no crit message', () => {
    const { state, c } = duel();
    state.critState = seedForCrit((n) => n >= 0.5);
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(c.ui.message).not.toMatch(/CRITICAL/);
  });

  it('the panel shows a SCOPE tag on the name line only for a scoped soldier', () => {
    const run = (scope: boolean) => {
      const state = makeState(corridorRows('P..E'));
      unit(state, 'p1').attachment = scope ? 'scope' : null;
      const runs: { text: string; x: number; y: number }[] = [];
      const stop = onText((r) => runs.push(r));
      const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
      drawPanel(ctx, state, createUiState('p1'), 0);
      stop();
      return runs;
    };
    const tag = run(true).find((r) => r.text === 'SCOPE');
    expect(tag).toMatchObject({ x: 108, y: 328 });
    expect(run(false).some((r) => r.text === 'SCOPE')).toBe(false);
  });
});
```

(`y: 328` is `TOP + 8` with `TOP = 320`. The duel map has two enemies on purpose: killing the only enemy would end the mission and the `MISSION COMPLETE` message would replace the crit message.)

In `tests/soundeffects.test.ts` add `'crit'` to the `DESIGN` list (after `'scan'`).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/critfeedback.test.ts tests/soundeffects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/audio/effects.ts`: add `'crit'` to `SOUND_NAMES` (after `'scan'`) and the recipe `crit: [tone('square', 900, 1500, 0, 0.06, 0.3), tone('square', 1500, 2100, 0.07, 0.1, 0.3)],`.

`src/audio/mapping.ts`: in the `shot` case, after the impact line:

```ts
      if (audible && ev.hit && ev.crit) out.push(hit('crit', VOLUME.impact));
```

`src/render/effects.ts`: in the `shot` branch, after the existing spark line:

```ts
        if (e.hit && e.crit) {
          const t = tilePx(e.impact);
          this.sprite(['spark'], { x: t.x - 8, y: t.y - 8 }, now + 80, 300, { scale: 2, fade: true });
          this.list.push({ kind: 'flash', at: e.impact, color: '255,225,77', start: now, dur: 300 });
        }
```

`src/render/panel.ts`: after the line that draws the soldier name, add `if (u.attachment) drawText(ctx, 'SCOPE', 108, TOP + 8, UI.accent);`.

`src/controller.ts`: in `onEvent` add a branch before `healed`:

```ts
    } else if (ev.type === 'shot' && ev.hit && ev.crit) {
      const shooterIsPlayer = this.state.units.find((u) => u.id === ev.unitId)?.side === 'player';
      this.say(`${shooterIsPlayer ? '' : 'ENEMY '}CRITICAL HIT: ${ev.damage} DAMAGE`, 3000);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/critfeedback.test.ts tests/soundeffects.test.ts; npx vitest run; npx tsc --noEmit; npm run build`
Expected: PASS; suite green; typecheck and build clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: SCOPE tag, critical hit spark, message and sound"
```

---

### Task 6: A scripted mission and a look in the browser

**Files:**
- Test: create `tests/critmission.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/critmission.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { defaultLoadout } from '../src/core/loadout';
import { MISSIONS, createMission } from '../src/core/missions';
import { corridorRows, makeState, ok, seedForCrit, seedForRoll, unit } from './helpers';

describe('critical shots and the scope in a mission', () => {
  it('a scoped soldier with a forced crit kills a full-health enemy in one rifle shot', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').attachment = 'scope';
    unit(s, 'p1').facing = 2;
    s.rngState = seedForRoll((n) => n < 0.05);
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false); // 45 >= 40 HP
    expect(r.state.status).toBe('won');
  });

  it('without a crit the same shot leaves the enemy alive', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').facing = 2;
    s.rngState = seedForRoll((n) => n < 0.05);
    s.critState = seedForCrit((n) => n >= 0.5);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(10);
  });

  it('a scope helps a long shot hit: more hits over many seeds than the same shooter without one', () => {
    const hits = (scope: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const s = makeState(corridorRows('P' + '.'.repeat(9) + 'E'));
        unit(s, 'p1').facing = 2;
        unit(s, 'p1').attachment = scope ? 'scope' : null;
        s.rngState = seed;
        const r = ok(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }));
        if (r.events.some((e) => e.type === 'shot' && e.hit)) n += 1;
      }
      return n;
    };
    expect(hits(true)).toBeGreaterThan(hits(false));
  });

  it('missions start without scopes and with a seeded crit stream', () => {
    const a = createMission(MISSIONS[0], 7, undefined, defaultLoadout());
    const b = createMission(MISSIONS[0], 7, undefined, defaultLoadout());
    expect(a.units.every((u) => u.attachment === null)).toBe(true);
    expect(a.critState).toBe(b.critState);
    expect(createMission(MISSIONS[0], 8, undefined, defaultLoadout()).critState).not.toBe(a.critState);
  });
});
```

- [ ] **Step 2: Run, then prove the tests can fail**

Run: `npx vitest run tests/critmission.test.ts`
Expected: PASS. Then temporarily set `CRIT.multiplier` use in `fireShot` to `raw` (no crit) and confirm the first test fails; restore. Temporarily drop the scope accuracy from `hitChance` and confirm the third test fails; restore.

- [ ] **Step 3: Whole suite, typecheck, build, commit**

Run: `npx vitest run; npx tsc --noEmit; npm run build`
Expected: all green and clean.

```bash
git add tests/critmission.test.ts
git commit -m "test: critical shots and the scope in missions"
```

- [ ] **Step 4: Look at it in the Browser pane**

`preview_start` the `laser-tribute-dev` server. In the page (dev hook `window.app`): clear `localStorage` key `laser-tribute-save`, reload; set `app.campaign.missionsWon = 2` (budget 160); click soldier 1's scope button (`x` 400, `y` 56 + 26 + 12 = 94) and soldier 2's; screenshot the equipment screen (SCOPE (18) on two rows, prices, hover). Start the mission (Enter); the soldier-name line should show a `SCOPE` tag for those soldiers. Force a crit in the console: `app.controller.state.critState = <a value whose first nextCrit is < 0.01>` (compute with `seedForCrit`-style search in the console using the same generator, or set `c.state.units.find(u => u.id === 'e1').pos` next to a soldier and fire repeatedly until a `CRITICAL HIT` message appears), and screenshot the double-size spark and the panel message. Check `read_console_messages` for errors. Reset the viewport, stop the server, clear `laser-tribute-save` from `localStorage`.

- [ ] **Step 5: Commit any fix** found in the browser (test first); otherwise nothing to commit.
