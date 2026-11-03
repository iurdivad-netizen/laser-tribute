/**
 * Pieces PixelLab could not make well at 16 px, drawn by hand: a one-character palette and 16 rows of 16 characters
 * (`.` is transparent). A PNG for the same name under art-src/pixellab wins over an entry here.
 */
import { PROP_IMAGES } from './prop-art.mjs';
import { PAINTED_IMAGES } from './prop-paint.mjs';
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
// A steel plate: a dark seam along the bottom and right (the converter mirrors and turns it for the other two floors, so
// nothing here may depend on which way the light falls), a lit edge on the other two sides, four rivets, a grain of
// light and dark specks and two scratches. Seven tones, so a theme's gradient map has something to work with.
const FLOOR_RIVETS = [[2, 2], [12, 2], [2, 12], [12, 12]];
const FLOOR_SCRATCH = [[5, 6], [6, 7], [7, 7], [8, 8], [10, 3], [11, 4], [11, 5]];
const at = (list, x, y) => list.some(([px, py]) => px === x && py === y);
const FLOOR_A = build((x, y) => {
  if (x === 15 || y === 15) return 'b';
  if (at(FLOOR_RIVETS, x, y)) return 'f';
  if (at(FLOOR_RIVETS, x - 1, y - 1)) return 'g';
  if (at(FLOOR_SCRATCH, x, y)) return 'h';
  if (x === 0 || y === 0) return 'e';
  if ((x * 7 + y * 13) % 11 === 0) return 'c';
  if ((x * 5 + y * 3) % 13 === 0) return 'd';
  return 'a';
});

// doors fill the whole tile. Closed: a dark frame with a lit top and left, three planks of two alternating tones with grain,
// two riveted iron bands and a brass handle. Open: the same leaf stands along the left edge over a dark passage.
const DOOR_CLOSED = build((x, y) => {
  if (x === 0 || x === 15 || y === 0 || y === 15) return 'k';
  if (y === 1 || x === 1) return 'l';
  if (y === 14 || x === 14) return 'D';
  if (y === 3 || y === 12) return (x === 3 || x === 8 || x === 12) ? 'R' : 'm';
  if (y === 4 || y === 13) return 'M';
  if ((x === 11 || x === 12) && (y === 8 || y === 9)) return x === 11 && y === 8 ? 'Y' : 'y';
  if (x === 13 && (y === 9 || y === 10)) return 'g';
  if (x === 5 || x === 10) return 'D';
  const plank = x < 5 ? 0 : x < 10 ? 1 : 2;
  if ((x * 3 + y * 5 + plank * 7) % 9 === 0) return 'd';
  return plank === 1 ? 'P' : 'O';
});
const DOOR_OPEN = build((x, y) => {
  if (y === 0 || y === 15 || x === 0) return 'k';
  if (x <= 3) {
    if (x === 3) return 'D';
    if (y === 3 || y === 12) return x === 2 && y === 3 ? 'R' : 'm';
    if (y === 4 || y === 13) return 'M';
    return x === 1 ? 'l' : x === 2 ? 'P' : 'O';
  }
  if (x === 4) return 'k'; // the shadow the leaf throws into the passage
  if (y === 1) return 'r'; // the lintel's shade across the top
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

// walls: four courses of staggered stone blocks. Each block has a lit top row and left edge, a shaded bottom row, one of
// three body tones, and the odd chip; mortar is darker than any block. The wall variants (outlines, lit north edge) are
// made from this by the game.
const WALL_JOINTS = [[7, 15], [3, 11]];
const brickOf = (course, x) => {
  const j = WALL_JOINTS[course % 2];
  return j.filter((jx) => x > jx).length;
};
const WALL = build((x, y) => {
  const course = y >> 2;
  const r = y & 3;
  if (r === 3) return 'm';
  const joints = WALL_JOINTS[course % 2];
  if (joints.includes(x)) return 'n';
  const id = brickOf(course, x);
  const tone = ((course * 5 + id * 3 + (course ^ id)) % 3);
  if (r === 0) return 'L';
  if (joints.includes(x - 1) || (x === 0 && course % 2 === 1 && id === 0)) return 'L';
  if (r === 2) return 'D';
  if ((x * 11 + y * 7 + course * 5) % 17 === 0) return 'c';
  return ['b', 'B', 'v'][tone];
});

export const HAND_IMAGES = {
  floor_a: {
    palette: { a: '#33353c', b: '#1c1d22', c: '#434550', d: '#2a2b33', e: '#3d3f49', f: '#646774', g: '#16171b', h: '#232429' },
    rows: FLOOR_A,
  },
  wall: {
    palette: { L: '#bfc0b3', b: '#a3a498', B: '#999a8d', v: '#aaaa9e', D: '#85867a', c: '#7b7c70', m: '#5d5a50', n: '#6a675c' },
    rows: WALL,
  },
  door_closed: {
    palette: { k: '#0b0c12', O: '#b5651d', P: '#a35a19', d: '#8a4d12', D: '#5a3a1a', l: '#d48a3e', m: '#8a8a99', M: '#5d6178', R: '#c9c9d6', y: '#ffe14d', Y: '#fff3a8', g: '#6b4a00' },
    rows: DOOR_CLOSED,
  },
  door_open: {
    palette: { k: '#0b0c12', O: '#b5651d', P: '#a35a19', D: '#5a3a1a', l: '#d48a3e', m: '#8a8a99', M: '#5d6178', R: '#c9c9d6', q: '#202229', r: '#2b2d36' },
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
  ...PAINTED_IMAGES,
};
