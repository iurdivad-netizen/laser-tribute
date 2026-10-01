# Laser Tribute Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable top-down, turn-based squad tactics mission (Laser Squad style) in the browser: 4 soldiers against 4 enemies on one fixed map with doors, pistols, rifles, grenades, item pickup and fog of war.

**Architecture:** A pure `core/` module holds all rules as plain-data state, validated commands and emitted events, with no browser or drawing code. A `render/` module draws a core state to a canvas, and `input/` plus a `controller.ts` turn mouse and keyboard into core commands. Rules are unit-tested with Vitest using a seeded random number generator; rendering and input are verified by playing in the browser.

**Tech Stack:** TypeScript (strict), HTML5 Canvas 2D, Vite, Vitest. Node 18 or newer.

**Spec:** `docs/superpowers/specs/2026-10-01-laser-tribute-milestone1-design.md`

## Global Constraints

- `core/` must not import anything from `render/`, `input/`, `controller.ts` or the DOM.
- Vite + TypeScript in strict mode + Vitest. `npm run dev` to play, `npm run build` for a static site.
- Top-down 2D, 16x16 tiles, low-resolution logical canvas scaled up with nearest-neighbour filtering.
- Commands: `Move`, `Turn`, `SnapShot`, `AimedShot`, `OpenDoor`, `CloseDoor`, `PickUp`, `Throw`, `EndTurn`. Commands are the only way to change state, and each returns events.
- Illegal commands are rejected with a reason and cause no state change.
- AP costs (starting values, all in one config module): move 4, diagonal 6, turn 45 degrees 1, door 2, pickup 3, snap shot about 25% of the AP pool, aimed shot more than snap, grenade throw about 40% of the pool.
- Weapons: pistol (low damage, cheap shots), rifle (more damage and range, better aimed shots), grenade (area damage, destroys doors).
- Walls and closed doors block sight and shots. Misses land near the target. Partial cover lowers hit chance.
- Fog of war: forward view cone, limited range, explored tiles remembered, unseen enemies hidden.
- Enemy AI uses the same commands and AP rules as a player: attack nearest visible soldier, otherwise advance to last seen position, otherwise patrol.
- Reaction fire is a rules setting, off by default.
- Win when all enemies are dead, lose when all soldiers are dead.
- Deterministic seeded random number generator in core.
- Git commit after every task. End every commit message with the `Co-Authored-By` trailer given in the session's attribution reminder.
- Do not push to GitHub without asking the user first. The remote is `https://github.com/iurdivad-netizen/laser-tribute`.
- Out of scope: equipment screen, soldier stats and promotion, saving and loading, sound, multiple missions, base and research layers, multiplayer.

### Decisions this plan makes where the spec left room

- Logical canvas is 480x360: a 30x20 map at 16px is 480x320, plus a 40px bottom panel. The spec's 320x200 was only an example.
- Text uses an 8px system monospace font. A bitmap pixel font is a later cosmetic task.
- Moving a unit sets its facing to the direction of travel at no extra AP. Only the explicit `Turn` command costs AP.
- A unit keeps unspent AP through the other side's turn (AP refills only at the start of its own side's turn). Reaction fire spends that leftover AP.
- Soldiers start with 50 HP, a 60 AP pool and one grenade. Enemies start with 40 HP, 60 AP and no grenades. Pistol damage 18, rifle 30, grenade 40.
- Shots are not blocked by other units standing in the line of fire. Grenade blasts hurt everyone in radius 1, including the thrower's own side.

## Review Focus

Inputs the spec implies but that no happy-path test exercises, most likely to bite first. Each has a test in the task that owns the code.

1. Moving onto a tile occupied by another unit must be rejected (Task 4).
2. Commands for a dead unit, an unknown unit, a unit on the wrong side's turn, or any command after the mission has ended must be rejected with no state change (Task 4).
3. A diagonal step that cuts a wall corner must be rejected (Task 4).
4. Shooting at a target that is out of range, behind a closed door, or on the shooter's own side must be rejected (Task 6).
5. An enemy turn where an enemy has no reachable goal (walled in) must terminate and hand the turn back to the player (Task 8).

## File Structure

```
index.html                     page shell with a #app element
package.json, tsconfig.json, vite.config.ts, .gitignore, README.md
src/
  main.ts                      creates canvas, wires state, controller, input, render loop
  controller.ts                holds state + UI state, runs commands, enemy turn stepper, messages
  core/
    types.ts                   all shared types (state, commands, events, results)
    config.ts                  AP costs, weapon table, tuning numbers, shared messages
    rng.ts                     seeded random number generator working on GameState
    geometry.ts                vectors, distances, facing math, tile and unit lookups
    mission.ts                 parseMap(): ASCII map to GameState
    mission1.ts                the Mission 1 map, patrols, createMission1()
    vision.ts                  line of sight, canSee, fog of war, explored and enemy memory
    movement.ts                stepBlockedReason(), stepCost()
    path.ts                    findPath(), pathCost()
    combat.ts                  hitChance, isCovered, fireShot, applyReactionFire
    apply.ts                   applyCommand(): validation, dispatch, game over check
    ai.ts                      aiNextCommand(), runEnemyTurn()
    actions/
      move.ts                  Move and Turn handlers
      endTurn.ts               EndTurn handler
      door.ts                  OpenDoor and CloseDoor handlers
      item.ts                  PickUp handler
      shoot.ts                 SnapShot and AimedShot handlers
      throw.ts                 Throw handler
  render/
    layout.ts                  canvas size constants, screenToTile()
    effects.ts                 transient animations driven by events
    panel.ts                   bottom panel, buttons, hit testing
    renderer.ts                draws map, fog, items, units, previews, effects, panel
  input/
    uiState.ts                 UiState type and factory
    input.ts                   DOM event wiring that calls Controller methods
tests/
  helpers.ts                   makeState, unit, seedForRoll, corridorRows, ok, reason
  *.test.ts                    one file per core module, plus layout, effects, controller
```

---

### Task 1: Project scaffold and GitHub remote

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm run dev`, `npm run build`, `npm test`, `npm run typecheck`; the `origin` remote configured.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "laser-tribute",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install -D vite typescript vitest`
Expected: `node_modules/` created and the three packages added to `devDependencies`.

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 4: Write vite.config.ts**

`base: './'` lets the built site work from any sub-path (for example GitHub Pages).

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: Write .gitignore, index.html, src/main.ts**

`.gitignore`:

```
node_modules
dist
*.log
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Laser Tribute</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; }
      #app { display: flex; justify-content: center; align-items: center; height: 100%; }
      canvas {
        image-rendering: pixelated;
        width: min(960px, 100vw, calc(100vh * 4 / 3));
        height: auto;
        background: #000;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts` (temporary, replaced in Task 10):

```ts
document.getElementById('app')!.textContent = 'laser-tribute';
```

- [ ] **Step 6: Write the smoke test and run the toolchain**

`tests/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 test passes.

Run: `npm run build`
Expected: type check passes and `dist/` is produced.

- [ ] **Step 7: Configure the remote and commit**

```bash
git remote add origin https://github.com/iurdivad-netizen/laser-tribute.git
git remote -v
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore index.html src tests docs
git commit -m "chore: scaffold Vite, TypeScript and Vitest project"
```

Expected: `git remote -v` lists `origin` for fetch and push. Do not push yet.

---

### Task 2: Core types, config, random numbers, geometry, map parser

**Files:**
- Create: `src/core/types.ts`, `src/core/config.ts`, `src/core/rng.ts`, `src/core/geometry.ts`, `src/core/mission.ts`
- Create: `tests/helpers.ts`, `tests/rng.test.ts`, `tests/geometry.test.ts`, `tests/mission.test.ts`
- Delete: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task):
  - Types in `types.ts`: `Side`, `Pos`, `Facing`, `TileKind`, `Tile`, `WeaponId`, `ItemKind`, `ShotMode`, `Unit`, `FloorItem`, `Settings`, `GameStatus`, `GameState`, `Command`, `GameEvent`, `Result`.
  - `CONFIG`, `WEAPONS`, `NOT_ENOUGH_AP` from `config.ts`.
  - `nextRandom(state: GameState): number` from `rng.ts`.
  - From `geometry.ts`: `FACING_VECTORS`, `NEIGHBORS_8`, `NEIGHBORS_4`, `posEq(a, b)`, `distance(a, b)`, `chebyshev(a, b)`, `facingFromDelta(dx, dy): Facing`, `turnSteps(from: Facing, to: Facing): number`, `inBounds(s, p)`, `tileAt(s, p): Tile`, `isBlocking(tile): boolean`, `unitAt(s, p): Unit | undefined`.
  - `parseMap(rows: string[], seed?: number): GameState` from `mission.ts`. Legend: `#` wall, `+` closed door, `.` floor, `P` player soldier (ids `p1`, `p2`, ... in reading order), `E` enemy (ids `e1`, `e2`, ...), `r` rifle, `p` pistol, `g` grenade on the floor (ids `i1`, `i2`, ...).
  - Test helpers: `makeState(rows)`, `unit(s, id)`, `seedForRoll(pred)`, `corridorRows(inner)`, `ok(result)`, `reason(result)`.

- [ ] **Step 1: Write the tests**

`tests/helpers.ts`:

```ts
import { nextRandom } from '../src/core/rng';
import { parseMap } from '../src/core/mission';
import type { GameEvent, GameState, Result, Unit } from '../src/core/types';

export function makeState(rows: string[]): GameState {
  return parseMap(rows);
}

export function unit(s: GameState, id: string): Unit {
  const u = s.units.find((x) => x.id === id);
  if (!u) throw new Error(`no unit ${id}`);
  return u;
}

/** Finds a seed whose first random number satisfies pred, so tests can force hits and misses. */
export function seedForRoll(pred: (n: number) => boolean): number {
  for (let seed = 1; seed < 100000; seed++) {
    const probe = { rngState: seed } as GameState;
    if (pred(nextRandom(probe))) return seed;
  }
  throw new Error('no seed found');
}

/** One-row map: corridorRows('P...E') gives ['#######', '#P...E#', '#######'] (unit row is y = 1). */
export function corridorRows(inner: string): string[] {
  const wall = '#'.repeat(inner.length + 2);
  return [wall, `#${inner}#`, wall];
}

export function ok(r: Result): { state: GameState; events: GameEvent[] } {
  if (!r.ok) throw new Error(`Expected success, got: ${r.reason}`);
  return r;
}

export function reason(r: Result): string {
  if (r.ok) throw new Error('Expected failure, got success');
  return r.reason;
}
```

`tests/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextRandom } from '../src/core/rng';
import type { GameState } from '../src/core/types';

const fresh = (seed: number) => ({ rngState: seed }) as GameState;

