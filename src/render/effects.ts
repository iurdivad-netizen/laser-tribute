import { CONFIG } from '../core/config';
import type { GameEvent, Pos } from '../core/types';

const T = CONFIG.tileSize;

type Effect =
  | { kind: 'move'; unitId: string; from: Pos; to: Pos; start: number; dur: number }
  | { kind: 'shot'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }
  | { kind: 'slash'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }
  | { kind: 'flash'; at: Pos; color: string; start: number; dur: number }
  | { kind: 'boom'; at: Pos; start: number; dur: number };

const center = (p: Pos) => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 });

export class Effects {
  private list: Effect[] = [];

  add(events: GameEvent[], now: number): void {
    for (const e of events) {
      if (e.type === 'moved') {
        this.list.push({ kind: 'move', unitId: e.unitId, from: e.from, to: e.to, start: now, dur: 120 });
      } else if (e.type === 'shot') {
        this.list.push({ kind: 'shot', from: e.from, to: e.impact, hit: e.hit, start: now, dur: 180 });
        if (e.hit) this.list.push({ kind: 'flash', at: e.impact, color: '255,80,80', start: now + 80, dur: 250 });
      } else if (e.type === 'stab') {
        this.list.push({ kind: 'slash', from: e.from, to: e.at, hit: e.hit, start: now, dur: 220 });
        if (e.hit) this.list.push({ kind: 'flash', at: e.at, color: '255,80,80', start: now + 60, dur: 300 });
      } else if (e.type === 'died') {
        this.list.push({ kind: 'flash', at: e.at, color: '255,255,255', start: now, dur: 400 });
      } else if (e.type === 'grenade') {
        this.list.push({ kind: 'boom', at: e.at, start: now, dur: 350 });
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

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    this.list = this.list.filter((e) => now < e.start + e.dur);
    for (const e of this.list) {
      const p = (now - e.start) / e.dur;
      if (p < 0) continue;
      if (e.kind === 'shot') {
        const a = center(e.from);
        const b = center(e.to);
        ctx.strokeStyle = e.hit ? '#ffe14d' : '#9aa0b5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (e.kind === 'slash') {
        const a = center(e.from);
        const b = center(e.to);
        ctx.strokeStyle = e.hit ? '#ff5555' : '#9aa0b5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (e.kind === 'flash') {
        ctx.fillStyle = `rgba(${e.color},${1 - p})`;
        ctx.fillRect(e.at.x * T, e.at.y * T, T, T);
      } else if (e.kind === 'boom') {
        const c = center(e.at);
        ctx.fillStyle = `rgba(255,150,40,${1 - p})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, T * 1.5 * (0.3 + p), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
