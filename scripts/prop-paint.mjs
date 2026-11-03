/**
 * The props and floor decals drawn with a small painter instead of letter by letter: shapes first, then an automatic dark
 * outline. A prop is 16 wide and 16 to 24 rows tall; its last tile row is the bottom 16 rows, so a tall one overhangs the
 * tile above by (rows - 16) pixels, and its base outline sits in tile row 13 like the older props. A decal is a flat 16x16
 * mark on the floor: no outline, only tones close to the floor, so blood and soldiers stay the brightest things on it.
 */
const OUTLINE = '#0b0c12';

function paint(height) {
  const g = Array.from({ length: height }, () => Array(16).fill('.'));
  const at = (x, y) => (x >= 0 && x < 16 && y >= 0 && y < height ? g[y][x] : '.');
  const api = {
    height,
    at,
    px(x, y, c) { if (x >= 0 && x < 16 && y >= 0 && y < height) g[y][x] = c; return api; },
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) api.px(i, j, c); return api; },
    ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
        for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
          if (((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1) api.px(x, y, c);
        }
      }
      return api;
    },
    /** Replaces every pixel of `from` in the rows y0..y1 with `to`. */
    swap(from, to, y0 = 0, y1 = height - 1) { for (let y = y0; y <= y1; y++) for (let x = 0; x < 16; x++) if (g[y][x] === from) g[y][x] = to; return api; },
    /** Lights the left-most opaque pixel of each row and shades the right-most one (and the one inside it when `deep`). */
    sides(lit, shade, deep = false) {
      for (let y = 0; y < height; y++) {
        const xs = g[y].map((c, x) => (c === '.' ? -1 : x)).filter((x) => x >= 0);
        if (xs.length < 3) continue;
        g[y][xs[0]] = lit;
        g[y][xs[xs.length - 1]] = shade;
        if (deep && xs.length > 5) g[y][xs[xs.length - 2]] = shade;
      }
      return api;
    },
    /** A dark outline on every empty pixel next to a drawn one. */
    outline() {
      const was = g.map((r) => [...r]);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < 16; x++) {
          if (was[y][x] !== '.') continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (was[y + dy]?.[x + dx] ?? '.') !== '.')) g[y][x] = 'k';
        }
      }
      return api;
    },
    rows() { return g.map((r) => r.join('')); },
  };
  return api;
}

/** A filled block: lit top row and left column, shaded bottom row and right column. */
function block(p, x, y, w, h, body, lit, shade) {
  p.rect(x, y, w, h, body);
  p.rect(x, y, w, 1, lit).rect(x, y, 1, h, lit);
  p.rect(x, y + h - 1, w, 1, shade).rect(x + w - 1, y, 1, h, shade);
  return p;
}
const cut = (p, x, y, w, h) => { p.px(x, y, '.').px(x + w - 1, y, '.').px(x, y + h - 1, '.').px(x + w - 1, y + h - 1, '.'); return p; };

// ---- props. Palettes always start with `k`, the outline.

const SANDBAGS = (() => {
  const p = paint(16);
  const bag = (x, y, w, h) => { block(p, x, y, w, h, 'a', 'b', 'A'); p.px(x + (w >> 1), y + (h >> 1), 's'); cut(p, x, y, w, h); };
  bag(1, 8, 7, 5); bag(8, 8, 7, 5);
  bag(3, 4, 6, 4); bag(9, 4, 5, 4);
  bag(5, 1, 6, 3);
  return p.outline().rows();
})();

const CRATE_STACK = (() => {
  const p = paint(20);
  const crate = (x, y, w, h) => {
    block(p, x, y, w, h, 'a', 'b', 'A');
    p.rect(x + 1, y + (h >> 1), w - 2, 1, 'm');
    p.px(x + 1, y + 1, 'm').px(x + w - 2, y + 1, 'm');
  };
  crate(2, 9, 12, 8);
  crate(3, 1, 10, 8);
  return p.outline().rows();
})();

