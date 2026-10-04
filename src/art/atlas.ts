import { PALETTE } from './palette';
import { flipHorizontal, parseSprite } from './sprite';
import { SPRITE_ROWS, type SpriteName } from './sprites';

export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void } | null;
}

function defaultCanvas(width: number, height: number): CanvasLike | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height) as unknown as CanvasLike;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas as unknown as CanvasLike;
    }
  } catch {
    // fall through: no canvas available
  }
  return null;
}

/** Bakes each sprite once into a small canvas, then stamps it with drawImage. Draws nothing without a canvas. */
export class Atlas {
  private cache = new Map<string, CanvasLike | null>();

  constructor(private readonly createCanvas: (w: number, h: number) => CanvasLike | null = defaultCanvas) {}

  private get(name: SpriteName, flip: boolean): CanvasLike | null {
    const key = flip ? `${name}:flip` : name;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    let sprite = parseSprite(name, SPRITE_ROWS[name]);
    if (flip) sprite = flipHorizontal(sprite);
    const canvas = this.createCanvas(sprite.width, sprite.height);
    const ctx = canvas?.getContext('2d') ?? null;
    if (canvas && ctx) {
      sprite.pixels.forEach((letter, i) => {
        if (letter === null) return;
        ctx.fillStyle = PALETTE[letter];
        ctx.fillRect(i % sprite.width, Math.floor(i / sprite.width), 1, 1);
      });
    }
    const baked = canvas && ctx ? canvas : null;
    this.cache.set(key, baked);
    return baked;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    name: SpriteName,
    x: number,
    y: number,
    opts: { flip?: boolean; scale?: number } = {},
  ): boolean {
    const canvas = this.get(name, opts.flip ?? false);
    if (!canvas) return false;
    const scale = opts.scale ?? 1;
    ctx.drawImage(canvas as unknown as CanvasImageSource, Math.round(x), Math.round(y), canvas.width * scale, canvas.height * scale);
    return true;
  }
}
