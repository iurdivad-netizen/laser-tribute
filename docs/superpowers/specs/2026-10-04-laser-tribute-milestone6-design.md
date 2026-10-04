# Laser Tribute: Milestone 6 Design (sound effects)

## 1. Goal

Give the game sound. Retro synthesized effects for every game event, quieter sounds for gunfire and explosions you cannot see, a mute key, and a remembered volume. Everything is generated in code with the browser's audio engine: no sound files, no downloads, nothing to license, and the GitHub Pages site is unchanged.

Stated by Rui: "would love some sounds and better graphics". Graphics are a separate later milestone (the two are independent subsystems and get separate specs). Decided with Rui (2026-10-04): **sound first**, **effects only** (no music), and the quieter out-of-sight gunfire design was shown and accepted.

## 2. Out of scope

- Music or ambient loops; better graphics (next milestone); recorded or downloaded samples.
- Stereo panning or distance falloff beyond the two volume levels below.
- A volume slider (volume is changed with keys, see section 5).

## 3. Sound list

| Sound | Plays for |
|---|---|
| `pistol`, `rifle` | a `shot` event, chosen by the shooter's weapon |
| `hit` | a hit (shot or stab): a short thud after the shot sound |
| `ricochet` | a missed shot |
| `stab` | a `stab` event (a hit also plays `hit`) |
| `explosion` | a `grenade` event |
| `deathSoldier`, `deathEnemy` | a `died` event, by the dead unit's side |
| `reload` | a `reloaded` event |
| `empty` | a shot refused with `Out of ammo` (dry click) |
| `door` | a `doorChanged` event |
| `step` | a `moved` event (very quiet) |
| `pickup` | a `pickedUp` event |
| `alert` | an `alert` event with `on: true` |
| `click` | a screen button or key press that changes something (equipment +/-, Start, Continue) |
| `error` | any other rejected command (a low buzz) |
| `win`, `lose` | a `gameOver` event |

## 4. Volume and fog of war

- Events the player can see (the controller's existing `eventVisible` test) play at full volume (1.0), except `step` (0.25) and `hit` / `ricochet` (0.8).
- Out of sight: `shot`, `grenade`, `doorChanged` and `died` play at 0.35 so a fight beyond your view can be heard. Out-of-sight `moved`, `reloaded`, `pickedUp` and `alert` events are silent.
- Interface sounds (`click`, `error`, `empty`, `win`, `lose`) always play at 0.9.
- The result is multiplied by the master volume (default 0.5, range 0 to 1).

## 5. Controls and settings

- `M` toggles mute on every screen. `-` and `=` (or `+`) lower and raise the master volume by 0.1 (clamped 0 to 1). Each change shows a short message ("Sound off", "Volume 60%") in the mission status line; on other screens the equipment hint line and the end-of-mission screens show "M: sound on/off".
- Mute and volume are stored in `localStorage` under `laser-tribute-sound` as `{ "muted": boolean, "volume": number }`. Every storage access is wrapped in try/catch: with storage unavailable the defaults apply and the game works normally.
- Browsers block audio until a user gesture. The audio context is created on the first click or key press (`unlock()`); before that, `play` does nothing.
- If the browser has no audio engine, every call is a silent no-op.

## 6. Design

- `src/audio/effects.ts`: pure data. `SoundName` union, and `EFFECTS: Record<SoundName, Segment[]>` where a segment is `{ wave: 'square' | 'sawtooth' | 'triangle' | 'noise'; from: number; to: number; start: number; dur: number; gain: number }` (frequencies in Hz, times in seconds). Every effect is under 1.5 s and every gain is at most 1. All the "sound design" lives here so it can be tuned by ear in one place.
- `src/audio/mapping.ts`: `soundsFor(ev, state, visible): { name: SoundName; volume: number }[]`, a pure function from one game event (plus the after-state to look up the shooter's weapon and the dead unit's side, and whether the player sees it) to the sounds to play. No audio code here.
- `src/audio/sound.ts`: `class Sound` (also the interface `SoundPlayer { play(name, volume?): void; unlock(): void; toggleMute(): string; changeVolume(delta): string; muted: boolean; volume: number }`). It takes an injectable `createContext: () => AudioContextLike | null` and `storage: StorageLike | null`, so tests use fakes. `play` schedules each segment with an oscillator (or a shared noise buffer) and a gain envelope, does nothing when muted or locked, and drops the sound when more than 12 voices are already playing.
- Controller: gets an optional `sound` (a `SoundPlayer`). In `run`, after applying a command, it plays `soundsFor` for each event with the same visibility it already computes for the effects; for a rejected command it plays `empty` when the reason is `Out of ammo` and `error` otherwise. `endTurn` needs no sound of its own (the enemy's events make the noise).
- `App`: owns the `Sound` (a default real one, or an injected one for tests), passes it to each `Controller`, calls `unlock()` on every click and key press, handles `M`, `-`, `=`/`+` before screen routing, and plays `click` when an equipment button changes something or Start / Continue is pressed.
- `main.ts` needs no change (the default `Sound` creates a real `AudioContext` when the browser has one).

## 7. Files touched

- New: `src/audio/effects.ts`, `src/audio/mapping.ts`, `src/audio/sound.ts`.
- Changed: `src/controller.ts`, `src/app.ts`, `src/render/panel.ts` (hint text), `src/screens/equipment.ts` (hint text), `README.md`.

## 8. Testing

TDD; the audio code is tested without making real sound.

- `effects.ts`: every `SoundName` has at least one segment, durations under 1.5 s, gains at most 1, frequencies positive; the sound list in section 3 and `EFFECTS` agree.
- `mapping.ts`: a visible rifle shot gives `rifle`, a visible pistol shot gives `pistol`; a hit adds `hit`, a miss adds `ricochet`; a stab hit gives `stab` and `hit`; death sound by side; out-of-sight `shot`, `grenade`, `doorChanged` and `died` at 0.35; out-of-sight `moved`, `reloaded`, `pickedUp` silent; `alert` off is silent; `gameOver` gives `win` or `lose`; step volume 0.25.
- `Sound` with a fake context and fake storage: locked until `unlock()`; muted creates no nodes; volume scales the gain; more than 12 simultaneous voices are dropped; mute and volume persist and are restored; broken storage (throws) falls back to defaults; no audio engine is a no-op; `changeVolume` clamps at 0 and 1 and returns the message text.
- Controller with a recording sound: shot events play the mapped sounds; a refused shot with no ammo plays `empty`; another rejection plays `error`; a successful command plays no `error`; out-of-sight enemy gunfire plays at 0.35.
- App: first click calls `unlock`; `M` toggles on every screen; `-` and `=` change volume; equipment +/- plays `click` only when the loadout changed; Start and Continue play `click`.

## 9. Success criteria

- Playing a mission produces a distinct sound for shots, hits, misses, stabs, grenades, doors, deaths, reloads and the mission end, and a refused action buzzes.
- Gunfire from enemies you cannot see is audible but quieter; their footsteps are not.
- `M` mutes everything instantly and the setting survives a page reload; nothing plays before the first click.
- All existing tests pass and `core` still has no audio or browser imports.

## 10. Risks and notes

- Sound design cannot be verified by tests: the recipes in `effects.ts` will need tuning by ear. Expect a follow-up pass after Rui has listened; changes are data edits in one file.
- Rapid enemy turns can fire many events at once; the voice cap keeps the output clean.
- Autoplay rules differ between browsers; `unlock()` on the first gesture covers the common cases, and a failed `resume()` leaves the game silent but working.
