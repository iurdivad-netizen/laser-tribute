import type { Loadout } from './loadout';
import { MISSIONS, createMission } from './missions';
import type { GameState } from './types';

export { MISSION1_ROWS } from './missions';

export function createMission1(seed = 1, loadout?: Loadout): GameState {
  return createMission(MISSIONS[0], seed, undefined, loadout);
}
