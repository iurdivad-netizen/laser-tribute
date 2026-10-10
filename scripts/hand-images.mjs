/**
 * Pieces PixelLab could not make well at 16 px, drawn by hand: a one-character palette and 16 rows of 16 characters
 * (`.` is transparent). A PNG for the same name under art-src/pixellab wins over an entry here.
 */
import { PROP_IMAGES } from './prop-art.mjs';
const build = (fn) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => fn(x, y)).join(''));
const blank = () => '................';

/** Moves a 16-row piece down (dy > 0) or up (dy < 0); the rows that fall off the tile must be empty. */
function shiftRows(rows, dy) {
  const empty = blank();
  const out = dy >= 0 ? [...Array(dy).fill(empty), ...rows.slice(0, 16 - dy)] : [...rows.slice(-dy), ...Array(-dy).fill(empty)];
  const lost = dy >= 0 ? rows.slice(16 - dy) : rows.slice(0, -dy);
  if (lost.some((r) => r !== empty)) throw new Error('shiftRows would cut off drawn pixels');
  return out;
}

// floor: dark neutral panels with a seam along the bottom and right edge and a few light and dark specks
const FLOOR_LIGHT = [[3, 2], [11, 1], [7, 5], [13, 8], [2, 10], [9, 12], [5, 13], [12, 4]];
const FLOOR_DARK = [[6, 3], [1, 7], [10, 9], [14, 12], [4, 11], [8, 14], [0, 13]];
const FLOOR_A = build((x, y) => {
  if (x === 15 || y === 15) return 'b';
  if (FLOOR_LIGHT.some(([px, py]) => px === x && py === y)) return 'c';
  if (FLOOR_DARK.some(([px, py]) => px === x && py === y)) return 'd';
  return 'a';
});

// doors fill the whole tile: planks with iron bands and a brass handle; open: the leaf stands along the left edge
const DOOR_CLOSED = build((x, y) => {
  if (x === 0 || x === 15 || y === 0 || y === 15) return 'k';
  if (x === 5 || x === 10) return 'D';
  if (y === 3 || y === 12) return 'm';
  if (y === 4 || y === 13) return 'M';
  if ((x === 12 || x === 13) && (y === 8 || y === 9)) return 'y';
  return (x + y) % 7 === 0 ? 'd' : 'O';
});
const DOOR_OPEN = build((x, y) => {
  if (y === 0 || y === 15 || x === 0) return 'k';
  if (x <= 3) return x === 3 ? 'D' : y === 3 || y === 12 ? 'm' : 'O';
  return (x + y * 3) % 11 === 0 ? 'r' : 'q';
});

// items lie in the upper part of the tile and a corpse in the lower part, so a pickup under a body still shows
const ITEM_PISTOL_BASE = [
  ...Array(6).fill(blank()),
  '....kkkkkkkk....',
  '...kaaaaaaaak...',
  '...kkkkkAAkkk...',
  '......kOOk......',
  '......kOOk......',
  '......kkkk......',
  ...Array(4).fill(blank()),
];
const ITEM_RIFLE_BASE = [
  ...Array(6).fill(blank()),
  '.kkkkkkkkkkkkkk.',
  '.kOOOOaaaaaaaak.',
  '.kkkAAAkkkkkkkk.',
  '....kAAk........',
  '....kkkk........',
  ...Array(5).fill(blank()),
];
const ITEM_GRENADE_BASE = [
  ...Array(4).fill(blank()),
  '......kk........',
  '.....kyyk.......',
  '....kkkkkk......',
  '...keeeeeEk.....',
  '...keeeeeEk.....',
  '...keeeeEEk.....',
  '...kEEEEEEk.....',
  '....kkkkkk......',
  ...Array(4).fill(blank()),
];

