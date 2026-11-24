import { describe, expect, it, vi } from 'vitest';
import { BUSES, EFFECTS, SOUND_NAMES, STINGERS, STINGER_BUS, STINGER_NAMES, stingerDuration } from '../src/audio/effects';
import { Music } from '../src/audio/music';
import { Sound, type AudioContextLike } from '../src/audio/sound';

function fakeContext() {
  const counts = { osc: 0, noise: 0 };
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    createOscillator: () => {
      counts.osc += 1;
      return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    },
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => {
      counts.noise += 1;
      return { buffer: null, connect() {}, start() {}, stop() {} };
    },
  };
  return { ctx, counts, at: (t: number) => { ctx.currentTime = t; } };
}
const store = { getItem: () => null, setItem() {} };
const timer = () => {
  let fn: (() => void) | null = null;
  return { schedule: (f: () => void) => { fn = f; return () => { fn = null; }; }, tick: () => fn?.() };
};
const sound = (f: ReturnType<typeof fakeContext>, schedule: ((f: () => void, ms: number) => () => void) | null = null) =>
  new Sound(() => f.ctx as unknown as AudioContextLike, store, () => 0.3, schedule);
const tones = (name: 'victory' | 'defeat') => STINGERS[name].filter((s) => s.wave !== 'noise').length;
const noises = (name: 'victory' | 'defeat') => STINGERS[name].filter((s) => s.wave === 'noise').length;

describe('the stinger table', () => {
  it('has both stingers with sensible lengths and gains', () => {
    expect([...STINGER_NAMES]).toEqual(['victory', 'defeat']);
    expect(stingerDuration('victory')).toBeGreaterThanOrEqual(2.8);
    expect(stingerDuration('victory')).toBeLessThanOrEqual(3.6);
    expect(stingerDuration('defeat')).toBeGreaterThanOrEqual(3.0);
    expect(stingerDuration('defeat')).toBeLessThanOrEqual(4.0);
    for (const name of STINGER_NAMES) {
      for (const seg of STINGERS[name]) {
        expect(seg.from, name).toBeGreaterThan(0);
        expect(seg.to, name).toBeGreaterThan(0);
        expect(seg.gain, name).toBeLessThanOrEqual(0.5);
        expect(seg.start, name).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('victory climbs through four notes, and defeat falls through four', () => {
    // the melody notes: triangles above 200 Hz that start before the chord (victory) or the low tone (defeat)
    const notes = (name: 'victory' | 'defeat', until: number) =>
      STINGERS[name].filter((s) => s.wave === 'triangle' && s.from > 200 && s.start <= until).sort((a, b) => a.start - b.start).map((s) => s.from);
    expect(notes('victory', 0.7)).toEqual([293.66, 440, 587.33, 739.99]);
    expect(notes('defeat', 1.55)).toEqual([440, 349.23, 293.66, 220]);
  });

  it('sits on the interface bus and is not a mission effect', () => {
    expect(BUSES).toContain(STINGER_BUS);
    for (const name of STINGER_NAMES) {
      expect(SOUND_NAMES as readonly string[]).not.toContain(name);
      expect(Object.keys(EFFECTS)).not.toContain(name);
    }
  });
});

describe('playing a stinger', () => {
  it('plays every tone and noise burst of the stinger once unlocked', () => {
    for (const name of STINGER_NAMES) {
      const f = fakeContext();
      const s = sound(f);
      s.unlock();
      s.stinger(name);
      expect(f.counts.osc, name).toBe(tones(name));
      expect(f.counts.noise, name).toBe(noises(name));
    }
  });

  it('does nothing before the first gesture, when muted, or at volume zero, and never throws', () => {
    const early = fakeContext();
    expect(() => sound(early).stinger('victory')).not.toThrow();
    expect(early.counts.osc).toBe(0);
    const muted = fakeContext();
    const m = sound(muted);
    m.unlock();
    m.toggleMute();
    m.stinger('victory');
    expect(muted.counts.osc).toBe(0);
    const quiet = fakeContext();
    const q = sound(quiet);
    q.unlock();
    q.changeVolume(-1);
    q.stinger('defeat');
    expect(quiet.counts.osc).toBe(0);
  });

  it('ignores a second stinger while one is playing, and plays again once it is over', () => {
    const f = fakeContext();
    const s = sound(f);
    s.unlock();
    s.stinger('victory');
    s.stinger('defeat');
    expect(f.counts.osc).toBe(tones('victory'));
    f.at(stingerDuration('victory') + 0.1);
    s.stinger('defeat');
    expect(f.counts.osc).toBe(tones('victory') + tones('defeat'));
  });

  it('ducks the music for the stinger when there is music, and still plays without it', () => {
    const f = fakeContext();
    const t = timer();
    const duck = vi.spyOn(Music.prototype, 'duck');
    const s = sound(f, t.schedule);
    s.unlock();
    s.stinger('victory');
    expect(duck).toHaveBeenCalledTimes(1);
    expect(duck).toHaveBeenCalledWith(stingerDuration('victory'));
    duck.mockRestore();
    const g = fakeContext();
    const plain = sound(g);
    plain.unlock();
    expect(() => plain.stinger('victory')).not.toThrow();
    expect(g.counts.osc).toBe(tones('victory'));
  });
});
