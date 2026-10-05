export type PointerKind = 'mouse' | 'touch' | 'pen';

export interface GesturePoint {
  x: number;
  y: number;
}

export interface GestureHandlers {
  tap(p: GesturePoint, kind: PointerKind): void;
  drag(dx: number, dy: number, p: GesturePoint, kind: PointerKind): void;
  longPress(p: GesturePoint, kind: PointerKind): void;
}

interface Press {
  id: number;
  kind: PointerKind;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startAt: number;
  dragging: boolean;
  fired: boolean;
}

/**
 * Turns pointer events into taps, drags and long presses. A press that stays inside the slop and ends before the
 * long-press time is a tap; leaving the slop makes it a drag (no tap on release); staying still for the long-press
 * time fires one long press (and no tap), for touch and pen only (a slow mouse click is still a click). A second
 * pointer spoils the gesture: nothing fires until the first pointer lifts. Pure: the caller supplies the clock.
 */
export class GestureRecognizer {
  private press: Press | null = null;
  private spoiled = false;
  private readonly longMs: number;
  private readonly touchSlop: number;
  private readonly mouseSlop: number;

  constructor(
    private readonly handlers: GestureHandlers,
    opts: { longMs?: number; touchSlop?: number; mouseSlop?: number } = {},
  ) {
    this.longMs = opts.longMs ?? 500;
    this.touchSlop = opts.touchSlop ?? 10;
    this.mouseSlop = opts.mouseSlop ?? 4;
  }

  down(x: number, y: number, kind: PointerKind, now: number, id = 0): void {
    if (this.press && this.press.id !== id) {
      this.spoiled = true; // a second finger: pinches and two-finger touches are not taps
      return;
    }
    this.spoiled = false;
    this.press = { id, kind, startX: x, startY: y, lastX: x, lastY: y, startAt: now, dragging: false, fired: false };
  }

  move(x: number, y: number, _now: number, id = 0): void {
    const p = this.press;
    if (!p || p.id !== id || p.fired || this.spoiled) return;
    if (!p.dragging) {
      const slop = p.kind === 'mouse' ? this.mouseSlop : this.touchSlop;
      if (Math.hypot(x - p.startX, y - p.startY) <= slop) return;
      p.dragging = true;
    }
    this.handlers.drag(x - p.lastX, y - p.lastY, { x, y }, p.kind);
    p.lastX = x;
    p.lastY = y;
  }

  up(x: number, y: number, now: number, id = 0): void {
    const p = this.press;
    if (!p || p.id !== id) return;
    this.press = null;
    if (this.spoiled) {
      this.spoiled = false;
      return;
    }
    if (p.dragging) return;
    if (!p.fired && p.kind !== 'mouse' && now - p.startAt >= this.longMs) {
      this.handlers.longPress({ x: p.startX, y: p.startY }, p.kind);
      return;
    }
    if (!p.fired) this.handlers.tap({ x, y }, p.kind);
  }

  cancel(): void {
    this.press = null;
    this.spoiled = false;
  }

  /** Call regularly while a pointer is down; fires the long press once. */
  tick(now: number): void {
    const p = this.press;
    if (!p || p.dragging || p.fired || p.kind === 'mouse' || this.spoiled) return;
    if (now - p.startAt >= this.longMs) {
      p.fired = true;
      this.handlers.longPress({ x: p.startX, y: p.startY }, p.kind);
    }
  }
}
