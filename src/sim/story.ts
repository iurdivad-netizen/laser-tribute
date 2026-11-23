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
import { autoSquad, canHire, canTrain, deployed, hire, kitBudget, setSquad, startTraining } from '../core/world/barracks';
import { NODES } from '../core/world/base';
import { researchOptions, startResearch } from '../core/world/research';
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
  /** Research projects finished, and soldiers hired, over the run. */
  researched: number;
  hired: number;
  final: World;
}

const costOf = (id: string): number => NODES.find((n) => n.id === id)!.cost;

/**
 * The base policy before each fight: research the cheapest project that leaves 60 credits spare, hire while fewer than
 * four soldiers are ready, train the first soldier who can, then field the best four.
 */
function tendBase(w: World, counters: { hired: number }): World {
  let next = w;
  const options = researchOptions(next).filter((id) => next.credits - costOf(id) >= 60).sort((a, b) => costOf(a) - costOf(b));
  if (options.length > 0) next = startResearch(next, options[0]);
  while (next.soldiers.filter((s) => s.status === 'ready').length < 4 && canHire(next)) {
    next = hire(next);
    counters.hired += 1;
  }
  const trainee = next.soldiers.find((s) => canTrain(next, s.name));
  if (trainee) next = startTraining(next, trainee.name);
  return setSquad(next, autoSquad(next));
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
  const counters = { hired: 0 };
  while (w.status === 'active' && steps < maxSteps) {
    const targets = attackable(w);
    const target = targets.includes(CAPITAL_REGION) ? CAPITAL_REGION : targets[0];
    if (target !== undefined) {
      w = tendBase(w, counters);
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
  return {
    status: w.status, steps, day: w.day, held: regionsHeld(w), losses, researched: w.research.done.length, hired: counters.hired, final: w,
  };
}
