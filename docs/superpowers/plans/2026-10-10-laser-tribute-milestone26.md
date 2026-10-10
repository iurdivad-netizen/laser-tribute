# Milestone 26: props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add props (crates, barrels, machines, boulders, pillars): low walls that block movement and give cover but not sight, two per theme, placed by the generator in place of about two thirds of its cover blocks.

**Architecture:** A prop is a `wall` tile with `low: true` and `prop: 0 | 1`, read from the map characters `x` and `y`. Only `hasLineOfSight` and the renderer treat it differently from a wall. The generator writes cover blocks as `#`, `x` or `y` by a fixed function of the position (no extra random draws, so every layout and every enemy position stays as it is). The theme table gets two prop images per theme, drawn by hand.

**Tech Stack:** TypeScript, Vitest, Canvas, Vite. Tests: `npx vitest run`, types: `npx tsc --noEmit` (tsc covers `tests/`).

**Spec:** `docs/superpowers/specs/2026-10-10-laser-tribute-milestone26-design.md`

## Global Constraints

- A prop is a `wall` tile: movement, corner cutting, route search, reachability, cover, the throw rule and the AI keep treating it as a wall. Only sight and the picture differ.
- `src/core` stays pure; saves, stash, loadout and campaign are untouched. The three tutorial maps, items and corpses are unchanged.
- The generator's random draws are unchanged: the cover character is a pure function of the position, `['#', 'x', 'y'][(x * 7 + y * 13) % 3]`.
- No PixelLab generations: the ten pieces are hand-drawn in `scripts/prop-art.mjs` and built by the existing step (`node scripts/build-figures.mjs`; if `figures.generated.ts` shows only a line-ending change, `git checkout src/art/figures.generated.ts`).
- Generated maps may change where a prop now lets an enemy see the squad at the start (the generator then tries the next attempt): the map fingerprint and the enemy-turn golden fingerprints are re-recorded on purpose, with the old and new values in the commit message.
- Baseline: 1561 tests green on `milestone-26`. Every task ends with the whole suite green and `npx tsc --noEmit` clean.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A prop must never count as floor anywhere the generator or the checks decide where units, items, patrols or doors may be (reachability, patrol routes, door fit, the border, placement).
- Sight over a prop must not leak: the shot tint, the odds line, `computeVisible` and the AI all follow `hasLineOfSight`; an enemy must not be able to see the squad at the start across a prop.
- A prop next to a real wall: the wall's edge, the prop and the floor under it must all draw correctly, and only on explored tiles.
- `isCovered`, `handleThrow`, `blastTiles`, `shotTiles` and the wall-edge mask all test `kind === 'wall'`: each must give the intended result for a low wall.
- The re-recorded fingerprints must come from the final generator, not an intermediate one.

## File Structure

- Modify `src/core/types.ts`, `src/core/mission.ts`, `src/core/vision.ts`: tile fields, the `x`/`y` characters, the sight rule.
- Modify `src/core/gen/grid.ts`, `check.ts`, `populate.ts`, `layout.ts`: `isSolid`, the checks, the cover characters.
- Create `scripts/prop-art.mjs`; modify `scripts/hand-images.mjs`, `scripts/figures-lib.mjs`, `scripts/figures-lib.d.mts`; regenerate `src/art/images.generated.ts`.
- Modify `src/art/theme.ts` (props per theme, `propImage`), `src/art/gallery.ts`, `src/render/renderer.ts`, `src/render/wallmask.ts`.
- Create tests: `tests/props.test.ts`, `tests/propgen.test.ts`, `tests/propcheck.test.ts`, `tests/propart.test.ts`, `tests/propdraw.test.ts`; update `tests/genfingerprint.test.ts`, `tests/aigolden.test.ts`, `tests/gallery.test.ts`.

---

### Task 1: Props in the rules: tiles, map text, sight

**Files:**
- Modify: `src/core/types.ts`, `src/core/mission.ts`, `src/core/vision.ts`
- Test: `tests/props.test.ts`

**Interfaces:**
- Produces: `Tile.low?: boolean`, `Tile.prop?: 0 | 1`; `parseMap` reads `x` and `y`; `hasLineOfSight` skips a low wall.

- [ ] **Step 1: Write the failing test**

