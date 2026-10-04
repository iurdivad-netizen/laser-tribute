# Laser Tribute Milestone 5 Implementation Plan (limited ammo and reloading)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every gun has a magazine, reloading costs AP and uses a spare clip, spare clips are bought on the equipment screen, and enemies follow the same rules.

**Architecture:** `Unit` gets `ammo` and `clips`; `WeaponDef` gets a `magazine` size. `fireShot` spends a round, `handleShot` and reaction fire refuse an empty gun, a new `Reload` command refills the magazine for 15 AP. The loadout gets a required `clips` count (1 to 4, first free), priced and validated in `core/loadout.ts`. The AI reloads an empty gun first. The panel shows ammo and a RELOAD button; the equipment screen gets a spare-clips control line per soldier.

**Tech Stack:** TypeScript, HTML5 Canvas, Vite, Vitest (`npx vitest run`, `npx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-04-laser-tribute-milestone5-design.md` (read it first).

## Global Constraints

- `src/core` has no browser imports.
- Magazine: pistol 8, rifle 5. Reload cost 15 AP. Spare clips at start: 1 for soldiers and enemies (included in the weapon price). A soldier carries 1 to 4 spare clips; each clip beyond the first costs 5 credits. Clips are generic (fit any weapon). Ammo and clips are not tracked between missions.
- The default kit must still cost 102 credits and validate at budget 120.
- Each shot (snap, aimed, alert reaction fire) uses one round; grenades and the knife use none. A shot with an empty gun is rejected with `Out of ammo` before AP is spent.
- `Reload` rejections, in this order: `No spare clips`, `Magazine is already full`, then `Not enough action points` (15 AP).
- Panel: nine buttons in the order snap, aimed, throw, stab, reload, door, pickup, alert, end; step 34 px, width 33 px, starting at x = 172; every label `"<key> <label>"` at most six characters.
- Existing tests (295) must keep passing after every task; test helpers that build loadouts gain `clips: 1`.
- Co-author trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on branch `milestone-5` (created, spec committed).

## Review Focus

- A rifle fires exactly five rounds, the sixth is refused, and the refusal spends no AP and no round (assert on the failed result and on a fresh state). Task 1.
- A missed shot and a hit both use a round. Task 1.
- 14 AP cannot reload, 15 AP can; a full magazine, or zero clips, cannot reload even with plenty of AP. Task 2.
- An enemy with no ammo and no clips never shoots, never reloops forever, and the enemy turn still ends. Task 2.
- A weapon picked up from the floor is full, and a soldier who keeps swapping cannot gain ammo beyond a full magazine plus the clips they hold. Task 1.
- The default kit still costs exactly 102; one soldier with four spare clips costs 15 more; clips outside 1 to 4 are rejected; a loadout that only fits without extra clips is rejected when clips push it over budget. Task 3.
- The nine panel buttons stay inside the panel, do not overlap, and every label fits (six characters). Task 5.

## File Structure

- Create `src/core/actions/reload.ts`: `handleReload`.
- Modify `src/core/config.ts`, `types.ts`, `mission.ts`, `combat.ts`, `actions/shoot.ts`, `actions/item.ts`, `apply.ts`, `ai.ts`, `loadout.ts`.
- Modify `src/screens/equipment.ts`, `src/controller.ts`, `src/render/panel.ts`, `src/render/effects.ts`, `README.md`.
- Tests: create `tests/ammo.test.ts`, `tests/reload.test.ts`, `tests/clips.test.ts`, `tests/clipsui.test.ts`, `tests/ammoui.test.ts`; modify `tests/panel.test.ts`, and the loadout helpers in `tests/loadout.test.ts`, `tests/stash.test.ts`, `tests/missions.test.ts`, `tests/app.test.ts`.

---

### Task 1: Magazines, ammo use and full pickups

**Files:**
- Modify: `src/core/config.ts`, `src/core/types.ts`, `src/core/mission.ts`, `src/core/combat.ts`, `src/core/actions/shoot.ts`, `src/core/actions/item.ts`
- Test: `tests/ammo.test.ts`

**Interfaces:**
- Consumes: existing `fireShot`, `applyReactionFire`, `handleShot`, `handlePickUp`, `WEAPONS`.
- Produces: `WeaponDef.magazine: number` (pistol 8, rifle 5); `CONFIG.reloadAp = 15`, `CONFIG.spareClips = 1`, `CONFIG.maxClips = 4`; `Unit.ammo: number`, `Unit.clips: number`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ammo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { CONFIG, WEAPONS } from '../src/core/config';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const snap = () => ({ type: 'SnapShot' as const, unitId: 'p1', targetId: 'e1' });
const aimed = () => ({ type: 'AimedShot' as const, unitId: 'p1', targetId: 'e1' });
const HIT = () => seedForRoll((n) => n < 0.05);
const MISS = () => seedForRoll((n) => n > 0.99);

describe('magazines and starting ammo', () => {
  it('weapons have magazine sizes and the reload constants exist', () => {
    expect(WEAPONS.pistol.magazine).toBe(8);
    expect(WEAPONS.rifle.magazine).toBe(5);
    expect(CONFIG.reloadAp).toBe(15);
    expect(CONFIG.spareClips).toBe(1);
    expect(CONFIG.maxClips).toBe(4);
  });

  it('every unit starts with a full magazine and one spare clip', () => {
    const s = makeState(corridorRows('P..E'));
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 1 });
    expect(unit(s, 'e1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 1 });
  });

  it('a pistol soldier starts with eight rounds', () => {
    const s = makeState(corridorRows('PPP.E'));
    expect(unit(s, 'p3')).toMatchObject({ weapon: 'pistol', ammo: 8, clips: 1 });
  });
});

describe('shooting uses ammo', () => {
  it('a hit spends one round', () => {
    const s = makeState(corridorRows('P..E'));
    s.rngState = HIT();
    const r = ok(applyCommand(s, snap()));
    expect(unit(r.state, 'p1').ammo).toBe(4);
    expect(unit(r.state, 'p1').ap).toBe(45);
  });

  it('a miss spends a round too, and so does an aimed shot', () => {
    const s = makeState(corridorRows('P..E'));
    s.rngState = MISS();
    expect(unit(ok(applyCommand(s, snap())).state, 'p1').ammo).toBe(4);
    expect(unit(ok(applyCommand(s, aimed())).state, 'p1').ammo).toBe(4);
  });

  it('a rifle fires five rounds and the sixth is refused without spending AP or a round', () => {
    let s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ap = 600; // plenty, so only ammo can stop the sixth shot
    unit(s, 'p1').maxAp = 600;
    unit(s, 'e1').hp = 999;
    unit(s, 'e1').maxHp = 999;
    for (let i = 0; i < 5; i++) s = ok(applyCommand(s, snap())).state;
    expect(unit(s, 'p1')).toMatchObject({ ammo: 0, ap: 600 - 5 * 15 });
    const sixth = applyCommand(s, snap());
    expect(sixth.ok).toBe(false);
    expect(reason(sixth)).toBe('Out of ammo');
    expect(unit(s, 'p1')).toMatchObject({ ammo: 0, ap: 600 - 5 * 15 }); // the input state is untouched
  });

  it('the knife and grenades still work with an empty gun', () => {
    const s = makeState(corridorRows('PE'));
    unit(s, 'p1').ammo = 0;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Stab', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
  });
});

describe('alert reaction fire uses ammo', () => {
  /** p1 faces east on alert; it is the enemy's turn with e1 about to walk west. */
  function setup() {
    const s = makeState(corridorRows('P....E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alert = true;
    s.turn = 'enemy';
    unit(s, 'e1').hp = 100;
    unit(s, 'e1').maxHp = 100;
    return s;
  }
  const west = { type: 'Move', unitId: 'e1', to: { x: 5, y: 1 } } as const;

  it('spends a round', () => {
    const s = setup();
    s.rngState = HIT();
    const r = ok(applyCommand(s, west));
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'shot']);
    expect(unit(r.state, 'p1').ammo).toBe(4);
  });

  it('does not fire with an empty gun and keeps its AP', () => {
    const s = setup();
    unit(s, 'p1').ammo = 0;
    const r = ok(applyCommand(s, west));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
    expect(unit(r.state, 'p1').ap).toBe(60);
  });
});

describe('picking up a weapon', () => {
  it('arrives with a full magazine and keeps the spare clips', () => {
    const s = makeState(corridorRows('P..E'));
    // Put a rifle on p1's tile by hand: p1 is a rifleman on this map, so make p1 a pistol soldier first.
    const p = unit(s, 'p1');
    p.weapon = 'pistol';
    p.ammo = 2;
    p.clips = 3;
    s.items.push({ id: 'i1', pos: { ...p.pos }, kind: 'rifle' });
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' }));
    expect(unit(r.state, 'p1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 3 });
  });

  it('swapping back and forth never gives more than a full magazine', () => {
    let s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    p.weapon = 'pistol';
    p.ammo = 0;
    p.clips = 0;
    s.items.push({ id: 'i1', pos: { ...p.pos }, kind: 'rifle' });
    s = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' })).state; // rifle, ammo 5, floor now has a pistol
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'rifle', ammo: 5, clips: 0 });
    s = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i1' })).state; // back to the pistol
    expect(unit(s, 'p1')).toMatchObject({ weapon: 'pistol', ammo: 8, clips: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ammo.test.ts`
Expected: FAIL (`WEAPONS.pistol.magazine` is undefined, `ammo` is undefined).

- [ ] **Step 3: Implement**

`src/core/config.ts`: add `magazine: number;` to `WeaponDef`; set `magazine: 8` for the pistol and `magazine: 5` for the rifle (inside each weapon object); add to `CONFIG` next to `knife`:

```ts
  reloadAp: 15,
  spareClips: 1,
  maxClips: 4,
```

`src/core/types.ts`: in `Unit`, after `rank: string;` add:

```ts
  /** Rounds left in the gun. */
  ammo: number;
  /** Spare clips: each reload uses one. Clips fit any weapon. */
  clips: number;
```

`src/core/mission.ts`: in `makeUnit`, after the `rank:` line add `ammo: WEAPONS[weapon].magazine,` and `clips: CONFIG.spareClips,`; change the config import to `import { CONFIG, WEAPONS } from './config';`.

`src/core/combat.ts`: at the top of `fireShot` body add `shooter.ammo -= 1;` (before computing `hit`). In `applyReactionFire` add `if (o.ammo < 1) continue;` right after the existing `if (o.ap < w.snapAp) continue;` line, and replace the last line of the loop body `if (o.ap < w.snapAp) o.alert = false;` with `if (o.ap < w.snapAp || o.ammo < 1) o.alert = false;`.

`src/core/actions/shoot.ts`: after the `Cannot shoot your own side` check add:

```ts
  if (unit.ammo < 1) return 'Out of ammo';
```

`src/core/actions/item.ts`: in the weapon-swap `else` branch, after `unit.weapon = item.kind;` add `unit.ammo = WEAPONS[unit.weapon].magazine;` (`WEAPONS` is already imported).

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests/ammo.test.ts
git commit -m "feat(core): magazines, one round per shot, full magazine on pickup

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reload command and the enemy reloading

**Files:**
- Create: `src/core/actions/reload.ts`
- Modify: `src/core/types.ts` (Command, GameEvent), `src/core/apply.ts`, `src/core/ai.ts`
- Test: `tests/reload.test.ts`

**Interfaces:**
- Consumes: `Unit.ammo`, `Unit.clips`, `WEAPONS[...].magazine`, `CONFIG.reloadAp`, `NOT_ENOUGH_AP`.
- Produces: `Command` gains `{ type: 'Reload'; unitId: string }`; `GameEvent` gains `{ type: 'reloaded'; unitId: string; ammo: number; at: Pos }`; `handleReload(s, cmd, unit, events): string | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/reload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

const reload = (unitId = 'p1') => ({ type: 'Reload' as const, unitId });

describe('Reload command', () => {
  it('fills the magazine, uses a clip and spends 15 AP', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 2;
    const r = ok(applyCommand(s, reload()));
    expect(unit(r.state, 'p1')).toMatchObject({ ammo: 5, clips: 0, ap: 45 });
    expect(r.events).toEqual([{ type: 'reloaded', unitId: 'p1', ammo: 5, at: { x: 1, y: 1 } }]);
  });

  it('refills a pistol to eight', () => {
    const s = makeState(corridorRows('PPP.E'));
    unit(s, 'p3').ammo = 0;
    expect(unit(ok(applyCommand(s, reload('p3'))).state, 'p3').ammo).toBe(8);
  });

  it('needs a spare clip', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 0;
    unit(s, 'p1').clips = 0;
    expect(reason(applyCommand(s, reload()))).toBe('No spare clips');
  });

  it('refuses a full magazine and spends nothing', () => {
    const s = makeState(corridorRows('P..E'));
    expect(reason(applyCommand(s, reload()))).toBe('Magazine is already full');
  });

  it('needs 15 AP: 14 fails, 15 works', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 0;
    unit(s, 'p1').ap = 14;
    expect(reason(applyCommand(s, reload()))).toBe('Not enough action points');
    unit(s, 'p1').ap = 15;
    expect(unit(ok(applyCommand(s, reload())).state, 'p1')).toMatchObject({ ammo: 5, ap: 0 });
  });

  it('reports "no spare clips" before "full magazine" and before AP', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').clips = 0;
    unit(s, 'p1').ap = 0;
    expect(reason(applyCommand(s, reload()))).toBe('No spare clips');
  });

  it('ends the soldier alert like any other action', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').ammo = 1;
    unit(s, 'p1').alert = true;
    expect(unit(ok(applyCommand(s, reload())).state, 'p1').alert).toBe(false);
  });
});

describe('enemies and ammo', () => {
  /** Enemy turn with e1 able to see p1 four tiles away. */
  function enemyTurn() {
    const s = makeState(corridorRows('P...E'));
    s.turn = 'enemy';
    unit(s, 'e1').facing = 6;
    return s;
  }

  it('an enemy with an empty gun and a spare clip reloads before anything else', () => {
    const s = enemyTurn();
    unit(s, 'e1').ammo = 0;
    expect(aiNextCommand(s)).toEqual({ type: 'Reload', unitId: 'e1' });
  });

  it('a full enemy shoots as before', () => {
    expect(aiNextCommand(enemyTurn())).toMatchObject({ type: 'AimedShot', unitId: 'e1' });
  });

  it('an enemy with no ammo and no clips never shoots, and the turn still ends', () => {
    const s = enemyTurn();
    unit(s, 'e1').ammo = 0;
    unit(s, 'e1').clips = 0;
    const out = runEnemyTurn(s);
    expect(out.events.some((e) => e.type === 'shot')).toBe(false);
    expect(out.state.turn).toBe('player');
    expect(unit(out.state, 'p1').hp).toBe(50);
  });

  it('an enemy empties its gun, reloads once, and runs dry after its spare clip', () => {
    let s = enemyTurn();
    unit(s, 'e1').ap = 2000;
    unit(s, 'e1').maxAp = 2000;
    unit(s, 'p1').hp = 100000; // survive the whole volley
    unit(s, 'p1').maxHp = 100000;
    const out = runEnemyTurn(s);
    const shots = out.events.filter((e) => e.type === 'shot').length;
    const reloads = out.events.filter((e) => e.type === 'reloaded').length;
    expect(shots).toBe(10); // 5 + 5 with one reload in between
    expect(reloads).toBe(1);
    expect(unit(out.state, 'e1')).toMatchObject({ ammo: 0, clips: 0 });
    expect(out.state.turn).toBe('player');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/reload.test.ts`
Expected: FAIL (`Reload` command is not defined and does not apply).

- [ ] **Step 3: Implement**

`src/core/types.ts`: add to `Command` (after `Stab`): `| { type: 'Reload'; unitId: string }`; add to `GameEvent` (after `stab`): `| { type: 'reloaded'; unitId: string; ammo: number; at: Pos }`.

Create `src/core/actions/reload.ts`:

```ts
import { CONFIG, NOT_ENOUGH_AP, WEAPONS } from '../config';
import type { Command, GameEvent, GameState, Unit } from '../types';

/** Swaps in a spare clip: the magazine is full again. */
export function handleReload(
  _s: GameState,
  _cmd: Extract<Command, { type: 'Reload' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const magazine = WEAPONS[unit.weapon].magazine;
  if (unit.clips < 1) return 'No spare clips';
  if (unit.ammo >= magazine) return 'Magazine is already full';
  if (unit.ap < CONFIG.reloadAp) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.reloadAp;
  unit.ammo = magazine;
  unit.clips -= 1;
  events.push({ type: 'reloaded', unitId: unit.id, ammo: unit.ammo, at: { ...unit.pos } });
  return null;
}
```

`src/core/apply.ts`: add `import { handleReload } from './actions/reload';` and in `dispatch` after the `Stab` case:

```ts
    case 'Reload':
      return handleReload(s, cmd, unit, events);
```

`src/core/ai.ts`: in `candidates`, change `const out: Command[] = [];` to:

```ts
  const out: Command[] = [];
  if (unit.ammo < 1 && unit.clips > 0) out.push({ type: 'Reload', unitId: unit.id });
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If the "runs dry" test reports a different shot count, check that `fireShot` decrements ammo once per shot and that `handleShot` is the only path the AI uses; do not change the expected 5 + 5.

- [ ] **Step 5: Commit**

```bash
git add src tests/reload.test.ts
git commit -m "feat(core): Reload command; enemies reload an empty gun

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Spare clips in the loadout (cost, validation, apply)

**Files:**
- Modify: `src/core/loadout.ts`; loadout literals in `tests/loadout.test.ts`, `tests/stash.test.ts`, `tests/missions.test.ts`, `tests/app.test.ts`
- Test: `tests/clips.test.ts`

**Interfaces:**
- Consumes: `CONFIG.spareClips`, `CONFIG.maxClips`, `WEAPONS[...].magazine`, `Unit.ammo`, `Unit.clips`.
- Produces: `SoldierLoadout.clips: number` (required, 1 to 4); `LOADOUT.prices.clip = 5`; `soldierCost` adds `5 * (clips - 1)`; `validateLoadout` rejects clips outside 1 to `CONFIG.maxClips`; `applyLoadout` sets `clips` and refills `ammo` to the chosen weapon's magazine; `defaultLoadout` and `cheapLoadout` use 1 clip.

- [ ] **Step 1: Write the failing tests and update the existing literals**

Run this to add `clips: 1` to every existing loadout literal in the tests (it only touches the four files named above):

```bash
python - <<'EOF'
import re
for p in ['tests/loadout.test.ts','tests/stash.test.ts','tests/missions.test.ts','tests/app.test.ts']:
    s=open(p,encoding='utf-8').read()
    s=re.sub(r"(grenades: \d+) \}", r"\1, clips: 1 }", s)
    s=s.replace("({ weapon, grenades })","({ weapon, grenades, clips: 1 })")
    open(p,'w',encoding='utf-8').write(s)
EOF
git diff --stat
```

Expected: only those four test files change. (`toMatchObject({ weapon: 'rifle', grenades: 3 })` lines also gain `clips: 1`, which is correct because the loadout sets one clip.)

Create `tests/clips.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LOADOUT, applyLoadout, cheapLoadout, defaultLoadout, fitLoadout, loadoutCost, soldierCost,
  validateLoadout, type Loadout,
} from '../src/core/loadout';
import { createMission1 } from '../src/core/mission1';
import { unit } from './helpers';

const withClips = (clips: number[]): Loadout => defaultLoadout().map((s, i) => ({ ...s, clips: clips[i] ?? 1 }));

describe('spare clips in the loadout', () => {
  it('the default kit has one clip each and still costs 102', () => {
    const l = defaultLoadout();
    expect(l.every((s) => s.clips === 1)).toBe(true);
    expect(loadoutCost(l)).toBe(102);
    expect(validateLoadout(l)).toBeNull();
    expect(LOADOUT.prices.clip).toBe(5);
  });

  it('the first clip is free, each further clip costs 5', () => {
    expect(loadoutCost(withClips([2, 1, 1, 1]))).toBe(107);
    expect(loadoutCost(withClips([4, 1, 1, 1]))).toBe(117); // 3 extra clips: +15
    expect(soldierCost({ weapon: 'rifle', grenades: 1, clips: 3 })).toBe(25 + 8 + 10);
  });

  it('rejects 0 clips, more than 4, and non-integers', () => {
    expect(validateLoadout(withClips([0, 1, 1, 1]))).toMatch(/Soldier 1 must carry 1 to 4 spare clips/);
    expect(validateLoadout(withClips([1, 5, 1, 1]))).toMatch(/Soldier 2 must carry 1 to 4 spare clips/);
    expect(validateLoadout(withClips([1, 1, 2.5, 1]))).toMatch(/Soldier 3 must carry 1 to 4 spare clips/);
  });

  it('extra clips can push a loadout over the budget', () => {
    const l = withClips([4, 4, 4, 4]); // 102 + 4 * 15 = 162
    expect(loadoutCost(l)).toBe(162);
    expect(validateLoadout(l, 120)).toMatch(/budget/);
    expect(validateLoadout(l, 162)).toBeNull();
  });

  it('cheapLoadout and fitLoadout keep the field', () => {
    expect(cheapLoadout().every((s) => s.clips === 1)).toBe(true);
    const prev = withClips([2, 1, 1, 1]);
    expect(fitLoadout(prev, 120)).toBe(prev);
    const tooBig = withClips([4, 4, 4, 4]);
    expect(fitLoadout(tooBig, 120).every((s) => s.clips === 1)).toBe(true);
  });

  it('applyLoadout sets the clips and refills ammo for the chosen weapon', () => {
    const l = withClips([3, 1, 2, 4]);
    l[1] = { weapon: 'pistol', grenades: 1, clips: 1 }; // p2 is a rifleman on the map, a pistol soldier here
    l[2] = { weapon: 'rifle', grenades: 1, clips: 2 }; // p3 is a pistol soldier on the map, a rifleman here
    const next = applyLoadout(createMission1(), l, 200);
    expect(unit(next, 'p1')).toMatchObject({ clips: 3, ammo: 5 });
    expect(unit(next, 'p2')).toMatchObject({ weapon: 'pistol', clips: 1, ammo: 8 });
    expect(unit(next, 'p3')).toMatchObject({ weapon: 'rifle', clips: 2, ammo: 5 });
    expect(unit(next, 'p4')).toMatchObject({ clips: 4 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/clips.test.ts` and `npx tsc --noEmit`
Expected: FAIL (`clips` is not in the loadout; `LOADOUT.prices.clip` undefined); `tsc` may also report the new `clips` property as unknown in the edited test literals.

- [ ] **Step 3: Implement**

`src/core/loadout.ts`:
- Imports: `import { CONFIG, WEAPONS } from './config';`
- `LOADOUT.prices`: `{ pistol: 10, rifle: 25, grenade: 8, clip: 5 }`.
- `SoldierLoadout` gains `clips: number;` (with the comment `/** Spare clips, 1 to 4; the first is included in the weapon price. */`).
- `defaultLoadout`: add `clips: 1` to each of the four soldiers. `cheapLoadout`: `{ weapon: 'pistol' as const, grenades: 1, clips: 1 }`.
- `soldierCost`: `return LOADOUT.prices[s.weapon] + LOADOUT.prices.grenade * s.grenades + LOADOUT.prices.clip * (s.clips - 1);`
- In `validateLoadout`'s per-soldier loop, after the grenade check add:

```ts
    if (!Number.isInteger(s.clips) || s.clips < 1 || s.clips > CONFIG.maxClips) {
      return `Soldier ${i + 1} must carry 1 to ${CONFIG.maxClips} spare clips`;
    }
```

- In `applyLoadout`'s per-unit assignment, after `u.grenades = l[i].grenades;` add:

```ts
      u.clips = l[i].clips;
      u.ammo = WEAPONS[l[i].weapon].magazine;
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. Any other test or source file that builds a loadout literal without `clips` will fail `tsc`; add `clips: 1` there (for example in `src/app.ts` if it builds one; it should only use `defaultLoadout()`/`cheapLoadout()`).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): spare clips in the loadout (cost, validation, apply)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Spare-clip controls on the equipment screen

**Files:**
- Modify: `src/screens/equipment.ts`
- Test: `tests/clipsui.test.ts`

**Interfaces:**
- Consumes: `Loadout`, `SoldierLoadout.clips`, `CONFIG.maxClips`, `loadoutCost`.
- Produces: `EquipmentHit` gains kinds `'clipMinus' | 'clipPlus'` (with `index`); `EQ.clipDy = 26`; `clipBlockReason(l, i, delta, budget?, stash?): string | null`; `changeClips(l, i, delta, budget?, stash?): Loadout`; `blockReasonFor` and `applyEquipmentHit` handle the new kinds; `equipmentHit` hit-tests the clip buttons at `y = rowY(i) + EQ.clipDy` (same x and size as the grenade buttons).

- [ ] **Step 1: Write the failing tests**

Create `tests/clipsui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import {
  applyEquipmentHit, blockReasonFor, changeClips, clipBlockReason, equipmentHit,
} from '../src/screens/equipment';

describe('spare clip controls', () => {
  it('adds clips up to 4 and each extra clip costs 5', () => {
    let l = changeClips(defaultLoadout(), 0, 1);
    expect(l[0].clips).toBe(2);
    expect(loadoutCost(l)).toBe(107);
    l = changeClips(l, 0, 1);
    l = changeClips(l, 0, 1);
    expect(l[0].clips).toBe(4);
    expect(clipBlockReason(l, 0, 1)).toBe('Max 4 spare clips');
    expect(changeClips(l, 0, 1)).toBe(l);
  });

  it('cannot go below one clip', () => {
    const l = defaultLoadout();
    expect(clipBlockReason(l, 0, -1)).toBe('At least 1 spare clip');
    expect(changeClips(l, 0, -1)).toBe(l);
  });

  it('is blocked when the credits run out and says how many are missing', () => {
    let l = changeClips(defaultLoadout(), 0, 1);
    l = changeClips(l, 0, 1);
    l = changeClips(l, 0, 1); // cost 117, 3 credits left
    expect(clipBlockReason(l, 1, 1)).toBe('Need 2 more credits'); // 117 + 5 - 120
    expect(changeClips(l, 1, 1)).toBe(l);
  });

  it('removing a clip is always allowed and gives the credits back', () => {
    const l = changeClips(defaultLoadout(), 0, 1);
    const back = changeClips(l, 0, -1);
    expect(back[0].clips).toBe(1);
    expect(loadoutCost(back)).toBe(102);
  });

  it('does not mutate its input', () => {
    const l = defaultLoadout();
    changeClips(l, 0, 1);
    expect(l[0].clips).toBe(1);
  });

  it('respects the stash (free gear does not make clips free) and the given budget', () => {
    expect(clipBlockReason(defaultLoadout(), 0, 1, 102)).toBe('Need 5 more credits');
    expect(clipBlockReason(defaultLoadout(), 0, 1, 107)).toBeNull();
  });
});

describe('clip buttons', () => {
  it('are hit-tested on a second line under the grenade controls', () => {
    expect(equipmentHit(260, 86)).toEqual({ kind: 'clipMinus', index: 0 });
    expect(equipmentHit(320, 86)).toEqual({ kind: 'clipPlus', index: 0 });
    expect(equipmentHit(260, 242)).toEqual({ kind: 'clipMinus', index: 3 });
    expect(equipmentHit(260, 68)).toEqual({ kind: 'minus', index: 0 }); // the grenade line is unchanged
    expect(equipmentHit(200, 86)).toBeNull();
  });

  it('are explained and applied through the generic hit helpers', () => {
    const l = defaultLoadout();
    expect(blockReasonFor(l, { kind: 'clipMinus', index: 0 })).toBe('At least 1 spare clip');
    expect(blockReasonFor(l, { kind: 'clipPlus', index: 0 })).toBeNull();
    expect(applyEquipmentHit(l, { kind: 'clipPlus', index: 0 })[0].clips).toBe(2);
    expect(applyEquipmentHit(l, { kind: 'clipMinus', index: 0 })).toBe(l);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/clipsui.test.ts`
Expected: FAIL (`changeClips` / `clipBlockReason` are not exported).

- [ ] **Step 3: Implement**

In `src/screens/equipment.ts`:
- Import `CONFIG` from `'../core/config'` (change the first import to `import { CONFIG, WEAPONS } from '../core/config';`).
- `EquipmentHit` becomes:

```ts
export type EquipmentHit =
  | { kind: 'weapon' | 'minus' | 'plus' | 'clipMinus' | 'clipPlus'; index: number }
  | { kind: 'start' };
```

- Add `clipDy: 26,` to `EQ` (after `btnH: 24,`).
- Add after `changeGrenades`:

```ts
export function clipBlockReason(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): string | null {
  const next = l[i].clips + delta;
  if (next < 1) return 'At least 1 spare clip';
  if (next > CONFIG.maxClips) return `Max ${CONFIG.maxClips} spare clips`;
  if (delta === 1) {
    const after = l.map((s, j) => (j === i ? { ...s, clips: next } : s));
    const need = loadoutCost(after, stash) - budget;
    if (need > 0) return `Need ${need} more credits`;
  }
  return null;
}

export function changeClips(
  l: Loadout, i: number, delta: 1 | -1, budget: number = LOADOUT.budget, stash: Stash = emptyStash(),
): Loadout {
  if (clipBlockReason(l, i, delta, budget, stash)) return l;
  return l.map((s, j) => (j === i ? { ...s, clips: s.clips + delta } : s));
}
```

- In `equipmentHit`, inside the loop after the `plus` line add:

```ts
    const cy = y + EQ.clipDy;
    if (inRect(px, py, EQ.minus.x, cy, EQ.minus.w, EQ.btnH)) return { kind: 'clipMinus', index: i };
    if (inRect(px, py, EQ.plus.x, cy, EQ.plus.w, EQ.btnH)) return { kind: 'clipPlus', index: i };
```

- In `blockReasonFor` add cases: `case 'clipMinus': return clipBlockReason(l, hit.index, -1, budget, stash);` and `case 'clipPlus': return clipBlockReason(l, hit.index, 1, budget, stash);`. In `applyEquipmentHit` add: `case 'clipMinus': return changeClips(l, hit.index, -1, budget, stash);` and `case 'clipPlus': return changeClips(l, hit.index, 1, budget, stash);`.
- In `drawEquipment`: change the `hot` helper's parameter type to `EquipmentHit['kind']` (`const hot = (kind: Exclude<EquipmentHit['kind'], 'start'>) => ...`). After the grenade `plus` button add the clip line:

```ts
    const cy = y + EQ.clipDy;
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText('Spare clips', 180, cy + 8);
    button(ctx, EQ.minus.x, cy, EQ.minus.w, EQ.btnH, '-', clipBlockReason(l, i, -1, view.budget, view.stash) === null, hot('clipMinus'));
    ctx.fillStyle = '#e8e8f0';
    ctx.fillText(`${s.clips}`, 286, cy + 8);
    button(ctx, EQ.plus.x, cy, EQ.plus.w, EQ.btnH, '+', clipBlockReason(l, i, 1, view.budget, view.stash) === null, hot('clipPlus'));
```

- Change the hint text `'Click a weapon to swap it, + and - for grenades'` to `'Click a weapon to swap it; + and - for grenades and spare clips'`.

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests/clipsui.test.ts
git commit -m "feat: spare-clip controls on the equipment screen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Reload in the controller, nine-button panel and ammo display

**Files:**
- Modify: `src/controller.ts`, `src/render/panel.ts`, `src/render/effects.ts`, `tests/panel.test.ts`
- Test: `tests/ammoui.test.ts`, `tests/panel.test.ts`

**Interfaces:**
- Consumes: `Reload` command and `reloaded` event (Task 2), `CONFIG.reloadAp`, `Unit.ammo`, `Unit.clips`.
- Produces: `ButtonId` gains `'reload'`; `PANEL_BUTTONS` has nine buttons (order: snap, aimed, throw, stab, reload, door, pickup, alert, end; step 34, width 33); labels `SNAP`, `AIM`, `GREN`, `STAB`, `LOAD`, `DOOR`, `TAKE`, `ALRT`, `END` with keys `S`, `A`, `T`, `K`, `R`, `D`, `P`, `L`, `Sp`; `actionCost(u, 'reload') === CONFIG.reloadAp`; `actionBlocked(u, id): boolean`; key `r` and the RELOAD button issue `Reload` for the selected soldier.

- [ ] **Step 1: Write the failing tests**

Replace the first test of `tests/panel.test.ts` (the one named "has eight buttons including STAB ...") with:

```ts
  it('has nine buttons including STAB and LOAD, all inside the panel, not overlapping, labels short', () => {
    expect(PANEL_BUTTONS.map((b) => b.id)).toEqual(
      ['snap', 'aimed', 'throw', 'stab', 'reload', 'door', 'pickup', 'alert', 'end'],
    );
    for (const b of PANEL_BUTTONS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(VIEW.width);
      expect(b.y + b.h).toBeLessThanOrEqual(VIEW.height);
      expect(`${b.key} ${b.label}`.length).toBeLessThanOrEqual(6);
    }
    for (let i = 1; i < PANEL_BUTTONS.length; i++) {
      const prev = PANEL_BUTTONS[i - 1];
      expect(PANEL_BUTTONS[i].x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
  });
```

Create `tests/ammoui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Controller } from '../src/controller';
import { CONFIG } from '../src/core/config';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { actionBlocked, actionCost } from '../src/render/panel';
import { corridorRows, makeState, unit } from './helpers';

function make(inner = 'P..E') {
  return new Controller(makeState(corridorRows(inner)), createUiState('p1'), new Effects());
}

describe('reload in the controller', () => {
  it('R reloads the selected soldier at once', () => {
    const c = make();
    unit(c.state, 'p1').ammo = 1;
    expect(c.key('r')).toBe(true);
    expect(unit(c.state, 'p1')).toMatchObject({ ammo: 5, clips: 0, ap: 45 });
    expect(c.ui.message).toBe('P1 reloaded');
  });

  it('the LOAD button does the same', () => {
    const c = make();
    unit(c.state, 'p1').ammo = 2;
    c.pressButton('reload');
    expect(unit(c.state, 'p1').ammo).toBe(5);
  });

  it('says why a reload is refused', () => {
    const c = make();
    c.key('r');
    expect(c.ui.message).toBe('Magazine is already full');
    unit(c.state, 'p1').ammo = 0;
    unit(c.state, 'p1').clips = 0;
    c.key('r');
    expect(c.ui.message).toBe('No spare clips');
  });

  it('a refused shot says Out of ammo', () => {
    const c = make();
    unit(c.state, 'p1').ammo = 0;
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(c.ui.message).toBe('Out of ammo');
    expect(unit(c.state, 'p1').ap).toBe(60);
  });
});

describe('panel ammo helpers', () => {
  it('reload costs 15 AP', () => {
    const s = makeState(corridorRows('P..E'));
    expect(actionCost(unit(s, 'p1'), 'reload')).toBe(CONFIG.reloadAp);
  });

  it('marks buttons the soldier cannot use right now', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    expect(actionBlocked(p, 'reload')).toBe(true); // magazine full
    p.ammo = 2;
    expect(actionBlocked(p, 'reload')).toBe(false);
    p.ap = 14;
    expect(actionBlocked(p, 'reload')).toBe(true);
    p.ap = 60;
    p.clips = 0;
    expect(actionBlocked(p, 'reload')).toBe(true); // no clips
    p.ammo = 0;
    expect(actionBlocked(p, 'snap')).toBe(true); // empty gun
    expect(actionBlocked(p, 'stab')).toBe(false); // the knife needs no ammo
    expect(actionBlocked(p, 'end')).toBe(false);
  });
});

describe('reload effect', () => {
  it('flashes at the soldier when a reloaded event arrives', () => {
    const fx = new Effects();
    fx.add([{ type: 'reloaded', unitId: 'p1', ammo: 5, at: { x: 1, y: 1 } }], 0);
    let fills = 0;
    const ctx = {
      fillRect() { fills += 1; },
      set fillStyle(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
    fx.draw(ctx, 50);
    expect(fills).toBe(1);
    fills = 0;
    fx.draw(ctx, 5000);
    expect(fills).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/panel.test.ts tests/ammoui.test.ts`
Expected: FAIL (no `reload` button, no `actionBlocked`).

- [ ] **Step 3: Implement**

`src/render/panel.ts`:
- `ButtonId`: add `'reload'`.
- `DEFS` becomes:

```ts
const DEFS: [ButtonId, string, string][] = [
  ['snap', 'SNAP', 'S'],
  ['aimed', 'AIM', 'A'],
  ['throw', 'GREN', 'T'],
  ['stab', 'STAB', 'K'],
  ['reload', 'LOAD', 'R'],
  ['door', 'DOOR', 'D'],
  ['pickup', 'TAKE', 'P'],
  ['alert', 'ALRT', 'L'],
  ['end', 'END', 'Sp'],
];
```

- Geometry: `x: 172 + i * 34, y: VIEW.mapHeight + 13, w: 33, h: 13,`
- `actionCost`: add `case 'reload': return CONFIG.reloadAp;`
- Add after `actionCost`:

```ts
/** True when the button's action cannot be used right now (not enough AP, empty gun, nothing to reload). */
export function actionBlocked(u: Unit, id: ButtonId): boolean {
  const cost = actionCost(u, id);
  if (cost !== null && u.ap < cost) return true;
  if (id === 'reload') return u.clips < 1 || u.ammo >= WEAPONS[u.weapon].magazine;
  if (id === 'snap' || id === 'aimed') return u.ammo < 1;
  return false;
}
```

- Weapon line: replace the second `fillText` in the `if (u)` block with:

```ts
    ctx.fillText(
      `${WEAPONS[u.weapon].name} ${u.ammo}/${WEAPONS[u.weapon].magazine} +${u.clips}  Grenades ${u.grenades}${u.alert ? '  ALERT' : ''}`,
      4, top + 15,
    );
```

- In the button loop replace the cost colour line with `ctx.fillStyle = actionBlocked(u!, b.id) ? '#ff5555' : '#8a8fa8';`.

`src/controller.ts`:
- In `pressButton` add `case 'reload': this.reload(); break;`
- Add a method next to `pickup`:

```ts
  private reload(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    if (this.run({ type: 'Reload', unitId: sel.id })) this.say(`${sel.name} reloaded`);
  }
```

- In `key` add `case 'r': this.reload(); return true;` (next to `case 'p'`).
- In `eventVisible` add `case 'reloaded': return seen(ev.at);`

`src/render/effects.ts`: no new Effect kind is needed; in `add`, after the `stab` branch add:

```ts
      } else if (e.type === 'reloaded') {
        this.list.push({ kind: 'flash', at: e.at, color: '120,200,255', start: now, dur: 250 });
```

(`flash` already draws with `fillRect`, which is what the test counts.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: R to reload, nine-button panel, ammo shown on the panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and end-to-end check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Read `README.md`. In the Controls table add a row `| R | Reload the selected soldier (15 AP, uses a spare clip) |`. In the campaign paragraph add: each gun has a magazine (pistol 8, rifle 5), every soldier starts with one spare clip (included in the price) and extra clips cost 5 credits (up to 4). Enemies follow the same rules. Keep the file's style.

- [ ] **Step 2: Full verification**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 3: Check it in the browser**

Start the dev server with `preview_start` (`laser-tribute`). In the page (`window.app` exists in dev):
1. Equipment screen: screenshot; the "Spare clips" line with `-` and `+` is under the grenades on each row and does not overlap the next row. Click `+` on a clip button via `app.click` and confirm the credits change by 5.
2. Start the mission. Screenshot the panel: nine buttons with the short labels, the weapon line `Rifle 5/5 +1  Grenades 1`, and `15 AP` under LOAD (grey when the magazine is full).
3. Via the console, set the selected soldier's `ammo` to 0 on `app.controller.state.units`, press `s` and click an enemy tile: the message is `Out of ammo`. Press `r`: the magazine refills and AP drops by 15.
Report what you saw. Stop the server with `preview_stop`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe ammo, clips and reloading

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** magazine sizes, reload cost, clip constants (Task 1); round per shot including reaction fire, `Out of ammo`, pickup full magazine (Task 1); `Reload` command with its rejections, `reloaded` event, alert ended (Task 2); AI reload and dry enemies (Task 2); loadout clips, pricing, validation, `applyLoadout`, `cheapLoadout`/`fitLoadout` (Task 3); equipment screen clip line and block reasons (Task 4); `R` key, RELOAD button, nine short labels, ammo text, red cost for unusable buttons, reload flash (Task 5); README and a browser check (Task 6). Deviations from the spec: the `reloaded` event also carries `at: Pos` (the effects layer has only events, so it needs the position); `actionBlocked` also marks snap and aimed red when the gun is empty (a small usability addition in line with "red when the soldier cannot use it").

**Placeholders:** none.

**Type consistency:** `Unit.ammo`/`clips`, `WeaponDef.magazine`, `CONFIG.reloadAp`/`spareClips`/`maxClips`, `SoldierLoadout.clips`, `LOADOUT.prices.clip`, `Reload` command and `reloaded` event (with `at`), `clipBlockReason`/`changeClips`, `EquipmentHit` kinds `clipMinus`/`clipPlus`, `ButtonId` `reload`, `actionBlocked` are used consistently across tasks.

**Review Focus coverage:** five-then-refused with no AP or round spent (Task 1), miss uses a round (Task 1), 14 vs 15 AP and full or no-clip rejections (Task 2), dry enemy and turn ends (Task 2), swapping cannot gain ammo (Task 1), cost 102 / +15 / range / budget (Task 3), nine buttons fit (Task 5).
