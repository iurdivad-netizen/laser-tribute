# Laser Tribute Milestone 14: Mobile Play (Design)

Date: 2026-10-05. Follows the soldier icons. Generated maps stay milestone 13.

## Purpose

Rui: "the mobile gameplay is hard; specially turning; map screen fit". Reading the code showed why:

- Turning is keyboard-only (Q and E). On a phone a soldier cannot turn, and facing decides what he sees (a half-plane in front) and where the weapon points.
- Sound controls (M, -, =), soldier selection by number or Tab, and cancel by Escape are keyboard-only. A long-press on a tile cancels only through the browser's right-click.
- The whole game is one fixed 480x400 canvas scaled to fit the page: about 13 px tiles on a 390 px portrait phone, and the same small size with black bars in landscape. The panel buttons are 22 px tall.

Success: on a phone, in portrait and landscape, a player can select soldiers, see the map at a size where a tap hits the intended tile, turn any soldier to any facing, and use every action without a keyboard. Desktop play keeps every key and gesture it has now.

## Decisions (Rui, stated)

- **Both orientations**, switching automatically.
- **Scrolling camera with big tiles** (about 32 px or more), follows the selected soldier, drag to pan, a ZOOM toggle for the whole map.
- **Turning: a TURN button, then tap where to face.**
- Menus (equipment, results, title, end) stay as they are for now (scaled to fit); touch-friendly menus are a later follow-up.

## Scope

In: responsive layout, camera, layout-driven panel with touch-size buttons, squad strip, TURN mode, ZOOM, CANCEL and SOUND controls, touch input (tap, drag-pan, long-press), two-tap move preview on touch, full-window canvas, tests.
Out: touch-friendly menus, pinch-zoom, a minimap, haptics, an installable app, any change to `src/core` rules, saves or the AI.

## Design

### Display and layout (`src/ui/layout.ts`, pure)

- The canvas fills the window. Its backing store is the CSS size times the device pixel ratio (capped at 3), redrawn on load, resize and rotation. Map art is drawn at integer scales, so pixels stay crisp.
- `computeLayout(width, height, dpr): Layout` returns the single source of truth for drawing and hit-testing:
  - `orientation`: `landscape` when `width >= height * 1.15`, otherwise `portrait`. Large desktop windows use the portrait structure (map above, panel below).
  - Landscape: map area on the left, a panel column on the right (about 170 CSS px, clamped 140 to 200). Portrait and desktop: map area on top, panel below (about 190 CSS px, clamped 150 to 240).
  - `ui`: the integer text scale (in device pixels) for panel text, the largest that makes every label fit its button, at least 1.
  - Rectangles for the map area, the panel, the status line, the squad strip (four buttons), and the twelve action buttons plus CANCEL and SOUND.
  - Buttons are at least 44 CSS px tall where the window allows (floor 36 below 320 px on the short side).
- Action buttons: SNAP, AIM, THROW, STAB, RELOAD, DOOR, TAKE, ALERT, GADGET, TURN, ZOOM, END TURN, in a grid (4 columns in portrait, 2 or 3 in the landscape column, 6 on wide desktop). Cost labels (`15 AP`) stay under each action.
- The squad strip: four buttons (name, a mini health bar, highlighted when selected). Tapping one selects that soldier and centres the camera on him.
- CANCEL appears over the status line whenever a mode is active; SOUND is a small toggle.

### Camera (`src/render/camera.ts`, pure)

- State: the centre in tile units and a zoom level, `close` or `whole`.
- `tilePx`: close = the smallest integer scale with tiles of at least 32 CSS px (so 2x on a phone, 3x or 4x on big screens); whole = the largest integer scale at which the whole map fits the map area (a fractional scale only if even 1x does not fit). Default zoom: whole if its tiles are at least 28 CSS px, otherwise close.
- `follow(unitPos)` keeps the soldier inside a central margin; `panBy(dx, dy)` clamps so a map edge never leaves the screen; the map is centred and panning is disabled when it fits. Toggling zoom keeps the focus tile fixed.
- `screenToTile` and `tileToScreen` replace the fixed `screenToTile` for the mission screen.
- The camera recentres after a selection change, a move, and (during the enemy turn) a visible enemy action outside the view, then returns to the selected soldier. A manual drag turns following off until the next selection or move.

### Rendering

- `drawGame` clips to the map rectangle and draws the world through one scale and translate from the camera: tiles, items, units, effects, health bars and markers all share it (effects already use 16-pixel coordinates).
- `drawPanel` is drawn afterwards in screen space from the layout.
- `FontAtlas` and `drawText` gain an optional integer `scale` (drawn with nearest-neighbour; the glyph cache still bakes each glyph once at 1x).
- Menus (equipment, result, title, end) keep their 480x400 drawing. `App` draws them through a contain transform (scale and centre) and maps pointer positions back to 480x400 coordinates.

