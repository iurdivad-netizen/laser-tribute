import { VIEW } from '../render/layout';
import { textWidth } from '../ui/font';
import { UI, drawButton, drawFrame, type Rect } from '../ui/frame';
import { drawText } from '../ui/text';
import { faceImage } from './faces';

/** What the scene screen shows: who speaks, the line (empty while the choice is up), and the two choice labels if any. */
export interface SceneView {
  speaker: string;
  text: string;
  choices: [string, string] | null;
  skippable: boolean;
}

const TEXT_X = 108;
const TEXT_W = 340;
const ROW = 10;

export const SCENE = {
  box: { x: 20, y: 250, w: 440, h: 130 },
  /** The slot the portrait art (project 3c) will fill; until then the speaker's initial. */
  portrait: { x: 32, y: 262, w: 64, h: 64 },
  skip: { x: 384, y: 356, w: 64, h: 18 },
  choices: [{ x: 108, y: 326, w: 216, h: 20 }, { x: 108, y: 350, w: 216, h: 20 }],
} as const satisfies { box: Rect; portrait: Rect; skip: Rect; choices: readonly [Rect, Rect] };

export type SceneHitResult = 'next' | 'skip' | { kind: 'choice'; index: 0 | 1 };

const inside = (r: Rect, x: number, y: number, slop: number): boolean =>
  x >= r.x - slop && x < r.x + r.w + slop && y >= r.y - slop && y < r.y + r.h + slop;

/** Greedy wrap on spaces so each row is at most `maxPx` wide; a word wider than that keeps a row to itself. */
export function wrapText(text: string, maxPx: number): string[] {
  const rows: string[] = [];
  let row = '';
  for (const word of text.split(' ').filter((x) => x.length > 0)) {
    const tryRow = row === '' ? word : `${row} ${word}`;
    if (row === '' || textWidth(tryRow) <= maxPx) row = tryRow;
    else {
      rows.push(row);
      row = word;
    }
  }
  if (row !== '') rows.push(row);
  return rows;
}

export function sceneHit(px: number, py: number, view: Pick<SceneView, 'choices'>, slop = 0): SceneHitResult | null {
  if (inside(SCENE.skip, px, py, slop)) return 'skip';
  if (view.choices) {
    for (const i of [0, 1] as const) if (inside(SCENE.choices[i], px, py, slop)) return { kind: 'choice', index: i };
    return null;
  }
  return 'next';
}

export function drawScene(ctx: CanvasRenderingContext2D, v: SceneView): void {
  ctx.fillStyle = UI.black;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const b = SCENE.box;
  drawFrame(ctx, b.x, b.y, b.w, b.h, 'raised');
  const p = SCENE.portrait;
  drawFrame(ctx, p.x, p.y, p.w, p.h, 'inset');
  const face = faceImage(v.speaker, false);
  if (face) {
    ctx.drawImage(face, p.x, p.y, p.w, p.h);
    ctx.strokeStyle = UI.dark;
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
  } else {
    drawText(ctx, v.speaker.charAt(0), p.x + p.w / 2, p.y + Math.floor((p.h - 21) / 2), UI.accent, 'center', undefined, 3);
  }
  drawText(ctx, v.speaker, TEXT_X, b.y + 14, UI.accent);
  if (v.choices) {
    drawButton(ctx, SCENE.choices[0], v.choices[0]);
    drawButton(ctx, SCENE.choices[1], v.choices[1]);
  } else {
    wrapText(v.text, TEXT_W).forEach((row, i) => drawText(ctx, row, TEXT_X, b.y + 32 + i * ROW, UI.text));
    drawText(ctx, 'CLICK OR SPACE', b.x + 12, b.y + b.h - 16, UI.hint);
  }
  if (v.skippable) drawButton(ctx, SCENE.skip, 'SKIP');
}
