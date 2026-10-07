import { soundsFor } from './audio/mapping';
import type { SoundPlayer } from './audio/sound';
import { aiNextCommand } from './core/ai';
import { applyCommand } from './core/apply';
import { CONFIG, GADGETS, THROWABLES, WEAPONS } from './core/config';
import { rangeTiles } from './render/ranges';
import { distance, posEq } from './core/geometry';
import { findPath, pathCost } from './core/path';
import type { Command, Facing, GameEvent, GameState, Pos, Unit } from './core/types';
import { canSee, visibleToSide } from './core/vision';
import type { Mode, UiState } from './input/uiState';
import type { Effects } from './render/effects';
import type { ButtonId } from './render/panel';

const STEP_MS = 130;
const ENEMY_STEP_MS = 300;
/** Longest stretch of unseen enemy commands run in one block before handing control back to the browser. */
const ENEMY_BATCH_MS = 10;

/** Where a game event happened on the map, when it has a place. */
function eventPos(ev: GameEvent): Pos | null {
  switch (ev.type) {
    case 'moved': return ev.to;
    case 'shot': return ev.from;
    case 'stab': return ev.at;
    case 'reloaded':
    case 'died':
    case 'doorChanged':
    case 'grenade':
    case 'healed': return ev.at;
    default: return null;
  }
}

/** The facing (0 north, clockwise) from one tile toward another, or null for the same tile. */
export function faceToward(from: Pos, to: Pos): Facing | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  const steps = Math.round(Math.atan2(dx, -dy) / (Math.PI / 4));
  return (((steps % 8) + 8) % 8) as Facing;
}

export class Controller {
  /** True when the last applied command had an effect the player could see. */
  private lastVisible = false;
  /** Where the latest event the player could see happened (the camera follows the enemy turn with it). */
  lastEventAt: Pos | null = null;

  constructor(
    public state: GameState,
    public ui: UiState,
    public effects: Effects,
    private sound: SoundPlayer | null = null,
  ) {}

  selected(): Unit | undefined {
    return this.state.units.find((u) => u.id === this.ui.selectedId && u.alive);
  }

  private critMessageUntil = 0;

  private say(text: string, ms = 2000): void {
    this.ui.message = text;
    this.ui.messageIsHint = false;
    this.ui.messageUntil = performance.now() + ms;
  }

  /** A refusal by the interface itself (not by the rules): show the message and buzz, on the player's turn. */
  private refuse(text: string): void {
    this.say(text);
    if (this.state.turn === 'player') this.sound?.play('error', 0.9);
  }

  /** Forgets a touch preview: the pending tile and the path shown for it (a mouse hover is left alone). */
  private clearPending(): void {
    if (!this.ui.pendingTile) return;
    this.ui.pendingTile = null;
    this.ui.hover = null;
    this.ui.preview = [];
    this.ui.previewCost = null;
  }

  /** Selects one of the player's living soldiers (the squad strip, the number keys). */
  select(id: string): boolean {
    const u = this.state.units.find((x) => x.id === id && x.side === 'player' && x.alive);
    if (!u || !this.canAct()) return false;
    this.ui.selectedId = u.id;
    this.clearPending();
    if (this.ui.mode === 'heal') this.ui.mode = 'move'; // the new soldier may carry no medkit
    this.updatePreview();
    return true;
  }

  private squad(): Unit[] {
    return this.state.units.filter((u) => u.side === 'player' && u.alive);
  }

  private selectFirstAlive(): void {
    this.ui.selectedId = this.squad()[0]?.id ?? null;
  }

  run(cmd: Command): boolean {
    const r = applyCommand(this.state, cmd);
    if (!r.ok) {
      this.say(r.reason);
      if (this.state.turn === 'player') this.sound?.play(r.reason === 'Out of ammo' ? 'empty' : 'error', 0.9);
      return false;
    }
    const before = this.state;
    this.state = r.state;
    const flags = r.events.map((ev) => this.eventVisible(ev, before, r.state));
    this.lastVisible = flags.some(Boolean);
    const seenAt = flags.findIndex(Boolean);
    const where = seenAt >= 0 ? eventPos(r.events[seenAt]) : null;
    if (where) this.lastEventAt = { ...where };
    this.effects.add(r.events, performance.now());
    if (this.sound) {
      r.events.forEach((ev, i) => {
        for (const hit of soundsFor(ev, r.state, flags[i] || this.isOwn(ev, r.state))) {
          this.sound!.play(hit.name, hit.volume);
        }
      });
    }
    for (const ev of r.events) this.onEvent(ev);
    if (!this.selected()) this.selectFirstAlive();
    this.updatePreview();
    return true;
  }

