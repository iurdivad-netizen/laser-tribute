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
