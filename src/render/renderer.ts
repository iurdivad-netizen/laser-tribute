import type { SpriteName } from '../art/sprites';
import { Atlas } from '../art/atlas';
import { RISE, unitFigure, type Figure } from '../art/figure';
import { ARMOUR_PIP, pipPositions, rankPips } from '../art/sprite';
import { corpseHalves, corpseLook } from '../art/corpse';
import { itemImage, themeFor, tileImage } from '../art/theme';
import { CONFIG, THROWABLES } from '../core/config';
import type { GameState } from '../core/types';
import { computeVisible } from '../core/vision';
import type { UiState } from '../input/uiState';
import type { Layout } from '../ui/layout';
import { drawText } from '../ui/text';
import { type Camera, createCamera, originOf } from './camera';
import type { Effects } from './effects';
import { DEFAULT_LAYOUT, type PanelExtras, drawPanel } from './panel';
import { drawCard } from './card';
import { RANGE_COLORS, blastTiles, blastVictims, rangeTiles } from './ranges';

const T = CONFIG.tileSize;

/** The atlas the game draws with (also used by the dev gallery). */
export const defaultAtlas = new Atlas();

const COLORS = {
  select: '#ffe14d',
  pip: '#ffe14d',
  scan: '#ff4d4d',
  armour: '#4da6ff',
};

function tileFigure(state: GameState, x: number, y: number): Figure {
  const tile = state.tiles[y][x];
  // a door as the player last saw it
  return tileImage(themeFor(state), tile.kind, tile.kind === 'door' && state.doorMemory[y][x], x, y);
}

/** Where the map and the panel are on the screen, and which part of the map is shown. */
export interface MissionView {
  layout: Layout;
  camera: Camera;
}

/** The view of a 480x400 window with the whole map in sight (used when no view is given, e.g. in tests). */
export function defaultView(state: GameState): MissionView {
  return { layout: DEFAULT_LAYOUT, camera: createCamera(DEFAULT_LAYOUT, state.width, state.height) };
}

