import { recolorRows, rotateRows } from './sprite';

export const SPRITE_NAMES = [
  'soldier_n', 'soldier_ne', 'soldier_e', 'soldier_se', 'soldier_s',
  'enemy_n', 'enemy_ne', 'enemy_e', 'enemy_se', 'enemy_s',
  'floor_0', 'floor_1', 'floor_2', 'wall', 'door_closed', 'door_open',
  'item_pistol', 'item_rifle', 'item_grenade', 'corpse_player', 'corpse_enemy',
  'flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash',
  'boom_0', 'boom_1', 'boom_2', 'boom_3',
] as const;

export type SpriteName = (typeof SPRITE_NAMES)[number];

/** A soldier seen from above, facing north (up): helmet and face at the top, shoulders and hands at the sides. */
const SOLDIER_N = [
  '................',
  '.....kkkkkk.....',
  '....kNBBBBNk....',
  '...kNBCCCCBNk...',
  '...kBCssssCBk...',
  '...kBBssssBBk...',
  '..kkNBBBBBBNkk..',
  '.kssNBBBBBBNssk.',
  '.kssNNBBBBNNssk.',
  '..kkNNBBBBNNkk..',
  '...kNNBBBBNNk...',
  '...kNNNNNNNNk...',
  '....kNNNNNNk....',
  '.....kkkkkk.....',
  '................',
  '................',
];

const ENEMY_COLOURS = { B: 'R', C: 'P', N: 'M' };

const CORPSE_PLAYER = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kNNNNNNNNk...',
  '..kNNssNNNNNNk..',
  '..kNNssNNuuNNk..',
  '..kNNNNNuuuNNk..',
  '...kNNNNNuNNk...',
  '....kkkkkkkk....',
  '................',
  '................',
  '................',
  '................',
];

/** A tile of floor: seams on the bottom and right edge and a few specks, the same for a given variant. */
function floorRows(variant: number): string[] {
  const grid = Array.from({ length: 16 }, () => Array<string>(16).fill('g'));
  for (let i = 0; i < 16; i++) {
    grid[15][i] = 'h';
    grid[i][15] = 'h';
  }
  let seed = 12345 + variant * 7919;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed >>> 8;
  };
  for (let n = 0; n < 7; n++) {
    const x = next() % 14;
    const y = next() % 14;
    grid[y][x] = n % 3 === 0 ? 'G' : 'h';
  }
  return grid.map((r) => r.join(''));
}

/** Brick-like wall with a lit top edge and darker mortar. */
const WALL = (() => {
  const a = 'wwwwwwwvwwwwwwwv';
  const b = 'wwwvwwwwwwwvwwww';
  const m = 'vvvvvvvvvvvvvvvv';
  return ['WWWWWWWWWWWWWWWW', a, a, a, m, b, b, b, m, a, a, a, m, b, b, m];
})();

const DOOR_CLOSED = (() => {
  const frame = 'kkkkkkkkkkkkkkkk';
  const light = 'kOOOOOOOOOOOOOOk';
  const dark = 'kddddddddddddddk';
  const handle = 'kdddddddddddyddk';
  return [frame, light, dark, light, dark, light, dark, light, handle, light, dark, light, dark, light, dark, frame];
})();

const DOOR_OPEN = (() => {
  const edge = 'DDDDDDDDDDDDDDDD';
  const inner = 'D' + 'd'.repeat(14) + 'D';
  const mid = 'Dd' + 'g'.repeat(12) + 'dD';
  return [edge, inner, ...Array.from({ length: 12 }, () => mid), inner, edge];
})();

const FLASH_0 = [
  '................',
  '................',
  '................',
  '.......yy.......',
  '......yooy......',
  '..yy.yoffoy.yy..',
  '...yyoffffoyy...',
  '....yoffffoy....',
  '....yoffffoy....',
  '...yyoffffoyy...',
  '..yy.yoffoy.yy..',
  '......yooy......',
  '.......yy.......',
  '................',
  '................',
  '................',
];

