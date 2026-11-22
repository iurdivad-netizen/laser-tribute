---
title: "The balance bot is a floor, not a human, and enemy roles stay off in the tutorial so the golden turns do not change"
author: Rui
date: 2026-11-22
branch: feature/hit-chance
cost: { minutes: 26, tokens: 169271 }
id: l-3c040e27
scope: repo
status: active
src: agent
touches:
  - tests/simbot.test.ts
  - README.md
  - src/app.ts
  - src/screens/end.ts
  - src/screens/equipment.ts
  - src/screens/result.ts
  - src/screens/title.ts
  - tests/touchslop.test.ts
  - src/render/effects.ts
  - tests/feel.test.ts
---

## Decided
Campaign balance is measured by a bot that plays all ten missions over many seeds and prints win rate per mission. It shoots what the squad sees and walks as a group toward the enemy that is nearest by walking distance. It knows where enemies are, uses no cover, alert or gadgets, so treat its win rate as a floor for a careful human. Enemy roles (officer, rusher, sniper) are only handed out above level 1, and the role field is left undefined for plain riflemen, so the recorded enemy-turn fingerprints on level 1 stay valid.

## Tried and ruled out
Heading for the enemy nearest in a straight line: on some generated maps that enemy sits behind walls the squad cannot reach, so the bot found no path and every mission timed out with zero casualties. Always pick the shortest real path.

## Watch out
In the code: `npm run balance` uses its own vitest config (vitest.sim.config.ts) and needs --disableConsoleIntercept or the report table is swallowed. One campaign takes about 50 seconds, so 24 seeds is roughly 20 minutes; run it from a copy of the tree if you keep editing, since files are read at start. Role changes alter level above 1 enemy behaviour but not tests/aigolden.test.ts, which builds missions at level 1.
