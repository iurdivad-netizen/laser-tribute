# Milestone 18: more weapons and throwables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shotgun, SMG and sniper rifle plus smoke, flashbang and incendiary throwables, driven by data tables with a campaign unlock ladder.

**Architecture:** `WEAPONS` and a new `THROWABLES` table in `src/core/config.ts` carry stats, price and `unlockAt`. Rule fields (`burst`, `falloff`, `closePenalty`, `sight`) on the weapon entry feed the existing combat code. Smoke and fire are `state.hazards`, ticked in `handleEndTurn`, read by vision, pathing and the renderer. The stash stays a flat record of counters, now looped over a key list.

**Tech Stack:** TypeScript, Vitest, Canvas, Vite. Run tests with `npx vitest run`, types with `npx tsc --noEmit` (tsc covers `tests/`).

**Spec:** `docs/superpowers/specs/2026-10-07-laser-tribute-milestone18-design.md`

## Global Constraints

- `src/core` stays pure: commands and events, seeded RNG (`nextRandom`, `nextCrit`), no rendering.
- Baseline: 1284 tests green on `milestone-18`. Every task ends with the whole suite green and `npx tsc --noEmit` clean.
- No PixelLab generations; all art hand-drawn (`scripts/hand-images.mjs`, regenerate with `node scripts/build-figures.mjs`, then `git checkout src/art/figures.generated.ts` if only line endings changed) or drawn in code.
- Unlock levels: tutorial is fixed at level 1; campaign level = `missionIndex + 1`. `unlockAt`: pistol, rifle, frag 1; shotgun, smoke 2; SMG, flashbang 4; sniper, incendiary 6.
- Stat tables exactly as in the spec (weapons: shotgun 45 dmg, range 6, 15/25 AP, 0.60/0.75, mag 4, falloff 0.9, 22 cr; SMG 12 dmg, range 9, 18/28 AP, 0.45/0.60, mag 12, burst 3, 28 cr; sniper 55 dmg, range 16, 25/35 AP, 0.40/0.90, mag 3, falloff 0.2, closePenalty within 3 x0.5, sight 14, 40 cr. Throwables: frag 24 AP r8 radius 1 dmg 40 breaks doors 8 cr; smoke 18 AP r8 radius 2 hazard smoke 3 turns 10 cr; flash 18 AP r8 radius 2 apPenalty 30 10 cr; incendiary 24 AP r8 radius 1 dmg 15 hazard fire 3 turns 14 cr).
- Fire per-turn damage 10, smoke and fire last 3 turns.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Rulings made while planning (spec is the authority; these fill gaps)

- The stash keeps its existing field names (`grenade` is the frag count) and gains `shotgun, smg, sniper, smoke, flash, incendiary`. A `STASH_KEYS` list drives every loop. This avoids renaming 59 call sites; cost if wrong: a later rename.
- Only three new floor-item images (`item_shotgun`, `item_smg`, `item_sniper`) are drawn now. Throwables cannot lie on the floor (floor items stay `ItemKind = WeaponId | 'grenade'`), so the spec's three throwable pickup images are not needed yet; cost if wrong: three small images later.
- A looted weapon or throwable is allowed in a loadout when the stash holds one, even if locked.
- Picking up a floor frag while carrying another throwable kind is refused ("Carrying another throwable") unless the unit has none left.
- The tutorial enemies keep the existing alternating rifle and pistol (no draw at level 1).

## Review Focus

- A soldier carrying a locked weapon from an old save must not crash loading: unknown or locked kinds fall back to the default loadout.
- A burst on a target that dies mid-burst must stop and never go negative on ammo.
- Smoke on the viewer's or target's own tile must not blind or reveal across more than one tile; smoke must not block throws or walking.
- Flash penalty must never push AP below 0 and must clear after one use, also when the flashed unit is on the thrower's side.
- Fire damage can kill and can end the mission (last enemy burns); the game-over check must still run.
- A unit boxed in by fire must still be able to move (fire is a path cost, not a wall).
- Enemy weapon draw must never hand out a weapon above the mission's level, and must be deterministic per seed.

---

## File Structure

- Modify `src/core/types.ts`: `WeaponId`, `ThrowableId`, `Unit.throwable`, `Unit.apPenalty`, `Hazard`, `GameState.hazards`, grenade event fields, `burned` event.
- Modify `src/core/config.ts`: tables, helpers (`unlockedWeapons`, `unlockedThrowables`, `TUTORIAL_LEVEL`, `HAZARD`).
- Modify `src/core/loadout.ts`, `stash.ts`, `loot.ts`, `campaign.ts`, `save.ts`, `mission.ts`, `missions.ts`: catalogue, keyed stash, level plumbing, save compatibility.
- Create `src/core/enemyArms.ts`: enemy weapon draw by level.
- Modify `src/core/combat.ts`, `vision.ts`, `actions/shoot.ts`, `actions/throw.ts`, `actions/item.ts`, `actions/endTurn.ts`, `path.ts`: weapon rules, hazards, flash and fire.
- Modify `src/art/figure.ts`, `sprites.ts`, `theme.ts`, `scripts/hand-images.mjs`, `src/render/renderer.ts`, `effects.ts`, `panel.ts`, `src/screens/equipment.ts`, `src/controller.ts`, `src/app.ts`, `src/audio/mapping.ts`: art and UI.
- Create tests: `tests/catalogue.test.ts`, `tests/enemyarms.test.ts`, `tests/weaponrules.test.ts`, `tests/hazards.test.ts`, `tests/throwables.test.ts`, `tests/newweaponsart.test.ts`, `tests/balance.test.ts`; extend `tests/stash.test.ts`, `tests/save.test.ts`, `tests/equipment.test.ts`, `tests/panel.test.ts` (use the existing panel/equipment test files; create if the name differs: `ls tests | grep -i panel`).

---

### Task 1: Catalogue tables and unlock helpers

**Files:**
- Modify: `src/core/types.ts`, `src/core/config.ts`
- Test: `tests/catalogue.test.ts`

**Interfaces:**
- Produces: `WeaponId` (5 ids), `ThrowableId` (4 ids), `WEAPON_IDS`, `THROWABLE_IDS`, `WEAPONS` (extended `WeaponDef` with `price`, `unlockAt`, optional `burst`, `falloff`, `closePenalty`, `sight`), `THROWABLES`, `HAZARD`, `TUTORIAL_LEVEL`, `unlockedWeapons(level)`, `unlockedThrowables(level)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/catalogue.test.ts
import { describe, expect, it } from 'vitest';
import {
  HAZARD, THROWABLES, THROWABLE_IDS, TUTORIAL_LEVEL, WEAPONS, WEAPON_IDS, unlockedThrowables, unlockedWeapons,
} from '../src/core/config';

describe('the catalogue', () => {
  it('lists five weapons and four throwables, every id in its table', () => {
    expect([...WEAPON_IDS]).toEqual(['pistol', 'rifle', 'shotgun', 'smg', 'sniper']);
    expect([...THROWABLE_IDS]).toEqual(['frag', 'smoke', 'flash', 'incendiary']);
    for (const id of WEAPON_IDS) expect(WEAPONS[id].name.length).toBeGreaterThan(0);
    for (const id of THROWABLE_IDS) expect(THROWABLES[id].name.length).toBeGreaterThan(0);
  });

  it('keeps the old stats and adds the new ones from the spec', () => {
    expect(WEAPONS.rifle).toMatchObject({ damage: 30, range: 14, snapAp: 15, aimedAp: 30, magazine: 5, price: 25, unlockAt: 1 });
    expect(WEAPONS.pistol).toMatchObject({ damage: 18, range: 8, magazine: 8, price: 10, unlockAt: 1 });
    expect(WEAPONS.shotgun).toMatchObject({ damage: 45, range: 6, snapAp: 15, aimedAp: 25, magazine: 4, falloff: 0.9, price: 22, unlockAt: 2 });
    expect(WEAPONS.smg).toMatchObject({ damage: 12, range: 9, snapAp: 18, aimedAp: 28, magazine: 12, burst: 3, price: 28, unlockAt: 4 });
    expect(WEAPONS.sniper).toMatchObject({
      damage: 55, range: 16, snapAp: 25, aimedAp: 35, magazine: 3, falloff: 0.2, sight: 14, price: 40, unlockAt: 6,
      closePenalty: { within: 3, multiplier: 0.5 },
    });
    expect(THROWABLES.frag).toMatchObject({ apCost: 24, range: 8, radius: 1, damage: 40, breaksDoors: true, price: 8, unlockAt: 1 });
    expect(THROWABLES.smoke).toMatchObject({ apCost: 18, radius: 2, hazard: { kind: 'smoke', turns: 3 }, price: 10, unlockAt: 2 });
    expect(THROWABLES.flash).toMatchObject({ apCost: 18, radius: 2, apPenalty: 30, price: 10, unlockAt: 4 });
    expect(THROWABLES.incendiary).toMatchObject({ apCost: 24, radius: 1, damage: 15, hazard: { kind: 'fire', turns: 3 }, price: 14, unlockAt: 6 });
    expect(HAZARD.fireDamage).toBe(10);
  });

  it('unlocks along the ladder, and the tutorial is level 1', () => {
    expect(TUTORIAL_LEVEL).toBe(1);
    expect(unlockedWeapons(1)).toEqual(['pistol', 'rifle']);
    expect(unlockedWeapons(2)).toEqual(['pistol', 'rifle', 'shotgun']);
    expect(unlockedWeapons(4)).toEqual(['pistol', 'rifle', 'shotgun', 'smg']);
    expect(unlockedWeapons(10)).toEqual([...WEAPON_IDS]);
    expect(unlockedThrowables(1)).toEqual(['frag']);
    expect(unlockedThrowables(2)).toEqual(['frag', 'smoke']);
    expect(unlockedThrowables(4)).toEqual(['frag', 'smoke', 'flash']);
    expect(unlockedThrowables(6)).toEqual([...THROWABLE_IDS]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/catalogue.test.ts`
Expected: FAIL (`WEAPON_IDS` is not exported).

- [ ] **Step 3: Implement**

In `src/core/types.ts` replace the `WeaponId` line and add:

```ts
export type WeaponId = 'pistol' | 'rifle' | 'shotgun' | 'smg' | 'sniper';
export type ThrowableId = 'frag' | 'smoke' | 'flash' | 'incendiary';
```

In `src/core/config.ts` import `ThrowableId` too, replace the `WeaponDef` interface and `WEAPONS` with:

