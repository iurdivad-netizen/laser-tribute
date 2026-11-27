# Painted faces in the game: design (small change)

Date: 2026-11-27. Status: approved by Rui.

## Intent

The game shows the painted, mixed PixelLab faces for every soldier, in place of the faces drawn in code
(`src/art/facegen.ts`). The faces and swap rules merged in `db2d2d0` (`art-src/faces/README.md`) are the source.

## Goals

- The story scene (64 x 64) and the barracks list (16 x 16) show painted faces for every soldier and speaker.
- Chen and Dubois show their own painted portraits.
- Alvarez and Brandt each have one fixed mixed face.
- A hire's face follows from the name: same name, same face, with no new save fields.

## Not doing

- No new portraits and no PixelLab spend.
- No change to the swap rules, no face editor, no ageing, no change of face on promotion.
- No change to camp, planet or figure art.

## Would count as failure

- A face that the swap rules forbid appears.
- A hire looks like one of the four originals (same head and same clothes).
- A soldier loses a face where one is drawn today.

## Constraints

- Faces are strictly straight front.
- `faceImage(name, small)` is synchronous; the screens keep calling it as they do now.
- Tests run without a DOM and `@types/node`.

## Approaches

1. **Mix in game (chosen by Rui).** A script stores the six prepared portraits as colour lists and pixel maps in a
   generated module; the game mixes a face when needed. About 30 KB (estimate); a new portrait is cheap.
2. Pre-draw every face. Simpler game code, but 585 KB for 201 faces, and each new portrait multiplies it.
3. Load the PNG files in the browser. No generated copy, but pictures arrive late and faces are drawn immediately today.

## Decisions

### Who gets which face

| Soldier | Head | Eyes | Mouth | Clothes |
|---|---|---|---|---|
| Alvarez | veteran | veteran | veteran | woman |
| Brandt | man | man | veteran | man |
| Chen | chen | chen | chen | chen |
| Dubois | dubois | dubois | dubois | dubois |

Everyone else, including the `RECRUIT` speaker and names like `Alvarez 2`, is a hire:

- The name picks one of four heads (`woman`, `veteran`, `man`, `blonde`) with equal chance, then one of that head's faces.
- Never a `chen` or `dubois` head. Never `veteran` head with `woman` clothes (Alvarez) or `man` head with `man` clothes
  (Brandt).
- That leaves 180 hire faces: woman 48, veteran 60, man 27, blonde 45.
- Hires can repeat a face; there are about 124 surnames and only four hire heads, so lookalikes are expected.

### How it is built

- A build script reads the six PNGs, does the existing clean-up (background, shift, specks, skin colour) and writes a
  generated module with each portrait's pixels and measurements.
- The mixing code and swap rules exist once, used by the game and by the contact-sheet script.
- The 16 x 16 face is shrunk from the 64 x 64 one.

### What is removed

`src/art/facegen.ts`, `src/core/world/faces.ts`, `tests/facegen.test.ts` and `tests/facespec.test.ts` are deleted.
`tests/faceimage.test.ts` is updated. This reverses the code-drawn faces of PR #72; git history keeps them.

Existing saves keep working; their soldiers show the new faces.

## Checks

- Tests: the generated module matches the PNGs; the four originals get the faces above; every surname gets an allowed
  hire face; both sizes are drawn; the existing mix tests still pass.
- Screenshots of the story scene and barracks are shown to Rui before a pull request.

## Left to the builder

- Module names and the exact stored format.
- The shrinking method for 16 x 16. A plain average loses almost all features; try better ones, keep the clearest and
  show it in the barracks screenshot.