const BARRIER = (() => {
  const p = paint(16);
  const span = { 5: [4, 11], 6: [3, 12], 7: [2, 13] };
  for (let y = 5; y <= 12; y++) {
    const [x0, x1] = span[y] ?? [1, 14];
    p.rect(x0, y, x1 - x0 + 1, 1, 'a');
    p.px(x0, y, 'b').px(x1, y, 'A');
    if (y === 5) p.rect(x0, y, x1 - x0 + 1, 1, 'b');
    if (y === 12) p.rect(x0, y, x1 - x0 + 1, 1, 'A');
    if (y >= 8 && y <= 10) for (let x = x0 + 1; x < x1; x++) p.px(x, y, (x + y) % 6 < 3 ? 'r' : 'w');
  }
  return p.outline().rows();
})();

const TYRES = (() => {
  const p = paint(16);
  const tyre = (x, y) => { p.rect(x, y, 7, 5, 'T'); p.rect(x + 1, y, 5, 1, 't'); p.rect(x + 1, y + 2, 5, 1, 'h'); p.rect(x + 1, y + 4, 5, 1, 't'); cut(p, x, y, 7, 5); };
  tyre(1, 8); tyre(8, 8); tyre(4, 3);
  return p.outline().rows();
})();

const PLANK_STACK = (() => {
  const p = paint(16);
  [[2, 4, 12], [1, 6, 13], [2, 8, 12], [1, 10, 13]].forEach(([x, y, w], i) => {
    p.rect(x, y, w, 2, i % 2 ? 'c' : 'a').rect(x, y, w, 1, 'b');
    p.px(x + w - 1, y, 'A').px(x + w - 1, y + 1, 'A').px(x + 4 + i, y + 1, 'A');
  });
  p.rect(3, 12, 10, 1, 'A');
  return p.outline().rows();
})();

const HAY_BALE = (() => {
  const p = paint(16);
  block(p, 2, 6, 12, 7, 'a', 'b', 'A');
  cut(p, 2, 6, 12, 7);
  for (let y = 6; y <= 12; y++) p.px(5, y, 't').px(10, y, 't');
  [[3, 8, 'b'], [7, 9, 'A'], [12, 8, 'b'], [8, 7, 'A'], [4, 11, 'b'], [11, 11, 'A'], [7, 11, 'b']].forEach(([x, y, c]) => p.px(x, y, c));
  return p.outline().rows();
})();

const WORKBENCH = (() => {
  const p = paint(16);
  p.rect(1, 5, 14, 3, 'a').rect(1, 5, 14, 1, 'b').rect(1, 7, 14, 1, 'A');
  p.rect(2, 8, 2, 5, 'A').rect(12, 8, 2, 5, 'A').rect(4, 10, 8, 1, 'A');
  block(p, 3, 2, 5, 3, 'r', 'R', 'M'); p.px(5, 1, 'm').px(6, 1, 'm');
  p.rect(10, 3, 3, 2, 'm').px(12, 2, 'm').px(10, 3, 'W');
  return p.outline().rows();
})();

const CASK = (() => {
  const p = paint(20);
  p.ell(8, 9, 6, 7, 'a');
  for (const y of [5, 9, 13]) p.swap('a', 'm', y, y);
  p.sides('b', 'A', true);
  p.ell(8, 3, 3, 1, 'b').px(8, 3, 'A');
  return p.outline().rows();
})();

const SERVER_RACK = (() => {
  const p = paint(20);
  block(p, 3, 1, 10, 16, 'a', 'b', 'A');
  [3, 6, 9, 12].forEach((y, i) => {
    p.rect(4, y, 8, 2, 'd');
    p.px(5, y, i % 2 ? 'g' : 'y').px(6, y, i === 2 ? 'r' : 'g');
    p.rect(8, y + 1, 3, 1, 'A');
  });
  p.rect(4, 15, 8, 1, 'A');
  return p.outline().rows();
})();

