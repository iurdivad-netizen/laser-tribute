import { Controller } from './controller';
import { defaultLoadout, validateLoadout, type Loadout } from './core/loadout';
import { createMission1 } from './core/mission1';
import { summarize, type MissionResult } from './core/result';
import type { GameState, Pos } from './core/types';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import { screenToTile } from './render/layout';
import { buttonAt } from './render/panel';
import { drawGame } from './render/renderer';
import {
  applyEquipmentHit, drawEquipment, equipmentHit, type EquipmentHit,
} from './screens/equipment';
import { drawResult, resultHit } from './screens/result';

export type Screen = 'equipment' | 'mission' | 'result';

const RESULT_DELAY_MS = 1000;

export interface AppOptions {
  newSeed?: () => number;
  createMission?: (seed: number, loadout: Loadout) => GameState;
}

export class App {
  screen: Screen = 'equipment';
  loadout: Loadout = defaultLoadout();
  controller: Controller | null = null;
  result: MissionResult | null = null;

  private hover: EquipmentHit | null = null;
  private endedAt: number | null = null;
  private readonly newSeed: () => number;
  private readonly createMission: (seed: number, loadout: Loadout) => GameState;

  constructor(opts: AppOptions = {}) {
    this.newSeed = opts.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));
    this.createMission = opts.createMission ?? ((seed, loadout) => createMission1(seed, loadout));
  }

  private startMission(): void {
    if (validateLoadout(this.loadout) !== null) return;
    const state = this.createMission(this.newSeed(), this.loadout);
    this.controller = new Controller(state, createUiState('p1'), new Effects());
    this.result = null;
    this.endedAt = null;
    this.screen = 'mission';
  }

  private playAgain(): void {
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.endedAt = null;
    this.hover = null;
    this.screen = 'equipment';
  }

  click(p: Pos): void {
    switch (this.screen) {
      case 'equipment': {
        const hit = equipmentHit(p.x, p.y);
        if (!hit) return;
        if (hit.kind === 'start') {
          this.startMission();
          return;
        }
        this.loadout = applyEquipmentHit(this.loadout, hit);
        return;
      }
      case 'mission': {
        const c = this.controller;
        if (!c) return;
        const button = buttonAt(p.x, p.y);
        if (button) {
          c.pressButton(button);
          return;
        }
        const t = screenToTile(p.x, p.y, c.state.width, c.state.height);
        if (t) c.clickTile(t);
        return;
      }
      case 'result':
        if (resultHit(p.x, p.y) === 'again') this.playAgain();
        return;
    }
  }

  move(p: Pos): void {
    if (this.screen === 'equipment') {
      this.hover = equipmentHit(p.x, p.y);
    } else if (this.screen === 'mission' && this.controller) {
      const c = this.controller;
      c.hover(screenToTile(p.x, p.y, c.state.width, c.state.height));
    }
  }

  leave(): void {
    this.hover = null;
    if (this.screen === 'mission') this.controller?.hover(null);
  }

  key(k: string): boolean {
    switch (this.screen) {
      case 'equipment':
        if (k === 'Enter') {
          this.startMission();
          return true;
        }
        return false;
      case 'mission':
        return this.controller ? this.controller.key(k) : false;
      case 'result':
        if (k === 'Enter') {
          this.playAgain();
          return true;
        }
        return false;
    }
  }

  cancel(): void {
    if (this.screen === 'mission') this.controller?.cancel();
  }

  /** Call once per frame. Switches to the result screen shortly after the mission ends. */
  update(now: number): void {
    const c = this.controller;
    if (this.screen !== 'mission' || !c) return;
    if (c.state.status === 'playing') {
      this.endedAt = null;
      return;
    }
    if (this.endedAt === null) this.endedAt = now;
    if (now - this.endedAt >= RESULT_DELAY_MS && !c.ui.busy) {
      this.result = summarize(c.state);
      this.screen = 'result';
      this.endedAt = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.screen === 'equipment') {
      drawEquipment(ctx, this.loadout, this.hover);
      return;
    }
    const c = this.controller;
    if (!c) return;
    drawGame(ctx, c.state, c.ui, c.effects, now);
    if (this.screen === 'result' && this.result) drawResult(ctx, this.result);
  }
}
