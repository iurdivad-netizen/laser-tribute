# Laser Tribute Milestone 9: Saving and Loading (Design)

Date: 2026-10-05. Follows milestone 8 (interface graphics), the loot feature and polish PR #17.

## Purpose

A campaign spans three missions and is lost when the tab closes. The player should be able to close the game between missions and carry on later. Success: reload the page after any mission result and the campaign (squad, ranks, kills, stash, budget, mission number, chosen equipment) is exactly as it was.

## Decisions (Rui, stated)

- **Autosave between missions only.** No mid-battle saves, no manual slots.
- **A small title screen, shown only when a save exists**: CONTINUE and NEW CAMPAIGN. With no save the game opens straight on the equipment screen, as today.
- **The chosen loadout is part of the save**, so the equipment screen returns as it was left.

## Scope

In: a save module, autosave, a title screen, validation of loaded data, tests.
Out: manual slots, mid-mission saves, export and import, cloud sync, a settings screen.

## Design

### Save module (`src/save.ts`, outside `core`)

- `StorageLike` is the existing interface from `src/audio/sound.ts` (`getItem`, `setItem`) extended with `removeItem`. Move the interface to a shared place only if needed; otherwise import it.
- One key: `laser-tribute-save`. Value: JSON `{ "version": 1, "campaign": Campaign, "loadout": Loadout }`.
- `class SaveStore(storage: StorageLike | null = browserStorage(), missionCount: number)`:
  - `load(): { campaign: Campaign; loadout: Loadout } | null`: reads, parses, validates (below). Returns null for no save, bad JSON, any failed check, or a throwing storage. Never deletes what it cannot parse (a newer game version may have written it).
  - `save(campaign, loadout): void`: one `setItem`; errors (private mode, quota) are swallowed.
  - `clear(): void`: `removeItem`; errors swallowed.
- Validation (`parseSave`, exported for tests), all must hold:
  - `version === 1`.
  - `campaign.status === 'active'` (finished campaigns are never saved).
  - `missionIndex` an integer in `[0, missionCount)`; `missionsWon === missionIndex` (a lost mission ends the campaign, so every finished mission was a win).
  - `roster` has exactly `CAMPAIGN.rosterSize` entries, each `{ name: non-empty string, kills: integer >= 0 }`; `fallen` an array of the same shape; `namesUsed` an integer >= `rosterSize`.
  - `stash` has `rifle`, `pistol`, `grenade`, `clip`, each an integer >= 0 and within a sane bound (<= 99).
  - `loadout` is an array of `CAMPAIGN.rosterSize` objects. Its content is not trusted: after loading, the app runs `fitLoadout(loadout, budget, stash)`, and falls back to `defaultLoadout()` fitted the same way if `loadout` is not an array of the right length.
  - Unknown extra fields are dropped: the parsed object is rebuilt field by field, not passed through.
- `Campaign` gets no new fields. `recordMission` and the rest of `core` are untouched.

### App changes (`src/app.ts`)

- `AppOptions` gains `store?: SaveStore | null`. The default is a `SaveStore` over the browser's `localStorage`; tests pass a fake or `null`. Existing tests construct `App` without a store, so the default must not touch the real `localStorage` under Vitest: the default store is created only when `typeof window !== 'undefined'` (the same guard `Sound` uses; Vitest runs in node, so the default is no store).
- `Screen` gains `'title'`. In the constructor, `store.load()` returning a save sets `campaign`, `loadout` and `screen = 'title'`; otherwise nothing changes (screen `equipment`).
- Autosave: in `update()`, right after `recordMission` runs: if `campaign.status === 'active'` then `store.save(campaign, loadoutAfterFit)` else `store.clear()`. `continueFromResult` fits the loadout later; the saved loadout is therefore fitted at save time with the same `fitLoadout(this.loadout, budget, stash)` call, so what is saved is what the next equipment screen shows.
- Title screen input:
  - CONTINUE (click or Enter): `screen = 'equipment'`. The saved campaign was already loaded in the constructor.
  - NEW CAMPAIGN (click or N): the first press arms a confirmation (button text becomes `REPLACE SAVE? PRESS AGAIN`, armed for 3 s); the second press calls `store.clear()` and `newCampaignScreen()`. Clicking CONTINUE or letting the arm lapse disarms it.
  - The shared input lock after a screen switch applies, and sound keys (M, -, =) work as on the other screens.
