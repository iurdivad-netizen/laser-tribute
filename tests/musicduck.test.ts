import { describe, expect, it } from 'vitest';
import { MUSIC_GAIN, Music } from '../src/audio/music';
import type { AudioContextLike } from '../src/audio/sound';

type Event = { kind: 'set' | 'ramp'; value: number; time: number };

/** A gain parameter that evaluates its automation like the Web Audio timeline does (set, exponential ramp, cancel). */
class Timeline {
  events: Event[] = [];
  setValueAtTime(value: number, time: number) { this.events.push({ kind: 'set', value, time }); }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push({ kind: 'ramp', value, time }); }
  cancelScheduledValues(time: number) { this.events = this.events.filter((e) => e.time < time); }
  valueAt(t: number): number {
    const sorted = [...this.events].sort((a, b) => a.time - b.time);
    let value = 0.0001;
    let at = -Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (e.time <= t) {
        value = e.value;
        at = e.time;
        continue;
      }
      if (e.kind === 'ramp') return value * (e.value / value) ** ((t - Math.max(at, -1e9)) / (e.time - at));
      break;
    }
    return value;
  }
}

function make() {
  const params: Timeline[] = [];
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    createOscillator: () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }),
    createGain: () => {
      const gain = new Timeline();
      params.push(gain);
      return { gain, connect() {} };
    },
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
  };
  const music = new Music(ctx as unknown as AudioContextLike, {}, () => null, () => 0.3, () => () => undefined);
  music.setLevel(0.5);
  const out = params[0];
  return { music, out, at: (t: number) => { ctx.currentTime = t; } };
}
const FULL = 0.5 * MUSIC_GAIN;

describe('changing the level during a duck', () => {
  it('stays silent when muted during a duck: the old recovery must not bring the music back', () => {
    const { music, out, at } = make();
    at(10);
    music.duck(3.2);
    at(11);
    music.setLevel(0);
    for (const t of [11.5, 12, 13.3, 14.5, 15, 20]) expect(out.valueAt(t), `t=${t}`).toBeLessThan(0.001);
  });

  it('ends at the new level when the volume is lowered during a duck', () => {
    const { music, out, at } = make();
    at(10);
    music.duck(3.2);
    at(11);
    music.setLevel(0.1);
    const low = 0.1 * MUSIC_GAIN;
    expect(out.valueAt(12)).toBeCloseTo(low * 0.3, 4); // still ducked, at the new level
    expect(out.valueAt(15)).toBeCloseTo(low, 4); // and recovered to the new level, not the old one
    expect(out.valueAt(30)).toBeCloseTo(low, 4);
  });

  it('keeps the duck going when the sound is unmuted during the hold', () => {
    const { music, out, at } = make();
    at(10);
    music.duck(3.2);
    at(10.5);
    music.setLevel(0);
    at(11);
    music.setLevel(0.5);
    expect(out.valueAt(12)).toBeCloseTo(FULL * 0.3, 4);
    expect(out.valueAt(15)).toBeCloseTo(FULL, 4);
  });

  it('sets the level at once when no duck is playing, and does not revive a finished duck', () => {
    const { music, out, at } = make();
    expect(out.valueAt(0.1)).toBeCloseTo(FULL, 5);
    at(10);
    music.duck(1);
    at(20);
    music.setLevel(0.2);
    expect(out.valueAt(20.5)).toBeCloseTo(0.2 * MUSIC_GAIN, 5);
    expect(out.valueAt(30)).toBeCloseTo(0.2 * MUSIC_GAIN, 5);
  });
});
