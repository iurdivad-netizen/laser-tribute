# Laser Tribute Milestone 16: Stage 2 Art (tiles, items, corpses, effects)

Date: 2026-10-08. Status: design approved in chat by Rui (sections 1 to 3), spec awaiting review.

## Goal

Redraw the map and the small things in the same style as the PixelLab soldiers of milestone 15: floor, wall, doors, item icons, corpses and effects, all still 16x16 on the unchanged 16 px tile grid. Tile choice goes through a theme-ready lookup so per-map themes can come later.

## Decisions (Rui, 2026-10-08)

- Scope: everything (tiles, doors, items, corpses, effects), not just the map.
- Sources (hybrid): PixelLab for floor, wall, doors, items and corpses; effects drawn by hand in code (letter grids). A PixelLab piece that looks wrong at 16 px after one retry is drawn by hand instead, and the ledger says which.
- Look: the same theme as today, more detail (dark floor with worn panels, grey brick walls with shading, wooden doors with planks, items and corpses to match). Per-map themes are wanted later, not now.
- Walls: one wall tile and three floor variants (no autotiling), reached through a theme-ready lookup.
- Storage: the soldier pipeline extended (generated TypeScript data from committed PNGs), not a separate format and not squeezed into the letter palette.

## Non-goals

Autotiled walls, per-map themes (only the lookup seam), 32 px tiles, soldier animations, corpse variety, any change to the core rules, saves, the map generator, hit-testing or the soldiers.

## Art and sources

- **Floor and wall.** One PixelLab top-down tileset (`create_topdown_tileset`, standard mode, 16 px, flat shading, single colour black outline, dark tones; lower terrain "dark worn metal floor panels", upper terrain "grey brick wall"; about 4 generations). The plain floor tile and the plain wall tile become `floor_a` and `wall`. Two more floor variants, `floor_b` and `floor_c`, are made by the converter from `floor_a` (mirrored left to right; turned 180 degrees), so no extra generations; a test checks the three differ.
- **Doors, items, corpses.** PixelLab map objects (1 generation each, `create_map_object` or the cheapest object tool that returns a transparent 16 px piece): `door_closed`, `door_open`, `item_rifle`, `item_pistol`, `item_grenade`, `corpse_squad`, `corpse_enemy`. Plan task 1 tries one piece first and records size, background and cost; if the tool cannot give 16 px with a transparent background the piece is drawn by hand.
- **Effects.** The 9 effect sprites (`flash_0`, `flash_1`, `spark`, `slash_0`, `slash_1`, `splash`, `boom_0` to `boom_3`) are redrawn by hand as 16x16 letter grids with dark outlines and flat shading, same names and sizes as today (the explosion is still drawn at 3x).
- **Committed sources.** The PNGs live in `art-src/pixellab/{tiles,items,corpses}/` with the ids and prompts added to `art-src/pixellab/README.md`. Hand-drawn pieces live as rows in `scripts/hand-images.mjs` (named, with a note why).
- **Budget.** About 11 to 13 generations of the 34 left (floor and wall about 4, seven pieces 7 to 9 with retries).

## Storage and lookup

- **Converter.** `scripts/figures-lib.mjs` also reads `art-src/pixellab/tiles|items|corpses/*.png` (plus the hand-drawn pieces) and `build-figures.mjs` writes `src/art/images.generated.ts`: `IMAGE_DATA: Record<ImageName, { width; height; palette: string[]; rows: string[] }>`, rows as for the figures (base-62 palette indexes, `.` transparent). Tiles keep their full 16x16 and must have no transparent pixel; items and corpses are cropped to the 16x16 box and must keep a transparent edge; anything bigger than 16x16 fails. `floor_b` and `floor_c` are derived here. The drift test regenerates and compares, as for the soldiers.
- **Image type.** `src/art/image.ts`: `imageOf(name): Figure` (the existing `Figure` type, hex pixels, cached) over `IMAGE_DATA`. `Atlas.drawFigure` becomes `Atlas.drawImage` (same behaviour, 1:1, flip option) and the soldiers use it too.
- **Letter sprites shrink to effects.** `SPRITE_NAMES` keeps only the 9 effect names; `SPRITE_ROWS` loses the floor, wall, door, item and corpse grids; `floorVariant` stays (position hash, used by the lookup).
- **Theme seam.** `src/art/theme.ts`: `THEMES: Record<ThemeId, { floors: [ImageName, ImageName, ImageName]; wall: ImageName; doorClosed: ImageName; doorOpen: ImageName }>` with one theme, `base`; `tileImage(theme, kind, open, x, y): Figure` picks the floor variant by `floorVariant(x, y)`; an unknown theme id falls back to `base`. `themeFor(state)` returns `'base'` (the single place that will later read a field on the map). Items and corpses are not themed: `itemImage(kind)`, `corpseImage(side)`.
- **Renderer.** The tile pass uses `tileImage(themeFor(state), …)` (doors as the player last saw them, as now); the item pass uses `itemImage`; the corpse pass uses `corpseImage`. Draw order, fog dimming, scan dots, hover box and everything after are unchanged.
- **Gallery.** Shows the tiles (three floors, wall, two doors), items and corpses from the new data above the effects and the soldiers.

## Testing

- Data: every image has its size and a valid hex palette; floors, wall and doors are solid 16x16; items and corpses have pixels and a transparent edge; closed and open door differ; the three floors differ; the enemy corpse is redder than the squad corpse; the drift test matches.
- Theme lookup: same position, same floor variant; wall, closed door and open door come from the table; an unknown theme falls back to `base`; `themeFor` returns `base`.
- Renderer: tiles, items and corpses are drawn through `drawImage` at the old positions; items before corpses, corpses before living units; doors follow `doorMemory`; no letter-sprite name for tiles is used any more.
- Effects: the 9 grids parse, keep names and size, use only palette letters, and the existing effect tests keep passing.
- Existing suites keep passing after the art-name migration (tests that read `floor_0`, `wall`, `item_*`, `corpse_*` from `SPRITE_ROWS` move to `imageOf`).
- Look: contact sheets of each piece before wiring, and a full-map screenshot in the real game (contrast, floor repetition, item legibility).

## Review focus (for the plan and the final review)

1. Floor repetition: the three variants come from flips and turns of one tile; a map screenshot must not show a visible grid or stripe.
2. Contrast: dark floor against dark soldiers, items and corpses at the game's close zoom and on a phone.
3. Doors: closed and open must be clearly different at a glance, including as remembered by the player (`doorMemory`) and under fog dimming.
4. Items on the floor under a corpse or a soldier: still legible and in the right draw order.
5. Anything that still names an old letter sprite (`floor_0`, `wall`, `door_*`, `item_*`, `corpse_*`) after the migration: renderer, gallery, tests, effects.

## Open items after this milestone

Per-map themes and autotiled walls; soldier walk and shoot animations; corpse variety; touch-friendly menus; the hunting-turn performance follow-up.
