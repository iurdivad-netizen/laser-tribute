import { defaultAtlas } from '../render/renderer';
import { RISE, unitFigure } from '../art/figure';
import type { Rect } from '../ui/frame';

/** A steady number in [0, 1) for a pair of integers, so the scene is the same every time it is drawn. */
function noise(a: number, b: number): number {
  let h = Math.imul(a + 3, 374761393) ^ Math.imul(b + 5, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mix = (a: number[], b: number[], t: number): string =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

const SKY_TOP = [4, 5, 11];
const SKY_LOW = [30, 34, 68];
const GLOW = [74, 44, 74];

/** A filled disc, one row at a time. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, colour: string): void {
  ctx.fillStyle = colour;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }
}

export interface SceneOptions {
  /** Squad figures standing in front of the laser fence. */
  soldiers: number;
  /** The sky and the ground run on past the rectangle to the edges of the window (the full-screen backdrop), instead of stopping at it. */
  bleed: boolean;
}

/**
 * The picture behind the title: a night sky with stars and a moon, two layers of a compound's skyline with a few lit windows,
 * two searchlight beams, dark ground with a red laser fence, and the squad. Only filled rectangles (and the squad sprites),
 * in stepped bands, so it stays pixel art; nothing is drawn outside `r` unless `bleed`.
 */
export function drawScene(ctx: CanvasRenderingContext2D, r: Rect, opts: SceneOptions): void {
  const { x, y, w, h } = r;
  const far = opts.bleed ? 3000 : 0;
  const horizon = y + Math.round(h * 0.8);

  // the sky, in bands that get lighter and warmer toward the horizon
  const bands = 24;
  const skyH = horizon - y;
  const bandColour = (i: number): string => {
    const t = i / (bands - 1);
    return t < 0.8 ? mix(SKY_TOP, SKY_LOW, t / 0.8) : mix(SKY_LOW, GLOW, (t - 0.8) / 0.2);
  };
  for (let i = 0; i < bands; i++) {
    const top = y + Math.floor((skyH * i) / bands);
    const bottom = y + Math.floor((skyH * (i + 1)) / bands);
    ctx.fillStyle = bandColour(i);
    const from = i === 0 ? y - far : top;
    ctx.fillRect(x - far, from, w + 2 * far, bottom - from);
  }

  // stars, more of them high up
  for (let i = 0; i < Math.round((w * h) / 1400); i++) {
    const sx = x + Math.floor(noise(i, 1) * w);
    const sy = y + Math.floor(noise(i, 2) * skyH * 0.75);
    const b = noise(i, 3);
    ctx.fillStyle = b > 0.85 ? '#ffffff' : b > 0.4 ? '#aab0d8' : '#6a709c';
    ctx.fillRect(sx, sy, b > 0.93 ? 2 : 1, 1);
  }

  // the moon: a pale disc minus a smaller one offset from it, so what is left is a crescent and the sky shows through
  const mr = Math.max(5, Math.round(h * 0.05));
  const mx = x + Math.round(w * 0.14);
  const my = y + Math.round(h * 0.17);
  const bx = mx + Math.round(mr * 0.45);
  const by = my - Math.round(mr * 0.3);
  const span = (cx: number, cy: number, r: number, row: number): [number, number] | null => {
    const dy = row - cy;
    if (Math.abs(dy) > r) return null;
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
    return [cx - half, cx + half];
  };
  ctx.fillStyle = '#d8dcf0';
  for (let row = my - mr; row <= my + mr; row++) {
    const m = span(mx, my, mr, row)!;
    if (m[1] <= m[0]) continue;
    const bite = span(bx, by, mr - 1, row);
    if (!bite || bite[1] <= m[0] || bite[0] >= m[1]) ctx.fillRect(m[0], row, m[1] - m[0], 1);
    else {
      if (bite[0] > m[0]) ctx.fillRect(m[0], row, bite[0] - m[0], 1);
      if (bite[1] < m[1]) ctx.fillRect(bite[1], row, m[1] - bite[1], 1);
    }
  }
  ctx.fillStyle = '#9aa0c8';
  ctx.fillRect(mx - Math.round(mr * 0.5), my + Math.round(mr * 0.3), 2, 2);

  // two layers of skyline: far (lighter, plain blocks) and near (darker, with towers, a dish and lit windows)
  const layer = (seed: number, colour: string, minH: number, maxH: number, lit: boolean): void => {
    let bx = x;
    while (bx < x + w) {
      const bw = 8 + Math.floor(noise(bx, seed) * 18);
      const bh = Math.round(h * (minH + noise(bx, seed + 1) * (maxH - minH)));
      const width = Math.min(bw, x + w - bx);
      ctx.fillStyle = colour;
      ctx.fillRect(bx, horizon - bh, width, bh);
      if (lit && width >= 8) {
        for (let wy = horizon - bh + 4; wy < horizon - 4; wy += 6) {
          for (let wx = bx + 2; wx < bx + width - 2; wx += 4) {
            if (noise(wx, wy) > 0.86) {
              ctx.fillStyle = noise(wx + 1, wy) > 0.5 ? '#ffd070' : '#8fd4ff';
              ctx.fillRect(wx, wy, 2, 2);
            }
          }
        }
      }
      if (lit && noise(bx, seed + 2) > 0.8) { // an aerial with a red lamp
        ctx.fillStyle = colour;
        ctx.fillRect(bx + (width >> 1), horizon - bh - 8, 1, 8);
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(bx + (width >> 1), horizon - bh - 9, 1, 1);
      }
      bx += bw + Math.floor(noise(bx, seed + 3) * 4);
    }
  };
  layer(11, mix(SKY_LOW, GLOW, 0.25), 0.1, 0.22, false);

  // two searchlight beams from the near skyline, crossing over the compound
  const beam = (fromX: number, slope: number): void => {
    for (let k = 0; k < Math.round(h * 0.5); k++) {
      const by = horizon - 8 - k;
      const half = 1 + Math.floor(k * 0.09);
      const cx = Math.round(fromX + k * slope);
      ctx.fillStyle = 'rgba(255,243,192,0.07)';
      ctx.fillRect(cx - half, by, half * 2, 1);
      if (half < 2) continue;
      ctx.fillStyle = 'rgba(255,243,192,0.05)';
      ctx.fillRect(cx - half + 1, by, half * 2 - 2, 1);
    }
  };
  beam(x + w * 0.18, 0.55);
  beam(x + w * 0.74, -0.45);

  layer(23, '#0a0c18', 0.06, 0.15, true);

  // the ground, darker toward the viewer, with panel seams
  const groundH = y + h - horizon;
  for (let i = 0; i < 8; i++) {
    const top = horizon + Math.floor((groundH * i) / 8);
    const bottom = horizon + Math.floor((groundH * (i + 1)) / 8);
    ctx.fillStyle = mix([24, 26, 42], [6, 7, 12], i / 7);
    ctx.fillRect(x - far, top, w + 2 * far, (i === 7 ? bottom + far : bottom) - top);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let sx = x + 10; sx < x + w; sx += 24) ctx.fillRect(sx, horizon + 2, 1, groundH - 2);
  ctx.fillRect(x, horizon + Math.round(groundH * 0.5), w, 1);

  // the laser fence: three red lines between posts, each with a faint glow
  const fenceY = horizon + Math.round(groundH * 0.34);
  const left = x + Math.round(w * 0.06);
  const right = x + Math.round(w * 0.94);
  for (const px of [left, right]) {
    ctx.fillStyle = '#0b0c12';
    ctx.fillRect(px - 1, fenceY - 4, 3, 20);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(px, fenceY - 3, 1, 1);
    ctx.fillRect(px, fenceY + 3, 1, 1);
    ctx.fillRect(px, fenceY + 9, 1, 1);
  }
  [0, 6, 12].forEach((dy) => {
    ctx.fillStyle = 'rgba(255,77,77,0.18)';
    ctx.fillRect(left + 2, fenceY - 3 + dy, right - left - 3, 3);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(left + 2, fenceY - 2 + dy, right - left - 3, 1);
  });

  // the squad, in front of the fence
  for (let i = 0; i < opts.soldiers; i++) {
    const { figure, flip } = unitFigure('player', 6, 'rifle');
    const sx = x + Math.round(w * 0.5) - Math.round((opts.soldiers * 18) / 2) + i * 18 + 1;
    const sy = fenceY + 22 + (i % 2) * 3;
    defaultAtlas.drawImage(ctx, figure, sx, sy - RISE, { flip });
  }
}
