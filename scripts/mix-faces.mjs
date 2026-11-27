// Mixes soldier faces from six straight-front portraits: head, eyes, mouth and clothes can each come from a different one.
// usage: node scripts/mix-faces.mjs <sheet.png>   writes every allowed face to one contact sheet
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { decodePng } from './figures-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'art-src/archive/pixellab-faces';
const NEW = 'art-src/faces';
const BG = [20, 18, 19];
const flat = (bg) => (c) => c.reduce((sum, v, i) => sum + Math.abs(v - bg[i]), 0) <= 8;

// Per portrait: the background test, the rows of its eyes and mouth, and its jaw as [column, lowest head row] points.
// All rows are measured after the dy shift, except maxY (last background row), which is a source row.
// A new portrait needs these measured by hand.
const SOURCES = {
  chen: {
    file: `${OLD}/face_chen.png`, dy: -1, maxY: 55, eyes: 29, mouth: 41.5,
    isBg: ([r, g, b]) => b >= r + 2 && r + g + b > 90,
    jaw: [[22, 40], [24, 44], [27, 48], [29, 49], [35, 49], [37, 47], [39, 44], [41, 40]],
  },
  dubois: {
    file: `${OLD}/face_dubois.png`, maxY: 55, eyes: 29, mouth: 41.5,
    isBg: ([r, g, b]) => g >= r - 2 && r + g + b > 30,
    jaw: [[19, 40], [21, 45], [23, 48], [26, 50], [29, 52], [35, 52], [38, 50], [41, 48], [43, 45], [45, 40]],
  },
  woman: {
    file: `${NEW}/face_woman.png`, eyes: 28, mouth: 44, isBg: flat([38, 41, 34]),
    jaw: [[20, 40], [22, 45], [25, 49], [28, 51], [35, 51], [38, 49], [41, 46], [43, 42], [44, 40]],
  },
  veteran: {
    file: `${NEW}/face_veteran.png`, eyes: 27.5, mouth: 43.5, isBg: flat([34, 40, 43]),
    jaw: [[16, 40], [17, 45], [19, 48], [22, 50], [25, 52], [28, 53], [35, 53], [39, 52], [42, 50], [45, 46], [46, 40]],
  },
  man: {
    file: `${NEW}/face_man.png`, eyes: 25.5, mouth: 41, isBg: flat([55, 57, 47]),
    jaw: [[18, 40], [20, 43], [22, 46], [25, 48], [28, 50], [35, 50], [38, 49], [41, 46], [43, 42], [44, 40]],
  },
  blonde: {
    file: `${NEW}/face_blonde.png`, eyes: 28.5, mouth: 42,
    locks: 47, // loose hair hangs beside the neck down to this row
    // shaded background: dark grey-teal, but not the black outline or the navy collar
    isBg: ([r, g, b]) => r <= 52 && g <= 60 && r + g + b >= 60 && g >= r - 2 && b >= r - 3 && b - r <= 14,
    jaw: [[18, 40], [20, 43], [22, 46], [25, 48], [28, 50], [35, 50], [38, 48], [41, 44], [43, 40]],
  },
};

export const FACES = Object.keys(SOURCES);

// Swaps that looked wrong when judged by eye. A face may always keep its own parts.
const EYE_DONORS = ['dubois', 'man', 'blonde']; // chen: blank with a dark bar; woman: black eyes; veteran: red nose mark
const MOUTH_DONORS = ['woman', 'veteran', 'man']; // chen: black stroke by the lips; dubois: dripping grin; blonde: blood mark
const NEVER_STUBBLE = ['woman', 'blonde']; // heads that never take the veteran's mouth
// head: clothes that leave a black block under its chin
const BAD_NECK = { chen: ['woman', 'veteran'], man: ['woman', 'veteran'], blonde: ['woman'] };

export function isAllowed({ head, eyes, mouth, clothes }) {
  return [head, eyes, mouth, clothes].every((n) => FACES.includes(n))
    && (eyes === head || EYE_DONORS.includes(eyes))
    && (mouth === head || (MOUTH_DONORS.includes(mouth) && !(mouth === 'veteran' && NEVER_STUBBLE.includes(head))))
    && !BAD_NECK[head]?.includes(clothes);
}

export function allowedPicks() {
  const picks = [];
  for (const head of FACES) for (const eyes of FACES) for (const mouth of FACES) for (const clothes of FACES) {
    const pick = { head, eyes, mouth, clothes };
    if (isAllowed(pick)) picks.push(pick);
  }
  return picks;
}

