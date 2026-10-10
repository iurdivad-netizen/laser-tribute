# Laser Tribute Milestone 25: autotiled walls

## Goal

Make wall masses look connected. Each wall tile is drawn from the themed wall image plus edge shading that depends on which neighbours are open ground, so a wall mass reads as a solid shape with defined edges instead of a grid of identical blocks. The edges are produced by code from the existing wall image, so there is no new hand-drawn art, and every theme gets them automatically.

Not in this milestone: hand-drawn wall pieces (the override slot in the theme table stays), thick-wall or front-face (2.5D) walls, framing doors, any change to floors, doors, items, units, saves or core rules.

## Decisions (from the brainstorm)

- Look: edge shading from neighbours (option A), not hand-drawn pieces and not a 2.5D front face.
- The edges are drawn after the theme recolour, so every theme has them with the same dark outline colour.
- The outline uses `#0b0c12`, the dark the soldier sprites already use.

## Constraints

- No leak: an unexplored neighbour counts as solid, so a wall never shows an edge towards a tile the player has not seen.
- `src/core` stays pure and does not change (the mask is computed in the render layer from the game state).
- Floors, doors, items, corpses, soldiers, effects and the fog dimming are unchanged. Wall tiles that touch no open explored tile are drawn exactly as today.
- Cached per theme and mask: a redraw costs nothing extra.
- No PixelLab generations. No change to the build pipeline or the generated image data.

## The mask

`wallMask(state, x, y): number` in `src/render/wallmask.ts` (pure). A neighbour is **open** when it is inside the map, its tile kind is `floor` or `door`, and `state.explored` is true for it. Walls, tiles outside the map and unexplored tiles are solid.

Bits: `N = 1`, `E = 2`, `S = 4`, `W = 8` for an open orthogonal neighbour; `NE = 16`, `SE = 32`, `SW = 64`, `NW = 128` for an **inner corner**: the diagonal neighbour is open and both orthogonal neighbours that touch that corner are solid. If either of those two is open, the side edge already covers the corner and the corner bit stays 0. The mask therefore has at most 47 distinct values.

## The variant

`wallVariant(base: Figure, mask: number, name: string): Figure` in `src/art/wallvariant.ts` (pure). Mask 0 returns `base` itself. Otherwise it returns a copy of `base` (same size, the given name) with:

- **Open north side:** row 0 is the outline colour; row 1 is each pixel blended 35% towards white.
- **Open south side:** row 15 is the outline colour; row 14 is each pixel blended 35% towards black.
- **Open east side:** column 15 is the outline colour. **Open west side:** column 0 is the outline colour.
- **Inner corner:** the one corner pixel of the tile (`NE` is x 15, y 0; `SE` x 15, y 15; `SW` x 0, y 15; `NW` x 0, y 0) is the outline colour.
- Where an outline and a highlight or shade meet, the outline wins. Transparent pixels of the base stay transparent and are never touched. All other pixels equal the base.

The outline colour is `#0b0c12`.

## Themes and lookup

`wallImage(theme: string, mask: number): Figure` in `src/art/theme.ts`: the theme's wall image (as `tileImage(theme, 'wall', ...)` returns it today, recoloured or overridden), passed through `wallVariant`, cached in a `Map` keyed `theme:mask`. An unknown or inherited theme id falls back to `base`. `tileImage` keeps its signature and behaviour; `wallImage(theme, 0)` equals `tileImage(theme, 'wall', false, 0, 0)`.

## Renderer

In `tileFigure` (`src/render/renderer.ts`), for a wall tile: `wallImage(themeFor(state), wallMask(state, x, y))`. Floors and doors go through `tileImage` as before. The fog overlay, the draw order and everything else are unchanged. The mask is computed per drawn wall tile per frame (nine neighbour lookups); if that shows up in a profile, it can be cached per state, but it should not be needed at 48x32.

## Gallery

The dev gallery shows, for each theme, a row of the main variants: a plain wall (mask 0), a straight edge (one side open), an outer corner (two adjacent sides open), a wall end (three sides open), a lone pillar (four sides open) and an inner corner. The gallery test is updated for the new tiles.

## Testing

- **Mask:** on small hand-made maps: each side alone, two and three sides, an inner corner (diagonal open with both sides solid), the corner bit staying 0 when either side is open, the map edge counting as solid, a door counting as open, an unexplored floor neighbour counting as solid, and the same wall's mask changing when the neighbour becomes explored.
- **Variant:** mask 0 returns the same object; each side's outline and highlight or shade rows and columns exactly; the inner corner changes exactly one pixel; all other pixels equal the base; transparent pixels stay transparent; the result has the base's size and the given name; the outline wins where an outline and a highlight meet.
- **Themes:** every theme and mask gives a figure; the outline colour is `#0b0c12` in every theme; `wallImage(base, 0)` is the original wall image; an unknown theme falls back to `base`; the cache returns the same object.
- **Renderer:** an explored wall beside an explored floor draws an edged variant; the same wall beside an unexplored tile draws the plain wall; floors, doors, items and units draw as before; the existing tile, fog and draw-order tests pass unchanged.
- **Readability:** the milestone 23 rules (wall against floor and door differ) still hold for every theme with edges on; the outline colour differs from each theme's wall mean by at least 0.04 in luminance.
- **Whole game:** a look at every map type in the dev server (screenshots).

## Build order

1. `wallMask` and `wallVariant`, with tests.
2. `wallImage` with its cache, and the theme tests.
3. The renderer change and the no-leak test.
4. The gallery row, then a look at every map type in the game, tuning the highlight and shade strength if the edges read too heavy or too faint.

Then one fresh review of the whole branch and one fix pass.

## Open for tuning after you have seen it

The outline darkness, the highlight and shade strength (35%), and whether doors should also get a frame.

## Later (not now)

Hand-drawn wall pieces through the override slot; thick-wall or front-face walls; framed doors.
