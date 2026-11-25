import { FACE_PARTS, type FaceSpec } from '../core/world/faces';

export interface Pixels {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
}

type Rgb = readonly [number, number, number];

// The faces are laid out on a 32 x 32 grid. The 64 px face doubles each cell; the 16 px face keeps the likeliest cell of each 2 x 2 block.
const N = 32;

const lighten = (c: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(c[i] + (255 - c[i]) * t)) as unknown as Rgb;
const blend = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as unknown as Rgb;

const SKIN: readonly (readonly [Rgb, Rgb])[] = [
  [[238, 200, 168], [200, 156, 126]], [[224, 178, 134], [184, 136, 98]], [[198, 144, 100], [158, 106, 72]],
  [[170, 116, 76], [132, 86, 56]], [[130, 86, 58], [98, 62, 42]], [[92, 60, 44], [66, 40, 30]],
];
const HAIR: readonly (readonly [Rgb, Rgb])[] = [
  [[34, 30, 34], [16, 14, 18]], [[84, 56, 38], [52, 34, 24]], [[168, 82, 44], [116, 52, 30]], [[212, 176, 92], [160, 126, 60]],
  [[150, 150, 156], [100, 100, 108]], [[226, 226, 230], [170, 170, 180]], [[110, 50, 42], [70, 30, 28]], [[60, 64, 84], [34, 36, 54]],
];
const ACCENT: readonly Rgb[] = [[0, 0, 0], [232, 214, 200], [150, 150, 160], [168, 40, 40], [0, 0, 0]]; // none, scar, glasses, headband, freckles
const BACKGROUND: Rgb = [20, 18, 19];
const FIXED: Record<string, Rgb> = {
  k: [8, 8, 10], w: [236, 236, 230], p: [24, 22, 30], m: [96, 40, 40], c: [76, 84, 56], C: [52, 58, 38],
};
const FEATURES = 'kwpmgx'; // cells that win a tie when the small face drops resolution

type Cells = string[][];
const MID = (N - 1) / 2;
const dist = (x: number) => x - MID; // distance from the middle line, negative on the lit (left) side
/** An egg: wide at the brow, narrowing to a chin. */
const inHead = (x: number, y: number) => {
  const squeeze = y > 16 ? 1 - 0.42 * ((y - 16) / 9.5) ** 2 : 1;
  return (dist(x) / (9.5 * squeeze)) ** 2 + ((y - 13) / 11.5) ** 2 <= 1;
};
const put = (g: Cells, x: number, y: number, c: string) => {
  if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c;
};
const each = (f: (x: number, y: number) => void) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) f(x, y);
};
/** Draws `row` starting at column `left`, and its mirror image on the other side of the face. */
const pair = (g: Cells, left: number, y: number, row: string) => {
  for (let i = 0; i < row.length; i++) {
    put(g, left + i, y, row[i]);
    put(g, N - 1 - (left + i), y, row[i]);
  }
};
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Hair of each style: 'h' hair, null nothing. The light and dark edges are shaded afterwards. */
const HAIR_STYLES: ((x: number, y: number) => string | null)[] = [
  // buzz cut
  (x, y) => (inHead(x, y) && (y <= 5 || (Math.abs(dist(x)) >= 8 && y <= 10)) ? 'h' : null),
  // short
  (x, y) => (inHead(x, y) && (y <= 7 || (Math.abs(dist(x)) >= 8.2 && y <= 13)) ? 'h' : null),
  // long, falling past the shoulders
  (x, y) => {
    const side = Math.abs(dist(x)) >= 7.6 && Math.abs(dist(x)) <= 11.5 && y >= 5 && y <= 27;
    return (inHead(x, y) && y <= 7) || side ? 'h' : null;
  },
  // bald
  () => null,
  // mohawk
  (x, y) => (Math.abs(dist(x)) <= 2.2 && y <= 8 ? 'h' : null),
  // parted and swept
  (x, y) => (inHead(x, y) && (y <= 6 || (dist(x) < -3 && y <= 8) || (Math.abs(dist(x)) >= 8.4 && y <= 11)) ? 'h' : null),
  // curly, standing off the head
  (x, y) => {
    const r = 12.4 * (1 + 0.05 * Math.sin(x * 1.9 + y * 0.7));
    const cloud = (dist(x) / r) ** 2 + ((y - 8) / 9.5) ** 2 <= 1;
    return cloud && (y <= 8 || Math.abs(dist(x)) >= 8.6) && !(inHead(x, y) && y > 8) ? 'h' : null;
  },
  // short with a bun on top
  (x, y) => ((inHead(x, y) && y <= 7) || inEllipse(x, y, MID, 1.5, 3.2, 2.6) ? 'h' : null),
];