const GENERATOR = (() => {
  const p = paint(16);
  block(p, 1, 6, 14, 7, 'a', 'b', 'A');
  p.rect(2, 8, 5, 3, 'o').rect(2, 8, 5, 1, 'O');
  p.rect(9, 8, 4, 3, 'd').px(10, 9, 'y').px(11, 9, 'g').px(12, 10, 'r');
  p.rect(11, 2, 3, 4, 'A').rect(11, 2, 3, 1, 'b').px(12, 1, 'd');
  p.px(3, 7, 'y').px(5, 7, 'y');
  return p.outline().rows();
})();

const PIPE_RUN = (() => {
  const p = paint(16);
  p.rect(1, 5, 14, 3, 'a').rect(1, 5, 14, 1, 'b').rect(1, 7, 14, 1, 'A');
  p.rect(1, 9, 14, 3, 'a').rect(1, 9, 14, 1, 'b').rect(1, 11, 14, 1, 'A');
  for (const x of [4, 10]) p.rect(x, 4, 2, 9, 'A').rect(x, 4, 1, 9, 'a');
  p.rect(6, 1, 5, 1, 'r').rect(8, 2, 1, 3, 'A').px(6, 2, 'r').px(10, 2, 'r');
  return p.outline().rows();
})();

const CONSOLE = (() => {
  const p = paint(16);
  block(p, 2, 9, 12, 4, 'a', 'b', 'A');
  for (let x = 3; x <= 12; x += 2) p.px(x, 10, 'd');
  block(p, 3, 2, 10, 6, 'A', 'a', 'd');
  p.rect(4, 3, 8, 4, 'd');
  p.rect(5, 4, 5, 1, 'g').rect(5, 5, 3, 1, 'g').px(11, 4, 'y').px(9, 5, 'g');
  p.rect(7, 8, 2, 1, 'A');
  return p.outline().rows();
})();

const STALAGMITE = (() => {
  const p = paint(20);
  const spike = (cx, top, bottom, maxHalf) => {
    for (let y = top; y <= bottom; y++) {
      const half = Math.max(1, Math.round((maxHalf * (y - top + 1)) / (bottom - top + 1)));
      p.rect(cx - half, y, half * 2, 1, 'a');
    }
  };
  spike(8, 1, 16, 5);
  spike(2, 10, 16, 2);
  spike(14, 11, 16, 2);
  p.sides('b', 'A', true);
  p.px(7, 6, 'A').px(8, 9, 'A').px(6, 12, 'A').px(9, 13, 'b');
  return p.outline().rows();
})();

const CRYSTALS = (() => {
  const p = paint(20);
  p.rect(2, 14, 12, 3, 'd').rect(2, 14, 12, 1, 'e');
  const crystal = (cx, top, bottom, half) => {
    for (let y = top; y <= bottom; y++) {
      const h = Math.min(half, 1 + Math.floor(((y - top) * half * 1.6) / (bottom - top + 1)));
      p.rect(cx - h, y, h * 2, 1, 'c').px(cx - h, y, 'L').px(cx + h - 1, y, 'C');
    }
  };
  crystal(4, 6, 15, 2);
  crystal(12, 7, 15, 2);
  crystal(8, 1, 15, 3);
  p.px(8, 5, 'L').px(8, 6, 'L').px(4, 9, 'L').px(12, 10, 'L');
  p.rect(2, 14, 12, 3, 'd').rect(2, 14, 12, 1, 'e');
  p.rect(2, 16, 12, 1, 'D');
  return p.outline().rows();
})();

const BONE_PILE = (() => {
  const p = paint(16);
  for (let i = 0; i < 6; i++) { p.px(8 + i, 5 + i, 'w').px(8 + i, 6 + i, 'W'); p.px(9 + i, 11 - i, 'w').px(9 + i, 12 - i, 'W'); }
  p.px(8, 5, 'w').px(7, 5, 'w').px(14, 11, 'w').px(14, 12, 'w').px(14, 7, 'w').px(13, 6, 'w');
  p.ell(5, 8, 3, 3, 'w').rect(3, 11, 5, 1, 'W');
  p.px(4, 8, 'e').px(6, 8, 'e').px(5, 9, 'e').px(3, 7, 'w').px(4, 6, 'w');
  p.rect(2, 12, 4, 1, 'W').px(10, 12, 'w').px(11, 12, 'W');
  return p.outline().rows();
})();