const ITEM_SHOTGUN_BASE = [
  ...Array(5).fill(blank()),
  '.kkkkkkkkkkkkkk.',
  '.kaaaaaaaaaaaak.',
  '.kAAAAAAAAAAAAk.',
  '.kkkOOOkkkkkkkk.',
  '....kOOk........',
  '....kkkk........',
  ...Array(5).fill(blank()),
];
const ITEM_SMG_BASE = [
  ...Array(5).fill(blank()),
  '..kkkkkkkkkk....',
  '..kaaaaaaaaakk..',
  '..kAAAAAAAAAak..',
  '..kkkOOkkkkkk...',
  '.....kOOk.......',
  '.....kaak.......',
  '.....kAAk.......',
  '.....kkkk.......',
  ...Array(3).fill(blank()),
];
const ITEM_SNIPER_BASE = [
  ...Array(4).fill(blank()),
  '....kkkk........',
  '....kAAk........',
  '.kkkkkkkkkkkkkk.',
  '.kOOOOaaaaaaaaa.',
  '.kkkAAAkkkkkkkk.',
  '....kAAk........',
  '....kkkk........',
  ...Array(5).fill(blank()),
];
const ITEM_SHOTGUN = shiftRows(ITEM_SHOTGUN_BASE, -4);
const ITEM_SMG = shiftRows(ITEM_SMG_BASE, -4);
const ITEM_SNIPER = shiftRows(ITEM_SNIPER_BASE, -4);

const ITEM_PISTOL = shiftRows(ITEM_PISTOL_BASE, -4);
const ITEM_RIFLE = shiftRows(ITEM_RIFLE_BASE, -4);
const ITEM_GRENADE = shiftRows(ITEM_GRENADE_BASE, -4);

// a fallen soldier seen from above: helmet at the left, torso, legs to the right, a pool of blood below
const CORPSE_BASE = [
  ...Array(5).fill(blank()),
  '..kHHHkkkkkkkk..',
  '.kHhHHkTTTTTTTk.',
  '.kHHHHkTtTTTTTk.',
  '.kHHHSkTTTTTTLLk',
  '.kHHHHkTTTTTTLLk',
  '.kkHHkkTtTTTLLkk',
  '..kkkkkkkkkkkkk.',
  '....uuuuuuuu....',
  blank(),
  blank(),
  blank(),
];
const CORPSE = shiftRows(CORPSE_BASE, 2);

export const HAND_IMAGES = {
  floor_a: { palette: { a: '#34353a', b: '#2a2b2f', c: '#3f4046', d: '#24252a' }, rows: FLOOR_A },
  door_closed: {
    palette: { k: '#0b0c12', O: '#b5651d', d: '#8a4d12', D: '#5a3a1a', m: '#8a8a99', M: '#5d6178', y: '#ffe14d' },
    rows: DOOR_CLOSED,
  },
  door_open: {
    palette: { k: '#0b0c12', O: '#b5651d', D: '#5a3a1a', m: '#8a8a99', q: '#202229', r: '#2b2d36' },
    rows: DOOR_OPEN,
  },
  item_pistol: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_PISTOL },
  item_rifle: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_RIFLE },
  item_grenade: { palette: { k: '#0b0c12', e: '#3cb371', E: '#26734a', y: '#ffe14d' }, rows: ITEM_GRENADE },
  item_shotgun: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_SHOTGUN },
  item_smg: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_SMG },
  item_sniper: { palette: { k: '#0b0c12', a: '#d0d0d0', A: '#8a8a99', O: '#b5651d' }, rows: ITEM_SNIPER },
  corpse_player: {
    palette: { k: '#0b0a09', H: '#174fa2', h: '#80bdfb', T: '#1a60c2', t: '#2a74cc', S: '#e6b5aa', L: '#121d3a', u: '#b3262c' },
    rows: CORPSE,
  },
  corpse_enemy: {
    palette: { k: '#0a0202', H: '#852131', h: '#dc5262', T: '#922634', t: '#b66d57', S: '#e4b1a8', L: '#272e35', u: '#b3262c' },
    rows: CORPSE,
  },
  ...PROP_IMAGES,
};
