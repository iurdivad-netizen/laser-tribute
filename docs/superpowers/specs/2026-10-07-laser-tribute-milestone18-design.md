# Laser Tribute Milestone 18: more weapons and throwables

## Goal

Add three weapons (shotgun, SMG, sniper rifle) and three throwables (smoke, flashbang, incendiary) to the campaign. Weapons and throwables become data tables with an unlock ladder by campaign mission, so the later XCOM mode can unlock the same pieces through research.

Not in this milestone: gadgets and utility items (mines, deployable cover, breacher), multiple gadget slots, ammo types, armour tiers, enemy AI that throws grenades, a grid or slot inventory.

## Decisions (from the brainstorm)

- Direction: both attack and support content, in waves. This wave is weapons and throwables only.
- First wave is the full six pieces.
- Acquisition: shop and loot, unlocked by campaign progress. Enemies use the new weapons (never the new throwables).
- Architecture: a data-driven catalogue, not special cases and not a full inventory rework.
- The sniper sees 14 tiles instead of 10.
- The loadout screen has a button that cycles the throwable kind.
- The tutorial keeps only pistol, rifle and frag.

## Constraints

- `src/core` stays pure (commands and events, seeded RNG, no rendering).
- All new randomness goes through the existing RNG so missions stay deterministic.
- The hunting-turn performance is not a goal here, but the new rules must not make enemy turns slower per action.
- No PixelLab generations are spent; all new art is hand-drawn or drawn in code.
- `checkMission` still holds for every generated mission.

## Weapons

`WeaponId` widens from `'pistol' | 'rifle'` to the keys of the `WEAPONS` table. `WeaponDef` gains three optional fields:

- `burst` (default 1): rounds fired per shot action. Each round rolls its own hit and its own crit, uses one round of ammo, and can kill. A burst stops early when the magazine is empty or the target is dead.
- `falloff` (default 0.5): replaces the 0.5 in the range factor `1 - falloff * distance / range`.
- `closePenalty` (default none): `{ within: 3, multiplier: 0.5 }`, an accuracy multiplier when the target is within `within` tiles.
- `sight` (default `CONFIG.sightRange`): how far the carrier sees. See Vision.

Stats (first guess, tuned in play; the rifle is shown for comparison):

| | damage | range | snap / aimed AP | accuracy snap / aimed | magazine | special | price | unlocks at mission |
|---|---|---|---|---|---|---|---|---|
| Pistol | 18 | 8 | 12 / 24 | 0.55 / 0.75 | 8 | | 10 | 1 |
| Rifle | 30 | 14 | 15 / 30 | 0.50 / 0.85 | 5 | | 25 | 1 |
| Shotgun | 45 | 6 | 15 / 25 | 0.60 / 0.75 | 4 | falloff 0.9 | 22 | 2 |
| SMG | 12 | 9 | 18 / 28 | 0.45 / 0.60 | 12 | burst 3 | 28 | 4 |
| Sniper | 55 | 16 | 25 / 35 | 0.40 / 0.90 | 3 | falloff 0.2, closePenalty, sight 14 | 40 | 6 |

Hit chance becomes `min(max, accuracy + soldier + scope) × rangeFactor × closeFactor × cover`. Damage, crits, armour and the scope work as before and apply per round. A burst shot reports one event per round so the renderer can show each round.

## Vision

`canSee` and the reaction-fire check use the shooter's weapon `sight` instead of the global sight range, so a soldier carrying the sniper rifle sees (and can shoot at) targets up to 14 tiles away in line of sight. Everyone else is unchanged. Fog of war and `computeVisible` for the squad use each soldier's own sight, so a sniper also reveals more map.

## Throwables

A new `THROWABLES` table with ids `frag`, `smoke`, `flash`, `incendiary`. `Unit` gains `throwable: ThrowableId` (default `frag`); `Unit.grenades` stays the count of that one kind. The `Throw` command keeps its shape; the kind comes from the unit.

| | AP | range | radius | effect | price | unlocks at mission |
|---|---|---|---|---|---|---|
| Frag | 24 | 8 | 1 | 40 damage, destroys doors (as today) | 8 | 1 |
| Smoke | 18 | 8 | 2 | smoke hazard for 3 turns; no damage | 10 | 2 |
| Flashbang | 18 | 8 | 2 | every unit in the blast, either side, loses 30 AP on its next turn (floor 0) | 10 | 4 |
| Incendiary | 24 | 8 | 1 | fire hazard for 3 turns; 15 damage on landing; no door damage | 14 | 6 |

Flash, fire and frag hit friendly units too. Throw rules (range, line of sight, no throw at a wall, AP check) are shared. A thrown flashbang's effect is stored per unit as `apPenalty`, applied and cleared when that unit's side begins its turn.

### Hazards

`GameState` gains `hazards: { pos: Pos; kind: 'smoke' | 'fire'; turnsLeft: number }[]` (empty by default).