const MUSHROOMS = (() => {
  const p = paint(16);
  const shroom = (cx, cy, rx, ry, stemY, stemH) => {
    p.rect(cx - 1, stemY, 2, stemH, 's').rect(cx, stemY, 1, stemH, 'S');
    p.ell(cx, cy, rx, ry, 'p');
    p.swap('p', 'P', cy + ry, cy + ry);
    p.px(cx - rx + 1, cy - 1, 'L').px(cx - 1, cy - ry, 'L');
    p.px(cx + 1, cy, 'o').px(cx - 2, cy + 1, 'o');
  };
  shroom(8, 5, 5, 3, 8, 5);
  shroom(3, 9, 3, 2, 11, 2);
  shroom(13, 8, 2, 2, 10, 3);
  return p.outline().rows();
})();

const STATUE = (() => {
  const p = paint(20);
  block(p, 3, 12, 10, 5, 'a', 'b', 'A');
  p.rect(4, 13, 8, 1, 'A');
  p.ell(8, 3, 2, 1.6, 'a').rect(7, 5, 2, 1, 'A');
  p.rect(4, 6, 8, 2, 'a').rect(5, 8, 6, 4, 'a').rect(4, 8, 1, 3, 'a').rect(11, 8, 1, 3, 'a');
  p.sides('b', 'A');
  p.rect(5, 11, 6, 1, 'A').rect(7, 8, 1, 3, 'A').px(6, 6, 'b').px(5, 6, 'b');
  return p.outline().rows();
})();

const BRAZIER = (() => {
  const p = paint(20);
  const flame = [0, 1, 2, 3, 3, 3, 2];
  flame.forEach((h, i) => { if (h) p.rect(8 - h, 1 + i, h * 2, 1, 'o'); });
  [4, 5, 6].forEach((y, i) => p.rect(8 - (1 + i), y, 2 + i * 2, 1, 'y'));
  p.px(7, 1, 'r').px(8, 2, 'r');
  p.rect(2, 8, 12, 1, 'm').rect(3, 9, 10, 1, 'd').rect(4, 10, 8, 1, 'd').rect(5, 11, 6, 1, 'D');
  p.rect(3, 8, 10, 1, 'z').rect(2, 8, 1, 1, 'm').rect(13, 8, 1, 1, 'm');
  p.rect(7, 12, 2, 4, 'D').rect(5, 16, 6, 1, 'D');
  return p.outline().rows();
})();

const SARCOPHAGUS = (() => {
  const p = paint(16);
  block(p, 1, 7, 14, 6, 'a', 'b', 'A');
  block(p, 2, 4, 12, 4, 'b', 'b', 'A');
  p.rect(2, 4, 12, 1, 'b').rect(3, 5, 10, 2, 'a');
  p.rect(8, 4, 1, 4, 'e').rect(6, 5, 5, 1, 'e');
  p.rect(1, 12, 14, 1, 'A');
  return p.outline().rows();
})();

const BROKEN_COLUMN = (() => {
  const p = paint(16);
  block(p, 3, 11, 10, 2, 'a', 'b', 'A');
  [7, 5, 6, 4, 6, 8].forEach((top, i) => p.rect(5 + i, top, 1, 11 - top, 'a'));
  p.sides('b', 'A', true);
  for (const y of [6, 8, 9]) p.px(7, y, 'A');
  p.rect(11, 9, 3, 2, 'a').rect(11, 10, 3, 1, 'A').rect(1, 10, 3, 1, 'A').px(1, 10, 'a');
  return p.outline().rows();
})();

// ---- floor decals

