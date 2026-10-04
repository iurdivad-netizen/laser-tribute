import { CONFIG, WEAPONS } from '../core/config';
import { rankShort } from '../core/ranks';
import type { GameState, Unit } from '../core/types';
import type { UiState } from '../input/uiState';
import { UI, drawFrame, type ButtonState } from '../ui/frame';
import { clipText, drawText } from '../ui/text';
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
  ['throw', 'THROW', 'T'],
  ['stab', 'STAB', 'K'],
  ['reload', 'RELOAD', 'R'],
  ['door', 'DOOR', 'D'],
  ['pickup', 'TAKE', 'P'],
  ['alert', 'ALERT', 'L'],
  ['end', 'END TURN', 'SPC'],
];

const TOP = VIEW.mapHeight;

/** Row 1: five buttons 60 wide from x 156; row 2: four buttons 76 wide from x 156. */
export const PANEL_BUTTONS: PanelButton[] = DEFS.map(([id, label, key], i) =>
  i < 5
    ? { id, label, key, x: 156 + i * 64, y: TOP + 28, w: 60, h: 22 }
    : { id, label, key, x: 156 + (i - 5) * 80, y: TOP + 52, w: 76, h: 22 },
);

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
  if (id === 'throw') return u.grenades < 1;
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
  drawFrame(ctx, 0, TOP, VIEW.width, VIEW.height - TOP, 'raised');
  drawFrame(ctx, 4, TOP + 4, 144, 72, 'inset');

  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);
  if (u) {
    const tag = rankShort(u.rank);
    const weapon = WEAPONS[u.weapon];
    drawText(ctx, `${tag ? `${tag} ` : ''}${u.name}`, 8, TOP + 8, UI.text);
    drawText(ctx, `HP ${u.hp}/${u.maxHp}  AP ${u.ap}/${u.maxAp}`, 8, TOP + 19, UI.dim);
    drawText(ctx, `${weapon.name} ${u.ammo}/${weapon.magazine} +${u.clips}  GREN ${u.grenades}`, 8, TOP + 30, UI.text);
    if (u.alert) drawText(ctx, 'ALERT', 8, TOP + 41, UI.accent);
  } else {
    drawText(ctx, 'NO SOLDIER SELECTED', 8, TOP + 8, UI.dim);
  }
  drawText(ctx, '1-4 SELECT  Q/E TURN', 8, TOP + 54, UI.hint);
  drawText(ctx, 'ESC CANCEL  M MUTE', 8, TOP + 65, UI.hint);

  drawText(ctx, `TURN ${state.turnNumber}  ${state.turn === 'player' ? 'YOUR MOVE' : 'ENEMY MOVE'}`, 156, TOP + 6, UI.dim);

  let line = '';
  if (state.status === 'won') line = 'MISSION COMPLETE';
  else if (state.status === 'lost') line = 'MISSION FAILED';
  else if (now < ui.messageUntil) line = ui.message;
  else if (ui.previewCost !== null) line = `Move: ${ui.previewCost} AP`;
  else if (u && MODE_NAMES[ui.mode]) {
    line = `${MODE_NAMES[ui.mode]}: ${actionCost(u, ui.mode as ButtonId)} AP`;
  }
  drawText(ctx, clipText(line, 320), 156, TOP + 17, state.status === 'playing' ? UI.accent : UI.green);

  const modeButton: Partial<Record<UiState['mode'], ButtonId>> = {
    snap: 'snap', aimed: 'aimed', throw: 'throw', door: 'door', stab: 'stab',
  };
  for (const b of PANEL_BUTTONS) {
    const active = modeButton[ui.mode] === b.id || (b.id === 'alert' && !!u?.alert);
    const blocked = !!u && actionBlocked(u, b.id);
    const style: ButtonState = active ? 'pressed' : blocked ? 'disabled' : 'raised';
    drawFrame(ctx, b.x, b.y, b.w, b.h, style);
    drawText(ctx, `${b.key} ${b.label}`, b.x + 3, b.y + 4, active ? UI.accent : blocked ? UI.disabledText : UI.text);
    const cost = u ? actionCost(u, b.id) : null;
    if (cost !== null) drawText(ctx, `${cost} AP`, b.x + 3, b.y + 12, blocked ? UI.red : UI.dim);
  }
}
