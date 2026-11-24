import type { AudioContextLike } from './sound';

/** The moods a fight can have: a slow mystery while the squad explores, and a driving beat while an enemy is in sight. */
export type FightMood = 'calm' | 'action';
/** The soundtrack's moods: the two fight moods, and the story's calm planet theme and dark base theme. */
export type Mood = FightMood | 'planet' | 'base';
export const MOODS: readonly Mood[] = ['calm', 'action', 'planet', 'base'];

/** How long the squad must go without seeing an enemy before the music relaxes, so an enemy ducking in and out of view does not flicker it. */
export const CALM_DELAY_MS = 4000;

/** Decides the mood from whether any enemy is visible, with a delay before the way back to calm. */
export class MoodTracker {
  mood: FightMood = 'calm';
  private lastSeen = -Infinity;

  update(enemyVisible: boolean, now: number): FightMood {
    if (enemyVisible) {
      this.lastSeen = now;
      this.mood = 'action';
    } else if (this.mood === 'action' && now - this.lastSeen >= CALM_DELAY_MS) {
      this.mood = 'calm';
    }
    return this.mood;
  }
}

/** Calls fn every ms until the returned function is called. */
export type Scheduler = (fn: () => void, ms: number) => () => void;

export function browserScheduler(): Scheduler | null {
  if (typeof window === 'undefined') return null;
  return (fn, ms) => {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  };
}

const TICK_MS = 120;
/** Notes are handed to the audio clock this far ahead, so a late timer tick does not make the music stutter. */
const LOOKAHEAD = 0.6;
const SILENT = 0.0001;
export const FADE_TO_ACTION = 1;
export const FADE_TO_CALM = 2.5;
/** The story themes ease in and out slowly. */
export const FADE_TO_PLANET = 2.5;
export const FADE_TO_BASE = 2.5;
/** A stinger dips the music to this fraction of its level for the stinger's length, then it recovers over `DUCK_RECOVER` seconds. */
export const DUCK_DEPTH = 0.3;
export const DUCK_RECOVER = 1;
const DUCK_DIP = 0.15;
/** The music sits under the sound effects: this scales the player's volume setting. */
export const MUSIC_GAIN = 0.5;

// D phrygian: the flat second gives the calm theme its unease.
const MELODY = [293.66, 311.13, 349.23, 392, 440, 466.16, 523.25, 587.33];
const DRONE = [73.42, 110, 146.83];
const BASS_A = [73.42, 73.42, 73.42, 73.42, 87.31, 73.42, 65.41, 73.42];
const BASS_B = [73.42, 73.42, 73.42, 77.78, 73.42, 73.42, 58.27, 65.41];
const ARP = [293.66, 349.23, 440, 349.23];
// The lead line: [sixteenth, Hz] pairs over each bar, climbing down the scale and answering itself in the second bar.
const LEAD: [number, number][][] = [
  [[0, 587.33], [3, 587.33], [6, 523.25], [8, 466.16], [10, 440], [12, 466.16], [14, 523.25]],
  [[0, 587.33], [3, 622.25], [6, 587.33], [8, 523.25], [10, 466.16], [12, 440], [14, 392]],
];
const STEP = 60 / 138 / 4; // sixteenth notes at 138 bpm

// The planet theme: slow and open, D dorian, no drums. A pad of open fifths, a few plucked notes with long echoes, a breath of wind.
const PLANET_PAD = [146.83, 220, 293.66];
const PLANET_PAD_PEAK = 0.08;
const PLANET_PAD_LEN = 10;
const PLANET_PAD_EDGE = 3;
const PLANET_BAR = 8; // the next 10 s pad starts before this one ends
const PLANET_SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33];
const PLANET_PLUCK_CHANCE = 0.6;
const PLANET_PLUCK_PEAK = 0.09;
const PLANET_WIND_BURSTS = 8;
const PLANET_WIND_PEAK = 0.012;