const DECAL_STAIN = (() => {
  const p = paint(16);
  p.ell(8, 8, 5, 3, 's').ell(5, 7, 2, 2, 's').ell(11, 10, 3, 2, 's').ell(10, 6, 2, 1, 'S');
  p.px(7, 7, 'h').px(8, 7, 'h').px(11, 10, 'h');
  return p.rows();
})();

const DECAL_CRACKS = (() => {
  const p = paint(16);
  [[2, 3], [3, 4], [4, 4], [5, 5], [6, 6], [6, 7], [7, 8], [8, 8], [9, 9], [10, 10], [11, 10], [12, 11], [13, 12]].forEach(([x, y]) => p.px(x, y, 'c'));
  [[6, 6], [7, 5], [8, 4], [9, 4], [9, 9], [9, 10], [8, 11], [8, 12], [3, 4], [2, 5], [1, 6]].forEach(([x, y]) => p.px(x, y, 'd'));
  return p.rows();
})();

const DECAL_DEBRIS = (() => {
  const p = paint(16);
  [[3, 4, 2, 2, 'c'], [9, 3, 3, 2, 'd'], [6, 9, 2, 2, 'd'], [12, 8, 2, 2, 'c'], [2, 12, 3, 1, 'c'], [10, 13, 2, 1, 'd']].forEach(([x, y, w, h, c]) => p.rect(x, y, w, h, c));
  [[3, 4], [9, 3], [12, 8]].forEach(([x, y]) => p.px(x, y, 'e'));
  return p.rows();
})();

const DECAL_STRAW = (() => {
  const p = paint(16);
  [[2, 4], [3, 5], [4, 6], [9, 3], [10, 4], [11, 3], [5, 11], [6, 10], [7, 11], [12, 11], [13, 12], [3, 13], [4, 13], [8, 7], [9, 8]].forEach(([x, y], i) => p.px(x, y, i % 3 ? 'c' : 'd'));
  return p.rows();
})();

const DECAL_SCRAP = (() => {
  const p = paint(16);
  p.rect(3, 5, 6, 2, 'c').rect(3, 5, 6, 1, 'd').px(8, 6, 'e');
  p.rect(8, 10, 5, 2, 'c').rect(8, 10, 5, 1, 'd').px(12, 11, 'e');
  p.rect(2, 11, 3, 1, 'e').px(11, 4, 'e').px(12, 5, 'e');
  return p.rows();
})();

const DECAL_GRATE = (() => {
  const p = paint(16);
  p.rect(3, 3, 10, 10, 'c').rect(3, 3, 10, 1, 'd').rect(3, 12, 10, 1, 'e');
  for (let x = 4; x <= 11; x += 2) p.rect(x, 4, 1, 8, 's');
  return p.rows();
})();

const DECAL_CABLE = (() => {
  const p = paint(16);
  [[0, 12], [1, 12], [2, 11], [3, 11], [4, 10], [5, 10], [6, 10], [7, 11], [8, 11], [9, 12], [10, 12], [11, 11], [12, 10], [13, 9], [14, 9], [15, 9]].forEach(([x, y]) => p.px(x, y, 'c').px(x, y + 1, 'd'));
  p.rect(13, 7, 2, 2, 'e').px(13, 7, 'f');
  return p.rows();
})();

const DECAL_PEBBLES = (() => {
  const p = paint(16);
  [[3, 4, 2], [9, 3, 2], [7, 9, 3], [12, 11, 2], [2, 12, 2], [13, 6, 1]].forEach(([x, y, r]) => { p.ell(x, y, r - 1 + 0.4, r - 1 + 0.4, 'c').px(x, y, 'd'); });
  [[3, 3], [9, 2], [7, 8], [12, 10]].forEach(([x, y]) => p.px(x, y, 'e'));
  return p.rows();
})();

const DECAL_PUDDLE = (() => {
  const p = paint(16);
  p.ell(8, 9, 5, 3, 'c').ell(6, 8, 3, 2, 'c').ell(11, 10, 2, 2, 'c');
  p.sides('d', 'd').ell(7, 8, 2, 1, 'e');
  p.px(6, 8, 'f').px(7, 8, 'f');
  return p.rows();
})();