```ts
// tests/props.test.ts
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { isCovered } from '../src/core/combat';
import { findPath } from '../src/core/path';
import { canSee, computeVisible, hasLineOfSight } from '../src/core/vision';
import { makeState, ok, reason, unit } from './helpers';

describe('props in the map text', () => {
  it('reads x and y as low wall tiles of the two variants, and # as a plain wall', () => {
    const s = makeState(['#####', '#x.y#', '#####']);
    expect(s.tiles[1][1]).toEqual({ kind: 'wall', open: false, low: true, prop: 0 });
    expect(s.tiles[1][3]).toEqual({ kind: 'wall', open: false, low: true, prop: 1 });
    expect(s.tiles[0][0]).toEqual({ kind: 'wall', open: false });
    expect(s.tiles[1][2].kind).toBe('floor');
  });
});

describe('sight over a prop', () => {
  const row = (mid: string) => makeState(['#######', `#P.${mid}.E#`, '#######']);

  it('passes a prop but not a wall or a closed door', () => {
    const over = row('x');
    const p = unit(over, 'p1');
    p.facing = 2;
    expect(hasLineOfSight(over, p.pos, unit(over, 'e1').pos)).toBe(true);
    expect(canSee(over, p, unit(over, 'e1').pos)).toBe(true);
    for (const blocker of ['#', '+']) {
      const s = row(blocker);
      expect(hasLineOfSight(s, unit(s, 'p1').pos, unit(s, 'e1').pos), blocker).toBe(false);
    }
  });

  it('lets the visibility grid and the squad see tiles behind a prop', () => {
    const s = row('y');
    unit(s, 'p1').facing = 2;
    const seen = computeVisible(s, 'player');
    expect(seen[1][5]).toBe(true); // the enemy tile, behind the prop at x = 3
    expect(seen[1][3]).toBe(true); // the prop tile itself
  });
});

describe('a prop is a wall for everything but sight', () => {
  it('refuses a step onto a prop and routes around it', () => {
    const s = makeState(['#######', '#.....#', '#P.x.E#', '#.....#', '#######']);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 3, y: 2 } }))).toMatch(/wall/i);
    const path = findPath(s, 'p1', { x: 5, y: 2 }, { ignoreOccupantAtGoal: true })!;
    expect(path.some((p) => p.x === 3 && p.y === 2)).toBe(false);
    expect(path.length).toBeGreaterThan(0);
  });

  it('refuses to cut a corner past a prop', () => {
    const s = makeState(['#####', '#P..#', '#x..#', '#####']);
    expect(reason(applyCommand(s, { type: 'Move', unitId: 'p1', to: { x: 2, y: 2 } }))).toMatch(/corner/i);
  });

  it('gives cover to a unit with a prop on the shooter side', () => {
    const s = makeState(['#########', '#P.x...E#', '#########']);
    const shooter = unit(s, 'p1').pos;
    // the target stands directly behind the prop, seen from the shooter: the prop is a wall next to it, nearer to the shooter
    const behind = makeState(['#########', '#P..xE..#', '#########']);
    expect(isCovered(behind, unit(behind, 'p1').pos, unit(behind, 'e1').pos)).toBe(true);
    expect(isCovered(s, shooter, unit(s, 'e1').pos)).toBe(false);
  });

  it('cannot be thrown onto, but a throw can pass it', () => {
    const s = makeState(['#########', '#P.x....#', '#########']);
    const p = unit(s, 'p1');
    p.facing = 2;
    p.grenades = 2;
    expect(reason(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 4, y: 1 } }))).toMatch(/wall/i);
    ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 6, y: 1 } }));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/props.test.ts`
Expected: FAIL (`x` and `y` are read as floor; sight is blocked only by walls and doors).

- [ ] **Step 3: Implement**

`src/core/types.ts` `Tile`:

```ts
export interface Tile {
  kind: TileKind;
  open: boolean; // only meaningful when kind === 'door'
  /** A low wall (a prop): it blocks movement like a wall but not sight. Only set on wall tiles. */
  low?: boolean;
  /** Which of the theme's two props a low wall shows. */
  prop?: 0 | 1;
}
```

`src/core/mission.ts` `parseMap`, before the `'#'` branch:

```ts
      if (ch === 'x' || ch === 'y') {
        line.push({ kind: 'wall', open: false, low: true, prop: ch === 'x' ? 0 : 1 });
        return;
      }
```

`src/core/vision.ts` `hasLineOfSight`, replace the blocking test inside the loop:

```ts
    const t = tileAt(s, tiles[i]);
    if (isBlocking(t) && !(t.kind === 'wall' && t.low)) return false; // a low wall (a prop) can be seen over
    if (!ignoreSmoke && smokeAt(s, tiles[i])) return false;
```

- [ ] **Step 4: Run, typecheck, whole suite**

Run: `npx vitest run tests/props.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS; clean; the suite stays green (no existing map uses `x` or `y`).

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "feat: props as low walls: map text, tile fields, sight over them" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The generator and its checks

