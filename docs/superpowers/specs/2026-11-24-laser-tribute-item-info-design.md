# Item info: cards for weapons, grenades and gear (short design)

A small follow-up to the base info (soldier cards and building explanations), before project 4 (balance). Rui asked for the same
kind of info card **for weapons and items**, opened from **the Market, the Lab and the equipment screen**.

## Intent and why

A player picking a Sniper, a Flashbang or a Scanner sees a name and a price. The Market and Lab rows show only prices; the
equipment screen shows only buttons. The numbers exist (`WEAPONS`, `THROWABLES`, `GADGETS`, `ATTACHMENTS`) and the mission
soldier card already shows an equipped weapon's numbers, but nothing says what an item does, what it costs with the premium, or
when to choose it. The card answers that in place.

## Goals

- A card for each of the 13 items: 5 weapons, 4 grenades, 3 gadgets (medkit, armour, scanner) and the scope, with its live numbers
  and one short line on what it is good for.
- Opened from three places: the **gear rows of the Market panel**, the **gear rows of the Lab panel**, and a small `?` button
  beside each item button on the **story equipment screen**.
- The card shows the price the player would really pay: base price, and in the story the premium price while the item is not
  researched, or `OWNED` once it is.
- Closes with a click, BACK or Escape, changes no state, writes no save.

## Non-goals

- No change to rules, prices or any number (project 4 tunes them); no new screen; no stash or loadout changes.
- The base upgrade rows of the Lab (beds, labs, contracts, hospital, training) get no item card; they keep selecting as today.
- The Tutorial and Campaign equipment screens are unchanged (the `?` buttons appear only in the story); the card could follow there later.
- No hover tooltips (touch).

## Anti-goals

- A card that disagrees with the game: every number is read from the same tables the fight and the equipment screen use.
- A `?` button that crowds or breaks the equipment screen: it must not overlap any existing button or change what they do.
- Breaking what the rows do today: selecting a Lab row for START, and every equipment button, work as before.

## Approach

One sensible way, the same as the base info: a pure function builds the card's data, a modal box draws it over the screen, hit
areas open it. The soldier-card pattern (name area on a row, a click or Escape closes) already exists, and the equipment screen has free
space beside its buttons for a small `?`.

## Design

### The data (pure)

`src/core/world/iteminfo.ts`:
```ts
export type ItemRef =
  | { kind: 'weapon'; id: WeaponId } | { kind: 'throwable'; id: ThrowableId }
  | { kind: 'gadget'; id: GadgetId } | { kind: 'scope' };
export interface ItemCard { title: string; rows: [label: string, value: string][]; goodFor: string }
export function itemCard(ref: ItemRef, w: World | null): ItemCard;
export function itemOfNode(nodeId: string): ItemRef | null;   // a research node that gives gear -> its item, else null
```
Rows by kind (labels at most 10 characters, values at most 22, supported characters), all read from the config tables:
- **weapon:** `DAMAGE` (with `xN` for a burst), `RANGE`, `SNAP AP`, `AIM AP`, `SNAP ACC` and `AIM ACC` (percent), `MAGAZINE`, `FALLOFF`
  (percent, the default when the weapon has none, as the soldier card does), plus `SIGHT` when it has one and `CLOSE` when it has a close-range
  penalty, as `soldierCard` words them;
- **throwable:** `AP`, `RANGE`, `BLAST` (`3x3` from the radius), `EFFECT` (the same wording as the soldier card's grenade section);
- **gadget:** medkit `HEAL` and `AP`; armour `DAMAGE` `-30%`; scanner `AP` and `RADIUS`;
- **scope:** `ACCURACY +10%`, `CRIT +10%`;
- every card ends with `PRICE`: the base price; and, when `w` is given and the story has a premium (`storyGearRules`), a `STATUS` row: `OWNED`
  when the item is unlocked by research (`unlocksOf(w.research.done)`), else `PREMIUM nn CR` (the premium price, as the equipment screen charges).
  Starting gear that is always unlocked (pistol, rifle, frag, medkit) shows `OWNED`.

`goodFor`: one line per item, drafted below (text, no numbers, so they cannot go stale; each must stay true to the numbers):
- pistol: "A cheap backup: light, quick to fire, short reach."
- rifle: "The all-rounder: good reach and accuracy at a fair price."
- shotgun: "Hits hardest up close, and falls off fast with distance."
- smg: "Fires a burst: many small hits, best at medium range."
- sniper: "Kills from far away; weak when the target is close."
- frag: "Blast damage, and it breaks doors."
- smoke: "Blocks sight for a few turns: cover to cross open ground."
- flash: "Drains the action points of everyone it catches."
- incendiary: "Sets the ground on fire for a few turns, burning whoever stays."
- medkit: "Heals a soldier in the field."
- armour: "Cuts the damage the soldier takes."
- scanner: "Shows enemies near a spot, even through walls."
- scope: "More accuracy and crit chance for the shooter."

### The card (screen)

`drawItemCard(ctx, card)` in `src/screens/baseinfo.ts`, same style as the soldier card: dim, framed box, title in the accent colour,
label and value rows, the `goodFor` line wrapped under them in the hint colour, a BACK button; inside 480x400, at most 14 rows of text.

### Where it opens

- **Market panel:** a click in the name area (the first `NAME_W` px) of a gear row opens that item's card; the rest of the row selects as today.
- **Lab panel:** the same for rows whose node gives gear (`itemOfNode(node.id) !== null`); the base upgrade rows never return a `name` hit.
- **Story equipment screen:** a `?` button (about 20 x 24 px) beside each item button: weapon and gadget at `x` about 180 (right of their button, left of the
  `-` and `+` buttons), grenade at about 430, scope at about 456; each opens the card of the item currently chosen in that soldier's kit. The
  buttons appear only in the story (an `EquipmentView` flag), do not overlap any existing button, and are hit before the nearest-button slop so a tap near them is
  not stolen by a neighbour.
- A click anywhere, BACK or Escape closes the card; opening locks input briefly and Escape ignores key repeat (as the base-info fixes do);
  leaving the screen closes it.

### Tests

Pure: `itemCard` for all 13 items against the config tables (damage, range, AP, accuracy, magazine, price, effect wording), the status row for
researched, unresearched, starting and no-world cases, label and value lengths, supported characters, `goodFor` lines present and short;
`itemOfNode` for every research node (gear nodes map to the right item, upgrade nodes to null). Screens (stub context): the name area of Market and Lab gear rows
gives a `name` hit and upgrade rows do not; the `?` rectangles do not overlap any equipment button, sit inside the screen, and are hit at their centre; the card draws
inside 480x400 for every item. App: from each of the three places the card opens and closes by click and Escape; world and save unchanged; Lab START and
equipment buttons still work; the Tutorial and Campaign equipment screens have no `?` buttons.

## What is left to the builder

Exact box layout, the `?` button rectangles within the free space described, the final `goodFor` wording (Rui reads it once), and the `STATUS` wording
for items found in the stash.

## Calls I made (for Rui to check)

- **Numbers plus one "good for" line.** Rui chose the three places but not this; I added the line because the numbers alone do not say when to choose an item.
- The `?` buttons are in the story only; the Tutorial and Campaign equipment screens are unchanged.
- Market and Lab rows open the card from the name area, like the soldier cards; the rest of the row keeps its job.
- Starting items (pistol, rifle, frag, medkit) are not research nodes, so only the equipment screen opens their cards.
