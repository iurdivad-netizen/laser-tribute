import { VIEW } from '../render/layout';
import { drawText } from '../ui/text';
import type { Atlas } from './atlas';
import { FIGURE_H, armedFigure } from './figure';
import { imageOf, type ImageName } from './image';
import { floorVariant } from './sprite';
import { SPRITE_NAMES } from './sprites';
import { THEMES, tileImage } from './theme';
import { THEME_IDS } from '../core/themes';

const SCALE = 3;
const IMAGE_LIST: ImageName[] = [
  'floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open',
  'item_rifle', 'item_pistol', 'item_grenade', 'item_shotgun', 'item_smg', 'item_sniper', 'corpse_player', 'corpse_enemy',
];
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
  // the fourteen tile, door, item and corpse images at 2x on one row
  IMAGE_LIST.forEach((name, i) => {
    const x = 4 + i * 34;
    ctx.fillStyle = '#2a2f45';
    ctx.fillRect(x, 120, 32, 32);
    ctx.save();
    ctx.translate(x, 120);
    ctx.scale(2, 2);
    art.drawImage(ctx, imageOf(name), 0, 0);
    ctx.restore();
  });
  // the figures at 2x: squad then enemy, five views each (the other three facings are mirrors), rifle row then pistol row
  const views = ['n', 'ne', 'e', 'se', 's'] as const;
  const rows: [number, 'rifle' | 'pistol'][] = [[160, 'rifle'], [230, 'pistol']];
  for (const [y, weapon] of rows) {
    (['squad', 'enemy'] as const).forEach((side, s) => {
      views.forEach((view, v) => {
        const x = 4 + (s * 5 + v) * 44;
        ctx.fillStyle = '#2a2f45';
        ctx.fillRect(x, y, 32, FIGURE_H * 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(2, 2);
        art.drawImage(ctx, armedFigure(side, view, weapon), 0, 0);
        ctx.restore();
      });
    });
  }
  // one strip per theme at 1x: its three floors, wall, closed door and open door, then its name
  const spot = (v: number): { x: number; y: number } => {
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (floorVariant(x, y) === v) return { x, y };
    return { x: 0, y: 0 };
  };
  THEME_IDS.forEach((id, i) => {
    const x0 = 4 + (i % 3) * 160;
    const y0 = 298 + Math.floor(i / 3) * 26;
    const pieces = [
      ...[0, 1, 2].map((v) => tileImage(id, 'floor', false, spot(v).x, spot(v).y)),
      tileImage(id, 'wall', false, 0, 0),
      tileImage(id, 'door', false, 0, 0),
      tileImage(id, 'door', true, 0, 0),
    ];
    pieces.forEach((fig, k) => art.drawImage(ctx, fig, x0 + k * 17, y0));
    drawText(ctx, THEMES[id].name.toUpperCase(), x0 + 6 * 17 + 4, y0 + 5, '#8a8fa8');
  });
  drawText(ctx, 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', 4, 352, '#e8e8f0');
  drawText(ctx, "0123456789 .,:;!?'\"-+=/()[]<>%*#_&@$~|", 4, 364, '#ffe14d');
}
