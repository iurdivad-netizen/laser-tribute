import type { Atlas } from '../art/atlas';
import { directionTo, frameFor } from '../art/sprite';
import type { SpriteName } from '../art/sprites';
import { CONFIG } from '../core/config';
import { defaultFont, drawText } from '../ui/text';
import type { GameEvent, Pos } from '../core/types';

const T = CONFIG.tileSize;

type Effect =
  | { kind: 'move'; unitId: string; from: Pos; to: Pos; start: number; dur: number; eased: boolean }
  | { kind: 'text'; text: string; px: Pos; colour: string; scale: number; start: number; dur: number }
  | { kind: 'shot'; from: Pos; to: Pos; hit: boolean; start: number; dur: number }
  | { kind: 'flash'; at: Pos; color: string; start: number; dur: number }
  | { kind: 'sprite'; frames: SpriteName[]; px: Pos; scale: number; fade: boolean; start: number; dur: number };

/** What to draw for the effects alive at one moment (pure, so it can be tested). */
export type EffectDraw =
  | { type: 'sprite'; name: SpriteName; x: number; y: number; scale: number; alpha: number }
  | { type: 'line'; from: Pos; to: Pos; hit: boolean }
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string; alpha: number }
  | { type: 'text'; text: string; x: number; y: number; colour: string; scale: number; alpha: number };

/** Who made or took an event, so the effects can colour numbers and leave out what the player cannot see. */
export interface AddContext {
  /** Per event: false when the player cannot see where it happened (no shake, freeze or number). Default: all seen. */
  seen?: boolean[];
  sideOf?: (unitId: string) => 'player' | 'enemy' | undefined;
}

/** Feedback tiers: the trauma added to the shake and the freeze after an impact, in ms. */
export const FEEL = {
  crit: { trauma: 0.5, freeze: 90 },
  kill: { trauma: 0.4, freeze: 70 },
  stab: { trauma: 0.25, freeze: 40 },
  frag: { trauma: 0.9, freeze: 90 },
  flash: { trauma: 0.3, freeze: 0 },
} as const;
const TRAUMA_DECAY_PER_S = 1.8;
const MAX_SHAKE_PX = 8;
const MAX_FREEZE_MS = 120;
const STEP_MS = 120;
const FLOAT_MS = 700;
const FLOAT_RISE = 14;
export const easeOutQuad = (p: number): number => 1 - (1 - p) * (1 - p);
export const easeOutCubic = (p: number): number => 1 - (1 - p) ** 3;

/** How far above its tile's centre a soldier's chest is: shots and blows start and end there, not at the feet. */
export const AIM_RAISE = 8;
export const aimPoint = (p: Pos): Pos => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 - AIM_RAISE });
const tilePx = (p: Pos) => ({ x: p.x * T, y: p.y * T });

export class Effects {
  private list: Effect[] = [];
  /** Set from the reduced-motion preference: no shake and no freeze. */
  reducedMotion = false;
  private trauma = 0;
  private traumaAt = 0;
  // Hit-stop: while real time is inside [freezeStart, freezeEnd) the effects clock stands still. `lost` is the
  // time already frozen, so effects keep their place on the clock when it runs again.
  private freezeStart = 0;
  private freezeEnd = 0;
  private lost = 0;

  /** The effects clock: real time minus the time spent frozen. Every start time and every query goes through it. */
  private clock(now: number): number {
    if (this.freezeEnd > 0 && now >= this.freezeEnd) {
      this.lost += this.freezeEnd - this.freezeStart;
      this.freezeEnd = 0;
    }
    return this.freezeEnd > 0 ? this.freezeStart - this.lost : now - this.lost;
  }

  /** Stops the effects clock for `ms`. A freeze inside a freeze does not stack: the longer end wins. */
  hitStop(now: number, ms: number): void {
    if (this.reducedMotion || ms <= 0) return;
    const end = now + Math.min(ms, MAX_FREEZE_MS);
    if (this.clock(now) !== now - this.lost) {
      this.freezeEnd = Math.max(this.freezeEnd, end);
    } else {
      this.freezeStart = now;
      this.freezeEnd = end;
    }
  }

