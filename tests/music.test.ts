import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { CALM_DELAY_MS, DUCK_DEPTH, DUCK_RECOVER, MOODS, MUSIC_GAIN, Music, MoodTracker, type Mood } from '../src/audio/music';
import { Sound, type AudioContextLike, type SoundPlayer } from '../src/audio/sound';
import { corridorRows, makeState } from './helpers';

function fakeContext() {
  const waves: string[] = [];
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    createOscillator() {
      const o = { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
      waves.push('?');
      return new Proxy(o, { set(t, k, v) { if (k === 'type') waves[waves.length - 1] = v as string; (t as Record<string | symbol, unknown>)[k] = v; return true; } });
    },
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
  };
  return { ctx, waves };
}

/** A timer the test runs by hand. */
function manualTimer() {
  let fn: (() => void) | null = null;
  return { schedule: (f: () => void) => { fn = f; return () => { fn = null; }; }, tick: () => fn?.(), running: () => fn !== null };
}

describe('mood tracker', () => {
  it('starts calm and turns to action as soon as an enemy is seen', () => {
    const t = new MoodTracker();
    expect(t.update(false, 0)).toBe('calm');
    expect(t.update(true, 100)).toBe('action');
  });

  it('stays on action until the enemy has been out of sight for the delay', () => {
    const t = new MoodTracker();
    t.update(true, 1000);
    expect(t.update(false, 1000 + CALM_DELAY_MS - 1)).toBe('action');
    expect(t.update(false, 1000 + CALM_DELAY_MS)).toBe('calm');
  });

  it('seeing an enemy again restarts the delay', () => {
    const t = new MoodTracker();
    t.update(true, 0);
    t.update(false, CALM_DELAY_MS - 1);
    t.update(true, CALM_DELAY_MS);
    expect(t.update(false, CALM_DELAY_MS * 2 - 1)).toBe('action');
    expect(t.update(false, CALM_DELAY_MS * 2)).toBe('calm');
  });
});

describe('music engine', () => {
  const make = (random = () => 0.3) => {
    const f = fakeContext();
    const timer = manualTimer();
    const music = new Music(f.ctx as unknown as AudioContextLike, {}, () => null, random, timer.schedule);
    music.start();
    return { ...f, timer, music };
  };

  it('plays only the drone and bells while calm: no square-wave action parts', () => {
    const { waves, timer, music } = make();
    music.setLevel(0.5);
    timer.tick();
    expect(waves.length).toBeGreaterThan(0);
    expect(waves).not.toContain('square');
  });

  it('adds the action parts once the mood changes and the clock moves on', () => {
    const { ctx, waves, timer, music } = make();
    music.setLevel(0.5);
    timer.tick();
    music.setMood('action');
    (ctx as { currentTime: number }).currentTime = 1;
    timer.tick();
    expect(waves).toContain('square');
  });

  it('stops scheduling the action parts once calm has faded back in', () => {
    const { ctx, waves, timer, music } = make();
    music.setLevel(0.5);
    music.setMood('action');
    timer.tick();
    music.setMood('calm');
    (ctx as { currentTime: number }).currentTime = 10;
    waves.length = 0;
    timer.tick();
    expect(waves).not.toContain('square');
  });

  it('schedules nothing while the level is zero', () => {
    const { waves, timer, music } = make();
    music.setLevel(0);
    timer.tick();
    expect(waves).toHaveLength(0);
  });

  it('halt stops the timer', () => {
    const { timer, music } = make();
    expect(timer.running()).toBe(true);
    music.halt();
    expect(timer.running()).toBe(false);
  });
});

describe('sound with music', () => {
  const store = { getItem: () => null, setItem() {} };

  it('starts the soundtrack on unlock and silences it when muted', () => {
    const f = fakeContext();
    const timer = manualTimer();
    const s = new Sound(() => f.ctx as unknown as AudioContextLike, store, () => 0.3, timer.schedule);
    s.unlock();
    timer.tick();
    const playing = f.waves.length;
    expect(playing).toBeGreaterThan(0);
    s.toggleMute();
    (f.ctx as { currentTime: number }).currentTime = 20;
    timer.tick();
    expect(f.waves.length).toBe(playing);
  });

  it('a mood chosen before the first gesture is used once the music starts', () => {
    const f = fakeContext();
    const timer = manualTimer();
    const s = new Sound(() => f.ctx as unknown as AudioContextLike, store, () => 0.3, timer.schedule);
    s.setMood('action');
    s.unlock();
    (f.ctx as { currentTime: number }).currentTime = 2;
    timer.tick();
    expect(f.waves).toContain('square');
  });

  it('has no music without a timer, as in the tests', () => {
    const f = fakeContext();
    const s = new Sound(() => f.ctx as unknown as AudioContextLike, store, () => 0.3, null);
    s.unlock();
    s.setMood('action');
    expect(f.waves).toHaveLength(0);
  });
});

