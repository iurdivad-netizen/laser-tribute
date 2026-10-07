# Laser Tribute Milestone 15: Tall PixelLab Soldiers

Date: 2026-10-07. Status: design approved in chat by Rui (sections 1 to 4), spec awaiting review.

## Goal

Replace the 16x16 hand-built soldier and enemy sprites with taller, more detailed **PixelLab-generated figures** (16 px wide, 32 px tall, about two tiles high), standing on the unchanged 16 px tile grid. The weapon is still painted by code. Clicks and taps work on the visible figure.

## Decisions (Rui, 2026-10-07)

- Soldiers only: tiles, items, effects and corpses stay as they are (16 px). Rui chose this over the staged "everything 32 px" plan, knowing soldiers will overlap the tile above.
- Figure height about 2 tiles (the full PixelLab figure, 32 px), not a shorter one.
- Keep PixelLab's own colours (dark navy), no remap to our bright palette. The contrast risk against the dark floor is accepted.
- Enemies: a separate PixelLab generation with a clearly different uniform (not a colour swap).
- Weapons: painted by code onto one weaponless body, facing rule as today (rifle longer than pistol, white muzzle tip), a hand position per view.
- Clicks and taps: the opaque pixels of a figure count as that unit (front figure wins; transparent pixels fall through to the tile).
- Storage: a generated TypeScript data file (palette + index rows), no image loading at run time.

## Non-goals

New tiles, items, effects or corpse art; walk or shoot animations; any change to the core rules, saves, map generator or camera; a palette remap or contrast fix (later, if needed).

## Sprites and storage

- **Sources.** The squad body is the existing weaponless PixelLab character "Laser Tribute Standard 32" (id `ee5cbe29-bf0c-4202-bfc9-3c82b21704cf`, standard mode, 8 directions, 48x48 canvas). The enemy body is one new generation (standard mode, size 32, high top-down, black outline, flat shading, low detail, chibi, weaponless), described as a dark-red uniform with a different cap. Plan task 1 generates it and shows a mock before any engine work.
- **Committed sources.** The five views each (N, NE, E, SE, S) as PNGs in `art-src/pixellab/{squad,enemy}/`, with `art-src/pixellab/README.md` recording the character ids, prompts, date and PixelLab's terms link. West-side facings are mirrors, as today (`unitSprite`: facings 5, 6, 7 mirror 3, 2, 1).
- **Converter.** `scripts/build-figures.mjs` (dev tool, run by hand) reads those PNGs, crops them to one shared box (the union of the opaque pixels over all ten images, built as 16x32, feet on the bottom row), and writes `src/art/figures.generated.ts`: for each side and view a hex palette and index rows, `.` transparent. The script is deterministic and fails if the box is not 16 wide, or if any view has no opaque pixel on the bottom row.
- **Figure type.** `Figure { name; width: 16; height: 32; palette: string[]; pixels: (number | null)[] }` in `src/art/figure.ts`. The 16x16 `Sprite` and `parseSprite` stay for tiles, items and effects. `SPRITE_NAMES` loses the 20 soldier and enemy entries (they become figure keys).
- **Weapon overlay.** `armedFigure(side, view, weapon)` returns a figure with the weapon painted in (light metal `#d0d0d0` along the barrel, white `#ffffff` tip, a second pixel beside the barrel on straight views, rifle longer than pistol, as in the current `armed`). `WEAPON_AT` has a new table for the 33 px figure, one entry per view (start pixel, direction, rifle length), tuned by eye in the gallery. The overlay never leaves the figure box.
- **Atlas.** The atlas bakes a figure once per (side, view, weapon, flip) into a 16x32 canvas and also keeps its opaque-pixel mask (`Uint8Array`) for hit-testing.
- **Anchor.** Feet on the unit's own tile, bottom centre: draw at `(tile x, tile y - 16)`.

## Drawing

- The world pass is unchanged up to corpses. Living units are then drawn **sorted by tile row** (the lowest row last), by the unit's own tile row, not the animation offset.
- A unit is drawn only if its own tile is in view (enemies) or alive (squad), as now. The upper body is drawn on top of whatever lies in the tile above.
- **Selection box** stays on the feet tile (yellow). **Health bar** floats 4 px above the top of the figure; the **alert "!"** sits beside it. **Rank pips** (1x2) and the **armour pip** (2x2) sit in a status row just above the health bar (pips at x 2, 4, 6; armour pip at x 12; the row is the bar's top minus 3), because the boots fill the bottom corners of the feet tile in every view; the status stack is pushed down over the head for a unit on the first walkable row, where there is no room above the map. A test checks the marks lie wholly above the figure. The selection outline is drawn after all figures.
- **Aim point.** `aimPoint(pos)` = tile centre raised by 8 px (the chest). Tracer lines, the knife slash and hit flashes start there. Explosions and tile highlights keep tile coordinates.
- Hover box and shot preview stay on tiles.

## Click and tap

- `unitAtScreen(state, camera, layout, x, y): Unit | null` in `src/render/hit.ts`: converts the point to world pixels, checks living units from the front (lowest tile row first), and returns the first whose baked figure has an opaque pixel there (weapon and flip included). Enemies count only if their tile is in view.
- `App.click` and `App.move` call it first: a hit means `controller.clickTile(unit.pos, touch)` or `hover(unit.pos)`; a miss uses the existing `screenToTile`. The controller and core are unchanged.
- The redirect is mode-aware (added after the review, which found that a figure otherwise takes every click on the tile north of a unit): door, throw and turn always mean the tile under the pointer; a unit standing on the tile under the pointer wins over a figure reaching up from the row below; snap, aimed and stab look only for enemy figures, heal and move only for squad figures. `unitAtScreen` takes an `accept` filter for this.
- Known limit (accepted): in move and heal the tile directly above a soldier is mostly covered by his torso, so clicking its centre selects him; the uncovered side pixels still reach the tile.

## Testing

- Figure data: both sides, five views, 16x32, valid hex palette, feet on the bottom row, enemy palette visibly different from the squad's (mean red above mean blue for the enemy, the reverse for the squad), converter output matches the committed file (regenerate and compare).
- Weapon overlay: points the way each view faces, one white tip, rifle longer than pistol, stays inside the box, mirror views flip correctly (rewrites of the current sprite tests for figures).
- Atlas: bakes once per key, mask equals the opaque pixels, no canvas means no crash.
- Drawing: draw order by row, figure at `y - 16`, bar above the head, pips above the figure, aim point used by effects.
- Hit-testing: opaque pixel hits, transparent pixel inside the rectangle falls through, front figure wins in an overlap, hidden enemy not hit, mirrored view at the mirrored pixel, and one `App.click` test where a head click selects the soldier.
- Existing suites keep passing (`unitSprite` mapping, controller and app flow tests).
- Dev gallery shows both sides, five views, rifle and pistol, at 1x and 3x on a floor tile.

## Review focus (for the plan and the final review)

1. Two figures overlapping, or a figure over a closed door or wall, when selecting, targeting or hovering.
2. A soldier on the first walkable row (row 1) under the border wall: the head is drawn over row 0, never clipped.
3. The move animation (offset and bob) with the figure and the hit mask: the click uses the logical tile, not the animated position.
4. Fog: an enemy at the edge of vision whose upper body overlaps unexplored or dim tiles.
5. The touch two-tap flow when the first tap lands on a figure of the selected soldier or an enemy.

## Open items after this milestone

Stage 2 art (32 px or redrawn tiles, items, effects, corpses in the same style); a contrast fix or lighter floor if the dark soldiers are hard to see in play; walk and shoot animations; touch-friendly menus.
