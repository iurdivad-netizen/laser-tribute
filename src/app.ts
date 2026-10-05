import { Sound, type SoundPlayer } from './audio/sound';
import { Controller } from './controller';
import {
  budgetBreakdown, campaignBudget, newCampaign, recordMission, totalKills,
  type Campaign, type RosterSoldier,
} from './core/campaign';
import { defaultLoadout, fitLoadout, validateLoadout, type Loadout } from './core/loadout';
import { MISSIONS, createMission, type MissionDef } from './core/missions';
import { addStash, capStash, lootFrom } from './core/loot';
import { promotions, rankFor } from './core/ranks';
import { describeStash, nextStash } from './core/stash';
import { summarize, type MissionResult } from './core/result';
import type { GameState, Pos } from './core/types';
import type { Stash } from './core/stash';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import {
  createCamera, followTile, panBy, screenToTile, setZoom, tileToScreen, type Camera,
} from './render/camera';
import { VIEW } from './render/layout';
import { cancelHit, panelButtonAt, soundHit, squadAt } from './render/panel';
import { drawGame } from './render/renderer';
import { drawCampaignEnd, endHit } from './screens/end';
import {
  applyEquipmentHit, drawEquipment, equipmentHit, type EquipmentHit, type EquipmentView,
} from './screens/equipment';
import { drawResult, resultHit } from './screens/result';
import { LEGACY_SIZE, computeLayout, type Layout } from './ui/layout';
import { drawTitle, titleHit } from './screens/title';
import { defaultSaveStore, type SaveStore } from './save';
import { textWidth } from './ui/font';
import { UI, drawFrame } from './ui/frame';
import { drawText } from './ui/text';

export type Screen = 'title' | 'equipment' | 'mission' | 'result' | 'end';

const RESULT_DELAY_MS = 1000;
/** After any screen switch, clicks and Enter are ignored briefly so a double-click or held key cannot act on the next screen. */
const INPUT_LOCK_MS = 300;
/** NEW CAMPAIGN on the title screen needs a second press within this time. */
const NEW_CONFIRM_MS = 3000;

export interface AppOptions {
  newSeed?: () => number;
  missions?: MissionDef[];
  createMission?: (
    def: MissionDef, seed: number, roster: RosterSoldier[], loadout: Loadout, budget: number, stash: Stash,
  ) => GameState;
  clock?: () => number;
  sound?: SoundPlayer;
  /** The window size in CSS pixels and the device pixel ratio (default 480x400 at 1). */
  width?: number;
  height?: number;
  dpr?: number;
  /** Where the campaign is saved; undefined uses the browser's storage, null turns saving off. */
  store?: SaveStore | null;
}

export class App {
  screen: Screen = 'equipment';
  campaign: Campaign = newCampaign();
  loadout: Loadout = defaultLoadout();
  controller: Controller | null = null;
  result: MissionResult | null = null;
  promoted: string[] = [];
  /** What the squad recovered from the dead enemies after the last won mission, as text. */
  loot = '';
  /** Where the mission screen's rectangles are, and which part of the map is shown. */
  layout: Layout;
  camera: Camera;
  private width: number;
  private height: number;
  private dpr: number;
  /** What the camera last saw of the selection and the turn, to follow when they change. */
  private watch = { id: '', x: -1, y: -1, enemyTurn: false };

  private hover: EquipmentHit | null = null;
  private endedAt: number | null = null;
  private lockedUntil = -Infinity;
  private fallenNow: string[] = [];
  private playedName = '';
  private noticeText = '';
  private noticeUntil = 0;
  private usedLoadout: Loadout = [];
  private newArmedUntil = 0;
  private readonly store: SaveStore | null;
  private readonly clock: () => number;
  private readonly newSeed: () => number;
  private readonly missions: MissionDef[];
  private readonly createMission: NonNullable<AppOptions['createMission']>;
  readonly sound: SoundPlayer;