// The base theme: low, close and a little menacing. A deep drone, a minor second now and then, a slow pulse, distant metal. No melody.
const BASE_DRONE = [36.71, 73.42];
const BASE_DRONE_PEAKS = [0.12, 0.09];
const BASE_DRONE_LEN = 9;
const BASE_DRONE_EDGE = 3;
const BASE_BAR = 7.2;
const BASE_PULSE_GAP = 1.8;
const BASE_PULSES = 4;
const BASE_PULSE_PEAK = 0.3;
const BASE_CLASH = [73.42, 77.78]; // D and E flat
const BASE_CLASH_PEAK = 0.05;
const BASE_CLASH_LEN = 6;
const BASE_PING_CHANCE = 0.4;
const BASE_PING_PARTIALS: [number, number][] = [[1, 0.05], [2.76, 0.03], [5.4, 0.015]];
const BASE_PING_LEN = 3;
const STEPS_PER_LOOP = 32;

interface Dest {
  connect(to: unknown): unknown;
}
interface Gain extends Dest {
  gain: {
    setValueAtTime(value: number, time: number): unknown;
    exponentialRampToValueAtTime(value: number, time: number): unknown;
    cancelScheduledValues?(time: number): unknown;
  };
}
interface Layer {
  gain: Gain;
  /** The fade in progress: the level was `from` at `t0` and reaches `to` at `t1` (exponentially). */
  from: number;
  to: number;
  t0: number;
  t1: number;
  /** Where the next phrase starts on the audio clock; 0 while the layer is not being scheduled. */
  next: number;
  step: number;
}

export class Music {
  private readonly layers: Record<Mood, Layer>;
  private bars = 0;
  /** When the duck now playing stops holding the music low (audio clock); -Infinity when there is none. */
  private duckUntil = -Infinity;
  private readonly out: Gain;
  private mood: Mood = 'calm';
  private level = 0;
  private stop: (() => void) | null = null;

  constructor(
    private readonly ctx: AudioContextLike,
    destination: unknown,
    private readonly noise: () => unknown,
    private readonly random: () => number,
    private readonly schedule: Scheduler,
  ) {
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(SILENT, ctx.currentTime);
    this.out.connect(destination);
    const make = (on: boolean): Layer => {
      const gain = ctx.createGain();
      const v = on ? 1 : SILENT;
      gain.gain.setValueAtTime(v, ctx.currentTime);
      gain.connect(this.out);
      return { gain, from: v, to: v, t0: -Infinity, t1: -Infinity, next: 0, step: 0 };
    };
    this.layers = { calm: make(true), action: make(false), planet: make(false), base: make(false) };
  }

  start(): void {
    if (!this.stop) this.stop = this.schedule(() => this.tick(), TICK_MS);
  }

  halt(): void {
    this.stop?.();
    this.stop = null;
  }

  /** 0 silences the music (mute); otherwise the player's volume setting. */
  setLevel(volume: number): void {
    this.level = volume * MUSIC_GAIN;
    const now = this.ctx.currentTime;
    const p = this.out.gain;
    p.cancelScheduledValues?.(now); // a duck in progress must not bring the music back to the old level
    if (this.level > 0 && now < this.duckUntil) {
      // the duck is still holding: keep its shape, at the new level
      const low = Math.max(SILENT, this.level * DUCK_DEPTH);
      p.setValueAtTime(low, now);
      p.setValueAtTime(low, this.duckUntil);
      p.exponentialRampToValueAtTime(Math.max(SILENT, this.level), this.duckUntil + DUCK_RECOVER);
    } else {
      p.setValueAtTime(Math.max(SILENT, this.level), now);
    }
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    const now = this.ctx.currentTime;
    const dur = { calm: FADE_TO_CALM, action: FADE_TO_ACTION, planet: FADE_TO_PLANET, base: FADE_TO_BASE }[mood];
    for (const m of MOODS) this.fade(this.layers[m], m === mood ? 1 : SILENT, now, dur);
  }

  private fade(layer: Layer, to: number, now: number, dur: number): void {
    const cur = this.levelAt(layer, now);
    const p = layer.gain.gain;
    p.cancelScheduledValues?.(now);
    p.setValueAtTime(cur, now);
    p.exponentialRampToValueAtTime(to, now + dur);
    Object.assign(layer, { from: cur, to, t0: now, t1: now + dur });
  }

  private levelAt(layer: Layer, now: number): number {
    if (now >= layer.t1) return layer.to;
    if (now <= layer.t0) return layer.from;
    const k = (now - layer.t0) / (layer.t1 - layer.t0);
    return layer.from * (layer.to / layer.from) ** k;
  }

