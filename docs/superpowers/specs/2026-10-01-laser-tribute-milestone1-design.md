# Laser Tribute: Milestone 1 Design

Date: 2026-10-01
Status: Draft for review

## 1. Purpose and intent

A faithful tribute to the vintage game Laser Squad (ZX Spectrum, Amiga, early Windows PC), with X-COM-style depth added gradually in later milestones.

- Audience: Rui, as a single-player hobby project. Success means a playable mission that is fun and feels authentic.
- Platform: browser first, TypeScript and HTML5 Canvas. An installable desktop build (Tauri or Electron) may come later, with no code changes.
- Perspective: top-down 2D, as in the original Laser Squad.
- Combat model: Laser Squad action points (AP), with an optional reaction-fire rule (off by default) borrowed from X-COM.
- Scope path: Laser Squad tactical core first, then X-COM-style persistence and a base/research layer as separate later milestones.

Milestone 1 is a small playable slice with doors, a few weapons, item pickup and fog of war, with soldiers against enemies.

## 2. Out of scope for milestone 1

- Pre-mission equipment and budget screen (milestone 2)
- Soldier stats, promotion and a persistent squad
- Saving and loading
- Sound and music
- Multiple missions and campaign
- X-COM base, research and geoscape layers
- Multiplayer

## 3. Architecture

Three layers, each depending only on the layer beneath it.

```
src/
  core/      pure game rules, no browser or drawing code
  render/    draws a core state to a canvas
  input/     turns mouse and keyboard into core commands
  main.ts    wires the layers together and runs the loop
tests/       Vitest tests for core
```

### 3.1 core

- **State** is plain data: map grid, tiles (floor, wall, closed door, open door), units (position, facing, AP, health, inventory), floor items, current side to move, and a seeded random number generator.
- **Commands** are the only way to change state: `Move`, `Turn`, `SnapShot`, `AimedShot`, `OpenDoor`, `CloseDoor`, `PickUp`, `Throw`, `EndTurn`.
  - Each command is validated against AP and the rules, then applied.
  - Applying a command returns a list of events (unit moved, shot missed, unit died, door opened) which the renderer animates.
  - An illegal command is rejected with a reason and causes no state change.
- **Rule modules**: line of sight and fog of war, hit chance, AP costs per action and weapon, enemy AI.
- The enemy AI issues the same commands a player would, under the same AP rules.
- **Reaction fire** is a rules setting, off by default.

Rationale: the command and event structure supports undo before ending a turn, later saving and loading, and replays. X-COM layers extend state and rules without touching rendering. A seeded random number generator keeps every test reproducible.

## 4. Milestone 1 rules

All numeric values are starting values, held in one config module so they are easy to tune.

### 4.1 Map and units

- One fixed hand-authored map, about 30x20 tiles, with rooms, corridors and doors.
- 4 player soldiers and 4 enemies.
- Each unit has health, an AP pool that refills at the start of its side's turn, and a facing direction.

### 4.2 Action point costs

- Move one tile: 4 AP, diagonal 6 AP.
- Turn 45 degrees: 1 AP.
- Open or close a door: 2 AP.
- Pick up an item: 3 AP.
- Snap shot: about 25% of the AP pool, lower accuracy.
- Aimed shot: costs more AP, better hit chance.
- Throw a grenade: about 40% of the AP pool.

### 4.3 Weapons

- Pistol: low damage, cheap shots.
- Rifle: more damage and range, better aimed shots.
- Grenade: area damage, also destroys doors.
- Each weapon defines its own AP cost, accuracy and range.

### 4.4 Hit chance

- Depends on distance and shot type.
- Reduced when the target is partially covered.
- Walls always block a shot, and misses land near the target.

### 4.5 Line of sight and fog of war

- Each soldier sees in a forward cone with limited range.
- Walls and closed doors block sight.
- Tiles not currently visible are greyed out and enemies on them are hidden.
- Explored map areas are remembered.

### 4.6 Enemy AI

- Attack the nearest visible soldier.
- Otherwise advance toward the last seen position.
- Otherwise patrol.

### 4.7 Win and lose

- Win when all enemies are eliminated.
- Lose when all player soldiers are dead.

## 5. Rendering and input

### 5.1 Rendering

- Low-resolution logical canvas (for example 320x200) scaled up with nearest-neighbour filtering for crisp pixels.
- 16x16 tiles.
- Placeholder art: coloured shapes and sprites generated in code, replaceable by real pixel art later with no code change to core.
- Limited retro palette and a pixel font.
- Renderer reads core state and plays events as short animations: move, shot trace, hit flash, death.
- A bottom panel shows the selected soldier's AP, health and weapon, plus action buttons.

### 5.2 Input

- Click a soldier to select, click a tile to move. The AP cost is shown before committing.
- Hotkeys: turn, snap shot, aimed shot, throw, open door, pick up, end turn.
- Right-click or Escape cancels the current action.
- Input only emits commands; core decides legality.

## 6. Tooling and testing

- Vite (dev server and build), TypeScript in strict mode, Vitest.
- `npm run dev` to play, `npm run build` for a static site.
- Git from the first commit. GitHub remote is optional and added later by the owner's choice.
- Unit tests for core: AP costs, line of sight, hit chance, doors, enemy AI choices, win and lose conditions, all deterministic via the seeded random number generator.
- Rendering and input are verified by playing in the browser.

## 7. Error handling

- Illegal commands, for example moving without enough AP, are rejected with a reason and no state change. The UI shows a short message.

## 8. Success criteria for milestone 1

- A full mission is playable from start to win or lose.
- The rules in section 4 behave as described and are covered by unit tests.
- The game looks and feels like a retro top-down tactics game.
- The core module has no dependency on the browser or the renderer.

## 9. Later milestones (not designed here)

1. Pre-mission equipment and budget screen.
2. Soldier stats, promotion and a persistent squad between missions.
3. Multiple missions, saving and loading, sound.
4. X-COM-style base and research layer.
5. Installable desktop build.
