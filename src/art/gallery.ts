import { VIEW } from '../render/layout';
import type { Atlas } from './atlas';
import { SPRITE_NAMES } from './sprites';

const SCALE = 3;
const CELL_W = 58;
const CELL_H = 62;

/** Every sprite enlarged on a labelled grid, for reviewing the art. */
export function drawGallery(ctx: CanvasRenderingContext2D, art: Atlas): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  SPRITE_NAMES.forEach((name, i) => {
    const x = 4 + (i % 8) * CELL_W;
    const y = 4 + Math.floor(i / 8) * CELL_H;
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(x, y, 16 * SCALE, 16 * SCALE);
    art.draw(ctx, name, x, y, { scale: SCALE });
    ctx.fillStyle = '#8a8fa8';
    ctx.fillText(name.replace('soldier', 'sold').replace('door_', 'd_').slice(0, 9), x, y + 16 * SCALE + 2);
  });
}
