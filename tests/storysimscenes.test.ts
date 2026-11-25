import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { storyGearRules } from '../src/core/world/base';
import { deployed, kitBudget } from '../src/core/world/barracks';
import { SCENES } from '../src/core/world/story';
import { runStory, type PlayMission } from '../src/sim/story';

/** A fight decided by the stub (as in storysim.test.ts). */
const stub = (status: 'won' | 'lost'): PlayMission => (spec, world, loadout) => {
  const def = generateMission(spec.type, spec.variation, spec.difficulty, true);
  const s: GameState = createMission(
    def, spec.seed, deployed(world).roster, loadout, kitBudget(world), world.stash, storyGearRules(world.research.done), spec.enemyLevel,
  );
  if (status === 'lost') for (const u of s.units) if (u.side === 'player') u.alive = false;
  s.status = status;
  return s;
};

describe('the story bot and scenes', () => {
  it('plays every scene once, in a sensible order, and ends with the victory', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const run = runStory(seed, 'calm', stub('won'));
      expect(run.status, `seed ${seed}`).toBe('won');
      expect(new Set(run.scenes).size).toBe(run.scenes.length);
      expect(run.scenes[0]).toBe('landing');
      for (const id of ['first-blood', 'citadel-open']) expect(run.scenes, `seed ${seed}`).toContain(id);
      expect(run.scenes[run.scenes.length - 1]).toBe('victory');
      expect(run.scenes.every((id) => SCENES.some((s) => s.id === id))).toBe(true);
      expect(run.final.seen).toEqual(run.scenes);
    }
  }, 60_000);

  it('takes option 0 in every choice scene it meets', () => {
    const run = runStory(1, 'calm', stub('won'));
    const choices = SCENES.filter((s) => s.choice && run.scenes.includes(s.id)).map((s) => s.id);
    expect(choices.length).toBeGreaterThan(0);
    for (const id of choices) expect(run.final.chosen[id], id).toBe(0);
  });

  it('ends in the defeat scene when the planet is lost', () => {
    const lost = [1, 2, 3, 4, 5, 6].map((seed) => runStory(seed, 'pressure', stub('lost'))).filter((r) => r.status === 'lost');
    expect(lost.length, 'a lost-every-fight run should end the planet on pressure').toBeGreaterThan(0);
    for (const run of lost) expect(run.scenes[run.scenes.length - 1]).toBe('defeat');
  });
});