  /** True for an event made by one of the player's own soldiers (always audible to the player). */
  private isOwn(ev: GameEvent, state: GameState): boolean {
    if (!('unitId' in ev)) return false;
    return state.units.find((u) => u.id === ev.unitId)?.side === 'player';
  }

  private onEvent(ev: GameEvent): void {
    if (ev.type === 'gameOver') {
      this.say(ev.winner === 'player' ? 'MISSION COMPLETE' : 'MISSION FAILED', Infinity);
    } else if (ev.type === 'shot' && ev.hit && ev.crit) {
      const shooterIsPlayer = this.state.units.find((u) => u.id === ev.unitId)?.side === 'player';
      this.say(`${shooterIsPlayer ? '' : 'ENEMY '}CRITICAL HIT: ${ev.damage} DAMAGE`, 3000);
      this.critMessageUntil = performance.now() + 3000;
    } else if (ev.type === 'healed') {
      const name = (id: string) => this.state.units.find((u) => u.id === id)?.name ?? id;
      this.say(`${name(ev.unitId)} heals ${name(ev.targetId)}: +${ev.amount} HP`, 3000);
    } else if (ev.type === 'scanned' && this.isOwn(ev, this.state)) {
      const n = ev.found.length;
      this.say(n === 0 ? 'SCAN: NO ENEMIES NEARBY' : `SCAN: ${n} ${n === 1 ? 'ENEMY' : 'ENEMIES'} NEARBY`, 3000);
    } else if (ev.type === 'turnEnded' && ev.side === 'enemy') {
      this.selectFirstAlive();
      // a critical hit that ended the enemy turn keeps its message; the panel already says YOUR MOVE
      if (performance.now() >= this.critMessageUntil) this.say('Your turn');
    }
  }

  hover(t: Pos | null): void {
    this.ui.hover = t;
    this.updatePreview();
  }

  private updatePreview(): void {
    this.ui.preview = [];
    this.ui.previewCost = null;
    const u = this.selected();
    const t = this.ui.hover;
    if (!u || !t || this.ui.mode !== 'move' || this.ui.busy || this.state.turn !== 'player') return;
    const path = findPath(this.state, u.id, t, { seenBy: 'player', doorView: this.state.doorMemory });
    if (path) {
      this.ui.preview = path;
      this.ui.previewCost = pathCost(u.pos, path);
    }
  }

  private canAct(): boolean {
    return !this.ui.busy && this.state.status === 'playing' && this.state.turn === 'player';
  }

  clickTile(t: Pos, touch = false): void {
    if (!this.canAct()) return;
    const sel = this.selected();
    const clicked = this.state.units.find(
      (u) => u.alive && posEq(u.pos, t) && (u.side === 'player' || visibleToSide(this.state, 'player', u.pos)),
    );

    if (this.ui.mode === 'move') {
      if (clicked && clicked.side === 'player') {
        this.ui.selectedId = clicked.id;
        this.clearPending();
        this.updatePreview();
        return;
      }
      if (!sel) {
        this.refuse('Select a soldier first');
        return;
      }
      if (touch) {
        // no hover on a touchscreen: the first tap shows the path and cost, a second tap on the same tile moves
        const pending = this.ui.pendingTile;
        if (!pending || !posEq(pending, t)) {
          this.ui.hover = { ...t };
          this.updatePreview();
          if (this.ui.previewCost === null) {
            this.ui.pendingTile = null;
            this.refuse('No path there');
            return;
          }
          this.ui.pendingTile = { ...t };
          this.say(`Tap again to move: ${this.ui.previewCost} AP`, 4000);
          return;
        }
      }
      this.ui.pendingTile = null;
      if (touch) this.ui.hover = null; // no pointer on a touchscreen: the tapped tile must not linger as a hover
      const path = findPath(this.state, sel.id, t, { seenBy: 'player', doorView: this.state.doorMemory });
      if (!path) {
        this.refuse('No path there');
        return;
      }
      const cost = pathCost(sel.pos, path);
      if (cost > sel.ap) {
        this.refuse(`Need ${cost} AP, have ${sel.ap}`);
        return;
      }
      this.moveAlong(sel.id, path);
      return;
    }

    if (!sel) {
      this.refuse('Select a soldier first');
      return;
    }
    if (touch && (this.ui.mode === 'snap' || this.ui.mode === 'aimed' || this.ui.mode === 'throw')) {
      // no pointer on a touchscreen: the first tap aims (the status line shows the odds, the map the blast), the second fires
      const pending = this.ui.pendingTile;
      if (!pending || !posEq(pending, t)) {
        if (this.ui.mode === 'throw') {
          if (!rangeTiles('throw', this.state, sel).some((p) => posEq(p, t))) {
            this.refuse('Out of reach');
            return;
          }
        } else if (!clicked || clicked.side !== 'enemy') {
          this.refuse('Click an enemy');
          return;
        } else if (!canSee(this.state, sel, clicked.pos)) {
          this.refuse('Target is not visible');
          return;
        } else if (distance(sel.pos, clicked.pos) > WEAPONS[sel.weapon].range) {
          this.refuse('Target is out of range');
          return;
        }
        this.ui.hover = { ...t };
        this.ui.pendingTile = { ...t };
        this.say(this.ui.mode === 'throw' ? `Tap again to throw: ${THROWABLES[sel.throwable].apCost} AP` : 'Tap again to fire', 4000);
        this.ui.messageIsHint = true; // the odds line may replace it
        return;
      }
      this.ui.pendingTile = null;
      this.ui.hover = null;
    }
    const mode = this.ui.mode;
    this.ui.mode = 'move';
    if (mode === 'snap' || mode === 'aimed') {
      if (!clicked || clicked.side !== 'enemy') {
        this.refuse('Click an enemy');
        return;
      }
      this.run({
        type: mode === 'snap' ? 'SnapShot' : 'AimedShot',
        unitId: sel.id,
        targetId: clicked.id,
      });
    } else if (mode === 'stab') {
      if (!clicked || clicked.side !== 'enemy') {
        this.refuse('Click an adjacent enemy');
        return;
      }
      this.run({ type: 'Stab', unitId: sel.id, targetId: clicked.id });
    } else if (mode === 'throw') {
      this.run({ type: 'Throw', unitId: sel.id, at: t });
    } else if (mode === 'door') {
      const tile = this.state.tiles[t.y][t.x];
      this.run({ type: tile.open ? 'CloseDoor' : 'OpenDoor', unitId: sel.id, at: t });
    } else if (mode === 'turn') {
      const facing = faceToward(sel.pos, t);
      if (facing === null || facing === sel.facing) return;
      this.run({ type: 'Turn', unitId: sel.id, facing });
    } else if (mode === 'heal') {
      if (!clicked || clicked.side !== 'player') {
        this.refuse('Click a soldier');
        return;
      }
      this.run({ type: 'Heal', unitId: sel.id, targetId: clicked.id });
    }
  }

