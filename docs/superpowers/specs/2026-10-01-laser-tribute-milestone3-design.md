# Laser Tribute: Milestone 3 Design

Date: 2026-10-01
Status: Draft for review
Builds on: milestone 1 and 2 specs in this folder (both merged to `master`; the game is live at https://iurdivad-netizen.github.io/laser-tribute/)

## 1. Purpose and intent

Today the game is one mission that can be replayed, and nothing carries over: what you do in a mission does not matter afterwards. Milestone 3 turns it into a small **campaign with a persistent squad** and gives the player something that improves: the **budget**.

- Audience and platform are unchanged: Rui, single player, browser, TypeScript and Canvas, top-down 2D.
- Stated by Rui (2026-10-01): milestone 3 is a small campaign with a persistent squad (option 1 of four directions); soldiers carry over but gear does not; "something has to improve", chosen as budget growth from won missions and from kills by individual soldiers; one shared pool; three hand-made missions now, **generated maps eventually** (so missions must be plain data a generator can later produce).
- Success means the player can play Mission 1, 2 and 3 with the same soldiers, see the budget grow with wins and kills, lose a veteran and feel it, and reach Campaign complete or Campaign lost, each with a way to start a new campaign.

## 2. Out of scope for milestone 3

- Soldier stat growth or promotion (only the budget improves), new item types
- Saving and loading (reloading the page starts a new campaign)
- Generated maps (future; this milestone only keeps missions data-driven)
- Map scrolling or maps larger than 30x20 (the canvas shows exactly 30x20 tiles)
- Sound and music
- Any change to the combat, vision or AI rules from milestone 1

## 3. Campaign flow

```
Equipment (mission N) -> Mission -> Result -> Equipment (mission N+1) -> ... -> Campaign complete
                                       \-> Campaign lost (all four soldiers died)
```

- A new campaign starts at Mission 1 on the Equipment screen.
- **Win a mission** (all enemies dead): the Result screen shows the outcome and the budget for the next mission. Continuing goes to the next mission's Equipment screen. Winning the **last** mission goes to **Campaign complete**.
- **Lose a mission** (all four soldiers dead): the campaign is over; the screen after the Result is **Campaign lost**.
- Partial casualties still count as a win if the enemies are cleared.
- **New campaign** (from either end screen, button or Enter) starts again with a fresh roster and no wins.

## 4. Data model (pure `core`)

### 4.1 Soldiers and the roster

- The roster always has **4 active soldiers**. Each is `{ name, kills }`. Soldiers carry over between missions; **gear does not** (it is re-bought each mission on the Equipment screen).
- A soldier who dies is **gone for good**. At the next mission his slot is filled by a fresh rookie (new name, 0 kills). Fallen soldiers are kept in a `fallen` list for the result and end screens.
- Names come from a fixed list of 12. The first four start the campaign and each rookie takes the next unused name, so a name is not reused within a campaign. If the list is exhausted, names continue as the list name with a numeric suffix.
- A mission unit gets two new fields: `name` (from the roster) and `kills` (kills made in this mission, starting at 0).

### 4.2 Kill crediting

- A kill is credited to the soldier who fired the killing shot (including reaction fire) or threw the grenade whose blast killed the enemy, and **only for enemies** (units of the opposite side). A unit killed by its own side's blast gives no credit.
- Per-mission kill counts live on the units; the campaign adds them to the roster when the mission is recorded.

### 4.3 Campaign state and operations

```ts
const CAMPAIGN = { baseBudget: 120, winBonus: 20, killBonus: 5, rosterSize: 4 }
interface RosterSoldier { name: string; kills: number }
interface Campaign {
  missionIndex: number            // 0-based index into MISSIONS
  missionsWon: number
  roster: RosterSoldier[]         // exactly 4 active soldiers
  fallen: RosterSoldier[]         // soldiers who died, in order
  namesUsed: number               // next unused entry of the name list
  status: 'active' | 'won' | 'lost'
}
newCampaign(): Campaign
campaignBudget(c: Campaign): number
recordMission(c: Campaign, finished: GameState): Campaign   // pure; returns a new Campaign
```

- **Budget formula:** `campaignBudget = 120 + 20 x missionsWon + 5 x (sum of kills of the active roster)`. Kills of fallen soldiers do not count, so losing a veteran lowers the budget.
- `recordMission` reads the finished mission's player units in slot order (p1..p4), adds each unit's mission kills to its roster soldier, moves soldiers who died to `fallen` and replaces them with rookies. If the mission was won it increments `missionsWon` and advances `missionIndex`; if that was the last mission `status` becomes `won`. If the mission was lost `status` becomes `lost`. It never mutates its inputs.

### 4.4 Missions as data

```ts
interface MissionDef {
  id: string
  name: string
  rows: string[]                      // ASCII map, same legend as before (# + . P E r p g)
  patrols: Record<string, Pos[]>      // by enemy id (e1, e2, ...)
}
const MISSIONS: MissionDef[]          // three entries
createMission(def: MissionDef, seed: number, roster: RosterSoldier[], loadout: Loadout): GameState
```

- Mission 1 is the existing map, moved into the list unchanged. Its enemy count (4), weapons and patrols stay as they are, so Mission 1 plays exactly as today.
- **Mission 2:** a new map with 6 enemies. **Mission 3:** a new, denser map with 8 enemies. Both fit the 30x20 limit and have exactly 4 soldier starts. Exact maps are designed in the implementation plan.
- A future generator only has to produce `MissionDef` records; nothing else changes.
- `createMission` builds the state from the definition, applies the loadout, and names the soldier units from the roster.

### 4.5 Loadout rules take a budget

The milestone 2 loadout functions currently use a fixed 120 credits. They take the budget as a value (defaulting to 120 so existing behaviour and tests keep working): `validateLoadout(l, budget)`, and the equipment screen's block-reason and toggle functions. A new `fitLoadout(previous: Loadout, budget: number): Loadout` returns `previous` if it is valid under `budget`, otherwise a cheap fallback kit (pistol and one grenade each, cost 72, which always fits).

## 5. Screens

All drawn on the existing 480x360 canvas with the existing palette and font. The 0.3 second input guard from milestone 2 applies to every screen switch.

- **Equipment:** opens pre-filled with `fitLoadout(previous kit, budget)` for missions after the first (Mission 1 uses the default kit). Shows the mission name and number, the budget with its breakdown (base, wins, kills), and each soldier row with his name and kills. Controls are unchanged.
- **Mission:** unchanged.
- **Result:** as milestone 2, plus the fallen soldiers named and the budget for the next mission. The button reads "Next mission" (Enter works too).
- **Campaign end (complete or lost):** one shared layout showing missions won, total kills by the active roster, the survivors and the fallen, and a "New campaign" button (Enter works too).
- `App` holds the `Campaign` and drives the screens. Screen kinds become `equipment | mission | result | end`.

## 6. Edge cases and error handling

- A soldier killed by a friendly blast counts as a casualty, and the kill is credited to nobody.
- A budget that falls after a veteran dies cannot start a mission over budget: the Equipment screen falls back via `fitLoadout`.
- Winning the last mission goes to Campaign complete and never to a non-existent next mission.
- The Mission 2 and 3 maps are validated by tests: equal row widths, exactly 4 soldier starts, the right enemy count, and every start tile and patrol point walkable and reachable from the soldiers' start.
- A new campaign and a new mission always start from fresh state with a new random seed (as in milestone 2).

## 7. Testing

- **Unit tests, pure rules:** `campaignBudget`, kill crediting (shots, reaction fire, grenade blasts, enemies only), `recordMission` (kills added, casualties moved to `fallen`, rookies with unique names, win and loss, last mission), `newCampaign`, `fitLoadout`, budget-aware loadout validation.
- **Unit tests, mission data:** each `MissionDef` map as described in section 6, and `createMission` (names, loadout applied, patrols set). Mission 1 built through `createMission` equals today's Mission 1.
- **Unit tests, screen flow:** Equipment through Mission and Result into the next mission, through to Campaign complete and Campaign lost, and New campaign resetting everything; input reaches only the visible screen.
- **Play in the browser:** at least Missions 1 and 2, including a casualty and its replacement, and both end screens (using the dev-mode `window.app` to speed things up).

## 8. Success criteria for milestone 3

- Missions 1, 2 and 3 can be played in sequence with the same soldiers; the budget visibly grows with wins and kills and shrinks when a veteran dies.
- Campaign complete and Campaign lost both appear when they should, each with a working New campaign.
- The new rules are covered by unit tests; `core` still has no dependency on the browser, renderer, input or screens; the milestone 1 and 2 behaviour and tests are unchanged.

## 9. Later milestones (not designed here)

1. Generated maps (the missions-as-data design is the hook for this).
2. Soldier stat growth and promotion, new items (armour, medikits), saving and loading.
3. Sound, a pixel font and real art, base and research layers, a desktop installer.
