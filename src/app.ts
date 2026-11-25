import { MoodTracker, type Mood } from './audio/music';
import { moodFor } from './audio/moodfor';
import { Sound, type SoundPlayer } from './audio/sound';
import { Controller } from './controller';
import {
  CAMPAIGN, budgetBreakdown, campaignBudget, newCampaign, recordMission, totalKills,
  type Campaign, type Mode, type RosterSoldier,
} from './core/campaign';
import { CAMPAIGN_LENGTH, drawVariations, generateMission } from './core/gen';
import { levelOf } from './core/campaign';
import { defaultLoadout, fitLoadout, loadoutCost, validateLoadout, type Loadout } from './core/loadout';
import { MISSIONS, createMission, type MissionDef } from './core/missions';
import { addStash, capStash, lootFrom } from './core/loot';
import { promotions, rankFor } from './core/ranks';
import { STASH_KEYS, describeStash, nextStash } from './core/stash';
import { summarize, type MissionResult } from './core/result';
import { unitAt } from './core/geometry';
import type { GameState, Pos, Unit } from './core/types';
import { visibleGrid, visibleToSide } from './core/vision';
import type { Stash } from './core/stash';
import type { DifficultyId } from './core/world/difficulty';
import { REGIONS } from './core/world/planet';
import {
  canAttack, canVisit, missionFor, newWorld, regionsHeld, resolve, visit, wait, type MissionSpec, type World,
} from './core/world/world';
import { BASE_RULES, storyGearRules } from './core/world/base';
import { autoSquad, deployed, fillSquad, hire, kitBudget, setSquad, startTraining } from './core/world/barracks';
import { NODES } from './core/world/base';
import { startResearch } from './core/world/research';
import type { GearArg } from './core/gear';
import { createUiState } from './input/uiState';
import { Effects } from './render/effects';
import {
  createCamera, followTile, panBy, screenToTile, setZoom, tileToScreen, type Camera,
} from './render/camera';
import { VIEW } from './render/layout';
import { cancelHit, detailHit, detailLineFor, panelButtonAt, soundHit, squadAt } from './render/panel';
import { unitAtScreen } from './render/hit';
import { drawGame } from './render/renderer';
import { drawCampaignEnd, endHit } from './screens/end';
import {
  applyEquipmentHit, drawEquipment, equipmentHit, equipmentInfoHit, type EquipmentHit, type EquipmentView,
} from './screens/equipment';
import { difficultyHit, drawDifficulty } from './screens/difficulty';
import { NO_ART, createArt, createPlanetArt, type Art, type PlanetArt } from './art/planetimages';
import { CAMP_ART_DATA } from './art/camp.generated';
import type { CampArtId } from './screens/campart';
import { PLANET_ART_DATA } from './art/planet.generated';
import { STORY_EQUIPMENT_BACK, drawPlanet, planetHit, storyEquipmentBackHit } from './screens/planet';
import { baseHit, drawBase } from './screens/base';
import { drawPanel, panelAction, panelHit, panelItem, type PanelId } from './screens/basepanels';
import { drawInfoBox, drawItemCard, drawSoldierCard } from './screens/baseinfo';
import { itemCard, type ItemRef } from './core/world/iteminfo';
import { buildingInfo } from './core/world/buildinginfo';
import { soldierStats } from './core/world/soldierinfo';
import { drawSquad, squadHit } from './screens/squad';
import { drawScene, sceneHit, type SceneView } from './screens/scene';
import { forward, pick, shownLine, skip, startPlay, type ScenePlay } from './sceneplay';
import { choose, nextScene, see, speakerFor } from './core/world/story';
import { drawResult, resultHit } from './screens/result';
import { LEGACY_SIZE, computeLayout, type Layout } from './ui/layout';
import { drawTitle, titleHit, type TitleView } from './screens/title';
import { defaultCampaignStore, defaultLastMode, defaultSaveStore, type LastMode, type Save, type SaveStore } from './save';
import { defaultStoryStore, type StorySave, type StoryStore } from './storysave';
import { textWidth } from './ui/font';
import { UI, drawButton, drawFrame } from './ui/frame';
import { drawText } from './ui/text';

export type Screen = 'title' | 'equipment' | 'mission' | 'result' | 'end' | 'planet' | 'difficulty' | 'base' | 'panel' | 'squad' | 'scene';

/** Menu pixels (of 480x400) around a small equipment button within which a touch still counts as a tap on it. */
const TOUCH_SLOP = 9;

/** True in an upright phone window, where the menus shrink to under 400 px wide and leave room above them for a hint. */
export function wantsRotateHint(width: number, height: number): boolean {
  return width < 480 && height > width * 1.3;
}

const RESULT_DELAY_MS = 1000;
/** A still screen is redrawn at least this often, so text on a timer still changes on time. */
const IDLE_BEAT_MS = 250;
/** After any screen switch, clicks and Enter are ignored briefly so a double-click or held key cannot act on the next screen. */
const INPUT_LOCK_MS = 300;
/** NEW CAMPAIGN on the title screen needs a second press within this time. */
const NEW_CONFIRM_MS = 3000;

export interface AppOptions {
  newSeed?: () => number;
  missions?: MissionDef[];
  createMission?: (
    def: MissionDef, seed: number, roster: RosterSoldier[], loadout: Loadout, budget: number, stash: Stash, level: GearArg, enemyLevel?: number,
  ) => GameState;
  clock?: () => number;
  sound?: SoundPlayer;
  /** The window size in CSS pixels and the device pixel ratio (default 480x400 at 1). */
  width?: number;
  height?: number;
  dpr?: number;
  /** Where the campaign is saved; undefined uses the browser's storage, null turns saving off. */
  store?: SaveStore | null;
  /** Where the generated campaign is saved (same rule as `store`: undefined uses the browser, null turns saving off). */
  campaignStore?: SaveStore | null;
  /** Remembers which mode was played last. */
  last?: LastMode | null;
  /** Builds a campaign mission from (type, variation); defaults to the generator. */
  generate?: (type: number, variation: number, difficulty?: number, blocks?: boolean) => MissionDef;
  /** Where the story is saved (same rule as `campaignStore`). */
  storyStore?: StoryStore | null;
  /** With no save to continue, start on the tutorial's equipment screen instead of the title (tests and tools). */
  skipTitle?: boolean;
  /** Show the story's scenes (default true; tests that click through the story turn them off). */
  scenes?: boolean;
  /** The painted planet map images (default: the baked art in the real game, none in tests that pass their own stores). */
  planetArt?: PlanetArt;
  /** The painted camp and face images (same rule as `planetArt`). */
  campArt?: Art<CampArtId>;
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
  private watch = { id: '', x: -1, y: -1, enemyTurn: false, event: '' };

