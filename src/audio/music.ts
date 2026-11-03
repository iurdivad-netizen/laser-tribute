import type { AudioContextLike } from './sound';

/** The soundtrack has two moods: a slow mystery while the squad explores, and a driving beat while an enemy is in sight. */
export type Mood = 'calm' | 'action';

/** How long the squad must go without seeing an enemy before the music relaxes, so an enemy ducking in and out of view does not flicker it. */
export const CALM_DELAY_MS = 4000;

/** Decides the mood from whether any enemy is visible, with a delay before the way back to calm. */
export class MoodTracker {
  mood: Mood = 'calm';
  private lastSeen = -Infinity;

  update(enemyVisible: boolean, now: number): Mood {
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
/** The music sits under the sound effects: this scales the player's volume setting. */
export const MUSIC_GAIN = 0.5;

// D phrygian: the flat second gives the calm theme its unease.
const MELODY = [293.66, 311.13, 349.23, 392, 440, 466.16, 523.25, 587.33];
const DRONE = [73.42, 110, 146.83];
const BASS_A = [73.42, 73.42, 73.42, 73.42, 87.31, 73.42, 65.41, 73.42];
const BASS_B = [73.42, 73.42, 73.42, 77.78, 73.42, 73.42, 58.27, 65.41];
const ARP = [293.66, 349.23, 440, 349.23];
const STEP = 60 / 138 / 4; // sixteenth notes at 138 bpm
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
    this.layers = { calm: make(true), action: make(false) };
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
    this.out.gain.setValueAtTime(Math.max(SILENT, this.level), this.ctx.currentTime);
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    const now = this.ctx.currentTime;
    const dur = mood === 'action' ? FADE_TO_ACTION : FADE_TO_CALM;
    for (const m of ['calm', 'action'] as const) this.fade(this.layers[m], m === mood ? 1 : SILENT, now, dur);
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
    for (const m of ['calm', 'action'] as const) {
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
      while (layer.next < horizon) layer.next = m === 'calm' ? this.calmBar(layer, layer.next) : this.actionStep(layer);
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

  /** One sixteenth of the action loop: kick, hats, a driving bass and an arpeggio. */
  private actionStep(layer: Layer): number {
    const t = layer.next;
    const s = layer.step % STEPS_PER_LOOP;
    const bar = s < 16 ? 0 : 1;
    const i = s % 16;
    if (i % 4 === 0 || (bar === 1 && i === 10)) this.blip(layer, 'sine', 130, 42, t, 0.16, 0.5);
    if (i % 4 === 2) this.hat(layer, t, 0.12, 0.04);
    else if (i % 2 === 1) this.hat(layer, t, 0.05, 0.025);
    if (i % 2 === 0) this.blip(layer, 'square', (bar === 0 ? BASS_A : BASS_B)[i / 2], 0, t, 0.11, 0.07);
    if (i % 2 === 1 && this.random() < 0.8) this.blip(layer, 'square', ARP[(i >> 1) % ARP.length] * (bar === 1 ? 1.122 : 1), 0, t, 0.07, 0.025);
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