const DECAL_MOSS = (() => {
  const p = paint(16);
  p.ell(4, 5, 3, 2, 'c').ell(11, 11, 3, 2, 'c').ell(8, 8, 1.4, 1, 'c');
  [[3, 5], [5, 4], [10, 11], [12, 12], [8, 8], [2, 6], [11, 10]].forEach(([x, y]) => p.px(x, y, 'd'));
  [[4, 4], [12, 10]].forEach(([x, y]) => p.px(x, y, 'e'));
  return p.rows();
})();

const DECAL_RUBBLE = (() => {
  const p = paint(16);
  [[2, 9, 4, 3], [8, 4, 3, 3], [9, 10, 4, 3], [4, 3, 2, 2], [12, 6, 2, 2]].forEach(([x, y, w, h]) => { p.rect(x, y, w, h, 'c').rect(x, y, w, 1, 'd').rect(x + w - 1, y, 1, h, 'e'); });
  return p.rows();
})();

const DECAL_CHIPS = (() => {
  const p = paint(16);
  [[3, 3], [4, 3], [10, 5], [7, 7], [8, 8], [12, 11], [3, 11], [4, 12], [13, 3], [6, 13]].forEach(([x, y], i) => p.px(x, y, i % 2 ? 'c' : 'd'));
  return p.rows();
})();

const DECAL_RUNE = (() => {
  const p = paint(16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d >= 4.6 && d <= 6) p.px(x, y, 'c');
  }
  p.rect(7, 4, 2, 8, 'd').rect(4, 7, 8, 2, 'd').px(7, 7, 'e').px(8, 8, 'e');
  return p.rows();
})();