- A hazard covers every tile of the blast area that is not a wall. A new throw onto an existing tile refreshes it to 3 turns.
- `turnsLeft` drops by one each time `turnNumber` increases (the player's turn begins), after fire damage for that turn is dealt, and a hazard at 0 is removed. A hazard thrown with 3 turns left therefore lasts through three player turns.
- Smoke tiles block line of sight and vision (`hasLineOfSight`, `canSee`, `computeVisible`). The tile where the viewer or the target stands is not blocking; a unit inside smoke can see out one tile but is not seen from beyond. Smoke does not stop walking, thrown grenades or the bullets that line of sight already allows.
- Fire deals 10 damage at the start of the turn of each unit standing on a fire tile (either side), armour reducing it as for any damage, and can kill.
- A throw that creates a hazard emits the existing grenade event with `kind` and the new hazard tiles, so the renderer and log can show it.

## Catalogue, shop, stash and unlock ladder

- `WEAPONS` and `THROWABLES` carry stats, `price` and `unlockAt`. `LOADOUT.prices` reads from them instead of hard-coding pistol, rifle and grenade prices. Clip, gadget and attachment prices are unchanged.
- The loadout screen offers a weapon or throwable only if `unlockAt <= missionIndex + 1` (campaign) or it is pistol, rifle or frag (tutorial), or the stash holds one.
- `Loadout` soldiers gain `throwable`; validation rejects a locked or unknown kind.
- Enemy weapons are drawn, per enemy, from the weapons unlocked at the mission (weighted to the older ones), seeded by the mission seed, so enemies never carry a weapon the squad hasn't met. The tutorial enemies keep pistols and rifles.
- `Stash` becomes a record keyed by item id (weapon ids, throwable ids, `clip`, gadgets, `scope`). `emptyStash`, `addStash`, `capStash`, `coverage` and `nextStash` loop over the keys. Caps: four weapons in total (heaviest first), four clips, four of each gadget; throwables are uncapped as grenades are today. Dead enemies drop their weapon and spare clips (as today).
- A looted weapon is usable from the stash even before its unlock mission.

## Saves

`SAVE_VERSION` goes 1 to 2. Loading a version-1 save upgrades it in place: each loadout soldier and unit gets `throwable: 'frag'`, the stash converts to the keyed record, and `hazards` is empty. A save with a newer version, a locked item or an unknown id is rejected as today (no crash).

## Enemy AI

- Shoots with the weapon's own range, `sight`, falloff and burst; AP and ammo checks use the weapon's costs. An SMG enemy fires a full burst per action.
- Does not throw the new throwables.
- Pathing avoids fire tiles (a large cost, not a ban, so a unit boxed in by fire can still move); smoke counts as sight-blocking for hunting, so a soldier hidden by smoke is not targeted.
- A flashed enemy has less AP at the start of its turn and plays as usual.

## Controls and UI

- Throw button label shows the kind and count, for example `T SMOKE (2)`.
- Loadout screen: a cycle button beside the throwable count steps through unlocked kinds; weapon swap steps through unlocked weapons; prices and counts update.
- The hit-chance line shows burst and falloff effects (for example `x3` for a burst).
- Smoke and fire tiles are drawn as overlays with a small turns-left number; the dev gallery shows them.
- Mobile layout: the new controls reuse the existing buttons and tap targets.

## Art

All hand-drawn or drawn in code, no PixelLab:

- Six 16x16 floor-pickup images (`item_shotgun`, `item_smg`, `item_sniper`, `item_smoke`, `item_flash`, `item_incendiary`) through the theme lookup, shifted up four rows like the existing items so a pickup under a corpse stays visible.
- In-hand weapon pieces for the three guns, painted by code the same way as the rifle (a weapon table row per view).
- Effect sprites: smoke puff, flash burst, two fire frames, each with a dark outline like the other effects.

## Testing

- Hit chance: falloff, close penalty, cover and scope together; burst ammo use, early stop on empty magazine or dead target, one event per round; per-round crit.
- Vision: sniper sight 14 for the carrier only; smoke blocks line of sight, vision and reaction fire; the viewer's own smoke tile does not blind the viewer to adjacent tiles.
- Throwables: each effect and cost; smoke refresh and expiry; fire damage on both sides including armour and death; flash penalty applied and cleared on the right turn and never below 0; doors only destroyed by frag.
- Catalogue: unlock ladder in the tutorial and the campaign, locked item rejected in a loadout, price lookups from the tables.
- Stash: keyed record round-trips; `capStash` and `nextStash` behave as before for the old items; a looted weapon is usable early.
- Saves: a version-1 save loads as version 2; unknown id and locked item rejected.
- AI: enemy burst, enemy fire avoidance, smoke-hidden soldier not targeted; enemy weapons never exceed the mission's unlocked set; `checkMission` holds for every generated mission; enemy turn call count stays under the existing bound.
- Render and UI: hazard overlays drawn; throw button label; loadout cycle button; new item images present and visible under a corpse (the existing 70% test extended to all items).
- Balance simulation: a seeded sim of each weapon against each other and the rifle shows no weapon winning every matchup.

## Build order

1. Catalogue tables, widened types, keyed stash, save migration, price lookups. No new content; the full suite passes unchanged.
2. The three weapons: burst, falloff, close penalty, sight; enemy weapon draw; art for items and in-hand pieces.
3. Throwables and hazards: the table, hazards in state, smoke vision, fire ticks, flash penalty, AI avoidance; effect sprites and overlays.
4. Loadout screen cycle buttons, throw label, hit-chance text, balance simulation, mobile check.

Then one fresh review of the whole branch and one fix pass.

## Open for tuning in play

The stat numbers, prices, hazard duration (3 rounds) and damage (fire 15 / 10), and the flashbang's 30 AP.

## XCOM mode

The tables are what a research tree would unlock; `unlockAt` is replaced there by a research flag. Nothing in this milestone builds a base, research or soldier slots.
