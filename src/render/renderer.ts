import { Atlas } from '../art/atlas';
import { ARMOUR_PIP, floorVariant, pipPositions, rankPips, unitSprite } from '../art/sprite';
import type { SpriteName } from '../art/sprites';
import { CONFIG } from '../core/config';
import type { GameState } from '../core/types';
import { computeVisible } from '../core/vision';
import type { UiState } from '../input/uiState';
import type { Effects } from './effects';
import { VIEW } from './layout';
import { drawText } from '../ui/text';
import { drawPanel } from './panel';

const T = CONFIG.tileSize;

/** The atlas the game draws with (also used by the dev gallery). */
export const defaultAtlas = new Atlas();

const COLORS = {
  select: '#ffe14d',
  pip: '#ffe14d',
  scan: '#ff4d4d',
  armour: '#4da6ff',
  rifle: '#d0d0d0',
  pistol: '#a0a0a0',
};

function tileSprite(state: GameState, x: number, y: number): SpriteName {
  const tile = state.tiles[y][x];
  if (tile.kind === 'wall') return 'wall';
  if (tile.kind === 'door') return state.doorMemory[y][x] ? 'door_open' : 'door_closed'; // as the player last saw it
  return `floor_${floorVariant(x, y)}` as SpriteName;
}

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UiState,
  effects: Effects,
  now: number,
  art: Atlas = defaultAtlas,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const visible = computeVisible(state, 'player');

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!state.explored[y][x]) continue;
      art.draw(ctx, tileSprite(state, x, y), x * T, y * T);
      if (!visible[y][x]) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }

  for (const item of state.items) {
    if (!visible[item.pos.y][item.pos.x]) continue;
    art.draw(ctx, `item_${item.kind}` as SpriteName, item.pos.x * T, item.pos.y * T);
  }

  // Corpses first, in their own pass, so a living unit standing on (or sliding past) a corpse is drawn on top of it.
  for (const u of state.units) {
    if (u.alive || !visible[u.pos.y][u.pos.x]) continue;
    art.draw(ctx, u.side === 'player' ? 'corpse_player' : 'corpse_enemy', u.pos.x * T, u.pos.y * T);
  }

  for (const u of state.units) {
    if (!u.alive) continue;
    const seen = visible[u.pos.y][u.pos.x];
    if (u.side === 'enemy' && !seen) continue;

    const off = effects.unitOffset(u.id, now);
    const x0 = Math.round(u.pos.x * T + off.x);
    const y0 = Math.round(u.pos.y * T + off.y + effects.unitBob(u.id, now));
    const { name, flip } = unitSprite(u.side, u.facing, u.weapon);
    art.draw(ctx, name, x0, y0, { flip });
    const cx = x0 + T / 2;
    const cy = y0 + T / 2;

    if (u.side === 'player') {
      ctx.fillStyle = COLORS.pip;
      for (const p of pipPositions(rankPips(u.rank))) ctx.fillRect(x0 + p.x, y0 + p.y, 1, 2);
      if (u.gadget === 'armour') {
        ctx.fillStyle = COLORS.armour;
        ctx.fillRect(x0 + ARMOUR_PIP.x, y0 + ARMOUR_PIP.y, ARMOUR_PIP.w, ARMOUR_PIP.h);
      }
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 6, cy - 9, 12, 2);
    ctx.fillStyle = '#7dff9a';
    ctx.fillRect(cx - 6, cy - 9, (12 * u.hp) / u.maxHp, 2);
    if (u.alert) {
      drawText(ctx, '!', cx + 5, cy - 17, COLORS.select);
    }
    if (u.id === ui.selectedId) {
      ctx.strokeStyle = COLORS.select;
      ctx.strokeRect(u.pos.x * T + 0.5, u.pos.y * T + 0.5, T - 1, T - 1);
    }
  }

  ctx.fillStyle = COLORS.scan;
  for (const p of state.scanned) {
    if (!visible[p.y][p.x]) ctx.fillRect(p.x * T + 6, p.y * T + 6, 4, 4);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const p of ui.preview) ctx.fillRect(p.x * T + 6, p.y * T + 6, 4, 4);
  if (ui.hover) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(ui.hover.x * T + 0.5, ui.hover.y * T + 0.5, T - 1, T - 1);
  }

  effects.draw(ctx, now, art);
  drawPanel(ctx, state, ui, now);
}
