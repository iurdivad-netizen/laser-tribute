import type { Controller } from '../controller';
import { screenToTile } from '../render/layout';
import { buttonAt } from '../render/panel';

export function attachInput(canvas: HTMLCanvasElement, c: Controller): void {
  const toLogical = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  };

  canvas.addEventListener('mousemove', (e) => {
    const p = toLogical(e);
    c.hover(screenToTile(p.x, p.y, c.state.width, c.state.height));
  });
  canvas.addEventListener('mouseleave', () => c.hover(null));
  canvas.addEventListener('click', (e) => {
    const p = toLogical(e);
    const button = buttonAt(p.x, p.y);
    if (button) {
      c.pressButton(button);
      return;
    }
    const t = screenToTile(p.x, p.y, c.state.width, c.state.height);
    if (t) c.clickTile(t);
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    c.cancel();
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (c.key(e.key)) e.preventDefault();
  });
}
