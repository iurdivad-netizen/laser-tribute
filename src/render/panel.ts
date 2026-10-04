import { CONFIG, WEAPONS } from '../core/config';
import { rankShort } from '../core/ranks';
import type { GameState, Unit } from '../core/types';
import type { UiState } from '../input/uiState';
import { VIEW } from './layout';

export type ButtonId = 'snap' | 'aimed' | 'throw' | 'stab' | 'reload' | 'door' | 'pickup' | 'alert' | 'end';

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
  ['throw', 'GREN', 'T'],
  ['stab', 'STAB', 'K'],
  ['reload', 'LOAD', 'R'],
  ['door', 'DOOR', 'D'],
  ['pickup', 'TAKE', 'P'],
  ['alert', 'ALRT', 'L'],
  ['end', 'END', 'Sp'],
];

export const PANEL_BUTTONS: PanelButton[] = DEFS.map(([id, label, key], i) => ({
  id, label, key, x: 172 + i * 34, y: VIEW.mapHeight + 13, w: 33, h: 13,
}));

/** AP the soldier pays for the action behind this button; null for buttons that cost nothing. */
export function actionCost(u: Unit, id: ButtonId): number | null {
  switch (id) {
    case 'snap': return WEAPONS[u.weapon].snapAp;
    case 'aimed': return WEAPONS[u.weapon].aimedAp;
    case 'throw': return CONFIG.grenade.apCost;
    case 'stab': return CONFIG.knife.apCost;
    case 'reload': return CONFIG.reloadAp;
    case 'door': return CONFIG.doorCost;
    case 'pickup': return CONFIG.pickupCost;
    default: return null;
  }
}

/** True when the button's action cannot be used right now (not enough AP, empty gun, nothing to reload). */
export function actionBlocked(u: Unit, id: ButtonId): boolean {
  const cost = actionCost(u, id);
  if (cost !== null && u.ap < cost) return true;
  if (id === 'reload') return u.clips < 1 || u.ammo >= WEAPONS[u.weapon].magazine;
  if (id === 'snap' || id === 'aimed') return u.ammo < 1;
  return false;
}

const MODE_NAMES: Partial<Record<UiState['mode'], string>> = {
  snap: 'Snap shot', aimed: 'Aimed shot', throw: 'Grenade', door: 'Door', stab: 'Stab',
};

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
    const tag = rankShort(u.rank);
    ctx.fillText(`${tag ? `${tag} ` : ''}${u.name}  HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}`, 4, top + 4);
    ctx.fillText(
      `${WEAPONS[u.weapon].name} ${u.ammo}/${WEAPONS[u.weapon].magazine} +${u.clips}  Grenades ${u.grenades}${u.alert ? '  ALERT' : ''}`,
      4, top + 15,
    );
  } else {
    ctx.fillText('No soldier selected', 4, top + 4);
  }
  ctx.fillStyle = '#8a8fa8';
  ctx.fillText(`Turn ${state.turnNumber}  ${state.turn === 'player' ? 'YOUR MOVE' : 'ENEMY MOVE'}`, 172, top + 2);

  let line = '';
  if (state.status === 'won') line = 'MISSION COMPLETE';
  else if (state.status === 'lost') line = 'MISSION FAILED';
  else if (now < ui.messageUntil) line = ui.message;
  else if (ui.previewCost !== null) line = `Move: ${ui.previewCost} AP`;
  else if (u && MODE_NAMES[ui.mode]) {
    line = `${MODE_NAMES[ui.mode]}: ${actionCost(u, ui.mode as ButtonId)} AP`;
  }
  ctx.fillStyle = state.status === 'playing' ? '#ffe14d' : '#7dff9a';
  ctx.fillText(line, 262, top + 2);

  const modeButton: Partial<Record<UiState['mode'], ButtonId>> = {
    snap: 'snap', aimed: 'aimed', throw: 'throw', door: 'door', stab: 'stab',
  };
  for (const b of PANEL_BUTTONS) {
    const active = modeButton[ui.mode] === b.id || (b.id === 'alert' && !!u?.alert);
    ctx.fillStyle = active ? '#4da6ff' : '#2a2f45';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = active ? '#000' : '#e8e8f0';
    ctx.fillText(`${b.key} ${b.label}`, b.x + 2, b.y + 3);
    const cost = u ? actionCost(u, b.id) : null;
    if (cost !== null) {
      ctx.fillStyle = actionBlocked(u!, b.id) ? '#ff5555' : '#8a8fa8';
      ctx.fillText(`${cost} AP`, b.x + 2, b.y + 15);
    }
  }
  ctx.fillStyle = '#6a6f88';
  ctx.fillText('1-4 select  Q/E turn  Esc cancel', 4, top + 28);
}
