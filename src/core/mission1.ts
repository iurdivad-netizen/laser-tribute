import { parseMap } from './mission';
import type { GameState, Pos } from './types';
import { updateExplored } from './vision';

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

/** Patrol routes by enemy id. Each unit heads for patrol[patrolIndex], then the next point. */
const PATROLS: Record<string, Pos[]> = {
  e1: [{ x: 19, y: 5 }, { x: 19, y: 2 }],
  e2: [{ x: 25, y: 5 }, { x: 25, y: 2 }],
  e3: [{ x: 20, y: 9 }, { x: 23, y: 9 }],
  e4: [{ x: 10, y: 15 }, { x: 24, y: 15 }],
};

export function createMission1(seed = 1): GameState {
  const s = parseMap(MISSION1_ROWS, seed);
  for (const u of s.units) {
    if (PATROLS[u.id]) u.patrol = PATROLS[u.id].map((p) => ({ ...p }));
  }
  updateExplored(s);
  return s;
}
