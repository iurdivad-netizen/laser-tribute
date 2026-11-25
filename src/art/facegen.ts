import { FACE_PARTS, type FaceSpec } from '../core/world/faces';

export interface Pixels {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
}

type Rgb = readonly [number, number, number];

// The faces are drawn on a 64 x 64 grid, one cell per pixel of the big face; the 16 px face keeps the likeliest cell of each 4 x 4 block.
const N = 64;
const MID = (N - 1) / 2;

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
  k: [8, 8, 10], w: [236, 236, 230], i: [74, 56, 46], p: [20, 18, 26], m: [96, 40, 40], c: [76, 84, 56], C: [52, 58, 38],
};
const FEATURES = 'kwpimngx'; // cells that win a tie when the small face drops resolution

type Cells = string[][];
const dist = (x: number) => x - MID; // distance from the middle line, negative on the lit (left) side
const squeeze = (y: number) => (y > 32 ? 1 - 0.4 * ((y - 32) / 19) ** 2 : 1);
const headU = (x: number, y: number) => dist(x) / (19 * squeeze(y));
const headV = (y: number) => (y - 26) / 23;
/** An egg: wide at the brow, narrowing to a chin. */
const inHead = (x: number, y: number) => headU(x, y) ** 2 + headV(y) ** 2 <= 1;
const put = (g: Cells, x: number, y: number, c: string) => {
  if (x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c;
};
const each = (f: (x: number, y: number) => void) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) f(x, y);
};
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
/** Draws on both sides of the face: `x` on the left, its mirror image on the right. */
const both = (g: Cells, x: number, y: number, c: string) => {
  put(g, x, y, c);
  put(g, N - 1 - x, y, c);
};

/** Light comes from the upper left: five tones of skin from the egg's surface normal. */
function skinTone(x: number, y: number): string {
  const u = headU(x, y);
  const v = headV(y);
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  const l = 0.5 * z - 0.35 * u - 0.4 * v - 0.32;
  return l > 0.36 ? 'L' : l > 0.1 ? 'l' : l > -0.12 ? 's' : l > -0.3 ? 'd' : 'D';
}

/** Hair is lit on the crown and dark underneath. */
function hairTone(x: number, y: number): string {
  const u = Math.max(-1, Math.min(1, dist(x) / 24));
  const v = Math.max(-1, Math.min(1, (y - 18) / 24));
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  const l = 0.5 * z - 0.35 * u - 0.5 * v - 0.2;
  const t = l > 0.3 ? 'H' : l > -0.1 ? 'h' : 'g';
  return t;
}

/** Where hair grows, per style; the shade of it is worked out afterwards. */
const HAIR_STYLES: ((x: number, y: number) => boolean)[] = [
  // buzz cut
  (x, y) => inHead(x, y) && (y <= 11 || (Math.abs(dist(x)) >= 16 && y <= 20)),
  // short
  (x, y) => inHead(x, y) && (y <= 15 || (Math.abs(dist(x)) >= 17 && y <= 27)),
  // long, falling past the shoulders
  (x, y) => (inHead(x, y) && y <= 15) || (Math.abs(dist(x)) >= 15.5 && Math.abs(dist(x)) <= 23 && y >= 11 && y <= 56),
  // bald
  () => false,
  // mohawk
  (x, y) => Math.abs(dist(x)) <= 4.6 && y <= 17,
  // parted and swept
  (x, y) => inHead(x, y) && (y <= 13 || (dist(x) < -6 && y <= 17) || (Math.abs(dist(x)) >= 17 && y <= 23)),
  // curly, standing off the head
  (x, y) => {
    const r = 25 * (1 + 0.05 * Math.sin(x * 0.95 + y * 0.35));
    return (dist(x) / r) ** 2 + ((y - 16) / 19) ** 2 <= 1 && (y <= 17 || Math.abs(dist(x)) >= 17.5) && !(inHead(x, y) && y > 17);
  },
  // short with a bun on top
  (x, y) => (inHead(x, y) && y <= 15) || ell(x, y, MID, 3, 6.5, 5.5),
];