  /** A layer is worth scheduling while it is audible or still fading out. */
  private audible(layer: Layer, now: number): boolean {
    return layer.to > 0.01 || now < layer.t1 + 0.5;
  }

  private tick(): void {
    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    for (const m of MOODS) {
      const layer = this.layers[m];
      if (this.level <= 0 || !this.audible(layer, now)) {
        layer.next = 0; // resume in time with the clock when it becomes audible again
        layer.step = 0;
        continue;
      }
      if (layer.next < now) {
        layer.next = now + 0.05;
        layer.step = 0;
      }
      while (layer.next < horizon) layer.next = this.generate(m, layer);
    }
  }

  /** The next phrase of a mood's layer; returns where the one after it starts. */
  private generate(mood: Mood, layer: Layer): number {
    switch (mood) {
      case 'calm': return this.calmBar(layer, layer.next);
      case 'action': return this.actionStep(layer);
      case 'planet': return this.planetBar(layer, layer.next);
      case 'base': return this.baseBar(layer, layer.next);
    }
  }

  /** One 8 second drone swell with a few sparse notes and their echoes; the next bar starts before this one ends. */
  private calmBar(layer: Layer, t: number): number {
    for (const f of DRONE) this.swell(layer, 'sine', f, t, 8, 0.1, 2.5);
    this.swell(layer, 'triangle', DRONE[0] * 1.004, t, 8, 0.05, 2.5); // slightly off: slow beating
    for (let i = 0; i < 3; i++) {
      if (this.random() > 0.55) continue;
      const f = MELODY[Math.floor(this.random() * MELODY.length)];
      const at = t + 0.5 + this.random() * 5;
      this.ping(layer, f, at, 0.1);
      this.ping(layer, f, at + 0.45, 0.04);
      this.ping(layer, f, at + 0.9, 0.02);
    }
    return t + 6;
  }

  /** One slow bar of the planet theme: an open-fifth pad, a few plucked notes with long echoes, and a faint wind. */
  private planetBar(layer: Layer, t: number): number {
    for (const f of PLANET_PAD) this.swell(layer, 'sine', f, t, PLANET_PAD_LEN, PLANET_PAD_PEAK, PLANET_PAD_EDGE);
    this.swell(layer, 'triangle', PLANET_PAD[1] * 1.003, t, PLANET_PAD_LEN, 0.03, PLANET_PAD_EDGE); // slightly off: slow beating
    for (let i = 0; i < PLANET_WIND_BURSTS; i++) {
      const at = t + i * 1.1;
      const env = Math.sin(((i + 0.5) / PLANET_WIND_BURSTS) * Math.PI); // the breath swells and falls over the bar
      this.hat(layer, at, 1.2, PLANET_WIND_PEAK * env);
    }
    for (let i = 0; i < 3; i++) {
      if (this.random() > PLANET_PLUCK_CHANCE) continue;
      const f = PLANET_SCALE[Math.floor(this.random() * PLANET_SCALE.length)];
      const at = t + 0.5 + this.random() * 6;
      this.ping(layer, f, at, PLANET_PLUCK_PEAK);
      this.ping(layer, f, at + 0.7, PLANET_PLUCK_PEAK * 0.45);
      this.ping(layer, f, at + 1.4, PLANET_PLUCK_PEAK * 0.2);
    }
    return t + PLANET_BAR;
  }

  /** One bar of the base theme: a deep drone, now and then a minor second, a slow pulse, and sometimes a distant metallic ping. */
  private baseBar(layer: Layer, t: number): number {
    BASE_DRONE.forEach((f, i) => this.swell(layer, 'sine', f, t, BASE_DRONE_LEN, BASE_DRONE_PEAKS[i], BASE_DRONE_EDGE));
    this.swell(layer, 'triangle', BASE_DRONE[1] * 1.006, t, BASE_DRONE_LEN, 0.04, BASE_DRONE_EDGE);
    if (this.bars++ % 2 === 1) {
      for (const f of BASE_CLASH) this.swell(layer, 'sine', f, t + 0.5, BASE_CLASH_LEN, BASE_CLASH_PEAK, 2);
    }
    for (let i = 0; i < BASE_PULSES; i++) this.blip(layer, 'sine', 60, 38, t + i * BASE_PULSE_GAP, 0.35, BASE_PULSE_PEAK);
    if (this.random() < BASE_PING_CHANCE) {
      const f = 600 + this.random() * 300;
      const at = t + 0.5 + this.random() * 5;
      for (const [ratio, peak] of BASE_PING_PARTIALS) this.blip(layer, 'sine', f * ratio, f * ratio, at, BASE_PING_LEN, peak);
    }
    return t + BASE_BAR;
  }

