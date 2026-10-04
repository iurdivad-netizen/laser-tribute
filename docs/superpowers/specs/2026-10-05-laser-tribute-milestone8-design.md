# Laser Tribute: Milestone 8 Design (interface graphics)

## 1. Goal

Make the interface match the pixel-art world of milestone 7: a bitmap pixel font, Amiga-style beveled frames and buttons, a roomier mission panel, and restyled equipment, result and end screens. No change to rules, sounds, controls or what each screen shows.

Stated by Rui: "better graphics" (milestone 7 did the world; this is the interface). Decided in the brainstorm (2026-10-04): **5x7 pixel font** (chosen over the compact 4x6 I recommended, accepting the re-layout), **beveled retro frames**, **all-caps text**, **a taller canvas (480x400)**. Everything is drawn in code; no image files.

## 2. Out of scope

- Changes to the map, sprites, rules, sounds, keys or screen flow; new screens; scrolling; mobile layout.
- Lower-case glyphs (all interface text is shown in capitals); non-ASCII characters.
- Animated menus, portraits, ornate corner art.

## 3. Font

- `src/ui/font.ts`: `GLYPH_W = 5`, `GLYPH_H = 7`, `ADVANCE = 6`; `GLYPHS: Record<string, string[]>` where each glyph is 7 strings of 5 characters (`#` on, `.` off); `textWidth(text) = max(0, text.length * 6 - 1)`.
- Character set: `A-Z`, `0-9`, space, and `. , : ; ! ? ' " - + = / ( ) [ ] < > % * # _ & @ $ ~ |`. `glyphFor(ch)` upper-cases letters; any other character returns a visible fallback box glyph (never throws).
- Baseline: capitals and digits use rows 0-5, with row 6 free for the descender-like parts of `,` `;` `Q` `J` and `(` `)`.
- `src/ui/text.ts`: `class FontAtlas` (injectable canvas factory like the sprite `Atlas`; default offscreen or detached canvas, silent when none) bakes a glyph once per (character, colour) and stamps it with `drawImage`; `drawText(ctx, text, x, y, colour, align = 'left', atlas = defaultFont)` draws left, right (x is the right edge) or centred (x is the centre) text; `clipText(text, maxPx)` returns the text, or a shortened version ending in `...` whose `textWidth` is at most `maxPx`.

## 4. Frames and buttons

- `src/ui/frame.ts`: `UI` colour constants (navy fill, light and dark bevel edges, text colours, accent yellow, red, green) taken from the sprite palette, and `drawFrame(ctx, x, y, w, h, style)` with styles `raised` (light 2 px top-left edge, dark 2 px bottom-right edge, navy fill), `pressed` (edges swapped, fill slightly darker), `hover` (raised with a brighter fill), `disabled` (raised, dimmed, no light edge) and `inset` (for bars and text wells).
- `drawButton(ctx, rect, label, state)` draws a frame plus centred label in the pixel font.

## 5. Canvas and mission panel

- `VIEW` becomes `{ width: 480, height: 400, mapHeight: 320 }`; `index.html` keeps the canvas aspect ratio (`aspect-ratio: 480 / 400`, width limited by the viewport height times 6/5). The map and `screenToTile` are unchanged.
- The panel (y 320 to 399) is a raised frame. Coordinates are relative to the panel top (320):
  - Left box (x 4 to 148): line 1 y 6 rank and name (`CPT ALVAREZ`); line 2 y 17 `HP 80/80  AP 72/72`; line 3 y 28 `RIFLE 5/5 +1  GREN 1`; line 4 y 39 `ALERT` when on; hints at y 54 `1-4 SELECT  Q/E TURN` and y 65 `ESC CANCEL  M MUTE`.
  - Right side: turn line at (156, 6) `TURN 3  YOUR MOVE` (grey); message line at (156, 17) clipped to 320 px (yellow; green when the mission ends); AP cost of a mode or move shown there too (`SNAP SHOT: 15 AP`, `MOVE: 8 AP`) as today.
  - Buttons, row 1 (y 28 to 48, 60 px wide, step 64 from x 156): `S SNAP`, `A AIM`, `T THROW`, `K STAB`, `R RELOAD`. Row 2 (y 52 to 72, 76 px wide, step 80 from x 156): `D DOOR`, `P TAKE`, `L ALERT`, `SPC END TURN`. Each button: label at (x+3, y+3), cost at (x+3, y+11) (`15 AP`, red when blocked, none for ALERT and END). The active mode (and ALERT when on) uses the pressed style.
