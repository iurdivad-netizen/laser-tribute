import type { App } from '../app';

export function attachInput(canvas: HTMLCanvasElement, app: App): void {
  const toLogical = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  };

  canvas.addEventListener('mousemove', (e) => app.move(toLogical(e)));
  canvas.addEventListener('mouseleave', () => app.leave());
  canvas.addEventListener('click', (e) => app.click(toLogical(e)));
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    app.cancel();
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.key(e.key, e.repeat)) e.preventDefault();
  });
}