  /** Dips the music under a stinger of `seconds` seconds and brings it back. */
  duck(seconds: number): void {
    if (this.level <= 0) return;
    const now = this.ctx.currentTime;
    const p = this.out.gain;
    const low = Math.max(SILENT, this.level * DUCK_DEPTH);
    this.duckUntil = now + seconds;
    p.cancelScheduledValues?.(now);
    p.setValueAtTime(Math.max(SILENT, this.level), now);
    p.exponentialRampToValueAtTime(low, now + DUCK_DIP);
    p.setValueAtTime(low, now + seconds);
    p.exponentialRampToValueAtTime(Math.max(SILENT, this.level), now + seconds + DUCK_RECOVER);
  }

  /** One sixteenth of the action loop: kick, snare, hats, a driving bass with a sub, power-chord stabs, an arpeggio and a lead line. */
  private actionStep(layer: Layer): number {
    const t = layer.next;
    const s = layer.step % STEPS_PER_LOOP;
    const bar = s < 16 ? 0 : 1;
    const i = s % 16;
    if (i % 4 === 0 || (bar === 1 && i === 10)) this.blip(layer, 'sine', 140, 42, t, 0.22, 0.75);
    if (i === 4 || i === 12) {
      this.hat(layer, t, 0.16, 0.14);
      this.blip(layer, 'triangle', 220, 150, t, 0.1, 0.18);
    }
    if (i % 4 === 2) this.hat(layer, t, 0.12, 0.07);
    else if (i % 2 === 1) this.hat(layer, t, 0.05, 0.035);
    if (i % 2 === 0) {
      const root = (bar === 0 ? BASS_A : BASS_B)[i / 2];
      this.blip(layer, 'square', root, 0, t, 0.12, 0.15);
      this.blip(layer, 'sine', root / 2, 0, t, 0.14, 0.22);
    }
    if (i === 0 || i === 6 || i === 10) {
      const root = (bar === 0 ? BASS_A : BASS_B)[i / 2] * 2;
      this.blip(layer, 'square', root, 0, t, 0.3, 0.06);
      this.blip(layer, 'square', root * 1.498, 0, t, 0.3, 0.05); // a fifth above
    }
    if (i % 2 === 1 && this.random() < 0.85) this.blip(layer, 'square', ARP[(i >> 1) % ARP.length] * (bar === 1 ? 1.122 : 1), 0, t, 0.07, 0.05);
    const lead = LEAD[bar].find(([step]) => step === i);
    if (lead) this.blip(layer, 'sawtooth', lead[1], 0, t, 0.2, 0.06);
    layer.step += 1;
    return t + STEP;
  }

  /** A tone that swells in, holds, and fades out again over `len` seconds. */
  private swell(layer: Layer, wave: string, f: number, t: number, len: number, peak: number, edge: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peak, t + edge);
    g.gain.setValueAtTime(peak, t + len - edge);
    g.gain.exponentialRampToValueAtTime(SILENT, t + len);
    g.connect(layer.gain);
    this.osc(wave, f, f, t, len, g);
  }

  /** A soft bell-like note with a long decay. */
  private ping(layer: Layer, f: number, t: number, peak: number): void {
    this.blip(layer, 'sine', f, f, t, 2.2, peak);
  }

  /** A percussive tone: starts at its peak and dies away, optionally sliding from one pitch to another. */
  private blip(layer: Layer, wave: string, from: number, to: number, t: number, dur: number, peak: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    g.connect(layer.gain);
    this.osc(wave, from, to || from, t, dur, g);
  }

  private osc(wave: string, from: number, to: number, t: number, dur: number, g: Dest): void {
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(from, t);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(g);
    o.start(t);
    o.stop(t + dur);
  }

  private hat(layer: Layer, t: number, dur: number, peak: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    g.connect(layer.gain);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise();
    src.connect(g);
    src.start(t, this.random() * 0.8);
    src.stop(t + dur);
  }
}