describe('nextRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = fresh(42);
    const b = fresh(42);
    const seqA = [nextRandom(a), nextRandom(a), nextRandom(a)];
    const seqB = [nextRandom(b), nextRandom(b), nextRandom(b)];
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(nextRandom(fresh(1))).not.toBe(nextRandom(fresh(2)));
  });

  it('stays in [0, 1)', () => {
    const s = fresh(7);
    for (let i = 0; i < 1000; i++) {
      const n = nextRandom(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
```

`tests/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chebyshev, distance, facingFromDelta, posEq, turnSteps } from '../src/core/geometry';

describe('geometry', () => {
  it('maps a movement delta to a facing', () => {
    expect(facingFromDelta(0, -1)).toBe(0);
    expect(facingFromDelta(1, -1)).toBe(1);
    expect(facingFromDelta(5, 0)).toBe(2);
    expect(facingFromDelta(1, 1)).toBe(3);
    expect(facingFromDelta(0, 3)).toBe(4);
    expect(facingFromDelta(-1, 1)).toBe(5);
    expect(facingFromDelta(-3, 0)).toBe(6);
    expect(facingFromDelta(-1, -1)).toBe(7);
  });

  it('counts the 45 degree steps needed to turn', () => {
    expect(turnSteps(0, 0)).toBe(0);
    expect(turnSteps(0, 1)).toBe(1);
    expect(turnSteps(0, 7)).toBe(1);
    expect(turnSteps(0, 2)).toBe(2);
    expect(turnSteps(0, 4)).toBe(4);
    expect(turnSteps(2, 6)).toBe(4);
    expect(turnSteps(1, 3)).toBe(2);
  });

  it('measures distances', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
    expect(posEq({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(posEq({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
  });
});
```

`tests/mission.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/core/mission';

describe('parseMap', () => {
  const rows = ['#####', '#P.E#', '#+r.#', '#####'];

  it('reads size, tiles and doors', () => {
    const s = parseMap(rows);
    expect(s.width).toBe(5);
    expect(s.height).toBe(4);
    expect(s.tiles[0][0].kind).toBe('wall');
    expect(s.tiles[1][1].kind).toBe('floor');
    expect(s.tiles[2][1]).toEqual({ kind: 'door', open: false });
  });

  it('creates units with default stats', () => {
    const s = parseMap(rows);
    const p1 = s.units.find((u) => u.id === 'p1')!;
    const e1 = s.units.find((u) => u.id === 'e1')!;
    expect(p1).toMatchObject({
      side: 'player', pos: { x: 1, y: 1 }, facing: 0, hp: 50, maxHp: 50,
      ap: 60, maxAp: 60, weapon: 'rifle', grenades: 1, alive: true,
    });
    expect(e1).toMatchObject({
      side: 'enemy', pos: { x: 3, y: 1 }, facing: 4, hp: 40, maxHp: 40,
      ap: 60, weapon: 'rifle', grenades: 0, alive: true,
    });
  });

  it('creates floor items', () => {
    const s = parseMap(rows);
    expect(s.items).toEqual([{ id: 'i1', pos: { x: 2, y: 2 }, kind: 'rifle' }]);
  });

  it('starts as a fresh game', () => {
    const s = parseMap(rows, 9);
    expect(s.turn).toBe('player');
    expect(s.turnNumber).toBe(1);
    expect(s.status).toBe('playing');
    expect(s.rngState).toBe(9);
    expect(s.settings.reactionFire).toBe(false);
    expect(s.enemyMemory).toBeNull();
    expect(s.explored.length).toBe(4);
    expect(s.explored[0].length).toBe(5);
  });

  it('rejects ragged rows', () => {
    expect(() => parseMap(['####', '###'])).toThrow(/wide/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/rng.test.ts tests/geometry.test.ts tests/mission.test.ts`
Expected: FAIL because `src/core/*` modules do not exist.

- [ ] **Step 3: Write the core types**

`src/core/types.ts`:

```ts
export type Side = 'player' | 'enemy';

export interface Pos {
  x: number;
  y: number;
}

/** 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TileKind = 'floor' | 'wall' | 'door';

export interface Tile {
  kind: TileKind;
  open: boolean; // only meaningful when kind === 'door'
}

export type WeaponId = 'pistol' | 'rifle';
export type ItemKind = WeaponId | 'grenade';
export type ShotMode = 'snap' | 'aimed';

export interface Unit {
  id: string;
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
  patrol: Pos[];
  patrolIndex: number;
}

export interface FloorItem {
  id: string;
  pos: Pos;
  kind: ItemKind;
}

export interface Settings {
  reactionFire: boolean;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  width: number;
  height: number;
  tiles: Tile[][]; // tiles[y][x]
  units: Unit[];
  items: FloorItem[];
  turn: Side;
  turnNumber: number;
  rngState: number;
  explored: boolean[][]; // explored[y][x], the player's map memory
  enemyMemory: Pos | null; // where the enemy side last saw a player unit
  settings: Settings;
  status: GameStatus;
}

export type Command =
  | { type: 'Move'; unitId: string; to: Pos }
  | { type: 'Turn'; unitId: string; facing: Facing }
  | { type: 'SnapShot'; unitId: string; targetId: string }
  | { type: 'AimedShot'; unitId: string; targetId: string }
  | { type: 'OpenDoor'; unitId: string; at: Pos }
  | { type: 'CloseDoor'; unitId: string; at: Pos }
  | { type: 'PickUp'; unitId: string; itemId: string }
  | { type: 'Throw'; unitId: string; at: Pos }
  | { type: 'EndTurn' };

export type GameEvent =
  | { type: 'moved'; unitId: string; from: Pos; to: Pos }
  | { type: 'turned'; unitId: string; facing: Facing }
  | {
      type: 'shot';
      unitId: string;
      targetId: string;
      mode: ShotMode;
      hit: boolean;
      damage: number;
      from: Pos;
      impact: Pos;
    }
  | { type: 'died'; unitId: string; at: Pos }
  | { type: 'doorChanged'; at: Pos; open: boolean }
  | { type: 'pickedUp'; unitId: string; itemId: string; kind: ItemKind }
  | {
      type: 'grenade';
      unitId: string;
      at: Pos;
      hits: { unitId: string; damage: number }[];
      doorsDestroyed: Pos[];
    }
  | { type: 'turnEnded'; side: Side }
  | { type: 'gameOver'; winner: Side };

export type Result =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: string };
```

- [ ] **Step 4: Write config, rng and geometry**

`src/core/config.ts`:

```ts
import type { WeaponId } from './types';

export const NOT_ENOUGH_AP = 'Not enough action points';

export const CONFIG = {
  tileSize: 16,
  soldierHp: 50,
  enemyHp: 40,
  soldierGrenades: 1,
  maxAp: 60,
  moveCost: 4,
  diagonalCost: 6,
  turnCostPer45: 1,
  doorCost: 2,
  pickupCost: 3,
  sightRange: 10,
  coverMultiplier: 0.6,
  grenade: { apCost: 24, range: 8, damage: 40, radius: 1 },
} as const;

export interface WeaponDef {
  name: string;
  damage: number;
  range: number;
  snapAp: number;
  aimedAp: number;
  snapAccuracy: number;
  aimedAccuracy: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    name: 'Pistol', damage: 18, range: 8,
    snapAp: 12, aimedAp: 24, snapAccuracy: 0.55, aimedAccuracy: 0.75,
  },
  rifle: {
    name: 'Rifle', damage: 30, range: 14,
    snapAp: 15, aimedAp: 30, snapAccuracy: 0.5, aimedAccuracy: 0.85,
  },
};
```

`src/core/rng.ts` (mulberry32; the generator state lives in `GameState.rngState`, so only call this on a state you own, such as the clone made by `applyCommand`):

```ts
import type { GameState } from './types';

export function nextRandom(state: GameState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

`src/core/geometry.ts`:

```ts
import type { Facing, GameState, Pos, Tile, Unit } from './types';

export const FACING_VECTORS: Record<Facing, Pos> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: -1 },
  2: { x: 1, y: 0 },
  3: { x: 1, y: 1 },
  4: { x: 0, y: 1 },
  5: { x: -1, y: 1 },
  6: { x: -1, y: 0 },
  7: { x: -1, y: -1 },
};

export const NEIGHBORS_8: Pos[] = Object.values(FACING_VECTORS);
export const NEIGHBORS_4: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function posEq(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function distance(a: Pos, b: Pos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function facingFromDelta(dx: number, dy: number): Facing {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (const f of [0, 1, 2, 3, 4, 5, 6, 7] as Facing[]) {
    const v = FACING_VECTORS[f];
    if (v.x === sx && v.y === sy) return f;
  }
  return 0;
}

export function turnSteps(from: Facing, to: Facing): number {
  const d = Math.abs(from - to) % 8;
  return Math.min(d, 8 - d);
}

export function inBounds(s: GameState, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;
}

export function tileAt(s: GameState, p: Pos): Tile {
  return s.tiles[p.y][p.x];
}

export function isBlocking(tile: Tile): boolean {
  return tile.kind === 'wall' || (tile.kind === 'door' && !tile.open);
}

export function unitAt(s: GameState, p: Pos): Unit | undefined {
  return s.units.find((u) => u.alive && posEq(u.pos, p));
}
```

- [ ] **Step 5: Write the map parser**

`src/core/mission.ts`:

```ts
import { CONFIG } from './config';
import type { FloorItem, GameState, ItemKind, Side, Tile, Unit, WeaponId } from './types';

const PLAYER_WEAPONS: WeaponId[] = ['rifle', 'rifle', 'pistol', 'pistol'];
const ENEMY_WEAPONS: WeaponId[] = ['rifle', 'pistol', 'rifle', 'pistol'];
const ITEM_CHARS: Record<string, ItemKind> = { r: 'rifle', p: 'pistol', g: 'grenade' };

function makeUnit(id: string, side: Side, x: number, y: number, weapon: WeaponId): Unit {
  const hp = side === 'player' ? CONFIG.soldierHp : CONFIG.enemyHp;
  return {
    id,
    side,
    pos: { x, y },
    facing: side === 'player' ? 0 : 4,
    hp,
    maxHp: hp,
    ap: CONFIG.maxAp,
    maxAp: CONFIG.maxAp,
    weapon,
    grenades: side === 'player' ? CONFIG.soldierGrenades : 0,
    alive: true,
    patrol: [],
    patrolIndex: 0,
  };
}

export function parseMap(rows: string[], seed = 1): GameState {
  const height = rows.length;
  const width = rows[0].length;
  const tiles: Tile[][] = [];
  const units: Unit[] = [];
  const items: FloorItem[] = [];
  let players = 0;
  let enemies = 0;

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Row ${y} is ${row.length} wide, expected ${width}`);
    }
    const line: Tile[] = [];
    [...row].forEach((ch, x) => {
      if (ch === '#') {
        line.push({ kind: 'wall', open: false });
        return;
      }
      line.push({ kind: ch === '+' ? 'door' : 'floor', open: false });
      if (ch === 'P') {
        players += 1;
        units.push(makeUnit(`p${players}`, 'player', x, y, PLAYER_WEAPONS[(players - 1) % 4]));
      } else if (ch === 'E') {
        enemies += 1;
        units.push(makeUnit(`e${enemies}`, 'enemy', x, y, ENEMY_WEAPONS[(enemies - 1) % 4]));
      } else if (ch in ITEM_CHARS) {
        items.push({ id: `i${items.length + 1}`, pos: { x, y }, kind: ITEM_CHARS[ch] });
      }
    });
    tiles.push(line);
  });

  return {
    width,
    height,
    tiles,
    units,
    items,
    turn: 'player',
    turnNumber: 1,
    rngState: seed,
    explored: Array.from({ length: height }, () => Array<boolean>(width).fill(false)),
    enemyMemory: null,
    settings: { reactionFire: false },
    status: 'playing',
  };
}
```

- [ ] **Step 6: Delete the smoke test and run the tests**

```bash
git rm -f tests/smoke.test.ts
npx vitest run
npx tsc --noEmit
```

Expected: all rng, geometry and mission tests PASS and the type check is clean.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(core): add types, config, rng, geometry and map parser"
```

---

### Task 3: Vision (line of sight, fog of war) and the Mission 1 map

**Files:**
- Create: `src/core/vision.ts`, `src/core/mission1.ts`
- Test: `tests/vision.test.ts`, `tests/mission1.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Unit`, `Pos`, `Side` (types); `CONFIG`; `FACING_VECTORS`, `chebyshev`, `distance`, `inBounds`, `isBlocking`, `posEq`, `tileAt` (geometry); `parseMap`.
- Produces:
  - `lineTiles(a: Pos, b: Pos): Pos[]` (Bresenham line, both ends included)
  - `hasLineOfSight(s: GameState, from: Pos, to: Pos): boolean` (intermediate tiles must not be walls or closed doors; the end tile may be anything)
  - `canSee(s: GameState, unit: Unit, pos: Pos): boolean` (alive; adjacent tiles always visible; otherwise within `sightRange`, in the forward half-plane, with line of sight)
  - `visibleToSide(s: GameState, side: Side, pos: Pos): boolean`
  - `computeVisible(s: GameState, side: Side): boolean[][]` (indexed `[y][x]`)
  - `updateExplored(s: GameState): void` (mutates `s.explored` from player vision)
  - `updateEnemyMemory(s: GameState): void` (mutates `s.enemyMemory`)
  - `createMission1(seed?: number): GameState`

- [ ] **Step 1: Write the vision tests**

`tests/vision.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canSee, computeVisible, hasLineOfSight, updateEnemyMemory, updateExplored, visibleToSide,
} from '../src/core/vision';
import { corridorRows, makeState, unit } from './helpers';

describe('hasLineOfSight', () => {
  it('is clear along an open corridor', () => {
    const s = makeState(corridorRows('P...E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(true);
  });

  it('is blocked by a wall', () => {
    const s = makeState(corridorRows('P.#.E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
  });

  it('is blocked by a closed door and clear once it is open', () => {
    const s = makeState(corridorRows('P.+.E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
    s.tiles[1][3].open = true;
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(true);
  });

  it('can see the blocking wall itself', () => {
    const s = makeState(corridorRows('P.#.E'));
    expect(hasLineOfSight(s, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });
});

describe('canSee', () => {
  const room = ['#####', '#...#', '#.P.#', '#...#', '#.E.#', '#####'];

  it('does not see behind itself', () => {
    const s = makeState(room); // p1 at (2,2) faces north, e1 at (2,4) is behind
    expect(canSee(s, unit(s, 'p1'), { x: 2, y: 4 })).toBe(false);
  });

  it('sees in front once turned', () => {
    const s = makeState(room);
    unit(s, 'p1').facing = 4;
    expect(canSee(s, unit(s, 'p1'), { x: 2, y: 4 })).toBe(true);
  });

  it('always notices adjacent tiles, even behind', () => {
    const s = makeState(['#####', '#.P.#', '#.E.#', '#####']);
    expect(canSee(s, unit(s, 'p1'), { x: 2, y: 2 })).toBe(true);
  });

  it('respects the sight range', () => {
    const far = makeState(corridorRows(`P${'.'.repeat(11)}E`)); // e1 at distance 12
    unit(far, 'p1').facing = 2;
    expect(canSee(far, unit(far, 'p1'), unit(far, 'e1').pos)).toBe(false);
    const near = makeState(corridorRows(`P${'.'.repeat(8)}E`)); // e1 at distance 9
    unit(near, 'p1').facing = 2;
    expect(canSee(near, unit(near, 'p1'), unit(near, 'e1').pos)).toBe(true);
  });

  it('dead units see nothing', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').alive = false;
    expect(canSee(s, unit(s, 'p1'), { x: 5, y: 1 })).toBe(false);
  });
});

describe('side visibility and fog of war', () => {
  it('reports whether any unit of a side sees a tile', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').facing = 2; // e1 faces away, so it cannot see p1 behind it
    expect(visibleToSide(s, 'player', { x: 5, y: 1 })).toBe(true);
    expect(visibleToSide(s, 'enemy', { x: 1, y: 1 })).toBe(false);
  });

  it('computes a visibility grid indexed [y][x]', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    const vis = computeVisible(s, 'player');
    expect(vis[1][1]).toBe(true);
    expect(vis[1][5]).toBe(true);
  });

  it('remembers explored tiles after they leave view', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').facing = 2;
    updateExplored(s);
    expect(s.explored[1][5]).toBe(true);
    unit(s, 'p1').facing = 6;
    updateExplored(s);
    expect(s.explored[1][5]).toBe(true);
  });
});

describe('updateEnemyMemory', () => {
  it('remembers where a soldier was last seen', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'e1').facing = 6;
    updateEnemyMemory(s);
    expect(s.enemyMemory).toEqual({ x: 1, y: 1 });
  });

  it('stays empty when no soldier has been seen', () => {
    const s = makeState(corridorRows('P.#.E'));
    unit(s, 'e1').facing = 6;
    updateEnemyMemory(s);
    expect(s.enemyMemory).toBeNull();
  });

  it('forgets a remembered spot once an enemy stands on it', () => {
    const s = makeState(corridorRows('P.#.E'));
    s.enemyMemory = { x: 5, y: 1 }; // e1 is standing there
    updateEnemyMemory(s);
    expect(s.enemyMemory).toBeNull();
  });
});
```

`tests/mission1.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMission1 } from '../src/core/mission1';

describe('createMission1', () => {
  const s = createMission1();

  it('has the expected size and cast', () => {
    expect(s.width).toBe(30);
    expect(s.height).toBe(20);
    expect(s.units.filter((u) => u.side === 'player')).toHaveLength(4);
    expect(s.units.filter((u) => u.side === 'enemy')).toHaveLength(4);
    expect(s.items).toHaveLength(3);
  });

  it('places every unit and item on a walkable tile', () => {
    for (const u of s.units) expect(s.tiles[u.pos.y][u.pos.x].kind).not.toBe('wall');
    for (const i of s.items) expect(s.tiles[i.pos.y][i.pos.x].kind).not.toBe('wall');
  });

  it('gives every enemy a walkable patrol route', () => {
    for (const e of s.units.filter((u) => u.side === 'enemy')) {
      expect(e.patrol.length).toBeGreaterThan(0);
      for (const p of e.patrol) expect(s.tiles[p.y][p.x].kind).toBe('floor');
    }
  });

  it('starts with the squad area explored', () => {
    expect(s.explored[17][2]).toBe(true);
    expect(s.explored[2][19]).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/vision.test.ts tests/mission1.test.ts`
Expected: FAIL because `vision` and `mission1` do not exist.

- [ ] **Step 3: Write vision.ts**

`src/core/vision.ts`:

```ts
import { CONFIG } from './config';
import {
  FACING_VECTORS, chebyshev, distance, inBounds, isBlocking, posEq, tileAt,
} from './geometry';
import type { GameState, Pos, Side, Unit } from './types';

export function lineTiles(a: Pos, b: Pos): Pos[] {
  const out: Pos[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

export function hasLineOfSight(s: GameState, from: Pos, to: Pos): boolean {
  const tiles = lineTiles(from, to);
  for (let i = 1; i < tiles.length - 1; i++) {
    if (isBlocking(tileAt(s, tiles[i]))) return false;
  }
  return true;
}

export function canSee(s: GameState, unit: Unit, pos: Pos): boolean {
  if (!unit.alive) return false;
  if (chebyshev(unit.pos, pos) <= 1) return true;
  if (distance(unit.pos, pos) > CONFIG.sightRange) return false;
  const f = FACING_VECTORS[unit.facing];
  const dot = (pos.x - unit.pos.x) * f.x + (pos.y - unit.pos.y) * f.y;
  if (dot < 0) return false;
  return hasLineOfSight(s, unit.pos, pos);
}

export function visibleToSide(s: GameState, side: Side, pos: Pos): boolean {
  return s.units.some((u) => u.alive && u.side === side && canSee(s, u, pos));
}

export function computeVisible(s: GameState, side: Side): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < s.height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < s.width; x++) row.push(visibleToSide(s, side, { x, y }));
    grid.push(row);
  }
  return grid;
}

export function updateExplored(s: GameState): void {
  const vis = computeVisible(s, 'player');
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (vis[y][x] && inBounds(s, { x, y })) s.explored[y][x] = true;
    }
  }
}

export function updateEnemyMemory(s: GameState): void {
  const seen = s.units.find(
    (u) => u.alive && u.side === 'player' && visibleToSide(s, 'enemy', u.pos),
  );
  if (seen) {
    s.enemyMemory = { ...seen.pos };
    return;
  }
  const memory = s.enemyMemory;
  if (memory && s.units.some((u) => u.alive && u.side === 'enemy' && posEq(u.pos, memory))) {
    s.enemyMemory = null;
  }
}
```

- [ ] **Step 4: Write mission1.ts**

`src/core/mission1.ts`:

```ts
import { parseMap } from './mission';
import type { GameState, Pos } from './types';
import { updateExplored } from './vision';

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

/** Patrol routes by enemy id. Each unit heads for patrol[patrolIndex], then the next point. */
const PATROLS: Record<string, Pos[]> = {
  e1: [{ x: 19, y: 5 }, { x: 19, y: 2 }],
  e2: [{ x: 25, y: 5 }, { x: 25, y: 2 }],
  e3: [{ x: 20, y: 9 }, { x: 23, y: 9 }],
  e4: [{ x: 10, y: 15 }, { x: 24, y: 15 }],
};

export function createMission1(seed = 1): GameState {
  const s = parseMap(MISSION1_ROWS, seed);
  for (const u of s.units) {
    if (PATROLS[u.id]) u.patrol = PATROLS[u.id].map((p) => ({ ...p }));
  }
  updateExplored(s);
  return s;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: all PASS. If the Mission 1 size test fails, a map row is not 30 characters wide; fix the row.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(core): add vision, fog of war and the Mission 1 map"
```

---

### Task 4: applyCommand with Move, Turn and EndTurn

**Files:**
- Create: `src/core/movement.ts`, `src/core/apply.ts`, `src/core/actions/move.ts`, `src/core/actions/endTurn.ts`
- Test: `tests/move.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 and 3.
- Produces:
  - `stepBlockedReason(s: GameState, from: Pos, to: Pos, ignoreUnits?: boolean): string | null` (null means the step is allowed; `ignoreUnits` skips only the occupancy check)
  - `stepCost(from: Pos, to: Pos): number` (4 orthogonal, 6 diagonal)
  - `applyCommand(state: GameState, cmd: Command): Result` (pure: clones the state, never mutates the input). Unsupported command types return `{ok:false, reason:'Unsupported command'}` until later tasks add them.
  - `handleMove`, `handleTurn`, `handleEndTurn` (internal handlers, signature `(s, cmd, unit, events) => string | null`; `handleEndTurn(s, events)`)
  - Move changes: AP cost, facing set to the direction of travel, `patrolIndex` advances when a unit reaches its current patrol point.
  - After every successful command: game-over check, `updateExplored`, `updateEnemyMemory`.

- [ ] **Step 1: Write the tests**

`tests/move.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

const open = ['#######', '#P....#', '#....E#', '#######'];

describe('Move', () => {
  it('moves one tile, spends AP and faces the direction of travel', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(unit(r.state, 'p1').pos).toEqual({ x: 2, y: 1 });
    expect(unit(r.state, 'p1').ap).toBe(56);
    expect(unit(r.state, 'p1').facing).toBe(2);
    expect(r.events).toEqual([
      { type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ]);
  });

  it('charges more for a diagonal step', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }));
    expect(unit(r.state, 'p1').ap).toBe(54);
    expect(unit(r.state, 'p1').facing).toBe(3);
  });

  it('does not mutate the input state', () => {
    const s = makeState(open);
    applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } });
    expect(unit(s, 'p1').pos).toEqual({ x: 1, y: 1 });
    expect(unit(s, 'p1').ap).toBe(60);
  });

  it('rejects a move without enough AP and changes nothing', () => {
    const s = makeState(open);
    unit(s, 'p1').ap = 3;
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /action points/,
    );
  });

  it('rejects moving more than one tile at a time', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 3, y: 1 } }))).toMatch(
      /one tile/,
    );
  });

  it('rejects walking into a wall', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 0, y: 1 } }))).toMatch(
      /wall/,
    );
  });

  it('rejects walking through a closed door', () => {
    const s = makeState(corridorRows('P+..E'));
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /door/,
    );
  });

  it('rejects moving onto a tile occupied by another unit', () => {
    const s = makeState(corridorRows('PE..'));
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /occupied/,
    );
  });

  it('allows moving onto the tile of a dead unit', () => {
    const s = makeState(corridorRows('PE..'));
    unit(s, 'e1').alive = false;
    ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
  });

  it('rejects a diagonal step that cuts a wall corner', () => {
    const s = makeState(['####', '#P.#', '##.#', '####']);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }))).toMatch(
      /corner/,
    );
  });

  it('advances the patrol index on reaching the patrol point', () => {
    const s = makeState(corridorRows('P...E'));
    s.turn = 'enemy';
    const e = unit(s, 'e1');
    e.patrol = [{ x: 4, y: 1 }, { x: 5, y: 1 }];
    e.patrolIndex = 0;
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'e1', to: { x: 4, y: 1 } }));
    expect(unit(r.state, 'e1').patrolIndex).toBe(1);
  });
});

describe('command validation', () => {
  it('rejects an unknown unit', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'zz', to: { x: 2, y: 1 } }))).toMatch(
      /Unknown/,
    );
  });

  it('rejects a dead unit', () => {
    const s = makeState(open);
    unit(s, 'p1').alive = false;
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }))).toMatch(
      /dead/,
    );
  });

  it("rejects a command for the other side's unit", () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Turn', unitId: 'e1', facing: 0 }))).toMatch(/turn/);
  });

  it('rejects any command once the mission is over', () => {
    const s = makeState(open);
    s.status = 'won';
    expect(reason(applyCommand(s, { type: 'EndTurn' }))).toMatch(/over/);
  });

  it('rejects commands the build does not support yet without changing state', () => {
    const s = makeState(open);
    const r = applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } });
    expect(r.ok).toBe(false);
  });
});

describe('Turn', () => {
  it('costs 1 AP per 45 degrees', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 2 }));
    expect(unit(r.state, 'p1').facing).toBe(2);
    expect(unit(r.state, 'p1').ap).toBe(58);
    expect(r.events).toEqual([{ type: 'turned', unitId: 'p1', facing: 2 }]);
  });

  it('takes the short way round', () => {
    const s = makeState(open);
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 7 }));
    expect(unit(r.state, 'p1').ap).toBe(59);
  });

  it('rejects turning to the current facing', () => {
    const s = makeState(open);
    expect(reason(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 0 }))).toMatch(/already/i);
  });

  it('rejects a turn without enough AP', () => {
    const s = makeState(open);
    unit(s, 'p1').ap = 1;
    expect(reason(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 4 }))).toMatch(
      /action points/,
    );
  });
});

describe('EndTurn', () => {
  it('hands the turn over and refills the new side only', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'e1').ap = 5;
    unit(s, 'p1').ap = 7;
    const r1 = ok(applyCommand(s, { type: 'EndTurn' }));
    expect(r1.state.turn).toBe('enemy');
    expect(unit(r1.state, 'e1').ap).toBe(60);
    expect(unit(r1.state, 'p1').ap).toBe(7);
    expect(r1.events).toEqual([{ type: 'turnEnded', side: 'player' }]);

    const r2 = ok(applyCommand(r1.state, { type: 'EndTurn' }));
    expect(r2.state.turn).toBe('player');
    expect(r2.state.turnNumber).toBe(2);
    expect(unit(r2.state, 'p1').ap).toBe(60);
  });
});

describe('game over', () => {
  it('declares a win when no enemy is left', () => {
    const s = makeState(corridorRows('P..')); // no enemies at all
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'p1', facing: 2 }));
    expect(r.state.status).toBe('won');
    expect(r.events).toContainEqual({ type: 'gameOver', winner: 'player' });
  });

  it('declares a loss when no soldier is left', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').alive = false;
    s.turn = 'enemy';
    const r = ok(applyCommand(s, { type: 'Turn', unitId: 'e1', facing: 6 }));
    expect(r.state.status).toBe('lost');
    expect(r.events).toContainEqual({ type: 'gameOver', winner: 'enemy' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/move.test.ts`
Expected: FAIL because `apply` does not exist.

- [ ] **Step 3: Write movement.ts**

`src/core/movement.ts`:

```ts
import { CONFIG } from './config';
import { inBounds, isBlocking, tileAt, unitAt } from './geometry';
import type { GameState, Pos } from './types';

/** Returns why a single step from `from` to the adjacent tile `to` is illegal, or null if it is legal. */
export function stepBlockedReason(
  s: GameState,
  from: Pos,
  to: Pos,
  ignoreUnits = false,
): string | null {
  if (!inBounds(s, to)) return 'That tile is off the map';
  const tile = tileAt(s, to);
  if (tile.kind === 'wall') return 'A wall blocks the way';
  if (tile.kind === 'door' && !tile.open) return 'The door is closed';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0) {
    const sideA = tileAt(s, { x: to.x, y: from.y });
    const sideB = tileAt(s, { x: from.x, y: to.y });
    if (isBlocking(sideA) || isBlocking(sideB)) return 'Cannot cut a corner';
  }
  if (!ignoreUnits && unitAt(s, to)) return 'That tile is occupied';
  return null;
}

export function stepCost(from: Pos, to: Pos): number {
  return from.x !== to.x && from.y !== to.y ? CONFIG.diagonalCost : CONFIG.moveCost;
}
```

- [ ] **Step 4: Write the Move, Turn and EndTurn handlers**

`src/core/actions/move.ts`:

```ts
import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev, facingFromDelta, posEq, turnSteps } from '../geometry';
import { stepBlockedReason, stepCost } from '../movement';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handleMove(
  s: GameState,
  cmd: Extract<Command, { type: 'Move' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const from = { ...unit.pos };
  const to = cmd.to;
  if (chebyshev(from, to) !== 1) return 'Move one tile at a time';
  const blocked = stepBlockedReason(s, from, to);
  if (blocked) return blocked;
  const cost = stepCost(from, to);
  if (unit.ap < cost) return NOT_ENOUGH_AP;

  unit.ap -= cost;
  unit.pos = { ...to };
  unit.facing = facingFromDelta(to.x - from.x, to.y - from.y);
  events.push({ type: 'moved', unitId: unit.id, from, to: { ...to } });

  if (unit.patrol.length > 0 && posEq(unit.pos, unit.patrol[unit.patrolIndex])) {
    unit.patrolIndex = (unit.patrolIndex + 1) % unit.patrol.length;
  }
  return null;
}

export function handleTurn(
  _s: GameState,
  cmd: Extract<Command, { type: 'Turn' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const steps = turnSteps(unit.facing, cmd.facing);
  if (steps === 0) return 'Already facing that way';
  const cost = steps * CONFIG.turnCostPer45;
  if (unit.ap < cost) return NOT_ENOUGH_AP;
  unit.ap -= cost;
  unit.facing = cmd.facing;
  events.push({ type: 'turned', unitId: unit.id, facing: cmd.facing });
  return null;
}
```

`src/core/actions/endTurn.ts`:

```ts
import type { GameEvent, GameState, Side } from '../types';

export function handleEndTurn(s: GameState, events: GameEvent[]): string | null {
  const next: Side = s.turn === 'player' ? 'enemy' : 'player';
  events.push({ type: 'turnEnded', side: s.turn });
  s.turn = next;
  if (next === 'player') s.turnNumber += 1;
  for (const u of s.units) {
    if (u.alive && u.side === next) u.ap = u.maxAp;
  }
  return null;
}
```

- [ ] **Step 5: Write apply.ts**

`src/core/apply.ts`:

```ts
import { handleEndTurn } from './actions/endTurn';
import { handleMove, handleTurn } from './actions/move';
import type { Command, GameEvent, GameState, Result, Unit } from './types';
import { updateEnemyMemory, updateExplored } from './vision';

type UnitCommand = Exclude<Command, { type: 'EndTurn' }>;

const fail = (reason: string): Result => ({ ok: false, reason });

export function applyCommand(state: GameState, cmd: Command): Result {
  if (state.status !== 'playing') return fail('The mission is over');
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  let error: string | null;

  if (cmd.type === 'EndTurn') {
    error = handleEndTurn(s, events);
  } else {
    const unit = s.units.find((u) => u.id === cmd.unitId);
    if (!unit) return fail('Unknown unit');
    if (!unit.alive) return fail('That unit is dead');
    if (unit.side !== s.turn) return fail("It is not that unit's turn");
    error = dispatch(s, cmd, unit, events);
  }

  if (error) return fail(error);
  checkGameOver(s, events);
  updateExplored(s);
  updateEnemyMemory(s);
  return { ok: true, state: s, events };
}

function dispatch(s: GameState, cmd: UnitCommand, unit: Unit, events: GameEvent[]): string | null {
  switch (cmd.type) {
    case 'Move':
      return handleMove(s, cmd, unit, events);
    case 'Turn':
      return handleTurn(s, cmd, unit, events);
    default:
      return 'Unsupported command';
  }
}

function checkGameOver(s: GameState, events: GameEvent[]): void {
  if (s.status !== 'playing') return;
  const enemiesAlive = s.units.some((u) => u.side === 'enemy' && u.alive);
  const playersAlive = s.units.some((u) => u.side === 'player' && u.alive);
  if (!enemiesAlive) {
    s.status = 'won';
    events.push({ type: 'gameOver', winner: 'player' });
  } else if (!playersAlive) {
    s.status = 'lost';
    events.push({ type: 'gameOver', winner: 'enemy' });
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(core): add applyCommand with Move, Turn, EndTurn and game over"
```

---

### Task 5: Doors and item pickup

**Files:**
- Create: `src/core/actions/door.ts`, `src/core/actions/item.ts`
- Modify: `src/core/apply.ts` (add cases to `dispatch`)
- Test: `tests/doors-items.test.ts`

**Interfaces:**
- Consumes: `applyCommand` and `NOT_ENOUGH_AP`, `CONFIG`, `WEAPONS`, geometry helpers.
- Produces: working `OpenDoor`, `CloseDoor` (2 AP, adjacent tile or own tile, rejected if something stands in the doorway when closing) and `PickUp` (3 AP; grenades add to the unit's count; a rifle or pistol swaps with the carried weapon, leaving the old weapon on the floor with the same item id; picking up the weapon already carried is rejected). Events `doorChanged` and `pickedUp`.

- [ ] **Step 1: Write the tests**

`tests/doors-items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

describe('doors', () => {
  const rows = ['#####', '#P+.#', '#..E#', '#####'];

  it('opens an adjacent door for 2 AP', () => {
    const s = makeState(rows);
    const r = ok(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 2, y: 1 } }));
    expect(r.state.tiles[1][2].open).toBe(true);
    expect(unit(r.state, 'p1').ap).toBe(58);
    expect(r.events).toEqual([{ type: 'doorChanged', at: { x: 2, y: 1 }, open: true }]);
  });

  it('closes an open door', () => {
    const s = makeState(rows);
    s.tiles[1][2].open = true;
    const r = ok(applyCommand(s, { type: 'CloseDoor', unitId: 'p1', at: { x: 2, y: 1 } }));
    expect(r.state.tiles[1][2].open).toBe(false);
  });

  it('rejects opening a door that is already open', () => {
    const s = makeState(rows);
    s.tiles[1][2].open = true;
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 2, y: 1 } }))).toMatch(
      /already open/,
    );
  });

  it('rejects a door that is not adjacent', () => {
    const s = makeState(corridorRows('P..+.E'));
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 4, y: 1 } }))).toMatch(
      /adjacent/,
    );
  });

  it('rejects a tile that is not a door', () => {
    const s = makeState(rows);
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 1, y: 2 } }))).toMatch(
      /not a door/,
    );
  });

  it('rejects closing a door with a unit standing in it', () => {
    const s = makeState(rows);
    s.tiles[1][2].open = true;
    const moved = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(
      reason(applyCommand(moved.state, { type: 'CloseDoor', unitId: 'p1', at: { x: 2, y: 1 } })),
    ).toMatch(/doorway/);
  });

  it('rejects opening a door without enough AP', () => {
    const s = makeState(rows);
    unit(s, 'p1').ap = 1;
    expect(reason(applyCommand(s, { type: 'OpenDoor', unitId: 'p1', at: { x: 2, y: 1 } }))).toMatch(
      /action points/,
    );
  });
});

describe('pickup', () => {
  const rows = corridorRows('P...E');
  const itemAt = (s: ReturnType<typeof makeState>, kind: 'rifle' | 'pistol' | 'grenade', x = 1) =>
    s.items.push({ id: 'i9', pos: { x, y: 1 }, kind });

  it('swaps weapons and leaves the old one on the floor', () => {
    const s = makeState(rows);
    unit(s, 'p1').weapon = 'pistol';
    itemAt(s, 'rifle');
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }));
    expect(unit(r.state, 'p1').weapon).toBe('rifle');
    expect(r.state.items).toEqual([{ id: 'i9', pos: { x: 1, y: 1 }, kind: 'pistol' }]);
    expect(unit(r.state, 'p1').ap).toBe(57);
    expect(r.events).toEqual([{ type: 'pickedUp', unitId: 'p1', itemId: 'i9', kind: 'rifle' }]);
  });

  it('adds a grenade and removes the item', () => {
    const s = makeState(rows);
    itemAt(s, 'grenade');
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }));
    expect(unit(r.state, 'p1').grenades).toBe(2);
    expect(r.state.items).toEqual([]);
  });

  it('rejects an item on another tile', () => {
    const s = makeState(rows);
    itemAt(s, 'grenade', 3);
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }))).toMatch(/here/);
  });

  it('rejects an unknown item', () => {
    const s = makeState(rows);
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'nope' }))).toMatch(
      /No such item/,
    );
  });

  it('rejects picking up the weapon already carried', () => {
    const s = makeState(rows);
    itemAt(s, 'rifle'); // p1 already carries a rifle
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }))).toMatch(
      /Already carrying/,
    );
  });

  it('rejects a pickup without enough AP', () => {
    const s = makeState(rows);
    itemAt(s, 'grenade');
    unit(s, 'p1').ap = 2;
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'i9' }))).toMatch(
      /action points/,
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/doors-items.test.ts`
Expected: FAIL with `Unsupported command`.

- [ ] **Step 3: Write the door and item handlers**

`src/core/actions/door.ts`:

```ts
import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev, inBounds, tileAt, unitAt } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handleDoor(
  s: GameState,
  cmd: Extract<Command, { type: 'OpenDoor' | 'CloseDoor' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  if (!inBounds(s, cmd.at)) return 'That tile is off the map';
  if (chebyshev(unit.pos, cmd.at) > 1) return 'The door is not adjacent';
  const tile = tileAt(s, cmd.at);
  if (tile.kind !== 'door') return 'That is not a door';
  const opening = cmd.type === 'OpenDoor';
  if (tile.open === opening) return opening ? 'The door is already open' : 'The door is already closed';
  if (!opening && unitAt(s, cmd.at)) return 'Something is in the doorway';
  if (unit.ap < CONFIG.doorCost) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.doorCost;
  tile.open = opening;
  events.push({ type: 'doorChanged', at: { ...cmd.at }, open: opening });
  return null;
}
```

`src/core/actions/item.ts`:

```ts
import { CONFIG, NOT_ENOUGH_AP, WEAPONS } from '../config';
import { posEq } from '../geometry';
import type { Command, GameEvent, GameState, Unit } from '../types';

export function handlePickUp(
  s: GameState,
  cmd: Extract<Command, { type: 'PickUp' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const item = s.items.find((i) => i.id === cmd.itemId);
  if (!item) return 'No such item';
  if (!posEq(item.pos, unit.pos)) return 'The item is not here';
  if (item.kind === unit.weapon) return `Already carrying a ${WEAPONS[unit.weapon].name}`;
  if (unit.ap < CONFIG.pickupCost) return NOT_ENOUGH_AP;

  unit.ap -= CONFIG.pickupCost;
  const picked = item.kind;
  if (item.kind === 'grenade') {
    unit.grenades += 1;
    s.items = s.items.filter((i) => i !== item);
  } else {
    const old = unit.weapon;
    unit.weapon = item.kind;
    item.kind = old;
  }
  events.push({ type: 'pickedUp', unitId: unit.id, itemId: item.id, kind: picked });
  return null;
}
```

- [ ] **Step 4: Add the cases to dispatch in apply.ts**

Add the imports at the top of `src/core/apply.ts`:

```ts
import { handleDoor } from './actions/door';
import { handlePickUp } from './actions/item';
```

Add these cases before `default` in `dispatch`:

```ts
    case 'OpenDoor':
    case 'CloseDoor':
      return handleDoor(s, cmd, unit, events);
    case 'PickUp':
      return handlePickUp(s, cmd, unit, events);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(core): add doors and item pickup"
```

---

### Task 6: Combat (shots, grenades, cover, reaction fire)

**Files:**
- Create: `src/core/combat.ts`, `src/core/actions/shoot.ts`, `src/core/actions/throw.ts`
- Modify: `src/core/apply.ts` (add cases), `src/core/actions/move.ts` (reaction fire after a move)
- Test: `tests/combat.test.ts`

**Interfaces:**
- Consumes: `nextRandom`, `WEAPONS`, `CONFIG`, geometry helpers, `canSee`, `hasLineOfSight`, `applyCommand`.
- Produces:
  - `isCovered(s: GameState, shooter: Pos, target: Pos): boolean` (true when the target stands on an open door tile, or has an orthogonally adjacent wall that is strictly closer to the shooter than the target is)
  - `hitChance(s: GameState, shooter: Unit, target: Unit, mode: ShotMode): number` = `accuracy * (1 - 0.5 * distance / range) * (covered ? 0.6 : 1)`
  - `fireShot(s: GameState, shooter: Unit, target: Unit, mode: ShotMode, events: GameEvent[]): void` (rolls the dice, applies damage, emits `shot` and `died`)
  - `applyReactionFire(s: GameState, mover: Unit, events: GameEvent[]): void` (each opposing unit that can see the mover and has AP for a snap shot fires one; runs after each `Move` only when `s.settings.reactionFire` is true)
  - `SnapShot`, `AimedShot` (rejects: unknown or dead target, same side, not enough AP, out of range, not visible) and `Throw` (rejects: no grenades, not enough AP, off map, out of range, wall, blocked path) commands. Blast: radius 1 (Chebyshev), 40 damage to every living unit with line of sight to the target tile, doors in radius become floor.

- [ ] **Step 1: Write the tests**

`tests/combat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { hitChance, isCovered } from '../src/core/combat';
import { corridorRows, makeState, ok, reason, seedForRoll, unit } from './helpers';

const HIT = () => seedForRoll((n) => n < 0.05);
const MISS = () => seedForRoll((n) => n >= 0.96);

describe('isCovered', () => {
  it('is covered with a wall beside the target nearer the shooter', () => {
    const s = makeState(['#######', '#P.#E.#', '#######']);
    expect(isCovered(s, { x: 1, y: 1 }, { x: 4, y: 1 })).toBe(true);
  });

  it('is not covered in the open', () => {
    const s = makeState(['#######', '#P...E#', '#######']);
    expect(isCovered(s, { x: 1, y: 1 }, { x: 5, y: 1 })).toBe(false);
  });

  it('is covered when standing in an open doorway', () => {
    const s = makeState(corridorRows('P.+E'));
    s.tiles[1][3].open = true;
    expect(isCovered(s, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });
});

describe('hitChance', () => {
  it('uses accuracy, distance and cover', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(6) + 'E')); // distance 7
    const p1 = unit(s, 'p1');
    const e1 = unit(s, 'e1');
    expect(hitChance(s, p1, e1, 'snap')).toBeCloseTo(0.375, 4);
    expect(hitChance(s, p1, e1, 'aimed')).toBeCloseTo(0.6375, 4);
    p1.weapon = 'pistol'; // range 8
    expect(hitChance(s, p1, e1, 'snap')).toBeCloseTo(0.55 * (1 - 0.5 * (7 / 8)), 4);
  });

  it('is lowered by cover', () => {
    const s = makeState(['#######', '#P.#E.#', '#######']);
    expect(hitChance(s, unit(s, 'p1'), unit(s, 'e1'), 'snap')).toBeCloseTo(0.267857, 4);
  });
});

describe('SnapShot and AimedShot', () => {
  const rows = corridorRows('P...E'); // distance 4

  it('a hit damages the target and spends AP', () => {
    const s = makeState(rows);
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(10);
    expect(unit(r.state, 'p1').ap).toBe(45);
    expect(r.events).toEqual([
      {
        type: 'shot', unitId: 'p1', targetId: 'e1', mode: 'snap', hit: true, damage: 30,
        from: { x: 1, y: 1 }, impact: { x: 5, y: 1 },
      },
    ]);
  });

  it('a miss does no damage and lands elsewhere', () => {
    const s = makeState(rows);
    s.rngState = MISS();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(40);
    const shot = r.events.find((e) => e.type === 'shot');
    expect(shot).toMatchObject({ hit: false, damage: 0 });
  });

  it('an aimed shot costs more AP', () => {
    const s = makeState(rows);
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    const r = ok(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'p1').ap).toBe(30);
    expect(r.events[0]).toMatchObject({ type: 'shot', mode: 'aimed' });
  });

  it('killing the last enemy wins the mission', () => {
    const s = makeState(rows);
    s.rngState = HIT();
    unit(s, 'p1').facing = 2;
    unit(s, 'e1').hp = 20;
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 5, y: 1 } });
    expect(r.events).toContainEqual({ type: 'gameOver', winner: 'player' });
    expect(r.state.status).toBe('won');
  });

  it('rejects a target out of range', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(8) + 'E')); // distance 9
    unit(s, 'p1').weapon = 'pistol'; // range 8
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /range/,
    );
  });

  it('rejects a target behind a closed door', () => {
    const s = makeState(corridorRows('P.+.E'));
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /not visible/,
    );
  });

  it('rejects shooting at its own side', () => {
    const s = makeState(['#######', '#PP..E#', '#######']);
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'p2' }))).toMatch(
      /own side/,
    );
  });

  it('rejects a shot without enough AP', () => {
    const s = makeState(rows);
    unit(s, 'p1').facing = 2;
    unit(s, 'p1').ap = 10;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /action points/,
    );
  });

  it('rejects an unknown or dead target', () => {
    const s = makeState(rows);
    unit(s, 'p1').facing = 2;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'zz' }))).toMatch(
      /No such target/,
    );
    unit(s, 'e1').alive = false;
    expect(reason(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }))).toMatch(
      /No such target/,
    );
  });
});

describe('Throw', () => {
  it('kills an enemy caught in the blast', () => {
    const s = makeState(corridorRows('P.....E')); // e1 at x=7, distance 6
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 7, y: 1 } }));
    expect(unit(r.state, 'e1').alive).toBe(false);
    expect(unit(r.state, 'p1').grenades).toBe(0);
    expect(unit(r.state, 'p1').ap).toBe(36);
    expect(r.events[0]).toEqual({
      type: 'grenade', unitId: 'p1', at: { x: 7, y: 1 },
      hits: [{ unitId: 'e1', damage: 40 }], doorsDestroyed: [],
    });
    expect(r.events).toContainEqual({ type: 'died', unitId: 'e1', at: { x: 7, y: 1 } });
    expect(r.state.status).toBe('won');
  });

  it('hurts the thrower too when the blast reaches them', () => {
    const s = makeState(corridorRows('P....E'));
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 2, y: 1 } }));
    expect(unit(r.state, 'p1').hp).toBe(10);
  });

  it('destroys doors in the blast radius', () => {
    const s = makeState(corridorRows('P..+.E'));
    const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 4, y: 1 } }));
    expect(r.state.tiles[1][4].kind).toBe('floor');
    expect(r.events[0]).toMatchObject({ type: 'grenade', doorsDestroyed: [{ x: 4, y: 1 }] });
  });

  it('rejects a throw with no grenades', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').grenades = 0;
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }))).toMatch(
      /grenades/,
    );
  });

  it('rejects a throw at a wall', () => {
    const s = makeState(corridorRows('P...E'));
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 0, y: 1 } }))).toMatch(
      /wall/,
    );
  });

  it('rejects a throw out of range', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(11) + 'E'));
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 12, y: 1 } }))).toMatch(
      /range/,
    );
  });

  it('rejects a throw when the path is blocked', () => {
    const s = makeState(corridorRows('P.#..E'));
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 5, y: 1 } }))).toMatch(
      /blocked/,
    );
  });

  it('rejects a throw without enough AP', () => {
    const s = makeState(corridorRows('P...E'));
    unit(s, 'p1').ap = 20;
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }))).toMatch(
      /action points/,
    );
  });
});

describe('reaction fire', () => {
  const rows = corridorRows('P....E'); // distance 5

  it('does nothing when the setting is off', () => {
    const s = makeState(rows);
    unit(s, 'e1').facing = 6;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('lets an enemy with spare AP shoot a soldier who moves into view', () => {
    const s = makeState(rows);
    s.settings.reactionFire = true;
    unit(s, 'e1').facing = 6;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(r.events.map((e) => e.type)).toEqual(['moved', 'shot']);
    expect(unit(r.state, 'e1').ap).toBe(45);
    expect(unit(r.state, 'p1').hp).toBe(20);
  });

  it('does not fire without the AP for a snap shot', () => {
    const s = makeState(rows);
    s.settings.reactionFire = true;
    unit(s, 'e1').facing = 6;
    unit(s, 'e1').ap = 5;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(r.events.map((e) => e.type)).toEqual(['moved']);
  });

  it('can kill the mover and end the mission', () => {
    const s = makeState(rows);
    s.settings.reactionFire = true;
    unit(s, 'e1').facing = 6;
    unit(s, 'p1').hp = 10;
    s.rngState = HIT();
    const r = ok(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 1 } }));
    expect(unit(r.state, 'p1').alive).toBe(false);
    expect(r.state.status).toBe('lost');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/combat.test.ts`
Expected: FAIL because `combat` does not exist.

- [ ] **Step 3: Write combat.ts**

`src/core/combat.ts`:

```ts
import { CONFIG, WEAPONS } from './config';
import { NEIGHBORS_4, distance, inBounds, tileAt } from './geometry';
import { nextRandom } from './rng';
import type { GameEvent, GameState, Pos, ShotMode, Unit } from './types';
import { canSee } from './vision';

export function isCovered(s: GameState, shooter: Pos, target: Pos): boolean {
  const here = tileAt(s, target);
  if (here.kind === 'door' && here.open) return true;
  const d0 = distance(shooter, target);
  return NEIGHBORS_4.some((o) => {
    const p = { x: target.x + o.x, y: target.y + o.y };
    return inBounds(s, p) && tileAt(s, p).kind === 'wall' && distance(shooter, p) < d0;
  });
}

export function hitChance(s: GameState, shooter: Unit, target: Unit, mode: ShotMode): number {
  const w = WEAPONS[shooter.weapon];
  const base = mode === 'snap' ? w.snapAccuracy : w.aimedAccuracy;
  const rangeFactor = 1 - 0.5 * (distance(shooter.pos, target.pos) / w.range);
  const cover = isCovered(s, shooter.pos, target.pos) ? CONFIG.coverMultiplier : 1;
  return base * rangeFactor * cover;
}

function missImpact(s: GameState, target: Pos): Pos {
  let ox = Math.floor(nextRandom(s) * 3) - 1;
  const oy = Math.floor(nextRandom(s) * 3) - 1;
  if (ox === 0 && oy === 0) ox = 1;
  return {
    x: Math.min(s.width - 1, Math.max(0, target.x + ox)),
    y: Math.min(s.height - 1, Math.max(0, target.y + oy)),
  };
}

export function fireShot(
  s: GameState,
  shooter: Unit,
  target: Unit,
  mode: ShotMode,
  events: GameEvent[],
): void {
  const hit = nextRandom(s) < hitChance(s, shooter, target, mode);
  let damage = 0;
  let impact: Pos = { ...target.pos };
  if (hit) {
    damage = WEAPONS[shooter.weapon].damage;
    target.hp = Math.max(0, target.hp - damage);
  } else {
    impact = missImpact(s, target.pos);
  }
  events.push({
    type: 'shot',
    unitId: shooter.id,
    targetId: target.id,
    mode,
    hit,
    damage,
    from: { ...shooter.pos },
    impact,
  });
  if (hit && target.hp <= 0) {
    target.alive = false;
    events.push({ type: 'died', unitId: target.id, at: { ...target.pos } });
  }
}

export function applyReactionFire(s: GameState, mover: Unit, events: GameEvent[]): void {
  for (const o of s.units) {
    if (!mover.alive) return;
    if (!o.alive || o.side === mover.side) continue;
    const w = WEAPONS[o.weapon];
    if (o.ap < w.snapAp) continue;
    if (distance(o.pos, mover.pos) > w.range) continue;
    if (!canSee(s, o, mover.pos)) continue;
    o.ap -= w.snapAp;
    fireShot(s, o, mover, 'snap', events);
  }
}
```

- [ ] **Step 4: Write the shoot and throw handlers**

`src/core/actions/shoot.ts`:

```ts
import { NOT_ENOUGH_AP, WEAPONS } from '../config';
import { fireShot } from '../combat';
import { distance } from '../geometry';
import type { Command, GameEvent, GameState, ShotMode, Unit } from '../types';
import { canSee } from '../vision';

export function handleShot(
  s: GameState,
  cmd: Extract<Command, { type: 'SnapShot' | 'AimedShot' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const mode: ShotMode = cmd.type === 'SnapShot' ? 'snap' : 'aimed';
  const target = s.units.find((u) => u.id === cmd.targetId);
  if (!target || !target.alive) return 'No such target';
  if (target.side === unit.side) return 'Cannot shoot your own side';
  const w = WEAPONS[unit.weapon];
  const cost = mode === 'snap' ? w.snapAp : w.aimedAp;
  if (unit.ap < cost) return NOT_ENOUGH_AP;
  if (distance(unit.pos, target.pos) > w.range) return 'Target is out of range';
  if (!canSee(s, unit, target.pos)) return 'Target is not visible';

  unit.ap -= cost;
  fireShot(s, unit, target, mode, events);
  return null;
}
```

`src/core/actions/throw.ts`:

```ts
import { CONFIG, NOT_ENOUGH_AP } from '../config';
import { chebyshev, distance, inBounds, tileAt } from '../geometry';
import type { Command, GameEvent, GameState, Pos, Unit } from '../types';
import { hasLineOfSight } from '../vision';

export function handleThrow(
  s: GameState,
  cmd: Extract<Command, { type: 'Throw' }>,
  unit: Unit,
  events: GameEvent[],
): string | null {
  const g = CONFIG.grenade;
  if (unit.grenades < 1) return 'No grenades left';
  if (unit.ap < g.apCost) return NOT_ENOUGH_AP;
  if (!inBounds(s, cmd.at)) return 'Target is off the map';
  if (distance(unit.pos, cmd.at) > g.range) return 'Out of range';
  if (tileAt(s, cmd.at).kind === 'wall') return 'Cannot throw at a wall';
  if (!hasLineOfSight(s, unit.pos, cmd.at)) return 'Path is blocked';

  unit.ap -= g.apCost;
  unit.grenades -= 1;

  const hits: { unitId: string; damage: number }[] = [];
  const died: Unit[] = [];
  for (const u of s.units) {
    if (!u.alive) continue;
    if (chebyshev(u.pos, cmd.at) > g.radius) continue;
    if (!hasLineOfSight(s, cmd.at, u.pos)) continue;
    u.hp = Math.max(0, u.hp - g.damage);
    hits.push({ unitId: u.id, damage: g.damage });
    if (u.hp <= 0) {
      u.alive = false;
      died.push(u);
    }
  }

  const doorsDestroyed: Pos[] = [];
  for (let dy = -g.radius; dy <= g.radius; dy++) {
    for (let dx = -g.radius; dx <= g.radius; dx++) {
      const p = { x: cmd.at.x + dx, y: cmd.at.y + dy };
      if (!inBounds(s, p)) continue;
      const tile = tileAt(s, p);
      if (tile.kind === 'door') {
        tile.kind = 'floor';
        tile.open = false;
        doorsDestroyed.push(p);
      }
    }
  }

  events.push({ type: 'grenade', unitId: unit.id, at: { ...cmd.at }, hits, doorsDestroyed });
  for (const u of died) events.push({ type: 'died', unitId: u.id, at: { ...u.pos } });
  return null;
}
```

- [ ] **Step 5: Wire the handlers into apply.ts and Move**

Add imports at the top of `src/core/apply.ts`:

```ts
import { handleShot } from './actions/shoot';
import { handleThrow } from './actions/throw';
```

Add these cases before `default` in `dispatch`:

```ts
    case 'SnapShot':
    case 'AimedShot':
      return handleShot(s, cmd, unit, events);
    case 'Throw':
      return handleThrow(s, cmd, unit, events);
```

In `src/core/actions/move.ts`, add the import and call reaction fire at the end of `handleMove`, just before `return null` of the success path (after the patrol-index update):

```ts
import { applyReactionFire } from '../combat';
```

```ts
  if (s.settings.reactionFire) applyReactionFire(s, unit, events);
  return null;
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean. The Task 4 test "rejects commands the build does not support yet" now fails because `Throw` is supported. Change that test to use a command that is still rejected for a real reason, or delete it. Delete it (all commands are now supported), then re-run.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(core): add shooting, grenades, cover and reaction fire"
```

---

### Task 7: Pathfinding

**Files:**
- Create: `src/core/path.ts`
- Test: `tests/path.test.ts`

**Interfaces:**
- Consumes: `stepBlockedReason`, `stepCost`, `NEIGHBORS_8`, `inBounds`, `posEq`.
- Produces:
  - `interface PathOptions { ignoreOccupantAtGoal?: boolean }`
  - `findPath(s: GameState, unitId: string, goal: Pos, opts?: PathOptions): Pos[] | null` (cheapest path by AP cost, start tile excluded, goal included; null when the unit is unknown or dead, the goal is out of bounds or equals the start, or no route exists; other units block, doors must be open)
  - `pathCost(from: Pos, path: Pos[]): number`

- [ ] **Step 1: Write the tests**

`tests/path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findPath, pathCost } from '../src/core/path';
import { corridorRows, makeState } from './helpers';

describe('findPath', () => {
  it('walks a straight corridor', () => {
    const s = makeState(corridorRows('P...'));
    const path = findPath(s, 'p1', { x: 3, y: 1 });
    expect(path).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(pathCost({ x: 1, y: 1 }, path!)).toBe(8);
  });

  it('goes around a wall without cutting corners', () => {
    const s = makeState(['#####', '#P#.#', '#...#', '#####']);
    const path = findPath(s, 'p1', { x: 3, y: 1 });
    expect(path).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }]);
    expect(pathCost({ x: 1, y: 1 }, path!)).toBe(16);
  });

  it('prefers a diagonal when it is cheaper', () => {
    const s = makeState(['#####', '#P..#', '#...#', '#..E#', '#####']);
    const path = findPath(s, 'p1', { x: 3, y: 3 }, { ignoreOccupantAtGoal: true });
    expect(path).toEqual([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
  });

  it('returns null when the goal is unreachable', () => {
    const s = makeState(['######', '#P#..#', '######']);
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toBeNull();
  });

  it('is blocked by a closed door and passes once it is open', () => {
    const s = makeState(corridorRows('P+..'));
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toBeNull();
    s.tiles[1][2].open = true;
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toHaveLength(2);
  });

  it('treats an occupied goal as blocked unless told otherwise', () => {
    const s = makeState(corridorRows('P.E'));
    expect(findPath(s, 'p1', { x: 3, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 3, y: 1 }, { ignoreOccupantAtGoal: true })).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
  });

  it('returns null for the start tile, an unknown unit or an off-map goal', () => {
    const s = makeState(corridorRows('P..'));
    expect(findPath(s, 'p1', { x: 1, y: 1 })).toBeNull();
    expect(findPath(s, 'zz', { x: 2, y: 1 })).toBeNull();
    expect(findPath(s, 'p1', { x: 40, y: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/path.test.ts`
Expected: FAIL because `path` does not exist.

- [ ] **Step 3: Write path.ts**

`src/core/path.ts`:

```ts
import { NEIGHBORS_8, inBounds, posEq } from './geometry';
import { stepBlockedReason, stepCost } from './movement';
import type { GameState, Pos } from './types';

export interface PathOptions {
  ignoreOccupantAtGoal?: boolean;
}

export function findPath(
  s: GameState,
  unitId: string,
  goal: Pos,
  opts: PathOptions = {},
): Pos[] | null {
  const unit = s.units.find((u) => u.id === unitId);
  if (!unit || !unit.alive || !inBounds(s, goal) || posEq(unit.pos, goal)) return null;

  const key = (p: Pos) => p.y * s.width + p.x;
  const dist = new Map<number, number>([[key(unit.pos), 0]]);
  const prev = new Map<number, Pos>();
  const done = new Set<number>();
  const open: Pos[] = [{ ...unit.pos }];

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (dist.get(key(open[i]))! < dist.get(key(open[best]))!) best = i;
    }
    const cur = open.splice(best, 1)[0];
    const ck = key(cur);
    if (done.has(ck)) continue;
    done.add(ck);
    if (posEq(cur, goal)) break;

    for (const d of NEIGHBORS_8) {
      const next = { x: cur.x + d.x, y: cur.y + d.y };
      const ignoreUnits = !!opts.ignoreOccupantAtGoal && posEq(next, goal);
      if (stepBlockedReason(s, cur, next, ignoreUnits) !== null) continue;
      const nk = key(next);
      const nd = dist.get(ck)! + stepCost(cur, next);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, cur);
        open.push(next);
      }
    }
  }

  if (!prev.has(key(goal))) return null;
  const path: Pos[] = [];
  let c: Pos = goal;
  while (!posEq(c, unit.pos)) {
    path.unshift({ ...c });
    c = prev.get(key(c))!;
  }
  return path;
}

export function pathCost(from: Pos, path: Pos[]): number {
  let total = 0;
  let p = from;
  for (const n of path) {
    total += stepCost(p, n);
    p = n;
  }
  return total;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): add AP-cost pathfinding"
```

---

### Task 8: Enemy AI

**Files:**
- Create: `src/core/ai.ts`
- Test: `tests/ai.test.ts`

**Interfaces:**
- Consumes: `applyCommand`, `findPath`, `canSee`, `visibleToSide`, `WEAPONS`, geometry helpers, `createMission1`.
- Produces:
  - `aiNextCommand(state: GameState): Command` (the next command for the enemy side; every returned command except `EndTurn` has already been checked to succeed and spends at least 1 AP, so a turn always ends)
  - `runEnemyTurn(state: GameState): { state: GameState; events: GameEvent[] }` (runs `aiNextCommand` until `EndTurn` or game over, capped at 500 commands)

- [ ] **Step 1: Write the tests**

`tests/ai.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aiNextCommand, runEnemyTurn } from '../src/core/ai';
import { applyCommand } from '../src/core/apply';
import { createMission1 } from '../src/core/mission1';
import { corridorRows, makeState, ok, unit } from './helpers';

function enemyTurn(rows: string[]) {
  const s = makeState(rows);
  s.turn = 'enemy';
  return s;
}

describe('aiNextCommand', () => {
  it('takes an aimed shot at a visible soldier when it has the AP', () => {
    const s = enemyTurn(corridorRows('E...P'));
    unit(s, 'e1').facing = 2;
    expect(aiNextCommand(s)).toEqual({ type: 'AimedShot', unitId: 'e1', targetId: 'p1' });
  });

  it('falls back to a snap shot when AP is short', () => {
    const s = enemyTurn(corridorRows('E...P'));
    unit(s, 'e1').facing = 2;
    unit(s, 'e1').ap = 20;
    expect(aiNextCommand(s)).toEqual({ type: 'SnapShot', unitId: 'e1', targetId: 'p1' });
  });

  it('turns toward a soldier that a teammate can see', () => {
    const s = enemyTurn(corridorRows('EE..P'));
    unit(s, 'e1').facing = 6;
    unit(s, 'e2').facing = 2;
    expect(aiNextCommand(s)).toEqual({ type: 'Turn', unitId: 'e1', facing: 2 });
  });

  it('advances toward the last seen position', () => {
    const s = enemyTurn(['########', '#E....#P#', '########']);
    s.enemyMemory = { x: 4, y: 1 };
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('patrols when nothing is known', () => {
    const s = enemyTurn(['########', '#E....#P#', '########']);
    unit(s, 'e1').patrol = [{ x: 4, y: 1 }, { x: 1, y: 1 }];
    expect(aiNextCommand(s)).toEqual({ type: 'Move', unitId: 'e1', to: { x: 2, y: 1 } });
  });

  it('ends the turn when nothing is possible', () => {
    const s = enemyTurn(['#####', '#E#P#', '#####']);
    expect(aiNextCommand(s)).toEqual({ type: 'EndTurn' });
  });

  it('returns only commands that apply cleanly', () => {
    const s = enemyTurn(corridorRows('E...P'));
    unit(s, 'e1').facing = 2;
    ok(applyCommand(s, aiNextCommand(s)));
  });
});

describe('runEnemyTurn', () => {
  it('hands the turn back even when an enemy is walled in', () => {
    const s = enemyTurn(['#####', '#E#P#', '#####']);
    const r = runEnemyTurn(s);
    expect(r.state.turn).toBe('player');
  });

  it('finishes a full turn on Mission 1', () => {
    const s = createMission1();
    const ended = ok(applyCommand(s, { type: 'EndTurn' })).state;
    expect(ended.turn).toBe('enemy');
    const r = runEnemyTurn(ended);
    expect(r.state.turn).toBe('player');
    expect(r.events.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ai.test.ts`
Expected: FAIL because `ai` does not exist.

- [ ] **Step 3: Write ai.ts**

`src/core/ai.ts`:

```ts
import { applyCommand } from './apply';
import { WEAPONS } from './config';
import { distance, facingFromDelta, posEq } from './geometry';
import { findPath } from './path';
import type { Command, GameEvent, GameState, Pos, Unit } from './types';
import { canSee, visibleToSide } from './vision';

const MAX_COMMANDS_PER_TURN = 500;

function firstStep(s: GameState, unit: Unit, goal: Pos): Pos | null {
  const path = findPath(s, unit.id, goal, { ignoreOccupantAtGoal: true });
  return path && path.length > 0 ? path[0] : null;
}

function candidates(s: GameState, unit: Unit): Command[] {
  const out: Command[] = [];
  const targets = s.units.filter(
    (u) => u.side === 'player' && u.alive && visibleToSide(s, 'enemy', u.pos),
  );

  if (targets.length > 0) {
    const target = targets.reduce((a, b) =>
      distance(unit.pos, a.pos) <= distance(unit.pos, b.pos) ? a : b,
    );
    const w = WEAPONS[unit.weapon];
    const d = distance(unit.pos, target.pos);
    const sees = canSee(s, unit, target.pos);
    if (sees && d <= w.range) {
      if (d > 2 && unit.ap >= w.aimedAp) {
        out.push({ type: 'AimedShot', unitId: unit.id, targetId: target.id });
      }
      out.push({ type: 'SnapShot', unitId: unit.id, targetId: target.id });
    }
    if (!sees) {
      out.push({
        type: 'Turn',
        unitId: unit.id,
        facing: facingFromDelta(target.pos.x - unit.pos.x, target.pos.y - unit.pos.y),
      });
    }
    const step = firstStep(s, unit, target.pos);
    if (step) out.push({ type: 'Move', unitId: unit.id, to: step });
    return out;
  }

  const goal = s.enemyMemory ?? (unit.patrol.length > 0 ? unit.patrol[unit.patrolIndex] : null);
  if (goal && !posEq(unit.pos, goal)) {
    const step = firstStep(s, unit, goal);
    if (step) out.push({ type: 'Move', unitId: unit.id, to: step });
  }
  return out;
}

export function aiNextCommand(state: GameState): Command {
  for (const unit of state.units) {
    if (unit.side !== 'enemy' || !unit.alive) continue;
    for (const cmd of candidates(state, unit)) {
      if (applyCommand(state, cmd).ok) return cmd;
    }
  }
  return { type: 'EndTurn' };
}

export function runEnemyTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < MAX_COMMANDS_PER_TURN; i++) {
    const cmd = aiNextCommand(s);
    const r = applyCommand(s, cmd);
    if (!r.ok) break;
    s = r.state;
    events.push(...r.events);
    if (cmd.type === 'EndTurn' || s.status !== 'playing') break;
  }
  return { state: s, events };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS. If the "advances toward the last seen position" or patrol test fails because the soldier `P` at (7,1) happens to be visible, check that the wall at x=6 separates them as drawn.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(core): add enemy AI and enemy turn runner"
```

---

### Task 9: Renderer (map, fog, units, effects, panel)

**Files:**
- Create: `src/render/layout.ts`, `src/render/effects.ts`, `src/render/panel.ts`, `src/render/renderer.ts`, `src/input/uiState.ts`
- Test: `tests/layout.test.ts`, `tests/effects.test.ts`

**Interfaces:**
- Consumes: `GameState`, `GameEvent`, `Pos`, `CONFIG`, `WEAPONS`, `FACING_VECTORS`, `computeVisible`.
- Produces:
  - `VIEW = { width: 480, height: 360, mapHeight: 320 }` and `screenToTile(px: number, py: number, mapWidth: number, mapHeight: number): Pos | null` (logical canvas pixels to tile, null outside the map area)
  - `type Mode = 'move' | 'snap' | 'aimed' | 'throw' | 'door'`; `interface UiState { selectedId: string | null; mode: Mode; hover: Pos | null; preview: Pos[]; previewCost: number | null; message: string; messageUntil: number; busy: boolean }`; `createUiState(selectedId: string | null): UiState`
  - `class Effects { add(events: GameEvent[], now: number): void; unitOffset(unitId: string, now: number): { x: number; y: number }; draw(ctx: CanvasRenderingContext2D, now: number): void }`
  - `type ButtonId = 'snap' | 'aimed' | 'throw' | 'door' | 'pickup' | 'end'`; `PANEL_BUTTONS`; `buttonAt(px: number, py: number): ButtonId | null`; `drawPanel(ctx, state, ui, now)`
  - `drawGame(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState, effects: Effects, now: number): void`

- [ ] **Step 1: Write the tests**

`tests/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { screenToTile } from '../src/render/layout';

describe('screenToTile', () => {
  it('maps logical pixels to tiles', () => {
    expect(screenToTile(0, 0, 30, 20)).toEqual({ x: 0, y: 0 });
    expect(screenToTile(479, 319, 30, 20)).toEqual({ x: 29, y: 19 });
    expect(screenToTile(17, 33, 30, 20)).toEqual({ x: 1, y: 2 });
  });

  it('returns null over the panel, outside the canvas or beyond the map', () => {
    expect(screenToTile(100, 330, 30, 20)).toBeNull();
    expect(screenToTile(-1, 5, 30, 20)).toBeNull();
    expect(screenToTile(100, 0, 5, 5)).toBeNull();
  });
});
```

`tests/effects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Effects } from '../src/render/effects';

describe('Effects', () => {
  it('starts a moving unit one tile behind and settles at zero', () => {
    const fx = new Effects();
    fx.add([{ type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }], 1000);
    const start = fx.unitOffset('p1', 1000);
    expect(start.x).toBeCloseTo(-16);
    expect(start.y).toBeCloseTo(0);
    expect(fx.unitOffset('p1', 1500)).toEqual({ x: 0, y: 0 });
  });

  it('reports no offset for units that are not moving', () => {
    const fx = new Effects();
    expect(fx.unitOffset('p1', 0)).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/layout.test.ts tests/effects.test.ts`
Expected: FAIL because the render modules do not exist.

- [ ] **Step 3: Write layout.ts and uiState.ts**

`src/render/layout.ts`:

```ts
import { CONFIG } from '../core/config';
import type { Pos } from '../core/types';

/** Logical canvas size: a 30x20 map of 16px tiles plus a 40px panel. */
export const VIEW = { width: 480, height: 360, mapHeight: 320 } as const;

export function screenToTile(px: number, py: number, mapWidth: number, mapHeight: number): Pos | null {
  if (px < 0 || py < 0 || py >= VIEW.mapHeight) return null;
  const x = Math.floor(px / CONFIG.tileSize);
  const y = Math.floor(py / CONFIG.tileSize);
  if (x >= mapWidth || y >= mapHeight) return null;
  return { x, y };
}
```

`src/input/uiState.ts`:

```ts
import type { Pos } from '../core/types';

export type Mode = 'move' | 'snap' | 'aimed' | 'throw' | 'door';

export interface UiState {
  selectedId: string | null;
  mode: Mode;
  hover: Pos | null;
  preview: Pos[];
  previewCost: number | null;
  message: string;
  messageUntil: number;
  busy: boolean;
}

export function createUiState(selectedId: string | null): UiState {
  return {
    selectedId,
    mode: 'move',
    hover: null,
    preview: [],
    previewCost: null,
    message: '',
    messageUntil: 0,
    busy: false,
  };
}
```

- [ ] **Step 4: Write effects.ts**

`src/render/effects.ts`:

```ts
import { CONFIG } from '../core/config';
import type { GameEvent, Pos } from '../core/types';

const T = CONFIG.tileSize;

type Effect =
  | { kind: 'move'; unitId: string; from: Pos; to: Pos; start: number; dur: number }
  | { kind: 'shot'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }
  | { kind: 'flash'; at: Pos; color: string; start: number; dur: number }
  | { kind: 'boom'; at: Pos; start: number; dur: number };

const center = (p: Pos) => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 });

export class Effects {
  private list: Effect[] = [];

  add(events: GameEvent[], now: number): void {
    for (const e of events) {
      if (e.type === 'moved') {
        this.list.push({ kind: 'move', unitId: e.unitId, from: e.from, to: e.to, start: now, dur: 120 });
      } else if (e.type === 'shot') {
        this.list.push({ kind: 'shot', from: e.from, to: e.impact, hit: e.hit, start: now, dur: 180 });
        if (e.hit) this.list.push({ kind: 'flash', at: e.impact, color: '255,80,80', start: now + 80, dur: 250 });
      } else if (e.type === 'died') {
        this.list.push({ kind: 'flash', at: e.at, color: '255,255,255', start: now, dur: 400 });
      } else if (e.type === 'grenade') {
        this.list.push({ kind: 'boom', at: e.at, start: now, dur: 350 });
      }
    }
  }

  /** Pixel offset to add to a unit's logical position while it slides between tiles. */
  unitOffset(unitId: string, now: number): { x: number; y: number } {
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return { x: (e.from.x - e.to.x) * T * (1 - p), y: (e.from.y - e.to.y) * T * (1 - p) };
    }
    return { x: 0, y: 0 };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    this.list = this.list.filter((e) => now < e.start + e.dur);
    for (const e of this.list) {
      const p = (now - e.start) / e.dur;
      if (p < 0) continue;
      if (e.kind === 'shot') {
        const a = center(e.from);
        const b = center(e.to);
        ctx.strokeStyle = e.hit ? '#ffe14d' : '#9aa0b5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (e.kind === 'flash') {
        ctx.fillStyle = `rgba(${e.color},${1 - p})`;
        ctx.fillRect(e.at.x * T, e.at.y * T, T, T);
      } else if (e.kind === 'boom') {
        const c = center(e.at);
        ctx.fillStyle = `rgba(255,150,40,${1 - p})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, T * 1.5 * (0.3 + p), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
```

- [ ] **Step 5: Write panel.ts**

`src/render/panel.ts`:

```ts
import { WEAPONS } from '../core/config';
import type { GameState } from '../core/types';
import type { UiState } from '../input/uiState';
import { VIEW } from './layout';

export type ButtonId = 'snap' | 'aimed' | 'throw' | 'door' | 'pickup' | 'end';

export interface PanelButton {
  id: ButtonId;
  label: string;
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFS: [ButtonId, string, string][] = [
  ['snap', 'SNAP', 'S'],
  ['aimed', 'AIM', 'A'],
  ['throw', 'THROW', 'T'],
  ['door', 'DOOR', 'D'],
  ['pickup', 'TAKE', 'P'],
  ['end', 'END', 'Space'],
];

export const PANEL_BUTTONS: PanelButton[] = DEFS.map(([id, label, key], i) => ({
  id, label, key, x: 172 + i * 50, y: VIEW.mapHeight + 20, w: 46, h: 16,
}));

export function buttonAt(px: number, py: number): ButtonId | null {
  const b = PANEL_BUTTONS.find((x) => px >= x.x && px < x.x + x.w && py >= x.y && py < x.y + x.h);
  return b ? b.id : null;
}

export function drawPanel(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState, now: number): void {
  const top = VIEW.mapHeight;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, top, VIEW.width, VIEW.height - top);
  ctx.fillStyle = '#3a3f55';
  ctx.fillRect(0, top, VIEW.width, 1);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);
  ctx.fillStyle = '#e8e8f0';
  if (u) {
    ctx.fillText(`${u.id.toUpperCase()}  HP ${u.hp}/${u.maxHp}`, 4, top + 4);
    ctx.fillText(`AP ${u.ap}/${u.maxAp}`, 4, top + 16);
    ctx.fillText(`${WEAPONS[u.weapon].name}  Grenades ${u.grenades}`, 4, top + 28);
  } else {
    ctx.fillText('No soldier selected', 4, top + 4);
  }
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Turn ${state.turnNumber}  ${state.turn === 'player' ? 'YOUR MOVE' : 'ENEMY MOVE'}`, 172, top + 4);

  let line = '';
  if (state.status === 'won') line = 'MISSION COMPLETE';
  else if (state.status === 'lost') line = 'MISSION FAILED';
  else if (now < ui.messageUntil) line = ui.message;
  else if (ui.previewCost !== null) line = `Move: ${ui.previewCost} AP`;
  ctx.fillStyle = state.status === 'playing' ? '#ffe14d' : '#7dff9a';
  ctx.fillText(line, 172, top + 10);

  const modeButton: Partial<Record<UiState['mode'], ButtonId>> = {
    snap: 'snap', aimed: 'aimed', throw: 'throw', door: 'door',
  };
  for (const b of PANEL_BUTTONS) {
    const active = modeButton[ui.mode] === b.id;
    ctx.fillStyle = active ? '#4da6ff' : '#2a2f45';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = active ? '#000' : '#e8e8f0';
    ctx.fillText(b.label, b.x + 3, b.y + 4);
  }
  ctx.fillStyle = '#6a6f88';
  ctx.fillText('S snap  A aim  T throw  D door  P take  Q/E turn  Space end  Esc cancel', 4, top + 30);
}
```

- [ ] **Step 6: Write renderer.ts**

`src/render/renderer.ts`:

```ts
import { CONFIG } from '../core/config';
import { FACING_VECTORS } from '../core/geometry';
import type { GameState } from '../core/types';
import { computeVisible } from '../core/vision';
import type { UiState } from '../input/uiState';
import type { Effects } from './effects';
import { VIEW } from './layout';
import { drawPanel } from './panel';

const T = CONFIG.tileSize;

const COLORS = {
  floor: '#2f3347',
  wall: '#8b8fa8',
  doorClosed: '#b5651d',
  doorOpen: '#5a3a1a',
  player: '#4da6ff',
  enemy: '#ff5555',
  select: '#ffe14d',
  rifle: '#d0d0d0',
  pistol: '#a0a0a0',
  grenade: '#3cb371',
  dead: '#555566',
};

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UiState,
  effects: Effects,
  now: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const visible = computeVisible(state, 'player');

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!state.explored[y][x]) continue;
      const tile = state.tiles[y][x];
      ctx.fillStyle =
        tile.kind === 'wall' ? COLORS.wall
        : tile.kind === 'door' ? (tile.open ? COLORS.doorOpen : COLORS.doorClosed)
        : COLORS.floor;
      ctx.fillRect(x * T, y * T, T, T);
      if (!visible[y][x]) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }

  for (const item of state.items) {
    if (!visible[item.pos.y][item.pos.x]) continue;
    ctx.fillStyle = COLORS[item.kind];
    ctx.fillRect(item.pos.x * T + 5, item.pos.y * T + 5, 6, 6);
  }

  for (const u of state.units) {
    const seen = visible[u.pos.y][u.pos.x];
    if (!u.alive) {
      if (!seen) continue;
      ctx.strokeStyle = COLORS.dead;
      ctx.beginPath();
      ctx.moveTo(u.pos.x * T + 3, u.pos.y * T + 3);
      ctx.lineTo(u.pos.x * T + T - 3, u.pos.y * T + T - 3);
      ctx.moveTo(u.pos.x * T + T - 3, u.pos.y * T + 3);
      ctx.lineTo(u.pos.x * T + 3, u.pos.y * T + T - 3);
      ctx.stroke();
      continue;
    }
    if (u.side === 'enemy' && !seen) continue;

    const off = effects.unitOffset(u.id, now);
    const cx = u.pos.x * T + T / 2 + off.x;
    const cy = u.pos.y * T + T / 2 + off.y;
    ctx.fillStyle = u.side === 'player' ? COLORS.player : COLORS.enemy;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    const v = FACING_VECTORS[u.facing];
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + v.x * 7, cy + v.y * 7);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 6, cy - 9, 12, 2);
    ctx.fillStyle = '#7dff9a';
    ctx.fillRect(cx - 6, cy - 9, (12 * u.hp) / u.maxHp, 2);
    if (u.id === ui.selectedId) {
      ctx.strokeStyle = COLORS.select;
      ctx.strokeRect(u.pos.x * T + 0.5, u.pos.y * T + 0.5, T - 1, T - 1);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const p of ui.preview) ctx.fillRect(p.x * T + 6, p.y * T + 6, 4, 4);
  if (ui.hover) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(ui.hover.x * T + 0.5, ui.hover.y * T + 0.5, T - 1, T - 1);
  }

  effects.draw(ctx, now);
  drawPanel(ctx, state, ui, now);
}
```

- [ ] **Step 7: Run the tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat(render): add canvas renderer, fog, effects and command panel"
```

---

### Task 10: Controller, input and main

**Files:**
- Create: `src/controller.ts`, `src/input/input.ts`
- Modify: `src/main.ts` (replace the temporary line)
- Test: `tests/controller.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 to 9.
- Produces:
  - `class Controller` with public `state: GameState`, `ui: UiState`, `effects: Effects` and methods `selected(): Unit | undefined`, `run(cmd: Command): boolean`, `hover(t: Pos | null): void`, `clickTile(t: Pos): void`, `pressButton(id: ButtonId): void`, `key(k: string): boolean` (returns true when the key was handled), `cancel(): void`, `endTurn(): void`, `moveAlong(unitId: string, path: Pos[]): void`
  - `attachInput(canvas: HTMLCanvasElement, c: Controller): void`
  - A playable game at `npm run dev`. In dev mode the controller is exposed as `window.game` for debugging.

- [ ] **Step 1: Write the controller tests**

`tests/controller.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller } from '../src/controller';
import { createMission1 } from '../src/core/mission1';
import { Effects } from '../src/render/effects';
import { createUiState } from '../src/input/uiState';

function setup() {
  return new Controller(createMission1(), createUiState('p1'), new Effects());
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Controller', () => {
  it('selects soldiers with the number keys', () => {
    const c = setup();
    expect(c.key('2')).toBe(true);
    expect(c.ui.selectedId).toBe('p2');
  });

  it('arms and cancels the snap-shot mode', () => {
    const c = setup();
    c.pressButton('snap');
    expect(c.ui.mode).toBe('snap');
    c.key('Escape');
    expect(c.ui.mode).toBe('move');
  });

  it('moves the selected soldier along a path, one step at a time', () => {
    const c = setup();
    const start = { ...c.selected()!.pos };
    c.clickTile({ x: start.x, y: start.y - 2 });
    vi.advanceTimersByTime(1000);
    expect(c.selected()!.pos).toEqual({ x: start.x, y: start.y - 2 });
    expect(c.ui.busy).toBe(false);
  });

  it('refuses a move that costs more than the soldier has', () => {
    const c = setup();
    c.clickTile({ x: 28, y: 8 }); // across the hall: 9 diagonals + 17 straight steps = 122 AP
    expect(c.selected()!.pos).toEqual({ x: 2, y: 17 });
    expect(c.ui.message).toMatch(/Need/);
  });

  it('runs the enemy turn to completion and returns control to the player', () => {
    const c = setup();
    c.endTurn();
    expect(c.state.turn).toBe('enemy');
    vi.advanceTimersByTime(120000);
    expect(c.state.turn).toBe('player');
    expect(c.ui.busy).toBe(false);
  });

  it('turns the selected soldier with Q and E', () => {
    const c = setup();
    c.key('e');
    expect(c.selected()!.facing).toBe(1);
    c.key('q');
    c.key('q');
    expect(c.selected()!.facing).toBe(7);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/controller.test.ts`
Expected: FAIL because `controller` does not exist.

- [ ] **Step 3: Write controller.ts**

`src/controller.ts`:

```ts
import { aiNextCommand } from './core/ai';
import { applyCommand } from './core/apply';
import { WEAPONS } from './core/config';
import { posEq } from './core/geometry';
import { findPath, pathCost } from './core/path';
import type { Command, Facing, GameEvent, GameState, Pos, Unit } from './core/types';
import { visibleToSide } from './core/vision';
import type { Mode, UiState } from './input/uiState';
import type { Effects } from './render/effects';
import type { ButtonId } from './render/panel';

const STEP_MS = 130;
const ENEMY_STEP_MS = 300;

export class Controller {
  constructor(
    public state: GameState,
    public ui: UiState,
    public effects: Effects,
  ) {}

  selected(): Unit | undefined {
    return this.state.units.find((u) => u.id === this.ui.selectedId && u.alive);
  }

  private say(text: string, ms = 2000): void {
    this.ui.message = text;
    this.ui.messageUntil = performance.now() + ms;
  }

  private squad(): Unit[] {
    return this.state.units.filter((u) => u.side === 'player' && u.alive);
  }

  private selectFirstAlive(): void {
    this.ui.selectedId = this.squad()[0]?.id ?? null;
  }

  run(cmd: Command): boolean {
    const r = applyCommand(this.state, cmd);
    if (!r.ok) {
      this.say(r.reason);
      return false;
    }
    this.state = r.state;
    this.effects.add(r.events, performance.now());
    for (const ev of r.events) this.onEvent(ev);
    if (!this.selected()) this.selectFirstAlive();
    this.updatePreview();
    return true;
  }

  private onEvent(ev: GameEvent): void {
    if (ev.type === 'gameOver') {
      this.say(ev.winner === 'player' ? 'MISSION COMPLETE' : 'MISSION FAILED', Infinity);
    } else if (ev.type === 'turnEnded' && ev.side === 'enemy') {
      this.selectFirstAlive();
      this.say('Your turn');
    }
  }

  hover(t: Pos | null): void {
    this.ui.hover = t;
    this.updatePreview();
  }

  private updatePreview(): void {
    this.ui.preview = [];
    this.ui.previewCost = null;
    const u = this.selected();
    const t = this.ui.hover;
    if (!u || !t || this.ui.mode !== 'move' || this.ui.busy || this.state.turn !== 'player') return;
    const path = findPath(this.state, u.id, t);
    if (path) {
      this.ui.preview = path;
      this.ui.previewCost = pathCost(u.pos, path);
    }
  }

  private canAct(): boolean {
    return !this.ui.busy && this.state.status === 'playing' && this.state.turn === 'player';
  }

  clickTile(t: Pos): void {
    if (!this.canAct()) return;
    const sel = this.selected();
    const clicked = this.state.units.find(
      (u) => u.alive && posEq(u.pos, t) && (u.side === 'player' || visibleToSide(this.state, 'player', u.pos)),
    );

    if (this.ui.mode === 'move') {
      if (clicked && clicked.side === 'player') {
        this.ui.selectedId = clicked.id;
        this.updatePreview();
        return;
      }
      if (!sel) {
        this.say('Select a soldier first');
        return;
      }
      const path = findPath(this.state, sel.id, t);
      if (!path) {
        this.say('No path there');
        return;
      }
      const cost = pathCost(sel.pos, path);
      if (cost > sel.ap) {
        this.say(`Need ${cost} AP, have ${sel.ap}`);
        return;
      }
      this.moveAlong(sel.id, path);
      return;
    }

    if (!sel) {
      this.say('Select a soldier first');
      return;
    }
    const mode = this.ui.mode;
    this.ui.mode = 'move';
    if (mode === 'snap' || mode === 'aimed') {
      if (!clicked || clicked.side !== 'enemy') {
        this.say('Click an enemy');
        return;
      }
      this.run({
        type: mode === 'snap' ? 'SnapShot' : 'AimedShot',
        unitId: sel.id,
        targetId: clicked.id,
      });
    } else if (mode === 'throw') {
      this.run({ type: 'Throw', unitId: sel.id, at: t });
    } else if (mode === 'door') {
      const tile = this.state.tiles[t.y][t.x];
      this.run({ type: tile.open ? 'CloseDoor' : 'OpenDoor', unitId: sel.id, at: t });
    }
  }

  moveAlong(unitId: string, path: Pos[]): void {
    this.ui.busy = true;
    const step = (i: number) => {
      if (i >= path.length || this.state.status !== 'playing') {
        this.ui.busy = false;
        return;
      }
      if (!this.run({ type: 'Move', unitId, to: path[i] })) {
        this.ui.busy = false;
        return;
      }
      setTimeout(() => step(i + 1), STEP_MS);
    };
    step(0);
  }

  private setMode(mode: Mode): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    this.ui.mode = mode;
    const w = WEAPONS[sel.weapon];
    const hint: Record<Mode, string> = {
      move: '',
      snap: `Snap shot, ${w.snapAp} AP: click an enemy`,
      aimed: `Aimed shot, ${w.aimedAp} AP: click an enemy`,
      throw: 'Grenade, 24 AP: click a tile',
      door: 'Door, 2 AP: click an adjacent door',
    };
    this.say(hint[mode], 4000);
    this.updatePreview();
  }

  pressButton(id: ButtonId): void {
    switch (id) {
      case 'snap': this.setMode('snap'); break;
      case 'aimed': this.setMode('aimed'); break;
      case 'throw': this.setMode('throw'); break;
      case 'door': this.setMode('door'); break;
      case 'pickup': this.pickup(); break;
      case 'end': this.endTurn(); break;
    }
  }

  private pickup(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    const item = this.state.items.find((i) => posEq(i.pos, sel.pos));
    if (!item) {
      this.say('Nothing to pick up here');
      return;
    }
    this.run({ type: 'PickUp', unitId: sel.id, itemId: item.id });
  }

  cancel(): void {
    this.ui.mode = 'move';
    this.updatePreview();
  }

  endTurn(): void {
    if (!this.canAct()) return;
    if (!this.run({ type: 'EndTurn' })) return;
    this.ui.mode = 'move';
    this.ui.busy = true;
    setTimeout(this.enemyStep, ENEMY_STEP_MS);
  }

  private enemyStep = (): void => {
    if (this.state.status !== 'playing' || this.state.turn !== 'enemy') {
      this.ui.busy = false;
      return;
    }
    this.run(aiNextCommand(this.state));
    setTimeout(this.enemyStep, ENEMY_STEP_MS);
  };

  key(k: string): boolean {
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower >= '1' && lower <= '4') {
      const target = this.state.units.find((u) => u.id === `p${lower}` && u.alive);
      if (target && this.canAct()) {
        this.ui.selectedId = target.id;
        this.updatePreview();
      }
      return true;
    }
    switch (lower) {
      case 's': this.setMode('snap'); return true;
      case 'a': this.setMode('aimed'); return true;
      case 't': this.setMode('throw'); return true;
      case 'd': this.setMode('door'); return true;
      case 'p': this.pickup(); return true;
      case ' ':
      case 'Enter': this.endTurn(); return true;
      case 'Escape': this.cancel(); return true;
      case 'q':
      case 'e': {
        const sel = this.selected();
        if (sel && this.canAct()) {
          const facing = ((sel.facing + (lower === 'e' ? 1 : 7)) % 8) as Facing;
          this.run({ type: 'Turn', unitId: sel.id, facing });
        }
        return true;
      }
      case 'Tab': {
        const squad = this.squad();
        const i = squad.findIndex((u) => u.id === this.ui.selectedId);
        if (squad.length > 0 && this.canAct()) this.ui.selectedId = squad[(i + 1) % squad.length].id;
        return true;
      }
      default:
        return false;
    }
  }
}
```

- [ ] **Step 4: Write input.ts and replace main.ts**

`src/input/input.ts`:

```ts
import type { Controller } from '../controller';
import { screenToTile } from '../render/layout';
import { buttonAt } from '../render/panel';

export function attachInput(canvas: HTMLCanvasElement, c: Controller): void {
  const toLogical = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  };

  canvas.addEventListener('mousemove', (e) => {
    const p = toLogical(e);
    c.hover(screenToTile(p.x, p.y, c.state.width, c.state.height));
  });
  canvas.addEventListener('mouseleave', () => c.hover(null));
  canvas.addEventListener('click', (e) => {
    const p = toLogical(e);
    const button = buttonAt(p.x, p.y);
    if (button) {
      c.pressButton(button);
      return;
    }
    const t = screenToTile(p.x, p.y, c.state.width, c.state.height);
    if (t) c.clickTile(t);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    c.cancel();
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (c.key(e.key)) e.preventDefault();
  });
}
```

`src/main.ts`:

```ts
import { Controller } from './controller';
import { createMission1 } from './core/mission1';
import { attachInput } from './input/input';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import { VIEW } from './render/layout';
import { drawGame } from './render/renderer';

const canvas = document.createElement('canvas');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
document.getElementById('app')!.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

const controller = new Controller(createMission1(), createUiState('p1'), new Effects());
attachInput(canvas, controller);
if (import.meta.env.DEV) (window as unknown as { game: Controller }).game = controller;

function frame(now: number): void {
  drawGame(ctx, controller.state, controller.ui, controller.effects, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 5: Run the tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, type check clean.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add controller, input handling and the game entry point"
```

---

### Task 11: Playtest, polish fixes, docs, and the GitHub push

**Files:**
- Create: `README.md`
- Modify: any file where the playtest finds a defect (add a regression test to the matching `tests/*.test.ts` first)

**Interfaces:**
- Consumes: the whole game.
- Produces: a verified, documented milestone 1 on `origin`.

- [ ] **Step 1: Run the full automated checks**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, no type errors, `dist/` is produced.

- [ ] **Step 2: Playtest in the browser**

Run: `npm run dev` and open the printed local URL (normally http://localhost:5173). Check each item and fix defects with a test-first change:

- The map shows only the squad area; the rest is black (fog of war).
- Click a soldier or press 1 to 4: the yellow selection box moves.
- Hover a floor tile: a dotted path and `Move: N AP` appear. Click: the soldier walks step by step.
- `D` then clicking an adjacent door opens it; doors block sight until opened and the room beyond is revealed.
- `P` on a floor item picks it up; the panel shows the new weapon or grenade count.
- `S` then clicking a visible enemy snap-shoots with a yellow trace, red hit flash on a hit.
- `T` then a tile throws a grenade with an orange blast; doors in the blast disappear.
- `Q` and `E` turn the soldier and the view cone follows.
- Space ends the turn; enemies patrol, chase and shoot with visible animations, then control returns.
- Escape or right-click cancels an armed action.
- Killing all enemies shows `MISSION COMPLETE`; losing all soldiers shows `MISSION FAILED`.
- Resize the window: the canvas stays crisp and the aspect ratio holds.

- [ ] **Step 3: Write README.md**

```markdown
# Laser Tribute

A turn-based squad tactics game in the spirit of Laser Squad and X-COM, running in the browser.

## Play

    npm install
    npm run dev

Open the printed local address.

## Controls

| Input | Action |
|---|---|
| Click soldier, keys 1 to 4, Tab | Select a soldier |
| Click floor | Move (hover shows the AP cost) |
| S / A, then click an enemy | Snap shot / aimed shot |
| T, then click a tile | Throw a grenade |
| D, then click a door | Open or close a door |
| P | Pick up the item underfoot |
| Q / E | Turn left / right |
| Space or Enter | End turn |
| Esc or right-click | Cancel |

## Develop

    npm test            run the rules tests
    npm run typecheck   TypeScript strict check
    npm run build       static site in dist/

Game rules live in `src/core` and know nothing about the browser. See `docs/superpowers/` for the design spec and the implementation plan.
```

- [ ] **Step 4: Commit**

```bash
git add README.md src tests
git commit -m "docs: add README and playtest fixes"
```

- [ ] **Step 5: Ask the user before pushing**

Do not push on your own. Ask: "Milestone 1 is playable and committed locally. Shall I push to https://github.com/iurdivad-netizen/laser-tribute?" On a clear yes:

```bash
git push -u origin "$(git branch --show-current)"
```

- [ ] **Step 6: Write the vault Dev Log**

Per the user's global instructions, after reading `C:\Users\User\Documents\SecondBrain\_CLAUDE.md` and `index.md`, write `Dev Logs/2026-10-01 - Laser Tribute Milestone 1.md` in the SecondBrain vault covering the design decisions (browser, TypeScript and Canvas, core/render split, AP model with optional reaction fire), what was built, and open follow-ups (equipment screen, pixel font, soldier stats). Append a line to `Logs/YYYY-MM-DD.md`. Follow the vault's frontmatter and wikilink rules.

---

## Self-Review

**Spec coverage**

- Architecture (core, render, input, main, tests) is Tasks 2 to 10.
- Commands (Move, Turn, SnapShot, AimedShot, OpenDoor, CloseDoor, PickUp, Throw, EndTurn) and events are Tasks 4, 5 and 6.
- Map, units, AP costs, weapons, hit chance with cover, misses near the target, LOS and fog with explored memory, enemy AI (attack, advance, patrol), win and lose, reaction fire as a setting are Tasks 3 to 8.
- Rendering (scaled low-resolution canvas, 16px tiles, placeholder art, retro palette, event animations, bottom panel) is Task 9. The pixel font is replaced by an 8px monospace font; this is called out under the plan's decisions.
- Input (select, click to move with AP preview, hotkeys, cancel) is Task 10.
- Tooling (Vite, strict TypeScript, Vitest, git, optional GitHub) is Tasks 1 and 11.
- Error handling (rejected commands with reasons, UI messages) is Tasks 4 to 6 and the controller's `say`.
- Success criteria (full mission playable, rules covered by tests, core independent of the browser) is Task 11 plus the Global Constraint on imports.

**Placeholders:** none. Every code step has full code. Task 6 Step 6 deletes one Task 4 test that becomes obsolete, with the reason given.

**Type consistency:** `died` events carry `at` in the type (Task 2), in `fireShot` and `handleThrow` (Task 6), and in `Effects.add` (Task 9). `findPath` options, `stepBlockedReason`'s `ignoreUnits` argument, `Controller` method names, `ButtonId` values and `PANEL_BUTTONS` match across tasks. `Controller.run` returns boolean and is used that way by `moveAlong`.

**Review Focus:** items 1 to 3 are tested in Task 4 (`occupied`, validation block, `corner`), item 4 in Task 6 (`range`, `not visible`, `own side`), item 5 in Task 8 (`walled in`).