  private hover: EquipmentHit | null = null;
  private endedAt: number | null = null;
  private lockedUntil = -Infinity;
  private readonly sceneOn: boolean;
  private readonly planetArt: PlanetArt;
  private readonly campArt: Art<CampArtId>;
  private scenePlay: ScenePlay | null = null;
  private sceneThen: Screen = 'planet';
  private scenesThisStop = 0;
  private fallenNow: string[] = [];
  private playedName = '';
  private noticeText = '';
  private noticeUntil = 0;
  private usedLoadout: Loadout = [];
  private newArmedUntil = 0;
  private armedMode: Mode | null = null;
  private saves: { tutorial: Save | null; campaign: Save | null } = { tutorial: null, campaign: null };
  /** The story being played, or null while the tutorial or the campaign is. */
  story: World | null = null;
  private storySave: StorySave | null = null;
  private readonly storyStore: StoryStore | null;
  private selectedRegion: number | null = null;
  private pendingSpec: MissionSpec | null = null;
  private planetNotice = '';
  private panelId: PanelId = 'lab';
  private panelSelected: number | null = null;
  /** The soldier whose card is open in the base (a panel or the squad step), and whether a building's info box is open. */
  private cardName: string | null = null;
  private infoOpen = false;
  private cardItem: ItemRef | null = null;
  private panelPage = 0;
  private baseNotice = '';
  private squadPicked: string[] = [];
  private abandonUntil = 0;
  private readonly campaignStore: SaveStore | null;
  private readonly lastMode: LastMode | null;
  private readonly generate: NonNullable<AppOptions['generate']>;
  private generated = new Map<number, MissionDef>();
  private readonly store: SaveStore | null;
  private readonly clock: () => number;
  private readonly newSeed: () => number;
  private readonly missions: MissionDef[];
  private readonly createMission: NonNullable<AppOptions['createMission']>;
  readonly sound: SoundPlayer;
  private readonly mood = new MoodTracker();
  private soundMood: Mood = 'calm';

  constructor(opts: AppOptions = {}) {
    this.clock = opts.clock ?? (() => performance.now());
    this.sound = opts.sound ?? new Sound();
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.newSeed = opts.newSeed ?? (() => Math.floor(Math.random() * 2 ** 31));
    this.missions = opts.missions ?? MISSIONS;
    this.createMission =
      opts.createMission ??
      ((def, seed, roster, loadout, budget, stash, level, enemyLevel) =>
        createMission(def, seed, roster, loadout, budget, stash, level, enemyLevel));
    this.width = opts.width ?? LEGACY_SIZE.width;
    this.height = opts.height ?? LEGACY_SIZE.height;
    this.dpr = opts.dpr ?? 1;
    this.layout = computeLayout(this.width, this.height, this.dpr);
    this.camera = createCamera(this.layout, 30, 20);
    const real = opts.store === undefined; // the real game; tests pass their own stores
    this.store = real ? defaultSaveStore(this.missions.length) : (opts.store ?? null);
    this.campaignStore = opts.campaignStore !== undefined ? opts.campaignStore : real ? defaultCampaignStore() : null;
    this.sceneOn = opts.scenes ?? true;
    this.planetArt = opts.planetArt ?? (real ? createPlanetArt(PLANET_ART_DATA, () => this.wake()) : NO_ART);
    this.campArt = opts.campArt ?? (real ? createArt<CampArtId>(CAMP_ART_DATA, () => this.wake()) : NO_ART);
    this.lastMode = opts.last !== undefined ? opts.last : real ? defaultLastMode() : null;
    this.storyStore = opts.storyStore !== undefined ? opts.storyStore : real ? defaultStoryStore() : null;
    this.storySave = this.storyStore?.load() ?? null;
    this.generate = opts.generate ?? generateMission;
    this.saves = { tutorial: this.store?.load() ?? null, campaign: this.campaignStore?.load() ?? null };
    this.screen = this.continueMode() === null && opts.skipTitle ? 'equipment' : 'title';
  }

  private readonly reducedMotion: boolean;

  private newEffects(): Effects {
    const fx = new Effects();
    fx.reducedMotion = this.reducedMotion;
    return fx;
  }

  private awakeUntil = 0;
  private lastDrawn = -Infinity;

  /** Something happened (input, a resize): draw every frame for a moment so its effect shows. */
  wake(ms = 600): void {
    this.awakeUntil = Math.max(this.awakeUntil, this.clock() + ms);
  }

  /**
   * Whether this frame needs drawing (and, when it does, counts it as drawn). A still screen is drawn only on a slow beat (timers that run out change text),
   * so a window left open does almost no work.
   */
  needsFrame(now: number): boolean {
    const yes =
      now < this.awakeUntil ||
      now - this.lastDrawn >= IDLE_BEAT_MS ||
      this.clock() < this.noticeUntil ||
      this.clock() < this.newArmedUntil ||
      (this.screen === 'mission' && !!this.controller?.animating(now));
    if (yes) this.lastDrawn = now; // the caller draws now, which restarts the beat
    return yes;
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
    this.watch = { id: sel.id, x: sel.pos.x, y: sel.pos.y, enemyTurn: c.state.turn === 'enemy', event: this.watch.event };
  }

  /** The window changed size (or turned): new layout, the camera back on the selected soldier, no half-made action. */
  resize(width: number, height: number, dpr: number): void {
    this.wake();
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
    this.wake();
    const c = this.controller;
    if (this.screen !== 'mission' || !c) return;
    this.camera = panBy(this.camera, dx, dy, this.layout, c.state.width, c.state.height);
  }

