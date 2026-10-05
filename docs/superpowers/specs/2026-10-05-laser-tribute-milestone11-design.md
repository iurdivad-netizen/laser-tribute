# Laser Tribute Milestone 11: Gadgets (Medkit, Body Armour, Motion Scanner) (Design)

Date: 2026-10-05. Follows milestone 10 (enemy door-opening). Generated maps are milestone 12, a separate cycle.

## Purpose

Soldiers carry only a weapon, grenades and clips. Rui chose three new items for tactical depth: a **medkit**, **body armour** and a **motion scanner**, carried one per soldier. Success: the equipment screen offers a real choice per soldier (heal, protect, or see), each gadget works in a mission with clear feedback, and nothing changes for a player who buys no gadget.

## Decisions (Rui, stated)

- Items for milestone 11: **medkit, body armour, motion scanner** (smoke grenade not chosen).
- **One gadget slot per soldier**: none, medkit, armour or scanner, chosen with one extra button on the soldier's equipment row.
- Generated maps follow as milestone 12.
- The numbers below are my proposals, accepted with the design sections.

## Scope

In: the three gadgets, loadout/price/stash/save support, two new commands, equipment screen button, panel context button, map markers, two sounds, tests.
Out: more than one gadget per soldier, gadget loot or enemy gadgets, smoke grenades, upgrades, map changes.

## Design

### Gadgets (numbers calibrated to soldiers 50 HP, enemies 40, rifle 30, pistol 18, grenade 40, knife 60)

| Gadget | Price | Action | Effect |
|---|---|---|---|
| Medkit | 12 cr | `Heal`, 12 AP, one use | Restores 25 HP (up to max HP) to the medic or an adjacent living teammate below max HP |
| Body armour | 20 cr | none (passive) | Every hit on the wearer does 30% less damage, rounded down, never below 1 |
| Motion scanner | 15 cr | `Scan`, 10 AP, one use | Marks every living enemy within 8 tiles (through walls) until the end of the player's turn |

Armour applies to shots, grenade splash and knife stabs; it does not change hit chance. Scanned enemies are markers only: nothing can be shot at them, and the enemy AI never reads them. A scan with no enemy in range still spends the scanner and AP.

### Core data and rules (`src/core`)

- `types.ts`: `GadgetId = 'medkit' | 'armour' | 'scanner'`; `Unit.gadget: GadgetId | null`; `GameState.scanned: Pos[]`; commands `Heal { unitId, targetId }`, `Scan { unitId }`; events `healed { unitId, targetId, amount }`, `scanned { unitId, found: Pos[] }`.
- `config.ts`: `GADGETS = { medkit: { name, price: 12, apCost: 12, heal: 25 }, armour: { name, price: 20, reduction: 0.3 }, scanner: { name, price: 15, apCost: 10, radius: 8 } }`.
- `loadout.ts`: `SoldierLoadout.gadget: GadgetId | null`, default `null` in `defaultLoadout` and `cheapLoadout`; `soldierCost`/`loadoutCost` include the gadget price (minus stash cover); `validateLoadout` rejects an unknown gadget id; `applyLoadout` gives the unit its gadget; `fitLoadout` drops gadgets last (after extra clips, before weapons or grenades).
- `stash.ts`: `Stash` gains `medkit`, `armour`, `scanner` (counts, default 0). `Cover` gains `gadget: boolean`. `coverage` hands stashed gadgets out in soldier order. `nextStash`: for a surviving soldier, an unused medkit or scanner, and worn armour, return to the stash (lent or bought alike); a used medkit or scanner is gone; a dead soldier's gadget is lost. `describeStash` lists gadgets. `capStash` caps each gadget count at 4. `loot.ts`: no gadget loot.
- `actions/heal.ts`, `actions/scan.ts`, registered in `apply.ts`. `Heal` rejects: no medkit, not enough AP, target dead, target not the medic or adjacent (Chebyshev 1), target at full HP. It deducts AP, sets `unit.gadget = null`, raises HP by `min(25, maxHp - hp)`. `Scan` rejects: no scanner, not enough AP. It deducts AP, sets `unit.gadget = null`, fills `state.scanned` with positions of living enemies within the radius (Chebyshev distance), emits `scanned`. `EndTurn` by the player clears `state.scanned`.
- `combat.ts`: one helper `damageTaken(target, raw)` = `target.gadget === 'armour' ? max(1, floor(raw * 0.7)) : raw`, used wherever shots, grenade splash and stabs subtract HP.
- `mission.ts` and test helpers initialise `gadget: null` and `scanned: []`; existing tests keep passing.