```ts
export interface WeaponDef {
  name: string;
  damage: number;
  range: number;
  snapAp: number;
  aimedAp: number;
  snapAccuracy: number;
  aimedAccuracy: number;
  /** Rounds in a full magazine. */
  magazine: number;
  price: number;
  /** The campaign level (mission number) at which the shop offers it. */
  unlockAt: number;
  /** Rounds fired per shot action (default 1); each rolls its own hit and crit. */
  burst?: number;
  /** Range penalty: the range factor is 1 - falloff * distance / range (default 0.5). */
  falloff?: number;
  /** Accuracy multiplier when the target is within `within` tiles. */
  closePenalty?: { within: number; multiplier: number };
  /** How far the carrier sees (default CONFIG.sightRange). */
  sight?: number;
}

export const WEAPON_IDS: readonly WeaponId[] = ['pistol', 'rifle', 'shotgun', 'smg', 'sniper'];

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    name: 'Pistol', damage: 18, range: 8,
    snapAp: 12, aimedAp: 24, snapAccuracy: 0.55, aimedAccuracy: 0.75, magazine: 8, price: 10, unlockAt: 1,
  },
  rifle: {
    name: 'Rifle', damage: 30, range: 14,
    snapAp: 15, aimedAp: 30, snapAccuracy: 0.5, aimedAccuracy: 0.85, magazine: 5, price: 25, unlockAt: 1,
  },
  shotgun: {
    name: 'Shotgun', damage: 45, range: 6,
    snapAp: 15, aimedAp: 25, snapAccuracy: 0.6, aimedAccuracy: 0.75, magazine: 4, price: 22, unlockAt: 2, falloff: 0.9,
  },
  smg: {
    name: 'SMG', damage: 12, range: 9,
    snapAp: 18, aimedAp: 28, snapAccuracy: 0.45, aimedAccuracy: 0.6, magazine: 12, price: 28, unlockAt: 4, burst: 3,
  },
  sniper: {
    name: 'Sniper', damage: 55, range: 16,
    snapAp: 25, aimedAp: 35, snapAccuracy: 0.4, aimedAccuracy: 0.9, magazine: 3, price: 40, unlockAt: 6,
    falloff: 0.2, closePenalty: { within: 3, multiplier: 0.5 }, sight: 14,
  },
};

export interface ThrowableDef {
  name: string;
  apCost: number;
  range: number;
  radius: number;
  price: number;
  unlockAt: number;
  /** Damage to every unit in the blast (either side). */
  damage?: number;
  breaksDoors?: boolean;
  /** Leaves a hazard on every non-wall tile of the blast for `turns` turns. */
  hazard?: { kind: 'smoke' | 'fire'; turns: number };
  /** AP every unit in the blast loses at the start of its next turn. */
  apPenalty?: number;
}

export const THROWABLE_IDS: readonly ThrowableId[] = ['frag', 'smoke', 'flash', 'incendiary'];

export const THROWABLES: Record<ThrowableId, ThrowableDef> = {
  frag: { name: 'Frag', apCost: 24, range: 8, radius: 1, price: 8, unlockAt: 1, damage: 40, breaksDoors: true },
  smoke: { name: 'Smoke', apCost: 18, range: 8, radius: 2, price: 10, unlockAt: 2, hazard: { kind: 'smoke', turns: 3 } },
  flash: { name: 'Flashbang', apCost: 18, range: 8, radius: 2, price: 10, unlockAt: 4, apPenalty: 30 },
  incendiary: { name: 'Incendiary', apCost: 24, range: 8, radius: 1, price: 14, unlockAt: 6, damage: 15, hazard: { kind: 'fire', turns: 3 } },
};

export const HAZARD = { fireDamage: 10 } as const;

/** The tutorial offers only the level 1 kit. */
export const TUTORIAL_LEVEL = 1;

export const unlockedWeapons = (level: number): WeaponId[] => WEAPON_IDS.filter((id) => WEAPONS[id].unlockAt <= level);
export const unlockedThrowables = (level: number): ThrowableId[] => THROWABLE_IDS.filter((id) => THROWABLES[id].unlockAt <= level);
```

Leave `CONFIG.grenade` in place for now (Task 6 removes its uses).

- [ ] **Step 4: Run it, typecheck, whole suite**

Run: `npx vitest run tests/catalogue.test.ts && npx tsc --noEmit && npx vitest run`
Expected: catalogue PASS; tsc clean; suite 1287 pass. If tsc flags `Record<WeaponId, ...>` literals elsewhere (for example `PLAYER_WEAPONS`), they are arrays of ids and need no change.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: weapon and throwable tables with an unlock ladder" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Keyed stash, throwable on units and loadouts, save compatibility

**Files:**
- Modify: `src/core/types.ts`, `src/core/stash.ts`, `src/core/loot.ts`, `src/core/loadout.ts`, `src/core/mission.ts`, `src/save.ts`
- Test: extend `tests/stash.test.ts`, `tests/save.test.ts`; create `tests/throwloadout.test.ts`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `STASH_KEYS`, `StashKey`, `stashOf(partial)`, `throwableKey(id): StashKey` (`frag` maps to `'grenade'`), `Unit.throwable: ThrowableId`, `SoldierLoadout.throwable?: ThrowableId`, `weaponPrice`/`throwablePrice` helpers inside `loadout.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/throwloadout.test.ts
import { describe, expect, it } from 'vitest';
import { applyLoadout, defaultLoadout, loadoutCost, soldierCost, validateLoadout } from '../src/core/loadout';
import { createMission, MISSIONS } from '../src/core/missions';
import { STASH_KEYS, emptyStash, stashOf, throwableKey } from '../src/core/stash';

describe('throwables in the loadout', () => {
  it('defaults to frag and prices the kind from the table', () => {
    expect(defaultLoadout()[0].throwable).toBeUndefined();
    const base = { weapon: 'pistol' as const, grenades: 2, clips: 1 };
    expect(soldierCost(base)).toBe(10 + 8 * 2);
    expect(soldierCost({ ...base, throwable: 'smoke' })).toBe(10 + 10 * 2);
    expect(soldierCost({ ...base, weapon: 'smg', throwable: 'incendiary' })).toBe(28 + 14 * 2);
  });

  it('puts the throwable on the unit, frag when none is chosen', () => {
    const l = defaultLoadout();
    l[1] = { ...l[1], throwable: 'smoke' };
    const s = applyLoadout(createMission(MISSIONS[0], 1), l, 999, stashOf({ smoke: 1 }));
    const soldiers = s.units.filter((u) => u.side === 'player');
    expect(soldiers[0].throwable).toBe('frag');
    expect(soldiers[1].throwable).toBe('smoke');
  });

  it('is free when the stash holds that kind', () => {
    const l = defaultLoadout().map((x) => ({ ...x, grenades: 0 }));
    l[0] = { ...l[0], grenades: 2, throwable: 'smoke' };
    const paid = loadoutCost(l);
    const free = loadoutCost(l, stashOf({ smoke: 2 }));
    expect(paid - free).toBe(20);
  });

  it('rejects an unknown throwable', () => {
    const l = defaultLoadout();
    (l[0] as { throwable?: string }).throwable = 'laser';
    expect(validateLoadout(l, 999)).toMatch(/throwable/);
  });
});

describe('the keyed stash', () => {
  it('has a key for every weapon and throwable and starts empty', () => {
    expect(STASH_KEYS).toEqual(expect.arrayContaining(['rifle', 'pistol', 'shotgun', 'smg', 'sniper', 'grenade', 'smoke', 'flash', 'incendiary', 'clip', 'medkit', 'armour', 'scanner', 'scope']));
    for (const k of STASH_KEYS) expect(emptyStash()[k]).toBe(0);
    expect(throwableKey('frag')).toBe('grenade');
    expect(throwableKey('smoke')).toBe('smoke');
  });
});
```

