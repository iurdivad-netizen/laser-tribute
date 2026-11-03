---
title: "The map's soft light is one pixel per tile stretched over the map, and the unexplored void must be repainted black after it"
author: Rui
date: 2026-11-03
branch: feature/map-visuals
cost: { minutes: 1, tokens: 1073 }
id: l-e1b09e57
scope: repo
status: active
src: agent
touches:
  - src/render/lighting.ts
---

## Decided
Fog and light edges are soft because each tile is one pixel in a small image that is stretched over the map with smoothing on. Floor shading is stepped strips, not gradients, to stay pixel art.

## Tried and ruled out
Gradient fills for shadows: the render tests fake the canvas with a Proxy whose methods return a plain object, so a gradient's colour-stop call would throw. Drawing the light layer alone: it tints the unexplored void blue and leaks a warm strip past the outer wall.

## Watch out
In the code: src/render/lighting.ts, drawLight. The stretched layers spill half a tile over unexplored tiles and one tile past the map edge, so drawLight repaints both solid black afterwards. Keep that step if you add a layer. With no canvas (plain Node tests) it falls back to flat per-tile fills.
