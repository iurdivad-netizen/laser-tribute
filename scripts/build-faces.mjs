// Cleans the six face portraits and bakes them into src/art/faces.generated.ts, so the game can mix faces without files.
// usage: node scripts/build-faces.mjs   (after changing a portrait or its measurements)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BACKGROUND, DIGITS, FACES, canvas, clamp, get, set } from '../src/art/facemix.ts';
import { decodePng } from './figures-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OLD = 'art-src/archive/pixellab-faces';
const NEW = 'art-src/faces';
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
  const clean = canvas(64, 64, BACKGROUND);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (!outside.has(y * 64 + x)) set(clean, x, y, get(src, x, y));
  const img = canvas(64, 64, BACKGROUND);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) set(img, x, y, get(clean, x, clamp(y - dy)));

  // drop background specks: connected groups under 20 pixels
  const left = new Set();
  for (let i = 0; i < 4096; i++) if (String(get(img, i % 64, i >> 6)) !== String(BACKGROUND)) left.add(i);
  for (const start of left) {
    const group = [start];
    left.delete(start);
    for (const i of group) {
      for (const d of [-65, -64, -63, -1, 1, 63, 64, 65]) {
        if (Math.abs(((i + d) % 64) - (i % 64)) <= 1 && left.delete(i + d)) group.push(i + d);
      }
    }
    if (group.length < 20) for (const i of group) set(img, i % 64, i >> 6, BACKGROUND);
  }

  // skin colour: the mean over the nose bridge and cheeks
  const skin = [0, 0, 0];
  for (let y = 31; y <= 38; y++) for (let x = 26; x <= 38; x++) get(img, x, y).forEach((v, i) => { skin[i] += v / (8 * 13); });
  // tone() divides by these and takes their logarithm
  if (skin.some((v) => v < 1 || v > 254)) throw new Error(`no usable skin colour in ${file}`);
  return { ...rest, rgba: img.rgba, skin };
}

export const preparePortraits = () => Object.fromEntries(FACES.map((name) => [name, prepare(SOURCES[name])]));

export function renderFacesModule(portraits) {
  const entries = Object.entries(portraits).map(([name, { rgba, ...measures }]) => {
    const palette = [];
    const rows = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => {
      const hex = get({ rgba }, x, y).map((v) => v.toString(16).padStart(2, '0')).join('');
      if (!palette.includes(hex)) palette.push(hex);
      return palette.indexOf(hex);
    }));
    if (palette.length > DIGITS.length) throw new Error(`portrait ${name} has ${palette.length} colours; the format holds ${DIGITS.length}`);
    const fields = Object.entries(measures).map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`);
    const lines = rows.map((row) => `      '${row.map((i) => DIGITS[i]).join('')}',`);
    return `  ${name}: {\n${fields.join('\n')}\n    palette: ${JSON.stringify(palette)},\n    rows: [\n${lines.join('\n')}\n    ],\n  },`;
  });
  return `// Generated by scripts/build-faces.mjs from the portraits in art-src. Do not edit.
import type { BakedPortrait, FaceName } from './facemix';

export const FACE_DATA: Record<FaceName, BakedPortrait> = {
${entries.join('\n')}
};
`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const portraits = preparePortraits();
  writeFileSync(join(ROOT, 'src/art/faces.generated.ts'), renderFacesModule(portraits));
  console.log(`wrote src/art/faces.generated.ts: ${Object.keys(portraits).length} portraits`);
}
