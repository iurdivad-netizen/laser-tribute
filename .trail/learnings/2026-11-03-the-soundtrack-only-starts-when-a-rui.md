---
title: "The soundtrack only starts when a real timer exists, so audio tests see no extra sound nodes"
author: Rui
date: 2026-11-03
branch: master
cost: { minutes: 9, tokens: 69896 }
id: l-bd558aff
scope: repo
status: active
src: agent
touches:
  - src/audio/music.ts
  - tests/music.test.ts
  - src/audio/sound.ts
---

## Decided
Music is created lazily on the first user gesture, and only when a timer is available. In tests no timer exists, so no music nodes appear and the existing audio-mix tests that count gains and oscillators stay valid. Mood is decided in the app from the cached player visibility grid and passed to the sound player through an optional method, so test fakes of the sound player keep compiling.

## Tried and ruled out
Starting the music engine inside the same step that builds the mixer buses: it adds gain nodes that the audio-mix tests count.

## Watch out
In the code: src/audio/music.ts, `layers`. A silent layer must start with fade times at -Infinity; with 0 it counts as audible for the first half second and the action parts leak into calm at startup. In src/audio/sound.ts, add new class members after the interface: the interface and the class both contain a `play(name: SoundName` line, and a text replace on it hit the interface first and broke the typecheck twice.