Add to `tests/stash.test.ts` (use the file's existing imports and add `stashOf`, `capStash`, `addStash`, `describeStash`, `nextStash`):

```ts
describe('the stash with the new items', () => {
  it('adds and caps every key; weapons share the cap of four, heaviest first', () => {
    const sum = addStash(stashOf({ smoke: 1, sniper: 1 }), stashOf({ smoke: 2, shotgun: 3, rifle: 2, pistol: 5 }));
    expect(sum.smoke).toBe(3);
    const capped = capStash(sum);
    expect(capped.sniper + capped.rifle + capped.shotgun + capped.smg + capped.pistol).toBe(4);
    expect(capped.sniper).toBe(1);
    expect(capped.rifle).toBe(2);
    expect(capped.shotgun).toBe(1);
    expect(capped.pistol).toBe(0);
    expect(capped.smoke).toBe(3); // throwables are not capped
  });

  it('describes the new items', () => {
    expect(describeStash(stashOf({ shotgun: 1, smoke: 2, flash: 1 }))).toBe('1 shotgun, 2 smoke, 1 flashbang');
  });
});
```

Add to `tests/save.test.ts` (reuse its helpers for building save text; if it has a `validSave()` helper use it, else build with `newCampaign()`):

```ts
describe('saves with the new items', () => {
  const base = () => JSON.parse(JSON.stringify({ version: 2, campaign: newCampaign(), loadout: defaultLoadout() }));
  it('loads a version 1 save unchanged (the old stash has no new keys)', () => {
    const raw = base();
    raw.version = 1;
    delete raw.campaign.stash.shotgun; // old stashes only had the eight old keys
    const save = parseSave(JSON.stringify(raw), 3);
    expect(save).not.toBeNull();
    expect(save!.campaign.stash.shotgun).toBe(0);
  });

  it('loads new stash keys and a throwable', () => {
    const raw = base();
    raw.campaign.stash.smoke = 2;
    raw.loadout[0].throwable = 'smoke';
    const save = parseSave(JSON.stringify(raw), 3)!;
    expect(save.campaign.stash.smoke).toBe(2);
    expect(save.loadout[0].throwable).toBe('smoke');
  });

  it('falls back to the default loadout for an unknown weapon or throwable, and rejects a bad stash count', () => {
    const w = base(); w.loadout[0].weapon = 'bazooka';
    expect(parseSave(JSON.stringify(w), 3)!.loadout).toEqual(defaultLoadout());
    const t = base(); t.loadout[0].throwable = 'laser';
    expect(parseSave(JSON.stringify(t), 3)!.loadout).toEqual(defaultLoadout());
    const s = base(); s.campaign.stash.smoke = -1;
    expect(parseSave(JSON.stringify(s), 3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/throwloadout.test.ts tests/stash.test.ts tests/save.test.ts`
Expected: FAIL (missing exports `STASH_KEYS`, `stashOf`, `throwableKey`; new tests fail).

- [ ] **Step 3: Implement**

`src/core/types.ts`: add `throwable: ThrowableId;` to `Unit` after `grenades` with the comment `/** The kind of the grenades carried (one kind per soldier). */`.

`src/core/mission.ts` `makeUnit`: add `throwable: 'frag',` after `grenades`.

`src/core/stash.ts`: replace the `Stash` interface, `emptyStash`, and rewrite `coverage`, `nextStash`, `describeStash`:

```ts
import { THROWABLES, WEAPONS } from './config';
import type { Loadout } from './loadout';
import type { GameState, ThrowableId } from './types';

export const STASH_KEYS = [
  'rifle', 'pistol', 'shotgun', 'smg', 'sniper',
  'grenade', 'smoke', 'flash', 'incendiary',
  'clip', 'medkit', 'armour', 'scanner', 'scope',
] as const;
export type StashKey = (typeof STASH_KEYS)[number];

/** Free gear the squad has found: it covers the same kit items on the equipment screen at no cost. `grenade` counts frags; `clip` spare clips. */
export type Stash = Record<StashKey, number>;

export function emptyStash(): Stash {
  return Object.fromEntries(STASH_KEYS.map((k) => [k, 0])) as Stash;
}

export const stashOf = (partial: Partial<Stash>): Stash => ({ ...emptyStash(), ...partial });

/** The stash key of a throwable kind: frags are the old `grenade` counter. */
export const throwableKey = (id: ThrowableId): StashKey => (id === 'frag' ? 'grenade' : id);
```

Keep the `Cover` interface. In `coverage`, replace the grenade lines with:

```ts
    const tk = throwableKey(s.throwable ?? 'frag');
    const grenades = Math.min(s.grenades, left[tk]);
    left[tk] -= grenades;
```

In `nextStash`: replace `next.grenade -= cover[i].grenades;` with `next[throwableKey(s.throwable ?? 'frag')] -= cover[i].grenades;` and the survivor line `next.grenade += Math.max(0, u.grenades - (s.grenades - cover[i].grenades));` with `next[throwableKey(u.throwable)] += Math.max(0, u.grenades - (s.grenades - cover[i].grenades));`. (A soldier whose thrown kind differs from the loadout kind cannot happen: pickup refuses mixing.)

`describeStash` becomes:

```ts
const NAMES: Record<StashKey, [string, string]> = {
  rifle: ['rifle', 'rifles'], pistol: ['pistol', 'pistols'], shotgun: ['shotgun', 'shotguns'], smg: ['smg', 'smgs'],
  sniper: ['sniper', 'snipers'], grenade: ['grenade', 'grenades'], smoke: ['smoke', 'smoke'],
  flash: ['flashbang', 'flashbangs'], incendiary: ['incendiary', 'incendiaries'], clip: ['clip', 'clips'],
  medkit: ['medkit', 'medkits'], armour: ['armour', 'armour'], scanner: ['scanner', 'scanners'], scope: ['scope', 'scopes'],
};
export function describeStash(stash: Stash): string {
  return STASH_KEYS.filter((k) => stash[k] > 0).map((k) => `${stash[k]} ${NAMES[k][stash[k] === 1 ? 0 : 1]}`).join(', ');
}
```

Order of `STASH_KEYS` fixes the description order, which puts rifle, pistol, shotgun, ... smoke, flash before clips. Existing `describeStash` tests expect the old order `rifle, pistol, grenade, clip, medkit, armour, scanner, scope`: the new order places grenade before clip too, and the old relative order is preserved, so they keep passing. If one fails, fix the order in `STASH_KEYS`, not the test.

`src/core/loot.ts`:

```ts
import { WEAPON_IDS } from './config';
import { STASH_KEYS, emptyStash, type Stash } from './stash';
import type { GameState } from './types';

export const STASH_CAP = { weapons: 4, clips: 4, gadgets: 4 } as const;

export function addStash(a: Stash, b: Stash): Stash {
  const out = emptyStash();
  for (const k of STASH_KEYS) out[k] = a[k] + b[k];
  return out;
}
// lootFrom is unchanged (loot[u.weapon] += 1 works for every weapon id)

/** Heaviest weapons are kept first when the stash is over its cap of four weapons. */
const KEEP_ORDER = ['sniper', 'rifle', 'shotgun', 'smg', 'pistol'] as const;

export function capStash(s: Stash): Stash {
  const out = { ...s };
  let room: number = STASH_CAP.weapons;
  for (const w of KEEP_ORDER) {
    out[w] = Math.min(s[w], room);
    room -= out[w];
  }
  out.clip = Math.min(s.clip, STASH_CAP.clips);
  for (const g of ['medkit', 'armour', 'scanner', 'scope'] as const) out[g] = Math.min(s[g], STASH_CAP.gadgets);
  return out; // throwables are not capped
}
void WEAPON_IDS; // (remove this line if the import is unused)
```

Delete the `WEAPON_IDS` import and the `void` line if unused.

`src/core/loadout.ts`: add `throwable?: ThrowableId` to `SoldierLoadout`; replace `LOADOUT.prices` with derived values and add price helpers:

```ts
import { ATTACHMENTS, ATTACHMENT_IDS, CONFIG, GADGETS, GADGET_IDS, THROWABLES, THROWABLE_IDS, WEAPONS, WEAPON_IDS } from './config';
import { coverage, emptyStash, throwableKey, type Stash } from './stash';
import type { AttachmentId, GadgetId, GameState, ThrowableId, WeaponId } from './types';

export const LOADOUT = {
  budget: 120,
  prices: { pistol: WEAPONS.pistol.price, rifle: WEAPONS.rifle.price, grenade: THROWABLES.frag.price, clip: 5 },
  maxGrenades: 3,
} as const;

export const weaponPrice = (id: WeaponId): number => WEAPONS[id].price;
export const throwablePrice = (s: { throwable?: ThrowableId }): number => THROWABLES[s.throwable ?? 'frag'].price;
```

Then in `soldierCost`, `loadoutCost`, `netSoldierCost` replace `LOADOUT.prices[s.weapon]` with `weaponPrice(s.weapon)` and `LOADOUT.prices.grenade * n` / `c.grenades * LOADOUT.prices.grenade` with `throwablePrice(s) * n` / `c.grenades * throwablePrice(l[i])` (note `loadoutCost` maps with index `i`: use `l[i]`). In `validateLoadout`: replace the weapon check with `if (!WEAPON_IDS.includes(s.weapon)) return ...needs a weapon` and add `if (s.throwable !== undefined && !THROWABLE_IDS.includes(s.throwable)) return \`Soldier ${i + 1} has an unknown throwable\`;`. In `applyLoadout` add `u.throwable = l[i].throwable ?? 'frag';`. Keep `throwableKey` imported only where used (coverage lives in stash.ts, so drop the import from loadout.ts if unused).

`src/save.ts`: set `const SAVE_VERSION = 2;` and accept 1 or 2 in `parseSave` (`if (!isObj(raw) || (raw.version !== 1 && raw.version !== 2) || ...)`). Replace `stash()` and `loadout()`:

```ts
import { ATTACHMENT_IDS, GADGET_IDS, THROWABLE_IDS, WEAPON_IDS } from './core/config';
import { STASH_KEYS, emptyStash, type Stash } from './core/stash';

function stash(v: unknown): Stash | null {
  if (!isObj(v)) return null;
  const out = emptyStash();
  for (const k of STASH_KEYS) {
    const n = v[k];
    if (n === undefined && !['rifle', 'pistol', 'grenade', 'clip'].includes(k)) continue; // keys added later may be absent
    if (!isInt(n, 0, 99)) return null;
    out[k] = n;
  }
  return out;
}
```

and in `loadout()` replace the weapon check with `!WEAPON_IDS.includes(s.weapon as never)`, add `if (s.throwable !== undefined && !THROWABLE_IDS.includes(s.throwable as never)) return defaultLoadout();`, and include `...(s.throwable !== undefined ? { throwable: s.throwable as (typeof THROWABLE_IDS)[number] } : {})` in the pushed object.

- [ ] **Step 4: Fix test literals the compiler flags, then run everything**

Run: `npx tsc --noEmit 2>&1 | head -50`. Each error is a `Stash` literal missing the new keys (about 43 sites in `tests/app.test.ts`, `equipment.test.ts`, `layout.test.ts`, `loot.test.ts`, `save.test.ts`, `stash.test.ts`). Wrap each literal: `{ rifle: 1, ... }` becomes `stashOf({ rifle: 1, ... })` and add `stashOf` to the file's import from `../src/core/stash`. Do not change any expected value.

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; all green (the new tests included).

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: keyed stash, throwable kind on soldiers, saves accept the new items" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Unlock levels in loadouts and mission creation

**Files:**
- Modify: `src/core/campaign.ts`, `src/core/loadout.ts`, `src/core/missions.ts`, `src/app.ts`
- Test: `tests/levels.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 stash keys.
- Produces: `levelOf(c: Campaign): number`; `validateLoadout(l, budget?, stash?, level?)`, `fitLoadout(previous, budget, stash?, level?)`, `applyLoadout(state, l, budget?, stash?, level?)`, `createMission(def, seed?, roster?, loadout?, budget?, stash?, level?)`, all with `level` last, default `TUTORIAL_LEVEL`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/levels.test.ts
import { describe, expect, it } from 'vitest';
import { levelOf, newCampaign } from '../src/core/campaign';
import { defaultLoadout, fitLoadout, validateLoadout } from '../src/core/loadout';
import { stashOf } from '../src/core/stash';

const withWeapon = (weapon: 'shotgun' | 'smg' | 'sniper') => defaultLoadout().map((s, i) => (i === 0 ? { ...s, weapon } : s));
const withThrowable = (throwable: 'smoke' | 'flash' | 'incendiary') => defaultLoadout().map((s, i) => (i === 0 ? { ...s, throwable } : s));

describe('unlock levels', () => {
  it('the tutorial is level 1 and a campaign mission is its number', () => {
    expect(levelOf(newCampaign('tutorial'))).toBe(1);
    const c = newCampaign('campaign', Array(10).fill(0));
    expect(levelOf(c)).toBe(1);
    expect(levelOf({ ...c, missionIndex: 5 })).toBe(6);
    const t = newCampaign('tutorial');
    expect(levelOf({ ...t, missionIndex: 2 })).toBe(1);
  });

  it('rejects a locked weapon and throwable, accepts them at their level', () => {
    expect(validateLoadout(withWeapon('shotgun'), 999)).toMatch(/shotgun|locked/i);
    expect(validateLoadout(withWeapon('shotgun'), 999, undefined, 2)).toBeNull();
    expect(validateLoadout(withWeapon('smg'), 999, undefined, 3)).not.toBeNull();
    expect(validateLoadout(withWeapon('smg'), 999, undefined, 4)).toBeNull();
    expect(validateLoadout(withWeapon('sniper'), 999, undefined, 5)).not.toBeNull();
    expect(validateLoadout(withWeapon('sniper'), 999, undefined, 6)).toBeNull();
    expect(validateLoadout(withThrowable('smoke'), 999, undefined, 1)).not.toBeNull();
    expect(validateLoadout(withThrowable('smoke'), 999, undefined, 2)).toBeNull();
    expect(validateLoadout(withThrowable('incendiary'), 999, undefined, 5)).not.toBeNull();
  });

  it('allows a locked item when the stash holds one', () => {
    expect(validateLoadout(withWeapon('sniper'), 999, stashOf({ sniper: 1 }), 1)).toBeNull();
    expect(validateLoadout(withThrowable('flash'), 999, stashOf({ flash: 1 }), 1)).toBeNull();
  });

  it('fitLoadout drops a locked item the level no longer allows', () => {
    const fitted = fitLoadout(withWeapon('sniper'), 999, undefined, 1);
    expect(validateLoadout(fitted, 999, undefined, 1)).toBeNull();
    expect(fitted[0].weapon).not.toBe('sniper');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/levels.test.ts`
Expected: FAIL (`levelOf` is not exported).

- [ ] **Step 3: Implement**

`src/core/campaign.ts`:

```ts
import { TUTORIAL_LEVEL } from './config';
/** The unlock level: the tutorial is fixed at 1, a campaign mission is its mission number. */
export function levelOf(c: Campaign): number {
  return c.mode === 'campaign' ? c.missionIndex + 1 : TUTORIAL_LEVEL;
}
```

`src/core/loadout.ts`: add `level: number = TUTORIAL_LEVEL` as the last parameter of `validateLoadout`, `fitLoadout`, `applyLoadout`. In `validateLoadout`, inside the per-soldier loop after the weapon check:

```ts
    if (!unlockedWeapons(level).includes(s.weapon) && stash[s.weapon] < 1) return `Soldier ${i + 1}: the ${WEAPONS[s.weapon].name} is locked`;
    const kind = s.throwable ?? 'frag';
    if (s.grenades > 0 && !unlockedThrowables(level).includes(kind) && stash[throwableKey(kind)] < 1) {
      return `Soldier ${i + 1}: ${THROWABLES[kind].name} is locked`;
    }
```

(import `unlockedWeapons`, `unlockedThrowables`, `TUTORIAL_LEVEL` from config and `throwableKey` from stash.) Pass `level` through every `validateLoadout` call inside `fitLoadout` and `applyLoadout`. In `fitLoadout`, add a first fallback that swaps locked items before trimming: after the `trimmed` attempt and before `bare`, add:

```ts
  const unlocked = bare.map((s) => ({
    ...s,
    weapon: unlockedWeapons(level).includes(s.weapon) || stash[s.weapon] > 0 ? s.weapon : ('pistol' as const),
    throwable: undefined,
  }));
```

Simplest correct form: compute `bare` (no gadget or attachment, one clip), then `safe = bare.map((s) => ({ weapon: allowed(s.weapon) ? s.weapon : 'rifle'-or-'pistol', grenades: s.grenades, clips: 1 }))` where an unallowed weapon becomes `'pistol'` and the throwable key is dropped (frag, always allowed). Return `safe` when valid, else `cheapLoadout()`. Make the `previous` and `trimmed` attempts come first as today.

`src/core/missions.ts` `createMission`: add `level: number = TUTORIAL_LEVEL` as the last parameter and pass it to `applyLoadout(s, loadout, budget, stash, level)`.

`src/app.ts`: import `levelOf`; in the default `createMission` option add the `level` parameter: `((def, seed, roster, loadout, budget, stash, level) => createMission(def, seed, roster, loadout, budget, stash, level))` and extend the `AppOptions.createMission` type with `level: number`; at line 272 pass `levelOf(this.campaign)`; at lines 270, 291, 342, 419, 561 pass `levelOf(...)` to `validateLoadout`, `fitLoadout` (the equipment hit at 419 gets `level` in Task 9). For line 342 use `levelOf(save.campaign)`.

- [ ] **Step 4: Run all**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. `tests/app.test.ts` stubs of `createMission` accept the extra argument.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: unlock levels gate weapons and throwables in loadouts" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Weapon rules (burst, falloff, close penalty, sniper sight)

**Files:**
- Modify: `src/core/combat.ts`, `src/core/vision.ts`, `src/core/actions/shoot.ts`
- Test: `tests/weaponrules.test.ts`

**Interfaces:**
- Consumes: Task 1 `WeaponDef` fields.
- Produces: `sightOf(u: Unit): number` (in `vision.ts`), `fireBurst(s, shooter, target, mode, events)` (in `combat.ts`), `hitChance` using `falloff` and `closePenalty`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/weaponrules.test.ts
import { describe, expect, it } from 'vitest';
import { WEAPONS, CONFIG } from '../src/core/config';
import { applyCommand } from '../src/core/apply';
import { hitChance } from '../src/core/combat';
import { sightOf, canSee } from '../src/core/vision';
import { corridorRows, makeState, ok, seedForRoll, unit } from './helpers';

function duel(weapon: 'pistol' | 'rifle' | 'shotgun' | 'smg' | 'sniper', gap: number) {
  const s = makeState(corridorRows('P' + '.'.repeat(gap - 1) + 'E'.padEnd(1) + '.'));
  const p = unit(s, 'p1');
  p.weapon = weapon;
  p.ammo = WEAPONS[weapon].magazine;
  p.facing = 2;
  return { s, p, e: unit(s, 'e1') };
}

describe('hit chance with the new fields', () => {
  it('uses the weapon falloff: the shotgun loses its accuracy with distance far faster than the rifle', () => {
    const near = duel('shotgun', 2);
    const far = duel('shotgun', 6);
    const nearChance = hitChance(near.s, near.p, near.e, 'snap');
    const farChance = hitChance(far.s, far.p, far.e, 'snap');
    expect(nearChance / farChance).toBeGreaterThan(4); // 1-0.9*2/6 = 0.7 against 1-0.9*6/6 = 0.1
    const r = duel('rifle', 6);
    expect(hitChance(r.s, r.p, r.e, 'snap')).toBeCloseTo(0.5 * (1 - 0.5 * 6 / 14), 5);
  });

  it('halves the sniper accuracy within 3 tiles', () => {
    const close = duel('sniper', 3);
    const wide = duel('sniper', 4);
    const w = WEAPONS.sniper;
    expect(hitChance(close.s, close.p, close.e, 'aimed')).toBeCloseTo(w.aimedAccuracy * 0.5 * (1 - 0.2 * 3 / w.range), 5);
    expect(hitChance(wide.s, wide.p, wide.e, 'aimed')).toBeCloseTo(w.aimedAccuracy * (1 - 0.2 * 4 / w.range), 5);
  });
});

describe('burst fire', () => {
  it('fires three rounds, one shot event each, and uses three rounds of ammo', () => {
    const { s, e } = duel('smg', 3);
    e.hp = 999; e.maxHp = 999;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(3);
    expect(unit(r.state, 'p1').ammo).toBe(WEAPONS.smg.magazine - 3);
    expect(unit(r.state, 'p1').ap).toBe(CONFIG.maxAp - WEAPONS.smg.snapAp); // one action, one AP cost
  });

  it('stops when the magazine runs dry', () => {
    const { s, p, e } = duel('smg', 3);
    p.ammo = 2; e.hp = 999;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(2);
    expect(unit(r.state, 'p1').ammo).toBe(0);
  });

  it('stops when the target dies and credits the kill once', () => {
    const { s, p, e } = duel('smg', 2);
    e.hp = 1;
    s.rngState = seedForRoll((n) => n < 0.05);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(1);
    expect(r.events.filter((x) => x.type === 'died')).toHaveLength(1);
    expect(unit(r.state, 'p1').kills).toBe(1);
    expect(unit(r.state, 'p1').ammo).toBe(WEAPONS.smg.magazine - 1);
    void p;
  });

  it('a one-round weapon still fires one round', () => {
    const { s } = duel('rifle', 3);
    unit(s, 'e1').hp = 999;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.filter((x) => x.type === 'shot')).toHaveLength(1);
  });
});