const FLASH_1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oo.......',
  '......oyyo......',
  '.....oyffyo.....',
  '.....oyffyo.....',
  '......oyyo......',
  '.......oo.......',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const SPLASH = [
  '................',
  '................',
  '................',
  '......uuuu......',
  '....uuuuuuuu....',
  '...uuuRuuuuuu...',
  '..uuuuuuuuRuuu..',
  '..uRuuuuuuuuuu..',
  '..uuuuuRuuuuuu..',
  '...uuuuuuuuuu...',
  '....uuuuuuuu....',
  '......uuuu......',
  '................',
  '................',
  '................',
  '................',
];

function slashRows(frame: number): string[] {
  const grid = Array.from({ length: 16 }, () => Array<string>(16).fill('.'));
  const length = frame === 0 ? 8 : 11;
  for (let i = 0; i < length; i++) {
    const x = 13 - i;
    const y = 2 + i;
    grid[y][x] = 'f';
    grid[y][x + 1] = frame === 0 ? 'f' : 'C';
  }
  return grid.map((r) => r.join(''));
}

/** An explosion frame: a fireball that grows, then thins to a dark ring. */
function boomRows(frame: number): string[] {
  const radius = [3.5, 5.5, 7, 7.5][frame];
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let line = '';
    for (let x = 0; x < 16; x++) {
      const t = Math.hypot(x - 7.5, y - 7.5) / radius;
      let ch = '.';
      if (t <= 1) {
        if (frame === 3) ch = t >= 0.6 ? 'M' : '.';
        else ch = t < 0.35 ? 'f' : t < 0.65 ? 'y' : t < 0.9 ? 'o' : 'M';
      }
      line += ch;
    }
    rows.push(line);
  }
  return rows;
}

const ITEM_PISTOL = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '...kaaaaaaaak...',
  '...kkkkkAAkkk...',
  '......kAAk......',
  '......kAAk......',
  '......kkkk......',
  '................',
  '................',
  '................',
  '................',
];

const ITEM_RIFLE = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kaaaaaaaaaaaak.',
  '.kkkAAAkkkkkkkk.',
  '....kAAk........',
  '....kkkk........',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const ITEM_GRENADE = [
  '................',
  '................',
  '................',
  '................',
  '......kk........',
  '.....kyyk.......',
  '....kkkkkk......',
  '...keeeeeEk.....',
  '...keeeeeEk.....',
  '...keeeeEEk.....',
  '...kEEEEEEk.....',
  '....kkkkkk......',
  '................',
  '................',
  '................',
  '................',
];

const soldier = {
  soldier_n: SOLDIER_N,
  soldier_ne: rotateRows(SOLDIER_N, 45),
  soldier_e: rotateRows(SOLDIER_N, 90),
  soldier_se: rotateRows(SOLDIER_N, 135),
  soldier_s: rotateRows(SOLDIER_N, 180),
};

export const SPRITE_ROWS: Record<SpriteName, string[]> = {
  ...soldier,
  enemy_n: recolorRows(soldier.soldier_n, ENEMY_COLOURS),
  enemy_ne: recolorRows(soldier.soldier_ne, ENEMY_COLOURS),
  enemy_e: recolorRows(soldier.soldier_e, ENEMY_COLOURS),
  enemy_se: recolorRows(soldier.soldier_se, ENEMY_COLOURS),
  enemy_s: recolorRows(soldier.soldier_s, ENEMY_COLOURS),
  floor_0: floorRows(0),
  floor_1: floorRows(1),
  floor_2: floorRows(2),
  wall: WALL,
  door_closed: DOOR_CLOSED,
  door_open: DOOR_OPEN,
  item_pistol: ITEM_PISTOL,
  item_rifle: ITEM_RIFLE,
  item_grenade: ITEM_GRENADE,
  corpse_player: CORPSE_PLAYER,
  corpse_enemy: recolorRows(CORPSE_PLAYER, ENEMY_COLOURS),
  flash_0: FLASH_0,
  flash_1: FLASH_1,
  spark: recolorRows(FLASH_1, { o: 'u', y: 'R', f: 'P' }),
  slash_0: slashRows(0),
  slash_1: slashRows(1),
  splash: SPLASH,
  boom_0: boomRows(0),
  boom_1: boomRows(1),
  boom_2: boomRows(2),
  boom_3: boomRows(3),
};
