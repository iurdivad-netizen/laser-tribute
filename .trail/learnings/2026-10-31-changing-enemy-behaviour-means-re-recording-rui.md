---
title: "Changing enemy behaviour means re-recording the golden turn fingerprints, and cached sight assumes finished states never change"
author: Rui
date: 2026-10-31
branch: chore/trail-init
cost: { minutes: 1, tokens: 1418 }
id: l-1deee1e5
scope: repo
status: active
src: agent
touches:
  - "src/core/vision.ts#visibleGrid"
  - src/core/ai.ts
  - tests/aigolden.test.ts
---

## Decided
Enemy turns are checked against recorded fingerprints on 20 generated maps. When the AI is changed on purpose, re-record only the maps that differ, after comparing the event counts before and after to be sure the turns still end sensibly. The renderer asks for sight through a cache keyed by the game state object, which is safe because every command makes a new state.

## Tried and ruled out
Measuring idle redraws by counting real frames in the browser preview pane. Its animation frames run at only a few per second there, so the numbers say nothing. Call the redraw check directly with simulated 60 Hz times instead.

## Watch out
In the code: `visibleGrid` in `src/core/vision.ts` returns a stale grid if code edits tiles, doors, hazards or units on a state after it has been drawn. Make a new state, or call `computeVisible` directly. `tests/aigolden.test.ts` holds the fingerprints; the comment above them lists which maps changed when. Hit-stop in `src/render/effects.ts` moves the effects clock, so tests that check exact sprite timing set `reducedMotion = true`.