  /** A long press on the map leaves the current mode (the touch version of right-click). */
  longPress(p: Pos): void {
    this.wake();
    const c = this.controller;
    if (this.screen === 'mission' && c) {
      const L = this.layout;
      const onControl = soundHit(L, p.x, p.y) || (c.ui.mode !== 'move' && cancelHit(L, p.x, p.y));
      if (!onControl && screenToTile(this.camera, L, c.state.width, c.state.height, p.x, p.y)) {
        c.cancel(); // holding still on the map leaves the current mode
        return;
      }
    }
    this.click(p, 'touch'); // anywhere else a slow press is just a press
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
      // follow each new visible event that is off screen once; a pan by hand stands until the next event
      const at = c.lastEventAt;
      const key = at ? `${at.x},${at.y}` : '';
      if (at && key !== this.watch.event && !this.tileOnScreen(at, c)) {
        this.camera = followTile(this.camera, at, this.layout, c.state.width, c.state.height);
      }
      this.watch.event = key;
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
    const i = Math.min(this.campaign.missionIndex, this.missionCount() - 1);
    if (this.campaign.mode === 'tutorial') return this.missions[i];
    let def = this.generated.get(i);
    if (!def) {
      def = this.generate(i, this.campaign.variations[i]);
      this.generated.set(i, def);
    }
    return def;
  }

  private budget(): number {
    return this.story ? kitBudget(this.story) : campaignBudget(this.campaign);
  }

  private gearStash(): Stash {
    return this.story ? this.story.stash : this.campaign.stash;
  }

  private gearLevel(): GearArg {
    return this.story ? storyGearRules(this.story.research.done) : levelOf(this.campaign);
  }

  private startMission(): void {
    this.cardItem = null;
    if (validateLoadout(this.loadout, this.budget(), this.gearStash(), this.gearLevel()) !== null) return;
    if (this.story && this.pendingSpec) {
      this.startStoryMission(this.story, this.pendingSpec);
      return;
    }
    const def = this.mission();
    const state = this.createMission(
      def, this.newSeed(), this.campaign.roster, this.loadout, this.budget(), this.campaign.stash, levelOf(this.campaign),
    );
    this.usedLoadout = this.loadout;
    this.controller = new Controller(state, createUiState('p1'), this.newEffects(), this.sound);
    this.camera = createCamera(this.layout, state.width, state.height);
    this.followSelected();
    this.playedName = `${def.name}, MISSION ${this.campaign.missionIndex + 1} OF ${this.missionCount()}`.toUpperCase();
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.screen = 'mission';
    this.lock();
    this.sound.play('click', 0.9);
  }