  private enemiesInView(): Set<string> {
    return new Set(
      this.state.units
        .filter((u) => u.alive && u.side === 'enemy' && visibleToSide(this.state, 'player', u.pos))
        .map((u) => u.id),
    );
  }

  moveAlong(unitId: string, path: Pos[]): void {
    this.ui.busy = true;
    const step = (i: number) => {
      if (i >= path.length || this.state.status !== 'playing') {
        this.ui.busy = false;
        return;
      }
      const seenBefore = this.enemiesInView();
      if (!this.run({ type: 'Move', unitId, to: path[i] })) {
        this.ui.busy = false;
        return;
      }
      if ([...this.enemiesInView()].some((id) => !seenBefore.has(id))) {
        this.ui.busy = false;
        this.say('Enemy spotted');
        return;
      }
      setTimeout(() => step(i + 1), STEP_MS);
    };
    step(0);
  }

  private setMode(mode: Mode): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    this.ui.mode = mode;
    this.clearPending();
    const w = WEAPONS[sel.weapon];
    const burst = w.burst && w.burst > 1 ? ` x${w.burst}` : '';
    const hint: Record<Mode, string> = {
      move: '',
      snap: `Snap shot${burst}, ${w.snapAp} AP: click an enemy`,
      aimed: `Aimed shot${burst}, ${w.aimedAp} AP: click an enemy`,
      throw: `${THROWABLES[sel.throwable].name}, ${THROWABLES[sel.throwable].apCost} AP: click a tile`,
      door: 'Door, 2 AP: click an adjacent door',
      stab: `Stab, ${CONFIG.knife.apCost} AP: click an adjacent enemy`,
      heal: `Heal, ${GADGETS.medkit.apCost} AP: click yourself or an adjacent soldier`,
      turn: 'Turn, 1 AP per 45 degrees: click where to face',
    };
    this.say(hint[mode], 4000);
    this.ui.messageIsHint = true; // only the hint for the mode: a hover on an enemy may replace it with the odds
    this.updatePreview();
  }

  pressButton(id: ButtonId): void {
    switch (id) {
      case 'snap': this.setMode('snap'); break;
      case 'aimed': this.setMode('aimed'); break;
      case 'throw': this.setMode('throw'); break;
      case 'stab': this.setMode('stab'); break;
      case 'door': this.setMode('door'); break;
      case 'gadget': this.useGadget(); break;
      case 'turn': this.setMode('turn'); break;
      case 'zoom': break; // the app owns the camera
      case 'pickup': this.pickup(); break;
      case 'reload': this.reload(); break;
      case 'alert': this.toggleAlert(); break;
      case 'end': this.endTurn(); break;
    }
  }

  private useGadget(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    if (sel.gadget === 'medkit') this.setMode('heal');
    else if (sel.gadget === 'scanner') this.run({ type: 'Scan', unitId: sel.id });
    else this.refuse('No gadget to use');
  }

  private pickup(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    const item = this.state.items.find((i) => posEq(i.pos, sel.pos));
    if (!item) {
      this.refuse('Nothing to pick up here');
      return;
    }
    this.run({ type: 'PickUp', unitId: sel.id, itemId: item.id });
  }

  private reload(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    if (this.run({ type: 'Reload', unitId: sel.id })) this.say(`${sel.name} reloaded`);
  }

  private toggleAlert(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    const turningOn = !sel.alert;
    if (this.run({ type: 'Alert', unitId: sel.id, on: turningOn }) && turningOn) {
      this.say(`${sel.name} on alert: fires at enemies that move`, 4000);
    }
  }

  cancel(): void {
    this.ui.mode = 'move';
    this.clearPending();
    this.updatePreview();
  }

  endTurn(): void {
    if (!this.canAct()) return;
    if (!this.run({ type: 'EndTurn' })) return;
    this.ui.mode = 'move';
    this.clearPending();
    this.lastEventAt = null; // the enemy turn starts with no event to follow
    this.ui.busy = true;
    setTimeout(this.enemyStep, ENEMY_STEP_MS);
  }

  private enemyStep = (): void => {
    // Commands the player cannot see are applied at once; only visible ones get a pause. A long run of
    // unseen commands is split up so the page keeps responding.
    const started = performance.now();
    for (let i = 0; i < 500; i++) {
      if (this.state.status !== 'playing' || this.state.turn !== 'enemy') {
        this.ui.busy = false;
        return;
      }
      this.run(aiNextCommand(this.state));
      if (this.lastVisible) break;
      if (performance.now() - started > ENEMY_BATCH_MS) {
        setTimeout(this.enemyStep, 0);
        return;
      }
    }
    setTimeout(this.enemyStep, ENEMY_STEP_MS);
  };

  private eventVisible(ev: GameEvent, before: GameState, after: GameState): boolean {
    const seen = (p: Pos) => visibleToSide(before, 'player', p) || visibleToSide(after, 'player', p);
    switch (ev.type) {
      case 'moved': return seen(ev.from) || seen(ev.to);
      case 'shot': return seen(ev.from) || seen(ev.impact);
      case 'stab': return seen(ev.from) || seen(ev.at);
      case 'reloaded': return seen(ev.at);
      case 'healed': return seen(ev.at);
      case 'died':
      case 'doorChanged':
      case 'grenade': return seen(ev.at);
      default: return false;
    }
  }

  /** Selects the next (1) or previous (-1) living soldier, wrapping around. */
  cycle(dir: 1 | -1): void {
    const squad = this.squad();
    const found = squad.findIndex((u) => u.id === this.ui.selectedId);
    if (squad.length === 0 || !this.canAct()) return;
    const i = found < 0 ? (dir === 1 ? -1 : 0) : found; // nobody selected: forward starts at the first, back at the last
    this.ui.selectedId = squad[(i + dir + squad.length) % squad.length].id;
    this.clearPending();
    if (this.ui.mode === 'heal') this.ui.mode = 'move';
    this.updatePreview();
  }

  key(k: string): boolean {
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower >= '1' && lower <= '4' && lower.length === 1) {
      const target = this.state.units.find((u) => u.id === `p${lower}` && u.alive);
      if (target && this.canAct()) {
        this.ui.selectedId = target.id;
        this.clearPending();
        if (this.ui.mode === 'heal') this.ui.mode = 'move'; // the new soldier may carry no medkit
        this.updatePreview();
      }
      return true;
    }
    switch (lower) {
      case 's': this.setMode('snap'); return true;
      case 'a': this.setMode('aimed'); return true;
      case 't': this.setMode('throw'); return true;
      case 'k': this.setMode('stab'); return true;
      case 'd': this.setMode('door'); return true;
      case 'g': this.useGadget(); return true;
      case 'f': this.setMode('turn'); return true;
      case 'p': this.pickup(); return true;
      case 'r': this.reload(); return true;
      case 'l': this.toggleAlert(); return true;
      case ' ':
      case 'Enter': this.endTurn(); return true;
      case 'Escape': this.cancel(); return true;
      case 'q':
      case 'e': {
        const sel = this.selected();
        if (sel && this.canAct()) {
          const facing = ((sel.facing + (lower === 'e' ? 1 : 7)) % 8) as Facing;
          this.run({ type: 'Turn', unitId: sel.id, facing });
        }
        return true;
      }
      case 'Tab': this.cycle(1); return true;
      case 'Shift+Tab': this.cycle(-1); return true;
      default:
        return false;
    }
  }
}
