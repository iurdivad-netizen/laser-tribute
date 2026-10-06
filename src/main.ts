import { App } from './app';
import { drawGallery } from './art/gallery';
import { attachInput } from './input/input';
import { defaultAtlas } from './render/renderer';

const canvas = document.createElement('canvas');
document.getElementById('app')!.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

const app = new App();

/** The canvas fills the window: its backing store is the CSS size times the device pixel ratio (at most 3). */
function fit(): void {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  app.resize(w, h, dpr);
}
fit();
new ResizeObserver(fit).observe(canvas);
window.addEventListener('orientationchange', () => setTimeout(fit, 100));

attachInput(canvas, app);
if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;
if (import.meta.env.DEV) {
  (window as unknown as { gallery: () => void }).gallery = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawGallery(ctx, defaultAtlas);
  };
}

function frame(now: number): void {
  app.update(now);
  app.draw(ctx, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
