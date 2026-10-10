import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { HAND_IMAGES } from './hand-images.mjs';

export const SIDES = ['squad', 'enemy'];
export const VIEWS = ['n', 'ne', 'e', 'se', 's'];
const EXPECTED_WIDTH = 16;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Decodes an 8-bit, non-interlaced PNG (colour type 6, 2 or 3) to RGBA. */
export function decodePng(bytes) {
  const b = Buffer.from(bytes);
  let p = 8;
  let width = 0;
  let height = 0;
  let ct = 0;
  const idat = [];
  let plte = null;
  let trns = null;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('latin1', p + 4, p + 8);
    const d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = d.readUInt32BE(0);
      height = d.readUInt32BE(4);
      ct = d[9];
      if (d[8] !== 8 || d[12] !== 0) throw new Error('unsupported PNG: need 8-bit and not interlaced');
    } else if (type === 'IDAT') idat.push(d);
    else if (type === 'PLTE') plte = d;
    else if (type === 'tRNS') trns = d;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 3 ? 1 : 0;
  if (!bpp) throw new Error(`unsupported PNG colour type ${ct}`);
  if (ct === 3 && !plte) throw new Error('palette PNG without PLTE');
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  let prev = Buffer.alloc(width * bpp);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (width * bpp + 1)];
    const line = Buffer.from(raw.subarray(y * (width * bpp + 1) + 1, (y + 1) * (width * bpp + 1)));
    for (let x = 0; x < width * bpp; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const u = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += u;
      else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) {
        const pp = a + u - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - u);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      }
      line[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (ct === 3) {
        const i = line[x];
        rgba[o] = plte[i * 3];
        rgba[o + 1] = plte[i * 3 + 1];
        rgba[o + 2] = plte[i * 3 + 2];
        rgba[o + 3] = trns && i < trns.length ? trns[i] : 255;
      } else {
        rgba[o] = line[x * bpp];
        rgba[o + 1] = line[x * bpp + 1];
        rgba[o + 2] = line[x * bpp + 2];
        rgba[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
      }
    }
    prev = line;
  }
  return { width, height, rgba };
}

const hex2 = (n) => n.toString(16).padStart(2, '0');

/** The five views of both sides, cropped to one width and with every view's feet on the bottom row. */
export function buildFigureData(dir) {
  const images = {};
  let x0 = Infinity;
  let x1 = -Infinity;
  let tallest = 0;
  for (const side of SIDES) {
    images[side] = {};
    for (const view of VIEWS) {
      const img = decodePng(readFileSync(join(dir, side, `${view}.png`)));
      let top = Infinity;
      let bottom = -Infinity;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          if (img.rgba[(y * img.width + x) * 4 + 3] < 128) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      if (bottom < 0) throw new Error(`${side}/${view}.png has no opaque pixel`);
      tallest = Math.max(tallest, bottom - top + 1);
      images[side][view] = { img, bottom };
    }
  }
  const width = x1 - x0 + 1;
  if (width !== EXPECTED_WIDTH) throw new Error(`the figures are ${width} px wide, expected ${EXPECTED_WIDTH}`);
  const sides = {};
  for (const side of SIDES) {
    const palette = [];
    const views = {};
    for (const view of VIEWS) {
      const { img, bottom } = images[side][view];
      const rows = [];
      for (let r = 0; r < tallest; r++) {
        const y = bottom - (tallest - 1 - r);
        let row = '';
        for (let x = x0; x <= x1; x++) {
          const o = (y * img.width + x) * 4;
          if (y < 0 || img.rgba[o + 3] < 128) {
            row += '.';
            continue;
          }
          const hex = `#${hex2(img.rgba[o])}${hex2(img.rgba[o + 1])}${hex2(img.rgba[o + 2])}`;
          let i = palette.indexOf(hex);
          if (i < 0) {
            palette.push(hex);
            i = palette.length - 1;
          }
          if (i >= DIGITS.length) throw new Error(`${side} uses more than ${DIGITS.length} colours`);
          row += DIGITS[i];
        }
        rows.push(row);
      }
      views[view] = rows;
    }
    sides[side] = { palette, views };
  }
  return { width, height: tallest, sides };
}

/** The text of src/art/figures.generated.ts. */
export function renderModule(data) {
  return [
    '// Generated by scripts/build-figures.mjs from art-src/pixellab. Do not edit by hand: run `node scripts/build-figures.mjs`.',
    '',
    `export const FIGURE_WIDTH = ${data.width};`,
    `export const FIGURE_HEIGHT = ${data.height};`,
    '',
    "export const FIGURE_DATA: Record<'squad' | 'enemy', { palette: string[]; views: Record<'n' | 'ne' | 'e' | 'se' | 's', string[]> }> =",
    `${JSON.stringify(data.sides, null, 2)};`,
    '',
  ].join('\n');
}

