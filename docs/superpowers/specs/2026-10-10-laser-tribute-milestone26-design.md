# Laser Tribute Milestone 26: props

## Goal

Fill the map rooms with props: crates, barrels, machines, boulders, pillars. A prop blocks movement and gives cover like a wall, but unlike a wall you can see over it. Each theme has two props of its own (ten hand-drawn pieces). The generator turns most of the existing single cover blocks into props.

Not in this milestone: decoration props that units walk over (a later milestone), props in the three hand-drawn tutorial maps, destructible or movable props, throwing onto a prop tile, enemy corpses holding lootable gear (a separate feature, to be discussed), more pickups.

## Decisions (from the brainstorm)

- Props affect the game: they block movement and give cover (option C); decoration-only props come later (option D).
- Ten distinct drawn props, two per theme (option B), hand-drawn: PixelLab cannot cover them (about 4 generations per piece, about 22 left).
- The generator's existing cover blocks become props for about two thirds of them; the rest stay as tall wall pillars that also block sight (option C).
- Implementation: props are low walls (approach 1). Everything that treats walls as walls keeps working; only sight and the picture change.

## Constraints

- A prop is a `wall` tile with `low: true` and `prop: 0 | 1`. Movement, corner cutting, route search, reachability, cover, the AI and the throw rule keep treating it as a wall. Only the sight rule and the drawing differ.
- `src/core` stays pure; saves, the stash, the loadout and the campaign are untouched (map text and tile data are not saved).
- Maps change (generated maps get props), so the map fingerprint changes on purpose; every generated map type and variation must still pass `checkMission`.
- No PixelLab generations. The ten pieces are hand-drawn through the existing build step.
- The three tutorial maps and the existing hand-drawn items and corpses are unchanged.

## Data and map text

`Tile` (in `src/core/types.ts`) gets two optional fields: `low?: boolean` and `prop?: 0 | 1`. `parseMap` (in `src/core/mission.ts`) reads `x` as `{ kind: 'wall', open: false, low: true, prop: 0 }` and `y` as `{ kind: 'wall', open: false, low: true, prop: 1 }`. `#` stays a plain wall. The characters `x` and `y` are not used by units, items or doors.

## Sight

`hasLineOfSight` (in `src/core/vision.ts`) skips a tile that is a low wall (`tile.kind === 'wall' && tile.low`) as it walks the line; a plain wall and a closed door still block. `canSee`, `computeVisible`, the shot tint and the odds line follow, because they all use it. `isBlocking` in `src/core/geometry.ts` is unchanged, so corner cutting and movement still treat a low wall as a wall.

## Cover and throwing

No change in the rules: the cover rule counts neighbouring `wall` tiles (a low wall is one), and the throw rule refuses a `wall` tile (a low wall too). A blast area excludes `wall` tiles as it does today; a line of throw passes a low wall because it uses `hasLineOfSight`.

## Generation

`scatterCover` in `src/core/gen/layout.ts` writes each cover block as `x` or `y` with probability 1/3 each, and as `#` with probability 1/3 (so about two thirds of the blocks are props, split evenly between the two). The count, the placement rule (all eight neighbours floor) and the random draws that decide positions stay as they are, so the layouts keep their shape; the extra draws are made after the position is chosen.

Everything that reads map characters learns that `x` and `y` are walls for walking:
- `src/core/gen/check.ts`: the floor test (`isFloor`), the doorway pattern, reachability from the squad, patrol reachability, and the border test treat `x` and `y` like `#` for walking. "Enemy sees the squad at the start" uses `parseMap` and `hasLineOfSight`, so it uses the new sight rule automatically.
- `src/core/gen/populate.ts`: floors are `.` only, so units and items are never placed on a prop; the patrol distance search treats `x` and `y` as impassable.
- A shared helper `isSolid(ch)` (`#`, `x` or `y`) in `src/core/gen/grid.ts` replaces the inline comparisons.

