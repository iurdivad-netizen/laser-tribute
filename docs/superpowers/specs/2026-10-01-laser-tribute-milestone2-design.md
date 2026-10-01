# Laser Tribute: Milestone 2 Design

Date: 2026-10-01
Status: Draft for review
Builds on: `2026-10-01-laser-tribute-milestone1-design.md` (milestone 1 is merged to `master`, PR #1)

## 1. Purpose and intent

Milestone 1 delivered one playable mission, but it has no flow around it: when the mission ends the game only prints "MISSION COMPLETE" or "MISSION FAILED" in the panel, blocks all input, and the player is stuck on the map. Milestone 2 adds the missing flow and the next defining Laser Squad feature, the pre-mission equipment screen.

- Audience and platform are unchanged: Rui, single player, browser, TypeScript and Canvas, top-down 2D.
- **Equipment:** before each mission the player equips four soldiers from one shared budget.
- **Mission end:** a result screen with a Play again button returns to the equipment screen.
- Success means the player can change each soldier's kit within the budget, start the mission, play it to the end, see the result and play again, without ever getting stuck.

Stated by Rui (2026-10-01): after a mission ends, show a result screen and "play again" (not a persistent squad); equipment is a per-soldier loadout from a shared budget; keep the existing Mission 1 map and rules.

## 2. Out of scope for milestone 2

- Carrying survivors or gear to the next mission (persistent squad)
- New item types (armour, medikits, ammunition), soldier names or stats, promotion
- Multiple missions or a mission list, saving and loading
- Sound and music, a title screen or main menu
- Any change to the milestone 1 combat, vision or AI rules

## 3. Screen flow

```
Equipment --Start mission--> Mission --won or lost--> Result --Play again--> Equipment
```

- **Equipment** is the first screen shown when the game opens.
- **Mission** is milestone 1's game, unchanged. When the game state's status leaves `playing` and the mission controller is idle, wait about 1 second so the last shot or death animation plays, then switch to Result.
- **Result** shows the outcome and a Play again button. Play again returns to Equipment with the default loadout.
- Each new mission starts from a fresh state (fresh units, items and map) with a new random seed chosen outside `core`, so a replay does not repeat the same dice.

## 4. Architecture

```
src/
  app.ts                     owns the current screen, switches screens, creates missions
  core/
    loadout.ts               prices, budget, validation, applying a loadout (pure)
    result.ts                summarises a finished GameState (pure)
  screens/
    equipment.ts             equipment screen model, layout, drawing, hit testing
    result.ts                result screen layout, drawing, hit testing
  input/input.ts             forwards logical-pixel clicks, moves and keys to App
  controller.ts              mission controller, unchanged apart from being driven by App
```

- `core/loadout.ts` and `core/result.ts` import nothing from the browser, render, input or screens. The milestone 1 rule that `core` has no browser code still holds.
- `App` routes every input event to the screen that is showing. Keys and clicks never reach a hidden screen. For example Space on the Result screen does not end a turn on the map behind it.
- `input.ts` becomes a thin pipe. It converts DOM events to logical canvas pixels and calls `App`. `App` converts to tiles and panel buttons for the Mission screen exactly as the current input code does, so Mission behaviour does not change.
- `createMission1(seed, loadout?)` accepts an optional loadout and applies it after the map is parsed. Without a loadout it behaves as today.

## 5. Loadout rules

All values live in one config block, like the AP costs.

- **Budget:** 120 credits for the whole squad.
- **Prices:** pistol 10, rifle 25, grenade 8.
- **Per soldier:** exactly one weapon (pistol or rifle) and 0 to 3 grenades.
- **Default loadout:** soldiers p1 and p2 rifle, p3 and p4 pistol, one grenade each. This is today's mission 1 kit. Cost 102, leaving 18 credits.
- **Validity:** a loadout is valid only if every soldier has exactly one weapon, grenades are an integer from 0 to 3, and total cost is at most 120.
- **Applying:** a loadout maps to soldiers by index (first entry to p1, and so on) and sets their `weapon` and `grenades`. An invalid loadout is rejected with a reason and nothing is applied.
- **The tradeoff:** four rifles cost 100, leaving 20 credits for 2 grenades. The squad cannot have the best of everything.

Interfaces:

```ts
interface SoldierLoadout { weapon: WeaponId; grenades: number }
type Loadout = SoldierLoadout[]            // length 4, index 0 = p1
const LOADOUT = { budget: 120, prices: { pistol: 10, rifle: 25, grenade: 8 }, maxGrenades: 3 }
defaultLoadout(): Loadout
loadoutCost(l: Loadout): number
validateLoadout(l: Loadout): string | null // null means valid, otherwise the reason
applyLoadout(state: GameState, l: Loadout): GameState // throws on invalid loadout
```

## 6. Result summary

`summarize(state: GameState)` returns:

```ts
interface MissionResult {
  won: boolean            // state.status === 'won'
  survivors: number       // living player units
  squadSize: number       // total player units
  enemiesKilled: number   // dead enemy units
  enemyCount: number      // total enemy units
  turns: number           // state.turnNumber
}
```

## 7. Equipment screen

Mouse-first, drawn on the existing 480x360 logical canvas with the existing palette and 8px font.

- Four soldier rows, P1 to P4. Each row has a weapon button that toggles Pistol and Rifle, and a minus, count and plus control for grenades.
- A credits bar at the top shows spent out of 120 and the amount left.
- A Start mission button at the bottom. Enter also starts.
- A button that would break the budget or the 0 to 3 limit is shown disabled. Hovering a disabled button shows why (for example "Need 15 more credits").
- The screen model is plain data with pure functions (`toggleWeapon`, `addGrenade`, `removeGrenade`, `canAfford...`), so it is unit-testable without a canvas.

## 8. Result screen

A centred card with "MISSION COMPLETE" or "MISSION FAILED", survivors (x of 4), enemies killed (x of 4), turns taken, and a Play again button. Enter also activates Play again.

## 9. Edge cases and error handling

- Restart creates entirely fresh state. Nothing from the previous mission leaks into the next one.
- The switch to Result waits until the mission controller is idle (`busy` false) plus the roughly 1 second delay, so no controller timer fires against a screen that is no longer showing.
- An invalid loadout can never start a mission: the Start button is disabled and `applyLoadout` rejects it too.
- Input is routed only to the visible screen.

## 10. Testing

- **Unit tests, pure rules:** loadout validation (over budget, missing weapon, grenades below 0 or above 3, non-integer), cost calculation, applying a loadout to the right soldiers, rejection leaves state untouched, default loadout costs 102.
- **Unit tests, result:** survivors, kills, turns, won and lost.
- **Unit tests, equipment screen model:** toggling and grenade changes respect the budget, disabled states are correct, Start enabled only for a valid loadout.
- **Unit tests, screen flow with fake timers:** Equipment to Mission to Result and back; Result appears about a second after the mission ends and only when idle; Play again resets to the default loadout; input reaches only the visible screen.
- **Drawing and clicks:** verified by playing in the browser, including playing a mission all the way to the end and starting a second run.

## 11. Success criteria for milestone 2

- From the first screen, the player can change each soldier's kit within the budget, start the mission, play to the end, see the result and play again, without getting stuck.
- The loadout and result rules behave as described and are covered by unit tests.
- `core` still has no dependency on the browser, renderer, input or screens.
- Mission screen behaviour is unchanged from milestone 1 (existing tests still pass).

## 12. Later milestones (not designed here)

1. Persistent squad between missions, soldier stats and promotion.
2. More items (armour, medikits), a mission list, saving and loading, sound.
3. X-COM style base and research layer, desktop installer.