/** Left eye (the right one mirrors it): a lash line, white, iris, pupil and a glint, in five moods. */
function eye(g: Cells, kind: number, cx: number, cy: number, side: 1 | -1) {
  const ry = [2.2, 1.3, 2.8, 2.2, 2.2][kind];
  const shift = kind === 4 ? -2 * side : 0;
  const bigIris = kind === 2 ? 2.4 : 2.3;
  for (let y = cy - 6; y <= cy + 6; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      if (ell(x, y, cx, cy, 4.6, ry)) {
        let c = 'w';
        if (ell(x, y, cx + shift, cy, bigIris, bigIris)) c = ell(x, y, cx + shift, cy, 1.15, 1.15) ? 'p' : 'i';
        both(g, x, y, c);
        if (c === 'i' && x === cx + shift - 1 && y === cy - 1) both(g, x, y, 'w'); // the glint
      } else if (ell(x, y, cx, cy, 5.5, ry + 1.1) && y <= cy) both(g, x, y, 'k'); // the upper lash line
      else if (kind === 3 && y > cy && ell(x, y, cx, cy + ry + 2.2, 4.6, 1.2)) both(g, x, y, 'd'); // bags
      else if (y < cy && ell(x, y, cx, cy - 1, 6, ry + 3.2) && g[y][x] !== 'k') both(g, x, y, 'd'); // the lid in shadow
    }
  }
}

const BROWS: ((i: number) => [number, number])[] = [
  (i) => [i, 0], // flat
  (i) => [i, Math.floor(i * 0.35) - 2], // angry: the inner end drops
  (i) => [i, 0], // thick (drawn three rows deep)
  (i) => [i, -Math.round(Math.sin((i / 9) * Math.PI) * 2)], // arched
];

function brows(g: Cells, kind: number, cx: number, cy: number) {
  for (let i = 0; i <= 9; i++) {
    const [dx, dy] = BROWS[kind](i);
    const x = cx - 5 + dx;
    const y = cy - 7 + dy;
    for (let t = 0; t < (kind === 2 ? 3 : 2); t++) both(g, x, y + t - (kind === 2 ? 1 : 0), 'g');
  }
}

function mouth(g: Cells, kind: number) {
  const row = (y: number, x0: number, x1: number, c: string) => { for (let x = x0; x <= x1; x++) put(g, x, y, c); };
  if (kind === 0) { row(43, 27, 36, 'm'); row(44, 28, 35, 'n'); row(45, 30, 33, 'n'); }
  if (kind === 1) { row(43, 27, 36, 'm'); put(g, 25, 42, 'm'); put(g, 26, 42, 'm'); put(g, 37, 42, 'm'); put(g, 38, 42, 'm'); row(44, 28, 35, 'n'); }
  if (kind === 2) { row(43, 27, 36, 'm'); put(g, 26, 44, 'm'); put(g, 25, 45, 'm'); put(g, 37, 44, 'm'); put(g, 38, 45, 'm'); row(44, 30, 33, 'n'); }
  if (kind === 3) { row(43, 28, 35, 'w'); row(44, 28, 35, 'm'); row(45, 29, 34, 'm'); row(46, 29, 34, 'n'); }
}