The recorded generated-map fingerprint (`tests/genfingerprint.test.ts`) is updated on purpose; the plan records the old and new values.

## Art and theme table

Ten hand-drawn 16x16 pieces in `scripts/hand-images.mjs`, built into `src/art/images.generated.ts` by `node scripts/build-figures.mjs` (the converter's image list, source map and type are extended like they were for the item images). They are drawn standing in the lower part of the tile with transparent corners and a dark `#0b0c12` outline.

| Theme | Prop 0 | Prop 1 |
|---|---|---|
| Concrete (base) | `prop_supply_crate` | `prop_oil_drum` |
| Timber | `prop_wood_crate` | `prop_barrel` |
| Steel | `prop_machine` | `prop_tank` |
| Cave | `prop_boulder` | `prop_rocks` |
| Stone | `prop_pillar` | `prop_urn` |

`Theme` in `src/art/theme.ts` gets `props: readonly [ImageName, ImageName]`. `propImage(theme: string, variant: 0 | 1): Figure` returns that theme's piece (an unknown or inherited theme id falls back to `base`). The props are real drawings and are not recoloured.

## Renderer

`tileFigure` in `src/render/renderer.ts` draws a low wall as two images on an explored tile: the floor variant for that position (as a floor tile), then `propImage(theme, tile.prop)` over it. A plain wall is drawn as before (autotiled). The fog dimming is drawn over both. `wallMask` (in `src/render/wallmask.ts`) counts a low wall as open ground for a real wall beside it. The unexplored rule is unchanged: nothing is drawn on an unexplored tile.

## Dev gallery

The gallery shows each theme's two props, in a row next to the floor, so they can be judged against the floor. The gallery test is updated.

## Testing

- **Parse:** `x` and `y` become low wall tiles with the right variant; `#` stays plain; other tiles unchanged.
- **Sight:** a low wall does not block line of sight or `canSee`; a wall and a closed door still do; a unit can shoot over a prop; the shot tint and the odds line follow.
- **Wall rules:** movement into a prop is refused; routes go around it; corner cutting past a prop is refused; cover applies to a unit beside a prop on the far side from the shooter; a grenade cannot target a prop tile but can be thrown past one.
- **Generator:** every map type and variation 0 to 4 still passes `checkMission`; props appear and are about two thirds of the cover blocks overall; no unit, item or door is on a prop; `x` and `y` are never placed where the all-neighbours-floor rule fails; the fingerprint is the new recorded value.
- **Checks:** `checkMission` on hand-made maps with `x`/`y`: a prop does not count as floor for reachability or patrols, does not count as cutting a map, and does not block the "enemy sees the squad" line.
- **Art and theme:** all ten images exist, 16x16, with transparent corners; `propImage` returns each theme's two pieces and falls back to base; the drift test for the generated images passes.
- **Renderer:** a prop tile draws the floor then the prop on an explored tile, nothing on an unexplored one; the existing tile, wall-edge, fog and draw-order tests pass (a real wall beside a prop gets its edge against it).
- **Whole game:** a look at all ten map types in the dev server (screenshots).

## Build order

1. `Tile.low` and `Tile.prop`, the `x` and `y` characters in `parseMap`, the sight rule; tests for each rule.
2. The generator: `scatterCover`, the `isSolid` helper, the changes in `check.ts` and `populate.ts`, the new fingerprint; tests across every map type.
3. The ten pieces, the theme table, `propImage` and the gallery row.
4. The renderer, the wall-edge rule and the in-game look at all ten map types.

Then one fresh review of the whole branch and one fix pass.

## Open for tuning after you have seen it

The share of cover blocks that become props (two thirds), how each piece looks, and whether tall pillars and props should be told apart more clearly.

## Later (not now)

Decoration props that units walk over; props in the tutorial maps; destructible props; enemy corpses holding lootable gear.
