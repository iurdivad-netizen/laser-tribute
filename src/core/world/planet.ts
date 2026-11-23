import { RECIPES } from '../gen';

/** What a region is at the start of a story. `start` is the player's landing zone; it is also a map that can be retaken. */
export type RegionKind = 'start' | 'enemy' | 'neutral' | 'wild';

export interface Region {
  id: number;
  name: string;
  /** Position on the planet map, in map-local pixels (see `PLANET.map` in the planet screen). */
  x: number;
  y: number;
  links: number[];
  kind: RegionKind;
  /** Map type 0 to 9 and variation 0 to 4 of the tactical map; 0 for neutral and wild regions. */
  type: number;
  variation: number;
  /** Base garrison: the recipe's enemy count for the type. 0 for neutral and wild regions. */
  garrison: number;
  maxGarrison: number;
}

/** Changing the region list invalidates old story saves: bump this. */
export const PLANET_VERSION = 1;

/** Extra enemies a garrison can grow by above its base, at most (difficulty presets may cap lower). */
const GROWTH_ROOM = 5;

type Row = [name: string, x: number, y: number, kind: RegionKind, type: number];

// One row per region; the index is the id. Map types rise with distance from the landing zone.
const ROWS: Row[] = [
  ['Landing Point', 30, 335, 'start', 0],
  ['Ashfall Ridge', 90, 320, 'enemy', 0],
  ['Rustwater', 150, 340, 'enemy', 1],
  ['Dust Flats', 215, 330, 'wild', 0],
  ['Kessel Yard', 275, 335, 'enemy', 3],
  ['Tinker\'s Rest', 35, 265, 'neutral', 0],
  ['Copper Gulch', 95, 255, 'enemy', 1],
  ['Hollow Mill', 155, 270, 'enemy', 2],
  ['Saltmarsh Depot', 215, 265, 'enemy', 3],
  ['Greenwater', 275, 270, 'neutral', 0],
  ['Windbreak Steppe', 40, 200, 'wild', 0],
  ['Blackrock Camp', 100, 190, 'enemy', 2],
  ['Ironbridge', 160, 205, 'enemy', 4],
  ['Furnace Row', 220, 195, 'enemy', 5],
  ['Slag Heights', 285, 205, 'enemy', 5],
  ['Marrow Springs', 45, 135, 'neutral', 0],
  ['Deepcut Mine', 105, 125, 'enemy', 4],
  ['Glass Barrens', 165, 140, 'wild', 0],
  ['Corvid Station', 225, 130, 'enemy', 6],
  ['Ridgeline Works', 290, 140, 'enemy', 7],
  ['Cinder Fen', 50, 70, 'wild', 0],
  ['Harbor of Ash', 110, 60, 'neutral', 0],
  ['Bastion North', 170, 70, 'enemy', 6],
  ['Warden\'s Gate', 230, 60, 'enemy', 7],
  ['Highfort', 290, 75, 'enemy', 8],
  ['Meridian Citadel', 230, 18, 'enemy', 9],
  ['Last Light', 50, 25, 'neutral', 0],
  ['Pilgrim\'s Rest', 310, 240, 'neutral', 0],
  ['Whisper Crag', 110, 20, 'wild', 0],
  ['Stormcut Pass', 310, 110, 'wild', 0],
];

const EDGES: [number, number][] = [
  [0, 1], [0, 5], [1, 2], [1, 5], [1, 6], [2, 3], [2, 7], [3, 4], [3, 8], [4, 8], [4, 9], [5, 6], [5, 10],
  [6, 7], [6, 11], [7, 8], [7, 12], [8, 9], [8, 13], [9, 14], [9, 27], [10, 11], [10, 15], [11, 12], [11, 16],
  [12, 13], [12, 17], [13, 14], [13, 18], [14, 19], [14, 27], [15, 16], [15, 20], [16, 17], [16, 21],
  [17, 18], [17, 22], [18, 19], [18, 23], [19, 24], [19, 29], [20, 21], [20, 26], [21, 22], [21, 26], [21, 28],
  [22, 23], [22, 25], [23, 24], [23, 25], [24, 25], [24, 29], [26, 28],
];

export const START_REGION = 0;
export const CAPITAL_REGION = 25;

/** Regions the player must hold at least `CAPITAL_UNLOCK` of before the capital can be attacked. */
export const CAPITAL_UNLOCK = 2;

export const REGIONS: readonly Region[] = ROWS.map(([name, x, y, kind, type], id) => {
  const fights = kind === 'enemy' || kind === 'start';
  const garrison = fights ? RECIPES[type].enemies : 0;
  return {
    id,
    name,
    x,
    y,
    links: EDGES.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])).sort((a, b) => a - b),
    kind,
    type: fights ? type : 0,
    variation: fights ? (id * 2) % 5 : 0,
    garrison,
    maxGarrison: fights ? garrison + GROWTH_ROOM : 0,
  };
});

export const CAPITAL_GATES: readonly number[] = REGIONS[CAPITAL_REGION].links;

/** The `difficulty` argument of `generateMission` for a region held by `garrison` enemies. */
export function missionDifficulty(r: Region, garrison: number): number {
  return r.type + 1 + (garrison - RECIPES[r.type].enemies);
}
