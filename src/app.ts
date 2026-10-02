import { Controller } from './controller';
import {
  budgetBreakdown, campaignBudget, newCampaign, recordMission, totalKills,
  type Campaign, type RosterSoldier,
} from './core/campaign';
import { defaultLoadout, fitLoadout, validateLoadout, type Loadout } from './core/loadout';
import { MISSIONS, createMission, type MissionDef } from './core/missions';
import { summarize, type MissionResult } from './core/result';
import type { GameState, Pos } from './core/types';
import type { Stash } from './core/stash';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import { screenToTile } from './render/layout';
import { buttonAt } from './render/panel';
import { drawGame } from './render/renderer';
import { drawCampaignEnd, endHit } from './screens/end';
import {
  applyEquipmentHit, drawEquipment, equipmentHit, type EquipmentHit, type EquipmentView,
} from './screens/equipment';
import { drawResult, resultHit } from './screens/result';

export type Screen = 'equipment' | 'mission' | 'result' | 'end';

const RESULT_DELAY_MS = 1000;
/** After any screen switch, clicks and Enter are ignored briefly so a double-click or held key cannot act on the next screen. */
const INPUT_LOCK_MS = 300;

export interface AppOptions {
  newSeed?: () => number;
  missions?: MissionDef[];
  createMission?: (
    def: MissionDef, seed: number, roster: RosterSoldier[], loadout: Loadout, budget: number, stash: Stash,
  ) => GameState;
  clock?: () => number;
}

export class App {
  screen: Screen = 'equipment';
  campaign: Campaign = newCampaign();
  loadout: Loadout = defaultLoadout();
  controller: Controller | null = null;
  result: MissionResult | null = null;

  private hover: EquipmentHit | null = null;
  private endedAt: number | null = null;
  private lockedUntil = -Infinity;
  private fallenNow: string[] = [];
  private playedName = '';
  private usedLoadout: Loadout = [];
  private readonly clock: () => number;
  private readonly newSeed: () => number;
  private readonly missions: MissionDef[];
  private readonly createMission: NonNullable<AppOptions['createMission']>;

  constructor(opts: AppOptions = {}) {
    this.clock = opts.clock ?? (() => performance.now());
    this.newSeed = opts.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));
    this.missions = opts.missions ?? MISSIONS;
    this.createMission =
      opts.createMission ??
      ((def, seed, roster, loadout, budget, stash) =>
        createMission(def, seed, roster, loadout, budget, stash));
  }

  private lock(): void {
    this.lockedUntil = this.clock() + INPUT_LOCK_MS;
  }

  private locked(): boolean {
    return this.clock() < this.lockedUntil;
  }

  private mission(): MissionDef {
    return this.missions[Math.min(this.campaign.missionIndex, this.missions.length - 1)];
  }

  private budget(): number {
    return campaignBudget(this.campaign);
  }

  private startMission(): void {
    if (validateLoadout(this.loadout, this.budget(), this.campaign.stash) !== null) return;
    const def = this.mission();
    const state = this.createMission(
      def, this.newSeed(), this.campaign.roster, this.loadout, this.budget(), this.campaign.stash,
    );
    this.usedLoadout = this.loadout;
    this.controller = new Controller(state, createUiState('p1'), new Effects());
    this.playedName = def.name;
    this.result = null;
    this.endedAt = null;
    this.screen = 'mission';
    this.lock();
  }

  /** From the result screen: the next mission's equipment while the campaign is active, else the end screen. */
  private continueFromResult(): void {
    if (this.campaign.status === 'active') {
      this.loadout = fitLoadout(this.loadout, this.budget(), this.campaign.stash);
      this.screen = 'equipment';
    } else {
      this.screen = 'end';
    }
    this.controller = null;
    this.endedAt = null;
    this.hover = null;
    this.lock();
  }

  private newCampaignScreen(): void {
    this.campaign = newCampaign();
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.endedAt = null;
    this.hover = null;
    this.screen = 'equipment';
    this.lock();
  }

  click(p: Pos): void {
    if (this.locked()) return;
    switch (this.screen) {
      case 'equipment': {
        const hit = equipmentHit(p.x, p.y);
        if (!hit) return;
        if (hit.kind === 'start') {
          this.startMission();
          return;
        }
        this.loadout = applyEquipmentHit(this.loadout, hit, this.budget(), this.campaign.stash);
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
        if (resultHit(p.x, p.y) === 'again') this.continueFromResult();
        return;
      case 'end':
        if (endHit(p.x, p.y) === 'new') this.newCampaignScreen();
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

  key(k: string, repeat = false): boolean {
    if (repeat && k === 'Enter') return true; // a held key must not chain screens
    switch (this.screen) {
      case 'equipment':
        if (k === 'Enter') {
          if (!this.locked()) this.startMission();
          return true;
        }
        return false;
      case 'mission':
        return this.controller ? this.controller.key(k) : false;
      case 'result':
        if (k === 'Enter') {
          if (!this.locked()) this.continueFromResult();
          return true;
        }
        return false;
      case 'end':
        if (k === 'Enter') {
          if (!this.locked()) this.newCampaignScreen();
          return true;
        }
        return false;
    }
  }

  cancel(): void {
    if (this.screen === 'mission') this.controller?.cancel();
  }

  /** Call once per frame. Records the finished mission and shows the result shortly after it ends. */
  update(now: number): void {
    const c = this.controller;
    if (this.screen !== 'mission' || !c) return;
    if (c.state.status === 'playing') {
      this.endedAt = null;
      return;
    }
    if (this.endedAt === null) this.endedAt = now;
    if (now - this.endedAt >= RESULT_DELAY_MS && !c.ui.busy) {
      const fallenBefore = this.campaign.fallen.length;
      this.result = summarize(c.state);
      this.campaign = recordMission(this.campaign, c.state, this.missions.length, this.usedLoadout);
      this.fallenNow = this.campaign.fallen.slice(fallenBefore).map((f) => f.name);
      this.screen = 'result';
      this.endedAt = null;
      this.lock();
    }
  }

  private equipmentView(): EquipmentView {
    const c = this.campaign;
    return {
      budget: this.budget(),
      title: `MISSION ${c.missionIndex + 1} OF ${this.missions.length}: ${this.mission().name.toUpperCase()}`,
      breakdown: budgetBreakdown(c),
      soldiers: c.roster,
      stash: c.stash,
    };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.screen === 'equipment') {
      drawEquipment(ctx, this.loadout, this.hover, this.equipmentView());
      return;
    }
    if (this.screen === 'end') {
      const c = this.campaign;
      drawCampaignEnd(ctx, {
        won: c.status === 'won',
        missionsWon: c.missionsWon,
        missionCount: this.missions.length,
        totalKills: totalKills(c) + c.fallen.reduce((sum, f) => sum + f.kills, 0),
        survivors: c.roster.map((r) => r.name),
        fallen: c.fallen.map((f) => f.name),
      });
      return;
    }
    const c = this.controller;
    if (!c) return;
    drawGame(ctx, c.state, c.ui, c.effects, now);
    if (this.screen === 'result' && this.result) {
      drawResult(ctx, {
        result: this.result,
        missionName: this.playedName,
        fallen: this.fallenNow,
        nextBudget: this.campaign.status === 'active' ? this.budget() : null,
      });
    }
  }
}