describe('the app chooses the mood', () => {
  const START = { x: 240, y: 345 };
  function run(rows: string) {
    const moods: Mood[] = [];
    const sound: SoundPlayer = {
      muted: false, volume: 0.5, play() {}, unlock() {}, toggleMute: () => '', changeVolume: () => '',
      setMood: (m) => { moods.push(m); },
    };
    let t = 0;
    const app = new App({ clock: () => t, sound, skipTitle: true, createMission: () => makeState(corridorRows(rows)) });
    app.click(START);
    t += 500;
    return { app, moods, at: (ms: number) => { t = ms; app.update(ms); } };
  }

  it('goes to action when an enemy is in sight and back to calm after the delay once it is gone', () => {
    const { app, moods, at } = run('P..E');
    expect(app.screen).toBe('mission');
    at(1000);
    expect(moods).toEqual(['action']);
    const enemy = app.controller!.state.units.find((u) => u.side === 'enemy')!;
    enemy.alive = false;
    app.controller!.state = { ...app.controller!.state, units: [...app.controller!.state.units] };
    at(1000 + CALM_DELAY_MS + 1);
    expect(moods).toEqual(['action', 'calm']);
  });

  it('stays calm when no enemy is in view', () => {
    const { moods, at } = run('P' + '.'.repeat(30) + 'E');
    at(1000);
    expect(moods).toEqual([]);
  });

  it('plays the action mood on the title screen and relaxes to calm once the game moves on', () => {
    const moods: Mood[] = [];
    const sound: SoundPlayer = {
      muted: false, volume: 0.5, play() {}, unlock() {}, toggleMute: () => '', changeVolume: () => '',
      setMood: (m) => { moods.push(m); },
    };
    const app = new App({ clock: () => 0, sound });
    expect(app.screen).toBe('title');
    app.update(0);
    expect(moods).toEqual(['action']);
    app.screen = 'equipment';
    app.update(10);
    expect(moods).toEqual(['action', 'calm']);
  });

  it('the first click or key press on the title screen only unlocks the audio', () => {
    const calls = { unlocks: 0 };
    const sound = {
      muted: false, volume: 0.5, waiting: true, play() {}, toggleMute: () => '', changeVolume: () => '',
      unlock() { calls.unlocks += 1; this.waiting = false; },
    } as SoundPlayer & { waiting: boolean };
    const app = new App({ clock: () => 0, sound });
    app.click({ x: 240, y: 345 });
    expect(calls.unlocks).toBe(1);
    expect(app.screen).toBe('title');
    sound.waiting = true;
    expect(app.key('t')).toBe(true);
    expect(app.screen).toBe('title');
    app.key('t');
    expect(app.screen).not.toBe('title');
  });
});

/** A context that records every oscillator (wave and first frequency) and each gain's calls, in creation order. */
function recordingContext() {
  type Call = [string, number, number];
  const gains: { calls: Call[] }[] = [];
  const oscs: { type: string; freq: number }[] = [];
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    createOscillator() {
      const rec = { type: '', freq: 0 };
      oscs.push(rec);
      return {
        get type() { return rec.type; },
        set type(v: string) { rec.type = v; },
        frequency: { setValueAtTime(v: number) { if (!rec.freq) rec.freq = v; }, exponentialRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      };
    },
    createGain() {
      const g = { calls: [] as Call[] };
      gains.push(g);
      return {
        gain: {
          setValueAtTime(v: number, t: number) { g.calls.push(['set', v, t]); },
          exponentialRampToValueAtTime(v: number, t: number) { g.calls.push(['ramp', v, t]); },
        },
        connect() {},
      };
    },
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
  };
  return { ctx, gains, oscs, at: (t: number) => { ctx.currentTime = t; } };
}

