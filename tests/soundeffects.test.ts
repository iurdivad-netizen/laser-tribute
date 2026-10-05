import { describe, expect, it } from 'vitest';
import { EFFECTS, SOUND_NAMES, effectDuration, type SoundName } from '../src/audio/effects';

const DESIGN: SoundName[] = [
  'pistol', 'rifle', 'hit', 'ricochet', 'stab', 'explosion', 'deathSoldier', 'deathEnemy',
  'reload', 'empty', 'door', 'step', 'pickup', 'alert', 'click', 'error', 'win', 'lose', 'heal', 'scan',
];

describe('sound recipes', () => {
  it('cover exactly the sounds of the design', () => {
    expect([...SOUND_NAMES].sort()).toEqual([...DESIGN].sort());
    expect(Object.keys(EFFECTS).sort()).toEqual([...DESIGN].sort());
  });

  it('every effect has valid segments and stays short and quiet enough', () => {
    for (const name of SOUND_NAMES) {
      const segments = EFFECTS[name];
      expect(segments.length, name).toBeGreaterThan(0);
      for (const s of segments) {
        expect(['square', 'sawtooth', 'triangle', 'noise'], name).toContain(s.wave);
        expect(s.from, name).toBeGreaterThan(0);
        expect(s.to, name).toBeGreaterThan(0);
        expect(s.start, name).toBeGreaterThanOrEqual(0);
        expect(s.dur, name).toBeGreaterThan(0);
        expect(s.gain, name).toBeGreaterThan(0);
        expect(s.gain, name).toBeLessThanOrEqual(1);
      }
      expect(effectDuration(name), name).toBeLessThanOrEqual(1.5);
    }
  });

  it('reports the end of the latest segment as the duration', () => {
    expect(effectDuration('click')).toBeCloseTo(0.02, 5);
    expect(effectDuration('win')).toBeGreaterThan(effectDuration('click'));
  });

  it('gives the big sounds more body than the small ones', () => {
    expect(effectDuration('explosion')).toBeGreaterThan(effectDuration('pistol'));
    expect(effectDuration('rifle')).toBeGreaterThan(effectDuration('step'));
  });
});