### Saves (`src/save.ts`)

Additive, so the save version stays 1: a loadout entry may carry `gadget` (one of the three ids or absent = none; an unknown id replaces the whole loadout with the default, as for other malformed loadouts); the stash may carry `medkit`, `armour`, `scanner` (absent = 0, same 0..99 bounds). Old saves load unchanged; the app caps the stash through the existing paths.

### Interface

- **Equipment screen:** one button per soldier row, `NONE` / `MEDKIT` / `ARMOUR` / `SCANNER`, cycling on click, with the price on the row and `FREE` when the stash covers it, like weapons. The found-gear line includes gadgets. Over-budget feedback is unchanged. The layout must fit the longest content (`Lindqvist 2`, `SCANNER`, prices).
- **Action panel:** one context button **GADGET** (key `G`) whose label is `HEAL` or `SCAN` for those gadgets (disabled for armour or none), with its AP cost. Row 2 currently holds DOOR, TAKE, ALERT, END TURN; to fit five buttons, DOOR, TAKE and ALERT are narrowed, END TURN keeps its width. `buttonAt`, `actionCost`, `actionBlocked`, the key handler and the panel layout test are updated. `Scan` fires immediately; `Heal` enters a targeting mode (click the medic or an adjacent teammate), cancelled like throw and door.
- **Map:** scanned enemies are drawn as red dots on tiles the player cannot see, until the end of the player's turn; a heal shows the green spark on the target; an armoured soldier gets a small blue pip next to the rank pips; the soldier info shows the carried gadget.
- **Sound:** two synthesized recipes, `heal` (rising chime) and `scan` (sonar ping), mapped from the `healed` and `scanned` events in `audio/mapping.ts` (audible rules as for other friendly actions).
- **Messages:** `ALVAREZ HEALS BRANDT: +25 HP`, `SCAN: 3 ENEMIES NEARBY`, `SCAN: NO ENEMIES NEARBY`, plus the existing style of rejection messages.

### Edge cases and rulings

- Heal on self is allowed; a promoted soldier's higher max HP counts; heal never exceeds max HP.
- Armour replaces a medkit or scanner choice (one slot); stash lending follows the weapon rules (survivor returns it, the dead lose it, a lost mission returns nothing).
- With no gadget chosen, damage, costs, budgets, saves and enemy AI are exactly as in milestone 10.
- Scan dots are never saved (saves happen between missions) and never reach the enemy side.

## Testing

- Core: `Heal` and `Scan` (success, each rejection, AP and consumption, scan radius edge, walls ignored, none in range); armour damage for shot, grenade splash and stab (values 30→21, 18→13, 40→28, 60→42, minimum 1); `EndTurn` clears scans; loadout cost, validation, `fitLoadout` order, `applyLoadout`; `coverage`, `nextStash` (unused returns, used does not, dead loses, armour returns), `capStash`, `describeStash` with gadgets.
- Save: an old save (no gadget fields) loads; a save with gadgets round-trips; an unknown gadget id falls back to the default loadout; stash gadget counts out of range are rejected.
- Interface: equipment button cycling, `FREE`, over-budget; panel label and enabled state for each gadget, heal targeting and cancel, scan marker drawing, sound mapping for the new events; layout checker on the equipment screen and panel with the longest content.
- Scripted mission test: a medic heals a wounded teammate; a scan shows an enemy behind a wall; an armoured soldier survives one more rifle hit than an unarmoured one.
- Real browser: buy a medkit, heal, scan, look at the equipment screen and map (screenshots).

## Constraints

- `src/core` stays pure and deterministic; gadgets use no randomness.
- No new dependencies; the 16x16 sprite grid, 5x7 font and 480x400 canvas are unchanged.
- New test files get distinctive names (check with `ls tests`); never overwrite an existing test file.