  /** Adds shake (0 to 1); it decays by itself. */
  addTrauma(now: number, amount: number): void {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1, this.traumaNow(now) + amount);
    this.traumaAt = now;
  }

  private traumaNow(now: number): number {
    return Math.max(0, this.trauma - ((now - this.traumaAt) / 1000) * TRAUMA_DECAY_PER_S);
  }

  /** Whole-pixel offset for the camera view (screen px): trauma squared sets the size, slow sine waves the direction. */
  shakeOffset(now: number): { x: number; y: number } {
    const t = this.traumaNow(now);
    if (t <= 0) return { x: 0, y: 0 };
    const k = t * t * MAX_SHAKE_PX;
    return { x: Math.round(k * Math.sin(now * 0.07)), y: Math.round(k * Math.sin(now * 0.053 + 1.7)) };
  }

  /** True while anything on screen still moves, so the loop knows it must keep drawing. */
  active(now: number): boolean {
    const clock = this.clock(now);
    return this.freezeEnd > 0 || this.list.some((e) => clock < e.start + e.dur) || this.traumaNow(now) > 0;
  }

  private sprite(frames: SpriteName[], px: Pos, start: number, dur: number, opts: { scale?: number; fade?: boolean } = {}): void {
    this.list.push({ kind: 'sprite', frames, px, scale: opts.scale ?? 1, fade: opts.fade ?? false, start, dur });
  }

  private float(text: string, at: Pos, colour: string, now: number, scale = 1): void {
    this.list.push({ kind: 'text', text, px: { x: at.x * T + T / 2, y: at.y * T - AIM_RAISE - 6 }, colour, scale, start: now, dur: FLOAT_MS });
  }

  /** Impact feedback for something the player can see. */
  private impact(tier: { trauma: number; freeze: number }, rawNow: number): void {
    this.addTrauma(rawNow, tier.trauma);
    this.hitStop(rawNow, tier.freeze);
  }

  add(events: GameEvent[], rawNow: number, ctx: AddContext = {}): void {
    // A step that follows another step of the same unit closely is part of a walk: it stays linear, so a walk is
    // one steady glide. A lone step (an enemy's, a reaction) eases out.
    const walking = (unitId: string, start: number) =>
      this.list.some((e) => e.kind === 'move' && e.unitId === unitId && start - (e.start + e.dur) < 60);
    events.forEach((e, i) => {
      const seen = ctx.seen?.[i] ?? true;
      const now = this.clock(rawNow);
      const hurt = (unitId: string) => (ctx.sideOf?.(unitId) === 'player' ? '#ff6b6b' : '#ffe14d');
      if (e.type === 'moved') {
        this.list.push({ kind: 'move', unitId: e.unitId, from: e.from, to: e.to, start: now, dur: STEP_MS, eased: !walking(e.unitId, now) });
      } else if (e.type === 'shot') {
        if (seen) {
          if (e.hit && e.crit) this.impact(FEEL.crit, rawNow);
          this.float(e.hit ? String(e.damage) : 'MISS', e.impact, e.hit ? hurt(e.targetId) : '#9aa0b5', now, e.crit ? 2 : 1);
        }
        this.list.push({ kind: 'shot', from: e.from, to: e.impact, hit: e.hit, start: now, dur: 180 });
        const dir = directionTo(e.from, e.impact);
        const muzzle = tilePx(e.from);
        this.sprite(['flash_0', 'flash_1'], { x: muzzle.x + dir.x * 8, y: muzzle.y + dir.y * 8 - AIM_RAISE }, now, 90);
        if (e.hit) {
          const at = tilePx(e.impact);
          this.sprite(['spark'], { x: at.x, y: at.y - AIM_RAISE }, now + 80, 220, { fade: true });
        }
        if (e.hit && e.crit) {
          const t = tilePx(e.impact);
          this.sprite(['spark'], { x: t.x - 8, y: t.y - 8 - AIM_RAISE }, now + 80, 300, { scale: 2, fade: true });
          this.list.push({ kind: 'flash', at: e.impact, color: '255,225,77', start: now, dur: 300 });
        }
      } else if (e.type === 'stab') {
        if (seen) {
          if (e.hit) this.impact(FEEL.stab, rawNow);
          this.float(e.hit ? String(e.damage) : 'MISS', e.at, e.hit ? hurt(e.targetId) : '#9aa0b5', now);
        }
        const at = tilePx(e.at);
        this.sprite(['slash_0', 'slash_1'], { x: at.x, y: at.y - AIM_RAISE }, now, 220);
        if (e.hit) this.sprite(['spark'], { x: at.x, y: at.y - AIM_RAISE }, now + 60, 220, { fade: true });
      } else if (e.type === 'died') {
        if (seen) this.impact(FEEL.kill, rawNow);
        this.sprite(['splash'], tilePx(e.at), now, 450, { fade: true });
      } else if (e.type === 'grenade') {
        const centre = { x: (e.at.x - 1) * T, y: (e.at.y - 1) * T };
        if (seen && e.kind !== 'smoke') this.impact(e.kind === 'flash' ? FEEL.flash : FEEL.frag, rawNow);
        if (e.kind === 'flash') {
          this.sprite(['bang'], centre, now, 350, { scale: 3, fade: true });
          this.list.push({ kind: 'flash', at: e.at, color: '255,255,255', start: now, dur: 250 });
        } else if (e.kind === 'smoke') {
          this.sprite(['smoke'], centre, now, 500, { scale: 3, fade: true });
        } else {
          this.sprite(['boom_0', 'boom_1', 'boom_2', 'boom_3'], centre, now, 450, { scale: 3 });
        }
      } else if (e.type === 'burned') {
        if (seen) this.float(String(e.damage), e.at, hurt(e.unitId), now);
        this.sprite(['spark'], { x: e.at.x * T, y: e.at.y * T - AIM_RAISE }, now, 220, { fade: true });
      } else if (e.type === 'healed') {
        this.list.push({ kind: 'flash', at: e.at, color: '100,255,140', start: now, dur: 300 });
      } else if (e.type === 'reloaded') {
        this.list.push({ kind: 'flash', at: e.at, color: '120,200,255', start: now, dur: 250 });
      }
    });
  }

  /** Pixel offset to add to a unit's logical position while it slides between tiles. */
  unitOffset(unitId: string, rawNow: number): { x: number; y: number } {
    const now = this.clock(rawNow);
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      const left = 1 - (e.eased ? easeOutQuad(p) : p);
      return { x: (e.from.x - e.to.x) * T * left, y: (e.from.y - e.to.y) * T * left };
    }
    return { x: 0, y: 0 };
  }

  /** A walking unit bobs up one pixel for the first half of each step. */
  unitBob(unitId: string, rawNow: number): -1 | 0 {
    const now = this.clock(rawNow);
    for (const e of this.list) {
      if (e.kind !== 'move' || e.unitId !== unitId) continue;
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      return p < 0.5 ? -1 : 0;
    }
    return 0;
  }

  frames(rawNow: number): EffectDraw[] {
    const now = this.clock(rawNow);
    const out: EffectDraw[] = [];
    for (const e of this.list) {
      const p = (now - e.start) / e.dur;
      if (p < 0 || p >= 1) continue;
      if (e.kind === 'shot') {
        out.push({ type: 'line', from: aimPoint(e.from), to: aimPoint(e.to), hit: e.hit });
      } else if (e.kind === 'text') {
        // rises fast and settles, and fades over the last third
        out.push({
          type: 'text', text: e.text, x: e.px.x, y: e.px.y - FLOAT_RISE * easeOutCubic(p), colour: e.colour, scale: e.scale,
          alpha: p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35,
        });
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
    const clock = this.clock(now);
    this.list = this.list.filter((e) => clock < e.start + e.dur);
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
      } else if (d.type === 'text') {
        ctx.globalAlpha = d.alpha;
        drawText(ctx, d.text, Math.round(d.x), Math.round(d.y), '#000', 'center', defaultFont, d.scale); // outline, then the colour
        drawText(ctx, d.text, Math.round(d.x) - 1, Math.round(d.y) - 1, d.colour, 'center', defaultFont, d.scale);
        ctx.globalAlpha = 1;
      } else if (art) {
        ctx.globalAlpha = d.alpha;
        art.draw(ctx, d.name, d.x, d.y, { scale: d.scale });
        ctx.globalAlpha = 1;
      }
    }
  }
}
