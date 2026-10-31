export const SOUND_NAMES = [
  'pistol', 'rifle', 'hit', 'ricochet', 'stab', 'explosion', 'deathSoldier', 'deathEnemy',
  'reload', 'empty', 'door', 'step', 'pickup', 'alert', 'click', 'error', 'win', 'lose', 'heal', 'scan', 'crit',
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
  heal: [tone('triangle', 600, 900, 0, 0.1, 0.3), tone('triangle', 900, 1200, 0.1, 0.14, 0.3)],
  scan: [tone('sawtooth', 1400, 500, 0, 0.35, 0.22), tone('triangle', 700, 700, 0.4, 0.05, 0.2)],
  crit: [tone('square', 900, 1500, 0, 0.06, 0.3), tone('square', 1500, 2100, 0.07, 0.1, 0.3)],
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

/** The mix group of a sound: game effects, or interface and jingles. Each group has its own gain on the master. */
export type Bus = 'sfx' | 'ui';
export const BUSES: readonly Bus[] = ['sfx', 'ui'];
export const BUS_OF: Record<SoundName, Bus> = {
  pistol: 'sfx', rifle: 'sfx', hit: 'sfx', ricochet: 'sfx', stab: 'sfx', explosion: 'sfx', deathSoldier: 'sfx',
  deathEnemy: 'sfx', reload: 'sfx', empty: 'sfx', door: 'sfx', step: 'sfx', crit: 'sfx',
  pickup: 'ui', alert: 'ui', click: 'ui', error: 'ui', heal: 'ui', scan: 'ui', win: 'ui', lose: 'ui',
};
export const BUS_GAIN: Record<Bus, number> = { sfx: 1, ui: 0.8 };

/**
 * How far (plus or minus, in cents; 100 cents is a semitone) each play of a sound may be detuned, so the sounds the
 * player hears over and over are never twice the same. Cues and jingles stay out: they must always sound alike.
 */
export const PITCH_SPREAD_CENTS: Partial<Record<SoundName, number>> = {
  pistol: 60, rifle: 60, hit: 100, ricochet: 150, stab: 80, explosion: 80, deathSoldier: 100, deathEnemy: 100,
  door: 60, step: 150,
};

export function effectDuration(name: SoundName): number {
  return Math.max(...EFFECTS[name].map((s) => s.start + s.dur));
}
