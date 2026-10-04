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
