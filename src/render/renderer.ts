import { CONFIG } from '../core/config';
import { FACING_VECTORS } from '../core/geometry';
import type { GameState } from '../core/types';
import { computeVisible } from '../core/vision';
import type { UiState } from '../input/uiState';
import type { Effects } from './effects';
import { VIEW } from './layout';
import { drawPanel } from './panel';

const T = CONFIG.tileSize;

const COLORS = {
  floor: '#2f3347',
  wall: '#8b8fa8',
  doorClosed: '#b5651d',
  doorOpen: '#5a3a1a',
  player: '#4da6ff',
  enemy: '#ff5555',
  select: '#ffe14d',
  rifle: '#d0d0d0',
  pistol: '#a0a0a0',
  grenade: '#3cb371',
  dead: '#555566',
};

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UiState,
  effects: Effects,
  now: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const visible = computeVisible(state, 'player');

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!state.explored[y][x]) continue;
      const tile = state.tiles[y][x];
      ctx.fillStyle =
        tile.kind === 'wall' ? COLORS.wall
        : tile.kind === 'door' ? (tile.open ? COLORS.doorOpen : COLORS.doorClosed)
        : COLORS.floor;
      ctx.fillRect(x * T, y * T, T, T);
      if (!visible[y][x]) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }

  for (const item of state.items) {
    if (!visible[item.pos.y][item.pos.x]) continue;
    ctx.fillStyle = COLORS[item.kind];
    ctx.fillRect(item.pos.x * T + 5, item.pos.y * T + 5, 6, 6);
  }

  for (const u of state.units) {
    const seen = visible[u.pos.y][u.pos.x];
    if (!u.alive) {
      if (!seen) continue;
      ctx.strokeStyle = COLORS.dead;
      ctx.beginPath();
      ctx.moveTo(u.pos.x * T + 3, u.pos.y * T + 3);
      ctx.lineTo(u.pos.x * T + T - 3, u.pos.y * T + T - 3);
      ctx.moveTo(u.pos.x * T + T - 3, u.pos.y * T + 3);
      ctx.lineTo(u.pos.x * T + 3, u.pos.y * T + T - 3);
      ctx.stroke();
      continue;
    }
    if (u.side === 'enemy' && !seen) continue;

    const off = effects.unitOffset(u.id, now);
    const cx = u.pos.x * T + T / 2 + off.x;
    const cy = u.pos.y * T + T / 2 + off.y;
    ctx.fillStyle = u.side === 'player' ? COLORS.player : COLORS.enemy;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    const v = FACING_VECTORS[u.facing];
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + v.x * 7, cy + v.y * 7);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 6, cy - 9, 12, 2);
    ctx.fillStyle = '#7dff9a';
    ctx.fillRect(cx - 6, cy - 9, (12 * u.hp) / u.maxHp, 2);
    if (u.id === ui.selectedId) {
      ctx.strokeStyle = COLORS.select;
      ctx.strokeRect(u.pos.x * T + 0.5, u.pos.y * T + 0.5, T - 1, T - 1);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const p of ui.preview) ctx.fillRect(p.x * T + 6, p.y * T + 6, 4, 4);
  if (ui.hover) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(ui.hover.x * T + 0.5, ui.hover.y * T + 0.5, T - 1, T - 1);
  }

  effects.draw(ctx, now);
  drawPanel(ctx, state, ui, now);
}