  private startStoryMission(w: World, spec: MissionSpec): void {
    const def = this.generate(spec.type, spec.variation, spec.difficulty, true);
    const state = this.createMission(
      def, spec.seed, deployed(w).roster, this.loadout, kitBudget(w), w.stash, storyGearRules(w.research.done), spec.enemyLevel,
    );
    this.usedLoadout = this.loadout;
    this.controller = new Controller(state, createUiState('p1'), this.newEffects(), this.sound);
    this.camera = createCamera(this.layout, state.width, state.height);
    this.followSelected();
    this.playedName = REGIONS[spec.region].name.toUpperCase();
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.screen = 'mission';
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** Saves the story, or clears the save once it is over. */
  private saveStory(): void {
    const w = this.story;
    if (!w) return;
    if (w.status === 'active') {
      const loadout = fitLoadout(this.loadout, kitBudget(w), w.stash, storyGearRules(w.research.done));
      this.storyStore?.save(w, loadout);
      this.storySave = { world: w, loadout };
    } else {
      this.storyStore?.clear();
      this.storySave = null;
    }
  }

  /** The mission just ended: fold it into the world and show the result card. */
  private finishStoryMission(c: Controller, w: World, spec: MissionSpec): void {
    const fallenBefore = w.fallen.length;
    const rosterBefore = w.soldiers.map((s) => ({ name: s.name, kills: s.kills + s.trained }));
    const stashBefore = w.stash;
    this.result = summarize(c.state);
    const next = resolve(w, spec, c.state, this.usedLoadout, loadoutCost(this.usedLoadout, w.stash, storyGearRules(w.research.done)));
    this.story = next;
    this.saveStory();
    this.promoted = promotions(rosterBefore, next.soldiers.map((s) => ({ name: s.name, kills: s.kills + s.trained })));
    this.loot = c.state.status === 'won' ? this.lootText(stashBefore, c.state) : '';
    this.fallenNow = next.fallen.slice(fallenBefore).map((f) => f.name);
    this.screen = 'result';
    this.wake();
    this.endedAt = null;
    this.lock();
  }

  /** STORY on the title: continue the saved story, or choose a difficulty for a new one. */
  private pressStory(): void {
    const save = this.storySave;
    this.newArmedUntil = 0;
    if (save) {
      this.story = save.world;
      this.loadout = fitLoadout(save.loadout, kitBudget(save.world), save.world.stash, storyGearRules(save.world.research.done));
      this.selectedRegion = null;
      this.planetNotice = '';
      this.pendingSpec = null;
      this.showScenes('planet'); // a scene cut off by a reload plays now
    } else {
      this.screen = 'difficulty';
    }
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  private startStory(id: DifficultyId): void {
    this.story = newWorld(this.newSeed(), id);
    this.loadout = defaultLoadout();
    this.selectedRegion = null;
    this.planetNotice = '';
    this.pendingSpec = null;
    this.saveStory();
    this.showScenes('planet');
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** The planet's action button: attack the selected region (equipment first) or visit it. */
  private actOnRegion(): void {
    const w = this.story;
    const id = this.selectedRegion;
    if (!w || id === null) return;
    if (canAttack(w, id)) {
      this.pendingSpec = missionFor(w, id);
      this.squadPicked = fillSquad(w);
      this.screen = 'squad';
      this.hover = null;
      this.lock();
      this.sound.play('click', 0.9);
    } else if (canVisit(w, id)) {
      const next = visit(w, id);
      const gained = STASH_KEYS.filter((k) => next.stash[k] > w.stash[k]);
      this.planetNotice = w.regions[id].holder === 'neutral'
        ? `${REGIONS[id].name} joins you.`
        : gained.length > 0 ? `Found 1 ${gained[0]}.` : 'Found supplies (stash full).';
      this.story = next;
      this.saveStory();
      this.afterTimePassed();
      this.showScenes(this.screen);
      this.lock();
      this.sound.play('click', 0.9);
    }
  }

  /** From the story equipment screen: change your mind and return to the planet; nothing is spent. */
  private backToSquad(): void {
    this.closeInfo();
    this.screen = 'squad';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** Leaves the squad step (or a panel's parent): no fight is started and nothing is spent. */
  private backToPlanet(): void {
    this.closeInfo();
    this.pendingSpec = null;
    this.screen = 'planet';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** START on the squad step: fix the squad, then on to equipment. */
  private confirmSquad(): void {
    const w = this.story;
    if (!w) return;
    this.closeInfo();
    this.story = setSquad(w, this.squadPicked.filter((n) => w.soldiers.some((s) => s.name === n && s.status === 'ready')));
    this.loadout = fitLoadout(this.loadout, kitBudget(this.story), this.story.stash, storyGearRules(this.story.research.done));
    this.screen = 'equipment';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** Closes the soldier card, the item card or the building info box if one is open; true when something was closed. */
  private closeInfo(): boolean {
    const open = this.cardName !== null || this.infoOpen || this.cardItem !== null;
    this.cardName = null;
    this.infoOpen = false;
    this.cardItem = null;
    if (open) this.sound.play('click', 0.9);
    return open;
  }

  private openPanel(id: PanelId): void {
    this.closeInfo();
    this.panelId = id;
    this.panelSelected = null;
    this.panelPage = 0;
    this.baseNotice = '';
    this.screen = 'panel';
    this.lock();
    this.sound.play('click', 0.9);
  }

  private backToBase(): void {
    this.closeInfo();
    this.screen = 'base';
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** Plays the scenes now pending (at most 3 per stop), then goes on to `then`. */
  private showScenes(then: Screen): void {
    this.sceneThen = then;
    this.scenesThisStop = 0;
    this.nextSceneOrLeave();
  }

  private nextSceneOrLeave(): void {
    const w = this.story;
    const next = this.sceneOn && w && this.scenesThisStop < 3 ? nextScene(w) : null;
    if (!next) {
      // a fast click that ended the last scene must not fall through to the screen behind it
      if (this.scenesThisStop > 0) this.lock();
      this.scenePlay = null;
      this.screen = this.sceneThen;
      return;
    }
    this.scenesThisStop += 1;
    this.scenePlay = startPlay(next);
    if (next.id === 'victory' || next.id === 'defeat') this.sound.stinger?.(next.id);
    this.screen = 'scene';
    this.hover = null;
    this.lock();
  }

  /** A scene without a choice ends: it is now seen and saved. A choice scene was recorded when the player picked. */
  private finishScene(): void {
    const p = this.scenePlay;
    const w = this.story;
    if (p && w && !w.seen.includes(p.scene.id)) {
      this.story = see(w, p.scene.id);
      this.saveStory();
    }
    this.scenePlay = null;
    this.nextSceneOrLeave();
  }

  /** Moves on inside a scene; the choice buttons come up where the clicks were landing, so they get an input lock. */
  private enterPlay(from: ScenePlay, to: ScenePlay): void {
    this.scenePlay = to;
    if (to.phase === 'choice' && from.phase !== 'choice') this.lock();
  }

  private sceneForward(): void {
    const p = this.scenePlay;
    if (!p) return;
    const next = forward(p);
    if (next === 'done') this.finishScene();
    else this.enterPlay(p, next);
    this.sound.play('click', 0.9);
  }

  private sceneSkip(): void {
    const p = this.scenePlay;
    if (!p) return;
    const next = skip(p);
    if (next === 'done') this.finishScene();
    else this.enterPlay(p, next);
    this.sound.play('click', 0.9);
  }

  /** The player takes an option: the effect is applied and saved at once, then the reply plays. */
  private scenePick(index: 0 | 1): void {
    const p = this.scenePlay;
    const w = this.story;
    if (!p || !w || p.phase !== 'choice') return;
    this.story = choose(w, p.scene, index);
    this.saveStory();
    // days passing can end the story: then only the ending scene is left to show
    if (this.story.status !== 'active') this.sceneThen = 'end';
    this.scenePlay = pick(p, index);
    this.sound.play('click', 0.9);
  }

  private sceneView(): SceneView | null {
    const p = this.scenePlay;
    const w = this.story;
    if (!p || !w) return null;
    const line = shownLine(p);
    if (line) return { speaker: speakerFor(w, line), text: line.text, choices: null, skippable: true };
    const last = p.scene.lines[p.scene.lines.length - 1];
    const choice = p.scene.choice;
    return { speaker: speakerFor(w, last), text: '', choices: choice ? [choice[0].label, choice[1].label] : null, skippable: false };
  }

  /** The soldier card or the building info box over the panel or the squad step, when one is open. */
  private drawBaseInfo(ctx: CanvasRenderingContext2D, w: World): void {
    const soldier = this.cardName !== null ? w.soldiers.find((x) => x.name === this.cardName) : undefined;
    if (this.cardItem) drawItemCard(ctx, itemCard(this.cardItem, w));
    else if (soldier) drawSoldierCard(ctx, soldierStats(soldier, w));
    else if (this.infoOpen && this.screen === 'panel') drawInfoBox(ctx, buildingInfo(this.panelId, w));
  }

  /** Time passed outside a fight (a visit, a wait): if the planet fell in the meantime the story is over. */
  private afterTimePassed(): void {
    if (this.story && this.story.status !== 'active') {
      this.screen = 'end';
      this.hover = null;
    }
  }

  /** The panel's action button: research, hire, train or wait; every success is saved. */
  private doPanelAction(): void {
    const w = this.story;
    if (!w) return;
    const label = panelAction(this.panelId, w, this.panelSelected);
    if (!label) return;
    const sel = this.panelSelected;
    let next: World = w;
    let notice = '';
    if (this.panelId === 'lab' && sel !== null) {
      next = startResearch(w, NODES[sel].id);
      notice = `Researching ${NODES[sel].name}.`;
    } else if (this.panelId === 'hospital') {
      const node = NODES.find((n) => n.id === `hospital${w.research.done.filter((d) => d.startsWith('hospital')).length + 1}`)!;
      next = startResearch(w, node.id);
      notice = `Researching ${node.name}.`;
    } else if (this.panelId === 'barracks') {
      next = hire(w);
      notice = `Hired ${next.soldiers[next.soldiers.length - 1].name}.`;
    } else if (this.panelId === 'training' && sel !== null) {
      next = startTraining(w, w.soldiers[sel].name);
      notice = `${w.soldiers[sel].name} is training.`;
    } else if (this.panelId === 'wait' && sel !== null) {
      const days = sel === 0 ? 1 : 3;
      next = wait(w, days);
      notice = `Waited ${days} ${days === 1 ? 'day' : 'days'}.`;
    }
    this.story = next;
    this.baseNotice = notice;
    this.saveStory();
    this.afterTimePassed();
    this.showScenes(this.screen);
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** ABANDON on the planet: the first press arms, a second one erases the story and asks for a new difficulty. */
  private abandonStory(): void {
    if (this.clock() >= this.abandonUntil) {
      this.abandonUntil = this.clock() + NEW_CONFIRM_MS;
      this.lock();
      this.sound.play('click', 0.9);
      return;
    }
    this.abandonUntil = 0;
    this.story = null;
    this.storyStore?.clear();
    this.storySave = null;
    this.pendingSpec = null;
    this.screen = 'difficulty';
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** From the result screen: the next mission's equipment while the campaign is active, else the end screen. */
  private continueFromResult(): void {
    if (this.story) {
      this.showScenes(this.story.status === 'active' ? 'planet' : 'end');
      this.pendingSpec = null;
      this.controller = null;
      this.endedAt = null;
      this.hover = null;
      this.lock();
      this.sound.play('click', 0.9);
      return;
    }
    if (this.campaign.status === 'active') {
      this.loadout = fitLoadout(this.loadout, this.budget(), this.campaign.stash, levelOf(this.campaign));
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

  private storeFor(mode: Mode): SaveStore | null {
    return mode === 'campaign' ? this.campaignStore : this.store;
  }

  /** The mode CONTINUE would resume: the one played last if it has a save, else the other one, else none. */
  private continueMode(): Mode | null {
    const last = this.lastMode?.get() ?? 'tutorial';
    const order: Mode[] = last === 'campaign' ? ['campaign', 'tutorial'] : ['tutorial', 'campaign'];
    return order.find((m) => this.saves[m] !== null) ?? null;
  }

  private missionCount(): number {
    return this.campaign.mode === 'campaign' ? CAMPAIGN_LENGTH : this.missions.length;
  }

  private titleView(): TitleView {
    const m = this.continueMode();
    const save = m ? this.saves[m] : null;
    return {
      continue: m && save
        ? {
            mode: m,
            missionNumber: save.campaign.missionIndex + 1,
            missionCount: m === 'campaign' ? CAMPAIGN_LENGTH : this.missions.length,
            soldiers: save.campaign.roster.length,
            budget: campaignBudget(save.campaign),
          }
        : null,
      armed: this.clock() < this.newArmedUntil ? this.armedMode : null,
      story: this.storySave ? { day: this.storySave.world.day, held: regionsHeld(this.storySave.world) } : null,
    };
  }

  private continueFromTitle(): void {
    const mode = this.continueMode();
    const save = mode ? this.saves[mode] : null;
    if (!mode || !save) return;
    this.newArmedUntil = 0;
    this.story = null;
    this.pendingSpec = null;
    this.campaign = save.campaign;
    this.generated.clear();
    this.loadout = fitLoadout(save.loadout, campaignBudget(save.campaign), save.campaign.stash, levelOf(save.campaign));
    this.lastMode?.set(mode);
    this.screen = 'equipment';
    this.hover = null;
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** NEW CAMPAIGN or TUTORIAL on the title: starts at once, or arms first when it would replace that mode's save. */
  private pressStart(mode: Mode): void {
    if (this.saves[mode] === null) {
      this.begin(mode);
      return;
    }
    if (this.armedMode === mode && this.clock() < this.newArmedUntil) {
      this.newArmedUntil = 0;
      this.armedMode = null;
      this.storeFor(mode)?.clear();
      this.saves[mode] = null;
      this.begin(mode);
      return;
    }
    this.armedMode = mode;
    this.newArmedUntil = this.clock() + NEW_CONFIRM_MS;
    this.lock(); // a held key or a double click must not count as the second press
    this.sound.play('click', 0.9);
  }

  /** Back to the title from the end screen, where either mode can be started again. */
  private toTitle(): void {
    this.cardName = null;
    this.infoOpen = false;
    this.cardItem = null;
    this.controller = null;
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.hover = null;
    this.newArmedUntil = 0;
    this.scenePlay = null;
    this.screen = 'title';
    this.lock();
    this.sound.play('click', 0.9);
  }

  /** A fresh run of `mode` on the equipment screen. */
  private begin(mode: Mode): void {
    this.story = null;
    this.pendingSpec = null;
    this.campaign = mode === 'campaign' ? newCampaign('campaign', drawVariations(this.newSeed())) : newCampaign();
    this.generated.clear();
    this.loadout = defaultLoadout();
    this.controller = null;
    this.result = null;
    this.promoted = [];
    this.endedAt = null;
    this.hover = null;
    this.newArmedUntil = 0;
    this.lastMode?.set(mode);
    this.screen = 'equipment';
    this.lock();
    this.sound.play('click', 0.9);
  }

  /**
   * Browsers keep audio silent until a click or key press. On the title screen that first gesture only unlocks the
   * sound, so the action music is already playing when the player picks from the menu instead of being cut off by it.
   */
  private firstGestureOnTitle(): boolean {
    if (this.screen !== 'title' || !this.sound.waiting) return false;
    this.sound.unlock();
    return true;
  }

  /** Opens the soldier card for the selected soldier; nothing without one. */
  private openCard(): void {
    const c = this.controller;
    if (c && c.state.units.some((u) => u.id === c.ui.selectedId && u.alive)) c.ui.card = true;
  }

  click(p: Pos, pointer: 'mouse' | 'touch' = 'mouse'): void {
    this.wake();
    if (this.firstGestureOnTitle()) return;
    this.sound.unlock();
    if (this.locked()) return;
    const mp = this.toMenu(p);
    switch (this.screen) {
      case 'title': {
        const hit = titleHit(mp.x, mp.y, this.continueMode() !== null, pointer === 'touch' ? 5 : 0);
        if (hit === 'continue') this.continueFromTitle();
        else if (hit === 'campaign') this.pressStart('campaign');
        else if (hit === 'tutorial') this.pressStart('tutorial');
        else if (hit === 'story') this.pressStory();
        return;
      }
      case 'difficulty': {
        const hit = difficultyHit(mp.x, mp.y, pointer === 'touch' ? 5 : 0);
        if (hit === 'back') this.toTitle();
        else if (hit) this.startStory(hit);
        return;
      }
      case 'planet': {
        const hit = planetHit(mp.x, mp.y, pointer === 'touch' ? 6 : 0);
        if (!hit) return;
        if (hit.kind === 'region') {
          this.selectedRegion = hit.id;
          this.planetNotice = '';
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'act') this.actOnRegion();
        else if (hit.kind === 'base') {
          this.screen = 'base';
          this.baseNotice = '';
          this.lock();
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'abandon') this.abandonStory();
        else this.toTitle();
        return;
      }
      case 'base': {
        const hit = baseHit(mp.x, mp.y, pointer === 'touch' ? 5 : 0);
        if (hit === 'planet') this.backToPlanet();
        else if (hit) this.openPanel(hit);
        return;
      }
      case 'panel': {
        const w = this.story;
        if (!w) return;
        if (this.closeInfo()) {
          this.lock(); // an item card's BACK sits over ACT and BACK: a double-click must not press them
          return;
        }
        const hit = panelHit(this.panelId, mp.x, mp.y, w, this.panelPage, pointer === 'touch' ? 5 : 0);
        if (!hit) return;
        if (hit.kind === 'name') {
          this.panelSelected = hit.index;
          this.baseNotice = '';
          const item = panelItem(this.panelId, hit.index);
          if (item) this.cardItem = item;
          else this.cardName = w.soldiers[hit.index]?.name ?? null;
          this.lock(); // the second click of a double-click must not close the card it just opened
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'info') {
          this.infoOpen = true;
          this.lock();
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'row') {
          this.panelSelected = hit.index;
          this.baseNotice = '';
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'act') this.doPanelAction();
        else if (hit.kind === 'back') this.backToBase();
        else if (hit.kind === 'next') this.panelPage += 1;
        else this.panelPage = Math.max(0, this.panelPage - 1);
        return;
      }
      case 'scene': {
        const view = this.sceneView();
        if (!view) return;
        const hit = sceneHit(mp.x, mp.y, view, pointer === 'touch' ? 5 : 0);
        if (hit === 'next') this.sceneForward();
        else if (hit === 'skip') this.sceneSkip();
        else if (hit) this.scenePick(hit.index);
        return;
      }
      case 'squad': {
        const w = this.story;
        if (!w) return;
        if (this.closeInfo()) return;
        const hit = squadHit(mp.x, mp.y, w, pointer === 'touch' ? 5 : 0);
        if (!hit) return;
        if (hit.kind === 'card') {
          this.cardName = hit.name;
          this.lock();
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'soldier') {
          this.squadPicked = this.squadPicked.includes(hit.name)
            ? this.squadPicked.filter((n) => n !== hit.name)
            : this.squadPicked.length < 4 ? [...this.squadPicked, hit.name] : this.squadPicked;
          this.sound.play('click', 0.9);
        } else if (hit.kind === 'auto') this.squadPicked = autoSquad(w);
        else if (hit.kind === 'start') this.confirmSquad();
        else this.backToPlanet();
        return;
      }
      case 'equipment': {
        const fight = this.story !== null && this.pendingSpec !== null;
        if (fight && this.closeInfo()) {
          this.lock(); // the second click of a double-click on BACK must not press START under it
          return;
        }
        if (fight) {
          const item = equipmentInfoHit(mp.x, mp.y, this.loadout, pointer === 'touch' ? 3 : 0);
          if (item) {
            this.cardItem = item;
            this.lock(); // the second click of a double-click must not close the card it just opened
            this.sound.play('click', 0.9);
            return;
          }
        }
        if (this.story && this.pendingSpec && storyEquipmentBackHit(mp.x, mp.y, pointer === 'touch' ? TOUCH_SLOP : 0)) {
          this.backToSquad();
          return;
        }
        const hit = equipmentHit(mp.x, mp.y, pointer === 'touch' ? TOUCH_SLOP : 0);
        if (!hit) return;
        if (hit.kind === 'start') {
          this.startMission();
          return;
        }
        const next = applyEquipmentHit(this.loadout, hit, this.budget(), this.gearStash(), this.gearLevel());
        if (next !== this.loadout) this.sound.play('click', 0.9);
        this.loadout = next;
        return;
      }
      case 'mission': {
        const c = this.controller;
        if (!c) return;
        const L = this.layout;
        if (c.ui.card) {
          // the squad strip stays live under the card (it switches soldier); any other click closes it
          const pick = squadAt(L, p.x, p.y);
          if (pick !== null) this.selectSquad(pick);
          else c.ui.card = false;
          return;
        }
        const picked = c.state.units.find((u) => u.id === c.ui.selectedId && u.alive);
        if (detailHit(L, p.x, p.y, picked ? detailLineFor(picked, L) : '')) {
          this.openCard();
          return;
        }
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
        const hit = this.figureAt(c, p);
        if (hit) {
          c.clickTile(hit.pos, pointer === 'touch'); // a figure counts as his feet tile
          return;
        }
        const t = screenToTile(this.camera, L, c.state.width, c.state.height, p.x, p.y);
        if (t) c.clickTile(t, pointer === 'touch');
        return;
      }
      case 'result':
        if (resultHit(mp.x, mp.y, pointer === 'touch' ? TOUCH_SLOP : 0) === 'again') this.continueFromResult();
        return;
      case 'end':
        if (endHit(mp.x, mp.y, pointer === 'touch' ? TOUCH_SLOP : 0) === 'new') this.toTitle();
        return;
    }
  }

  /**
   * The unit a click or hover on a figure stands for, or null when it means the tile under the pointer. A figure reaches
   * up over the tile north of his feet, so this must not steal that tile's clicks: door, throw and turn always mean
   * the tile; so does a move onto a tile that can be walked to (the soldiers are drawn see-through then, and one is picked
   * by his own tile, the squad strip or the keys); a unit standing on the tile under the pointer wins over a figure reaching up from the row below;
   * a shot or a blow looks only for enemy figures, a heal only for soldiers.
   */
  private figureAt(c: Controller, p: Pos): Unit | null {
    const mode = c.ui.mode;
    if (mode === 'door' || mode === 'throw' || mode === 'turn') return null;
    if (mode === 'move') {
      // a click means the tile under the pointer, so a comrade's head never blocks a move; but where that tile gives no move
      // (a wall, or unexplored) the figure picks the soldier instead of ending in 'No path there', and with nobody selected too
      const sel = c.state.units.find((u) => u.id === c.ui.selectedId && u.alive && u.side === 'player');
      const under = screenToTile(this.camera, this.layout, c.state.width, c.state.height, p.x, p.y);
      if (sel && under && c.state.explored[under.y][under.x] && c.state.tiles[under.y][under.x].kind !== 'wall') return null;
    }
    const tile = screenToTile(this.camera, this.layout, c.state.width, c.state.height, p.x, p.y);
    const standing = tile ? unitAt(c.state, tile) : undefined;
    if (standing && (standing.side === 'player' || visibleToSide(c.state, 'player', standing.pos))) return null;
    const accept = (u: Unit): boolean => (mode === 'snap' || mode === 'aimed' || mode === 'stab' ? u.side === 'enemy' : u.side === 'player');
    return unitAtScreen(c.state, this.camera, this.layout, p.x, p.y, accept);
  }

  move(p: Pos): void {
    this.wake();
    if (this.screen === 'equipment') {
      const mp = this.toMenu(p);
      this.hover = equipmentHit(mp.x, mp.y);
    } else if (this.screen === 'mission' && this.controller) {
      const c = this.controller;
      const hit = this.figureAt(c, p);
      c.hover(hit ? hit.pos : screenToTile(this.camera, this.layout, c.state.width, c.state.height, p.x, p.y));
    }
  }

  leave(): void {
    this.wake();
    this.hover = null;
    if (this.screen === 'mission') this.controller?.hover(null);
  }

  key(k: string, repeat = false): boolean {
    this.wake();
    if (this.firstGestureOnTitle()) return true;
    this.sound.unlock();
    if (repeat && k === 'Enter') return true; // a held key must not chain screens
    if (this.soundKey(k)) return true;
    switch (this.screen) {
      case 'title':
        if (k === 'Enter') {
          if (!this.locked() && this.continueMode() !== null) this.continueFromTitle();
          return true;
        }
        if (k === 's' || k === 'S') {
          if (!repeat && !this.locked()) this.pressStory();
          return true;
        }
        if (k === 'n' || k === 'N' || k === 't' || k === 'T') {
          if (!repeat && !this.locked()) this.pressStart(k === 'n' || k === 'N' ? 'campaign' : 'tutorial');
          return true;
        }
        return false;
      case 'difficulty':
      case 'planet':
        if (k === 'Escape') {
          if (!this.locked()) this.toTitle();
          return true;
        }
        if (k === 'Enter' && this.screen === 'planet') {
          if (!this.locked()) this.actOnRegion();
          return true;
        }
        return false;
      case 'equipment':
        if (k === 'Enter') {
          if (!this.locked() && !(this.cardItem !== null && this.closeInfo())) this.startMission(); // an open item card takes the key
          return true;
        }
        if (k === 'Escape' && this.story && this.pendingSpec) {
          if (!repeat && !this.locked() && !this.closeInfo()) this.backToSquad(); // a held key must not close a card and then leave
          return true;
        }
        return false;
      case 'scene':
        if ((k === ' ' || k === 'Enter') && !repeat) {
          if (!this.locked()) this.sceneForward();
          return true;
        }
        if (k === 'Escape') {
          if (!repeat && !this.locked()) this.sceneSkip();
          return true;
        }
        return k === ' ' || k === 'Enter';
      case 'squad':
        if (k === 'Escape') {
          if (!repeat && !this.locked() && !this.closeInfo()) this.backToPlanet(); // a held key must not close a card and then leave
          return true;
        }
        return false;
      case 'base':
        if (k === 'Escape') {
          if (!this.locked()) this.backToPlanet();
          return true;
        }
        return false;
      case 'panel':
        if (k === 'Escape') {
          if (!repeat && !this.locked() && !this.closeInfo()) this.backToBase();
          return true;
        }
        return false;
      case 'mission':
        if (this.controller?.ui.card) {
          // the soldier card is modal: I or Escape close it, Tab, Shift+Tab and 1 to 4 browse soldiers, the rest is ignored
          if ((k === 'i' || k === 'I') && !repeat) this.controller.ui.card = false;
          else if (k === 'Escape') this.controller.ui.card = false;
          else if (k === 'Tab' || k === 'Shift+Tab' || (k >= '1' && k <= '4' && k.length === 1)) this.controller.key(k);
          return true;
        }
        if (k === 'i' || k === 'I') {
          if (!repeat) this.openCard();
          return true;
        }
        if (k === 'z' || k === 'Z') {
          this.toggleZoom();
          return true;
        }
        return this.controller ? this.controller.key(k) : false;
      case 'result':
        if (k === 'Enter') {
          if (!this.locked()) this.continueFromResult();
          return true;
        }
        return false;
      case 'end':
        if (k === 'Enter') {
          if (!this.locked()) this.toTitle();
          return true;
        }
        return false;
    }
  }

  cancel(): void {
    this.wake();
    if (this.screen === 'mission') this.controller?.cancel();
  }

  /** Call once per frame. Records the finished mission and shows the result shortly after it ends. */
  update(now: number): void {
    const c = this.controller;
    this.updateMusic(now);
    if (this.screen !== 'mission' || !c) return;
    const cameraBefore = this.camera;
    this.trackCamera(c);
    if (this.camera !== cameraBefore) this.wake();
    if (c.state.status === 'playing') {
      this.endedAt = null;
      return;
    }
    if (this.endedAt === null) this.endedAt = now;
    if (now - this.endedAt >= RESULT_DELAY_MS && !c.ui.busy) {
      if (this.story && this.pendingSpec) {
        this.finishStoryMission(c, this.story, this.pendingSpec);
        return;
      }
      const fallenBefore = this.campaign.fallen.length;
      const rosterBefore = this.campaign.roster;
      const stashBefore = this.campaign.stash;
      this.result = summarize(c.state);
      this.campaign = recordMission(this.campaign, c.state, this.missionCount(), this.usedLoadout);
      const mode = this.campaign.mode;
      if (this.campaign.status === 'active') {
        const loadout = fitLoadout(this.loadout, this.budget(), this.campaign.stash, levelOf(this.campaign));
        this.storeFor(mode)?.save(this.campaign, loadout);
        this.saves[mode] = { campaign: this.campaign, loadout };
        this.lastMode?.set(mode);
      } else {
        this.storeFor(mode)?.clear();
        this.saves[mode] = null;
      }
      this.promoted = promotions(rosterBefore, this.campaign.roster);
      this.loot = c.state.status === 'won' ? this.lootText(stashBefore, c.state) : '';
      this.fallenNow = this.campaign.fallen.slice(fallenBefore).map((f) => f.name);
      this.screen = 'result';
      this.wake();
      this.endedAt = null;
      this.lock();
    }
  }

  /**
   * The soundtrack: action on the title, the planet theme on the story's map and the base theme on its base side (moodFor), and in a
   * mission action while the squad can see an enemy and mystery a few seconds after the last one is out of sight.
   */
  private updateMusic(now: number): void {
    const c = this.controller;
    let seen = false;
    if (this.screen === 'mission' && c && c.state.status === 'playing') {
      const grid = visibleGrid(c.state, 'player');
      seen = c.state.units.some((u) => u.alive && u.side === 'enemy' && grid[u.pos.y]?.[u.pos.x]);
    }
    const tracked = this.mood.update(seen, now);
    const story = { active: this.story !== null, fight: this.story !== null && this.pendingSpec !== null };
    const mood = moodFor(this.screen, story, tracked, this.soundMood); // see moodfor.ts: the title, the story's map and base, scenes
    if (mood !== this.soundMood) {
      this.soundMood = mood;
      this.sound.setMood?.(mood);
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
    const w = this.story;
    if (w && this.pendingSpec) {
      const r = REGIONS[this.pendingSpec.region];
      const squad = deployed(w);
      return {
        budget: kitBudget(w),
        title: `${r.name.toUpperCase()}: ${w.regions[r.id].garrison} ENEMIES`,
        breakdown: `Credits ${w.credits}` + (squad.mercs > 0 ? `, loans ${squad.mercs} x ${BASE_RULES.mercFee}` : ''),
        soldiers: squad.roster.map((s) => ({ ...s, rank: rankFor(s.kills + (s.trained ?? 0)).name })),
        stash: w.stash,
        level: storyGearRules(w.research.done),
        infoButtons: true,
      };
    }
    const c = this.campaign;
    return {
      budget: this.budget(),
      title: `MISSION ${c.missionIndex + 1} OF ${this.missionCount()}: ${this.mission().name.toUpperCase()}`,
      breakdown: budgetBreakdown(c),
      soldiers: c.roster.map((r) => ({ ...r, rank: rankFor(r.kills).name })),
      stash: c.stash,
      level: levelOf(c),
    };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false; // scaled pixel art and text stay crisp
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawScreen(ctx, now);
    const menu = this.screen === 'title' || this.screen === 'equipment' || this.screen === 'end' ||
      this.screen === 'planet' || this.screen === 'difficulty' || this.screen === 'base' || this.screen === 'panel' ||
      this.screen === 'squad' || this.screen === 'scene';
    if (menu) {
      this.inMenuSpace(ctx, () => this.drawSoundHint(ctx, VIEW.width, true));
      this.drawRotateHint(ctx);
    }
    else this.drawSoundHint(ctx, this.width, false);
  }

  /** A phone held upright shows the 480x400 menus small: say so in the empty band above them. */
  private drawRotateHint(ctx: CanvasRenderingContext2D): void {
    if (!wantsRotateHint(this.width, this.height)) return;
    const m = this.menuTransform();
    ctx.save();
    ctx.translate(this.width / 2, m.y / 2 - 5);
    ctx.scale(2, 2);
    drawText(ctx, 'TURN YOUR PHONE SIDEWAYS', 0, -3, UI.accent, 'center');
    drawText(ctx, 'FOR A BIGGER MENU', 0, 6, UI.hint, 'center');
    ctx.restore();
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
      if (this.screen === 'title' && this.sound.waiting) drawText(ctx, 'CLICK OR PRESS A KEY FOR MUSIC', rightEdge - 6, VIEW.height - 12, UI.accent, 'right');
      else drawText(ctx, 'M: sound on/off   - =: volume', rightEdge - 6, VIEW.height - 12, UI.hint, 'right');
    }
  }

  private drawScreen(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.screen === 'title') {
      this.inMenuSpace(ctx, () => drawTitle(ctx, this.titleView()));
      return;
    }
    if (this.screen === 'equipment') {
      this.inMenuSpace(ctx, () => {
        drawEquipment(ctx, this.loadout, this.hover, this.equipmentView());
        if (this.story && this.pendingSpec) drawButton(ctx, STORY_EQUIPMENT_BACK, 'BACK (Esc)', 'raised');
        if (this.story && this.cardItem) drawItemCard(ctx, itemCard(this.cardItem, this.story));
      });
      return;
    }
    if (this.screen === 'scene') {
      const v = this.sceneView();
      if (v) this.inMenuSpace(ctx, () => drawScene(ctx, v, this.campArt));
      return;
    }
    if (this.screen === 'difficulty') {
      this.inMenuSpace(ctx, () => drawDifficulty(ctx));
      return;
    }
    if (this.screen === 'base' && this.story) {
      const w = this.story;
      this.inMenuSpace(ctx, () => drawBase(ctx, w, this.baseNotice, this.campArt));
      return;
    }
    if (this.screen === 'panel' && this.story) {
      const w = this.story;
      this.inMenuSpace(ctx, () => {
        drawPanel(ctx, this.panelId, w, this.panelSelected, this.panelPage, this.baseNotice, this.campArt);
        this.drawBaseInfo(ctx, w);
      });
      return;
    }
    if (this.screen === 'squad' && this.story) {
      const w = this.story;
      this.inMenuSpace(ctx, () => {
        drawSquad(ctx, w, this.squadPicked);
        this.drawBaseInfo(ctx, w);
      });
      return;
    }
    if (this.screen === 'planet' && this.story) {
      const w = this.story;
      this.inMenuSpace(ctx, () => drawPlanet(ctx, {
        world: w, selected: this.selectedRegion, armedAbandon: this.clock() < this.abandonUntil, notice: this.planetNotice,
      }, this.planetArt));
      return;
    }
    if (this.screen === 'end' && this.story) {
      const w = this.story;
      this.inMenuSpace(ctx, () => drawCampaignEnd(ctx, {
        story: true,
        won: w.status === 'won',
        missionsWon: REGIONS.filter((r) => r.kind === 'enemy' && w.regions[r.id].holder === 'player').length,
        missionCount: REGIONS.filter((r) => r.kind === 'enemy').length,
        totalKills: w.soldiers.reduce((sum, r) => sum + r.kills, 0) + w.fallen.reduce((sum, f) => sum + f.kills, 0),
        survivors: w.soldiers.map((r) => r.name),
        fallen: w.fallen.map((f) => f.name),
      }));
      return;
    }
    if (this.screen === 'end') {
      const c = this.campaign;
      this.inMenuSpace(ctx, () => drawCampaignEnd(ctx, {
        mode: c.mode,
        won: c.status === 'won',
        missionsWon: c.missionsWon,
        missionCount: this.missionCount(),
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
        nextBudget: (this.story ? this.story.status : this.campaign.status) === 'active' ? this.budget() : null,
        promoted: this.promoted,
        loot: this.loot,
      }));
    }
  }
}
