# Story mode, project 3b: the planet map art (design)

Part of project 3 (story and art). 3a (the story spine) is merged. 3b is the art of the planet screen. 3c (base art and
portraits) and 3d (audio) come later and get their own designs.

## Intent and why

Rui wants STORY to be "a beautiful, well built and enjoyable game". Today the planet map is a dark panel with faint
specks, and every place is a coloured square joined by thin lines. Rui chose a **properly painted terrain** map
("hand-painted campaign map, readable at a glance"): a top-down painted land with a different look in each part of the
colony, where **conquest changes the land a little**. The map should be a place the player wants to look at, and the
owner of every place must still be readable at a glance.

## Goals

- A painted land backdrop that fills the map area (330 x 372 px) with a different look per part of the colony.
- A small painted emblem for every kind and state of place, replacing the coloured squares.
- Conquest visibly changes the land: small painted ground patches ("stamps") around a place change with its owner.
- Owner stays readable at a glance (code-drawn tint, as in the approved sketch B), roads stay, selection stays.
- The art is produced offline, checked in as image files, baked into the game by a script, and the game degrades to
  today's plain map if an image has not loaded (tests run without canvas).

## Non-goals

- No change to region positions, names, links, rules, hit testing semantics (apart from the citadel's slightly larger area) or the info panel. No new screens.
- No animation, no day/night, no fog of war, no zoom. No base art or portraits (3c), no audio (3d).
- No text drawn into the painting; names stay in the panel.

## Anti-goals

- A beautiful backdrop where you can no longer tell enemy from yours: owner colour must be readable on every part of
  the painting, in light and dark ground alike.
- Visible seams or rectangles where a stamp meets the backdrop, or stamps that look like stickers.
- A large download: the build must not grow by more than about 250 KB.
- Art that cannot be reproduced: the checked-in source images and the build script must regenerate the baked file
  byte for byte.

## Constraints from the code and tools

- The planet screen draws in the 480x400 menu space: `PLANET.map = { x: 6, y: 22, w: 330, h: 372 }`; region
  positions (`REGIONS[i].x/y`, relative to the map) are fixed. `drawBackdrop` in `src/screens/planet.ts` is the
  placeholder to replace.
- Existing art pipeline: sources in `art-src/pixellab`, `scripts/build-figures.mjs` builds `src/art/*.generated.ts`,
  loaded through `src/art/image.ts`. 3b follows it (a new script or a new section of the same one).
- Tests draw screens with a stub context and no canvas: drawing must not throw and must fall back to the plain
  backdrop and the old squares when images are missing.
- Tutorial and Campaign are untouched. `planetHit` and its tests keep working (hit areas may grow, see below).
- **Art budget:** the PixelLab account is a trial with **23 generations left** (plus a daily bonus of up to 20 that
  is spent only after the plan generations run out and refills nightly). `create_image_pro` for a 330 x 372 map costs 10
  to 25 generations; each emblem or stamp (`create_image_pixen`, transparent, 16/20/24 px squares) costs 1. A full
  set (one backdrop, about 10 emblems, 3 stamps) is 25 to 40 generations before any retries.

## Approaches considered

1. **One painted backdrop plus small stamps (chosen by Rui).** One 330 x 372 land painting, painted emblems per kind
   and state, painted ground patches that change with the owner. Cheap, cohesive; the change is local and small.
2. Tile-built terrain: code assembles land from biome tiles and swaps tiles around a place on conquest. Allows large
   reshaping but needs tilesets with edge transitions and a composer; seams look patchy; far more code and tests.
3. Two full backdrops (before and after), cross-faded by how much is held. Simple and dramatic, but the same
   everywhere, so taking one outpost shows nothing around it.

## Design

### Layers, drawn in this order inside the map rect

1. **Backdrop**: the painted land (one image). Painted in a "contested" state: moderately dark, muted, so owner
   colours and the road lines read on top of it. Regions of the land: dust flats in the south, marsh and steppe in
   the west and middle west, scarred grey industrial land in the middle east, pale glass barrens, a dark ground in
   the north leading up to the Meridian Citadel.
2. **Stamps**: a ground patch centred on a place, about 44 px across, soft edged (alpha fade built into the sprite):
   - `scorch`: dark burnt ground, for enemy-held places (state `enemy`);
   - `cleared`: cleared, greener ground, for places the player holds (state `player`);
   - `fields`: small tilled fields, for allied settlements (state `allied`).
   Neutral settlements and the wild get no stamp (the backdrop is their ground).
3. **Owner tint**: code-drawn soft radial glow in the holder's UI colour under each place (about 20 to 24 px radius,
   low alpha), as in sketch B, so owner reads at a glance on any ground. Strength is tuned in the browser.
