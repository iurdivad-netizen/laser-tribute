import { defaultCanvas } from '../art/atlas';
import { CONFIG } from '../core/config';
import type { GameState } from '../core/types';

const T = CONFIG.tileSize;

/** How dark a tile the player has seen but cannot see now is drawn (as before: a flat 55%). */
export const REMEMBERED_DARK = 0.55;
/** The darkest a tile in sight gets, far from every soldier. */
export const FAR_DARK = 0.28;
/** Tiles of distance over which the light of a soldier fades from full to `FAR_DARK`. */
export const LIGHT_REACH = 7;

/** Darkness (0 to 1) of a tile in sight at `dist` tiles from the nearest soldier. Zero next to him, `FAR_DARK` at the reach and beyond. */
export function lightFalloff(dist: number): number {
  const t = Math.min(1, Math.max(0, dist / LIGHT_REACH));
  return FAR_DARK * t * t * (3 - 2 * t); // smoothstep: no hard ring where the light starts to fade
}

/** The darkness of every tile: 0 in full light, up to `REMEMBERED_DARK` for explored tiles out of sight. Unexplored tiles are not drawn at all. */
export function darknessGrid(s: GameState, visible: boolean[][]): number[][] {
  const lamps = s.units.filter((u) => u.alive && u.side === 'player');
  return s.tiles.map((row, y) =>
    row.map((_, x) => {
      if (!s.explored[y][x]) return REMEMBERED_DARK;
      if (!visible[y][x]) return REMEMBERED_DARK;
      let best = Infinity;
      for (const u of lamps) best = Math.min(best, Math.hypot(u.pos.x - x, u.pos.y - y));
      return best === Infinity ? 0 : lightFalloff(best);
    }),
  );
}

/** What a tile needs to know about its neighbours to shade the floor: which sides touch a solid wall. */
function solid(s: GameState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return false;
  const t = s.tiles[y][x];
  return t.kind === 'wall' && !t.low;
}

/** A steady value in [0, 1) for a tile, so the same tile always gets the same speckle. */
export function tileNoise(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The shading of a floor tile, drawn over its image: a faint light or dark tint that breaks up the repeating floor, and
 * the shadow a wall casts on the floor next to it (light comes from the top left, so the wall above and the wall to the
 * left cast the longest ones). Stepped strips, not gradients, so it stays pixel art.
 */
export function shadeFloor(ctx: CanvasRenderingContext2D, s: GameState, x: number, y: number): void {
  const px = x * T;
  const py = y * T;
  const n = tileNoise(x, y);
  if (n < 0.25) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(px, py, T, T);
  } else if (n > 0.8) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(px, py, T, T);
  }
  const north = solid(s, x, y - 1);
  const west = solid(s, x - 1, y);
  if (north) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(px, py, T, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px, py + 2, T, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.fillRect(px, py + 4, T, 2);
  }
  if (west) {
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(px, py, 2, T);
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(px + 2, py, 2, T);
  }
  if (solid(s, x + 1, y)) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(px + T - 2, py, 2, T);
  }
  if (solid(s, x, y + 1)) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(px, py + T - 2, T, 2);
  }
}

/** The shadow of a prop (a crate, a barrel) on the floor under it: a dark oval on the lower right, out of the sprite. */
export function shadeProp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * T;
  const py = y * T;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(px + 2, py + T - 3, T - 3, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(px + 3, py + T - 1, T - 4, 1);
  ctx.fillRect(px + T - 2, py + 5, 2, T - 7);
}

interface Layer {
  canvas: NonNullable<ReturnType<typeof defaultCanvas>>;
  ctx: { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void; clearRect?(x: number, y: number, w: number, h: number): void };
}

const layers = new Map<string, Layer | null>();

function layerFor(name: string, width: number, height: number): Layer | null {
  const key = `${name}:${width}x${height}`;
  if (layers.has(key)) return layers.get(key) ?? null;
  const canvas = defaultCanvas(width + 2, height + 2);
  const ctx = canvas?.getContext('2d') ?? null;
  const layer = canvas && ctx ? { canvas, ctx } : null;
  layers.set(key, layer);
  return layer;
}