export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UiState,
  effects: Effects,
  now: number,
  art: Atlas = defaultAtlas,
  view: MissionView = defaultView(state),
  extras?: PanelExtras,
): void {
  const { layout, camera } = view;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, layout.width, layout.height);

  // the world is drawn in 16-pixel tile coordinates through the camera, clipped to the map rectangle
  const origin = originOf(camera, layout, state.width, state.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.map.x, layout.map.y, layout.map.w, layout.map.h);
  ctx.clip();
  ctx.translate(origin.x, origin.y);
  ctx.scale(origin.tile / T, origin.tile / T);

  const visible = computeVisible(state, 'player');

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!state.explored[y][x]) continue;
      art.drawImage(ctx, tileFigure(state, x, y), x * T, y * T);
      if (!visible[y][x]) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }

  for (const item of state.items) {
    if (!visible[item.pos.y][item.pos.x]) continue;
    art.drawImage(ctx, itemImage(item.kind), item.pos.x * T, item.pos.y * T);
  }

  // What the selected soldier could shoot or throw at (a faint tint on explored tiles), and the blast of a throw at the
  // hovered tile; under the corpses and the units.
  const selected = ui.selectedId ? state.units.find((u) => u.id === ui.selectedId && u.alive && u.side === 'player') : undefined;
  const aiming = selected && state.turn === 'player' && (ui.mode === 'snap' || ui.mode === 'aimed' || ui.mode === 'throw');
  let blastAt: { x: number; y: number } | null = null;
  if (selected && aiming) {
    const kind = ui.mode === 'throw' ? 'throw' : 'shot';
    const reach = rangeTiles(kind, state, selected);
    ctx.fillStyle = RANGE_COLORS[kind];
    for (const p of reach) if (state.explored[p.y][p.x]) ctx.fillRect(p.x * T, p.y * T, T, T);
    const hover = ui.hover;
    if (kind === 'throw' && hover && reach.some((p) => p.x === hover.x && p.y === hover.y)) {
      blastAt = hover;
      ctx.fillStyle = RANGE_COLORS.blast[selected.throwable];
      for (const p of blastTiles(state, hover, THROWABLES[selected.throwable].radius)) {
        if (state.explored[p.y][p.x]) ctx.fillRect(p.x * T, p.y * T, T, T);
      }
    }
  }

  // Corpses first, in their own pass, so a living unit standing on (or sliding past) a corpse is drawn on top of it.
  for (const u of state.units) {
    if (u.alive || !visible[u.pos.y][u.pos.x]) continue;
    const { image, extend } = corpseLook(state, u);
    if (extend === 0) {
      art.drawImage(ctx, image, u.pos.x * T, u.pos.y * T);
      continue;
    }
    // a lying soldier is two tiles long; corpseLook only picks tiles the player has explored
    const left = u.pos.x + Math.min(0, extend);
    corpseHalves(image).forEach((half, i) => {
      art.drawImage(ctx, half, (left + i) * T, u.pos.y * T);
    });
  }

  // fire lies under the units, smoke over them; on every tile the player has explored (smoke tiles themselves are never
  // 'visible', and the player threw them)
  for (const h of state.hazards) {
    if (h.kind === 'fire' && state.explored[h.pos.y][h.pos.x]) art.draw(ctx, `fire_${Math.floor(now / 200) % 2}` as SpriteName, h.pos.x * T, h.pos.y * T);
  }

  // Living units in order of tile row, the lowest row last, so a figure in front covers the one behind it (and the wall
  // its head overlaps). The sort is stable: units on one row keep their list order.
  const living = state.units
    .filter((u) => u.alive && !(u.side === 'enemy' && !visible[u.pos.y][u.pos.x]))
    .sort((p, q) => p.pos.y - q.pos.y);
  let selectedAt: { x: number; y: number } | null = null;
  // while a soldier moves or opens doors his comrades are see-through, so the map behind them shows (their heads also stop catching clicks, see App.figureAt)
  const fadeOthers = !!selected && state.status === 'playing' && state.turn === 'player' && (ui.mode === 'move' || ui.mode === 'door');
  for (const u of living) {
    ctx.globalAlpha = fadeOthers && u.side === 'player' && u.id !== selected!.id ? 0.5 : 1;
    const off = effects.unitOffset(u.id, now);
    const x0 = Math.round(u.pos.x * T + off.x); // the top-left of the tile the feet stand on
    const y0 = Math.round(u.pos.y * T + off.y + effects.unitBob(u.id, now));
    const { figure, flip } = unitFigure(u.side, u.facing, u.weapon);
    art.drawImage(ctx, figure, x0, y0 - RISE, { flip });
    const cx = x0 + T / 2;

    // The status stack (pips, bar, alert mark) floats above the head; for a unit on the first walkable row there is no
    // room above the map's top edge, so the stack is pushed down over the head instead of being clipped away.
    const shift = Math.max(0, -(y0 - RISE - (u.alert ? 13 : 9)));
    if (u.side === 'player') {
      ctx.fillStyle = COLORS.pip;
      for (const p of pipPositions(rankPips(u.rank))) ctx.fillRect(x0 + p.x, y0 + p.y + shift, 1, 2);
      if (u.gadget === 'armour') {
        ctx.fillStyle = COLORS.armour;
        ctx.fillRect(x0 + ARMOUR_PIP.x, y0 + ARMOUR_PIP.y + shift, ARMOUR_PIP.w, ARMOUR_PIP.h);
      }
    }

    const barY = y0 - RISE - 6 + shift; // the bar's bottom is 4 px above the top of the figure
    if (u.id === ui.selectedId || u.hp < u.maxHp) {
      // only the selected unit (which also marks who is selected) and the hurt ones show their health
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - 6, barY, 12, 2);
      ctx.fillStyle = '#7dff9a';
      ctx.fillRect(cx - 6, barY, (12 * u.hp) / u.maxHp, 2);
    }
    if (u.alert) {
      drawText(ctx, '!', cx + 8, barY - 7, COLORS.select);
    }
    if (u.id === ui.selectedId) selectedAt = { x: u.pos.x * T, y: u.pos.y * T };
  }
  ctx.globalAlpha = 0.8;
  for (const h of state.hazards) {
    if (h.kind === 'smoke' && state.explored[h.pos.y][h.pos.x]) art.draw(ctx, 'smoke', h.pos.x * T, h.pos.y * T);
  }
  ctx.globalAlpha = 1;
  if (selectedAt) {
    // after every figure, so one standing in front cannot cover the outline of the selected soldier's tile
    ctx.strokeStyle = COLORS.select;
    ctx.strokeRect(selectedAt.x + 0.5, selectedAt.y + 0.5, T - 1, T - 1);
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

  if (selected && blastAt) {
    // who a throw at the hovered tile would hit: foes in red, friends (the thrower too) in cyan; above the hover outline
    for (const v of blastVictims(state, selected, blastAt)) {
      ctx.strokeStyle = v.friend ? RANGE_COLORS.friend : RANGE_COLORS.foe;
      const inset = v.friend ? 2 : 0; // friends get an inner box, so the selection outline cannot hide it
      ctx.strokeRect(v.unit.pos.x * T + 0.5 + inset, v.unit.pos.y * T + 0.5 + inset, T - 1 - 2 * inset, T - 1 - 2 * inset);
    }
  }

  effects.draw(ctx, now, art);
  ctx.restore();

  drawPanel(ctx, state, ui, now, layout, extras ?? { zoom: camera.zoom, soundOn: true });
  drawCard(ctx, state, ui, layout);
}