describe('sniper sight', () => {
  it('sees 14 tiles, others 10', () => {
    expect(sightOf({ weapon: 'sniper' } as never)).toBe(14);
    expect(sightOf({ weapon: 'rifle' } as never)).toBe(CONFIG.sightRange);
    const s = makeState(corridorRows('P' + '.'.repeat(13) + 'E'));
    const p = unit(s, 'p1');
    p.facing = 2;
    const far = { x: unit(s, 'e1').pos.x, y: 1 };
    p.weapon = 'rifle';
    expect(canSee(s, p, far)).toBe(false);
    p.weapon = 'sniper';
    expect(canSee(s, p, far)).toBe(true);
  });

  it('a sniper can shoot a target 13 tiles away; a rifleman cannot see it', () => {
    const { s, p, e } = duel('sniper', 13);
    e.hp = 999;
    const r = ok(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }));
    expect(r.events.some((x) => x.type === 'shot')).toBe(true);
    p.weapon = 'rifle';
    expect(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }).ok).toBe(false);
  });
});
```

Note: `duel()` builds `P...E.` with the enemy `gap` tiles from the player (player x=1, enemy x=1+gap). `corridorRows` wraps in walls. `seedForRoll` picks `s.rngState` so the first `nextRandom` is below the threshold.

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/weaponrules.test.ts`
Expected: FAIL (`sightOf` not exported; burst events count 1; falloff ratios wrong).

- [ ] **Step 3: Implement**

`src/core/vision.ts`: import `WEAPONS`, add and use:

```ts
import { CONFIG, WEAPONS } from './config';

/** How far a unit sees: its weapon's own sight (the sniper rifle's is longer), else the standard range. */
export function sightOf(u: Unit): number {
  return WEAPONS[u.weapon].sight ?? CONFIG.sightRange;
}
```

and in `canSee` replace `distance(unit.pos, pos) > CONFIG.sightRange` with `distance(unit.pos, pos) > sightOf(unit)`.

`src/core/combat.ts` `hitChance` becomes:

```ts
  const d = distance(shooter.pos, target.pos);
  const rangeFactor = Math.max(0, 1 - (w.falloff ?? 0.5) * (d / w.range));
  const close = w.closePenalty && d <= w.closePenalty.within ? w.closePenalty.multiplier : 1;
  const cover = isCovered(s, shooter.pos, target.pos) ? CONFIG.coverMultiplier : 1;
  return base * rangeFactor * close * cover;
```

and add below `fireShot`:

```ts
/** One shot action: `burst` rounds (default 1), each its own roll; stops at an empty magazine or a dead target. */
export function fireBurst(s: GameState, shooter: Unit, target: Unit, mode: ShotMode, events: GameEvent[]): void {
  const rounds = WEAPONS[shooter.weapon].burst ?? 1;
  for (let i = 0; i < rounds; i++) {
    if (shooter.ammo < 1 || !target.alive) break;
    fireShot(s, shooter, target, mode, events);
  }
}
```

Use `fireBurst` in `applyReactionFire` (replace `fireShot(s, o, mover, 'snap', events)`) and in `src/core/actions/shoot.ts` (replace the `fireShot(...)` call and its import).

- [ ] **Step 4: Run all**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. The existing hit-chance tests keep their numbers because pistol and rifle use falloff 0.5 and no close penalty.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: burst fire, weapon falloff, sniper close penalty and long sight" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Enemy weapons by level, new floor-item images, item swap

**Files:**
- Create: `src/core/enemyArms.ts`
- Modify: `src/core/missions.ts`, `scripts/hand-images.mjs`, `src/art/theme.ts`, `src/art/images.generated.ts` (generated)
- Test: `tests/enemyarms.test.ts`; extend `tests/imagesdata.test.ts` loose-item list

**Interfaces:**
- Consumes: `unlockedWeapons`, `createMission(..., level)`.
- Produces: `assignEnemyWeapons(state, level)`; `createMission` calls it when `level > TUTORIAL_LEVEL`; images `item_shotgun`, `item_smg`, `item_sniper`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/enemyarms.test.ts
import { describe, expect, it } from 'vitest';
import { assignEnemyWeapons } from '../src/core/enemyArms';
import { WEAPONS, unlockedWeapons } from '../src/core/config';
import { createMission, MISSIONS } from '../src/core/missions';
import { itemImage } from '../src/art/theme';

const enemies = (level: number, seed: number) =>
  createMission(MISSIONS[2], seed, undefined, undefined, undefined, undefined, level).units.filter((u) => u.side === 'enemy');

describe('enemy weapons by level', () => {
  it('leaves the tutorial and level 1 as they are: alternating rifle and pistol', () => {
    expect(enemies(1, 7).map((u) => u.weapon)).toEqual(
      createMission(MISSIONS[2], 7).units.filter((u) => u.side === 'enemy').map((u) => u.weapon),
    );
  });

  it('never gives a weapon above the level, and uses every unlocked weapon over many seeds', () => {
    for (const level of [2, 3, 4, 5, 6, 9]) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) for (const u of enemies(level, seed)) {
        expect(unlockedWeapons(level)).toContain(u.weapon);
        expect(u.ammo).toBe(WEAPONS[u.weapon].magazine);
        seen.add(u.weapon);
      }
      expect([...seen].sort()).toEqual([...unlockedWeapons(level)].sort());
    }
  });

  it('is deterministic for a seed and varies between seeds', () => {
    expect(enemies(6, 5).map((u) => u.weapon)).toEqual(enemies(6, 5).map((u) => u.weapon));
    const sets = new Set(Array.from({ length: 20 }, (_, i) => enemies(6, i + 1).map((u) => u.weapon).join()));
    expect(sets.size).toBeGreaterThan(3);
  });

  it('does not touch the random stream', () => {
    const a = createMission(MISSIONS[2], 11);
    const b = createMission(MISSIONS[2], 11, undefined, undefined, undefined, undefined, 6);
    expect(b.rngState).toBe(a.rngState);
    expect(b.critState).toBe(a.critState);
  });
});

describe('floor items for the new weapons', () => {
  it('have an image each', () => {
    expect(itemImage('shotgun').name).toBe('item_shotgun');
    expect(itemImage('smg').name).toBe('item_smg');
    expect(itemImage('sniper').name).toBe('item_sniper');
  });
});
```

In `tests/imagesdata.test.ts` change line 7 `LOOSE` to include the three new names and line 62's list to include them too (so each new item is checked for being at least 70% visible under each corpse and transparent at the edge):

```ts
const LOOSE = ['item_rifle', 'item_pistol', 'item_grenade', 'item_shotgun', 'item_smg', 'item_sniper', 'corpse_player', 'corpse_enemy'] as const;
// ... and in the corpse visibility loop:
for (const item of ['item_rifle', 'item_pistol', 'item_grenade', 'item_shotgun', 'item_smg', 'item_sniper'] as const) {
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/enemyarms.test.ts tests/imagesdata.test.ts`
Expected: FAIL (module missing; image names unknown).

- [ ] **Step 3: Implement**

`src/core/enemyArms.ts`:

```ts
import { WEAPONS, unlockedWeapons } from './config';
import type { GameState } from './types';

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * Arms each enemy with a weapon from the ones unlocked at this level, older weapons more often, decided only
 * by the mission seed and the enemy's position in the list (the game's random stream is not used).
 */
export function assignEnemyWeapons(s: GameState, level: number): void {
  const pool = unlockedWeapons(level);
  const weights = pool.map((_, i) => pool.length - i);
  const total = weights.reduce((a, b) => a + b, 0);
  s.units.filter((u) => u.side === 'enemy').forEach((u, i) => {
    let pick = hash(s.rngState * 31 + i + 1) % total;
    let n = 0;
    while (pick >= weights[n]) pick -= weights[n++];
    u.weapon = pool[n];
    u.ammo = WEAPONS[u.weapon].magazine;
  });
}
```

`src/core/missions.ts` `createMission`: after `parseMap` and patrols, before `applyLoadout`: `if (level > TUTORIAL_LEVEL) assignEnemyWeapons(s, level);` (import both).

Art: in `scripts/hand-images.mjs` add after `ITEM_GRENADE_BASE`:

```js
const ITEM_SHOTGUN_BASE = [
  ...Array(5).fill(blank()),
  '.kkkkkkkkkkkkkk.',
  '.kaaaaaaaaaaaak.',
  '.kAAAAAAAAAAAAk.',
  '.kkkOOOkkkkkkkk.',
  '....kOOk........',
  '....kkkk........',
  ...Array(5).fill(blank()),
];
const ITEM_SMG_BASE = [
  ...Array(5).fill(blank()),
  '..kkkkkkkkkk....',
  '..kaaaaaaaaakk..',
  '..kAAAAAAAAAak..',
  '..kkkOOkkkkkk...',
  '.....kOOk.......',
  '.....kaak.......',
  '.....kAAk.......',
  '.....kkkk.......',
  ...Array(3).fill(blank()),
];
const ITEM_SNIPER_BASE = [
  ...Array(4).fill(blank()),
  '....kkkk........',
  '....kAAk........',
  '.kkkkkkkkkkkkkk.',
  '.kOOOOaaaaaaaaa.',
  '.kkkAAAkkkkkkkk.',
  '....kAAk........',
  '....kkkk........',
  ...Array(5).fill(blank()),
];
const ITEM_SHOTGUN = shiftRows(ITEM_SHOTGUN_BASE, -4);
const ITEM_SMG = shiftRows(ITEM_SMG_BASE, -4);
const ITEM_SNIPER = shiftRows(ITEM_SNIPER_BASE, -4);
```

(each base is 16 rows: count the `Array(n)` blanks plus listed rows to 16; adjust the trailing blank count if `shiftRows` or the converter throws about the row count) and add to `HAND_IMAGES` after `item_grenade`:

```js
  item_shotgun: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_SHOTGUN },
  item_smg: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_SMG },
  item_sniper: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_SNIPER },