/** The colour of the dark: a cold blue-black, so shadow has a mood and is not a grey veil. */
const DARK_RGB = '5,8,22';
/** The colour of the squad's light: a warm lamp white. */
const GLOW_RGB = '255,214,150';
/** How strong the glow is at a soldier's feet. */
export const GLOW_PEAK = 0.17;

/** The warm light of every tile in sight: strongest next to a soldier, gone at the reach. Zero out of sight. */
export function glowGrid(s: GameState, visible: boolean[][]): number[][] {
  const lamps = s.units.filter((u) => u.alive && u.side === 'player');
  return s.tiles.map((row, y) =>
    row.map((_, x) => {
      if (!visible[y][x]) return 0;
      let best = Infinity;
      for (const u of lamps) best = Math.min(best, Math.hypot(u.pos.x - x, u.pos.y - y));
      const t = 1 - Math.min(1, best / LIGHT_REACH);
      return GLOW_PEAK * t * t;
    }),
  );
}

/**
 * Paints `values` (0 to 1, one per tile) over the map in `rgb`. With a canvas, the grid goes into a one-pixel-per-tile image
 * stretched over the map with smoothing on, so an edge is a soft slope and not a stair of squares. Without one (a plain
 * Node test), each tile is painted flat.
 */
function drawLayer(ctx: CanvasRenderingContext2D, name: string, s: GameState, values: number[][], rgb: string): void {
  const layer = layerFor(name, s.width, s.height);
  if (!layer) {
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (!s.explored[y][x] || values[y][x] <= 0) continue;
        ctx.fillStyle = `rgba(${rgb},${values[y][x].toFixed(3)})`;
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
    return;
  }
  const g = layer.ctx;
  g.clearRect?.(0, 0, s.width + 2, s.height + 2);
  // one border pixel on every side copies the edge tile, so the slope does not fade to nothing at the map edge
  const at = (x: number, y: number): number => values[Math.min(s.height - 1, Math.max(0, y))][Math.min(s.width - 1, Math.max(0, x))];
  for (let y = -1; y <= s.height; y++) {
    for (let x = -1; x <= s.width; x++) {
      const v = at(x, y);
      if (v <= 0) continue;
      g.fillStyle = `rgba(${rgb},${v.toFixed(3)})`;
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  const was = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  // pixel i of the image sits on the centre of tile i - 1, so the slope runs from tile centre to tile centre
  ctx.drawImage(layer.canvas as unknown as CanvasImageSource, -T, -T, (s.width + 2) * T, (s.height + 2) * T);
  ctx.imageSmoothingEnabled = was;
}

/** The light over the tiles: a warm glow by the squad, then the dark (fading with distance, deep where the player cannot see now). */
export function drawLight(ctx: CanvasRenderingContext2D, s: GameState, visible: boolean[][]): void {
  drawLayer(ctx, 'glow', s, glowGrid(s, visible), GLOW_RGB);
  drawLayer(ctx, 'dark', s, darknessGrid(s, visible), DARK_RGB);
  // the stretched layers spill over tiles the player has not seen: they stay plain black, in runs along each row
  ctx.fillStyle = '#000';
  ctx.fillRect(-T, -T, (s.width + 2) * T, T);
  ctx.fillRect(-T, s.height * T, (s.width + 2) * T, T);
  ctx.fillRect(-T, 0, T, s.height * T);
  ctx.fillRect(s.width * T, 0, T, s.height * T);
  for (let y = 0; y < s.height; y++) {
    let x = 0;
    while (x < s.width) {
      if (s.explored[y][x]) { x++; continue; }
      const from = x;
      while (x < s.width && !s.explored[y][x]) x++;
      ctx.fillRect(from * T, y * T, (x - from) * T, T);
    }
  }
}
