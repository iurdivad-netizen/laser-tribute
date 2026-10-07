import { defaultCanvas, type CanvasLike } from '../art/atlas';
import { ADVANCE, GLYPH_H, GLYPH_W, glyphFor, textWidth } from './font';

export type Align = 'left' | 'right' | 'center';

export interface TextRun {
  text: string;
  x: number;
  y: number;
  colour: string;
  align: Align;
  width: number;
  /** The scale it was drawn at (1 when not given). */
  scale?: number;
}

const listeners = new Set<(run: TextRun) => void>();

/** Listen to every `drawText` call (used by tests to check layouts). Returns a function that stops listening. */
export function onText(listener: (run: TextRun) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The pixel width of `text` drawn at an integer or fractional `scale`. */
export const scaledWidth = (text: string, scale = 1): number => textWidth(text) * scale;

/** Bakes each glyph once per colour into a small canvas, then stamps it. Draws nothing without a canvas. */
export class FontAtlas {
  private cache = new Map<string, CanvasLike | null>();

  constructor(private readonly createCanvas: (w: number, h: number) => CanvasLike | null = defaultCanvas) {}

  private glyph(ch: string, colour: string): CanvasLike | null {
    const rows = glyphFor(ch);
    const key = `${rows.join('/')}|${colour}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const canvas = this.createCanvas(GLYPH_W, GLYPH_H);
    const ctx = canvas?.getContext('2d') ?? null;
    if (canvas && ctx) {
      ctx.fillStyle = colour;
      rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') ctx.fillRect(x, y, 1, 1); }));
    }
    const baked = canvas && ctx ? canvas : null;
    this.cache.set(key, baked);
    return baked;
  }

  draw(
    ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string, align: Align = 'left', scale = 1,
  ): boolean {
    const width = textWidth(text) * scale;
    const start = align === 'left' ? x : align === 'right' ? x - width : x - Math.floor(width / 2);
    let drew = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') continue;
      const g = this.glyph(text[i], colour);
      if (!g) continue;
      const gx = Math.round(start + i * ADVANCE * scale);
      const gy = Math.round(y);
      if (scale === 1) ctx.drawImage(g as unknown as CanvasImageSource, gx, gy);
      else ctx.drawImage(g as unknown as CanvasImageSource, gx, gy, GLYPH_W * scale, GLYPH_H * scale);
      drew = true;
    }
    return drew;
  }
}

export const defaultFont = new FontAtlas();

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour: string,
  align: Align = 'left',
  atlas: FontAtlas = defaultFont,
  scale = 1,
): void {
  for (const listener of listeners) listener({ text, x, y, colour, align, width: textWidth(text) * scale, scale });
  atlas.draw(ctx, text, x, y, colour, align, scale);
}

/** The text, or the longest start of it followed by "..." that is at most `maxPx` pixels wide. */
export function clipText(text: string, maxPx: number): string {
  if (textWidth(text) <= maxPx) return text;
  for (let n = text.length - 1; n >= 0; n--) {
    const out = `${text.slice(0, n).trimEnd()}...`;
    if (textWidth(out) <= maxPx) return out;
  }
  // not even "..." fits: as many dots as fit
  return '.'.repeat(Math.max(0, Math.floor((maxPx + 1) / ADVANCE)));
}