  constructor(opts: AppOptions = {}) {
    this.clock = opts.clock ?? (() => performance.now());
    this.sound = opts.sound ?? new Sound();
    this.newSeed = opts.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));
    this.missions = opts.missions ?? MISSIONS;
    this.createMission =
      opts.createMission ??
      ((def, seed, roster, loadout, budget, stash) =>
        createMission(def, seed, roster, loadout, budget, stash));
    this.width = opts.width ?? LEGACY_SIZE.width;
    this.height = opts.height ?? LEGACY_SIZE.height;
    this.dpr = opts.dpr ?? 1;
    this.layout = computeLayout(this.width, this.height, this.dpr);
    this.camera = createCamera(this.layout, 30, 20);
    this.store = opts.store === undefined ? defaultSaveStore(this.missions.length) : opts.store;
    const saved = this.store?.load() ?? null;
    if (saved) {
      this.campaign = saved.campaign;
      this.loadout = fitLoadout(saved.loadout, campaignBudget(saved.campaign), saved.campaign.stash);
      this.screen = 'title';
    }
  }

  private notice(text: string): void {
    this.noticeText = text;
    this.noticeUntil = this.clock() + 1500;
  }

  /** Centres the camera on the selected soldier and turns following on. */
  private followSelected(): void {
    const c = this.controller;
    const sel = c?.selected();
    if (!c || !sel) return;
    this.camera = followTile(this.camera, sel.pos, this.layout, c.state.width, c.state.height);
    this.watch = { id: sel.id, x: sel.pos.x, y: sel.pos.y, enemyTurn: c.state.turn === 'enemy' };
  }

  /** The window changed size (or turned): new layout, the camera back on the selected soldier, no half-made action. */
  resize(width: number, height: number, dpr: number): void {
    if (width < 120 || height < 120) return; // a hidden or not yet laid-out canvas
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.layout = computeLayout(width, height, dpr);
    const c = this.controller;
    if (!c) return;
    const zoom = this.camera.zoom;
    this.camera = setZoom(createCamera(this.layout, c.state.width, c.state.height), zoom, this.layout, c.state.width, c.state.height);
    c.cancel();
    this.followSelected();
  }

  /** The menus are drawn 480x400 and scaled to fit the window, centred. */
  menuTransform(): { scale: number; x: number; y: number } {
    const scale = Math.min(this.width / VIEW.width, this.height / VIEW.height);
    return { scale, x: (this.width - VIEW.width * scale) / 2, y: (this.height - VIEW.height * scale) / 2 };
  }

  private toMenu(p: Pos): Pos {
    const m = this.menuTransform();
    return { x: (p.x - m.x) / m.scale, y: (p.y - m.y) / m.scale };
  }

  /** A finger dragged the map by (dx, dy) pixels. */
  pan(dx: number, dy: number): void {
    const c = this.controller;
    if (this.screen !== 'mission' || !c) return;
    this.camera = panBy(this.camera, dx, dy, this.layout, c.state.width, c.state.height);
  }

  /** A long press on the map leaves the current mode (the touch version of right-click). */
  longPress(_p: Pos): void {
    if (this.screen === 'mission') this.controller?.cancel();
  }

  private tileOnScreen(pos: Pos, c: Controller): boolean {
    const s = tileToScreen(this.camera, this.layout, c.state.width, c.state.height, pos);
    const m = this.layout.map;
    const cx = s.x + s.tile / 2;
    const cy = s.y + s.tile / 2;
    return cx >= m.x && cx < m.x + m.w && cy >= m.y && cy < m.y + m.h;
  }

  /** Follows the selected soldier when he changes or moves, and a visible event off screen during the enemy turn. */
  private trackCamera(c: Controller): void {
    const sel = c.selected();
    if (c.state.turn === 'enemy') {
      const at = c.lastEventAt;
      if (at && !this.tileOnScreen(at, c)) this.camera = followTile(this.camera, at, this.layout, c.state.width, c.state.height);
      this.watch.enemyTurn = true;
      return;
    }
    const changed = !!sel && (sel.id !== this.watch.id || sel.pos.x !== this.watch.x || sel.pos.y !== this.watch.y);
    if (changed || this.watch.enemyTurn) this.followSelected();
    this.watch.enemyTurn = false;
  }

  private selectSquad(i: number): void {
    const c = this.controller;
    const unit = c?.state.units.filter((u) => u.side === 'player')[i];
    if (!c || !unit || !c.select(unit.id)) return;
    this.followSelected();
  }

  private toggleZoom(): void {
    const c = this.controller;
    if (!c) return;
    const zoom = this.camera.zoom === 'close' ? 'whole' : 'close';
    this.camera = setZoom(this.camera, zoom, this.layout, c.state.width, c.state.height);
    if (zoom === 'close') this.followSelected(); // zooming in goes to the soldier, not to wherever the map was centred
  }

  /** Sound keys work on every screen: M mutes, - and = change the volume. */
  private soundKey(k: string): boolean {
    if (k === 'm' || k === 'M') this.notice(this.sound.toggleMute());
    else if (k === '-') this.notice(this.sound.changeVolume(-0.1));
    else if (k === '=' || k === '+') this.notice(this.sound.changeVolume(0.1));
    else return false;
    return true;
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
    this.controller = new Controller(state, createUiState('p1'), new Effects(), this.sound);
    this.camera = createCamera(this.layout, state.width, state.height);
    this.followSelected();
    this.playedName = def.name;
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.screen = 'mission';
    this.lock();
    this.sound.play('click', 0.9);
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
    this.sound.play('click', 0.9);
  }

  private continueFromTitle(): void {
    this.newArmedUntil = 0;
    this.screen = 'equipment';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** NEW CAMPAIGN on the title: the first press arms, a second one within 3 s replaces the save. */
  private pressNew(): void {
    if (this.clock() < this.newArmedUntil) {
      this.newArmedUntil = 0;
      this.store?.clear();
      this.newCampaignScreen();
      return;
    }
    this.newArmedUntil = this.clock() + NEW_CONFIRM_MS;
    this.lock(); // a held key or a double click must not count as the second press
    this.sound.play('click', 0.9);
  }

  private newCampaignScreen(): void {
    this.campaign = newCampaign();
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.hover = null;
    this.screen = 'equipment';
    this.lock();
    this.sound.play('click', 0.9);
  }

  click(p: Pos, pointer: 'mouse' | 'touch' = 'mouse'): void {
    this.sound.unlock();
    if (this.locked()) return;
    const mp = this.toMenu(p);
    switch (this.screen) {
      case 'title': {
        const hit = titleHit(mp.x, mp.y);
        if (hit === 'continue') this.continueFromTitle();
        else if (hit === 'new') this.pressNew();
        return;
      }
      case 'equipment': {
        const hit = equipmentHit(mp.x, mp.y);
        if (!hit) return;
        if (hit.kind === 'start') {
          this.startMission();
          return;
        }
        const next = applyEquipmentHit(this.loadout, hit, this.budget(), this.campaign.stash);
        if (next !== this.loadout) this.sound.play('click', 0.9);
        this.loadout = next;
        return;
      }
      case 'mission': {
        const c = this.controller;
        if (!c) return;
        const L = this.layout;
        if (c.ui.mode !== 'move' && cancelHit(L, p.x, p.y)) {
          c.cancel();
          return;
        }
        if (soundHit(L, p.x, p.y)) {
          this.notice(this.sound.toggleMute());
          return;
        }
        const squad = squadAt(L, p.x, p.y);
        if (squad !== null) {
          this.selectSquad(squad);
          return;
        }
        const button = panelButtonAt(L, p.x, p.y);
        if (button) {
          if (button === 'zoom') this.toggleZoom();
          else c.pressButton(button);
          return;
        }
        const t = screenToTile(this.camera, L, c.state.width, c.state.height, p.x, p.y);
        if (t) c.clickTile(t, pointer === 'touch');
        return;
      }
      case 'result':
        if (resultHit(mp.x, mp.y) === 'again') this.continueFromResult();
        return;
      case 'end':
        if (endHit(mp.x, mp.y) === 'new') this.newCampaignScreen();
        return;
    }
  }

  move(p: Pos): void {
    if (this.screen === 'equipment') {
      const mp = this.toMenu(p);
      this.hover = equipmentHit(mp.x, mp.y);
    } else if (this.screen === 'mission' && this.controller) {
      const c = this.controller;
      c.hover(screenToTile(this.camera, this.layout, c.state.width, c.state.height, p.x, p.y));
    }
  }

  leave(): void {
    this.hover = null;
    if (this.screen === 'mission') this.controller?.hover(null);
  }

  key(k: string, repeat = false): boolean {
    this.sound.unlock();
    if (repeat && k === 'Enter') return true; // a held key must not chain screens
    if (this.soundKey(k)) return true;
    switch (this.screen) {
      case 'title':
        if (k === 'Enter') {
          if (!this.locked()) this.continueFromTitle();
          return true;
        }
        if (k === 'n' || k === 'N') {
          if (!repeat && !this.locked()) this.pressNew();
          return true;
        }
        return false;
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
    this.trackCamera(c);
    if (c.state.status === 'playing') {
      this.endedAt = null;
      return;
    }
    if (this.endedAt === null) this.endedAt = now;
    if (now - this.endedAt >= RESULT_DELAY_MS && !c.ui.busy) {
      const fallenBefore = this.campaign.fallen.length;
      const rosterBefore = this.campaign.roster;
      const stashBefore = this.campaign.stash;
      this.result = summarize(c.state);
      this.campaign = recordMission(this.campaign, c.state, this.missions.length, this.usedLoadout);
      if (this.campaign.status === 'active') {
        this.store?.save(this.campaign, fitLoadout(this.loadout, this.budget(), this.campaign.stash));
      } else {
        this.store?.clear();
      }
      this.promoted = promotions(rosterBefore, this.campaign.roster);
      this.loot = c.state.status === 'won' ? this.lootText(stashBefore, c.state) : '';
      this.fallenNow = this.campaign.fallen.slice(fallenBefore).map((f) => f.name);
      this.screen = 'result';
      this.endedAt = null;
      this.lock();
    }
  }

  /** The loot of the dead enemies as text, with a note when the stash was too full to keep all of it. */
  private lootText(stashBefore: Stash, finished: GameState): string {
    const loot = lootFrom(finished);
    const text = describeStash(loot);
    if (!text) return '';
    const total = addStash(nextStash(stashBefore, this.usedLoadout, finished), loot);
    const capped = capStash(total);
    const cut = capped.rifle !== total.rifle || capped.pistol !== total.pistol || capped.clip !== total.clip;
    return cut ? `${text} (stash full)` : text;
  }

  private equipmentView(): EquipmentView {
    const c = this.campaign;
    return {
      budget: this.budget(),
      title: `MISSION ${c.missionIndex + 1} OF ${this.missions.length}: ${this.mission().name.toUpperCase()}`,
      breakdown: budgetBreakdown(c),
      soldiers: c.roster.map((r) => ({ ...r, rank: rankFor(r.kills).name })),
      stash: c.stash,
    };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawScreen(ctx, now);
    const menu = this.screen === 'title' || this.screen === 'equipment' || this.screen === 'end';
    if (menu) this.inMenuSpace(ctx, () => this.drawSoundHint(ctx, VIEW.width, true));
    else this.drawSoundHint(ctx, this.width, false);
  }

  /** Runs `draw` in the 480x400 menu space, scaled and centred in the window. */
  private inMenuSpace(ctx: CanvasRenderingContext2D, draw: () => void): void {
    const m = this.menuTransform();
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.scale(m.scale, m.scale);
    draw();
    ctx.restore();
  }

  private drawSoundHint(ctx: CanvasRenderingContext2D, rightEdge: number, persistent: boolean): void {
    if (this.clock() < this.noticeUntil) {
      const w = textWidth(this.noticeText) + 10;
      drawFrame(ctx, rightEdge - 6 - w, 2, w, 13, 'inset');
      drawText(ctx, this.noticeText, rightEdge - 11, 5, UI.accent, 'right');
    } else if (persistent) {
      drawText(ctx, 'M: sound on/off   - =: volume', rightEdge - 6, VIEW.height - 12, UI.hint, 'right');
    }
  }

  private drawScreen(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.screen === 'title') {
      const c = this.campaign;
      this.inMenuSpace(ctx, () => drawTitle(ctx, {
        missionNumber: c.missionIndex + 1,
        missionCount: this.missions.length,
        soldiers: c.roster.length,
        budget: this.budget(),
        armed: this.clock() < this.newArmedUntil,
      }));
      return;
    }
    if (this.screen === 'equipment') {
      this.inMenuSpace(ctx, () => drawEquipment(ctx, this.loadout, this.hover, this.equipmentView()));
      return;
    }
    if (this.screen === 'end') {
      const c = this.campaign;
      this.inMenuSpace(ctx, () => drawCampaignEnd(ctx, {
        won: c.status === 'won',
        missionsWon: c.missionsWon,
        missionCount: this.missions.length,
        totalKills: totalKills(c) + c.fallen.reduce((sum, f) => sum + f.kills, 0),
        survivors: c.roster.map((r) => r.name),
        fallen: c.fallen.map((f) => f.name),
      }));
      return;
    }
    const c = this.controller;
    if (!c) return;
    drawGame(ctx, c.state, c.ui, c.effects, now, undefined, { layout: this.layout, camera: this.camera }, {
      zoom: this.camera.zoom,
      soundOn: !this.sound.muted,
    });
    if (this.screen === 'result' && this.result) {
      this.inMenuSpace(ctx, () => drawResult(ctx, {
        result: this.result!,
        missionName: this.playedName,
        fallen: this.fallenNow,
        nextBudget: this.campaign.status === 'active' ? this.budget() : null,
        promoted: this.promoted,
        loot: this.loot,
      }));
    }
  }
}