**Files:**
- Modify: `src/core/gen/grid.ts`, `src/core/gen/check.ts`, `src/core/gen/populate.ts`, `src/core/gen/layout.ts`, `tests/genfingerprint.test.ts`, `tests/aigolden.test.ts`
- Test: `tests/propcheck.test.ts`, `tests/propgen.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `isSolid(ch)` in `grid.ts`; `scatterCover` writing `#`, `x`, `y` by `(x * 7 + y * 13) % 3`; checks that treat `x` and `y` as walls for walking.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/propcheck.test.ts
import { describe, expect, it } from 'vitest';
import { checkMission, type Expect } from '../src/core/gen/check';
import { isSolid } from '../src/core/gen/grid';
import type { MissionDef } from '../src/core/missions';

const def = (rows: string[], patrols: MissionDef['patrols']): MissionDef => ({ id: 't', name: 'T', rows, patrols });
const want = (width: number, height: number, items = { r: 0, p: 0, g: 0 }): Expect => ({ width, height, enemies: 1, items });

describe('isSolid', () => {
  it('is true for a wall and for both props, false for floor, doors, units and items', () => {
    for (const c of ['#', 'x', 'y']) expect(isSolid(c)).toBe(true);
    for (const c of ['.', '+', 'P', 'E', 'r', 'p', 'g', undefined]) expect(isSolid(c as string | undefined)).toBe(false);
  });
});

describe('checkMission with props', () => {
  const ROWS = [
    '######################',
    '#PP.......#.....E....#',
    '#PP.......+..........#',
    '#.........#..........#',
    '######################',
  ];
  const patrol = { e1: [{ x: 12, y: 3 }, { x: 16, y: 1 }] };

  it('accepts a map with props standing in the open', () => {
    const rows = [...ROWS];
    rows[2] = rows[2].replace('+..........', '+..x.....y..');
    expect(checkMission(def(rows, patrol), want(22, 5))).toEqual([]);
  });

  it('does not count a floor tile enclosed by props as reachable', () => {
    const closed = [
      '######################',
      '#PP.......#.....E....#',
      '#PP.......+.xxx......#',
      '#.........#.x.x......#',
      '######################',
    ];
    // the floor tile between the props (x = 14, y = 3) is walled in by props on three sides and the wall below
    expect(checkMission(def(closed, patrol), want(22, 5)).join('|')).toMatch(/cannot be reached/);
  });

  it('refuses a patrol point on a prop', () => {
    const rows = [...ROWS];
    rows[3] = rows[3].replace('..........#', '...x......#');
    const bad = { e1: [{ x: 14, y: 3 }, { x: 16, y: 1 }] };
    expect(checkMission(def(rows, bad), want(22, 5)).join('|')).toMatch(/cannot be walked to/);
  });

  it('finds that an enemy sees the squad across a prop, as across open floor', () => {
    const rows = [
      '#############',
      '#PP.....x.E.#',
      '#PP.........#',
      '#...........#',
      '#############',
    ];
    const problems = checkMission(def(rows, { e1: [{ x: 9, y: 2 }, { x: 10, y: 3 }] }), want(13, 5)).join('|');
    expect(problems).toMatch(/sees the squad|within 8 tiles/);
  });
});
```

```ts
// tests/propgen.test.ts
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, generateMission } from '../src/core/gen';
import { checkMission, expectFor } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';

const OPEN = new Set(['.', 'P', 'E', 'r', 'p', 'g']);

