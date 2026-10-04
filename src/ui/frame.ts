import { drawText } from './text';

/** Interface colours, taken from the sprite palette so the menus match the world. */
export const UI = {
  black: '#000000',
  fill: '#1c1f2e',
  fillHi: '#2a2f45',
  fillDark: '#14161f',
  light: '#8b8fa8',
  dark: '#0b0c12',
  text: '#e8e8f0',
  dim: '#8a8fa8',
  hint: '#6a6f88',
  disabledText: '#555a70',
  accent: '#ffe14d',
  red: '#ff5555',
  green: '#7dff9a',
  blue: '#4da6ff',
} as const;

export type FrameStyle = 'raised' | 'pressed' | 'hover' | 'disabled' | 'inset';
export type ButtonState = 'raised' | 'pressed' | 'hover' | 'disabled';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An Amiga-style bevelled box: a 2 px light edge top-left and a dark one bottom-right (swapped when pressed or inset). */
export function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: FrameStyle): void {
  const sunk = style === 'pressed' || style === 'inset';
  ctx.fillStyle = sunk || style === 'disabled' ? UI.fillDark : style === 'hover' ? UI.fillHi : UI.fill;
  ctx.fillRect(x, y, w, h);
  const topLeft = sunk || style === 'disabled' ? UI.dark : UI.light;
  const bottomRight = sunk ? UI.light : UI.dark;
  ctx.fillStyle = topLeft;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = bottomRight;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, state: ButtonState = 'raised'): void {
  drawFrame(ctx, r.x, r.y, r.w, r.h, state);
  const colour = state === 'disabled' ? UI.disabledText : state === 'pressed' ? UI.accent : UI.text;
  drawText(ctx, label, r.x + r.w / 2, r.y + Math.floor((r.h - 7) / 2), colour, 'center');
}