### Input and controller

- Pointer events replace the mouse events. A press that moves less than 10 px (4 px for a mouse) and ends within 500 ms is a **tap** and behaves like today's click. A longer move on the map is a **drag** that pans the camera and fires nothing. Holding still on the map for 500 ms **cancels the current mode** (touch version of right-click and Escape); right-click still cancels with a mouse.
- The canvas turns off browser gestures (`touch-action: none`, no overscroll, no double-tap zoom), respects safe areas, and the viewport scale is locked.
- **Two-tap preview on touch** (pointer type `touch` only): a tap on a tile in move mode shows the path and AP cost; a second tap on the **same** tile moves; a tap elsewhere moves the preview. Selecting a soldier is immediate; shots, throws, stabs, doors and heals stay one tap because the button press already confirmed them. Mouse behaviour is unchanged. The pending preview clears on any mode change, selection change, resize and the end of the turn.
- **TURN mode:** a new `turn` mode (button TURN, key `F`). Tapping a tile turns the soldier to face it: eight-way from the angle to the tile, the shortest way round, 1 AP per 45 degrees (`CONFIG.turnCostPer45`), through the existing `Turn` command. The hint shows the cost first. Tapping the soldier's own tile or CANCEL leaves the mode. Turning to the current facing does nothing and costs nothing; with too little AP the usual "Not enough action points" message shows. Q and E keep working.
- ZOOM toggles the camera zoom. SOUND toggles mute (M, -, = still work on a keyboard).

### Code structure

- New: `src/ui/layout.ts`, `src/render/camera.ts`.
- Changed: `src/render/renderer.ts` (camera transform, clip), `src/render/panel.ts` (layout-driven buttons, squad strip, new actions; `PANEL_BUTTONS` becomes `panelButtons(layout)`, `buttonAt(px, py, layout)`), `src/ui/text.ts` (scale), `src/input/input.ts` (pointer wrapper), `src/input/uiState.ts` (`turn` mode, pending preview), `src/controller.ts` (turn mode, two-tap preview, new actions), `src/app.ts` (resize, layout, camera, menu transform), `src/main.ts` and `index.html` (full-window canvas, resize handling, page locks).
- Unchanged: everything in `src/core`, saves, the AI, sound, sprites.

### Edge cases and rulings

- Rotation or resize mid-mission recomputes the layout, clamps and recentres the camera on the selected soldier, and clears any mode or preview.
- Below about 320 px on the short side the button height floor is 36 px and the text scale never drops below 1; the camera never shows fewer than 8 tiles across.
- Maps smaller than the view are centred; panning is disabled.
- Desktop keeps keyboard, hover, Q and E, number keys, Tab, Escape, right-click and the sound keys; only the look changes (larger map, new panel).
- A cancelled long-press must not also fire a tap.

## Testing

- `computeLayout` for 320x568, 390x844, 844x390, 1366x768, 1920x1080 and a 3x pixel ratio: every button inside the panel, at least 44 px tall where the window allows, no overlaps, the map and panel tile the window without overlap, every label fits its button at the chosen text scale, four squad buttons.
- Camera: screen-to-tile and tile-to-screen round-trip, clamping, follow margin, panning stops at the edges, zoom toggle keeps the focus tile, default zoom choice.
- Renderer: the world pass uses the camera (a soldier's tile draws at the mapped position), the clip, health bars and effects share the transform; existing sprite, marker and layout tests still pass.
- Controller: TURN mode in all eight directions with the right AP cost, refusal with too little AP, cancel on the own tile, no cost when already facing that way; two-tap preview (first tap previews, same tile moves, another tile moves the preview, mouse moves on one click); new keys.
- Input wrapper: tap, drag-pan fires no click, long-press cancels without a tap, a move just under the threshold is still a tap.
- App: menus through the contain transform with pointer coordinates mapped back, resize recomputes layout and camera, campaign, save and title behaviour unchanged.
- Real browser with the pane's mobile emulation, portrait (375x812) and landscape (812x375), touch-like pointer events through script: screenshots of the mission screen, the TURN flow, the zoom toggle, a drag-pan, plus a desktop-size check.

## Constraints

- `src/core` stays pure and untouched; layout and camera modules are pure and deterministic.
- No new dependencies; the 16x16 sprite grid and the 5x7 font are unchanged.
- New test files get distinctive names (check with `ls tests`); never overwrite an existing test file.
