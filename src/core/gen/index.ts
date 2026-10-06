import type { MissionDef } from '../missions';
import { seededRandom } from '../rng';
import { checkMission, expectFor } from './check';
import { buildLayout } from './layout';
import { populate } from './populate';
import { RECIPES } from './recipes';

export { RECIPES } from './recipes';

/** Variations per map type. */
export const VARIATIONS = 5;
/** Missions in the generated campaign: one per map type. */
export const CAMPAIGN_LENGTH = RECIPES.length;
const ATTEMPTS = 50;

function mix(type: number, variation: number, attempt: number): number {
  return (
    Math.imul(type + 1, 0x9e3779b1) ^ Math.imul(variation + 1, 0x85ebca6b) ^ Math.imul(attempt + 1, 0xc2b2ae35)
  ) | 0;
}

/**
 * The map for (type, variation). The same pair always gives the same map: internal attempts are numbered, and the
 * first one that passes `checkMission` wins. `difficulty` (default: the type's place in the campaign, 1 to 10) moves
 * the enemy count up or down from the recipe's.
 */
export function generateMission(type: number, variation: number, difficulty: number = type + 1): MissionDef {
  const recipe = RECIPES[type];
  if (!Number.isInteger(type) || !recipe) throw new RangeError(`no map type ${type}`);
  if (!Number.isInteger(variation) || variation < 0 || variation >= VARIATIONS) {
    throw new RangeError(`no variation ${variation}`);
  }
  const enemies = Math.max(1, recipe.enemies + difficulty - (type + 1));
  const want = expectFor(recipe, enemies);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rnd = seededRandom(mix(type, variation, attempt));
    rnd();
    rnd();
    rnd(); // the first values of nearby seeds are alike
    const def = populate(buildLayout(recipe, rnd), rnd, recipe, enemies);
    if (def && checkMission(def, want).length === 0) return def;
  }
  throw new Error(`no playable ${recipe.name} variation ${variation} in ${ATTEMPTS} attempts`);
}

/** One variation (0 to 4) per map type for a new campaign, from a seed. */
export function drawVariations(seed: number): number[] {
  const rnd = seededRandom(seed);
  return RECIPES.map(() => Math.floor(rnd() * VARIATIONS));
}
