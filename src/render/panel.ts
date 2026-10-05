import { CONFIG, GADGETS, WEAPONS } from '../core/config';
import { rankShort } from '../core/ranks';
import type { GameState, Unit } from '../core/types';
import type { UiState } from '../input/uiState';
import { textWidth } from '../ui/font';
import { UI, drawFrame, type ButtonState } from '../ui/frame';
import { LEGACY_SIZE, computeLayout, type ActionId, type Layout, type Rect } from '../ui/layout';
import { clipText, drawText } from '../ui/text';
import type { Zoom } from './camera';

export type ButtonId = ActionId;

/** The layout of a 480x400 window: what drawing falls back to when no layout is given. */
export const DEFAULT_LAYOUT: Layout = computeLayout(LEGACY_SIZE.width, LEGACY_SIZE.height, 1);

/** What the panel shows besides the game state. */
export interface PanelExtras {
  zoom: Zoom;
  soundOn: boolean;
}

const DEFAULT_EXTRAS: PanelExtras = { zoom: 'whole', soundOn: true };

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
    case 'turn': return CONFIG.turnCostPer45;
    case 'gadget':
      return u.gadget === 'medkit' ? GADGETS.medkit.apCost : u.gadget === 'scanner' ? GADGETS.scanner.apCost : null;
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
  if (id === 'gadget') return u.gadget !== 'medkit' && u.gadget !== 'scanner';
  return false;
}

const MODE_NAMES: Partial<Record<UiState['mode'], string>> = {
  snap: 'Snap shot', aimed: 'Aimed shot', throw: 'Grenade', door: 'Door', stab: 'Stab', heal: 'Heal', turn: 'Turn',
};

const inRect = (r: Rect, px: number, py: number): boolean => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

export function panelButtonAt(layout: Layout, px: number, py: number): ButtonId | null {
  return layout.actions.find((a) => inRect(a.rect, px, py))?.id ?? null;
}

/** Which of the four squad buttons is at the position (0 to 3), or null. */
export function squadAt(layout: Layout, px: number, py: number): number | null {
  const i = layout.squad.findIndex((r) => inRect(r, px, py));
  return i < 0 ? null : i;
}