4. **Roads**: the existing lines (green between friendly places, grey otherwise), unchanged; the builder may lighten
   them for contrast on the painting.
5. **Emblems**: painted sprites centred on each place (a place's footprint is at most 24 x 24, the citadel at most
   32 x 32):
   | id | used for |
   |---|---|
   | `outpost_enemy` | enemy-held outposts |
   | `outpost_taken` | an outpost the player has taken (ruined walls, the player's banner) |
   | `settlement_neutral` | neutral settlements |
   | `settlement_allied` | allied settlements (lit windows, a banner) |
   | `wild_a`, `wild_b` | wilderness, variant by `id % 2` |
   | `wild_visited` | a wilderness whose supplies were taken |
   | `start_ship` | the landing point |
   | `citadel_enemy` | Meridian Citadel while enemy-held |
   | `citadel_taken` | Meridian Citadel once taken |
6. **Selection**: the existing selection frame, sized to the emblem footprint.

### Per-region look (pure, testable)

`regionLook(w: World, id: number): { stamp: 'scorch' | 'cleared' | 'fields' | null; emblem: EmblemId; tint: string }`
in `src/screens/planetart.ts`. It reads only `w.regions[id].holder`, `.visited` and `REGIONS[id].kind`. The mapping is
exactly the table above; every region of every world has a valid emblem. `drawPlanet` calls it for all 30 regions.

### Hit areas

Positions never move. A region is picked by the nearest region within `REGION_HIT = 10` px of the click (a circle, plus
touch slop), which already covers a 20 px emblem; that stays. The citadel's emblem is larger, so its radius becomes 14
px. A test asserts that no two regions' hit circles overlap (including the citadel's). `planetHit` tests are updated
for the citadel only.

### Art production and baking

- Source images live in `art-src/planet/` (`backdrop.png`, `emblem_*.png`, `stamp_*.png`), with the prompts and
  PixelLab job ids recorded in `art-src/planet/README.md`, so an asset can be regenerated or replaced.
- The backdrop and emblems are quantised to a small shared palette (the builder picks the colour count, aiming at
  about 48) so they sit together and stay small.
- A build script (`scripts/build-planet-art.mjs`, run by hand and by `npm run art`, and checked in with its output)
  writes `src/art/planet.generated.ts`: a manifest of ids to data URIs. A test regenerates it in memory and compares.
- `drawPlanet` gets the images through `src/art/image.ts` (or the same loader pattern). Until an image has decoded, or
  when there is no canvas, it draws today's plain backdrop and squares, so nothing blocks on loading.

### Acceptance (checked in the browser pane, not just tests)

Screenshots at game start, with about a third of the colony held, and with the citadel open show: all five owner
states distinguishable on every ground type; no stamp seams; the citadel stands out; text in the panel unaffected;
the whole map still fits the 330 x 372 rect at phone width.

## Budget and decisions that are Rui's

- Spending the remaining trial generations, or topping up the PixelLab plan, is Rui's call. Fallback if the budget
  runs out: the free pixel tools (`pixelart_workbench`) and the procedural generator from the approved sketch B can
  produce a painted-terrain backdrop and simple emblems at no credit cost; the pipeline above takes PNGs either way.
- If the first backdrop is not good enough, a retry costs another 10 to 25 generations; the builder stops after at most
  two attempts and asks.

## What is left to the builder

- The exact prompts, the number of retries within the budget, the palette size, the exact footprints (within the
  limits above), stamp size and softness, tint strength, and whether `npm run art` is a new script or a mode of
  `build-figures.mjs`.
- Whether the backdrop is a PNG data URI in the bundle (if it fits the size limit) or a separate hashed asset file
  loaded at runtime (then the fallback above covers the load).

## Calls I made (for Rui to check)

- Owner colour stays code-drawn (tint) rather than painted, so it stays readable and consistent on any ground.
- Stamps for enemy, player and allied only; neutral and wild rely on the backdrop and their emblem.
- Hit areas stay as they are (radius 10), except the citadel (14); positions do not move.
- A 250 KB growth limit for the build, and a two-attempt limit on the backdrop.
- The game keeps working with the plain map when art has not loaded.
