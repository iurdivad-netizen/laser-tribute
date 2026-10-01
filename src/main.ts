import { Controller } from './controller';
import { createMission1 } from './core/mission1';
import { attachInput } from './input/input';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import { VIEW } from './render/layout';
import { drawGame } from './render/renderer';

const canvas = document.createElement('canvas');
canvas.width = VIEW.width;
canvas.height = VIEW.height;
document.getElementById('app')!.appendChild(canvas);
const ctx = canvas.getContext('2d')!;

const controller = new Controller(createMission1(), createUiState('p1'), new Effects());
attachInput(canvas, controller);
if (import.meta.env.DEV) (window as unknown as { game: Controller }).game = controller;

function frame(now: number): void {
  drawGame(ctx, controller.state, controller.ui, controller.effects, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
