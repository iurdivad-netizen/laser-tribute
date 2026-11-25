import { FACE_PARTS, type FaceSpec } from '../core/world/faces';

export interface Pixels {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
}

type Rgb = readonly [number, number, number];

// The faces are laid out on a 32 x 32 grid. The 64 px face doubles each cell; the 16 px face keeps the likeliest cell of each 2 x 2 block.
const N = 32;

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
const dist = (x: number) => x - (N - 1) / 2; // distance from the middle line
const inHead = (x: number, y: number) => (dist(x) / 8) ** 2 + ((y - 13) / 10) ** 2 <= 1;
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

/** Hair of each style: 'h' hair, 'g' its dark part, null nothing. */
const HAIR_STYLES: ((x: number, y: number) => string | null)[] = [
  // buzz cut
  (x, y) => (inHead(x, y) && (y <= 6 || (Math.abs(dist(x)) >= 7 && y <= 9)) ? 'h' : null),
  // short
  (x, y) => (inHead(x, y) && (y <= 8 || (Math.abs(dist(x)) >= 7 && y <= 11)) ? ((x + y) % 5 === 0 ? 'g' : 'h') : null),
  // long, falling past the cheeks
  (x, y) => {
    const side = Math.abs(dist(x)) >= 7 && Math.abs(dist(x)) <= 9.5 && y >= 5 && y <= 22;
    return (inHead(x, y) && y <= 8) || side ? ((x + y) % 4 === 0 ? 'g' : 'h') : null;
  },
  // bald
  () => null,
  // mohawk
  (x, y) => (Math.abs(dist(x)) <= 1.6 && y <= 9 ? 'h' : null),
  // parted and swept
  (x, y) => (inHead(x, y) && (y <= 7 || (dist(x) < -2 && y <= 9)) ? (x === 12 && y <= 8 ? 'g' : 'h') : null),
  // curly, standing off the head
  (x, y) => {
    const cloud = (dist(x) / 11) ** 2 + ((y - 10) / 10) ** 2 <= 1;
    return cloud && (y <= 8 || Math.abs(dist(x)) >= 8.2) && !(inHead(x, y) && y > 8) ? ((x * 3 + y) % 4 === 0 ? 'g' : 'h') : null;
  },
  // short with a bun on top
  (x, y) => ((inHead(x, y) && y <= 8) || (dist(x) / 3) ** 2 + ((y - 1.5) / 2.5) ** 2 <= 1 ? 'h' : null),
];

const EYES: ((g: Cells) => void)[] = [
  (g) => pair(g, 11, 12, 'wpw'),
  (g) => pair(g, 11, 12, 'ppp'),
  (g) => { pair(g, 11, 11, 'www'); pair(g, 11, 12, 'wpw'); },
  (g) => { pair(g, 11, 12, 'wpw'); pair(g, 11, 13, 'ddd'); },
  (g) => pair(g, 11, 12, 'wpp'),
];
const BROWS: ((g: Cells) => void)[] = [
  (g) => pair(g, 11, 10, 'ggg'),
  (g) => { pair(g, 12, 10, 'gg'); pair(g, 11, 9, 'g'); },
  (g) => { pair(g, 11, 9, 'ggg'); pair(g, 11, 10, 'ggg'); },
  (g) => pair(g, 12, 10, 'gg'),
];
const MOUTHS: ((g: Cells) => void)[] = [
  (g) => { for (let x = 14; x <= 17; x++) put(g, x, 19, 'm'); },
  (g) => { put(g, 14, 18, 'm'); put(g, 17, 18, 'm'); put(g, 15, 19, 'm'); put(g, 16, 19, 'm'); },
  (g) => { put(g, 14, 19, 'm'); put(g, 17, 19, 'm'); put(g, 15, 18, 'm'); put(g, 16, 18, 'm'); },
  (g) => { for (let x = 14; x <= 17; x++) { put(g, x, 19, 'w'); put(g, x, 20, 'm'); } },
];

function layout(spec: FaceSpec): Cells {
  const g: Cells = Array.from({ length: N }, () => Array<string>(N).fill('b'));
  each((x, y) => {
    if (y >= 20 && y <= 27 && Math.abs(dist(x)) <= 2.5) g[y][x] = 'd'; // neck
    if (y >= 25 && Math.abs(dist(x)) <= 6 + (y - 25) * 2.2 && !(y <= 27 && Math.abs(dist(x)) <= (28 - y) * 0.9)) g[y][x] = y >= 29 ? 'C' : 'c';
    if (inHead(x, y)) g[y][x] = dist(x) >= 6 || y >= 22 ? 'd' : 's';
  });
  each((x, y) => {
    const c = HAIR_STYLES[spec.hairStyle](x, y);
    if (c) g[y][x] = c;
  });
  if (spec.beard === 1) each((x, y) => { if (inHead(x, y) && y >= 17 && (x + y) % 2 === 0) g[y][x] = 'g'; });
  if (spec.beard === 2) { for (let x = 13; x <= 18; x++) put(g, x, 17, 'h'); put(g, 15, 16, 'h'); put(g, 16, 16, 'h'); }
  if (spec.beard === 3) each((x, y) => { if (inHead(x, y) && y >= 17) g[y][x] = 'h'; });
  put(g, 15, 15, 'd');
  put(g, 16, 15, 'd');
  MOUTHS[spec.mouth](g);
  EYES[spec.eyes](g);
  BROWS[spec.brows](g);
  if (spec.extra === 1) for (const [x, y] of [[21, 14], [20, 15], [20, 16], [19, 17]]) put(g, x, y, 'x');
  if (spec.extra === 2) {
    for (let x = 10; x <= 14; x++) {
      put(g, x, 11, 'x'); put(g, x, 13, 'x'); put(g, N - 1 - x, 11, 'x'); put(g, N - 1 - x, 13, 'x');
    }
    for (const x of [10, 14, 15, 16, 17, 21]) put(g, x, 12, 'x');
  }
  if (spec.extra === 3) each((x, y) => { if (inHead(x, y) && (y === 6 || y === 7)) g[y][x] = 'x'; });
  if (spec.extra === 4) for (const [x, y] of [[11, 15], [13, 16], [12, 17], [20, 15], [18, 16], [19, 17]]) put(g, x, y, 'd');
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
  if (c === 'b') return BACKGROUND;
  if (c === 's') return SKIN[spec.skin][0];
  if (c === 'd') return SKIN[spec.skin][1];
  if (c === 'h') return HAIR[spec.hairColour][0];
  if (c === 'g') return HAIR[spec.hairColour][1];
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
