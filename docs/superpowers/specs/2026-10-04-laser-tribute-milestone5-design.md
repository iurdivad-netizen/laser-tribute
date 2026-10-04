# Laser Tribute: Milestone 5 Design (limited ammo and reloading)

## 1. Goal

Make shots a resource. Every gun has a magazine, reloading costs AP and uses a spare clip, and spare clips are bought on the equipment screen. Enemies follow the same rules. The combat knife (milestone 4) becomes the fallback for an empty gun.

Stated by Rui: **magazines plus spare clips** (over unlimited reloads or a fixed pool of rounds); **enemies are limited by ammo too, with the same rules**. Rui approved the rules and the code approach in the brainstorm (2026-10-04) and was shown the numbers below, which are defaults to be tuned in play.

## 2. Out of scope

- Ammo found on the floor, different ammo types, burst or auto fire.
- Ammo or clips carrying over between missions, and clips in the squad stash (stash stays weapons and grenades).
- Per-weapon clip types: a clip is generic and fits any gun.
- Enemy knife use; saving and loading; sound.

## 3. Rules

Numbers live in `config.ts` so they can be tuned in one place.

| Constant | Value |
|---|---|
| Magazine: pistol / rifle | 8 / 5 rounds |
| Reload cost | 15 AP |
| Spare clips at start (soldiers and enemies) | 1 (included in the weapon price) |
| Spare clips a soldier can carry | 1 to 4; each clip beyond the first costs 5 credits |

- Each shot (snap or aimed) uses one round. Alert reaction fire also uses one round, and an alerted soldier with an empty gun does not fire.
- A shot with an empty gun is rejected with `Out of ammo` before any AP is spent. Grenades and the knife do not use ammo.
- New command `Reload { unitId }`: needs a spare clip (`No spare clips`), a magazine that is not already full (`Magazine is already full`) and 15 AP (`Not enough action points`). Success sets `ammo` to the weapon's magazine size and removes one clip. A new `reloaded` event reports it. Like any action other than Alert it ends the soldier's alert.
- A weapon picked up from the floor arrives with a full magazine; the soldier's spare clips are unchanged. The weapon swapped away stays on the floor and carries no ammo count (floor items do not track ammo).
- Clips are generic: a soldier who changes weapon keeps them.
- Ammo does not carry between missions: every soldier and enemy starts each mission with a full magazine. Clips are re-bought each mission like grenades (the loadout is kept between missions as it is now).

## 4. Data

- `WeaponDef.magazine: number` in `config.ts`; `CONFIG.reloadAp`, `CONFIG.spareClips` (1), `CONFIG.maxClips` (4); `LOADOUT.prices.clip` (5).
- `Unit.ammo: number` and `Unit.clips: number`; `makeUnit` sets `ammo` to the weapon's magazine and `clips` to `CONFIG.spareClips` for both sides.
- `SoldierLoadout.clips: number` (1 to 4), required. `defaultLoadout` and `cheapLoadout` use 1. `soldierCost` adds `5 * (clips - 1)`. `validateLoadout` rejects values outside 1 to 4 with a clear message. `applyLoadout` sets `clips` and refills `ammo` to the chosen weapon's magazine (the weapon may differ from the map default). Stash coverage is unchanged and still covers only the weapon and grenades.
- `Command` gains `Reload`; `GameEvent` gains `{ type: 'reloaded'; unitId; ammo }`.

## 5. Core behavior

- `fireShot` decrements `ammo` for normal and reaction shots; `handleShot` checks `ammo >= 1` first. `applyReactionFire` skips units with no ammo.
- New `core/actions/reload.ts` with `handleReload`, dispatched from `apply.ts`.
- `handlePickUp` (weapon swap) sets `ammo` to the new weapon's full magazine.
- AI (`ai.ts`): at the top of `candidates`, an enemy with `ammo < 1` and `clips > 0` gets a `Reload` candidate first. Candidates are already tried in order and rejected ones skipped, so an empty enemy with no clips falls through to its existing turn or move candidates (it advances or patrols but cannot shoot). The AI never stabs.
- Mission creation needs no change beyond the loadout (`applyLoadout`), since `makeUnit` already sets full ammo.