export const PAINTED_IMAGES = {
  prop_sandbags: { palette: { k: OUTLINE, a: '#b59f6a', A: '#8a7648', b: '#d4c08a', s: '#5f5030' }, rows: SANDBAGS },
  prop_crate_stack: { palette: { k: OUTLINE, a: '#6b7a4a', A: '#4f5c36', b: '#8c9a64', m: '#8a8a99' }, rows: CRATE_STACK },
  prop_barrier: { palette: { k: OUTLINE, a: '#9a9a92', A: '#6e6e68', b: '#c4c4ba', r: '#e0701c', w: '#e8e8e0' }, rows: BARRIER },
  prop_tyres: { palette: { k: OUTLINE, T: '#2c2c32', t: '#4a4a52', h: '#8a8a92' }, rows: TYRES },
  prop_plank_stack: { palette: { k: OUTLINE, a: '#b5803a', c: '#9a6a30', A: '#7a5222', b: '#d9a65a' }, rows: PLANK_STACK },
  prop_hay_bale: { palette: { k: OUTLINE, a: '#d8c060', A: '#a08c38', b: '#f0dc88', t: '#6b4a20' }, rows: HAY_BALE },
  prop_workbench: { palette: { k: OUTLINE, a: '#8a6a44', A: '#5a4228', b: '#c7a066', m: '#8a8a99', r: '#b34030', R: '#d85a48', M: '#7a2a20', W: '#d0d0d8' }, rows: WORKBENCH },
  prop_cask: { palette: { k: OUTLINE, a: '#a8702e', A: '#6b4420', b: '#cf9548', m: '#4a4a55' }, rows: CASK },
  prop_server_rack: { palette: { k: OUTLINE, a: '#5d6b7a', A: '#3f4a57', b: '#8da0b4', d: '#1c242e', g: '#3cb371', r: '#e04040', y: '#ffe14d' }, rows: SERVER_RACK },
  prop_generator: { palette: { k: OUTLINE, a: '#5d6b7a', A: '#3f4a57', b: '#8da0b4', o: '#e08a30', O: '#f0b060', d: '#1c242e', y: '#ffe14d', g: '#3cb371', r: '#e04040' }, rows: GENERATOR },
  prop_pipe_run: { palette: { k: OUTLINE, a: '#6a7f94', A: '#46566a', b: '#aebdcb', r: '#e04040' }, rows: PIPE_RUN },
  prop_console: { palette: { k: OUTLINE, a: '#5d6b7a', A: '#3f4a57', b: '#8da0b4', d: '#101820', g: '#3cb371', y: '#ffe14d' }, rows: CONSOLE },
  prop_stalagmite: { palette: { k: OUTLINE, a: '#6e7a6a', A: '#4a5448', b: '#98a692' }, rows: STALAGMITE },
  prop_crystals: { palette: { k: OUTLINE, c: '#5fd4e8', C: '#2a7f96', L: '#c8f6ff', d: '#4a5448', D: '#343c32', e: '#6e7a6a' }, rows: CRYSTALS },
  prop_bone_pile: { palette: { k: OUTLINE, w: '#d8d0b8', W: '#8f8870', e: '#3a3328' }, rows: BONE_PILE },
  prop_mushrooms: { palette: { k: OUTLINE, p: '#7a5fc0', P: '#4f3a8a', L: '#a890e8', s: '#d8d0c0', S: '#9a9284', o: '#e8e0a8' }, rows: MUSHROOMS },
  prop_statue: { palette: { k: OUTLINE, a: '#9a9ea6', A: '#6a6e76', b: '#d4d6da' }, rows: STATUE },
  prop_brazier: { palette: { k: OUTLINE, d: '#3a3a44', D: '#24242c', m: '#6a6a78', z: '#8a2a10', o: '#e08a30', y: '#ffe14d', r: '#e04040' }, rows: BRAZIER },
  prop_sarcophagus: { palette: { k: OUTLINE, a: '#a8a49a', A: '#706c64', b: '#d4d0c4', e: '#4a4640' }, rows: SARCOPHAGUS },
  prop_broken_column: { palette: { k: OUTLINE, a: '#9a9ea6', A: '#6a6e76', b: '#d4d6da' }, rows: BROKEN_COLUMN },

  decal_stain: { palette: { s: '#17181d', S: '#1c1d23', h: '#2a2d38' }, rows: DECAL_STAIN },
  decal_cracks: { palette: { c: '#0f1014', d: '#16171c' }, rows: DECAL_CRACKS },
  decal_debris: { palette: { c: '#3a3c46', d: '#24252c', e: '#4e515e' }, rows: DECAL_DEBRIS },
  decal_straw: { palette: { c: '#6b5a30', d: '#4c3f20' }, rows: DECAL_STRAW },
  decal_scrap: { palette: { c: '#4e3a22', d: '#6e5232', e: '#2a1e10' }, rows: DECAL_SCRAP },
  decal_grate: { palette: { c: '#2a2d36', d: '#3c404c', e: '#14151a', s: '#0a0b0e' }, rows: DECAL_GRATE },
  decal_cable: { palette: { c: '#0e0f14', d: '#272a34', e: '#3c4048', f: '#e0b030' }, rows: DECAL_CABLE },
  decal_pebbles: { palette: { c: '#2f3832', d: '#1c231f', e: '#44504a' }, rows: DECAL_PEBBLES },
  decal_puddle: { palette: { c: '#16303c', d: '#0e222c', e: '#244a5c', f: '#3a6a80' }, rows: DECAL_PUDDLE },
  decal_moss: { palette: { c: '#2a3f26', d: '#1c2c1a', e: '#3d5c36' }, rows: DECAL_MOSS },
  decal_rubble: { palette: { c: '#3a3a40', d: '#4c4c54', e: '#25252a' }, rows: DECAL_RUBBLE },
  decal_chips: { palette: { c: '#44444a', d: '#2b2b30' }, rows: DECAL_CHIPS },
  decal_rune: { palette: { c: '#2e2a22', d: '#4a4030', e: '#6a5a3a' }, rows: DECAL_RUNE },
};