describe('props in generated maps', () => {
  it('every map type and variation still passes the playability checks', () => {
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const def = generateMission(type, v);
        expect(checkMission(def, expectFor(RECIPES[type])), `type ${type} variation ${v}`).toEqual([]);
      }
    }
  });

  it('puts props where the cover blocks were: about two thirds of the blocks, and every prop stands in open floor', () => {
    let props = 0;
    let pillars = 0;
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const rows = generateMission(type, v).rows;
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
          const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => rows[y + dy]?.[x + dx]));
          if (ch === 'x' || ch === 'y') {
            props++;
            expect(around.every((c) => c !== undefined && OPEN.has(c)), `prop at ${x},${y} of ${type}/${v}`).toBe(true);
          } else if (ch === '#' && around.every((c) => c !== undefined && OPEN.has(c))) {
            pillars++; // a lone wall block with open floor all round: a tall pillar
          }
        }));
      }
    }
    expect(props).toBeGreaterThan(50);
    expect(pillars).toBeGreaterThan(10);
    const share = props / (props + pillars);
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.8);
  });

  it('uses both prop variants', () => {
    const all = Array.from({ length: CAMPAIGN_LENGTH }, (_, t) => generateMission(t, 0).rows.join('')).join('');
    expect(all).toMatch(/x/);
    expect(all).toMatch(/y/);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/propcheck.test.ts tests/propgen.test.ts`
Expected: FAIL (`isSolid` not exported; generated maps have no props).

- [ ] **Step 3: Implement**

`src/core/gen/grid.ts` add:

```ts
/** A wall or a prop: neither can be walked through. (Sight sees over a prop but not over a wall; that is the game's rule, not the map generator's.) */
export const isSolid = (c: string | undefined): boolean => c === '#' || c === 'x' || c === 'y';
```

`src/core/gen/check.ts`: import `isSolid`; then

```ts
const isFloor = (c: string | undefined): boolean => c !== undefined && !isSolid(c) && c !== '+';

function doorFits(g: Grid, x: number, y: number): boolean {
  const n = g[y - 1]?.[x], s = g[y + 1]?.[x], w = g[y][x - 1], e = g[y][x + 1];
  return (isSolid(n) && isSolid(s) && isFloor(w) && isFloor(e)) || (isSolid(w) && isSolid(e) && isFloor(n) && isFloor(s));
}
```

and in `checkMission`: `reach = distances(grid, squad[0], (c) => !isSolid(c));`, the cut test `if (!isSolid(ch) && reach![y][x] < 0) cut = true;`, the patrol search `distances(grid, foe.pos, (c) => !isSolid(c) && c !== '+')`, and `grid[p.y][p.x] === '#'` becomes `isSolid(grid[p.y][p.x])`. The border test stays `ch !== '#'` (a border tile must be a wall).

`src/core/gen/populate.ts`: import `isSolid`; the patrol search becomes `distances(g, start, (c) => !isSolid(c) && c !== '+')`.

`src/core/gen/layout.ts` `scatterCover`: replace `g[y][x] = '#';` with

```ts
    g[y][x] = COVER_CHARS[(x * 7 + y * 13) % 3]; // a pillar or one of the two props, by position: no extra random draws
```

and add `const COVER_CHARS = ['#', 'x', 'y'] as const;` above it; update the function's comment to say that about two thirds of the blocks are props (which block movement but not sight) and the rest tall pillars.

- [ ] **Step 4: Re-record the fingerprints**

Run `npx vitest run tests/genfingerprint.test.ts tests/aigolden.test.ts 2>&1 | grep -E "expected|GOLDEN"`. The fingerprint test fails with the new value in its message: put it in `tests/genfingerprint.test.ts` replacing `76c314ad`, and note in the commit message the old value `76c314ad` and the new one. For `tests/aigolden.test.ts`, empty the `GOLDEN` table, run once to print the twenty `GOLDEN` lines, paste them back, run again to confirm the run is repeatable. (The golden test exists to compare against the code before a rewrite; after a deliberate map change it is re-recorded.)

- [ ] **Step 5: Run everything and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; all green, including the generator tests (`gencheck`, `genmissions`, `genplay`, `genpopulate`).

```bash
git add src tests && git commit -m "feat: the generator writes props and tall pillars for its cover blocks; checks treat props as walls

Map fingerprint 76c314ad -> <new value>; enemy-turn goldens re-recorded." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The ten pieces, the theme table and the gallery

**Files:**
- Create: `scripts/prop-art.mjs`
- Modify: `scripts/hand-images.mjs`, `scripts/figures-lib.mjs`, `scripts/figures-lib.d.mts`, `src/art/theme.ts`, `src/art/gallery.ts`, `tests/gallery.test.ts`, `tests/imagesdata.test.ts` (counts)
- Test: `tests/propart.test.ts`

**Interfaces:**
- Produces: image names `prop_supply_crate`, `prop_oil_drum`, `prop_wood_crate`, `prop_barrel`, `prop_machine`, `prop_tank`, `prop_boulder`, `prop_rocks`, `prop_pillar`, `prop_urn`; `Theme.props`; `propImage(theme, variant)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/propart.test.ts
import { describe, expect, it } from 'vitest';
import { imageOf } from '../src/art/image';
import { THEMES, propImage } from '../src/art/theme';
import { THEME_IDS } from '../src/core/themes';

const NAMES = ['prop_supply_crate', 'prop_oil_drum', 'prop_wood_crate', 'prop_barrel', 'prop_machine', 'prop_tank', 'prop_boulder', 'prop_rocks', 'prop_pillar', 'prop_urn'] as const;
const BY_THEME: Record<string, [string, string]> = {
  base: ['prop_supply_crate', 'prop_oil_drum'],
  timber: ['prop_wood_crate', 'prop_barrel'],
  steel: ['prop_machine', 'prop_tank'],
  cave: ['prop_boulder', 'prop_rocks'],
  stone: ['prop_pillar', 'prop_urn'],
};

describe('the ten prop images', () => {
  for (const name of NAMES) {
    it(`${name} is a 16x16 drawing with transparent corners and a dark outline`, () => {
      const f = imageOf(name);
      expect([f.width, f.height]).toEqual([16, 16]);
      for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) expect(f.pixels[y * 16 + x]).toBeNull();
      const opaque = f.pixels.filter((p) => p !== null).length;
      expect(opaque).toBeGreaterThan(40);
      expect(opaque).toBeLessThan(200);
      expect(f.pixels).toContain('#0b0c12');
    });
  }

  it('are all different drawings', () => {
    const seen = new Set(NAMES.map((n) => imageOf(n).pixels.join('|')));
    expect(seen.size).toBe(10);
  });
});

describe('propImage', () => {
  it('gives each theme its two props, the same object every time', () => {
    for (const id of THEME_IDS) {
      for (const v of [0, 1] as const) {
        expect(propImage(id, v).name).toBe(BY_THEME[id][v]);
        expect(propImage(id, v)).toBe(propImage(id, v));
      }
      expect(THEMES[id].props).toEqual(BY_THEME[id]);
    }
  });

  it('falls back to base for an unknown or inherited theme id', () => {
    expect(propImage('swamp', 0).name).toBe('prop_supply_crate');
    expect(propImage('constructor', 1).name).toBe('prop_oil_drum');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/propart.test.ts`
Expected: FAIL (the images and `propImage` do not exist).

- [ ] **Step 3: The art and the build step**

Create `scripts/prop-art.mjs` with this content (ten hand-drawn pieces, one palette each; every row is exactly 16 characters and `.` is transparent):

```js
/**
 * The ten prop pieces, hand-drawn: a one-character palette and 16 rows of 16 characters (`.` is transparent). They stand in
 * the lower part of the tile with a dark outline; each theme has two (see THEMES in src/art/theme.ts).
 */
export const PROP_IMAGES = {
  prop_supply_crate: {
    palette: { k: '#0b0c12', a: '#6b7a4a', A: '#4f5c36', b: '#8c9a64', m: '#8a8a99' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '..kbbbbbbbbbbk..',
      '..kbbbbbbbbbbk..',
      '..kmmmmmmmmmmk..',
      '..kaaaaaaaaaak..',
      '..kaaaaaaaaaak..',
      '..kmmmmmmmmmmk..',
      '..kAAAAAAAAAAk..',
      '..kAAAAAAAAAAk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
  prop_oil_drum: {
    palette: { k: '#0b0c12', a: '#5a6b7d', A: '#3f4d5c', b: '#7d8fa3', r: '#b5651d' },
    rows: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....kbbbbbbk....',
      '....kaaaaaak....',
      '....krrrrrrk....',
      '....kaaaaaak....',
      '....kaaaaaak....',
      '....krrrrrrk....',
      '....kaaaaaak....',
      '....kAAAAAAk....',
      '....kAAAAAAk....',
      '.....kkkkkk.....',
      '................',
      '................',
      '................',
    ],
  },
  prop_wood_crate: {
    palette: { k: '#0b0c12', a: '#b5803a', A: '#7a5222', b: '#d9a65a' },
    rows: [
      '................',
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '..kbbbbbbbbbbk..',
      '..kaAaaaaaaAak..',
      '..kaaAaaaaAaak..',
      '..kaaaAaaAaaak..',
      '..kaaaaAAaaaak..',
      '..kaaaAaaAaaak..',
      '..kaaAaaaaAaak..',
      '..kaAaaaaaaAak..',
      '..kAAAAAAAAAAk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
    ],
  },
  prop_barrel: {
    palette: { k: '#0b0c12', a: '#a8702e', A: '#6b4420', b: '#cf9548', m: '#4a4a55' },
    rows: [
      '................',
      '................',
      '.....kkkkkk.....',
      '...kkbbbbbbkk...',
      '...kbaaaaaabk...',
      '...kmmmmmmmmk...',
      '...kaaaaaaaak...',
      '...kaaaaaaaak...',
      '...kmmmmmmmmk...',
      '...kaaaaaaaak...',
      '...kAAAAAAAAk...',
      '...kkAAAAAAkk...',
      '.....kkkkkk.....',
      '................',
      '................',
      '................',
    ],
  },
  prop_machine: {
    palette: { k: '#0b0c12', a: '#5d6b7a', A: '#3f4a57', b: '#8da0b4', y: '#ffe14d', g: '#3cb371', r: '#e04040' },
    rows: [
      '................',
      '................',
      '..kkkkkkkkkkkk..',
      '..kbbbbbbbbbbk..',
      '..kbaaaaaaaabk..',
      '..kbakkkkkkabk..',
      '..kbakggggkabk..',
      '..kbakkkkkkabk..',
      '..kbaaaaaaaabk..',
      '..kbayaraaaabk..',
      '..kbaaaaaaaabk..',
      '..kAAAAAAAAAAk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
      '................',
    ],
  },
  prop_tank: {
    palette: { k: '#0b0c12', a: '#6a7f94', A: '#46566a', b: '#aebdcb', o: '#e08a30' },
    rows: [
      '................',
      '................',
      '.......oo.......',
      '.......kk.......',
      '...kkkkkkkkkk...',
      '..kbbbbbbbbbbk..',
      '.kbaaaaaaaaaabk.',
      '.kaaaAaaaaAaaak.',
      '.kaaaAaaaaAaaak.',
      '.kaaaAaaaaAaaak.',
      '.kAaaAaaaaAaaAk.',
      '..kAAAAAAAAAAk..',
      '...kkkkkkkkkk...',
      '................',
      '................',
      '................',
    ],
  },
  prop_boulder: {
    palette: { k: '#0b0c12', a: '#6e7a6a', A: '#4a5448', b: '#98a692' },
    rows: [
      '................',
      '................',
      '................',
      '.....kkkkk......',
      '...kkbbbbbkk....',
      '..kbbbaaaabbk...',
      '.kbbaaaaaaaabk..',
      '.kbaaaaAaaaaak..',
      '.kaaaaaaaaAaak..',
      '.kaaAaaaaaaaAk..',
      '.kAaaaaaaaaAAk..',
      '..kAAAAAAAAAk...',
      '...kkkkkkkkk....',
      '................',
      '................',
      '................',
    ],
  },
  prop_rocks: {
    palette: { k: '#0b0c12', a: '#6e7a6a', A: '#4a5448', b: '#98a692' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '..........kkk...',
      '....kkk..kbbak..',
      '...kbbak.kaaAk..',
      '..kbaaAkkkaAAk..',
      '..kaaAAkbbkAAk..',
      '.kkAAAkbaakkk...',
      '.kbakkkaaAAk....',
      '.kaaAAkAAAAk....',
      '..kkkkkkkkk.....',
      '................',
      '................',
      '................',
    ],
  },
  prop_pillar: {
    palette: { k: '#0b0c12', a: '#9a9ea6', A: '#6a6e76', b: '#d4d6da' },
    rows: [
      '................',
      '...kkkkkkkkkk...',
      '..kbbbbbbbbbbk..',
      '..kAAAAAAAAAAk..',
      '....kbaaaaAk....',
      '....kbaaaaAk....',
      '....kbaaaaAk....',
      '....kbaaaaAk....',
      '....kbaaaaAk....',
      '....kbaaaaAk....',
      '..kbbbbbbbbbbk..',
      '..kAAAAAAAAAAk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
      '................',
    ],
  },
  prop_urn: {
    palette: { k: '#0b0c12', a: '#a8844a', A: '#6e5430', b: '#d9bd7e', d: '#3a2a18' },
    rows: [
      '................',
      '................',
      '.....kkkkkk.....',
      '.....kbbbbk.....',
      '......kddk......',
      '.....kbaabk.....',
      '....kbaaaabk....',
      '...kbaaaaaabk...',
      '...kaaaaaaaak...',
      '...kaaaaaaaAk...',
      '....kaaaaaAk....',
      '....kAAAAAAk....',
      '.....kkkkkk.....',
      '................',
      '................',
      '................',
    ],
  },
};
```

In `scripts/hand-images.mjs`: `import { PROP_IMAGES } from './prop-art.mjs';` and spread it into `HAND_IMAGES` (`...PROP_IMAGES,` as the last entry). In `scripts/figures-lib.mjs` add the ten names to `IMAGE_NAMES` and ten entries to `IMAGE_SOURCES` (`prop_supply_crate: 'props/supply_crate'` and so on, one per name; no PNG exists so the hand entry is used); in `scripts/figures-lib.d.mts` add the ten names to the `IMAGE_NAMES` tuple type. Then:

Run: `node scripts/build-figures.mjs` (and `git checkout src/art/figures.generated.ts` if only line endings changed).
Expected: `wrote src/art/images.generated.ts: 24 images`.

- [ ] **Step 4: The theme table, `propImage` and the gallery**

`src/art/theme.ts`: add `props: readonly [ImageName, ImageName];` to `Theme`; add to each theme in `THEMES` `props: [...]` per the table in `tests/propart.test.ts` (`BY_THEME`); add

```ts
/** The prop image of a theme: variant 0 or 1. An unknown or inherited theme id gives the base theme's. */
export function propImage(theme: string, variant: 0 | 1): Figure {
  const id: ThemeId = (THEME_IDS as readonly string[]).includes(theme) ? (theme as ThemeId) : 'base';
  return imageOf(THEMES[id].props[variant]);
}
```

`src/art/gallery.ts`: remove the digits-and-symbols sample line (`drawText(ctx, "0123456789 ...", 4, 364, ...)`), draw the ten props in one row at `y = 362` (each theme's two props side by side, a 6 px gap between themes: `x = 4 + themeIndex * 40 + variant * 17`) with `art.drawImage(ctx, propImage(id, v), x, 362)`, and move the wall-variant row from `y = 376` to `y = 382`. Update `tests/gallery.test.ts`: figures length 99 (89 plus the ten props, drawn before the wall variants), unique names 93; the ten props at `y = 362`, the 25 wall variants at `y = 382`, all inside the 480x400 canvas. Update the image-count assertions (`tests/imagesdata.test.ts`: `toHaveLength(24)` and its title; `tests/gallery.test.ts`: `slice(0, 24)` of `IMAGE_NAMES` replaces `slice(0, 14)` and the gallery's own `IMAGE_LIST` in `src/art/gallery.ts` gets the ten names appended so the first row shows them too; keep the row inside 480 px by drawing the images at `x = 4 + i * 19` (24 images x 19 = 456)).

- [ ] **Step 5: Run everything and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; all green (including the generated-image drift test).

```bash
git add src tests scripts && git commit -m "feat: ten hand-drawn props, two per theme, and the gallery row" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The renderer, the wall-edge rule and the in-game look

**Files:**
- Modify: `src/render/renderer.ts`, `src/render/wallmask.ts`
- Test: `tests/propdraw.test.ts`; extend `tests/wallmask.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces: low walls drawn as floor then prop; a low wall counts as open ground for the wall-edge mask.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/propdraw.test.ts
import { describe, expect, it } from 'vitest';
import { Atlas, type CanvasLike } from '../src/art/atlas';
import { createMission, MISSIONS } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawGame } from '../src/render/renderer';

class FakeCanvas implements CanvasLike {
  constructor(public width: number, public height: number) {}
  getContext() { return { fillStyle: '', fillRect() {} }; }
}
const ctx = new Proxy({}, { get: () => () => ({ width: 0 }), set: () => true }) as unknown as CanvasRenderingContext2D;

/** Every tile image drawn, in order, with its tile coordinates. */
function drawn(state: GameState): { name: string; x: number; y: number }[] {
  const out: { name: string; x: number; y: number }[] = [];
  const atlas = new Atlas((w, h) => new FakeCanvas(w, h));
  const real = atlas.drawImage.bind(atlas);
  atlas.drawImage = (c, fig, x, y, o = {}) => {
    if (/^(floor|wall|prop)/.test(fig.name)) out.push({ name: fig.name, x: x / 16, y: y / 16 });
    return real(c, fig, x, y, o);
  };
  drawGame(ctx, state, createUiState('p1'), new Effects(), 0, atlas);
  return out;
}

function withProp(): { state: GameState; at: { x: number; y: number } } {
  const state = createMission(MISSIONS[0], 1);
  state.explored = state.explored.map((r) => r.map(() => true));
  const at = { x: 0, y: 0 };
  outer: for (let y = 2; y < state.height - 2; y++) {
    for (let x = 2; x < state.width - 2; x++) {
      if (state.tiles[y][x].kind === 'floor') { state.tiles[y][x] = { kind: 'wall', open: false, low: true, prop: 1 }; at.x = x; at.y = y; break outer; }
    }
  }
  return { state, at };
}

describe('drawing a prop', () => {
  it('draws the floor and then the prop of the theme on an explored prop tile', () => {
    const { state, at } = withProp();
    const here = drawn(state).filter((d) => d.x === at.x && d.y === at.y);
    expect(here.map((d) => d.name)).toEqual([expect.stringMatching(/^floor_[abc]$/), 'prop_oil_drum']);
  });

  it('uses the theme of the mission for the prop', () => {
    const { state, at } = withProp();
    state.theme = 'timber';
    const here = drawn(state).filter((d) => d.x === at.x && d.y === at.y);
    expect(here[here.length - 1].name).toBe('prop_barrel');
  });

  it('draws nothing on an unexplored prop tile', () => {
    const { state, at } = withProp();
    state.explored[at.y][at.x] = false;
    expect(drawn(state).filter((d) => d.x === at.x && d.y === at.y)).toEqual([]);
  });

  it('draws a plain wall as before (an autotiled wall image, no prop)', () => {
    const { state } = withProp();
    const names = drawn(state).map((d) => d.name);
    expect(names.some((n) => /^wall(#\d+)?$/.test(n))).toBe(true);
    expect(names.filter((n) => n.startsWith('prop_'))).toHaveLength(1);
  });
});
```

Add to `tests/wallmask.test.ts`:

```ts
  it('counts a prop as open ground for the wall beside it', () => {
    const s = seen(['#x#', '###', '###']);
    expect(wallMask(s, 1, 1)).toBe(N);
    const edge = seen(['###', '#x#', '###']);
    expect(wallMask(edge, 0, 1)).toBe(E);
    edge.explored[1][1] = false;
    expect(wallMask(edge, 0, 1)).toBe(0);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/propdraw.test.ts tests/wallmask.test.ts`
Expected: FAIL (the renderer draws a wall image on the prop tile, and the mask treats the prop as solid).

- [ ] **Step 3: Implement**

`src/render/wallmask.ts` `open`: replace the kind test with

```ts
    const tile = s.tiles[ny][nx];
    return (tile.kind === 'floor' || tile.kind === 'door' || (tile.kind === 'wall' && !!tile.low)) && s.explored[ny][nx];
```

(and update the doc comment: a prop counts as open ground; a plain wall, the map edge and unexplored tiles are solid).

`src/render/renderer.ts`: import `propImage` from `../art/theme`; in the tile loop replace `art.drawImage(ctx, tileFigure(state, x, y), x * T, y * T);` with

```ts
      const tile = state.tiles[y][x];
      if (tile.kind === 'wall' && tile.low) {
        // a prop: the floor under it, then the prop of the theme
        art.drawImage(ctx, tileImage(themeFor(state), 'floor', false, x, y), x * T, y * T);
        art.drawImage(ctx, propImage(themeFor(state), tile.prop ?? 0), x * T, y * T);
      } else {
        art.drawImage(ctx, tileFigure(state, x, y), x * T, y * T);
      }
```

(`tileFigure` already returns the autotiled wall image for plain walls.)

- [ ] **Step 4: Run, typecheck, whole suite**

Run: `npx vitest run tests/propdraw.test.ts tests/wallmask.test.ts && npx tsc --noEmit && npx vitest run`
Expected: PASS; clean; suite green.

- [ ] **Step 5: A look at every map type**

Start `laser-tribute-dev`. For each of the ten map types (campaign: set `app.campaign.missionIndex = i; app.campaign.missionsWon = i` in the console, press Start mission as in milestone 23) screenshot the whole map explored (`state.explored` all true, whole-map zoom) and the normal fog start. Check: props read as the right objects against their floor; props and tall pillars are clearly different; props do not block the view (see over one); no unit, item or door sits on a prop; a unit beside a prop shows cover in the odds line. Note anything that reads poorly.

- [ ] **Step 6: Tune and commit**

If a piece reads poorly, redraw it in `scripts/prop-art.mjs` (first add an assertion to `tests/propart.test.ts` that captures the problem, such as a minimum opaque pixel count), rebuild, re-run the suite and re-take the screenshot. Change the share of props only through the position function (`% 3` and `COVER_CHARS`), and re-record the fingerprints in the same commit.

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: clean, green, build succeeds.

```bash
git add src tests scripts && git commit -m "feat: props are drawn on the floor of explored tiles and open the wall edge beside them" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## After the tasks

Final whole-branch review by a fresh Opus reviewer using the spec, this plan's Review Focus and the ledger rulings; one fix pass (each fix RED then GREEN, whole suite green); then push `milestone-26`, give Rui the PR link, and after "pushed and merged" sync master, run the suite, check the live bundle and write the vault notes. If the deploy fails with "Multiple artifacts" or "Found 0 artifacts", the fix is a fresh run of the workflow from the Actions tab, not Re-run jobs.
