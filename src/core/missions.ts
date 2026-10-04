import type { RosterSoldier } from './campaign';
import { LOADOUT, applyLoadout, type Loadout } from './loadout';
import type { Stash } from './stash';
import { parseMap } from './mission';
import { applyRank } from './ranks';
import type { GameState, Pos } from './types';
import { updateExplored } from './vision';

export interface MissionDef {
  id: string;
  name: string;
  rows: string[];
  /** Patrol routes by enemy id (e1, e2, ... in reading order). Each unit heads for patrol[patrolIndex]. */
  patrols: Record<string, Pos[]>;
}

export const MISSION1_ROWS: string[] = [
  '##############################',
  '#....#.........#.............#',
  '#....#.........#...E.....E...#',
  '#.p..#....r....#.............#',
  '#....+.........+.............#',
  '#....#....g....#.............#',
  '#....#.........#.............#',
  '##+#######+###########+#######',
  '#............................#',
  '#......................E.....#',
  '#....###........###..........#',
  '#....#............#..........#',
  '#....+............+..........#',
  '#....#............#..........#',
  '#....###........###..........#',
  '#.......................E....#',
  '#............................#',
  '#.P.P........................#',
  '#..P.P.......................#',
  '##############################',
];

const pt = (x: number, y: number): Pos => ({ x, y });

const MISSION_1: MissionDef = {
  id: 'outpost',
  name: 'Outpost',
  rows: MISSION1_ROWS,
  patrols: {
    e1: [pt(19, 5), pt(19, 2)],
    e2: [pt(25, 5), pt(25, 2)],
    e3: [pt(20, 9), pt(23, 9)],
    e4: [pt(10, 15), pt(24, 15)],
  },
};

const MISSION_2: MissionDef = {
  id: 'warehouse',
  name: 'Warehouse',
  rows: [
    '##############################',
    '#......#.........#...........#',
    '#..p...#....E....#......E....#',
    '#......+....r....+...........#',
    '#......#.........#......g....#',
    '####+#######+#########+#######',
    '#............................#',
    '#....................E.......#',
    '#.......................##...#',
    '#......####.............##...#',
    '#.g....####..................#',
    '#.................####.......#',
    '#.............E...####.......#',
    '#..........................E.#',
    '#............................#',
    '#............###.............#',
    '#............###.............#',
    '#.P.P....................E...#',
    '#..P.P.......................#',
    '##############################',
  ],
  patrols: {
    e1: [pt(12, 4), pt(12, 2)],
    e2: [pt(24, 4), pt(24, 2)],
    e3: [pt(16, 7), pt(21, 7)],
    e4: [pt(8, 12), pt(14, 12)],
    e5: [pt(27, 16), pt(27, 13)],
    e6: [pt(18, 17), pt(25, 17)],
  },
};

const MISSION_3: MissionDef = {
  id: 'compound',
  name: 'Compound',
  rows: [
    '##############################',
    '#........#..........#........#',
    '#...E....#....E.....#...E....#',
    '#........+.......r..+........#',
    '#........#..........#........#',
    '#........#..........#........#',
    '####+#########+#########+#####',
    '#........#..........#........#',
    '#........#..........#........#',
    '#...E....+....E.....+...E....#',
    '#.....p..#..........#........#',
    '#........#..........#...g....#',
    '#........#..........#........#',
    '####+##########+########+#####',
    '#............#......#........#',
    '#.....g......#......#........#',
    '#.P.P........+..E...+....E...#',
    '#..P.P.......#......#........#',
    '#............#......#........#',
    '##############################',
  ],
  patrols: {
    e1: [pt(4, 4), pt(4, 2)],
    e2: [pt(18, 2), pt(14, 2)],
    e3: [pt(26, 4), pt(24, 2)],
    e4: [pt(7, 11), pt(4, 9)],
    e5: [pt(14, 11), pt(14, 9)],
    e6: [pt(26, 11), pt(24, 9)],
    e7: [pt(18, 17), pt(16, 16)],
    e8: [pt(27, 17), pt(25, 16)],
  },
};

export const MISSIONS: MissionDef[] = [MISSION_1, MISSION_2, MISSION_3];

/**
 * Builds a playable state from a mission record. Without a roster the soldiers keep the default
 * names P1..P4; without a loadout they keep the default kit.
 */
export function createMission(
  def: MissionDef,
  seed = 1,
  roster?: RosterSoldier[],
  loadout?: Loadout,
  budget: number = LOADOUT.budget,
  stash?: Stash,
): GameState {
  let s = parseMap(def.rows, seed);
  for (const u of s.units) {
    const patrol = def.patrols[u.id];
    if (patrol) u.patrol = patrol.map((p) => ({ ...p }));
  }
  if (loadout) s = applyLoadout(s, loadout, budget, stash);
  if (roster) {
    s.units
      .filter((u) => u.side === 'player')
      .forEach((u, i) => {
        if (roster[i]) {
          u.name = roster[i].name;
          applyRank(u, roster[i].kills);
        }
      });
  }
  updateExplored(s);
  return s;
}