```

Run `node scripts/build-figures.mjs` and `git checkout src/art/figures.generated.ts` if it only changed line endings. `src/art/theme.ts`: extend `ITEM_IMAGES` with `shotgun: 'item_shotgun', smg: 'item_smg', sniper: 'item_sniper'`. The `ImageName` type comes from `images.generated.ts` and updates with the regeneration. The converter's drift test (`tests/imagesdata.test.ts`) regenerates and compares, so commit the regenerated file.

- [ ] **Step 4: Run all**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. If an item fails the 70% corpse visibility test, move its drawn rows up (fewer blank rows before, more after) until it passes; do not lower the threshold.

- [ ] **Step 5: Commit**

```bash
git add src tests scripts && git commit -m "feat: enemies carry weapons by level; floor images for the new weapons" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Throwables and hazards (core rules)

**Files:**
- Modify: `src/core/types.ts`, `src/core/mission.ts`, `src/core/vision.ts`, `src/core/actions/throw.ts`, `src/core/actions/item.ts`, `src/core/actions/endTurn.ts`, `src/core/apply.ts` (none needed), `src/core/config.ts` (remove `CONFIG.grenade`), `src/render/panel.ts` and `src/controller.ts` (the two `CONFIG.grenade` uses)
- Test: `tests/hazards.test.ts`, `tests/throwables.test.ts`

**Interfaces:**
- Consumes: Task 1 `THROWABLES`/`HAZARD`, Task 2 `Unit.throwable`.
- Produces: `Hazard`, `GameState.hazards`, `Unit.apPenalty`, grenade event fields `kind: ThrowableId`, `hazards: Pos[]`, `stunned: string[]`, event `{ type: 'burned'; unitId; damage; at }`, `hasLineOfSight(s, from, to, ignoreSmoke?)`, `smokeAt(s, p)`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/throwables.test.ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { CONFIG, THROWABLES } from '../src/core/config';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

function room(kind: 'frag' | 'smoke' | 'flash' | 'incendiary', gap = 5) {
  const rows = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
  const s = makeState(rows);
  s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[0]), id: 'p1', pos: { x: 1, y: 2 } });
  s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[1]), id: 'e1', pos: { x: 1 + gap, y: 2 } });
  const p = unit(s, 'p1');
  p.facing = 2; p.throwable = kind; p.grenades = 2;
  return { s, p, e: unit(s, 'e1') };
}
const throwAt = (s: GameState, x: number, y: number) => applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x, y } });

describe('throwing the new kinds', () => {
  it('uses the kind AP cost and range', () => {
    const { s, p } = room('smoke');
    const r = ok(throwAt(s, 6, 2));
    expect(unit(r.state, 'p1').ap).toBe(CONFIG.maxAp - THROWABLES.smoke.apCost);
    expect(unit(r.state, 'p1').grenades).toBe(1);
    p.throwable = 'frag';
    const far = makeState(corridorRows('P' + '.'.repeat(12)));
    unit(far, 'p1').grenades = 1;
    expect(reason(applyCommand(far, { type: 'Throw', unitId: 'p1', at: { x: 11, y: 1 } }))).toMatch(/range/i);
  });

  it('frag still hurts everyone in radius 1 and breaks doors; smoke and flash do no damage', () => {
    const f = room('frag', 3);
    const hit = ok(throwAt(f.s, 4, 2));
    expect(unit(hit.state, 'e1').hp).toBe(f.e.hp - 40);
    const sm = room('smoke', 3);
    expect(unit(ok(throwAt(sm.s, 4, 2)).state, 'e1').hp).toBe(sm.e.hp);
    const fl = room('flash', 3);
    expect(unit(ok(throwAt(fl.s, 4, 2)).state, 'e1').hp).toBe(fl.e.hp);
  });

  it('flash sets an AP penalty on every unit in radius 2, on either side', () => {
    const { s } = room('flash', 3);
    const r = ok(throwAt(s, 3, 2)); // lands between them: both within 2
    expect(unit(r.state, 'e1').apPenalty).toBe(30);
    expect(unit(r.state, 'p1').apPenalty).toBe(30);
    const ev = r.events.find((x) => x.type === 'grenade')!;
    expect(ev).toMatchObject({ kind: 'flash', stunned: expect.arrayContaining(['e1', 'p1']) });
  });

  it('incendiary does 15 on landing and leaves fire on the blast tiles', () => {
    const { s } = room('incendiary', 3);
    const r = ok(throwAt(s, 4, 2));
    expect(unit(r.state, 'e1').hp).toBe(40 - 15);
    expect(r.state.hazards.filter((h) => h.kind === 'fire')).toHaveLength(9);
    expect(r.state.hazards.every((h) => h.turnsLeft === 3)).toBe(true);
  });

  it('smoke leaves 25 tiles of smoke (radius 2) minus walls, and a second throw refreshes rather than doubles', () => {
    const { s } = room('smoke');
    const r = ok(throwAt(s, 4, 2));
    const tiles = r.state.hazards.filter((h) => h.kind === 'smoke');
    expect(tiles.length).toBe(15); // x 2..6, y 1..3 inside the 3-row room
    const again = structuredClone(r.state);
    again.hazards.forEach((h) => (h.turnsLeft = 1));
    const r2 = ok(throwAt(again, 4, 2));
    expect(r2.state.hazards.filter((h) => h.kind === 'smoke')).toHaveLength(15);
    expect(r2.state.hazards.every((h) => h.turnsLeft === 3)).toBe(true);
  });

  it('only frag destroys doors', () => {
    const rows = ['#####', '#.+.#', '#####'];
    for (const [kind, gone] of [['frag', true], ['smoke', false], ['incendiary', false]] as const) {
      const s = makeState(['#######', '#P....#', '#######']);
      s.tiles[1][3] = { kind: 'door', open: false };
      const p = unit(s, 'p1'); p.throwable = kind; p.grenades = 1; p.facing = 2;
      const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }));
      expect(r.state.tiles[1][3].kind === 'floor').toBe(gone);
    }
    void rows;
  });

  it('a thrown smoke is not stopped by smoke already in the way', () => {
    const { s } = room('smoke');
    s.hazards.push({ pos: { x: 3, y: 2 }, kind: 'smoke', turnsLeft: 3 });
    ok(throwAt(s, 6, 2));
  });

  it('picking up a floor frag while carrying smoke is refused, but works with none left', () => {
    const s = makeState(['#####', '#P..#', '#####']);
    s.items.push({ id: 'g1', pos: { x: 1, y: 1 }, kind: 'grenade' });
    const p = unit(s, 'p1'); p.throwable = 'smoke'; p.grenades = 1;
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'g1' }))).toMatch(/another throwable/i);
    p.grenades = 0;
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'g1' }));
    expect(unit(r.state, 'p1').throwable).toBe('frag');
    expect(unit(r.state, 'p1').grenades).toBe(1);
  });
});
```

```ts
// tests/hazards.test.ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { canSee, hasLineOfSight, computeVisible } from '../src/core/vision';
import { corridorRows, makeState, ok, unit } from './helpers';

const smoke = (x: number, y = 1) => ({ pos: { x, y }, kind: 'smoke' as const, turnsLeft: 3 });
const fire = (x: number, y = 1, turnsLeft = 3) => ({ pos: { x, y }, kind: 'fire' as const, turnsLeft });
const endTurns = (s: ReturnType<typeof makeState>, n: number) => {
  let cur = s; const events = [];
  for (let i = 0; i < n; i++) { const r = ok(applyCommand(cur, { type: 'EndTurn' })); cur = r.state; events.push(...r.events); }
  return { s: cur, events };
};

describe('smoke and vision', () => {
  it('blocks line of sight through a smoke tile but not the tile the viewer or target stands on', () => {
    const s = makeState(corridorRows('P...E'));
    const p = unit(s, 'p1'); p.facing = 2;
    const e = unit(s, 'e1');
    expect(canSee(s, p, e.pos)).toBe(true);
    s.hazards.push(smoke(3));
    expect(canSee(s, p, e.pos)).toBe(false);
    expect(hasLineOfSight(s, p.pos, e.pos)).toBe(false);
    expect(hasLineOfSight(s, p.pos, e.pos, true)).toBe(true); // throws ignore smoke
  });

  it('hides a unit standing inside smoke from beyond one tile, but not from next to it', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1'); p.facing = 2;
    const e = unit(s, 'e1');
    s.hazards.push(smoke(e.pos.x));
    expect(canSee(s, p, e.pos)).toBe(false);
    p.pos = { x: e.pos.x - 1, y: 1 };
    expect(canSee(s, p, e.pos)).toBe(true);
  });

  it('a viewer inside smoke sees only adjacent tiles', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1'); p.facing = 2;
    s.hazards.push(smoke(p.pos.x));
    expect(canSee(s, p, unit(s, 'e1').pos)).toBe(false);
    expect(computeVisible(s, 'player')[1][p.pos.x + 1]).toBe(true);
  });

  it('does not stop movement', () => {
    const s = makeState(corridorRows('P.E'));
    s.hazards.push(smoke(2));
    ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
  });
});

describe('hazard lifetime and fire damage', () => {
  it('ticks down each time the player turn begins and is removed at 0', () => {
    const s = makeState(corridorRows('P...E'));
    s.hazards.push(smoke(3));
    let cur = endTurns(s, 2).s; // one full round
    expect(cur.hazards[0].turnsLeft).toBe(2);
    cur = endTurns(cur, 4).s;
    expect(cur.hazards).toHaveLength(0);
  });

  it('burns units standing in fire at the start of their own side turn, either side, armour applying', () => {
    const s = makeState(corridorRows('P...E'));
    const e = unit(s, 'e1');
    s.hazards.push(fire(e.pos.x));
    const afterPlayerEnds = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(unit(afterPlayerEnds.state, 'e1').hp).toBe(40 - 10);
    expect(afterPlayerEnds.events).toContainEqual({ type: 'burned', unitId: 'e1', damage: 10, at: e.pos });
    const p = unit(s, 'p1');
    const s2 = makeState(corridorRows('P...E'));
    s2.hazards.push(fire(p.pos.x));
    unit(s2, 'p1').gadget = 'armour';
    const round = endTurns(s2, 2);
    expect(unit(round.s, 'p1').hp).toBe(50 - 7); // 10 minus 30%
  });

  it('can kill, end the mission, and credit no kill', () => {
    const s = makeState(corridorRows('P...E'));
    const e = unit(s, 'e1'); e.hp = 5;
    s.hazards.push(fire(e.pos.x));
    const r = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(r.state.status).toBe('won');
    expect(r.events.some((x) => x.type === 'died' && x.unitId === 'e1')).toBe(true);
    expect(unit(r.state, 'p1').kills).toBe(0);
  });
});

