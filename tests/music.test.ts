import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { CALM_DELAY_MS, Music, MoodTracker, type Mood } from '../src/audio/music';
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
