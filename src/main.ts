import { App } from './app';
import { attachInput } from './input/input';
import { VIEW } from './render/layout';

const canvas = document.createElement('canvas');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
document.getElementById('app')!.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

const app = new App();
attachInput(canvas, app);
if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;

function frame(now: number): void {
  app.update(now);
  app.draw(ctx, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
