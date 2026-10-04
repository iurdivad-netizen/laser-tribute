# Laser Tribute Milestone 6 Implementation Plan (sound effects)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retro synthesized sound effects for every game event, quieter sounds for gunfire, explosions, doors and deaths the player cannot see, a mute key, and a remembered volume.

**Architecture:** Three new modules in `src/audio`: `effects.ts` (pure data: each sound is a list of oscillator/noise segments), `mapping.ts` (pure function from a game event to the sounds to play and their volume), and `sound.ts` (a `Sound` class that owns the Web Audio context, mute, volume and persistence, with an injectable context factory and storage so tests use fakes). The controller plays the mapped sounds for each command's events; the app handles unlock, mute/volume keys, interface clicks and a small on-screen hint.

**Tech Stack:** TypeScript, Web Audio API (oscillators and a noise buffer), Vite, Vitest (`npx vitest run`, `npx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-04-laser-tribute-milestone6-design.md` (read it first).

## Global Constraints

- `src/core` has no audio or browser imports. No sound files: everything is synthesized.
- Sounds (18): `pistol`, `rifle`, `hit`, `ricochet`, `stab`, `explosion`, `deathSoldier`, `deathEnemy`, `reload`, `empty`, `door`, `step`, `pickup`, `alert`, `click`, `error`, `win`, `lose`.
- Volumes: visible events 1.0 except `step` 0.25 and `hit`/`ricochet` 0.8; out of sight `shot`, `grenade`, `doorChanged` and `died` play at 0.35 (only the shot/explosion/door/death sound, no hit or ricochet); out-of-sight `moved`, `reloaded`, `pickedUp`, `alert` and `stab` are silent; interface sounds (`click`, `error`, `empty`, `win`, `lose`) at 0.9. The player's own soldiers' events are always audible. Master volume default 0.5, range 0 to 1, step 0.1.
- Every effect is under 1.5 s with every gain at most 1; at most 12 voices play at once.
- Settings key in `localStorage`: `laser-tribute-sound` = `{ "muted": boolean, "volume": number }`; every storage access is in try/catch. No audio engine, locked (before the first gesture) or muted means every `play` is a silent no-op.
- Keys: `M` mute, `-` volume down, `=` or `+` volume up, on every screen.
- Existing tests (348) must keep passing after every task.
- Co-author trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on branch `milestone-6` (created, spec committed).

## Review Focus

- Muted, locked (before the first click) and no-audio-engine states create no audio nodes and never throw. Task 3.
- Broken or corrupt storage (getItem or setItem throws, bad JSON, out-of-range values) falls back to defaults and the game still works. Task 3.
- The player's own pickups and alerts are audible even though the controller's `eventVisible` returns false for them; out-of-sight enemy gunfire is 0.35 and out-of-sight footsteps and reloads are silent. Tasks 2 and 4.
- A burst of events (many enemies, a grenade with several hits) cannot exceed 12 voices and sounds work again once earlier ones have finished. Task 3.
- `M`, `-` and `=` work on every screen without reaching the controller as game keys, and `k`, `r`, `s`, `a` still work. Task 5.
- A rejected player command makes exactly one sound (`empty` for no ammo, `error` otherwise), and a successful command never plays `error`. Task 4.

## File Structure

- Create `src/audio/effects.ts`, `src/audio/mapping.ts`, `src/audio/sound.ts`.
- Modify `src/controller.ts`, `src/app.ts`, `src/render/panel.ts`, `README.md`.
- Tests: create `tests/effects.test.ts`, `tests/soundmap.test.ts`, `tests/sound.test.ts`, `tests/soundcontroller.test.ts`, `tests/soundapp.test.ts`.

---

### Task 1: Sound recipes (pure data)

**Files:**
- Create: `src/audio/effects.ts`
- Test: `tests/effects.test.ts`

**Interfaces:**
- Produces: `SOUND_NAMES` (readonly tuple of the 18 names); `type SoundName`; `type Wave = 'square' | 'sawtooth' | 'triangle' | 'noise'`; `interface Segment { wave: Wave; from: number; to: number; start: number; dur: number; gain: number }` (Hz and seconds; for `noise` the frequencies are ignored and set to 1); `EFFECTS: Record<SoundName, Segment[]>`; `effectDuration(name: SoundName): number` (the latest `start + dur`).

- [ ] **Step 1: Write the failing tests**

Create `tests/effects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EFFECTS, SOUND_NAMES, effectDuration, type SoundName } from '../src/audio/effects';

const DESIGN: SoundName[] = [
  'pistol', 'rifle', 'hit', 'ricochet', 'stab', 'explosion', 'deathSoldier', 'deathEnemy',
  'reload', 'empty', 'door', 'step', 'pickup', 'alert', 'click', 'error', 'win', 'lose',
];

describe('sound recipes', () => {
  it('cover exactly the sounds of the design', () => {
    expect([...SOUND_NAMES].sort()).toEqual([...DESIGN].sort());
    expect(Object.keys(EFFECTS).sort()).toEqual([...DESIGN].sort());
  });

  it('every effect has valid segments and stays short and quiet enough', () => {
    for (const name of SOUND_NAMES) {
      const segments = EFFECTS[name];
      expect(segments.length, name).toBeGreaterThan(0);
      for (const s of segments) {
        expect(['square', 'sawtooth', 'triangle', 'noise'], name).toContain(s.wave);
        expect(s.from, name).toBeGreaterThan(0);
        expect(s.to, name).toBeGreaterThan(0);
        expect(s.start, name).toBeGreaterThanOrEqual(0);
        expect(s.dur, name).toBeGreaterThan(0);
        expect(s.gain, name).toBeGreaterThan(0);
        expect(s.gain, name).toBeLessThanOrEqual(1);
      }
      expect(effectDuration(name), name).toBeLessThanOrEqual(1.5);
    }
  });

  it('reports the end of the latest segment as the duration', () => {
    expect(effectDuration('click')).toBeCloseTo(0.02, 5);
    expect(effectDuration('win')).toBeGreaterThan(effectDuration('click'));
  });

  it('gives the big sounds more body than the small ones', () => {
    expect(effectDuration('explosion')).toBeGreaterThan(effectDuration('pistol'));
    expect(effectDuration('rifle')).toBeGreaterThan(effectDuration('step'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/effects.test.ts`
Expected: FAIL (cannot find module `../src/audio/effects`).

- [ ] **Step 3: Implement**

Create `src/audio/effects.ts`:

```ts
export const SOUND_NAMES = [
  'pistol', 'rifle', 'hit', 'ricochet', 'stab', 'explosion', 'deathSoldier', 'deathEnemy',
  'reload', 'empty', 'door', 'step', 'pickup', 'alert', 'click', 'error', 'win', 'lose',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

export type Wave = 'square' | 'sawtooth' | 'triangle' | 'noise';

/** One oscillator (or burst of noise): frequency glides from `from` to `to` Hz over `dur` seconds. */
export interface Segment {
  wave: Wave;
  from: number;
  to: number;
  start: number;
  dur: number;
  gain: number;
}

const tone = (wave: Exclude<Wave, 'noise'>, from: number, to: number, start: number, dur: number, gain: number): Segment =>
  ({ wave, from, to, start, dur, gain });
const noise = (start: number, dur: number, gain: number): Segment =>
  ({ wave: 'noise', from: 1, to: 1, start, dur, gain });

/** All the sound design lives here, so it can be tuned by ear in one place. */
export const EFFECTS: Record<SoundName, Segment[]> = {
  pistol: [noise(0, 0.08, 0.5), tone('square', 900, 200, 0, 0.09, 0.3)],
  rifle: [noise(0, 0.14, 0.7), tone('sawtooth', 600, 90, 0, 0.16, 0.35)],
  hit: [tone('triangle', 220, 80, 0, 0.09, 0.6)],
  ricochet: [tone('sawtooth', 1800, 700, 0, 0.12, 0.25), noise(0, 0.05, 0.2)],
  stab: [noise(0, 0.06, 0.5), tone('square', 500, 150, 0, 0.1, 0.3)],
  explosion: [noise(0, 0.6, 0.9), tone('sawtooth', 140, 30, 0, 0.55, 0.6)],
  deathSoldier: [tone('square', 400, 80, 0, 0.4, 0.45)],
  deathEnemy: [tone('sawtooth', 300, 60, 0, 0.35, 0.45)],
  reload: [tone('square', 700, 700, 0, 0.03, 0.3), tone('square', 500, 500, 0.09, 0.04, 0.3)],
  empty: [tone('square', 300, 300, 0, 0.03, 0.35)],
  door: [noise(0, 0.12, 0.3), tone('square', 180, 120, 0, 0.12, 0.15)],
  step: [noise(0, 0.03, 0.2)],
  pickup: [tone('square', 600, 900, 0, 0.06, 0.3), tone('square', 900, 1200, 0.07, 0.08, 0.3)],
  alert: [tone('triangle', 800, 1200, 0, 0.1, 0.3)],
  click: [tone('square', 1000, 1000, 0, 0.02, 0.25)],
  error: [tone('sawtooth', 160, 120, 0, 0.18, 0.35)],
  win: [
    tone('square', 523, 523, 0, 0.12, 0.3),
    tone('square', 659, 659, 0.13, 0.12, 0.3),
    tone('square', 784, 784, 0.26, 0.3, 0.3),
  ],
  lose: [
    tone('square', 392, 330, 0, 0.2, 0.3),
    tone('square', 330, 262, 0.22, 0.2, 0.3),
    tone('square', 262, 196, 0.44, 0.4, 0.3),
  ],
};

export function effectDuration(name: SoundName): number {
  return Math.max(...EFFECTS[name].map((s) => s.start + s.dur));
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/audio/effects.ts tests/effects.test.ts
git commit -m "feat(audio): synthesized sound recipes as pure data

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Event-to-sound mapping (pure)

**Files:**
- Create: `src/audio/mapping.ts`
- Test: `tests/soundmap.test.ts`

**Interfaces:**
- Consumes: `SoundName` (Task 1), `GameEvent`, `GameState`.
- Produces: `interface SoundHit { name: SoundName; volume: number }`; `soundsFor(ev: GameEvent, state: GameState, audible: boolean): SoundHit[]`. `audible` means the player can see or own the event (the controller decides, Task 4); `state` is the state after the command, used to look up a unit's weapon or side. Constants exported: `VOLUME = { full: 1, far: 0.35, step: 0.25, impact: 0.8, ui: 0.9 }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/soundmap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { VOLUME, soundsFor } from '../src/audio/mapping';
import type { GameEvent } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const state = () => makeState(corridorRows('P..E'));
const at = { x: 2, y: 1 };
const shot = (hit: boolean, unitId = 'p1', targetId = 'e1'): GameEvent => ({
  type: 'shot', unitId, targetId, mode: 'snap', hit, damage: hit ? 30 : 0, from: { x: 1, y: 1 }, impact: at,
});

describe('soundsFor: shots', () => {
  it('a visible rifle hit is the rifle then a thud', () => {
    expect(soundsFor(shot(true), state(), true)).toEqual([
      { name: 'rifle', volume: 1 },
      { name: 'hit', volume: 0.8 },
    ]);
  });

  it('a visible pistol miss is the pistol then a ricochet', () => {
    const s = state();
    unit(s, 'p1').weapon = 'pistol';
    expect(soundsFor(shot(false), s, true)).toEqual([
      { name: 'pistol', volume: 1 },
      { name: 'ricochet', volume: 0.8 },
    ]);
  });

  it('out of sight only the gunshot is heard, quietly', () => {
    expect(soundsFor(shot(true, 'e1', 'p1'), state(), false)).toEqual([{ name: 'rifle', volume: 0.35 }]);
  });
});

describe('soundsFor: other events', () => {
  it('a stab hit is the stab then a thud; a miss is only the stab', () => {
    const stab = (hit: boolean): GameEvent => ({
      type: 'stab', unitId: 'p1', targetId: 'e1', hit, damage: hit ? 60 : 0, from: { x: 1, y: 1 }, at,
    });
    expect(soundsFor(stab(true), state(), true)).toEqual([
      { name: 'stab', volume: 1 },
      { name: 'hit', volume: 0.8 },
    ]);
    expect(soundsFor(stab(false), state(), true)).toEqual([{ name: 'stab', volume: 1 }]);
    expect(soundsFor(stab(true), state(), false)).toEqual([]);
  });

  it('a grenade is an explosion, quieter out of sight', () => {
    const ev: GameEvent = { type: 'grenade', unitId: 'p1', at, hits: [], doorsDestroyed: [] };
    expect(soundsFor(ev, state(), true)).toEqual([{ name: 'explosion', volume: 1 }]);
    expect(soundsFor(ev, state(), false)).toEqual([{ name: 'explosion', volume: 0.35 }]);
  });

  it('a death sounds different for a soldier and an enemy, quieter out of sight', () => {
    const died = (unitId: string): GameEvent => ({ type: 'died', unitId, at });
    expect(soundsFor(died('p1'), state(), true)).toEqual([{ name: 'deathSoldier', volume: 1 }]);
    expect(soundsFor(died('e1'), state(), true)).toEqual([{ name: 'deathEnemy', volume: 1 }]);
    expect(soundsFor(died('e1'), state(), false)).toEqual([{ name: 'deathEnemy', volume: 0.35 }]);
  });

  it('a door is heard far away, quietly', () => {
    const ev: GameEvent = { type: 'doorChanged', at, open: true };
    expect(soundsFor(ev, state(), true)).toEqual([{ name: 'door', volume: 1 }]);
    expect(soundsFor(ev, state(), false)).toEqual([{ name: 'door', volume: 0.35 }]);
  });

  it('footsteps are very quiet and only when audible', () => {
    const ev: GameEvent = { type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: at };
    expect(soundsFor(ev, state(), true)).toEqual([{ name: 'step', volume: 0.25 }]);
    expect(soundsFor(ev, state(), false)).toEqual([]);
  });

  it('reload, pickup and alert-on play only when audible; alert-off never plays', () => {
    const reloaded: GameEvent = { type: 'reloaded', unitId: 'p1', ammo: 5, at };
    const picked: GameEvent = { type: 'pickedUp', unitId: 'p1', itemId: 'i1', kind: 'rifle' };
    const on: GameEvent = { type: 'alert', unitId: 'p1', on: true };
    const off: GameEvent = { type: 'alert', unitId: 'p1', on: false };
    expect(soundsFor(reloaded, state(), true)).toEqual([{ name: 'reload', volume: 1 }]);
    expect(soundsFor(picked, state(), true)).toEqual([{ name: 'pickup', volume: 1 }]);
    expect(soundsFor(on, state(), true)).toEqual([{ name: 'alert', volume: 1 }]);
    for (const ev of [reloaded, picked, on]) expect(soundsFor(ev, state(), false)).toEqual([]);
    expect(soundsFor(off, state(), true)).toEqual([]);
  });

  it('the end of the mission plays a jingle regardless of sight', () => {
    expect(soundsFor({ type: 'gameOver', winner: 'player' }, state(), false)).toEqual([{ name: 'win', volume: 0.9 }]);
    expect(soundsFor({ type: 'gameOver', winner: 'enemy' }, state(), false)).toEqual([{ name: 'lose', volume: 0.9 }]);
  });

  it('turns and turn changes are silent', () => {
    expect(soundsFor({ type: 'turned', unitId: 'p1', facing: 2 }, state(), true)).toEqual([]);
    expect(soundsFor({ type: 'turnEnded', side: 'player' }, state(), true)).toEqual([]);
  });

  it('exposes the volume levels', () => {
    expect(VOLUME).toEqual({ full: 1, far: 0.35, step: 0.25, impact: 0.8, ui: 0.9 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/soundmap.test.ts`
Expected: FAIL (cannot find module `../src/audio/mapping`).

- [ ] **Step 3: Implement**

Create `src/audio/mapping.ts`:

```ts
import type { GameEvent, GameState } from '../core/types';
import type { SoundName } from './effects';

export interface SoundHit {
  name: SoundName;
  volume: number;
}

export const VOLUME = { full: 1, far: 0.35, step: 0.25, impact: 0.8, ui: 0.9 } as const;

const hit = (name: SoundName, volume: number): SoundHit => ({ name, volume });

/**
 * The sounds one game event makes. `audible` is true when the player can see the event or it is one of
 * the player's own soldiers; `state` is the state after the command (to look up a weapon or a side).
 * Gunfire, explosions, doors and deaths out of sight are still heard, quietly.
 */
export function soundsFor(ev: GameEvent, state: GameState, audible: boolean): SoundHit[] {
  const loud = audible ? VOLUME.full : VOLUME.far;
  switch (ev.type) {
    case 'shot': {
      const weapon = state.units.find((u) => u.id === ev.unitId)?.weapon;
      const out = [hit(weapon === 'pistol' ? 'pistol' : 'rifle', loud)];
      if (audible) out.push(hit(ev.hit ? 'hit' : 'ricochet', VOLUME.impact));
      return out;
    }
    case 'stab':
      if (!audible) return [];
      return ev.hit ? [hit('stab', VOLUME.full), hit('hit', VOLUME.impact)] : [hit('stab', VOLUME.full)];
    case 'grenade':
      return [hit('explosion', loud)];
    case 'died': {
      const side = state.units.find((u) => u.id === ev.unitId)?.side;
      return [hit(side === 'player' ? 'deathSoldier' : 'deathEnemy', loud)];
    }
    case 'doorChanged':
      return [hit('door', loud)];
    case 'moved':
      return audible ? [hit('step', VOLUME.step)] : [];
    case 'reloaded':
      return audible ? [hit('reload', VOLUME.full)] : [];
    case 'pickedUp':
      return audible ? [hit('pickup', VOLUME.full)] : [];
    case 'alert':
      return audible && ev.on ? [hit('alert', VOLUME.full)] : [];
    case 'gameOver':
      return [hit(ev.winner === 'player' ? 'win' : 'lose', VOLUME.ui)];
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/audio/mapping.ts tests/soundmap.test.ts
git commit -m "feat(audio): map game events to sounds, quieter out of sight

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The `Sound` class (context, mute, volume, persistence)

**Files:**
- Create: `src/audio/sound.ts`
- Test: `tests/sound.test.ts`

**Interfaces:**
- Consumes: `EFFECTS`, `SoundName`, `Segment`, `effectDuration` (Task 1).
- Produces: `interface SoundPlayer { play(name: SoundName, volume?: number): void; unlock(): void; toggleMute(): string; changeVolume(delta: number): string; readonly muted: boolean; readonly volume: number }`; `interface AudioContextLike` (minimal Web Audio surface, see below); `interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }`; `class Sound implements SoundPlayer` with constructor `(createContext?: () => AudioContextLike | null, storage?: StorageLike | null)` whose defaults use the browser's `AudioContext` and `localStorage` when `window` exists and otherwise do nothing; `SETTINGS_KEY = 'laser-tribute-sound'`; `MAX_VOICES = 12`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sound.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../src/audio/effects';
import { MAX_VOICES, SETTINGS_KEY, Sound, type AudioContextLike, type StorageLike } from '../src/audio/sound';

class FakeParam {
  calls: unknown[][] = [];
  setValueAtTime(...a: unknown[]) { this.calls.push(['set', ...a]); }
  exponentialRampToValueAtTime(...a: unknown[]) { this.calls.push(['ramp', ...a]); }
}

function makeContext() {
  const made = { osc: [] as { type: string; frequency: FakeParam; started?: number; stopped?: number }[], gain: [] as { gain: FakeParam }[], src: [] as { started?: number; stopped?: number }[] };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    state: 'running' as string,
    resumed: 0,
    resume() { this.resumed += 1; return Promise.resolve(); },
    createOscillator() {
      const o = {
        type: '', frequency: new FakeParam(), started: undefined as number | undefined, stopped: undefined as number | undefined,
        connect() {}, start(t: number) { o.started = t; }, stop(t: number) { o.stopped = t; },
      };
      made.osc.push(o);
      return o;
    },
    createGain() {
      const g = { gain: new FakeParam(), connect() {} };
      made.gain.push(g);
      return g;
    },
    createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; },
    createBufferSource() {
      const s = { buffer: null as unknown, started: undefined as number | undefined, stopped: undefined as number | undefined,
        connect() {}, start(t: number) { s.started = t; }, stop(t: number) { s.stopped = t; } };
      made.src.push(s);
      return s;
    },
  };
  return { ctx: ctx as unknown as AudioContextLike & typeof ctx, made };
}

class FakeStorage implements StorageLike {
  data: Record<string, string> = {};
  getItem(k: string) { return this.data[k] ?? null; }
  setItem(k: string, v: string) { this.data[k] = v; }
}

const throwing: StorageLike = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
};

function unlocked() {
  const { ctx, made } = makeContext();
  const storage = new FakeStorage();
  const sound = new Sound(() => ctx, storage);
  sound.unlock();
  return { sound, ctx, made, storage };
}

describe('locked, muted and missing audio', () => {
  it('does nothing before the first unlock', () => {
    const { ctx, made } = makeContext();
    const sound = new Sound(() => ctx, new FakeStorage());
    sound.play('rifle');
    expect(made.osc.length + made.src.length + made.gain.length).toBe(0);
  });

  it('plays after unlock: the rifle is a noise burst and a sawtooth', () => {
    const { sound, made } = unlocked();
    sound.play('rifle');
    expect(made.src.length).toBe(1);
    expect(made.osc.length).toBe(1);
    expect(made.osc[0].type).toBe('sawtooth');
  });

  it('muted creates no nodes, and toggling back restores sound', () => {
    const { sound, made } = unlocked();
    expect(sound.toggleMute()).toBe('Sound off');
    expect(sound.muted).toBe(true);
    sound.play('rifle');
    expect(made.osc.length + made.src.length).toBe(0);
    expect(sound.toggleMute()).toBe('Sound on');
    sound.play('click');
    expect(made.osc.length).toBe(1);
  });

  it('with no audio engine every call is a silent no-op', () => {
    const sound = new Sound(() => null, new FakeStorage());
    expect(() => {
      sound.unlock();
      sound.play('explosion');
      sound.toggleMute();
      sound.changeVolume(0.1);
    }).not.toThrow();
  });

  it('unlock creates the context once and resumes a suspended one', () => {
    const { ctx } = makeContext();
    ctx.state = 'suspended';
    let created = 0;
    const sound = new Sound(() => { created += 1; return ctx; }, new FakeStorage());
    sound.unlock();
    sound.unlock();
    expect(created).toBe(1);
    expect(ctx.resumed).toBeGreaterThanOrEqual(1);
  });
});

describe('volume', () => {
  it('scales the gain by the event volume and the master volume (default 0.5)', () => {
    const { sound, made } = unlocked();
    sound.play('click', 0.5);
    const first = made.gain[0].gain.calls[0];
    expect(first[0]).toBe('set');
    expect(first[1] as number).toBeCloseTo(EFFECTS.click[0].gain * 0.5 * 0.5, 5);
  });

  it('fades each sound out with a ramp to near silence at its end', () => {
    const { sound, made } = unlocked();
    sound.play('click');
    const ramp = made.gain[0].gain.calls.find((c) => c[0] === 'ramp')!;
    expect(ramp[1] as number).toBeLessThan(0.001);
    expect(ramp[2] as number).toBeCloseTo(EFFECTS.click[0].dur, 5);
  });

  it('changeVolume steps by 0.1, clamps to 0 and 1 and reports the percentage', () => {
    const { sound } = unlocked();
    expect(sound.changeVolume(0.1)).toBe('Volume 60%');
    expect(sound.volume).toBeCloseTo(0.6, 5);
    expect(sound.changeVolume(0.7)).toBe('Volume 100%');
    expect(sound.volume).toBe(1);
    expect(sound.changeVolume(-2)).toBe('Volume 0%');
    expect(sound.volume).toBe(0);
  });

  it('volume zero creates no nodes', () => {
    const { sound, made } = unlocked();
    sound.changeVolume(-1);
    sound.play('explosion');
    expect(made.osc.length + made.src.length).toBe(0);
  });
});

describe('voice limit', () => {
  it('drops sounds beyond 12 at once and plays again once earlier ones have finished', () => {
    const { sound, ctx, made } = unlocked();
    expect(MAX_VOICES).toBe(12);
    for (let i = 0; i < 20; i++) sound.play('explosion'); // one oscillator and one noise source each
    expect(made.osc.length).toBe(12);
    ctx.currentTime = 10; // everything has finished
    sound.play('explosion');
    expect(made.osc.length).toBe(13);
  });
});

describe('settings persistence', () => {
  it('saves mute and volume, and a new Sound restores them', () => {
    const { sound, storage } = unlocked();
    sound.toggleMute();
    sound.changeVolume(0.2);
    const saved = JSON.parse(storage.data[SETTINGS_KEY]);
    expect(saved.muted).toBe(true);
    expect(saved.volume).toBeCloseTo(0.7, 5);
    const again = new Sound(() => makeContext().ctx, storage);
    expect(again.muted).toBe(true);
    expect(again.volume).toBeCloseTo(0.7, 5);
  });

  it('uses defaults when storage throws, and still works', () => {
    const sound = new Sound(() => makeContext().ctx, throwing);
    expect(sound.muted).toBe(false);
    expect(sound.volume).toBe(0.5);
    expect(() => { sound.toggleMute(); sound.changeVolume(0.1); }).not.toThrow();
    expect(sound.muted).toBe(true);
  });

  it('uses defaults for corrupt or out-of-range stored values', () => {
    const s1 = new FakeStorage();
    s1.data[SETTINGS_KEY] = '{not json';
    expect(new Sound(() => null, s1)).toMatchObject({ muted: false, volume: 0.5 });
    const s2 = new FakeStorage();
    s2.data[SETTINGS_KEY] = JSON.stringify({ muted: 'yes', volume: 7 });
    expect(new Sound(() => null, s2)).toMatchObject({ muted: false, volume: 0.5 });
    const s3 = new FakeStorage();
    s3.data[SETTINGS_KEY] = JSON.stringify({ muted: true, volume: 0.3 });
    expect(new Sound(() => null, s3)).toMatchObject({ muted: true, volume: 0.3 });
  });

  it('works without any storage', () => {
    const sound = new Sound(() => null, null);
    expect(() => sound.toggleMute()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/sound.test.ts`
Expected: FAIL (cannot find module `../src/audio/sound`).

- [ ] **Step 3: Implement**

Create `src/audio/sound.ts`:

```ts
import { EFFECTS, type Segment, type SoundName, effectDuration } from './effects';

export const SETTINGS_KEY = 'laser-tribute-sound';
export const MAX_VOICES = 12;
const DEFAULT_VOLUME = 0.5;

export interface SoundPlayer {
  play(name: SoundName, volume?: number): void;
  /** Call from a click or key press: browsers only allow audio after a user gesture. */
  unlock(): void;
  toggleMute(): string;
  changeVolume(delta: number): string;
  readonly muted: boolean;
  readonly volume: number;
}

interface ParamLike {
  setValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
interface NodeLike {
  connect(to: unknown): unknown;
}
interface OscillatorLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  start(time: number): void;
  stop(time: number): void;
}
interface SourceLike extends NodeLike {
  buffer: unknown;
  start(time: number): void;
  stop(time: number): void;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: unknown;
  readonly state: string;
  resume?(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): NodeLike & { gain: ParamLike };
  createBuffer(channels: number, length: number, sampleRate: number): { getChannelData(c: number): Float32Array };
  createBufferSource(): SourceLike;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserContext(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  try {
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class Sound implements SoundPlayer {
  muted = false;
  volume = DEFAULT_VOLUME;

  private ctx: AudioContextLike | null = null;
  private noise: { getChannelData(c: number): Float32Array } | null = null;
  /** End times (audio clock) of the sounds still playing. */
  private ends: number[] = [];

  constructor(
    private readonly createContext: () => AudioContextLike | null = browserContext,
    private readonly storage: StorageLike | null = browserStorage(),
  ) {
    this.load();
  }

  unlock(): void {
    if (!this.ctx) this.ctx = this.createContext();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume?.()?.catch?.(() => undefined);
  }

  toggleMute(): string {
    this.muted = !this.muted;
    this.save();
    return this.muted ? 'Sound off' : 'Sound on';
  }

  changeVolume(delta: number): string {
    this.volume = Math.min(1, Math.max(0, Math.round((this.volume + delta) * 10) / 10));
    this.save();
    return `Volume ${Math.round(this.volume * 100)}%`;
  }

  play(name: SoundName, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const level = volume * this.volume;
    if (level <= 0) return;
    const now = ctx.currentTime;
    this.ends = this.ends.filter((e) => e > now);
    if (this.ends.length >= MAX_VOICES) return;
    this.ends.push(now + effectDuration(name));
    for (const seg of EFFECTS[name]) this.segment(ctx, seg, now, level);
  }

  private segment(ctx: AudioContextLike, seg: Segment, now: number, level: number): void {
    const t0 = now + seg.start;
    const t1 = t0 + seg.dur;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(seg.gain * level, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    gain.connect(ctx.destination);
    if (seg.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(ctx);
      src.connect(gain);
      src.start(t0);
      src.stop(t1);
    } else {
      const osc = ctx.createOscillator();
      osc.type = seg.wave;
      osc.frequency.setValueAtTime(seg.from, t0);
      if (seg.to !== seg.from) osc.frequency.exponentialRampToValueAtTime(seg.to, t1);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t1);
    }
  }

  /** One second of white noise, made once and shared by every noise burst. */
  private noiseBuffer(ctx: AudioContextLike): { getChannelData(c: number): Float32Array } {
    if (!this.noise) {
      const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate)), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { muted?: unknown; volume?: unknown };
      if (typeof saved.muted === 'boolean') this.muted = saved.muted;
      if (typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1) this.volume = saved.volume;
    } catch {
      // keep the defaults
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify({ muted: this.muted, volume: this.volume }));
    } catch {
      // storage unavailable: the setting just lasts for this visit
    }
  }
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If the voice-limit test fails because `explosion` creates more or fewer nodes per play than one oscillator and one noise source, check `EFFECTS.explosion` still has one `noise` and one `sawtooth` segment.

- [ ] **Step 5: Commit**

```bash
git add src/audio/sound.ts tests/sound.test.ts
git commit -m "feat(audio): Sound class with unlock, mute, volume, voice limit and persistence

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The controller plays the sounds

**Files:**
- Modify: `src/controller.ts`
- Test: `tests/soundcontroller.test.ts`

**Interfaces:**
- Consumes: `SoundPlayer` (Task 3), `soundsFor` (Task 2).
- Produces: `new Controller(state, ui, effects, sound?: SoundPlayer | null)`. In `run`: a successful command plays `soundsFor(ev, state, audible)` for each event, where `audible` is the controller's existing visibility flag, or true when the event belongs to one of the player's own soldiers (events with a `unitId` whose unit is on the player's side); a rejected command plays `empty` at 0.9 when the reason is `Out of ammo`, otherwise `error` at 0.9.

- [ ] **Step 1: Write the failing tests**

Create `tests/soundcontroller.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SoundName } from '../src/audio/effects';
import type { SoundPlayer } from '../src/audio/sound';
import { Controller } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { corridorRows, makeState, seedForRoll, unit } from './helpers';

class RecordingSound implements SoundPlayer {
  played: { name: SoundName; volume: number }[] = [];
  muted = false;
  volume = 0.5;
  play(name: SoundName, volume = 1) { this.played.push({ name, volume }); }
  unlock() {}
  toggleMute() { return ''; }
  changeVolume() { return ''; }
  names() { return this.played.map((p) => p.name); }
}

function make(rows: string[], seed?: number) {
  const s = makeState(rows);
  if (seed !== undefined) s.rngState = seed;
  const sound = new RecordingSound();
  return { c: new Controller(s, createUiState('p1'), new Effects(), sound), sound };
}

describe('controller sounds', () => {
  it('a visible rifle kill plays the shot, the thud, the death and the win jingle in order', () => {
    const { c, sound } = make(corridorRows('P..E'), seedForRoll((n) => n < 0.05));
    unit(c.state, 'e1').hp = 30; // one rifle hit (30 damage) kills
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(sound.played).toEqual([
      { name: 'rifle', volume: 1 },
      { name: 'hit', volume: 0.8 },
      { name: 'deathEnemy', volume: 1 },
      { name: 'win', volume: 0.9 },
    ]);
  });

  it('a refused shot with an empty gun plays the dry click, once', () => {
    const { c, sound } = make(corridorRows('P..E'));
    unit(c.state, 'p1').ammo = 0;
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(sound.played).toEqual([{ name: 'empty', volume: 0.9 }]);
  });

  it('any other rejected command plays the error buzz, once', () => {
    const { c, sound } = make(corridorRows('P..E'));
    expect(c.run({ type: 'Reload', unitId: 'p1' })).toBe(false); // the magazine is already full
    expect(sound.played).toEqual([{ name: 'error', volume: 0.9 }]);
  });

  it('a successful command never plays the error buzz', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.key('q'); // turn left: no sound
    unit(c.state, 'p1').ammo = 1;
    c.key('r'); // reload
    expect(sound.names()).toEqual(['reload']);
  });

  it('the player own pickup is audible even though the visibility test ignores it', () => {
    const { c, sound } = make(corridorRows('P..E'));
    const p = unit(c.state, 'p1');
    p.weapon = 'pistol';
    c.state.items.push({ id: 'i1', pos: { ...p.pos }, kind: 'rifle' });
    c.key('p');
    expect(sound.played).toEqual([{ name: 'pickup', volume: 1 }]);
  });

  it('going on alert makes the alert sound', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.key('l');
    expect(sound.played).toEqual([{ name: 'alert', volume: 1 }]);
  });

  it('a door opened by an enemy out of sight is heard quietly', () => {
    const s = makeState(corridorRows('P....E+.'));
    unit(s, 'p1').facing = 6; // facing west: the door behind him is out of sight
    s.turn = 'enemy';
    const sound = new RecordingSound();
    const c = new Controller(s, createUiState('p1'), new Effects(), sound);
    expect(c.run({ type: 'OpenDoor', unitId: 'e1', at: { x: 7, y: 1 } })).toBe(true);
    expect(sound.played).toEqual([{ name: 'door', volume: 0.35 }]);
  });

  it('out-of-sight enemy footsteps are silent', () => {
    const s = makeState(corridorRows('P...E.'));
    unit(s, 'p1').facing = 6;
    s.turn = 'enemy';
    const sound = new RecordingSound();
    const c = new Controller(s, createUiState('p1'), new Effects(), sound);
    expect(c.run({ type: 'Move', unitId: 'e1', to: { x: 4, y: 1 } })).toBe(true);
    expect(sound.played).toEqual([]);
  });

  it('works without a sound player', () => {
    const c = new Controller(makeState(corridorRows('P..E')), createUiState('p1'), new Effects());
    expect(() => { c.key('q'); c.run({ type: 'Reload', unitId: 'p1' }); }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/soundcontroller.test.ts`
Expected: FAIL (the controller does not take or play a sound; the recorded lists are empty).

- [ ] **Step 3: Implement**

In `src/controller.ts`:
- Add imports: `import { soundsFor } from './audio/mapping';` and `import type { SoundPlayer } from './audio/sound';`
- Constructor: add a fourth parameter: `private sound: SoundPlayer | null = null,` after `public effects: Effects,`.
- Replace `run` with:

```ts
  run(cmd: Command): boolean {
    const r = applyCommand(this.state, cmd);
    if (!r.ok) {
      this.say(r.reason);
      this.sound?.play(r.reason === 'Out of ammo' ? 'empty' : 'error', 0.9);
      return false;
    }
    const before = this.state;
    this.state = r.state;
    const flags = r.events.map((ev) => this.eventVisible(ev, before, r.state));
    this.lastVisible = flags.some(Boolean);
    this.effects.add(r.events, performance.now());
    if (this.sound) {
      r.events.forEach((ev, i) => {
        for (const hit of soundsFor(ev, r.state, flags[i] || this.isOwn(ev, r.state))) {
          this.sound!.play(hit.name, hit.volume);
        }
      });
    }
    for (const ev of r.events) this.onEvent(ev);
    if (!this.selected()) this.selectFirstAlive();
    this.updatePreview();
    return true;
  }

  /** True for an event made by one of the player's own soldiers (always audible to the player). */
  private isOwn(ev: GameEvent, state: GameState): boolean {
    if (!('unitId' in ev)) return false;
    return state.units.find((u) => u.id === ev.unitId)?.side === 'player';
  }
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. If the out-of-sight door or footstep test sees a sound, the soldier can still see the event: confirm `facing = 6` makes `canSee` return false for tiles east of the soldier (`vision.ts`: tiles with a negative dot product with the facing vector are not seen).

- [ ] **Step 5: Commit**

```bash
git add src/controller.ts tests/soundcontroller.test.ts
git commit -m "feat: the controller plays the sounds for each command's events

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: App wiring (unlock, M and volume keys, interface clicks, hints)

**Files:**
- Modify: `src/app.ts`, `src/render/panel.ts`
- Test: `tests/soundapp.test.ts`

**Interfaces:**
- Consumes: `Sound`, `SoundPlayer` (Task 3); `Controller` fourth parameter (Task 4).
- Produces: `AppOptions.sound?: SoundPlayer`; public `App.sound: SoundPlayer` (default `new Sound()`); `App.click` and `App.key` call `sound.unlock()` first; keys `m`/`M` toggle mute, `-` lowers and `=`/`+` raises the volume by 0.1 on every screen (these keys are consumed by the app and never reach the controller); a `click` sound plays when an equipment control changes the loadout and when Start, Continue or New campaign takes effect; a transient notice (the text returned by `toggleMute`/`changeVolume`) is drawn top-right for 1.5 s on every screen; on every non-mission screen a small grey hint `M: sound on/off   - =: volume` is drawn bottom-right; the panel hint line reads `1-4 sel  Q/E turn  Esc  M mute`.

- [ ] **Step 1: Write the failing tests**

Create `tests/soundapp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SoundName } from '../src/audio/effects';
import type { SoundPlayer } from '../src/audio/sound';
import { App, type AppOptions } from '../src/app';
import type { GameState } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { drawPanel } from '../src/render/panel';
import { corridorRows, makeState } from './helpers';

const START = { x: 240, y: 315 };
const CONTINUE = { x: 240, y: 235 };

class FakeSound implements SoundPlayer {
  played: SoundName[] = [];
  unlocks = 0;
  mutes = 0;
  deltas: number[] = [];
  muted = false;
  volume = 0.5;
  play(name: SoundName) { this.played.push(name); }
  unlock() { this.unlocks += 1; }
  toggleMute() { this.mutes += 1; return 'Sound off'; }
  changeVolume(d: number) { this.deltas.push(d); return 'Volume 60%'; }
}

const winTiny = (): GameState => makeState(corridorRows('P..'));

function make(opts: AppOptions = {}) {
  let t = 0;
  const sound = new FakeSound();
  const app = new App({ clock: () => t, sound, ...opts });
  return { app, sound, wait: () => { t += 500; } };
}

/** A canvas stand-in that records the text drawn. */
function recorder() {
  const texts: { text: string; x: number }[] = [];
  const ctx = new Proxy({}, {
    get: (_t, prop) => (prop === 'fillText' ? (text: string, x: number) => { texts.push({ text, x }); } : () => ({ width: 0 })),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

describe('unlocking audio', () => {
  it('the first click and the first key press unlock the audio', () => {
    const { app, sound } = make();
    app.click({ x: 5, y: 5 });
    expect(sound.unlocks).toBe(1);
    app.key('x');
    expect(sound.unlocks).toBe(2);
  });
});

describe('sound keys', () => {
  it('M toggles mute on the equipment screen and during a mission', () => {
    const { app, sound, wait } = make({ createMission: winTiny });
    expect(app.key('m')).toBe(true);
    expect(app.key('M')).toBe(true);
    expect(sound.mutes).toBe(2);
    app.click(START);
    wait();
    expect(app.screen).toBe('mission');
    expect(app.key('m')).toBe(true);
    expect(sound.mutes).toBe(3);
  });

  it('- lowers and = or + raises the volume by 0.1', () => {
    const { app, sound } = make();
    app.key('-');
    app.key('=');
    app.key('+');
    expect(sound.deltas).toEqual([-0.1, 0.1, 0.1]);
  });

  it('other keys still reach the controller: K enters stab mode', () => {
    const { app, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    app.key('k');
    expect(app.controller!.ui.mode).toBe('stab');
  });

  it('shows the message for a moment on any screen', () => {
    const { app } = make();
    app.key('m');
    const { ctx, texts } = recorder();
    app.draw(ctx, 0);
    expect(texts.some((t) => t.text === 'Sound off')).toBe(true);
  });

  it('shows the key hint on the equipment screen but not during a mission', () => {
    const { app, wait } = make({ createMission: winTiny });
    let r = recorder();
    app.draw(r.ctx, 0);
    expect(r.texts.some((t) => t.text.includes('M: sound on/off'))).toBe(true);
    app.click(START);
    wait();
    r = recorder();
    app.draw(r.ctx, 0);
    expect(r.texts.some((t) => t.text.includes('M: sound on/off'))).toBe(false);
  });
});

describe('interface clicks', () => {
  it('plays a click only when an equipment control changes the loadout', () => {
    const { app, sound, wait } = make();
    app.click({ x: 100, y: 172 }); // P3 pistol to rifle: allowed
    expect(sound.played).toEqual(['click']);
    wait();
    app.click({ x: 100, y: 224 }); // P4 pistol to rifle: blocked (not enough credits)
    expect(sound.played).toEqual(['click']);
    wait();
    app.click({ x: 5, y: 5 }); // empty space
    expect(sound.played).toEqual(['click']);
  });

  it('plays a click for Start and Continue (with the win jingle in between)', () => {
    const { app, sound, wait } = make({ createMission: winTiny });
    app.click(START);
    expect(sound.played).toEqual(['click']);
    app.controller!.key('e'); // end the turn: the tiny map has no enemies, so the mission is won
    app.update(1000);
    app.update(2100);
    wait();
    app.click(CONTINUE);
    expect(sound.played).toEqual(['click', 'win', 'click']); // Start, the win jingle when the mission ends, Continue
  });

  it('passes the sound player to the controller', () => {
    const { app, sound, wait } = make({ createMission: winTiny });
    app.click(START);
    wait();
    sound.played.length = 0;
    app.controller!.run({ type: 'Reload', unitId: 'p1' }); // rejected: the magazine is full
    expect(sound.played).toEqual(['error']);
  });
});

describe('panel hint', () => {
  it('shows the mute key and stays clear of the buttons', () => {
    const s = makeState(corridorRows('P..E'));
    const ui = createUiState('p1');
    const { ctx, texts } = recorder();
    drawPanel(ctx, s, ui, 0);
    const hint = texts.find((t) => t.text.includes('M mute'))!;
    expect(hint).toBeDefined();
    expect(hint.x + hint.text.length * 4.8).toBeLessThanOrEqual(172);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/soundapp.test.ts`
Expected: FAIL (`App` has no `sound` option; no unlock, no keys).

- [ ] **Step 3: Implement**

`src/render/panel.ts`: change the hint line `ctx.fillText('1-4 select  Q/E turn  Esc cancel', 4, top + 28);` to `ctx.fillText('1-4 sel  Q/E turn  Esc  M mute', 4, top + 28);`

`src/app.ts`:
- Imports: `import { Sound, type SoundPlayer } from './audio/sound';` and `import { VIEW } from './render/layout';` (change the existing `screenToTile` import line to `import { VIEW, screenToTile } from './render/layout';`).
- `AppOptions`: add `sound?: SoundPlayer;`
- Fields: `readonly sound: SoundPlayer;` and `private noticeText = ''; private noticeUntil = 0;`
- Constructor: `this.sound = opts.sound ?? new Sound();`
- Add:

```ts
  private notice(text: string): void {
    this.noticeText = text;
    this.noticeUntil = this.clock() + 1500;
  }

  /** Sound keys work on every screen: M mutes, - and = change the volume. */
  private soundKey(k: string): boolean {
    if (k === 'm' || k === 'M') this.notice(this.sound.toggleMute());
    else if (k === '-') this.notice(this.sound.changeVolume(-0.1));
    else if (k === '=' || k === '+') this.notice(this.sound.changeVolume(0.1));
    else return false;
    return true;
  }
```

- `startMission`: pass the sound to the controller (`new Controller(state, createUiState('p1'), new Effects(), this.sound)`) and add `this.sound.play('click', 0.9);` after `this.lock();`.
- `continueFromResult` and `newCampaignScreen`: add `this.sound.play('click', 0.9);` after their `this.lock();` line.
- `click`: add `this.sound.unlock();` as the first line (before the `locked()` check). In the equipment branch replace `this.loadout = applyEquipmentHit(this.loadout, hit, this.budget(), this.campaign.stash);` with:

```ts
        const next = applyEquipmentHit(this.loadout, hit, this.budget(), this.campaign.stash);
        if (next !== this.loadout) this.sound.play('click', 0.9);
        this.loadout = next;
```

- `key`: add `this.sound.unlock();` as the first line, and right after the existing `if (repeat && k === 'Enter') return true;` line add `if (this.soundKey(k)) return true;`.
- Rename the existing `draw` method to `private drawScreen(ctx, now)` and add:

```ts
  draw(ctx: CanvasRenderingContext2D, now: number): void {
    this.drawScreen(ctx, now);
    this.drawSoundHint(ctx);
  }

  private drawSoundHint(ctx: CanvasRenderingContext2D): void {
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    if (this.clock() < this.noticeUntil) {
      ctx.fillStyle = '#ffe14d';
      ctx.fillText(this.noticeText, VIEW.width - 6, 4);
    } else if (this.screen !== 'mission') {
      ctx.fillStyle = '#6a6f88';
      ctx.fillText('M: sound on/off   - =: volume', VIEW.width - 6, VIEW.height - 12);
    }
    ctx.textAlign = 'left';
  }
```

(`this.noticeUntil` starts at 0 and the injected test clock starts at 0, so the first draw shows the hint; after a key the notice shows until the clock passes it. In the test "shows the key hint on the equipment screen" the clock is 0 and `noticeUntil` is 0, so `0 < 0` is false and the hint shows.)

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all pass. The existing `app.test.ts` tests construct `App` without a sound option; the default `Sound` has no audio engine under Node, so they are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src tests/soundapp.test.ts
git commit -m "feat: sound keys, unlock on first gesture, interface clicks and hints

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and end-to-end check

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Read `README.md`. In the Controls table add rows `| M | Mute or unmute sound |` and `| - and = | Lower and raise the volume |`. Add a short "Sound" paragraph: effects are generated in the browser (no sound files), gunfire, explosions, doors and deaths out of sight are heard quietly, and mute and volume are remembered.

- [ ] **Step 2: Full verification**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 3: Check it in the browser**

Start the dev server with `preview_start` (`laser-tribute`). The pane has no speakers, so check behavior, not sound quality:
1. Reload the page and read the console: no errors. Before any click, `app.sound` exists but no `AudioContext` has been created (`app.sound.ctx` is null; it is private, so read it with `(app.sound as any).ctx`).
2. Click once on the canvas (`app.click({x:5,y:5})`): the context now exists and its `state` is `running` or `suspended` (report which).
3. Call every sound name through `app.sound.play(name)` in a loop: no exceptions, and `(app.sound as any).ends.length` stays at most 12.
4. Press `m` via `app.key('m')`: `app.sound.muted` is true, `localStorage.getItem('laser-tribute-sound')` shows `"muted":true`, a second `m` restores it. Press `=` and `-` and check the stored volume changes by 0.1.
5. Take a screenshot of the equipment screen right after pressing `m`: the notice "Sound off" is top-right and the hint `M: sound on/off   - =: volume` is bottom-right and does not overlap anything.
6. Start a mission and screenshot the panel: the hint line reads `1-4 sel  Q/E turn  Esc  M mute` and is clear of the buttons.
Report what you saw, and say plainly that the sound quality itself is for Rui to judge by ear. Stop the server with `preview_stop`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: describe sound and the M and volume keys

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** the 18 sounds and their recipes (Task 1); event mapping, out-of-sight volumes, step and impact levels, interface and jingle volumes (Task 2); the `Sound` class with unlock, no-engine, mute, master volume, persistence with try/catch, the 12-voice cap and fade-out (Task 3); controller playback, `empty` versus `error`, own events audible (Task 4); `M`, `-`, `=`/`+` on every screen, clicks for equipment/Start/Continue/New campaign, unlock on first gesture, on-screen notice and hint, panel hint (Task 5); README and a browser check (Task 6). Deviations from the spec: the on-screen notice is drawn top-right on every screen (the spec said the mission status line); the controller passes `audible = visible or own` so the mapping needs no knowledge of sides for pickups and alerts; `stab` is silent out of sight (the spec's list of quiet-out-of-sight events did not include it).

**Placeholders:** none; every step has the actual code or the exact edit.

**Type consistency:** `SoundName`/`SOUND_NAMES`, `Segment`, `EFFECTS`, `effectDuration` (Task 1) are used by `soundsFor` (Task 2) and `Sound` (Task 3); `SoundPlayer` (Task 3) is the type of the controller's fourth parameter (Task 4) and of `AppOptions.sound` and `App.sound` (Task 5); `VOLUME` levels match the Global Constraints.

**Review Focus coverage:** locked, muted and no-engine states and corrupt storage (Task 3), own pickups and alerts audible with out-of-sight rules (Tasks 2 and 4), the voice cap (Task 3), the keys on every screen without leaking to the controller (Task 5), a single sound per rejected command and no error on success (Task 4).
