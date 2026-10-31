import { describe, expect, it } from 'vitest';
import { BUSES, BUS_GAIN, BUS_OF, EFFECTS, PITCH_SPREAD_CENTS, SOUND_NAMES } from '../src/audio/effects';
import { Sound, type AudioContextLike } from '../src/audio/sound';

function fakeContext() {
  const osc: { from: number[]; to: number[] }[] = [];
  const gains: { value: number; target?: unknown }[] = [];
  const param = (log: number[], ramp?: number[]) => ({
    setValueAtTime: (v: number) => { log.push(v); },
    exponentialRampToValueAtTime: (v: number) => { ramp?.push(v); },
  });
  const ctx = {
    currentTime: 0, sampleRate: 8000, destination: {}, state: 'running',
    createOscillator() {
      const o = { from: [] as number[], to: [] as number[] };
      osc.push(o);
      return { type: '', frequency: param(o.from, o.to), connect() {}, start() {}, stop() {} };
    },
    createGain() {
      const g = { value: NaN, target: undefined as unknown };
      gains.push(g);
      return {
        rec: g, // what the tests look at; a gain connected to another gain records that gain's record
        gain: { setValueAtTime: (v: number) => { if (Number.isNaN(g.value)) g.value = v; }, exponentialRampToValueAtTime() {} },
        connect: (to: unknown) => { g.target = (to as { rec?: unknown }).rec ?? to; },
      };
    },
    createDynamicsCompressor: () => ({ connect() {} }),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
  };
  return { ctx: ctx as unknown as AudioContextLike, osc, gains };
}

const store = { getItem: () => null, setItem() {} };
const player = (random: () => number) => {
  const f = fakeContext();
  const s = new Sound(() => f.ctx, store, random);
  s.unlock();
  return { s, ...f };
};

describe('pitch variation', () => {
  it('a rifle shot is detuned by the random number: low end, middle and high end', () => {
    const base = EFFECTS.rifle.find((x) => x.wave !== 'noise')!.from;
    const spread = PITCH_SPREAD_CENTS.rifle!;
    const lo = player(() => 0); lo.s.play('rifle');
    const mid = player(() => 0.5); mid.s.play('rifle');
    const hi = player(() => 1); hi.s.play('rifle');
    expect(lo.osc[0].from[0]).toBeCloseTo(base * 2 ** (-spread / 1200), 6);
    expect(mid.osc[0].from[0]).toBeCloseTo(base, 6);
    expect(hi.osc[0].from[0]).toBeCloseTo(base * 2 ** (spread / 1200), 6);
  });

  it('shifts the whole sound together, so its glide keeps its shape', () => {
    const p = player(() => 1);
    p.s.play('rifle');
    const seg = EFFECTS.rifle.find((x) => x.wave !== 'noise')!;
    expect(p.osc[0].to[0] / p.osc[0].from[0]).toBeCloseTo(seg.to / seg.from, 6);
  });

  it('two plays with different dice sound different', () => {
    const p = player(() => 0.9);
    p.s.play('step');
    const q = player(() => 0.1);
    q.s.play('step');
    // a step is noise only: it carries no pitch, so use a pitched sound too
    p.s.play('hit');
    q.s.play('hit');
    expect(p.osc[0].from[0]).not.toBe(q.osc[0].from[0]);
  });

  it('cues and jingles are never detuned, whatever the dice say', () => {
    for (const name of ['click', 'error', 'win', 'lose', 'alert', 'pickup', 'heal', 'scan', 'crit', 'reload', 'empty'] as const) {
      expect(PITCH_SPREAD_CENTS[name]).toBeUndefined();
      const p = player(() => 1);
      p.s.play(name);
      const firstTone = EFFECTS[name].find((x) => x.wave !== 'noise')!;
      expect(p.osc[0].from[0]).toBe(firstTone.from);
    }
  });

  it('keeps every spread under a semitone and a half', () => {
    for (const v of Object.values(PITCH_SPREAD_CENTS)) expect(v!).toBeLessThanOrEqual(150);
  });
});

describe('mix groups', () => {
  it('has one gain per group on the master, at the group level', () => {
    const { gains } = player(Math.random);
    expect(gains.slice(1, 3).map((g) => g.value)).toEqual(BUSES.map((b) => BUS_GAIN[b]));
    expect(gains[1].target).toBe(gains[0]);
    expect(gains[2].target).toBe(gains[0]);
  });

  it('puts every sound in exactly one group', () => {
    for (const name of SOUND_NAMES) expect(BUSES).toContain(BUS_OF[name]);
  });

  it('a gunshot goes through the sfx group and a click through the ui group', () => {
    const p = player(() => 0.5);
    p.s.play('rifle');
    p.s.play('click');
    const [, sfx, ui] = p.gains;
    const shotGains = p.gains.slice(3).filter((g) => g.target === sfx);
    const clickGains = p.gains.slice(3).filter((g) => g.target === ui);
    expect(shotGains).toHaveLength(EFFECTS.rifle.length);
    expect(clickGains).toHaveLength(EFFECTS.click.length);
  });
});
