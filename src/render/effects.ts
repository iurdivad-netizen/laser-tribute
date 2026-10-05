import type { Atlas } from '../art/atlas';
import { directionTo, frameFor } from '../art/sprite';
import type { SpriteName } from '../art/sprites';
import { CONFIG } from '../core/config';
import type { GameEvent, Pos } from '../core/types';

const T = CONFIG.tileSize;

type Effect =
  | { kind: 'move'; unitId: string; from: Pos; to: Pos; start: number; dur: number }
  | { kind: 'shot'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }
  | { kind: 'flash'; at: Pos; color: string; start: number; dur: number }
  | { kind: 'sprite'; frames: SpriteName[]; px: Pos; scale: number; fade: boolean; start: number; dur: number };

/** What to draw for the effects alive at one moment (pure, so it can be tested). */
export type EffectDraw =
  | { type: 'sprite'; name: SpriteName; x: number; y: number; scale: number; alpha: number }
  | { type: 'line'; from: Pos; to: Pos; hit: boolean }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string; alpha: number };

const center = (p: Pos) => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 });
const tilePx = (p: Pos) => ({ x: p.x * T, y: p.y * T });

export class Effects {
  private list: Effect[] = [];

  private sprite(frames: SpriteName[], px: Pos, start: number, dur: number, opts: { scale?: number; fade?: boolean } = {}): void {
    this.list.push({ kind: 'sprite', frames, px, scale: opts.scale ?? 1, fade: opts.fade ?? false, start, dur });
  }

  add(events: GameEvent[], now: number): void {
    for (const e of events) {
      if (e.type === 'moved') {
        this.list.push({ kind: 'move', unitId: e.unitId, from: e.from, to: e.to, start: now, dur: 120 });
      } else if (e.type === 'shot') {
        this.list.push({ kind: 'shot', from: e.from, to: e.impact, hit: e.hit, start: now, dur: 180 });
        const dir = directionTo(e.from, e.impact);
        const muzzle = tilePx(e.from);
        this.sprite(['flash_0', 'flash_1'], { x: muzzle.x + dir.x * 8, y: muzzle.y + dir.y * 8 }, now, 90);
        if (e.hit) this.sprite(['spark'], tilePx(e.impact), now + 80, 220, { fade: true });
        if (e.hit && e.crit) {
          const t = tilePx(e.impact);
          this.sprite(['spark'], { x: t.x - 8, y: t.y - 8 }, now + 80, 300, { scale: 2, fade: true });
          this.list.push({ kind: 'flash', at: e.impact, color: '255,225,77', start: now, dur: 300 });
        }
      } else if (e.type === 'stab') {
        this.sprite(['slash_0', 'slash_1'], tilePx(e.at), now, 220);
        if (e.hit) this.sprite(['spark'], tilePx(e.at), now + 60, 220, { fade: true });
      } else if (e.type === 'died') {
        this.sprite(['splash'], tilePx(e.at), now, 450, { fade: true });
      } else if (e.type === 'grenade') {
        this.sprite(['boom_0', 'boom_1', 'boom_2', 'boom_3'], { x: (e.at.x - 1) * T, y: (e.at.y - 1) * T }, now, 450, { scale: 3 });
      } else if (e.type === 'healed') {
        this.list.push({ kind: 'flash', at: e.at, color: '100,255,140', start: now, dur: 300 });
      } else if (e.type === 'reloaded') {
        this.list.push({ kind: 'flash', at: e.at, color: '120,200,255', start: now, dur: 250 });
      }
    }
  }

  /** Pixel offset to add to a unit's logical position while it slides between tiles. */
  unitOffset(unitId: string, now: number): { x: number; y: number } {
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return { x: (e.from.x - e.to.x) * T * (1 - p), y: (e.from.y - e.to.y) * T * (1 - p) };
    }
    return { x: 0, y: 0 };
  }

  /** A walking unit bobs up one pixel for the first half of each step. */
  unitBob(unitId: string, now: number): -1 | 0 {
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return p < 0.5 ? -1 : 0;
    }
    return 0;
  }

  frames(now: number): EffectDraw[] {
    const out: EffectDraw[] = [];
    for (const e of this.list) {
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      if (e.kind === 'shot') {
        out.push({ type: 'line', from: center(e.from), to: center(e.to), hit: e.hit });
      } else if (e.kind === 'flash') {
        out.push({ type: 'rect', x: e.at.x * T, y: e.at.y * T, w: T, h: T, color: e.color, alpha: 1 - p });
      } else if (e.kind === 'sprite') {
        out.push({
          type: 'sprite',
          name: e.frames[frameFor(p, e.frames.length)],
          x: e.px.x,
          y: e.px.y,
          scale: e.scale,
          alpha: e.fade ? 1 - p : 1,
        });
      }
    }
    return out;
  }

  draw(ctx: CanvasRenderingContext2D, now: number, art?: Atlas): void {
    this.list = this.list.filter((e) => now < e.start + e.dur);
    for (const d of this.frames(now)) {
      if (d.type === 'line') {
        ctx.strokeStyle = d.hit ? '#ffe14d' : '#9aa0b5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.from.x, d.from.y);
        ctx.lineTo(d.to.x, d.to.y);
        ctx.stroke();
      } else if (d.type === 'rect') {
        ctx.fillStyle = `rgba(${d.color},${d.alpha})`;
        ctx.fillRect(d.x, d.y, d.w, d.h);
      } else if (art) {
        ctx.globalAlpha = d.alpha;
        art.draw(ctx, d.name, d.x, d.y, { scale: d.scale });
        ctx.globalAlpha = 1;
      }
    }
  }
}
