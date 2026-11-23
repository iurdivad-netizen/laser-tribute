---
title: "Story mode gear is capped at level 6 while the capital fights at level 10, left for balance"
author: Rui
date: 2026-11-23
branch: feature/story-planet
cost: { minutes: 35, tokens: 418122 }
id: l-3d008ae4
scope: repo
status: active
src: agent
touches:
  - README.md
  - docs/superpowers/plans/2026-11-23-story-mode-planet.md
  - docs/superpowers/specs/2026-11-23-laser-tribute-story-mode-planet-design.md
  - sim/story.sim.ts
  - src/sim/story.ts
  - tests/storysim.test.ts
  - src/app.ts
  - src/screens/end.ts
  - tests/storyapp.test.ts
  - src/screens/title.ts
---

## Decided
Story mode keeps the player's gear level and the enemies' level separate. Gear is 1 + (enemy regions taken / 3), but there are only 17 enemy regions, so it can never pass 6. Enemy level is the region's map type + 1, so the capital (type 9) fights at 10. We kept this as designed instead of inventing a faster gear curve, because research (project 2) replaces the interim rule anyway and project 4 tunes the numbers.
Defeat only happens when no region is held; a lost mission wipes the squad, brings four rookies, costs 6 extra days, and leaves the region enemy-held.

## Tried and ruled out
Reusing the single `level` argument for both sides: story needs them apart, so `createMission` got an optional `enemyLevel` that defaults to `level`. Extending the linear Campaign type with a world: rejected, it loosens the strict save checks and risks the balance study.

## Watch out
Do not read the 10 cap in `gearLevel` as reachable. If late story fights look too hard for the bot or a player, this gap is the first suspect, not the garrison numbers.
In the code: src/core/world/world.ts (`gearLevel`, `missionFor`), src/core/missions.ts (`createMission` enemyLevel), src/core/world/difficulty.ts (starting values, tunable).