## 6. Screens and input

- Panel: the weapon line shows `Rifle 4/5 +1  Grenades 1` (rounds, magazine size, spare clips). A RELOAD button (key `R`) shows `15 AP`, red when unaffordable or when the soldier cannot reload. Status line while a shot is rejected shows the reason.
- Panel buttons: nine in this order: snap, aimed, throw, stab, reload, door, pickup, alert, end. Step 34 px and width 33 px from x = 172 (last button ends at x = 477), so labels shorten to at most six characters: `S SNAP`, `A AIM`, `T GREN`, `K STAB`, `R LOAD`, `D DOOR`, `P TAKE`, `L ALRT`, `Sp END`. The AP cost text stays under each button.
- Controller: `R` and the button issue `Reload` for the selected soldier at once (no targeting mode); messages come from the rejection reasons. The `reloaded` event is player-visible when the unit is seen.
- Equipment screen: each soldier row gets a second control line, `Spare clips`, with `-` and `+` buttons and the count, below the grenade control (same style). Blocked changes show the same "Need N more credits" or limit messages. The per-row price includes clips. `EQ` gets the extra geometry; row spacing stays 52 px.

## 7. Files touched

- New: `src/core/actions/reload.ts`.
- Changed: `config.ts`, `types.ts`, `mission.ts`, `combat.ts`, `actions/shoot.ts`, `actions/item.ts`, `apply.ts`, `ai.ts`, `loadout.ts`, `controller.ts`, `render/panel.ts`, `render/effects.ts` (a small reload flash), `screens/equipment.ts`, `app.ts` (loadout defaults), `README.md`.

## 8. Testing

TDD in `core` first.

- Magazines: shot spends a round; empty gun rejected with `Out of ammo` and no AP spent (assert the returned result, not the input state); reaction fire skipped when empty and spends a round otherwise.
- Reload: success fills the magazine and uses a clip; rejections for no clips, a full magazine and AP below 15 (14 AP fails, 15 succeeds); ends alert; `reloaded` event.
- Pickup: a swapped-in weapon has a full magazine; clips unchanged.
- AI: an empty enemy with a clip reloads before anything else; an empty enemy without clips never shoots but still moves; a full-ammo enemy behaves as before (existing AI tests unchanged).
- Loadout: cost with clips (`5 * (clips - 1)`), validation range, default kit still costs 102 and validates at 120, `fitLoadout` with the new field, `applyLoadout` sets clips and refills ammo for a swapped weapon type, stash coverage unchanged.
- Controller: `R` reloads; button; rejection message when the magazine is full.
- Panel and equipment: nine buttons fit and hit-test, no overlap, all labels at most six characters; ammo text; clip controls hit-test, respect the budget and limits.

## 9. Success criteria

- A rookie rifleman fires five shots, then the sixth is refused; `R` for 15 AP restores five rounds and leaves no spare clip.
- A full default kit costs 102 credits as before; a soldier with the maximum 4 spare clips costs 15 credits more (3 clips beyond the free one).
- Enemies empty their guns, reload, and stop shooting when out of clips; no enemy turn runs forever.
- All existing tests pass (existing helper loadouts gain `clips: 1`); `core` still has no browser imports.

## 10. Risks and notes

- Balance is a guess: the magazine sizes (pistol 8, rifle 5), reload cost and clip price will need playtesting. Mission 3 (8 enemies) is where ammo should start to matter.
- Enemies that run dry stay in the fight (they advance or patrol); a later milestone may let them retreat or pick up dropped guns.
- The nine-button panel is tight; labels are deliberately short.