const EYES: ((g: Cells) => void)[] = [
  (g) => { pair(g, 10, 12, 'dddd'); pair(g, 10, 13, 'wppw'); },
  (g) => { pair(g, 10, 12, 'dddd'); pair(g, 10, 13, 'pppp'); },
  (g) => { pair(g, 10, 12, 'wppw'); pair(g, 10, 13, 'wppw'); },
  (g) => { pair(g, 10, 13, 'wppw'); pair(g, 10, 14, 'dddd'); },
  (g) => { pair(g, 10, 12, 'dddd'); pair(g, 10, 13, 'wwpp'); },
];
const BROWS: ((g: Cells) => void)[] = [
  (g) => pair(g, 10, 10, 'gggg'),
  (g) => { pair(g, 10, 9, 'gg'); pair(g, 12, 10, 'gg'); },
  (g) => { pair(g, 10, 9, 'gggg'); pair(g, 10, 10, 'gggg'); },
  (g) => { pair(g, 10, 10, 'g'); pair(g, 11, 9, 'gg'); pair(g, 13, 10, 'g'); },
];
const MOUTHS: ((g: Cells) => void)[] = [
  (g) => { for (let x = 14; x <= 17; x++) put(g, x, 21, 'm'); },
  (g) => { put(g, 13, 20, 'm'); put(g, 18, 20, 'm'); for (let x = 14; x <= 17; x++) put(g, x, 21, 'm'); },
  (g) => { put(g, 13, 22, 'm'); put(g, 18, 22, 'm'); for (let x = 14; x <= 17; x++) put(g, x, 21, 'm'); },
  (g) => { for (let x = 14; x <= 17; x++) { put(g, x, 21, 'w'); put(g, x, 22, 'm'); } },
];

/** The edges of the hair: lit along the top, dark along the bottom, so it reads as a solid mass. */
function shadeHair(g: Cells) {
  const hair = (c: string | undefined) => c === 'h' || c === 'H' || c === 'g';
  const next = g.map((row) => row.slice());
  each((x, y) => {
    if (g[y][x] !== 'h') return;
    if (!hair(g[y + 1]?.[x])) next[y][x] = 'g';
    else if (!hair(g[y - 1]?.[x]) && y <= 7 && dist(x) < 4) next[y][x] = 'H';
  });
  each((x, y) => { g[y][x] = next[y][x]; });
}