- `newCampaignScreen()` (also used from the end screen) clears nothing extra: the save was already cleared when the campaign ended.
- Dev hook: `window.app` already exists in dev builds; no new hook.

### Title screen (`src/screens/title.ts`)

- `TitleView { missionNumber: number; missionCount: number; soldiers: number; budget: number; armed: boolean }`.
- `TITLE = { card: {...}, cont: {...}, fresh: {...} }` geometry, `titleHit(px, py): 'continue' | 'new' | null`, `drawTitle(ctx, view)`.
- Layout: black ground, raised card (same style as the end screen), `LASER TRIBUTE` heading in the inset header, one summary line `MISSION 2 OF 3, 4 SOLDIERS, 215 CR`, the CONTINUE button, the NEW CAMPAIGN button (text switches to the confirm text when armed, drawn in `UI.red`), and a hint line `ENTER CONTINUE   N NEW CAMPAIGN`. Everything uses `drawText`, `drawFrame`, `drawButton`; all text uppercase-safe in the 5x7 font.
- Soldier count is the roster length (always 4 today, kept for the future).

### Data flow

```
start -> store.load() --null--> equipment (as today)
                     \-save--> title -CONTINUE-> equipment -> mission -> result
                                  \-NEW(2x)-> clear, equipment (fresh)
result (recordMission) -> active? save(campaign, fitted loadout) : clear()
```

### Errors and edge cases

- Corrupt, foreign, future-version, or out-of-range data: ignored; game opens on equipment; the next autosave overwrites it.
- Storage missing or throwing: loading returns null, saving and clearing do nothing. No error dialog.
- Two tabs: last write wins, no locking.
- A campaign is saved only while active, so a save can never be a finished campaign.
- A mission closed mid-way is not saved; reopening shows the title with the state after the previous mission. The stash and ranks therefore revert to that point, which is the stated cost of between-missions saving.

## Testing

- `tests/save.test.ts` (new file; check the name is free): round-trip of a campaign played through two missions (stash with clips, a promoted soldier, a fallen soldier, replaced rookie); `parseSave` rejects null, non-JSON, an array, wrong version, a finished campaign (`won`/`lost`), `missionIndex` out of range, wrong roster size, negative or fractional kills, negative stash, missing stash field, huge stash value; extra fields are dropped; a storage whose `getItem`, `setItem`, `removeItem` throw does not throw out of `load`, `save`, `clear`; a rejected save is not deleted by `load`.
- `tests/title.test.ts`: `titleHit` regions and misses; layout through the existing checker (`tests/layout.test.ts` pattern) with the longest summary line (`MISSION 3 OF 3, 4 SOLDIERS, 9999 CR`) and the armed text.
- `tests/app.test.ts` additions (fake in-memory storage): no save opens on equipment; a save opens on the title with the right summary; CONTINUE gives the saved budget, stash and loadout; NEW CAMPAIGN needs two presses, the first leaves the save, the second clears it; the arm lapses after 3 s; winning a mission writes a save; losing and winning the last mission clear it; a second `App` over the same storage after a win has the same campaign and loadout ("reload"); an invalid saved loadout falls back to a valid fitted one; an `App` built without a store never touches `localStorage`.
- Existing 510 tests unchanged and green.

## Constraints

- Pure `src/core` stays free of browser code; all storage lives in `src/save.ts` and `src/app.ts`.
- The save format is versioned (`version: 1`) so later milestones can migrate it.
- No new dependencies.
