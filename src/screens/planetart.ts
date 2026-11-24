import { CAPITAL_REGION, REGIONS } from '../core/world/planet';
import type { Holder, World } from '../core/world/world';
import { UI } from '../ui/frame';

export type EmblemId =
  | 'outpost_enemy' | 'outpost_taken' | 'settlement_neutral' | 'settlement_allied'
  | 'wild_a' | 'wild_b' | 'wild_visited' | 'start_ship' | 'citadel_enemy' | 'citadel_taken';
export type StampId = 'scorch' | 'cleared' | 'fields';
export type PlanetArtId = 'backdrop' | EmblemId | `stamp_${StampId}`;

export const EMBLEM_IDS: readonly EmblemId[] = [
  'outpost_enemy', 'outpost_taken', 'settlement_neutral', 'settlement_allied',
  'wild_a', 'wild_b', 'wild_visited', 'start_ship', 'citadel_enemy', 'citadel_taken',
];
export const STAMP_IDS: readonly StampId[] = ['scorch', 'cleared', 'fields'];
export const PLANET_ART_IDS: readonly PlanetArtId[] = [
  'backdrop', ...EMBLEM_IDS, ...STAMP_IDS.map((s) => `stamp_${s}` as const),
];

/** Pixel size of each emblem on the map: places 20, the landing ship 26, the citadels 32. */
export const FOOTPRINT: Record<EmblemId, number> = {
  outpost_enemy: 20, outpost_taken: 20, settlement_neutral: 20, settlement_allied: 20,
  wild_a: 20, wild_b: 20, wild_visited: 20, start_ship: 26, citadel_enemy: 32, citadel_taken: 32,
};

export interface RegionLook {
  /** The painted ground patch under the place, or none. */
  stamp: StampId | null;
  emblem: EmblemId;
  /** The owner's colour, drawn as a soft glow under the place so ownership reads on any ground. */
  tint: string;
}

const TINT: Record<Holder, string> = {
  enemy: UI.red, player: UI.green, allied: UI.blue, neutral: UI.accent, wild: UI.dim,
};
const STAMP: Record<Holder, StampId | null> = {
  enemy: 'scorch', player: 'cleared', allied: 'fields', neutral: null, wild: null,
};

function emblemOf(w: World, id: number): EmblemId {
  const kind = REGIONS[id].kind;
  const state = w.regions[id];
  if (kind === 'start') return 'start_ship';
  if (id === CAPITAL_REGION) return state.holder === 'player' ? 'citadel_taken' : 'citadel_enemy';
  if (kind === 'enemy') return state.holder === 'player' ? 'outpost_taken' : 'outpost_enemy';
  if (kind === 'neutral') return state.holder === 'allied' ? 'settlement_allied' : 'settlement_neutral';
  if (state.visited) return 'wild_visited';
  return id % 2 === 0 ? 'wild_a' : 'wild_b';
}

/** What a region looks like on the planet map, from its owner and whether its supplies were taken. */
export function regionLook(w: World, id: number): RegionLook {
  const holder = w.regions[id].holder;
  return { stamp: STAMP[holder], emblem: emblemOf(w, id), tint: TINT[holder] };
}