export const cancelHit = (layout: Layout, px: number, py: number): boolean => inRect(layout.cancel, px, py);
export const soundHit = (layout: Layout, px: number, py: number): boolean => inRect(layout.sound, px, py);

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UiState,
  now: number,
  layout: Layout = DEFAULT_LAYOUT,
  extras: PanelExtras = DEFAULT_EXTRAS,
): void {
  const scale = layout.text;
  const textH = 7 * scale;
  const text = (s: string, x: number, y: number, colour: string, align: 'left' | 'right' | 'center' = 'left') =>
    drawText(ctx, s, x, y, colour, align, undefined, scale);
  const midY = (r: Rect) => r.y + Math.floor((r.h - textH) / 2);
  const fits = (s: string, w: number) => textWidth(s) * scale <= w;

  drawFrame(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, 'raised');
  if (layout.overlay) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, layout.status.y - 2, layout.map.w, layout.status.h + 4);
    ctx.fillRect(0, layout.detail.y - 2, layout.map.w, layout.detail.h + 4);
  }

  const u = state.units.find((x) => x.id === ui.selectedId && x.alive);

  // the status line: a message, the preview cost, the mode, or whose move it is
  let line = '';
  let colour: string = state.status === 'playing' ? UI.accent : UI.green;
  if (state.status === 'won') line = 'MISSION COMPLETE';
  else if (state.status === 'lost') line = 'MISSION FAILED';
  else if (now < ui.messageUntil) line = ui.message;
  else if (ui.previewCost !== null) line = `Move: ${ui.previewCost} AP`;
  else if (u && MODE_NAMES[ui.mode]) {
    const cost = actionCost(u, ui.mode === 'heal' ? 'gadget' : (ui.mode as ButtonId));
    line = cost === null ? MODE_NAMES[ui.mode]! : `${MODE_NAMES[ui.mode]}: ${cost} AP`;
  }
  if (!line) {
    line = `TURN ${state.turnNumber}  ${state.turn === 'player' ? 'YOUR MOVE' : 'ENEMY MOVE'}`;
    colour = UI.dim;
  }
  text(clipText(line, (layout.status.w - 4) / scale), layout.status.x + 2, midY(layout.status), colour);

  if (ui.mode !== 'move') {
    drawFrame(ctx, layout.cancel.x, layout.cancel.y, layout.cancel.w, layout.cancel.h, 'raised');
    const label = fits('CANCEL', layout.cancel.w - 6) ? 'CANCEL' : 'X';
    text(label, layout.cancel.x + layout.cancel.w / 2, midY(layout.cancel), UI.accent, 'center');
  }
  drawFrame(ctx, layout.sound.x, layout.sound.y, layout.sound.w, layout.sound.h, extras.soundOn ? 'raised' : 'pressed');
  const sound = fits('SND', layout.sound.w - 4) ? 'SND' : 'S';
  text(sound, layout.sound.x + layout.sound.w / 2, midY(layout.sound), extras.soundOn ? UI.text : UI.red, 'center');

  // the detail line for the selected soldier
  if (u) {
    const weapon = WEAPONS[u.weapon];
    const tag = rankShort(u.rank);
    const parts = [
      `${tag ? `${tag} ` : ''}${u.name}`,
      `AP ${u.ap}/${u.maxAp}`,
      `${weapon.name.toUpperCase()} ${u.ammo}/${weapon.magazine} +${u.clips}`,
      `GREN ${u.grenades}`,
    ];
    if (u.gadget) parts.push(GADGETS[u.gadget].name.toUpperCase());
    if (u.attachment) parts.push('SCOPE');
    if (u.alert) parts.push('ALERT');
    text(clipText(parts.join('  '), (layout.detail.w - 4) / scale), layout.detail.x + 2, midY(layout.detail), UI.text);
  } else {
    text('NO SOLDIER SELECTED', layout.detail.x + 2, midY(layout.detail), UI.dim);
  }

  // the squad strip: one button per soldier with a mini health bar
  const squad = state.units.filter((x) => x.side === 'player');
  layout.squad.forEach((r, i) => {
    const s = squad[i];
    const selected = !!s && s.id === ui.selectedId && s.alive;
    drawFrame(ctx, r.x, r.y, r.w, r.h, selected ? 'pressed' : s && s.alive ? 'raised' : 'disabled');
    if (!s) return;
    text(clipText(s.name, (r.w - 6) / scale), r.x + 3, r.y + 3, s.alive ? (selected ? UI.accent : UI.text) : UI.disabledText);
    if (s.alive) {
      ctx.fillStyle = '#000';
      ctx.fillRect(r.x + 3, r.y + r.h - 8, r.w - 6, 4);
      ctx.fillStyle = '#7dff9a';
      ctx.fillRect(r.x + 3, r.y + r.h - 8, ((r.w - 6) * s.hp) / s.maxHp, 4);
    }
  });

  // the action buttons
  const modeButton: Partial<Record<UiState['mode'], ButtonId>> = {
    snap: 'snap', aimed: 'aimed', throw: 'throw', door: 'door', stab: 'stab', heal: 'gadget', turn: 'turn',
  };
  for (const b of layout.actions) {
    const r = b.rect;
    const active = modeButton[ui.mode] === b.id || (b.id === 'alert' && !!u?.alert) || (b.id === 'zoom' && extras.zoom === 'close');
    const blocked = !!u && actionBlocked(u, b.id);
    const style: ButtonState = active ? 'pressed' : blocked ? 'disabled' : 'raised';
    drawFrame(ctx, r.x, r.y, r.w, r.h, style);
    const word = b.id === 'gadget' && u?.gadget === 'medkit' ? 'HEAL' : b.id === 'gadget' && u?.gadget === 'scanner' ? 'SCAN' : b.label;
    const keyed = `${b.key} ${word}`;
    const label = fits(keyed, r.w - 6) ? keyed : word;
    const cost = u ? actionCost(u, b.id) : null;
    const twoLines = cost !== null && r.h >= textH * 2 + 6;
    const colourOf = active ? UI.accent : blocked ? UI.disabledText : UI.text;
    const ly = twoLines ? r.y + Math.floor((r.h - textH * 2 - 2) / 2) : midY(r);
    text(label, r.x + r.w / 2, ly, colourOf, 'center');
    if (twoLines) text(`${cost} AP`, r.x + r.w / 2, ly + textH + 2, blocked ? UI.red : UI.dim, 'center');
  }
}
