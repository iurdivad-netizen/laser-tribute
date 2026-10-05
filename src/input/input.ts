import type { App } from '../app';
import { GestureRecognizer, type PointerKind } from './gestures';

/** Wires pointer events (mouse, touch, pen) and the keyboard to the app. Positions are CSS pixels inside the canvas. */
export function attachInput(canvas: HTMLCanvasElement, app: App): void {
  const toCss = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const kindOf = (e: PointerEvent): PointerKind => (e.pointerType === 'touch' ? 'touch' : e.pointerType === 'pen' ? 'pen' : 'mouse');

  const g = new GestureRecognizer({
    tap: (p, kind) => app.click(p, kind === 'touch' ? 'touch' : 'mouse'),
    drag: (dx, dy) => app.pan(dx, dy),
    longPress: (p) => app.longPress(p),
  });
  let timer: number | undefined;
  const stopTimer = () => {
    if (timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      canvas.setPointerCapture(e.pointerId); // keep the gesture when a finger slides off the canvas
    } catch {
      // not every pointer can be captured; the gesture still works inside the canvas
    }
    const p = toCss(e);
    g.down(p.x, p.y, kindOf(e), performance.now());
    stopTimer();
    timer = window.setInterval(() => g.tick(performance.now()), 100);
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = toCss(e);
    if (e.buttons || e.pressure > 0) g.move(p.x, p.y, performance.now());
    else if (e.pointerType === 'mouse') app.move(p);
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = toCss(e);
    g.up(p.x, p.y, performance.now());
    stopTimer();
  });
  canvas.addEventListener('pointercancel', () => {
    g.cancel();
    stopTimer();
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') app.leave();
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    app.cancel();
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.key(e.key, e.repeat)) e.preventDefault();
  });
}
