# Laser Tribute Milestone 12: Critical Shots and the Sightscope (Design)

Date: 2026-10-05. Follows milestone 11 (gadgets). Rui asked for this before moving on, so **generated maps move to milestone 13**.

## Purpose

Shots always do the weapon's fixed damage. Rui wants a **critical shot** chance with higher damage, and a new item, a **sightscope**, that improves accuracy and critical chance. Success: shots occasionally hit hard (for both sides), the scope is a clear, affordable upgrade on the equipment screen, and nothing changes for hit and miss sequences or for a squad that buys no scope except for the new crits.

## Decisions (Rui, stated)

- Critical hits apply to **shots only, for both sides** (soldiers and enemies, same rule); knife and grenades are unchanged.
- The sightscope lives in a **separate weapon-attachment slot**, in addition to the gadget slot (so one soldier can carry armour and a scope).
- Numbers below are my proposals, accepted with the design sections.

## Scope

In: crit rule, `critState` random stream, sightscope attachment (loadout, price, stash, saves), equipment toggle, panel tag, crit feedback (spark, flash, message, sound), tests.
Out: more attachments, scope ranges, a hit-chance readout, knife or grenade crits, enemy scopes, map changes.

## Design

### Rules

- A shot that **hits** can be critical; a miss never is. Crit chance: **8%** for a snap shot, **15%** for an aimed shot (`CRIT.snap`, `CRIT.aimed`); reaction fire counts as snap. A scope adds **+0.10**.
- Critical damage: `floor(weapon damage * 1.5)` (rifle 45, pistol 27), then through `damageTaken`, so armour still reduces it (rifle crit on armour 45 -> 32). Minimum 1.
- **Sightscope** (attachment `'scope'`): price **18** credits, passive. It adds **+0.10** to the shooter's base accuracy inside the existing 95% cap (`min(maxHitChance, weaponAccuracy + shooter.accuracy + scope)`), so it still scales with distance and cover, and **+0.10** crit chance. Both weapons, both shot modes. Enemies never carry one.
- Average damage rises slightly for everyone (about +4% snap, +7.5% aimed), including enemies.

### Core data and rules (`src/core`)

- `types.ts`: `AttachmentId = 'scope'`; `Unit.attachment: AttachmentId | null`; `GameState.critState: number`; the `shot` event gains `crit: boolean`.
- `config.ts`: `CRIT = { snap: 0.08, aimed: 0.15, multiplier: 1.5 }`; `ATTACHMENTS = { scope: { name: 'Scope', price: 18, accuracy: 0.10, crit: 0.10 } }` (and `ATTACHMENT_IDS`).
- `rng.ts`: `nextCrit(state)`: the same generator as `nextRandom` but advancing `critState`, so crits never consume `rngState` and every existing hit and miss sequence and test seed is unchanged. `mission.ts` initialises `critState` from the mission seed XOR a constant.
- `combat.ts`: `critChance(shooter, mode)`; `hitChance` adds the scope accuracy inside the cap; `fireShot` draws one number from `nextCrit` **only when the shot hits**, applies the crit damage through `damageTaken`, and reports `damage` (actual) and `crit` in the event. Kill credit and rank progress work as for any killing shot.
- `loadout.ts`: `SoldierLoadout.attachment?: AttachmentId` (optional so existing literals stay valid); `soldierCost` adds the price; `loadoutCost` and `netSoldierCost` subtract the price when the stash covers it; `validateLoadout` rejects an unknown attachment id; `applyLoadout` sets `unit.attachment`; `fitLoadout` drops attachments together with gadgets (after extra clips, before the cheap fallback kit).
- `stash.ts`: `Stash.scope` (required count); `Cover.attachment: boolean`; `coverage` hands stashed scopes out in soldier order; `nextStash` returns a survivor's scope (lent or bought, as for armour), the dead lose theirs; `describeStash` lists `N scope(s)`; `emptyStash` zero. `loot.ts`: `addStash` carries `scope`, `capStash` caps it at 4, `lootFrom` gives none.
- `src/save.ts`: optional `attachment` on each loadout entry (an unknown id replaces the whole loadout with the default) and an optional `scope` stash count (absent = 0, bounds 0..99). Save version stays 1; `critState` is never saved (saves are between missions).

### Interface

- **Equipment screen:** a `SCOPE` toggle at the right end of the second line of each soldier row (x 352, width 100, same y as the clip controls): `NO SCOPE` / `SCOPE (18)` / `SCOPE (FREE)`. A toggle that would exceed the budget is skipped (stays off). Found scopes appear in the found-gear line (which already wraps when long). New `EquipmentHit` kind `'scope'`.
- **Soldier info panel:** a small `SCOPE` tag at x 108 on the soldier-name line (the name line is at most 89 px wide). No other panel line changes.
- **Critical feedback:** a spark twice the usual size on the target plus a yellow flash on that tile; the panel line `CRITICAL HIT: N DAMAGE` for the player's crits and `ENEMY CRITICAL HIT: N DAMAGE` for a visible crit on a soldier (N is the damage after armour); a new sound `crit` (sharp rising two-tone burst) on top of the shot and thud, audible only when the shot is audible.
- A hit-chance readout is out of scope (candidate for later).

### Edge cases and rulings

- Hit cap 95% still applies after the scope bonus; cover still multiplies the final hit chance; crit chance depends only on mode and scope.
- One scope per soldier; the cheap fallback kit has no scope; a lost mission leaves the stash unchanged; cap 4.
- Determinism: same seed and commands give the same hits, misses and crits; a new mission starts the crit stream from its seed.
- Balance to watch after play: an enemy rifle crit (45) leaves a 50 HP soldier on 5 HP. All numbers sit in one config block.

## Testing

- Core: `critChance` per mode and with a scope; `hitChance` with a scope and the cap; `fireShot` crit damage for rifle and pistol, armour on a crit, a miss never crits; reaction fire can crit; the crit stream is independent of the hit stream; a scripted sequence is deterministic.
- Loadout and stash: price, validation, `fitLoadout`, `applyLoadout`, `coverage`, `nextStash` (survivor returns, dead loses, lent returns), `describeStash`, `capStash`; row prices add up to the total.
- Saves: an old save without the fields loads; a scope round-trips; an unknown attachment id falls back to the default loadout; a bad scope count is rejected.
- Interface: equipment toggle (label, FREE, budget skip), panel scope tag, crit spark and flash, message text for both sides, `crit` sound mapping; layout checker on the equipment screen with every control filled and on the panel with the longest name plus the tag.
- Existing tests: many force a hit and expect damage 30 or 18. The test helper `makeState` pins `critState` to a value whose first draw never crits, and a helper `seedForCrit(pred)` pins it for tests that want a crit.
- Scripted mission test (a scoped soldier with a forced crit kills an enemy in one rifle shot) and a real-browser look at the equipment screen, the SCOPE tag and the crit message.

## Constraints

- `src/core` stays pure and deterministic; the new random stream is seeded, never `Math.random`.
- No new dependencies; the 16x16 sprite grid, 5x7 font and 480x400 canvas are unchanged.
- New test files get distinctive names (check with `ls tests`); never overwrite an existing test file.
