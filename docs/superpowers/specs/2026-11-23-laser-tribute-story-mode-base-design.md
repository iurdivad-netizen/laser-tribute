# Laser Tribute story mode, project 2: the base

## Intent and why

Story mode (project 1, merged as PR #54) gives the player a planet to take back, but between fights there is nothing to build: gear unlocks by a made-up number (regions taken / 3), the budget is recomputed each mission, and the squad is exactly four soldiers who are replaced for free. Rui wants the X-COM base layer: somewhere to spend credits and days that makes the next fight better, and makes losing soldiers matter. Goal, as for the whole mode: a beautiful, well-built, enjoyable game.

**Status 2026-11-23:** project 2 implemented on branch `feature/story-base` (plan: `docs/superpowers/plans/2026-11-23-story-mode-base.md`).

Story mode is several projects: (1) planet and spine, done; **(2) the base, this document**; (3) story and art; (4) balance.

## Decisions Rui made

- A **research tree** and a **barracks pool you pick four from**, plus a **marketplace** where advanced weapons can be bought at a higher price than researched ones.
- **Rented kit:** credits are a persistent stockpile; each mission's kit is paid for from it; a dead soldier's kit is gone. (An owned armoury was considered and declined.)
- **Research costs credits and days**, one project at a time.
- The tree holds **gear and base upgrades**, including a **training facility** and a **field hospital**.
- **Training takes a soldier out for days.** A lowest-tier loaned mercenary can fill the fourth slot (Rui's idea; details below are my calls).
- **Training gives rank progress, capped by facility level.** Flat stat bonuses and chosen specialisms were liked and are future extensions, not part of this project.
- **Soldiers are hired for credits** up to the barracks bed count; a dead soldier is not replaced for free.
- **The hospital gives a second chance:** after a won mission each soldier who died has a chance to be recovered wounded (out for days, rank kept) instead of lost; more chance with each hospital level.
- **Days pass through planet actions and a WAIT button** at the base (a pressure-free catch-up on CALM, a real cost on PRESSURE).
- **Screen:** build the hub of status tiles (option B) now; the goal is a drawn base you tap (option C), so buildings are data with positions and the tiles are a replaceable look.
- **Build approach:** extend the story world (one save, one `advance`), not a second module.

## Goals

- Credits, research, the soldier pool, training and the hospital are part of the story world's rules and saved state, in pure `src/core`, driven by the same `advance(days)` that already runs garrison growth and counterattacks.
- Research replaces the interim gear-level rule: what the squad may carry is the set of researched items.
- The equipment screen is reused. Unresearched gear is selectable at a premium price.
- A new base screen reachable from the planet, usable by tap, built so project 3 can replace the tile look with drawn buildings without touching the rules.
- Tutorial and Campaign behave exactly as before.

## Non-goals

A drawn base and soldier art (project 3), stat training or chosen specialisms, a wound system for survivors, an owned armoury, defence missions, story text, new audio, new weapons or gear, rebalancing the tactical game, balance tuning of the new numbers (project 4).

## Anti-goals

- Breaking or re-balancing Tutorial or Campaign: their saves, the recorded enemy-turn fingerprints and the 64-seed balance study stay valid.
- A base that is homework: nothing may need constant attention, and a player who ignores a building should simply not get its benefit, not be punished or stuck.
- A spreadsheet look: the hub shows the state of the whole base at a glance.
- A player who is broke and stuck: free kit (pistol, rifle, frag) and loaned mercenaries always allow another fight.

## Constraints from the code

- `src/core` is pure: commands in, events out, plain data, seeded randomness. The base rules follow that and know nothing about the browser.
- The story world is `World` in `src/core/world/world.ts` (regions, day, difficulty, `roster` of exactly four, `fallen`, `namesUsed`, `stash`). Its save (`src/storysave.ts`, `STORY_SAVE_VERSION = 1`) is strict: any inconsistency parses to `null`. The roster is validated as exactly four. Adding base state means a version bump and a loader for version 1 saves.
- `resolve` folds a fight into the world by building a temporary `Campaign` and calling `recordMission`, which maps the four player units to the four roster entries by index. With a pool, only the four deployed soldiers go through this; the rest of the pool must be left untouched.
- Every generated map spawns four player soldiers, and `createMission` assigns roster entries by index. The squad is therefore always four units; a soldier on leave is covered by a loaned mercenary, not by a smaller squad.
- Gear unlocking is a single `level` number: `unlockedWeapons(level)` and `unlockedThrowables(level)` in `src/core/config.ts`, used by loadout validation (`src/core/loadout.ts`), the equipment screen (`src/screens/equipment.ts`) and enemy arming (`src/core/enemyArms.ts`, which must keep using the enemy level). Gadgets (medkit, armour, scanner) and the scope are not locked in any mode today.
- Rank comes only from `kills` (`rankFor`, `applyRank` called with `roster[i].kills` in `createMission`). Kills also pay 5 credits each to the budget. Training must add rank without adding credits and without being overwritten when a fight's kills are folded in.
- The planet's `World.gearLevel` is the interim rule this project removes. Enemy level (map type + 1) stays as it is.
- Menus are drawn in the 480x400 menu space with the existing frame and text helpers and must be usable by tap (touch slop as on the other screens).

## Approaches considered

- **1. Extend the story world (chosen).** Base state joins `World`; credits, research, training, healing and income all advance in `advance`. One save, one source of truth, testable headlessly by the bot. Costs a save version bump with defaults for old saves.
- **2. A separate base module with its own save.** Cleaner separation, but two saves must agree on the day and `advance` would have to call into both. Rejected.
- **3. Base state held only in the App.** Credits, research and income are game rules, not display; the tests and the headless bot could not use them. Rejected.

## Design

All numbers are starting values to be tuned in project 4; they live in one table next to the difficulty presets.

### Unlocks, replacing the gear level

Introduce an `Unlocks` value: the sets of weapons, throwables, gadgets and attachments the squad may carry. Loadout validation, the equipment screen and enemy arming take `Unlocks` where they now take a gear `level`, with an adapter `unlocksFromLevel(level)` that gives exactly today's sets (gadgets and the scope unlocked at every level), so Tutorial and Campaign are unchanged. Story builds `Unlocks` from its researched set. Enemy arming keeps `enemyLevel`.

### Credits and income

`World.credits` is the stockpile. It rises by `income per day` = (regions held + allied) x a per-preset rate, paid each day inside `advance`, and by a bounty on each kill by the squad at the result (replacing the old "+5 per kill by living soldiers"). It falls by the kit bought at the start of a mission, research costs, and hiring. The starting stockpile is enough for the default kit.

### Research

A fixed tree of nodes, each with credit cost, days, and prerequisites. One project at a time (`World.research`: researched ids, plus an optional active `{ node, daysLeft }`). Starting research: pistol, rifle, frag and medkit. Nodes:

- **Gear:** shotgun, SMG, sniper (chain), smoke, flash, incendiary (chain), armour, scanner, scope.
- **Base:** barracks beds I to III, labs I to II (faster research), supply contracts I to III (higher income rate), field hospital I to II, training facility I to III.

Finishing a node happens inside `advance`; a started project cannot be cancelled.

### Marketplace

An unresearched gear item (weapon, throwable, gadget, scope) is available on the equipment screen at its base price times a premium (starting 1.5); researched gear costs its base price; stash items are free, as now. The marketplace is that price rule plus a base tile that shows what the premium is and what research would save; it sells nothing outside the tree.

### Barracks and the squad

`World.soldiers` is the pool: each soldier has name, kills, `trained` (rank-only training points), and a status: ready, training (days left), or wounded (days left). Beds: 6 at the start, plus 2 per barracks node (up to 12). Hiring a rookie costs credits, up to the bed count; there is no free replacement. Before a mission the player picks four ready soldiers (a squad step in front of the equipment screen); fewer than four ready are topped up with loaned mercenaries.

A **loaned mercenary** is a rookie-tier soldier who costs a small fee per mission, earns no rank, adds nothing to kills, and leaves after the mission (my call).

Only the four deployed soldiers go through `recordMission`; their kills are added to their pool entries. A soldier who is training or wounded is not deployable.

### Training

The training facility (levels I to III) trains one soldier at a time (a stint of a few days). A stint adds training points (`trained`) toward rank only: rank is `rankFor(kills + trained)`, applied when the mission's roster is built, never added to `kills` (so it pays no bounty and is not overwritten by folded-in kills). Facility level caps the rank training can reach: I to Private (2), II to Sergeant (5), III to Captain (9). The rest comes from the field.

### Field hospital

After a **won** mission, each deployed soldier who died is rolled once: with chance by hospital level (0%, then 25%, then 50% as a start) he is recovered wounded instead of dead. A wounded soldier keeps rank, kills and training, is out for a number of days, and then returns to ready. A lost (wiped) mission gets no second chance. The roll is deterministic from the world seed, the region and the attempt.

### Time

`advance(days)` now also pays income, ticks research, training and wounds, and completes them. Planet actions advance time as in project 1. A new base action `wait(days)` (1 or 3 days) advances time with nothing else happening; it costs what days cost on the chosen preset.

### Save

`STORY_SAVE_VERSION` 2. A version 1 save loads with defaults: starting credits, the four roster soldiers as the ready pool, starting research, no facilities. The strict validator covers the new state (research ids exist in the tree, prerequisites are met, statuses and day counts in range, pool within the bed count, credits non-negative).

### Screens and flow

`planet -> base -> squad -> equipment -> mission -> result -> planet`, with BASE a button on the planet screen. The base screen is a hub of tiles (LAB, BARRACKS, MARKET, TRAINING, HOSPITAL, WAIT, PLANET), each showing its state at a glance and opening a panel. Buildings are defined as data (id, position, name, status line) and the tile look is one renderer, so project 3 can draw a base map from the same data. The squad step is a panel of the pool with four slots.

## Testing and acceptance

- Unit tests per rule: income per day for each preset, research start/finish/prerequisites/one-at-a-time, market pricing, hiring and bed limits, loaned mercenaries, training caps, hospital rolls (deterministic, level-dependent, lost mission never saved), wounded and training days ticking, `wait`, save v1 to v2 migration, corrupt-save rejection.
- Regression: the full existing suite, the recorded enemy-turn fingerprints and the campaign balance runner are unchanged; `unlocksFromLevel(level)` reproduces today's results for every level 1 to 10.
- A headless run: the bot plays the story with a trivial base policy (research the cheapest available node, hire when below four ready, train when idle) on CALM and reaches the capital without errors or stalls.
- Typecheck clean; a browser check of the hub and each panel at desktop and phone-landscape sizes.

## Left to the builder

The numbers (credits, costs, days, premium, rates, chances, beds, fees), the exact node list and prerequisite chains within the shapes above, the layout of the hub and each panel, how the squad step looks, the tile status lines, and how `Unlocks` is threaded through existing function signatures.

## My calls (not Rui's decisions, flagged for checking)

Gadgets (armour, scanner) and the scope become research nodes in story mode; medkit, pistol, rifle and frag start unlocked. The loaned mercenary's fee, no-rank, leaves-after-one-mission rules. Six starting beds growing to twelve. A kill bounty replaces the old living-soldier kill bonus. Training and hospital caps and chances as listed. Hospital second chance only after a won mission. One soldier trains at a time. Marketplace premium 1.5.