describe('flash penalty', () => {
  it('cuts AP at the start of the unit own turn, never below 0, once', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'e1').apPenalty = 30;
    let cur = ok(applyCommand(s, { type: 'EndTurn' })).state;
    expect(unit(cur, 'e1').ap).toBe(30);
    expect(unit(cur, 'e1').apPenalty).toBe(0);
    cur = endTurns(cur, 2).s;
    expect(unit(cur, 'e1').ap).toBe(60);
    const big = makeState(corridorRows('P...E'));
    unit(big, 'e1').apPenalty = 200;
    expect(unit(ok(applyCommand(big, { type: 'EndTurn' })).state, 'e1').ap).toBe(0);
  });

  it('a flashed player soldier loses AP on the next player turn', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').apPenalty = 30;
    const cur = endTurns(s, 2).s;
    expect(unit(cur, 'p1').ap).toBe(30);
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/throwables.test.ts tests/hazards.test.ts`
Expected: FAIL (no `hazards`, `apPenalty`, new event fields).

- [ ] **Step 3: Implement**

`src/core/types.ts`:

```ts
export interface Hazard {
  pos: Pos;
  kind: 'smoke' | 'fire';
  /** Player turns left; removed at 0. */
  turnsLeft: number;
}
```

Add `hazards: Hazard[];` to `GameState` (after `scanned`), `apPenalty: number;` to `Unit` (comment: `/** AP this unit loses at the start of its next turn (a flashbang); cleared when applied. */`). Extend the grenade event to `{ type: 'grenade'; unitId: string; kind: ThrowableId; at: Pos; hits: {...}[]; doorsDestroyed: Pos[]; hazards: Pos[]; stunned: string[] }` and add `| { type: 'burned'; unitId: string; damage: number; at: Pos }`.

`src/core/mission.ts`: `makeUnit` gets `apPenalty: 0,`; `parseMap` return gets `hazards: [],`. Run `npx tsc --noEmit` and add `hazards: []` / `apPenalty: 0` to any other state or unit literal it flags (test fixtures included).

`src/core/vision.ts`:

```ts
export function smokeAt(s: GameState, p: Pos): boolean {
  return s.hazards.some((h) => h.kind === 'smoke' && h.pos.x === p.x && h.pos.y === p.y);
}

export function hasLineOfSight(s: GameState, from: Pos, to: Pos, ignoreSmoke = false): boolean {
  const tiles = lineTiles(from, to);
  for (let i = 1; i < tiles.length - 1; i++) {
    if (isBlocking(tileAt(s, tiles[i]))) return false;
    if (!ignoreSmoke && smokeAt(s, tiles[i])) return false;
  }
  return true;
}
```

and in `canSee`, after the `chebyshev(...) <= 1` return and before the range check: `if (smokeAt(s, unit.pos) || smokeAt(s, pos)) return false; // inside smoke you see (and are seen) only from next to it`.

`src/core/actions/throw.ts` full replacement body:

```ts
import { THROWABLES, NOT_ENOUGH_AP } from '../config';
import { damageTaken } from '../combat';
import { chebyshev, distance, inBounds, tileAt } from '../geometry';
import type { Command, GameEvent, GameState, Pos, Unit } from '../types';
import { hasLineOfSight } from '../vision';

export function handleThrow(s: GameState, cmd: Extract<Command, { type: 'Throw' }>, unit: Unit, events: GameEvent[]): string | null {
  const t = THROWABLES[unit.throwable];
  if (unit.grenades < 1) return 'No grenades left';
  if (unit.ap < t.apCost) return NOT_ENOUGH_AP;
  if (!inBounds(s, cmd.at)) return 'Target is off the map';
  if (distance(unit.pos, cmd.at) > t.range) return 'Out of range';
  if (tileAt(s, cmd.at).kind === 'wall') return 'Cannot throw at a wall';
  if (!hasLineOfSight(s, unit.pos, cmd.at, true)) return 'Path is blocked';

  unit.ap -= t.apCost;
  unit.grenades -= 1;

  const area: Pos[] = [];
  for (let dy = -t.radius; dy <= t.radius; dy++) {
    for (let dx = -t.radius; dx <= t.radius; dx++) {
      const p = { x: cmd.at.x + dx, y: cmd.at.y + dy };
      if (inBounds(s, p) && tileAt(s, p).kind !== 'wall') area.push(p);
    }
  }

  const hits: { unitId: string; damage: number }[] = [];
  const stunned: string[] = [];
  const died: Unit[] = [];
  for (const u of s.units) {
    if (!u.alive || chebyshev(u.pos, cmd.at) > t.radius) continue;
    if (!hasLineOfSight(s, cmd.at, u.pos, true)) continue;
    if (t.damage !== undefined) {
      const dealt = damageTaken(u, t.damage);
      u.hp = Math.max(0, u.hp - dealt);
      hits.push({ unitId: u.id, damage: dealt });
      if (u.hp <= 0) {
        u.alive = false;
        died.push(u);
        if (u.side !== unit.side) unit.kills += 1;
      }
    }
    if (t.apPenalty !== undefined) {
      u.apPenalty += t.apPenalty;
      stunned.push(u.id);
    }
  }

  const doorsDestroyed: Pos[] = [];
  if (t.breaksDoors) {
    for (const p of area) {
      const tile = tileAt(s, p);
      if (tile.kind === 'door') {
        tile.kind = 'floor';
        tile.open = false;
        doorsDestroyed.push(p);
      }
    }
  }

  const hazards: Pos[] = [];
  if (t.hazard) {
    for (const p of area) {
      const old = s.hazards.find((h) => h.kind === t.hazard!.kind && h.pos.x === p.x && h.pos.y === p.y);
      if (old) old.turnsLeft = t.hazard.turns;
      else s.hazards.push({ pos: { ...p }, kind: t.hazard.kind, turnsLeft: t.hazard.turns });
      hazards.push({ ...p });
    }
  }

  events.push({ type: 'grenade', unitId: unit.id, kind: unit.throwable, at: { ...cmd.at }, hits, doorsDestroyed, hazards, stunned });
  for (const u of died) events.push({ type: 'died', unitId: u.id, at: { ...u.pos } });
  return null;
}
```

Note the old code destroyed doors in the square including walls' neighbours; `area` excludes walls, which is the same effect because only door tiles change. The frag test (`room('frag', 3)`) and the existing throw tests keep their numbers.

`src/core/actions/item.ts` grenade branch:

```ts
  if (item.kind === 'grenade') {
    if (unit.grenades > 0 && unit.throwable !== 'frag') return 'Carrying another throwable';
    unit.throwable = 'frag';
    unit.grenades += 1;
    s.items = s.items.filter((i) => i !== item);
  }
```

Place the refusal before `unit.ap -= CONFIG.pickupCost` (move the check up so a refused pickup costs nothing): restructure so the check runs right after the AP check.

`src/core/actions/endTurn.ts` full replacement:

```ts
import { HAZARD } from '../config';
import { damageTaken } from '../combat';
import type { GameEvent, GameState, Side } from '../types';

export function handleEndTurn(s: GameState, events: GameEvent[]): string | null {
  const next: Side = s.turn === 'player' ? 'enemy' : 'player';
  events.push({ type: 'turnEnded', side: s.turn });
  s.turn = next;
  if (next === 'player') s.turnNumber += 1;
  s.reacted = [];
  s.scanned = [];
  for (const u of s.units) {
    if (u.alive && u.side === next) {
      u.ap = Math.max(0, u.maxAp - u.apPenalty);
      u.apPenalty = 0;
      u.alert = false;
    }
  }
  // fire burns whoever stands in it at the start of their own side's turn, then the player turn ticks every hazard down
  for (const u of s.units) {
    if (!u.alive || u.side !== next) continue;
    if (!s.hazards.some((h) => h.kind === 'fire' && h.pos.x === u.pos.x && h.pos.y === u.pos.y)) continue;
    const damage = damageTaken(u, HAZARD.fireDamage);
    u.hp = Math.max(0, u.hp - damage);
    events.push({ type: 'burned', unitId: u.id, damage, at: { ...u.pos } });
    if (u.hp <= 0) {
      u.alive = false;
      events.push({ type: 'died', unitId: u.id, at: { ...u.pos } });
    }
  }
  if (next === 'player') {
    for (const h of s.hazards) h.turnsLeft -= 1;
    s.hazards = s.hazards.filter((h) => h.turnsLeft > 0);
  }
  return null;
}
```

Remove `CONFIG.grenade` from `config.ts` and replace its two UI uses: `src/render/panel.ts` line 29 `case 'throw': return THROWABLES[u.throwable].apCost;` and `src/controller.ts` hint `throw: \`${THROWABLES[sel.throwable].name}, ${THROWABLES[sel.throwable].apCost} AP: click a tile\``, importing `THROWABLES`. Fix any other `CONFIG.grenade` references flagged by tsc (tests may use `CONFIG.grenade.damage`: change to `THROWABLES.frag.damage`).

- [ ] **Step 4: Run all**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. Fix test fixtures that construct `GameState` or `Unit` by hand (add the two new fields) as tsc reports them.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: smoke, flashbang and incendiary with hazards, fire damage and the flash penalty" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Enemy AI around hazards

**Files:**
- Modify: `src/core/path.ts` (read it first), possibly `src/core/ai.ts`
- Test: `tests/aihazards.test.ts`

**Interfaces:**
- Consumes: `GameState.hazards`, `findPath(s, unitId, goal, opts)`.
- Produces: fire tiles cost an extra 40 to step on in `findPath`, for any unit (a cost, not a ban).

- [ ] **Step 1: Write the failing test**

```ts
// tests/aihazards.test.ts
import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { findPath } from '../src/core/path';
import { WEAPONS } from '../src/core/config';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, unit } from './helpers';

const rows3 = ['#########', '#E......#', '#.......#', '#......P#', '#########'];

describe('enemy movement and fire', () => {
  it('walks around a fire tile when a detour exists', () => {
    const s = makeState(rows3);
    s.hazards.push({ pos: { x: 3, y: 1 }, kind: 'fire', turnsLeft: 3 });
    const path = findPath(s, 'e1', { x: 6, y: 1 }, { ignoreOccupantAtGoal: true })!;
    expect(path.some((p) => p.x === 3 && p.y === 1)).toBe(false);
  });

  it('still crosses fire when it is the only way', () => {
    const s = makeState(corridorRows('E..P'));
    s.hazards.push({ pos: { x: 2, y: 1 }, kind: 'fire', turnsLeft: 3 });
    const path = findPath(s, 'e1', { x: 3, y: 1 }, { ignoreOccupantAtGoal: true });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.x === 2)).toBe(true);
  });
});

describe('enemies and the new weapons', () => {
  it('an SMG enemy fires a full burst in one action', () => {
    const s = makeState(corridorRows('E..P'));
    const e = unit(s, 'e1'); e.weapon = 'smg'; e.ammo = WEAPONS.smg.magazine; e.facing = 2;
    unit(s, 'p1').hp = 999;
    s.turn = 'enemy';
    const cmd = aiNextCommand(s);
    expect(['SnapShot', 'AimedShot']).toContain(cmd.type);
    const r = ok(applyCommand(s, cmd));
    expect(r.events.filter((x) => x.type === 'shot').length).toBe(3);
  });

  it('a soldier hidden by smoke is not shot at; the enemy ends its turn or moves instead', () => {
    const s = makeState(corridorRows('E...P'));
    const e = unit(s, 'e1'); e.facing = 2;
    s.hazards.push({ pos: { x: 3, y: 1 }, kind: 'smoke', turnsLeft: 3 });
    s.turn = 'enemy';
    const { events } = runEnemyTurn(s);
    expect(events.some((x) => x.type === 'shot')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/aihazards.test.ts`
Expected: the fire detour test FAILS (path goes straight through); the other tests may already pass because smoke blocks `canSee` and bursts use `fireBurst`.

- [ ] **Step 3: Implement**

Read `src/core/path.ts`. Where the step cost of entering a tile is computed (the A* or Dijkstra cost for moving into a neighbour), add `+ (s.hazards.some((h) => h.kind === 'fire' && h.pos.x === nx && h.pos.y === ny) ? FIRE_STEP_COST : 0)` with `const FIRE_STEP_COST = 40;` at the top of the file, using the neighbour coordinates the code already has. Keep the returned path shape and the `pathStats.calls` counter as they are. If the search is breadth-first without costs, switch only the cost comparison, not the structure: if a uniform-cost search cannot take weights, add the penalty by running the existing search first without fire tiles passable, and if that finds no path run it again with fire allowed (this satisfies both tests with no change to the cost model).

- [ ] **Step 4: Run all, including the enemy-turn call-count test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green; the existing performance test (`pathStats.calls` under 600 on a generated mission) still passes, which proves hazards add no per-action cost when there are none.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: enemies route around fire; bursts and smoke work for the AI" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Art: in-hand weapons, effect sprites, hazard overlays

**Files:**
- Modify: `src/art/figure.ts`, `src/art/sprites.ts`, `src/render/renderer.ts`, `src/render/effects.ts`, `src/art/gallery.ts`
- Test: `tests/newweaponsart.test.ts`; update `tests/effectsart.test.ts` name list

**Interfaces:**
- Consumes: Task 6 hazards and grenade event fields.
- Produces: `armedFigure` lengths for the three guns, sprites `smoke`, `fire_0`, `fire_1`, `bang`, hazard overlays in `drawGame`, throwable effects in `Effects`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/newweaponsart.test.ts
import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { armedFigure } from '../src/art/figure';
import { parseSprite } from '../src/art/sprite';
import { SPRITE_NAMES, SPRITE_ROWS } from '../src/art/sprites';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';
import { createMission, MISSIONS } from '../src/core/missions';

const metal = (f: ReturnType<typeof armedFigure>) => f.pixels.filter((p) => p === '#d0d0d0' || p === '#ffffff').length;

describe('in-hand weapons', () => {
  it('draws every weapon in every view, in range, each different from the bare body and from each other', () => {
    for (const view of ['n', 'ne', 'e', 'se', 's'] as const) {
      const sizes = (['pistol', 'smg', 'shotgun', 'rifle', 'sniper'] as const).map((w) => metal(armedFigure('squad', view, w)));
      expect(new Set(sizes).size).toBeGreaterThanOrEqual(4);
      expect(metal(armedFigure('squad', view, 'sniper'))).toBeGreaterThan(metal(armedFigure('squad', view, 'rifle')));
      expect(metal(armedFigure('squad', view, 'smg'))).toBeLessThan(metal(armedFigure('squad', view, 'rifle')));
    }
  });
});

describe('the hazard sprites', () => {
  it('exist and have palette letters only', () => {
    for (const n of ['smoke', 'fire_0', 'fire_1', 'bang'] as const) {
      expect(SPRITE_NAMES).toContain(n);
      expect(parseSprite(n, SPRITE_ROWS[n]).pixels.some((p) => p !== null)).toBe(true);
    }
  });
});

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

describe('hazards on the map', () => {
  function drawnSprites(state: ReturnType<typeof createMission>, now = 0) {
    const names: string[] = [];
    const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
    const real = atlas.draw.bind(atlas);
    atlas.draw = (c, name, x, y, o = {}) => { names.push(`${name}@${x},${y}`); return real(c, name, x, y, o); };
    drawGame(ctx, state, createUiState('p1'), new Effects(), now, atlas);
    return names;
  }

  it('draws smoke and fire on tiles the player sees, and not on tiles in the dark', () => {
    const state = createMission(MISSIONS[0], 1);
    const soldier = state.units.find((u) => u.side === 'player')!;
    const near = { x: soldier.pos.x + 1, y: soldier.pos.y };
    state.hazards.push({ pos: near, kind: 'smoke', turnsLeft: 3 }, { pos: { x: soldier.pos.x, y: soldier.pos.y - 1 }, kind: 'fire', turnsLeft: 2 });
    state.hazards.push({ pos: { x: 28, y: 1 }, kind: 'smoke', turnsLeft: 3 }); // far away, dark
    const names = drawnSprites(state);
    expect(names.some((n) => n.startsWith(`smoke@${near.x * 16},${near.y * 16}`))).toBe(true);
    expect(names.some((n) => n.startsWith('fire_'))).toBe(true);
    expect(names.some((n) => n.startsWith('smoke@448,16'))).toBe(false);
  });

  it('flickers the fire between two frames over time', () => {
    const state = createMission(MISSIONS[0], 1);
    const s = state.units.find((u) => u.side === 'player')!;
    state.hazards.push({ pos: { x: s.pos.x, y: s.pos.y - 1 }, kind: 'fire', turnsLeft: 2 });
    const frames = new Set([0, 200, 400, 600].map((t) => drawnSprites(state, t).find((n) => n.startsWith('fire_'))!.split('@')[0]));
    expect(frames.size).toBe(2);
  });
});
```

In `tests/effectsart.test.ts` change the first test's expected name list to the ten names followed by `'smoke', 'fire_0', 'fire_1', 'bang'` and its title to "are exactly the fourteen sprites".

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/newweaponsart.test.ts tests/effectsart.test.ts`
Expected: FAIL (new sprites and overlay missing; weapon lengths equal for the new guns).

- [ ] **Step 3: Implement**

`src/art/figure.ts`: replace the `length` line in `armedFigure` with a per-weapon table:

```ts
const WEAPON_LENGTH: Record<WeaponId, (rifle: number) => number> = {
  pistol: (r) => Math.max(2, Math.round(r / 2)),
  smg: (r) => Math.max(3, Math.round(r * 0.7)),
  shotgun: (r) => r,
  rifle: (r) => r,
  sniper: (r) => r + 3,
};
// in armedFigure:
const length = WEAPON_LENGTH[weapon](at.rifle);
```

The shotgun equals the rifle in length, so make it distinguishable by a thick barrel in every view: add `const thick = weapon === 'shotgun' || weapon === 'sniper' ? at.thick ?? [0, 1] : at.thick;` and use `thick` where `at.thick` is used. If `put` throws for the sniper (length + 3 runs off the figure in a view), shorten that view's sniper length until it fits; the test above catches a mismatch, and `put` throws on out-of-figure pixels. Keep the test assertion `>= 4` distinct sizes: if the shotgun and rifle counts collide because of equal length and thickness, the thick barrel resolves it for views that have `at.thick`; for diagonal views (`ne`, `se`, no `thick`) set shotgun length `r - 1`.

`src/art/sprites.ts`: add the names to `SPRITE_NAMES` and rows (no outline, soft overlays):

```ts
  'smoke', 'fire_0', 'fire_1', 'bang',
```

```ts
/** A puff of smoke: grey blobs, light on top. */
function smokeRows(): string[] {
  const g = blank();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const t = Math.hypot(x - C, y - C) + Math.sin(x * 1.7 + y * 0.9) * 1.6;
    if (t < 7.2) g[y][x] = t < 4 && (x + y) % 3 === 0 ? 'W' : t < 5.5 ? 'w' : 'v';
  }
  return g.map((r) => r.join(''));
}

/** Flames: a yellow core, orange body and red tips; the second frame leans the other way. */
function fireRows(frame: number): string[] {
  const g = blank();
  for (let x = 2; x < 14; x++) {
    const top = 5 + Math.round(3 * Math.abs(Math.sin(x * 0.9 + frame * 1.6)));
    for (let y = top; y < 15; y++) g[y][x] = y < top + 2 ? 'R' : y < top + 5 ? 'o' : 'y';
  }
  return g.map((r) => r.join(''));
}

/** A flashbang burst: a white star with a pale blue ring. */
function bangRows(): string[] {
  const g = blank();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = Math.abs(x - C), dy = Math.abs(y - C), r = Math.hypot(dx, dy);
    const ray = (dx <= 0.8 || dy <= 0.8) && r <= 7.5;
    if (r <= 2.5) g[y][x] = 'f';
    else if (ray) g[y][x] = 'f';
    else if (r <= 5) g[y][x] = 'C';
  }
  return outlined(g);
}
```

and add `smoke: smokeRows(), fire_0: fireRows(0), fire_1: fireRows(1), bang: bangRows(),` to `SPRITE_ROWS`. (Ensure palette letters used — `W w v R o y f C` — exist in `PALETTE`: they do.)

`src/render/renderer.ts` hazard overlays. Fire goes after the corpse pass and before the living units; smoke goes after the living units and before the status stack. Use `visible[y][x]` as the corpse pass does, `art.draw(ctx, name, x*T, y*T)`; for smoke set `ctx.globalAlpha = 0.8` before and restore to `1` after the loop (wrap in `ctx.save()`/`ctx.restore()` if the file already uses them). Fire frame: `` `fire_${Math.floor(now / 200) % 2}` `` using the `now` argument `drawGame` already receives (check the parameter name: it is the fifth argument, `0` in tests).

```ts
  // fire lies under the units, smoke over them; both only where the player can see
  for (const h of state.hazards) {
    if (h.kind === 'fire' && visible[h.pos.y][h.pos.x]) art.draw(ctx, `fire_${Math.floor(now / 200) % 2}` as SpriteName, h.pos.x * T, h.pos.y * T);
  }
  // ... living units drawn here ...
  ctx.globalAlpha = 0.8;
  for (const h of state.hazards) {
    if (h.kind === 'smoke' && visible[h.pos.y][h.pos.x]) art.draw(ctx, 'smoke', h.pos.x * T, h.pos.y * T);
  }
  ctx.globalAlpha = 1;
```

Add the turns-left number only when it fits cheaply: draw `String(h.turnsLeft)` with the existing small-text helper in the corner of the tile for the first tile of each hazard group is optional; skip it unless the helper is already imported in `renderer.ts`.

`src/render/effects.ts` in the `grenade` branch use `e.kind`:

```ts
      } else if (e.type === 'grenade') {
        const centre = { x: (e.at.x - 1) * T, y: (e.at.y - 1) * T };
        if (e.kind === 'flash') {
          this.sprite(['bang'], { x: e.at.x * T, y: e.at.y * T }, now, 350, { scale: 3, fade: true });
          this.list.push({ kind: 'flash', at: e.at, color: '255,255,255', start: now, dur: 250 });
        } else if (e.kind === 'smoke') {
          this.sprite(['smoke'], { x: (e.at.x - 1) * T, y: (e.at.y - 1) * T }, now, 500, { scale: 3, fade: true });
        } else {
          this.sprite(['boom_0', 'boom_1', 'boom_2', 'boom_3'], centre, now, 450, { scale: 3 });
        }
      } else if (e.type === 'burned') {
        this.sprite(['spark'], { x: e.at.x * T, y: e.at.y * T - AIM_RAISE }, now, 220, { fade: true });
      }
```

(keep the other branches; match the existing `sprite(...)` call shapes shown in the file. Incendiary uses the explosion frames for the landing, the persistent flames come from the overlay.)

`src/art/gallery.ts`: it lists the effect sprite names from `SPRITE_NAMES`; if it hard-codes the list, add the four new names.

- [ ] **Step 4: Run all, then look at it in the game**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. Then start `laser-tribute-dev`, start a mission, set `app.controller.state.hazards` with a few smoke and fire tiles next to the squad and give a soldier `weapon = 'sniper'`, `'smg'`, `'shotgun'` to check the in-hand look and overlays by eye (screenshot, zoom).

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: art for the new weapons, smoke, fire and flash effects" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: UI: cycle buttons, throw label, hit-chance text

**Files:**
- Modify: `src/screens/equipment.ts`, `src/render/panel.ts`, `src/controller.ts`, `src/app.ts`, `src/audio/mapping.ts`
- Test: extend `tests/equipment.test.ts` and the panel test file (`ls tests | grep -i panel`)

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: `nextWeapon(l, i, level, stash)`, `nextThrowable(l, i, level, stash)`, equipment hit kind `'throwable'`, `EquipmentView.level`, panel throw label `T SMOKE (2)`.

- [ ] **Step 1: Write the failing tests**

Read `src/screens/equipment.ts` first (`swapped`, `toggleWeapon`, `toggleBlockReason`, `EquipmentHit`, `applyEquipmentHit`, `EquipmentView`) and `tests/equipment.test.ts` for how it builds a view and a hit. Add:

```ts
describe('cycling weapons and throwables', () => {
  const l = () => defaultLoadout();
  it('steps through the weapons unlocked at the level, wrapping around', () => {
    expect(nextWeapon(l(), 2, 1, emptyStash())).toBe('rifle');           // pistol -> rifle at level 1
    const rifle = l().map((s, i) => (i === 2 ? { ...s, weapon: 'rifle' as const } : s));
    expect(nextWeapon(rifle, 2, 1, emptyStash())).toBe('pistol');        // wraps
    expect(nextWeapon(rifle, 2, 2, emptyStash())).toBe('shotgun');
    const sg = l().map((s, i) => (i === 2 ? { ...s, weapon: 'shotgun' as const } : s));
    expect(nextWeapon(sg, 2, 6, emptyStash())).toBe('smg');
    expect(nextWeapon(sg, 2, 2, emptyStash())).toBe('pistol');
  });

  it('offers a stash weapon even when locked', () => {
    const rifle = l().map((s, i) => (i === 2 ? { ...s, weapon: 'rifle' as const } : s));
    expect(nextWeapon(rifle, 2, 1, stashOf({ sniper: 1 }))).toBe('sniper');
  });

  it('steps through the throwables unlocked, frag first', () => {
    expect(nextThrowable(l(), 0, 1, emptyStash())).toBe('frag');
    expect(nextThrowable(l(), 0, 2, emptyStash())).toBe('smoke');
    const smoke = l().map((s, i) => (i === 0 ? { ...s, throwable: 'smoke' as const } : s));
    expect(nextThrowable(smoke, 0, 4, emptyStash())).toBe('flash');
    expect(nextThrowable(smoke, 0, 2, emptyStash())).toBe('frag');
  });

  it('the throwable button changes the kind and refuses when it busts the budget', () => {
    const hit = { kind: 'throwable', index: 0 } as const;
    const next = applyEquipmentHit(l(), hit, 999, emptyStash(), 2);
    expect(next[0].throwable).toBe('smoke');
    expect(equipmentBlockReason(l().map((s) => ({ ...s, grenades: 3 })), hit, 20, emptyStash(), 2)).not.toBeNull();
  });

});
```

Also add one hit-test in the same file: copy the file's existing `equipmentHitAt` test for the weapon button, point it at the centre of `EQ.throwable` for the same row, and expect `{ kind: 'throwable', index: 0 }`.

Panel tests (add to the existing panel test file):

```ts
it('labels the throw button with the kind and the count, and costs the kind AP', () => {
  const u = makeUnit... // the file's existing unit fixture
  u.throwable = 'smoke'; u.grenades = 2;
  expect(actionCost(u, 'throw')).toBe(18);
  expect(buttonLabel(u, 'throw')).toMatch(/SMOKE/i);
  expect(buttonLabel(u, 'throw')).toMatch(/2/);
});
```

(adapt `buttonLabel` to whatever the panel code calls its label function: find where `'Grenade'` / `MODE_NAMES.throw` / the `T GRENADE` text is produced, and extract that into an exported `throwLabel(u)` if there is no exported label function.)

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run tests/equipment.test.ts tests/panel.test.ts` (adjust file names)
Expected: FAIL (`nextWeapon`, `nextThrowable`, the hit kind and the label do not exist).

- [ ] **Step 3: Implement**

`src/screens/equipment.ts`:

```ts
import { THROWABLES, WEAPONS, unlockedThrowables, unlockedWeapons } from '../core/config';
import { throwableKey } from '../core/stash';

export function nextWeapon(l: Loadout, i: number, level: number, stash: Stash): WeaponId {
  const options = WEAPON_IDS.filter((w) => unlockedWeapons(level).includes(w) || stash[w] > 0);
  return options[(options.indexOf(l[i].weapon) + 1) % options.length] ?? l[i].weapon;
}

export function nextThrowable(l: Loadout, i: number, level: number, stash: Stash): ThrowableId {
  const options = THROWABLE_IDS.filter((t) => unlockedThrowables(level).includes(t) || stash[throwableKey(t)] > 0);
  return options[(options.indexOf(l[i].throwable ?? 'frag') + 1) % options.length] ?? 'frag';
}
```

Replace `swapped(l, i)` with `nextWeapon(l, i, level, stash)` in `toggleBlockReason` and `toggleWeapon` (add `level` as the last parameter of both, of `EquipmentView` as a field `level: number`, of `applyEquipmentHit` and `equipmentBlockReason`, defaulting to `TUTORIAL_LEVEL`). When the weapon changes, nothing else changes (the existing budget check stays). Add `'throwable'` to the hit-kind union; add `throwable: { x, w }` to `EQ` in a free spot of the grenade row (read the row layout: the `Grenades` label is at x 190, the minus button before x 304 and the plus after it; place the kind button to the right of the plus button or shrink the label, keeping the row inside the 400-wide frame; the mobile layout test in `tests/layout.test.ts` must still pass). Draw it with `drawButton(... THROWABLES[s.throwable ?? 'frag'].name ...)`, state from `throwableBlockReason(l, i, budget, stash, level)`:

```ts
export function throwableBlockReason(l: Loadout, i: number, budget: number, stash: Stash, level: number): string | null {
  const next = nextThrowable(l, i, level, stash);
  if (next === (l[i].throwable ?? 'frag')) return 'No other throwable unlocked';
  const after = l.map((s, j) => (j === i ? { ...s, throwable: next } : s));
  return validateLoadout(after, budget, stash, level);
}
export function cycleThrowable(l: Loadout, i: number, budget: number, stash: Stash, level: number): Loadout {
  if (throwableBlockReason(l, i, budget, stash, level)) return l;
  return l.map((s, j) => (j === i ? { ...s, throwable: nextThrowable(l, i, level, stash) } : s));
}
```

Wire the new kind into `equipmentHitAt`, `equipmentBlockReason` and `applyEquipmentHit` next to `'weapon'`. The weapon button label becomes `${WEAPONS[s.weapon].name} (${cover.weapon ? 'FREE' : WEAPONS[s.weapon].price})`. The help text (line 267) becomes `'Click a weapon to swap it; the throwable button cycles grenades; + and - for counts and clips'`.

`src/app.ts`: pass `levelOf(this.campaign)` in the `applyEquipmentHit` call (line 419) and in the equipment view object it draws (`level`).

`src/render/panel.ts`: change `MODE_NAMES.throw`/the throw button label to the dynamic text. Add and export:

```ts
export const throwLabel = (u: Unit): string => `${THROWABLES[u.throwable].name.toUpperCase()} (${u.grenades})`;
```

use it for the throw button label (keep the `T` key hint the file already puts in front) and replace the status line `GREN ${u.grenades}` at line 129 with `${THROWABLES[u.throwable].name.slice(0, 5).toUpperCase()} ${u.grenades}` (for example `SMOKE 2`, `FRAG 1`, `FLASH`, `INCEN`: use short names `FRAG, SMOKE, FLASH, FIRE` via a small map to stay inside the status width).

`src/controller.ts`: the throw hint already uses the kind (Task 6). Extend the shot hint with burst and falloff:

```ts
const burst = w.burst && w.burst > 1 ? ` x${w.burst}` : '';
snap: `Snap shot${burst}, ${w.snapAp} AP: click an enemy`,
aimed: `Aimed shot${burst}, ${w.aimedAp} AP: click an enemy`,
```

and wherever the hit-chance preview text is built (`updatePreview`), append the burst count the same way (`x3`). Read `updatePreview` and add the suffix to the percentage string it already builds.

`src/audio/mapping.ts` line 23: `hit(weapon === 'pistol' ? 'pistol' : 'rifle', loud)` stays correct for the new weapons (they sound like the rifle); make it explicit: `weapon === 'pistol' || weapon === 'smg' ? 'pistol' : 'rifle'`. Also map the grenade event by kind: for `flash` and `smoke` use the quieter existing sound if one exists, else leave as is (do not add new sound files).

- [ ] **Step 4: Run all and check the screens**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean and green. Then in the dev server open the equipment screen on the campaign (set the campaign `missionIndex` through `app` so level 6 shows everything) and screenshot: the weapon button cycles through the unlocked set, the throwable button cycles, prices and the budget update. Resize to mobile (375x812) and screenshot again.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: weapon and throwable cycle buttons, throw label with kind and count" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Balance simulation and whole-game checks

**Files:**
- Create: `tests/balance.test.ts`
- Modify: possibly stat numbers in `src/core/config.ts` after the simulation

**Interfaces:**
- Consumes: everything.
- Produces: a seeded simulation test, and the final verification run.

- [ ] **Step 1: Write the simulation test**

```ts
// tests/balance.test.ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { WEAPON_IDS, WEAPONS } from '../src/core/config';
import { generateMission } from '../src/core/gen';
import { checkMission } from '../src/core/gen/check';
import { createMission } from '../src/core/missions';
import type { GameState, WeaponId } from '../src/core/types';
import { corridorRows, makeState } from './helpers';

/** Two soldiers face each other across `gap` tiles and shoot aimed shots in turn; returns the winner side or null after 40 turns. */
function duel(a: WeaponId, b: WeaponId, gap: number, seed: number): 'a' | 'b' | null {
  let s: GameState = makeState(corridorRows('P' + '.'.repeat(gap - 1) + 'E'));
  s.rngState = seed; s.critState = seed * 7 + 1;
  const pa = s.units.find((u) => u.id === 'p1')!; const eb = s.units.find((u) => u.id === 'e1')!;
  pa.weapon = a; eb.weapon = b; pa.ammo = WEAPONS[a].magazine; eb.ammo = WEAPONS[b].magazine;
  pa.clips = 4; eb.clips = 4; pa.facing = 2; eb.facing = 6;
  for (let turn = 0; turn < 40; turn++) {
    for (const [side, id, tid] of [['player', 'p1', 'e1'], ['enemy', 'e1', 'p1']] as const) {
      s.turn = side;
      const u = s.units.find((x) => x.id === id)!;
      u.ap = u.maxAp;
      for (let i = 0; i < 6 && u.alive; i++) {
        const w = WEAPONS[u.weapon];
        const r = u.ammo < 1 ? applyCommand(s, { type: 'Reload', unitId: id })
          : applyCommand(s, { type: 'AimedShot', unitId: id, targetId: tid });
        if (!r.ok) { const snap = applyCommand(s, { type: 'SnapShot', unitId: id, targetId: tid }); if (!snap.ok) break; s = snap.state; } else s = r.state;
        void w;
        if (s.status !== 'playing') return s.status === 'won' ? 'a' : 'b';
      }
    }
  }
  return null;
}

function winRate(a: WeaponId, b: WeaponId, gap: number): number {
  let wins = 0, played = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = duel(a, b, gap, seed);
    if (r === null) continue;
    played++;
    if (r === 'a') wins++;
  }
  return wins / Math.max(1, played);
}

