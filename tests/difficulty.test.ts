import { describe, expect, it } from 'vitest';
import { DAYS, DIFFICULTIES, DIFFICULTY_IDS } from '../src/core/world/difficulty';

describe('story difficulty presets', () => {
  it('has the three presets in order', () => {
    expect(DIFFICULTY_IDS).toEqual(['calm', 'standard', 'pressure']);
  });

  it('holds the starting values', () => {
    expect(DIFFICULTIES.calm).toMatchObject({ name: 'CALM', growthEvery: null, growthCap: 0, counterEvery: null, income: 8 });
    expect(DIFFICULTIES.standard).toMatchObject({ name: 'STANDARD', growthEvery: 12, growthCap: 3, counterEvery: null, income: 6 });
    expect(DIFFICULTIES.pressure).toMatchObject({ name: 'PRESSURE', growthEvery: 6, growthCap: 5, counterEvery: 15, income: 4 });
    expect(DAYS).toEqual({ attack: 3, visit: 2, lossPenalty: 6 });
  });

  it('only PRESSURE counterattacks, and income falls with difficulty', () => {
    expect(DIFFICULTY_IDS.filter((id) => DIFFICULTIES[id].counterEvery !== null)).toEqual(['pressure']);
    expect(DIFFICULTIES.calm.income).toBeGreaterThan(DIFFICULTIES.standard.income);
    expect(DIFFICULTIES.standard.income).toBeGreaterThan(DIFFICULTIES.pressure.income);
  });

  it('keeps every blurb short enough for its button', () => {
    for (const id of DIFFICULTY_IDS) expect(DIFFICULTIES[id].blurb.length).toBeLessThanOrEqual(34);
  });
});