describe('the story themes in the engine', () => {
  const make = (random: () => number) => {
    const f = recordingContext();
    const timer = manualTimer();
    const music = new Music(f.ctx as unknown as AudioContextLike, {}, () => null, random, timer.schedule);
    music.start();
    music.setLevel(0.5);
    return { ...f, timer, music };
  };

  it('does not leak at startup: only the calm drone is scheduled, and the other layers begin silent', () => {
    const { gains, oscs, timer } = make(() => 0.99);
    timer.tick();
    expect(oscs).toHaveLength(4);
    expect([gains[1], gains[2], gains[3], gains[4]].map((g) => g.calls[0][1])).toEqual([1, 0.0001, 0.0001, 0.0001]);
  });

  it('plays the planet theme with soft waves only, once calm has faded out', () => {
    const { oscs, timer, music, at } = make(() => 0.99);
    music.setMood('planet');
    at(3.1);
    timer.tick();
    expect(oscs).toHaveLength(4); // the pad: three swells and a slightly off triangle, no plucked notes at random 0.99
    for (const o of oscs) expect(['sine', 'triangle']).toContain(o.type);
    expect(oscs.map((o) => o.freq)).toContain(220);
    expect(oscs.map((o) => o.freq)).not.toContain(73.42);
  });

  it('adds plucked notes and their echoes to the planet theme when the dice allow', () => {
    const { oscs, timer, music, at } = make(() => 0.34);
    music.setMood('planet');
    at(3.1);
    timer.tick();
    expect(oscs.filter((o) => o.freq === 369.99).length).toBeGreaterThanOrEqual(3); // F sharp: only the planet scale has it
    for (const o of oscs) expect(['sine', 'triangle']).toContain(o.type);
  });

  it('plays the base theme: a deep drone and four heartbeat pulses, soft waves only', () => {
    const { oscs, timer, music, at } = make(() => 0.99);
    music.setMood('base');
    at(3.1);
    timer.tick();
    for (const o of oscs) expect(['sine', 'triangle']).toContain(o.type);
    expect(oscs.map((o) => o.freq)).toContain(36.71);
    expect(oscs.filter((o) => o.freq === 60)).toHaveLength(4);
    expect(oscs.length).toBeGreaterThanOrEqual(7);
    expect(oscs.some((o) => o.freq > 1000)).toBe(false); // no metallic ping at random 0.99
  });

  it('adds a metallic ping to the base theme when the dice allow', () => {
    const { oscs, timer, music, at } = make(() => 0);
    music.setMood('base');
    at(3.1);
    timer.tick();
    expect(oscs.some((o) => Math.abs(o.freq - 1656) < 0.01)).toBe(true); // 600 Hz times 2.76
  });

  it('goes back to calm cleanly: the planet parts stop once calm has faded in', () => {
    const { oscs, timer, music, at } = make(() => 0.99);
    music.setMood('planet');
    at(3.1);
    timer.tick();
    music.setMood('calm');
    at(6.3);
    oscs.length = 0;
    timer.tick();
    expect(oscs).toHaveLength(4);
    expect(oscs.map((o) => o.freq)).toContain(73.42);
    expect(oscs.map((o) => o.freq)).not.toContain(220);
  });

  it('schedules nothing in any mood while the level is zero', () => {
    for (const mood of MOODS) {
      const { oscs, timer, music, at } = make(() => 0.3);
      music.setLevel(0);
      music.setMood(mood);
      at(3.1);
      timer.tick();
      expect(oscs, mood).toHaveLength(0);
    }
  });

  it('ducks the music for a stinger and brings it back', () => {
    const { gains, music, at } = make(() => 0.3);
    const out = gains[0];
    at(10);
    out.calls.length = 0;
    music.duck(3);
    const level = 0.5 * MUSIC_GAIN;
    const [a, b, c, d] = out.calls;
    expect(out.calls).toHaveLength(4);
    expect(a).toEqual(['set', level, 10]);
    expect(b[0]).toBe('ramp');
    expect(b[1]).toBeCloseTo(level * DUCK_DEPTH, 6);
    expect(b[2]).toBeCloseTo(10.15, 6);
    expect(c[0]).toBe('set');
    expect(c[2]).toBeCloseTo(13, 6);
    expect(d[0]).toBe('ramp');
    expect(d[1]).toBeCloseTo(level, 6);
    expect(d[2]).toBeCloseTo(13 + DUCK_RECOVER, 6);
  });

  it('does not duck a silent music', () => {
    const { gains, music } = make(() => 0.3);
    music.setLevel(0);
    gains[0].calls.length = 0;
    music.duck(3);
    expect(gains[0].calls).toHaveLength(0);
  });
});