const canvas = (width, height, colour) => {
  const img = { width, height, rgba: new Uint8Array(width * height * 4) };
  for (let i = 0; i < width * height; i++) img.rgba.set([...colour, 255], i * 4);
  return img;
};
const get = (img, x, y) => Array.from(img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
const set = (img, x, y, c) => img.rgba.set([c[0], c[1], c[2], 255], (y * img.width + x) * 4);
const clamp = (v) => Math.max(0, Math.min(63, v));

/** The portrait on the shared background, shifted into place, with its mean skin colour. */
function prepare({ file, dy = 0, maxY = 63, isBg, ...rest }) {
  const src = decodePng(readFileSync(join(ROOT, file)));
  const outside = new Set();
  const todo = [];
  for (let i = 0; i < 64; i++) todo.push([i, 0], [0, i], [63, i]);
  while (todo.length) {
    const [x, y] = todo.pop();
    if (x < 0 || x > 63 || y < 0 || y > maxY || outside.has(y * 64 + x) || !isBg(get(src, x, y))) continue;
    outside.add(y * 64 + x);
    todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const clean = canvas(64, 64, BG);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (!outside.has(y * 64 + x)) set(clean, x, y, get(src, x, y));
  const img = canvas(64, 64, BG);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) set(img, x, y, get(clean, x, clamp(y - dy)));

  // drop background specks: connected groups under 20 pixels
  const left = new Set();
  for (let i = 0; i < 4096; i++) if (String(get(img, i % 64, i >> 6)) !== String(BG)) left.add(i);
  for (const start of left) {
    const group = [start];
    left.delete(start);
    for (const i of group) {
      for (const d of [-65, -64, -63, -1, 1, 63, 64, 65]) {
        if (Math.abs(((i + d) % 64) - (i % 64)) <= 1 && left.delete(i + d)) group.push(i + d);
      }
    }
    if (group.length < 20) for (const i of group) set(img, i % 64, i >> 6, BG);
  }

  // skin colour: the mean over the nose bridge and cheeks
  const skin = [0, 0, 0];
  for (let y = 31; y <= 38; y++) for (let x = 26; x <= 38; x++) get(img, x, y).forEach((v, i) => { skin[i] += v / (8 * 13); });
  // tone() divides by these and takes their logarithm
  if (skin.some((v) => v < 1 || v > 254)) throw new Error(`no usable skin colour in ${file}`);
  return { ...rest, img, skin };
}

const PREPARED = Object.fromEntries(Object.entries(SOURCES).map(([name, source]) => [name, prepare(source)]));

/** Lowest head row in a column; 40 outside the jaw. */
function jaw({ jaw: points }, x) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x >= x0 && x <= x1) return Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return 40;
}

/** Moves a colour from the donor's skin tone to the base's. Darkening scales; lightening uses a gamma so nothing clips. */
const tone = (colour, base, donor) => colour.map((v, i) => {
  const gain = base.skin[i] / donor.skin[i];
  return Math.round(gain < 1 ? v * gain : 255 * (v / 255) ** (Math.log(base.skin[i] / 255) / Math.log(donor.skin[i] / 255)));
});

const isSkin = ([r, g, b]) => r > 50 && r > g * 1.2 && r > b * 1.3;

/** Puts the head (everything down to its jaw) over another portrait's body. */
function dress(head, base, donor) {
  const out = canvas(64, 64, BG);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const mine = jaw(base, x);
    if (y <= mine) { set(out, x, y, get(head, x, y)); continue; }
    const theirs = jaw(donor, x);
    // a shorter chin leaves a gap under it: repeat the donor's first neck row into the gap only, so the collar is not warped
    const sy = mine > 40 && theirs > mine && y <= theirs ? theirs + 1 : y;
    let c = mine === 40 && y <= theirs ? BG : get(donor.img, x, Math.min(63, sy));
    // hair hanging beside the neck belongs to the donor's head, not its clothes
    const beside = x < donor.jaw[0][0] || x > donor.jaw.at(-1)[0];
    if (beside && y < (donor.locks ?? 0)) c = BG;
    if (x >= 22 && x <= 42 && isSkin(c)) c = tone(c, base, donor);
    set(out, x, y, c);
  }
  return out;
}

const PATCHES = { eyes: [11.5, 4.6], mouth: [8.5, 4.8] }; // ellipse radii, centred on column 32

/** A 64 x 64 face. Throws for a swap that is not allowed. */
export function mixFace(pick) {
  if (!isAllowed(pick)) throw new Error(`face swap not allowed: ${JSON.stringify(pick)}`);
  const base = PREPARED[pick.head];
  const out = canvas(64, 64, BG);
  out.rgba.set(base.img.rgba);
  for (const [part, [rx, ry]] of Object.entries(PATCHES)) {
    const donor = PREPARED[pick[part]];
    if (donor === base) continue;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (((x - 32) / rx) ** 2 + ((y - base[part]) / ry) ** 2 > 1) continue;
      const sy = clamp(y + Math.round(donor[part] - base[part])); // sample the donor at its own feature row
      // never copy chin outline, collar or background into a face
      if (y >= jaw(base, x) || sy >= jaw(donor, x) - 2) continue;
      set(out, x, y, tone(get(donor.img, x, sy), base, donor));
    }
  }
  return pick.clothes === pick.head ? out : dress(out, base, PREPARED[pick.clothes]);
}

function encodePng({ width, height, rgba }) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8; // bit depth
  head[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([magic, chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node scripts/mix-faces.mjs <sheet.png>');
  const picks = allowedPicks();
  const columns = 20;
  const scale = 2;
  const cell = 64 * scale + 4;
  const sheet = canvas(columns * cell, Math.ceil(picks.length / columns) * cell, [120, 120, 120]);
  picks.forEach((pick, n) => {
    const face = mixFace(pick);
    const ox = (n % columns) * cell + 2;
    const oy = Math.floor(n / columns) * cell + 2;
    for (let y = 0; y < 64 * scale; y++) for (let x = 0; x < 64 * scale; x++) {
      set(sheet, ox + x, oy + y, get(face, Math.floor(x / scale), Math.floor(y / scale)));
    }
  });
  writeFileSync(file, encodePng(sheet));
  console.log(`wrote ${file}: ${picks.length} faces`);
}
