export const SPRITE_NAMES = [
  'flash_0', 'flash_1', 'spark', 'slash_0', 'slash_1', 'splash',
  'boom_0', 'boom_1', 'boom_2', 'boom_3',
] as const;

export type SpriteName = (typeof SPRITE_NAMES)[number];

const SIZE = 16;
const C = (SIZE - 1) / 2; // the centre lies between pixels 7 and 8

const blank = (): string[][] => Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));

/** A dark outline `k` around every shape (4 neighbours), as the soldiers have. */
function outlined(grid: string[][]): string[] {
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') !== '.')) out[y][x] = 'k';
    }
  }
  return out.map((r) => r.join(''));
}

/** A muzzle flash: a star with a white core, a yellow ring and orange rays along the axes and diagonals. */
function flashRows(big: boolean): string[] {
  const g = blank();
  const reach = big ? 5.5 : 3.2;
  const core = big ? 1.8 : 1.2;
  const ring = big ? 3.2 : 2.4;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.abs(x - C);
      const dy = Math.abs(y - C);
      const r = Math.hypot(dx, dy);
      const ray = (dx <= 0.8 || dy <= 0.8 || Math.abs(dx - dy) <= 0.8) && r <= reach;
      if (!ray && r > ring) continue;
      g[y][x] = r <= core ? 'f' : r <= ring ? 'y' : 'o';
    }
  }
  return outlined(g);
}

/** A hit spark: a small cross, white in the middle, pink arms, red tips. */
function sparkRows(): string[] {
  const g = blank();
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) g[y][x] = 'f';
  for (const [x, y] of [[6, 7], [9, 7], [6, 8], [9, 8], [7, 6], [8, 6], [7, 9], [8, 9]]) g[y][x] = 'P';
  for (const [x, y] of [[5, 7], [10, 8], [7, 5], [8, 10]]) g[y][x] = 'R';
  return outlined(g);
}

function slashRows(frame: number): string[] {
  const g = blank();
  const length = frame === 0 ? 8 : 11;
  for (let i = 0; i < length; i++) {
    const x = 13 - i;
    const y = 2 + i;
    g[y][x] = 'f';
    g[y][x + 1] = frame === 0 ? 'f' : 'C';
  }
  return outlined(g);
}

/** Blood: a dark red blob with bright red flecks. */
const SPLASH_BODY = [
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

/** An explosion frame: a fireball that grows, then thins to a dark ring. */
function boomRows(frame: number): string[] {
  const radius = [3.5, 5.5, 7, 7.5][frame];
  const g = blank();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = Math.hypot(x - C, y - C) / radius;
      if (t > 1) continue;
      if (frame === 3) g[y][x] = t >= 0.6 ? 'M' : '.';
      else g[y][x] = t < 0.35 ? 'f' : t < 0.65 ? 'y' : t < 0.9 ? 'o' : 'M';
    }
  }
  return frame === 3 ? g.map((r) => r.join('')) : outlined(g);
}

export const SPRITE_ROWS: Record<SpriteName, string[]> = {
  flash_0: flashRows(true),
  flash_1: flashRows(false),
  spark: sparkRows(),
  slash_0: slashRows(0),
  slash_1: slashRows(1),
  splash: outlined(SPLASH_BODY.map((r) => [...r])),
  boom_0: boomRows(0),
  boom_1: boomRows(1),
  boom_2: boomRows(2),
  boom_3: boomRows(3),
};