function layout(spec: FaceSpec): Cells {
  const g: Cells = Array.from({ length: N }, () => Array<string>(N).fill('b'));
  each((x, y) => {
    const ax = Math.abs(dist(x));
    if (y >= 43 && ax <= 7) g[y][x] = y < 49 ? 'D' : 'd'; // neck, in the shadow of the chin
    if (y >= 50 && ax <= 14 + (y - 50) * 4.5) g[y][x] = y >= 60 || ax >= 12 ? 'C' : 'c'; // shoulders
    if (y >= 50 && ax <= 8 - (y - 50) * 1.3) g[y][x] = 'd'; // the opening of the collar
  });
  each((x, y) => { if (ell(x, y, 11, 29, 2.8, 5) || ell(x, y, 52, 29, 2.8, 5)) g[y][x] = dist(x) < 0 ? 's' : 'd'; }); // ears
  each((x, y) => { if (inHead(x, y)) g[y][x] = skinTone(x, y); });
  const style = HAIR_STYLES[spec.hairStyle];
  each((x, y) => { if (style(x, y)) g[y][x] = hairTone(x, y); });
  if (spec.beard === 1) each((x, y) => { if (inHead(x, y) && y >= 36) g[y][x] = 'dD'.includes(g[y][x]) ? 'U' : 'u'; });
  if (spec.beard === 2) {
    for (let y = 39; y <= 41; y++) for (let x = 22; x <= 41; x++) if (Math.abs(dist(x)) <= 9 && !(Math.abs(dist(x)) < 1.6 && y === 39)) g[y][x] = hairTone(x, y + 6);
    for (const y of [42, 43]) for (const x of [22, 23, 40, 41]) g[y][x] = 'g';
  }
  if (spec.beard === 3) {
    each((x, y) => { if (inHead(x, y) && (y >= 35 || (Math.abs(dist(x)) >= 15 && y >= 26))) g[y][x] = hairTone(x, y - 14); });
  }
  for (let y = 28; y <= 36; y++) { put(g, 33, y, 'd'); put(g, 34, y, 'd'); } // the nose: shaded on the far side, lit on the near one
  for (let y = 29; y <= 34; y++) { put(g, 30, y, 'L'); put(g, 31, y, 'L'); }
  for (let x = 27; x <= 36; x++) put(g, x, 37, 'd');
  for (const x of [28, 29, 34, 35]) put(g, x, 37, 'D');
  for (let x = 29; x <= 34; x++) put(g, x, 38, 'd');
  mouth(g, spec.mouth);
  eye(g, spec.eyes, 22, 27, 1);
  brows(g, spec.brows, 22, 27);
  if (spec.extra === 1) for (let t = 0; t <= 11; t++) put(g, 43 - Math.round(t * 0.35), 23 + t, 'x');
  if (spec.extra === 2) {
    for (let y = 22; y <= 32; y++) for (let x = 15; x <= 29; x++) if ((x === 15 || x === 29 || y === 22 || y === 32) && !(y === 22 && x <= 16)) both(g, x, y, 'x');
    for (let x = 30; x <= 33; x++) put(g, x, 27, 'x');
  }
  if (spec.extra === 3) each((x, y) => { if (inHead(x, y) && y >= 11 && y <= 14) g[y][x] = 'x'; });
  if (spec.extra === 4) for (const [x, y] of [[18, 33], [21, 35], [24, 32], [26, 35], [16, 36], [23, 38]]) both(g, x, y, 'd');
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
  if (c === 'l') return lighten(skin, 0.12);
  if (c === 'L') return lighten(skin, 0.24);
  if (c === 'd') return shade;
  if (c === 'D') return blend(shade, [0, 0, 0], 0.3);
  if (c === 'u') return blend(skin, dark, 0.4);
  if (c === 'U') return blend(shade, dark, 0.45);
  if (c === 'n') return blend(skin, [160, 60, 64], 0.55);
  if (c === 'h') return hair;
  if (c === 'H') return lighten(hair, 0.22);
  if (c === 'g') return dark;
  if (c === 'x') return ACCENT[spec.extra];
  return FIXED[c];
}

const weight = (cell: string, count: number) => count * 10 + (FEATURES.includes(cell) ? 30 : 0);

/** Draws a face: opaque, on the dark background the painted faces use. */
export function renderFace(spec: FaceSpec, size: 64 | 16): Pixels {
  for (const part of Object.keys(FACE_PARTS) as (keyof FaceSpec)[]) {
    if (!Number.isInteger(spec[part]) || spec[part] < 0 || spec[part] >= FACE_PARTS[part]) throw new Error(`bad face part ${part}`);
  }
  const g = layout(spec);
  const rgba = new Uint8ClampedArray(size * size * 4);
  const k = N / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cell: string;
      if (k === 1) cell = g[y][x];
      else {
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
  if (size === 16) limitColours(rgba, 16);
  return { w: size, h: size, rgba };
}

/** The small faces keep at most `max` colours, like the painted ones: the rarest colour joins its nearest neighbour until they fit. */
function limitColours(rgba: Uint8ClampedArray, max: number) {
  const key = (i: number) => `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`;
  for (;;) {
    const count = new Map<string, number>();
    for (let i = 0; i < rgba.length; i += 4) count.set(key(i), (count.get(key(i)) ?? 0) + 1);
    if (count.size <= max) return;
    const [rare] = [...count].sort((a, b) => a[1] - b[1])[0];
    const from = rare.split(',').map(Number);
    let best = '';
    let bestD = Infinity;
    for (const k of count.keys()) {
      const d = k.split(',').map(Number).reduce((sum, v, j) => sum + (v - from[j]) ** 2, 0);
      if (k !== rare && d < bestD) { best = k; bestD = d; }
    }
    const to = best.split(',').map(Number);
    for (let i = 0; i < rgba.length; i += 4) if (key(i) === rare) rgba.set(to, i);
  }
}