- `PANEL_BUTTONS` keeps the same ids in the same order (snap, aimed, throw, stab, reload, door, pickup, alert, end) with new rectangles, labels and keys; `buttonAt`, `actionCost` and `actionBlocked` are unchanged in behavior.

## 6. Other screens

- **Equipment:** the same rows (step 52 from y 56). Name, rank and kills at x 8 (y+3, +14, +25). Weapon button x 76 (100 wide); `GRENADES` label x 190; minus x 262, count x 300, plus x 322 (24 wide each); `SPARE CLIPS` line at y+26; price at x 380. Header, credits bar (inset frame), breakdown, hint, stash text as today; the Start button moves to y 330 (140x30). All buttons use `drawButton` (hover, disabled, normal). The bar and hint colours follow the new UI colours.
- **Result card (260x210 at 110,50) and end screen:** framed cards with a title strip; the same lines in the pixel font; fallen names, promotions and survivor lists are clipped with `clipText` to the card width. Continue and New campaign are beveled buttons at the existing positions plus the height offset needed by the larger fonts (positions recorded in the plan).
- **Sound hint and notice, "!" alert mark, gallery labels:** drawn with `drawText` (notice right-aligned top right; hint right-aligned at y 388).

## 7. Files touched

- New: `src/ui/font.ts`, `src/ui/text.ts`, `src/ui/frame.ts`.
- Changed: `src/render/layout.ts`, `index.html`, `src/render/panel.ts`, `src/render/renderer.ts`, `src/app.ts`, `src/screens/equipment.ts`, `src/screens/result.ts`, `src/screens/end.ts`, `src/art/gallery.ts`, `README.md`.
- Tests that use hard-coded click coordinates for the equipment, result and end screens and the panel hit areas are updated with the new geometry.

## 8. Testing

TDD for the pure parts; the look is checked by screenshots of every screen.

- Font: every glyph in `GLYPHS` has 7 rows of 5 characters from `#.`; every character the game can display (all strings used in screens, messages, rank and soldier names) is in the character set or reported; the fallback glyph is a visible box; `textWidth` for empty, one and many characters; lower-case maps to the capital.
- `FontAtlas`: a glyph is baked once per (character, colour); different colours are separate entries; drawing places the image at the right position; right and centre alignment use `textWidth`; no canvas means nothing drawn and no throw. `clipText` never exceeds `maxPx`, leaves short text unchanged and ends in `...` when clipped (including a width too small for `...`).
- Frames: `drawFrame` draws the expected edges per style on a recording canvas; the pressed style swaps the edges.
- Panel: every button label and cost fits its button (`textWidth + 6 <= width`); the nine buttons are inside the panel and do not overlap; `buttonAt` hits each button by its centre; text lines do not overlap each other.
- Layout check for each screen (equipment with default and maximal content, mission panel with the longest message and name, result card with several promotions and fallen names, end screen both ways): all text lies inside the 480x400 canvas; no two text rectangles overlap; button labels fit.
- App: every existing flow test still passes with updated coordinates; `VIEW.height` is 400 and `mapHeight` stays 320; map clicks still map to tiles.

## 9. Success criteria

- All four screens use the pixel font and beveled frames in the world's palette; everything is readable at the displayed scale; nothing overlaps or is cut off, including the longest soldier name, the longest message and four promotions.
- Every control, key and screen flow works exactly as before; the full suite passes.
- A screenshot of each screen (equipment, mission with panel, result, end) looks consistent with the world art.

## 10. Risks and notes

- About 60 glyphs are hand-drawn; some may look off. Each is a data fix in `font.ts`; the gallery gains a font sample line to review them.
- The canvas aspect ratio changes slightly (6:5 instead of 4:3), so the page layout is checked in the browser.
- All-caps changes the look of messages from the controller and the core (`Need 24 AP, have 15` becomes `NEED 24 AP, HAVE 15`); the text content itself is unchanged.
- The longest controller messages (for example the alert hint) exceed one line; they are clipped, so a few may need shortening in the plan.
