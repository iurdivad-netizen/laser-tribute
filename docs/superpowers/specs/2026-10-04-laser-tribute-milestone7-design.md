# Laser Tribute: Milestone 7 Design (world graphics)

## 1. Goal

Replace the placeholder shapes of the mission view with pixel art in the spirit of Laser Squad and X-COM: recognisable soldiers and enemies facing eight directions, textured floor, wall and door tiles, item icons, corpses, and proper shot, hit, stab and explosion animations. The pixel art is drawn in code as small data grids, so there are no image files and the GitHub Pages site is unchanged.

Stated by Rui: "would love some sounds and better graphics". Decided in the brainstorm (2026-10-04): **pixel art drawn in code** (not supplied image files), **keep the 16 px grid and the 480x360 canvas** and refresh everything, split into two milestones. This is **milestone 7: the world** (mission view). **Milestone 8** is the interface (pixel font, panel, equipment, result and end screens).

## 2. Out of scope

- The panel, the font, the equipment, result and end screens (milestone 8).
- Bigger tiles, a bigger canvas or scrolling; image files or a PNG sprite loader.
- Walk-cycle frames for units (a small bob only), unit portraits, weather or lighting effects.
- Any change to the rules, the sounds or the layout constants (`VIEW`, `CONFIG.tileSize`).

## 3. Art and data

- `src/art/palette.ts`: `PALETTE: Record<string, string>`, one character per colour (a limited, slightly muted Amiga-era set; blue for the player's side, red for the enemy, warm brown for doors). `.` is reserved for transparent.
- `src/art/sprites.ts`: `SPRITE_ROWS: Record<SpriteName, string[]>`, each sprite exactly 16 strings of 16 characters. This file is the only place to edit the look.
- Sprites to author (about 30):
  - Units: `soldier_n`, `soldier_ne`, `soldier_e`, `soldier_se`, `soldier_s` and the same five for `enemy`. Facings 5, 6, 7 are the horizontal mirror of 3, 2, 1 (facing 0 is north, 2 east, 4 south, per `FACING_VECTORS`).
  - Tiles: `floor_0`, `floor_1`, `floor_2`, `wall`, `door_closed`, `door_open`.
  - Items: `item_pistol`, `item_rifle`, `item_grenade`. Corpses: `corpse_player`, `corpse_enemy`.
  - Effects: `flash_0`, `flash_1` (muzzle flash), `spark` (hit), `slash_0`, `slash_1` (stab), `splash` (death), `boom_0` to `boom_3` (explosion frames).
- Weapons are not part of the body sprite: a barrel is drawn along the unit's facing, short for the pistol (3 px) and long for the rifle (6 px). Rank is shown by 1, 2 or 3 small yellow pips on the shoulder of the player's soldiers (Private, Sergeant, Captain; none for Rookies and enemies).
- The existing overlays stay: selection box, health bar, "!" alert mark, path preview dots, hover box, fog of war (a dark overlay on explored tiles out of sight), and hidden enemies.

## 4. Code

- `src/art/sprite.ts` (pure): `parseSprite(name, rows)` returns `{ name, width, height, pixels: (string | null)[] }` and throws a clear error for a wrong size or a character not in the palette; `flipHorizontal(sprite)`; `unitSprite(side, facing)` returns `{ name, flip }`; `floorVariant(x, y)` returns 0, 1 or 2 from a deterministic hash of the position; `rankPips(rank)` returns 0 to 3; `barrel(weapon, facing)` returns the pixel offsets and length of the barrel line; `frameFor(progress, count)` returns the frame index for a progress value from 0 up to (but not including) 1.
- `src/art/atlas.ts`: `class Atlas` with an injectable `createCanvas: (w, h) => CanvasLike | null` (default: an `OffscreenCanvas` or a detached `<canvas>` when the browser has one, otherwise `null`). `Atlas.draw(ctx, name, x, y, flip = false)` bakes a sprite once into an offscreen canvas and caches it (flipped versions cached separately), then draws it with `drawImage`; with no canvas available it draws nothing and does not throw. The renderer owns one `Atlas`.
- `src/render/renderer.ts` is changed to draw tiles, items, corpses and units through the atlas (floor variant by tile position; wall; door by open state; unit sprite by side and facing; barrel and rank pips over the unit; the walking bob is a 1 px vertical offset while the unit's move animation runs). All visibility rules stay exactly as they are.
- `src/render/effects.ts`: the shot gets a muzzle flash at the shooter (2 frames) and a spark at the impact on a hit; a `stab` slash replaces the plain line with 2 frames; a death plays a short splash; a grenade plays the 4-frame explosion sprites instead of the orange circle; the `reloaded` flash stays. Effect timing and the existing shot line stay as they are.
- Dev only: `window.gallery()` (when `import.meta.env.DEV`) draws every sprite 4x enlarged on a labelled grid, for reviewing and screenshots.

## 5. Files touched

- New: `src/art/palette.ts`, `src/art/sprites.ts`, `src/art/sprite.ts`, `src/art/atlas.ts`.
- Changed: `src/render/renderer.ts`, `src/render/effects.ts`, `src/main.ts` (dev gallery), `README.md`.

## 6. Testing

TDD for the pure parts; the art itself is checked by eye.

- Every sprite in `SPRITE_ROWS`: exactly 16 rows of 16 characters, only palette letters or `.`, at least one opaque pixel, and `flipHorizontal` twice gives the original; every `SpriteName` is present and nothing extra is defined.
- `unitSprite`: facings 0 to 4 map to the five base sprites without a flip, facings 5, 6, 7 map to the sprites of 3, 2, 1 with a flip, for both sides.
- `floorVariant`: deterministic for the same position, all three variants occur over a 30x20 map, and neighbouring tiles are not always equal.
- `rankPips`: Rookie 0, Private 1, Sergeant 2, Captain 3, empty or unknown 0. `barrel`: pistol shorter than rifle, direction follows `FACING_VECTORS` for all 8 facings. `frameFor`: 0 at progress 0, last frame just under 1, clamped outside.
- `Atlas` with a fake canvas: a sprite is baked once and reused, a flipped sprite is a separate cache entry with mirrored pixels, `draw` calls `drawImage` at the given position, and with no canvas nothing is drawn and nothing throws.
- Renderer smoke test: `drawGame` on a campaign mission state (with items, a corpse, an alerted soldier of each rank, an explosion and a stab effect in progress) completes against a recording canvas without throwing, and draws no enemy that is out of sight.
- Effects: each effect kind picks a sprite frame within range at any time during its life.

## 7. Success criteria

- In a real browser, at game scale and enlarged, all 8 facings of both sides are clearly distinguishable, the rank pips and the two weapons are visible, floor tiles look varied but calm, walls and doors read clearly, and the explosion, flash and slash read as animations.
- Fog of war, hidden enemies, selection, preview and the alert mark look and behave exactly as before.
- Every existing test still passes; `core` still has no browser imports; frame time does not regress (measured with a quick `performance.now()` loop in the browser, before and after).

## 8. Risks and notes

- Pixel art is subjective: expect a round or two of "make it more like this". Each round is a data edit in `src/art/sprites.ts` and a screenshot via the dev gallery.
- A 16 px unit is small; the soldier will be simple, in the spirit of the originals. Distinguishing the 8 facings relies on the barrel and on the head and body shading.
- Browsers without an `OffscreenCanvas` use a detached `<canvas>`; if neither exists (tests) the atlas is silent.
