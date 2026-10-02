import { WEAPONS } from '../core/config';
import type { GameState } from '../core/types';
import type { UiState } from '../input/uiState';
import { VIEW } from './layout';

export type ButtonId = 'snap' | 'aimed' | 'throw' | 'door' | 'pickup' | 'alert' | 'end';

export interface PanelButton {
  id: ButtonId;
  label: string;
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFS: [ButtonId, string, string][] = [
  ['snap', 'SNAP', 'S'],
  ['aimed', 'AIM', 'A'],
  ['throw', 'THROW', 'T'],
  ['door', 'DOOR', 'D'],
  ['pickup', 'TAKE', 'P'],
  ['alert', 'ALERT', 'L'],
  ['end', 'END', 'Spc'],
];

export const PANEL_BUTTONS: PanelButton[] = DEFS.map(([id, label, key], i) => ({
  id, label, key, x: 172 + i * 44, y: VIEW.mapHeight + 20, w: 40, h: 16,
}));

export function buttonAt(px: number, py: number): ButtonId | null {
  const b = PANEL_BUTTONS.find((x) => px >= x.x && px < x.x + x.w && py >= x.y && py < x.y + x.h);
  return b ? b.id : null;
}

export function drawPanel(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState, now: number): void {
  const top = VIEW.mapHeight;
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, top, VIEW.width, VIEW.height - top);
  ctx.fillStyle = '#3a3f55';
  ctx.fillRect(0, top, VIEW.width, 1);
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';

  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);
  ctx.fillStyle = '#e8e8f0';
  if (u) {
    ctx.fillText(`${u.name}  HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}`, 4, top + 4);
    ctx.fillText(`${WEAPONS[u.weapon].name}  Grenades ${u.grenades}${u.alert ? '  ALERT' : ''}`, 4, top + 15);
  } else {
    ctx.fillText('No soldier selected', 4, top + 4);
  }
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Turn ${state.turnNumber}  ${state.turn === 'player' ? 'YOUR MOVE' : 'ENEMY MOVE'}`, 172, top + 4);

  let line = '';
  if (state.status === 'won') line = 'MISSION COMPLETE';
  else if (state.status === 'lost') line = 'MISSION FAILED';
  else if (now < ui.messageUntil) line = ui.message;
  else if (ui.previewCost !== null) line = `Move: ${ui.previewCost} AP`;
  ctx.fillStyle = state.status === 'playing' ? '#ffe14d' : '#7dff9a';
  ctx.fillText(line, 172, top + 11);

  const modeButton: Partial<Record<UiState['mode'], ButtonId>> = {
    snap: 'snap', aimed: 'aimed', throw: 'throw', door: 'door',
  };
  for (const b of PANEL_BUTTONS) {
    const active = modeButton[ui.mode] === b.id || (b.id === 'alert' && !!u?.alert);
    ctx.fillStyle = active ? '#4da6ff' : '#2a2f45';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = active ? '#000' : '#e8e8f0';
    ctx.fillText(`${b.key} ${b.label}`, b.x + 3, b.y + 4);
  }
  ctx.fillStyle = '#6a6f88';
  ctx.fillText('1-4 select  Q/E turn  Esc cancel', 4, top + 28);
}
