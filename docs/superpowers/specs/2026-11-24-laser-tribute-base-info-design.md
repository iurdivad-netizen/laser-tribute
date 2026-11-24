# Base info: soldier stat cards and building explanations (short design)

A small change to the story mode's base, before project 4 (balance). Rui asked for **a stat card for soldiers when their name
is clicked, and plain explanations for buildings**.

## Intent and why

Today the barracks shows a soldier as name, rank, status and kills, and the building panels show rows and prices but never say
what the building does or what the next level gives. A player cannot tell what a Sergeant is worth, what training buys, or why
the Market costs more. The base should answer those questions in place, in plain words, using the game's real numbers.

## Goals

- Clicking a soldier's name in a base list opens a **stat card** for that soldier.
- Every base panel has an **INFO** button that opens a short plain-language explanation of the building, with live numbers.
- Both close with a click, BACK or Escape, and never change the game state.

## Non-goals

- No actions on the card or the info box (TRAIN, HIRE and the rest stay on the panels); no per-soldier weapon or kit (kit is
  chosen before each mission); no portraits on the card (faces from 3c may be added later); no hover tooltips (they fail on touch);
  no change to rules, costs or any number (project 4 tunes them); no mission soldier card changes; no Tutorial or Campaign changes.

## Anti-goals

- A card that disagrees with the fight: its HP, AP and accuracy must come from the same rank table the missions use.
- Explanation text that goes stale: no numbers typed into the text; they are read from `BASE_RULES`, the research tree and the world.
- Breaking what the rows do today: selecting a soldier for TRAIN, or picking one for the squad, must still work.

## Approach

One sensible way: a modal card and a modal info box drawn over the existing panel, in the 480x400 menu space with the existing
frame, button and text helpers, as the mission's soldier card is a modal over the map. Hover tooltips do not work on touch, a
separate help screen is much more than asked for, and the panel and card patterns already exist.

## Design

### The soldier card

Opened by a click on the **name area** of a soldier row (the label part on the left of the row, `x` up to 120 px of the
444 px row, face included when there is one; narrow on purpose so most of the row keeps its old job); a click on the rest of the row selects as it does today. The card also selects
the soldier's row. Soldier rows exist in the **barracks** panel and the **training** panel; the hospital panel lists the
facility, not soldiers, so wounded soldiers are reached through those two. The **squad step** uses the same rule (name area
opens the card, the rest of the row picks), if its rows have room; the builder checks the geometry and reports if not.

Card contents, as `CardSection`-style label and value rows (the same shape as `src/core/stats.ts`):
- heading: `NAME` and the rank name (for example `SERGEANT`);
- `HP`, `AP` and `ACCURACY`: the base soldier values plus the rank bonuses (`CONFIG.soldierHp`, `CONFIG.maxAp` and the rank's
  `hp`, `ap`, `accuracy` from `RANKS`), computed by one pure function used by the card, and shown as the same numbers a mission
  soldier of that rank gets;
- `KILLS` and `TRAINED` (training points; both count toward rank);
- `NEXT RANK`: the next rank's name and how many more points it needs (`minKills` less kills plus training points), or `TOP RANK`;
- `STATUS`: `READY`, `TRAINING nD` or `WOUNDED nD`;
- when the training facility is built, the point cap training can reach, read from the same rule `canTrain` uses;
- a last line: `KIT IS CHOSEN BEFORE EACH FIGHT`.

New pure module for the data (`src/core/world/soldierinfo.ts`): `soldierStats(s: PoolSoldier, w: World)` returning the values and
the label rows, so it is tested without a canvas. A drawing function draws it in a framed box with a BACK button.

### The building explanations

An **INFO** button on every panel (lab, market, barracks, training, hospital, wait), clear of the rows and the existing buttons.
It opens a framed box of at most 8 short lines of plain text (uppercase font, supported characters only), built by a pure
function `buildingInfo(id: PanelId, w: World): string[]` from the live rules:
- **Lab:** what research unlocks (gear and upgrades), one project at a time, and how much the labs level shortens it (`labFactor`).
- **Barracks:** the beds you have and the next beds upgrade; the hire cost; that a loaned mercenary costs a fee per fight (`mercFee`).
- **Market:** that locked gear costs its base price times the premium on the equipment screen, and that researching an item at
  the lab removes the premium (`premium`, shown as a percentage).
- **Training:** what a facility level does (rank points up to a cap, for `trainDays` days, one soldier at a time, out of the squad
  meanwhile) and the level you have.
- **Hospital:** the second chance (`hospitalChance` at your level): after a won fight a fallen soldier may be recovered wounded for
  `woundedDays` days instead of lost.
- **Wait:** that waiting passes 1 or 3 days: income arrives, research, training and healing advance, and the enemy garrisons grow
  or counterattack depending on difficulty.

The wording is drafted in the plan and read once by Rui before it is built into tests.

### Tests

Pure: `soldierStats` for each rank (a Rookie, a Captain, a soldier with training points crossing a threshold, `TOP RANK`, a training
and a wounded soldier) and against a created mission soldier of the same rank (same HP, AP, accuracy); `buildingInfo` for every
panel, at several research levels, containing the live numbers, at most 8 lines, supported characters, each line fits the box
width. Screens (stub context): name-area hit opens the card and selects the row, the rest of the row only selects, INFO opens the
box on every panel, BACK, Escape and a click close them, text stays inside 0..480, a full 12-soldier barracks still draws; the app:
opening and closing changes no world state and no save, and the squad step still picks and deselects.

## What is left to the builder

Exact box layout and the INFO button position, the final wording within the content above, whether the card reuses the mission
card's section drawing, and the squad-step geometry check.

## Calls I made (for Rui to check)

- The name area opens the card and the rest of the row keeps selecting or picking, so TRAIN and squad picking are unchanged.
- The hospital panel gets an INFO button but no soldier card (it has no soldier rows).
- The card shows rank-derived stats only; weapon and kit are not shown because they are chosen per fight.
- The explanation text reads live numbers, so project 4's balance changes show up without editing it.
