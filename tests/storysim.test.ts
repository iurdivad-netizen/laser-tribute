import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';
import type { GameState } from '../src/core/types';
import { DIFFICULTY_IDS } from '../src/core/world/difficulty';
import { gearLevel, storyBudget } from '../src/core/world/world';
import { runStory, type PlayMission } from '../src/sim/story';

/** A "fight" that is decided by the stub: builds the real state, then sets the outcome and who died. */
const stub = (status: 'won' | 'lost'): PlayMission => (spec, world, loadout) => {
  const def = generateMission(spec.type, spec.variation, spec.difficulty);
  const s: GameState = createMission(
    def, spec.seed, world.roster, loadout, storyBudget(world), world.stash, gearLevel(world), spec.enemyLevel,
  );
  if (status === 'lost') for (const u of s.units) if (u.side === 'player') u.alive = false;
  s.status = status;
  return s;
};

describe('runStory with a fixed outcome', () => {
  it('takes the capital on every difficulty when every fight is won', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      for (let seed = 1; seed <= 3; seed++) {
        const run = runStory(seed, difficulty, stub('won'));
        expect(run.status, `${difficulty} seed ${seed}`).toBe('won');
        expect(run.steps).toBeLessThanOrEqual(300);
        expect(run.losses).toBe(0);
        expect(run.held).toBeGreaterThan(0);
      }
    }
  }, 60_000);

  it('stays bounded and active on CALM when every fight is lost', () => {
    const run = runStory(1, 'calm', stub('lost'), 40);
    expect(run.status).toBe('active');
    expect(run.steps).toBe(40);
    expect(run.losses).toBe(40);
  });

  it('stays bounded on PRESSURE when every fight is lost, and may end in defeat', () => {
    const run = runStory(2, 'pressure', stub('lost'), 60);
    expect(run.steps).toBeLessThanOrEqual(60);
    expect(['active', 'lost']).toContain(run.status);
  });
});
