import { textWidth } from './font';

/** The size the menus are drawn at, and the default window of an App with no size. */
export const LEGACY_SIZE = { width: 480, height: 400 } as const;

export interface Rect { x: number; y: number; w: number; h: number }

export const ACTIONS = [
  { id: 'snap', label: 'SNAP', key: 'S' }, { id: 'aimed', label: 'AIM', key: 'A' }, { id: 'throw', label: 'THROW', key: 'T' },
  { id: 'stab', label: 'STAB', key: 'K' }, { id: 'reload', label: 'RELOAD', key: 'R' }, { id: 'door', label: 'DOOR', key: 'D' },
  { id: 'pickup', label: 'TAKE', key: 'P' }, { id: 'alert', label: 'ALERT', key: 'L' }, { id: 'gadget', label: 'GADGET', key: 'G' },
  { id: 'turn', label: 'TURN', key: 'F' }, { id: 'zoom', label: 'ZOOM', key: 'Z' }, { id: 'end', label: 'END TURN', key: 'SPC' },
] as const;

export type ActionId = (typeof ACTIONS)[number]['id'];

export interface LayoutButton { id: ActionId; label: string; key: string; rect: Rect }

/** Every rectangle of the mission screen, in CSS pixels: the single source of truth for drawing and hit-testing. */
export interface Layout {
  width: number;
  height: number;
  dpr: number;
  orientation: 'landscape' | 'portrait';
  /** Where the map is drawn. */
  map: Rect;
  /** The panel background. */
  panel: Rect;
  /** Status and detail are drawn over the map (landscape) instead of inside the panel. */
  overlay: boolean;
  status: Rect;
  detail: Rect;
  cancel: Rect;
  sound: Rect;
  /** Always four. */
  squad: Rect[];
  /** Always twelve, in ACTIONS order. */
  actions: LayoutButton[];
  /** Text scale in CSS pixels per font pixel (a device-pixel integer scale divided by the pixel ratio). */
  text: number;
}

const PAD = 6;
const GAP = 4;

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** `count` cells in `cols` columns across `w`, each `cellH` tall, row by row. */
function grid(x: number, y: number, w: number, cols: number, count: number, cellH: number): Rect[] {
  const cellW = (w - (cols - 1) * GAP) / cols;
  return Array.from({ length: count }, (_, i) =>
    R(x + (i % cols) * (cellW + GAP), y + Math.floor(i / cols) * (cellH + GAP), cellW, cellH),
  );
}

/** The largest integer device-pixel scale (as CSS pixels per font pixel) at which every action label fits its button. */
function chooseText(rects: Rect[], dpr: number): number {
  const cap = Math.max(1, Math.round((14 * dpr) / 7));
  for (let s = cap; s >= 1; s--) {
    const t = s / dpr;
    if (ACTIONS.every((a, i) => textWidth(a.label) * t + 6 <= rects[i].w)) return t;
  }
  return 1 / dpr;
}

export function computeLayout(width: number, height: number, dpr = 1): Layout {
  const landscape = width >= height * 1.15 && Math.min(width, height) < 700;
  const statusH = 20;
  const detailH = 16;

  if (!landscape) {
    const cols = width < 520 ? 4 : 6;
    const rows = 12 / cols;
    const stripH = 38;
    let bh = width < 520 ? 44 : 40;
    const panelH = (b: number) => PAD + statusH + GAP + detailH + GAP + stripH + GAP + rows * b + (rows - 1) * GAP + PAD;
    while (panelH(bh) > height * 0.45 && bh > 32) bh -= 2;
    const ph = panelH(bh);
    const map = R(0, 0, width, height - ph);
    const panel = R(0, height - ph, width, ph);
    let y = panel.y + PAD;
    const sound = R(width - PAD - 28, y, 28, statusH);
    const cancel = R(sound.x - GAP - 80, y, 80, statusH);
    const status = R(PAD, y, cancel.x - GAP - PAD, statusH);
    y += statusH + GAP;
    const detail = R(PAD, y, width - 2 * PAD, detailH);
    y += detailH + GAP;
    const squad = grid(PAD, y, width - 2 * PAD, 4, 4, stripH);
    y += stripH + GAP;
    const rects = grid(PAD, y, width - 2 * PAD, cols, 12, bh);
    const actions = ACTIONS.map((a, i) => ({ ...a, rect: rects[i] }));
    return {
      width, height, dpr, orientation: 'portrait', map, panel, overlay: false, status, detail, cancel, sound, squad, actions,
      text: chooseText(rects, dpr),
    };
  }

  // a short window (a phone with browser bars) gets a wider column with three columns of buttons, so END TURN stays on screen
  const short = height < 330;
  const colW = short ? clamp(Math.round(width * 0.32), 150, 260) : clamp(Math.round(width * 0.24), 150, 220);
  const sqH = short ? 28 : 34;
  const cols = short ? 3 : 2;
  const rowsN = 12 / cols;
  const map = R(0, 0, width - colW, height);
  const panel = R(width - colW, 0, colW, height);
  const sound = R(map.w - PAD - 28, PAD, 28, statusH);
  const cancel = R(sound.x - GAP - 80, PAD, 80, statusH);
  const status = R(PAD, PAD, cancel.x - GAP - PAD, statusH);
  const detail = R(PAD, map.h - detailH - PAD, map.w - 2 * PAD, detailH);
  const squad = grid(panel.x + PAD, PAD, colW - 2 * PAD, 2, 4, sqH);
  const y0 = PAD + 2 * sqH + GAP + GAP;
  const bh = clamp(Math.floor((height - PAD - y0 - (rowsN - 1) * GAP) / rowsN), short ? 30 : 32, 44);
  const rects = grid(panel.x + PAD, y0, colW - 2 * PAD, cols, 12, bh);
  const actions = ACTIONS.map((a, i) => ({ ...a, rect: rects[i] }));
  return {
    width, height, dpr, orientation: 'landscape', map, panel, overlay: true, status, detail, cancel, sound, squad, actions,
    text: chooseText(rects, dpr),
  };
}
