---
title: "The first click on the title screen only unlocks audio, because browsers block sound until a gesture"
author: Rui
date: 2026-11-03
branch: feature/soundtrack
cost: { minutes: 21, tokens: 38488 }
id: l-ff32ef98
scope: repo
status: active
src: agent
touches:
  - src/app.ts
  - tests/music.test.ts
  - src/audio/music.ts
  - src/audio/sound.ts
---

## Decided
Browsers keep audio silent until a click or key press, and on the title screen that first gesture was also a menu choice, so the title music never got to play. The first gesture on the title now only unlocks audio (and shows a hint); the next one acts normally. This only applies to the real sound player: it reports waiting only where a timer exists, so tests and fake players are unaffected.

## Tried and ruled out
Judging the action music by ear alone. Rendering both moods offline in the browser and comparing average level showed the first action mix was quieter than the calm one (about 0.021 against 0.038), so it was rebuilt with snare, sub bass, chord stabs and a lead line to match calm on average with much higher peaks.

## Watch out
In the code: src/app.ts `firstGestureOnTitle`, src/audio/sound.ts `waiting`. Any new title-screen input path must go through the first-gesture check or it will skip the audio unlock. Measure loudness with an OfflineAudioContext and a hand-driven Music timer rather than guessing.
