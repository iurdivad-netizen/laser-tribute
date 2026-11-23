import { runEnemyTurn } from '../core/ai';
import { generateMission } from '../core/gen';
import { loadoutCost, type Loadout } from '../core/loadout';
import { createMission } from '../core/missions';
import type { GameState } from '../core/types';
import type { DifficultyId } from '../core/world/difficulty';
import { CAPITAL_REGION, REGIONS } from '../core/world/planet';
import {
  attackable, canVisit, missionFor, newWorld, regionsHeld, resolve, visit, type MissionSpec, type World, type WorldStatus,
} from '../core/world/world';
import { storyGearRules } from '../core/world/base';
import { deployed, kitBudget } from '../core/world/barracks';
import { botTurn, type BotMode } from './bot';
import { TURN_LIMIT, chooseLoadout } from './campaign';

/** Plays one region fight to its end and returns the finished state. */
export type PlayMission = (spec: MissionSpec, world: World, loadout: Loadout) => GameState;

/** The tactical bot: the same loop as `runCampaign`, on the region's generated map; a stuck fight counts as lost. */
export function playWithBot(mode: BotMode = 'basic'): PlayMission {
  return (spec, world, loadout) => {
    const def = generateMission(spec.type, spec.variation, spec.difficulty);
    let s = createMission(
      def, spec.seed, deployed(world).roster, loadout, kitBudget(world), world.stash, storyGearRules(world.research.done), spec.enemyLevel,
    );
    while (s.status === 'playing') {
      if (s.turnNumber > TURN_LIMIT) {
        s = { ...s, status: 'lost' };
        break;
      }
      s = botTurn(s, mode);
      if (s.status === 'playing' && s.turn === 'enemy') s = runEnemyTurn(s).state;
    }
    return s;
  };
}

export interface StoryRun {
  status: WorldStatus;
  steps: number;
  day: number;
  held: number;
  losses: number;
}

/**
 * Plays a whole story with a trivial strategic policy: attack the capital when it is open, else the lowest-numbered
 * region that can be attacked, else visit the lowest-numbered region that can be visited. Stops when the story ends,
 * when nothing can be done, or after `maxSteps` actions.
 */
export function runStory(seed: number, difficulty: DifficultyId, play: PlayMission, maxSteps = 300): StoryRun {
  let w = newWorld(seed, difficulty);
  let steps = 0;
  let losses = 0;
  while (w.status === 'active' && steps < maxSteps) {
    const targets = attackable(w);
    const target = targets.includes(CAPITAL_REGION) ? CAPITAL_REGION : targets[0];
    if (target !== undefined) {
      const spec = missionFor(w, target);
      const rules = storyGearRules(w.research.done);
      const loadout = chooseLoadout(kitBudget(w), w.stash, rules);
      const finished = play(spec, w, loadout);
      if (finished.status === 'lost') losses += 1;
      w = resolve(w, spec, finished, loadout, loadoutCost(loadout, w.stash, rules));
    } else {
      const place = REGIONS.find((r) => canVisit(w, r.id));
      if (!place) break;
      w = visit(w, place.id);
    }
    steps += 1;
  }
  return { status: w.status, steps, day: w.day, held: regionsHeld(w), losses };
}