describe('weapon balance (aimed duels, first shooter alternates by side)', () => {
  it('no weapon wins every matchup at every range', () => {
    for (const a of WEAPON_IDS) {
      let beatsAll = true;
      for (const gap of [2, 5, 9]) {
        for (const b of WEAPON_IDS) {
          if (a === b) continue;
          if (winRate(a, b, gap) < 0.5) beatsAll = false;
        }
      }
      expect(beatsAll, `${a} beat every other weapon at every range`).toBe(false);
    }
  });

  it('the shotgun beats the sniper up close and loses to it far away', () => {
    expect(winRate('shotgun', 'sniper', 2)).toBeGreaterThan(0.5);
    expect(winRate('sniper', 'shotgun', 9)).toBeGreaterThan(0.5);
  });
});

describe('generated missions with weapon draws', () => {
  it('still pass checkMission and place weapons from the unlocked set', () => {
    for (let type = 0; type < 10; type++) {
      const def = generateMission(type, 0);
      expect(checkMission(def)).toEqual([]);
      const state = createMission(def, 3, undefined, undefined, undefined, undefined, type + 1);
      for (const u of state.units.filter((x) => x.side === 'enemy')) expect(WEAPONS[u.weapon].unlockAt).toBeLessThanOrEqual(type + 1);
    }
  });
});
```

If `checkMission` or `generateMission` have different names or signatures, use the names from `src/core/gen/index.ts` and `src/core/gen/check.ts` (the existing generation tests show the call shape: copy it from `tests/gen*.test.ts`).

- [ ] **Step 2: Run, and tune if a balance assertion fails**

Run: `npx vitest run tests/balance.test.ts`
Expected: PASS. If "no weapon wins every matchup" fails for a weapon, or the shotgun-versus-sniper ranges fail, change that weapon's numbers in `src/core/config.ts` (damage, accuracy or AP) minimally, record the change in the commit message, and re-run; the spec lists the stats as tunable. A flaky result means too few seeds: raise 200 to 400.

- [ ] **Step 3: Whole-game verification**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: clean, all green, build succeeds. Then in the dev server: play the campaign with the level raised (set `app.campaign.missionIndex` through the app object) and check by eye and by screenshot: buy a sniper and see 14 tiles, fire an SMG burst, throw each throwable (smoke blocks the view, fire burns and shows flames, flash drops AP), an enemy with a shotgun, the equipment screen on desktop and at 375 px width. Fix anything wrong with a test first.

- [ ] **Step 4: Commit**

```bash
git add src tests && git commit -m "test: weapon balance simulation and generated mission checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## After the tasks

Final whole-branch review by a fresh Opus reviewer using the spec, this plan's Review Focus and the ledger rulings; one fix pass (each fix RED then GREEN, whole suite green); then push `milestone-18`, give Rui the PR link, and after "pushed and merged" sync master, run the suite, check the live bundle and write the vault notes.