function layout(spec: FaceSpec): Cells {
  const g: Cells = Array.from({ length: N }, () => Array<string>(N).fill('b'));
  each((x, y) => {
    const ax = Math.abs(dist(x));
    if (y >= 22 && ax <= 3.6) g[y][x] = 'd'; // neck
    if (y >= 25 && ax <= 7 + (y - 25) * 4) g[y][x] = y >= 30 ? 'C' : 'c'; // shoulders
    if (y >= 25 && ax <= 3.4 - (y - 25) * 0.7) g[y][x] = 'd'; // the opening of the collar
    if (inHead(x, y)) {
      const cheek = inEllipse(x, y, 11, 15.5, 2.6, 2) || inEllipse(x, y, 13, 6.5, 3.6, 1.6);
      g[y][x] = y >= 22.5 || dist(x) >= 6.5 ? 'd' : cheek ? 'l' : 's';
    }
  });
  each((x, y) => {
    const c = HAIR_STYLES[spec.hairStyle](x, y);
    if (c) g[y][x] = c;
  });
  if (spec.beard === 1) each((x, y) => { if (inHead(x, y) && y >= 18) g[y][x] = 'u'; });
  if (spec.beard === 2) { for (let x = 12; x <= 19; x++) put(g, x, 19, 'h'); put(g, 12, 20, 'h'); put(g, 19, 20, 'h'); }
  if (spec.beard === 3) each((x, y) => { if (inHead(x, y) && (y >= 17 || (Math.abs(dist(x)) >= 7.5 && y >= 12))) g[y][x] = 'h'; });
  shadeHair(g);
  for (const y of [14, 15, 16]) put(g, 17, y, 'd'); // the nose: shaded on the far side, lit on the near one
  for (let x = 14; x <= 17; x++) put(g, x, 17, 'd');
  put(g, 15, 14, 'l');
  put(g, 15, 15, 'l');
  MOUTHS[spec.mouth](g);
  EYES[spec.eyes](g);
  BROWS[spec.brows](g);
  if (spec.extra === 1) for (const [x, y] of [[21, 12], [21, 13], [20, 14], [20, 15], [19, 16]]) put(g, x, y, 'x');
  if (spec.extra === 2) {
    for (let x = 9; x <= 14; x++) { put(g, x, 12, 'x'); put(g, x, 14, 'x'); put(g, N - 1 - x, 12, 'x'); put(g, N - 1 - x, 14, 'x'); }
    for (const x of [9, 14, 15, 16, 17, 22]) put(g, x, 13, 'x');
  }
  if (spec.extra === 3) each((x, y) => { if (inHead(x, y) && (y === 5 || y === 6)) g[y][x] = 'x'; });
  if (spec.extra === 4) for (const [x, y] of [[11, 16], [13, 17], [12, 18], [20, 16], [18, 17], [19, 18]]) put(g, x, y, 'd');
  // one dark line round the whole figure, where it meets the background
  const edge: [number, number][] = [];
  each((x, y) => {
    if (g[y][x] === 'b') return;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] === 'b')) edge.push([x, y]);
  });
  for (const [x, y] of edge) g[y][x] = 'k';
  return g;
}

function colourOf(c: string, spec: FaceSpec): Rgb {
  const [skin, shade] = SKIN[spec.skin];
  const [hair, dark] = HAIR[spec.hairColour];
  if (c === 'b') return BACKGROUND;
  if (c === 's') return skin;
  if (c === 'l') return lighten(skin, 0.18);
  if (c === 'd') return shade;
  if (c === 'u') return blend(skin, dark, 0.4);
  if (c === 'h') return hair;
  if (c === 'H') return lighten(hair, 0.22);
  if (c === 'g') return dark;
  if (c === 'x') return ACCENT[spec.extra];
  return FIXED[c];
}

const weight = (cell: string, count: number) => count * 10 + (FEATURES.includes(cell) ? 5 : 0);

/** Draws a face: opaque, on the dark background the painted faces use. */
export function renderFace(spec: FaceSpec, size: 64 | 16): Pixels {
  for (const part of Object.keys(FACE_PARTS) as (keyof FaceSpec)[]) {
    if (!Number.isInteger(spec[part]) || spec[part] < 0 || spec[part] >= FACE_PARTS[part]) throw new Error(`bad face part ${part}`);
  }
  const g = layout(spec);
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cell: string;
      if (size > N) cell = g[Math.floor((y * N) / size)][Math.floor((x * N) / size)];
      else {
        const k = N / size;
        const count = new Map<string, number>();
        for (let dy = 0; dy < k; dy++) {
          for (let dx = 0; dx < k; dx++) {
            const c = g[y * k + dy][x * k + dx];
            count.set(c, (count.get(c) ?? 0) + 1);
          }
        }
        cell = [...count].sort((a, b) => weight(b[0], b[1]) - weight(a[0], a[1]))[0][0];
      }
      rgba.set([...colourOf(cell, spec), 255], (y * size + x) * 4);
    }
  }
  return { w: size, h: size, rgba };
}
