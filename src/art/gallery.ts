import { VIEW } from '../render/layout';
import { drawText } from '../ui/text';
import type { Atlas } from './atlas';
import { FIGURE_H, armedFigure } from './figure';
import { SPRITE_NAMES } from './sprites';

const SCALE = 3;
const CELL_W = 58;
const CELL_H = 56;

/** Every sprite enlarged on a labelled grid, for reviewing the art. */
export function drawGallery(ctx: CanvasRenderingContext2D, art: Atlas): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  SPRITE_NAMES.forEach((name, i) => {
    const x = 4 + (i % 8) * CELL_W;
    const y = 4 + Math.floor(i / 8) * CELL_H;
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(x, y, 16 * SCALE, 16 * SCALE);
    art.draw(ctx, name, x, y, { scale: SCALE });
    const label = name.replace('door_', 'd_');
    drawText(ctx, label.slice(0, 9), x, y + 16 * SCALE + 2, '#8a8fa8');
  });
  // the figures at 2x: squad then enemy, five views each (the other three facings are mirrors), rifle row then pistol row
  const views = ['n', 'ne', 'e', 'se', 's'] as const;
  const rows: [number, 'rifle' | 'pistol'][] = [[176, 'rifle'], [246, 'pistol']];
  for (const [y, weapon] of rows) {
    (['squad', 'enemy'] as const).forEach((side, s) => {
      views.forEach((view, v) => {
        const x = 4 + (s * 5 + v) * 44;
        ctx.fillStyle = '#2a2f45';
        ctx.fillRect(x, y, 32, FIGURE_H * 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(2, 2);
        art.drawFigure(ctx, armedFigure(side, view, weapon), 0, 0);
        ctx.restore();
      });
    });
  }
  drawText(ctx, 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', 4, 352, '#e8e8f0');
  drawText(ctx, "0123456789 .,:;!?'\"-+=/()[]<>%*#_&@$~|", 4, 364, '#ffe14d');
}
