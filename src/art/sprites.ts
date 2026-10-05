import { recolorRows } from './sprite';

export const SPRITE_NAMES = [
  'soldier_rifle_n', 'soldier_rifle_ne', 'soldier_rifle_e', 'soldier_rifle_se', 'soldier_rifle_s',
  'soldier_pistol_n', 'soldier_pistol_ne', 'soldier_pistol_e', 'soldier_pistol_se', 'soldier_pistol_s',
  'enemy_rifle_n', 'enemy_rifle_ne', 'enemy_rifle_e', 'enemy_rifle_se', 'enemy_rifle_s',
  'enemy_pistol_n', 'enemy_pistol_ne', 'enemy_pistol_e', 'enemy_pistol_se', 'enemy_pistol_s',
  'floor_0', 'floor_1', 'floor_2', 'wall', 'door_closed', 'door_open',
  'item_pistol', 'item_rifle', 'item_grenade', 'corpse_player', 'corpse_enemy',
  'flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash',
  'boom_0', 'boom_1', 'boom_2', 'boom_3',
] as const;

export type SpriteName = (typeof SPRITE_NAMES)[number];

/**
 * An upright soldier seen from slightly above, as in the original Laser Squad: helmet and face, torso, arms,
 * legs and boots. One weapon-free drawing per view (the other three facings are mirrors); the weapon is painted
 * into the hands by `armed`, so a rifle and a pistol share one body.
 */
type View = 'n' | 'ne' | 'e' | 'se' | 's';

const BODY: Record<View, string[]> = {
  n: [
    '.......kk.......',
    '......kBBk......',
    '.....kBCCBk.....',
    '....kBBCCBBk....',
    '....kBBBBBBk....',
    '...kkkNNNNkkk...',
    '..kNNBBBBBBNNk..',
    '..kNNBNNNNBNNk..',
    '..kNNBNBBNBNNk..',
    '..kNNBNNNNBNNk..',
    '..kskBNNNNBksk..',
    '...kkNNkkNNkk...',
    '....kNNkkNNk....',
    '....kNNkkNNk....',
    '....kkkkkkkk....',
    '.....kk..kk.....',
  ],
  ne: [
    '.......kkk......',
    '......kBBBk.....',
    '.....kCCCBBk....',
    '.....kCCCBBkk...',
    '.....kBBBBsssk..',
    '...kkkNNNNBNNk..',
    '..kNNBBBBBBNNk..',
    '..kNNNNNNBBNNk..',
    '..kNNNBNNBBNNk..',
    '..kNNNNNNBBkk...',
    '..kskNNNNBBk....',
    '...kkNNkkNNk....',
    '....kNNkkNNk....',
    '....kNNkkNNk....',
    '....kkkkkkkkk...',
    '.....kk..kkk....',
  ],
  e: [
    '........kk......',
    '......kkBBk.....',
    '.....kCCCCBk....',
    '.....kBCCBskk...',
    '.....kBBBBssk...',
    '....kkkBBBssk...',
    '...kNNBBBBkk....',
    '...kNNBCBNNNk...',
    '...kNNBBBNNNsk..',
    '...kNNNNNNkkk...',
    '...kNNBBBBk.....',
    '....kkNNkNNk....',
    '.....kNNkNNk....',
    '.....kNNkNNk....',
    '.....kkkkkkkk...',
    '......kk.kkk....',
  ],
  se: [
    '.......kkk......',
    '......kBBBk.....',
    '.....kCCCBBk....',
    '.....kCCCBBk....',
    '.....kBBsskk....',
    '...kkkBBsssk....',
    '..kNNBBBBBBkk...',
    '..kNNBCCBBBNNk..',
    '..kNNBBBBBBNNk..',
    '..kNNNNNNNNNNk..',
    '..kskBBBBBBNsk..',
    '...kkNNkkNNkk...',
    '....kNNkkNNk....',
    '....kNNkkNNk....',
    '....kkkkkkkkk...',
    '.....kk..kkk....',
  ],
  s: [
    '.......kk.......',
    '......kBBk......',
    '.....kCCCBk.....',
    '....kBCCCBBk....',
    '....kBksskBk....',
    '...kkksssskkk...',
    '..kNNBBBBBBNNk..',
    '..kNNBCCBBBNNk..',
    '..kNNBBBBBBNNk..',
    '..kNNNNNNNNNNk..',
    '..kskBBBBBBksk..',
    '...kkNNkkNNkk...',
    '....kNNkkNNk....',
    '....kNNkkNNk....',
    '....kkkkkkkk....',
    '.....kk..kk.....',
  ],
};

/** Where the weapon starts (at the hand) and which way it points, per view; a rifle has `rifle` pixels, a pistol about half. */
const WEAPON_AT: Record<View, { x: number; y: number; dx: number; dy: number; rifle: number; thick?: [number, number] }> = {
  n: { x: 13, y: 8, dx: 0, dy: -1, rifle: 6, thick: [1, 0] },
  ne: { x: 12, y: 5, dx: 1, dy: -1, rifle: 4 },
  e: { x: 12, y: 7, dx: 1, dy: 0, rifle: 4, thick: [0, -1] },
  se: { x: 11, y: 8, dx: 1, dy: 1, rifle: 5 },
  s: { x: 12, y: 11, dx: 0, dy: 1, rifle: 4, thick: [-1, 0] },
};

/** The body with its weapon painted in: light metal along the barrel and a white tip at the muzzle. */
function armed(view: View, weapon: 'rifle' | 'pistol'): string[] {
  const grid = BODY[view].map((r) => [...r]);
  const at = WEAPON_AT[view];
  const length = weapon === 'rifle' ? at.rifle : Math.max(2, Math.round(at.rifle / 2));
  for (let i = 0; i < length; i++) {
    grid[at.y + at.dy * i][at.x + at.dx * i] = i === length - 1 ? 'f' : 'a';
    // a second pixel beside the barrel (not on diagonals) so the weapon shows at game size
    if (at.thick && i < length - 1) grid[at.y + at.dy * i + at.thick[1]][at.x + at.dx * i + at.thick[0]] = 'a';
  }
  return grid.map((r) => r.join(''));
}

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

const FIGHTERS = {} as Record<string, string[]>;
for (const view of ['n', 'ne', 'e', 'se', 's'] as View[]) {
  for (const weapon of ['rifle', 'pistol'] as const) {
    const rows = armed(view, weapon);
    FIGHTERS[`soldier_${weapon}_${view}`] = rows;
    FIGHTERS[`enemy_${weapon}_${view}`] = recolorRows(rows, ENEMY_COLOURS);
  }
}

export const SPRITE_ROWS: Record<SpriteName, string[]> = {
  ...(FIGHTERS as Record<`soldier_${'rifle' | 'pistol'}_${View}` | `enemy_${'rifle' | 'pistol'}_${View}`, string[]>),
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