export const IMAGE_NAMES = [
  'floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open',
  'item_rifle', 'item_pistol', 'item_grenade', 'item_shotgun', 'item_smg', 'item_sniper', 'corpse_player', 'corpse_enemy',
  'prop_supply_crate', 'prop_oil_drum', 'prop_wood_crate', 'prop_barrel', 'prop_machine', 'prop_tank', 'prop_boulder', 'prop_rocks', 'prop_pillar', 'prop_urn',
];
const IMAGE_SOURCES = {
  floor_a: 'tiles/floor', wall: 'tiles/wall', door_closed: 'tiles/door_closed', door_open: 'tiles/door_open',
  item_rifle: 'items/rifle', item_pistol: 'items/pistol', item_grenade: 'items/grenade',
  item_shotgun: 'items/shotgun', item_smg: 'items/smg', item_sniper: 'items/sniper',
  corpse_player: 'corpses/squad', corpse_enemy: 'corpses/enemy',
  prop_supply_crate: 'props/supply_crate',
  prop_oil_drum: 'props/oil_drum',
  prop_wood_crate: 'props/wood_crate',
  prop_barrel: 'props/barrel',
  prop_machine: 'props/machine',
  prop_tank: 'props/tank',
  prop_boulder: 'props/boulder',
  prop_rocks: 'props/rocks',
  prop_pillar: 'props/pillar',
  prop_urn: 'props/urn',
};
const SIZE = 16;

/** A 16x16 grid of hex colours (null = transparent) from a PNG, else from a hand-drawn entry. */
function loadImage(dir, name) {
  const path = join(dir, `${IMAGE_SOURCES[name]}.png`);
  const grid = [];
  if (existsSync(path)) {
    const img = decodePng(readFileSync(path));
    if (img.width !== SIZE || img.height !== SIZE) throw new Error(`${name}: ${path} is ${img.width}x${img.height}, expected ${SIZE}x${SIZE}`);
    for (let y = 0; y < SIZE; y++) {
      const row = [];
      for (let x = 0; x < SIZE; x++) {
        const o = (y * SIZE + x) * 4;
        row.push(img.rgba[o + 3] < 128 ? null : `#${hex2(img.rgba[o])}${hex2(img.rgba[o + 1])}${hex2(img.rgba[o + 2])}`);
      }
      grid.push(row);
    }
    return grid;
  }
  const hand = HAND_IMAGES[name];
  if (!hand) throw new Error(`${name}: no PNG at ${path} and no entry in scripts/hand-images.mjs`);
  if (hand.rows.length !== SIZE) throw new Error(`${name}: hand-drawn image has ${hand.rows.length} rows`);
  for (const line of hand.rows) {
    if (line.length !== SIZE) throw new Error(`${name}: hand-drawn row is ${line.length} wide`);
    grid.push([...line].map((ch) => {
      if (ch === '.') return null;
      if (!hand.palette[ch]) throw new Error(`${name}: unknown colour '${ch}'`);
      return hand.palette[ch];
    }));
  }
  return grid;
}

const flipH = (g) => g.map((row) => [...row].reverse());
const turn180 = (g) => [...g].reverse().map((row) => [...row].reverse());

/** The eleven 16x16 images (tiles, doors, items, corpses) with a palette each; floor_b and floor_c come from floor_a. */
export function buildImageData(dir) {
  const grids = {};
  for (const name of Object.keys(IMAGE_SOURCES)) grids[name] = loadImage(dir, name);
  for (const name of ['floor_a', 'wall']) {
    if (grids[name].some((row) => row.includes(null))) throw new Error(`${name} must fill the whole tile`);
  }
  for (const name of ['door_closed', 'door_open']) {
    grids[name] = grids[name].map((row, y) => row.map((c, x) => c ?? grids.floor_a[y][x])); // doors are solid: over the floor
  }
  grids.floor_b = flipH(grids.floor_a);
  grids.floor_c = turn180(grids.floor_a);
  const images = {};
  for (const name of IMAGE_NAMES) {
    const palette = [];
    const rows = grids[name].map((row) => row.map((c) => {
      if (c === null) return '.';
      let i = palette.indexOf(c);
      if (i < 0) {
        palette.push(c);
        i = palette.length - 1;
      }
      if (i >= DIGITS.length) throw new Error(`${name} uses more than ${DIGITS.length} colours`);
      return DIGITS[i];
    }).join(''));
    images[name] = { palette, rows };
  }
  return { width: SIZE, height: SIZE, images };
}

/** The text of src/art/images.generated.ts. */
export function renderImagesModule(data) {
  return [
    '// Generated by scripts/build-figures.mjs from art-src/pixellab (and scripts/hand-images.mjs). Do not edit by hand.',
    '',
    `export type ImageName = ${IMAGE_NAMES.map((n) => `'${n}'`).join(' | ')};`,
    '',
    'export const IMAGE_DATA: Record<ImageName, { palette: string[]; rows: string[] }> =',
    `${JSON.stringify(data.images, null, 2)};`,
    '',
  ].join('\n');
}
