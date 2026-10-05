# Laser Tribute Milestone 10: Enemy Door-Opening (Design)

Date: 2026-10-05. Follows milestone 9 (saving and loading).

## Purpose and findings

Rui's observation: enemies seem to ignore doors "as if it was not there". Reading the code confirms it is a missing feature, not a bug:

- `src/core/ai.ts` has no door logic. A closed door is a wall to the pathfinder (`isBlocking`, `stepBlockedReason`: "The door is closed"), so enemies never open or close doors.
- Every door starts closed (`+` in the map rows). Missions 2 and 3 put enemies in rooms behind closed doors. They only get out after the player opens a door, and then walk through the open doorway like a gap.
- An enemy whose goal (the shared last-known squad position `enemyMemory`, or a visible soldier) lies behind a closed door finds no path and stands still. A squad that hides behind a door is perfectly safe.

Success: alerted enemies near the squad open doors and follow it, doors keep their meaning (a closed door still blocks sight and shots until opened), and the difficulty does not jump because of a whole-map swarm.

## Decisions (Rui, stated)

- **Nearby enemies only** hunt through doors (over the "every enemy" and "only the one who saw you" options).
- The numbers below (radius 12, no closing, patrols unchanged) are proposals Rui accepted with the design sections.

## Scope

In: enemy route planning through closed doors, an OpenDoor command from the AI, a hunt radius, tests.
Out: enemies closing doors, hearing, locked doors, map changes, any UI or art change.

## Design

### Behaviour

- Trigger: an enemy with a **hunting goal** (a visible soldier, else `enemyMemory`) whose cheapest route needs a closed door opens that door.
- It walks next to the door, then issues the same `OpenDoor` command the player uses: `CONFIG.doorCost` = **2 AP** (a move step costs 4), the same rules and rejections as `handleDoor` (adjacent, not already open, enough AP). It continues through on the same turn if AP remains, else next turn.
- **Hunt radius:** if the planned route crosses a closed door and is longer than `CONFIG.huntRadius` (**12** tiles, each door tile counting as one), the enemy takes no step. Routes with no closed door are not limited, so existing chase behaviour is unchanged.
- **Patrols and idle enemies never open doors.** Patrol goals keep today's door-blind planning (the shipped patrols stay inside rooms).
- Enemies **never close** doors; doors stay open after anyone passes.
- Line of sight and shots are unchanged: a closed door still blocks both until opened. Alert soldiers fire at an enemy that steps into view as today (opening a door is not a move).

### Code changes (all in `src/core`)

- `movement.ts`: `stepBlockedReason(s, from, to, ignoreUnits, doorsOpen = false)`. With `doorsOpen`, the "The door is closed" check is skipped; all other checks (wall, corner cut, occupant) still apply. Real movement never passes `doorsOpen`.
- `path.ts`: `PathOptions.openDoors?: boolean`. When set, planning passes `doorsOpen` and adds `CONFIG.doorCost` to the distance of a step into a closed door tile. Default behaviour is unchanged. Corner-cut checks keep treating closed doors as blocking (conservative).
- `config.ts`: `huntRadius: 12`.
- `ai.ts`: `firstStep` for hunting goals plans with `openDoors: true`, applies the radius rule, and returns either `{ type: 'OpenDoor', unitId, at }` (when the first step of the route is a closed door tile) or the existing `Move`. The move gate stays `ap >= CONFIG.moveCost`; the OpenDoor candidate is generated when `ap >= CONFIG.doorCost`. Candidates the engine rejects are skipped by the existing `aiNextCommand` loop, so low AP ends the turn cleanly.
- No controller, renderer, audio or UI change: enemy `doorChanged` events already flow through `eventVisible` (seen only when the door is in the player's view) and `audio/mapping.ts` (door sound).

### Data flow

```
enemy turn: aiNextCommand -> candidates(unit)
  hunting goal? -> findPath(openDoors) -> first step
     closed door and route <= 12 (or no door on route) -> OpenDoor / Move
     route with a door > 12 -> no step
  patrol goal -> findPath (door-blind) -> Move
applyCommand(OpenDoor) -> tile.open = true, ap -= 2, doorChanged event
```

## Testing

- `tests/path.test.ts` additions (append; do not overwrite): a closed door blocks `findPath` by default; with `openDoors` it is passable, costs 2 more than an open door, and walls, occupied doorways and corner cuts still block.
- New `tests/aidoors.test.ts` (check the name is free) on small hand-built maps:
  - an enemy with `enemyMemory` behind a closed door walks to it, opens it (AP drops by 2, a `doorChanged` event), and the next commands step through;
  - a door route longer than 12 tiles: the enemy stays put; at exactly 12 it goes;
  - a patrolling enemy with no memory never opens a door;
  - an enemy with 1 AP next to the door ends its turn without error and opens it next turn;
  - a unit standing in the doorway: no open command is repeated, no infinite loop, the turn ends;
  - a door that is already open is just walked through; enemies never emit a close;
  - a visible soldier behind an open door still gets shot as before (existing behaviour).
- Regression: all existing AI, path and mission tests stay green, including the check that the AI skips needless pathfinding (call counts must not rise for patrol or idle enemies).
- Mission check (scripted test on Warehouse and Compound): with the squad spotted near the first room, enemies within 12 route tiles of the sighting open their doors and arrive, while far rooms stay closed.
- A real-browser look: play a mission to the first door and watch an enemy open it (door sound, door drawn open when in view).

## Constraints

- `src/core` stays pure and deterministic; the AI uses no randomness for door decisions.
- No change to saves, equipment, scoring or the maps.
- No new dependencies.
