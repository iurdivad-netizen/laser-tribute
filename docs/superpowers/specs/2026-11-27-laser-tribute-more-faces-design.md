# Soldier faces on training, hospital and the stats cards

Approved by Rui on 2026-11-27 ("Yes, build it").

## Why

Faces show in story scenes and in the barracks only. The same soldiers are listed elsewhere without them.

## What changes

| Screen | Change |
|---|---|
| Training panel | small face on each row, as in the barracks |
| Field hospital panel | below the three facility rows, one row per wounded soldier: face, name and rank, `WOUNDED 3D`. Tapping the name opens the soldier's card. Nobody wounded: no extra rows. |
| Base stats card | 64x64 face at the top; the card is taller |
| Mission stats card (`I`) | face added, sized so the card still fits small phones |

"Each individual stats card" is read as both the base card and the mission card.

## Not changing

Squad and result screens name soldiers but stay as they are. No game rules change.

## Approaches

1. One lookup, "which soldier is on this row", used by the row hit test, the drawing and the click handling. Chosen: the hospital rows do not start at soldier 0, so a row number can no longer stand for a soldier.
2. Separate hospital cases in each of those three places. Rejected: three copies of the same offset.

## Details left to the builder

- Faces are drawn only where a canvas exists; without one the panels and the mission card look as before (the base card keeps its new box).
- With a wounded soldier's row selected the hospital offers no START: that button is the facility upgrade.
- On the mission card the face sits left of the text, or above it where there is no width to spare.
- The face never takes the card's text below scale 1, or below the scale the card would have had without it if that is already smaller. A tight screen may lose enlargement down to scale 1 (740x260 at 3x: 1.33 to 1). Where even that is impossible, the face is left out.
