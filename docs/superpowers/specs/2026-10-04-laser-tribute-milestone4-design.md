# Laser Tribute: Milestone 4 Design (ranks, soldier accuracy, combat knife)

## 1. Goal

Give kills a lasting payoff and add a close-combat option. Soldiers earn ranks from their own kills; each rank raises max HP, max AP and a new per-soldier accuracy stat. Every soldier also carries a combat knife with a new STAB action. This finishes the "soldier stats and promotion" roadmap item (milestone 1 spec, section 9).

Stated by Rui: growth model is **ranks from kills** (automatic bonuses, no choice screen); accuracy should be a **soldier stat on top of the weapon stat**; add a **combat knife**, usable only adjacent to the enemy, with very high damage and a very high hit chance, **carried by every soldier as an extra item**; limited ammo and reloading are **a later milestone**.

Assumed (Rui to correct): the rank table and knife numbers below; "damage and damage" in the request was read as damage and hit chance.

## 2. Out of scope

- Limited ammo and reloading (next candidate milestone; the knife becomes the fallback for an empty gun).
- Choosing bonuses on promotion; stats that grow by use.
- Showing hit chance on screen (the game does not show it today either).
- Enemy knife use or enemy ranks; saving and loading; sound.

## 3. Ranks

A soldier's rank comes from their lifetime kills (the roster's `kills`, which already persist). Bonuses are cumulative per rank.

| Rank | Kills | Max HP | Max AP | Accuracy bonus |
|---|---|---|---|---|
| Rookie | 0 | 50 | 60 | +0 |
| Private | 2 | 60 | 64 | +0.04 |
| Sergeant | 5 | 70 | 68 | +0.08 |
| Captain | 9 | 80 | 72 | +0.12 |

- New `src/core/ranks.ts`: a `RANKS` table (name, minKills, hp, ap, accuracy) and `rankFor(kills)`. Pure and tested.
- Applied when a mission is created (`createMission`): each player unit gets `maxHp`, `hp`, `maxAp`, `ap`, `accuracy` and `rank` from `rankFor(roster[i].kills)`. Without a roster (milestone 1 helper, tests) every soldier is a Rookie, as today. Turn-start AP refill already uses `maxAp`, so the AP bonus lasts the whole mission.
- Enemies and replacement rookies are Rookies (enemies show no rank). Gear and the budget rule are unchanged.
- The campaign needs no new saved data: rank is derived from kills.
- Promotions are announced on the result screen: for each surviving soldier whose rank after `recordMission` is higher than before, "Name promoted to Rank". The App computes this from the roster before and after.

## 4. Soldier accuracy

- `Unit.accuracy: number` (0 for enemies and Rookies).
- `hitChance` becomes `min(0.95, weaponAccuracy + shooter.accuracy) * rangeFactor * coverFactor`. The 95% cap applies to the weapon-plus-soldier part, so no soldier is a sure shot. Reaction fire uses the same function.
- Example: a Captain's aimed rifle shot (0.85 + 0.12) is capped at 0.95 before range and cover; a Captain's pistol snap shot is 0.55 + 0.12 = 0.67.

## 5. Combat knife

- Every soldier carries a knife. No equipment-screen change, no price, never dropped, never in the stash.
- New command `Stab { unitId, targetId }`, handled in a new `core/actions/stab.ts`, following the shoot handler:
  - the target must be a living enemy, adjacent (Chebyshev distance 1, diagonals included) and visible (`canSee`);
  - costs `CONFIG.knife.apCost` = 20 AP (otherwise `NOT_ENOUGH_AP`);
  - hit chance `min(0.95, CONFIG.knife.accuracy 0.90 + shooter.accuracy)`; range and cover do not apply;
  - a hit deals `CONFIG.knife.damage` = 60 (enemies have 40 HP, so a hit kills); a kill credits the soldier as shots do (`kills += 1`, `died` event);
  - only the player issues it; the AI never stabs.
- New event `stab { unitId, targetId, hit, damage, from, at }`. The effects layer draws a short slash line from the soldier to the target (a miss draws the line fainter). The controller treats a `stab` as player-visible when either end is seen, like a shot.
- Controller and input: new mode `stab` (key `K`, button STAB). In stab mode, clicking an adjacent enemy issues `Stab`; clicking anything else gives a message ("Stab needs an adjacent enemy"). The mode resets as other modes do.
- Panel: an 8th button `K STAB`. The eight buttons use a 38 px step and 36 px width so they still fit the 480 px panel. The AP cost row (added in PR #6) shows `20 AP` for STAB, red when unaffordable, and the status line shows "Stab: 20 AP" in stab mode. The panel also shows the soldier's rank beside the name.

## 6. Screens

- Equipment: the rank is listed with each soldier's name and kills (for example "Sgt Chen, 6 kills"). Short forms: Rookie "Rke", Private "Pvt", Sergeant "Sgt", Captain "Cpt", chosen to avoid the known name-overlap issue.
- In-mission panel: `Sgt Chen  HP 70/70  AP 68/68`.
- Result: a "Promoted" line per promotion (only when there are any).

## 7. Files touched

- New: `src/core/ranks.ts`, `src/core/actions/stab.ts`.
- Changed: `types.ts` (Unit `accuracy` and `rank`, `Stab` command, `stab` event), `config.ts` (knife), `combat.ts` (`hitChance`), `apply.ts` (dispatch `Stab`), `mission.ts` and `missions.ts` (`makeUnit` defaults, rank applied in `createMission`), `controller.ts`, `input/uiState.ts`, `input/input.ts` (key `K`), `render/panel.ts`, `render/effects.ts`, `screens/equipment.ts`, `screens/result.ts`, `app.ts`.

## 8. Testing

TDD in `core` first.

- Ranks: thresholds at 0/1/2/4/5/8/9 kills; bonuses per rank.
- Accuracy: `hitChance` adds the soldier stat, the 95% cap, enemies unaffected; reaction fire uses it.
- Knife: needs adjacency (including diagonal; rejects distance 2), visibility, an enemy target, enough AP; hit and miss outcomes with a fixed seed; kill credit and `died` event; cannot target own side; AP deducted.
- Mission creation: ranks applied to HP/AP/accuracy from the roster; a soldier at 9 kills starts with 80 HP and 72 AP; unit refills to `maxAp` at turn start.
- App: promotion detection after a won mission; none for dead soldiers or without a rank change.
- Controller/panel: stab mode and `K`; `actionCost` for stab; eight buttons fit and are hit-testable; rank text on panel, equipment and result screens.

## 9. Success criteria

- A soldier with 2 kills starts the next mission as a Private with 60 HP, 64 AP and +4% accuracy; the screens show the rank.
- STAB kills an adjacent enemy about nine times in ten for 20 AP and does nothing at range 2.
- All existing tests still pass and `core` still has no browser imports.

## 10. Risks and notes

- Balance: Captains are meant to be rare (about 18 enemies in the whole campaign). If testing shows ranks arrive too fast or too slowly, only the table in `ranks.ts` changes.
