import { aiNextCommand } from './core/ai';
import { applyCommand } from './core/apply';
import { WEAPONS } from './core/config';
import { posEq } from './core/geometry';
import { findPath, pathCost } from './core/path';
import type { Command, Facing, GameEvent, GameState, Pos, Unit } from './core/types';
import { visibleToSide } from './core/vision';
import type { Mode, UiState } from './input/uiState';
import type { Effects } from './render/effects';
import type { ButtonId } from './render/panel';

const STEP_MS = 130;
const ENEMY_STEP_MS = 300;

export class Controller {
  constructor(
    public state: GameState,
    public ui: UiState,
    public effects: Effects,
  ) {}

  selected(): Unit | undefined {
    return this.state.units.find((u) => u.id === this.ui.selectedId && u.alive);
  }

  private say(text: string, ms = 2000): void {
    this.ui.message = text;
    this.ui.messageUntil = performance.now() + ms;
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
      return false;
    }
    this.state = r.state;
    this.effects.add(r.events, performance.now());
    for (const ev of r.events) this.onEvent(ev);
    if (!this.selected()) this.selectFirstAlive();
    this.updatePreview();
    return true;
  }

  private onEvent(ev: GameEvent): void {
    if (ev.type === 'gameOver') {
      this.say(ev.winner === 'player' ? 'MISSION COMPLETE' : 'MISSION FAILED', Infinity);
    } else if (ev.type === 'turnEnded' && ev.side === 'enemy') {
      this.selectFirstAlive();
      this.say('Your turn');
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
    const path = findPath(this.state, u.id, t);
    if (path) {
      this.ui.preview = path;
      this.ui.previewCost = pathCost(u.pos, path);
    }
  }

  private canAct(): boolean {
    return !this.ui.busy && this.state.status === 'playing' && this.state.turn === 'player';
  }

  clickTile(t: Pos): void {
    if (!this.canAct()) return;
    const sel = this.selected();
    const clicked = this.state.units.find(
      (u) => u.alive && posEq(u.pos, t) && (u.side === 'player' || visibleToSide(this.state, 'player', u.pos)),
    );

    if (this.ui.mode === 'move') {
      if (clicked && clicked.side === 'player') {
        this.ui.selectedId = clicked.id;
        this.updatePreview();
        return;
      }
      if (!sel) {
        this.say('Select a soldier first');
        return;
      }
      const path = findPath(this.state, sel.id, t);
      if (!path) {
        this.say('No path there');
        return;
      }
      const cost = pathCost(sel.pos, path);
      if (cost > sel.ap) {
        this.say(`Need ${cost} AP, have ${sel.ap}`);
        return;
      }
      this.moveAlong(sel.id, path);
      return;
    }

    if (!sel) {
      this.say('Select a soldier first');
      return;
    }
    const mode = this.ui.mode;
    this.ui.mode = 'move';
    if (mode === 'snap' || mode === 'aimed') {
      if (!clicked || clicked.side !== 'enemy') {
        this.say('Click an enemy');
        return;
      }
      this.run({
        type: mode === 'snap' ? 'SnapShot' : 'AimedShot',
        unitId: sel.id,
        targetId: clicked.id,
      });
    } else if (mode === 'throw') {
      this.run({ type: 'Throw', unitId: sel.id, at: t });
    } else if (mode === 'door') {
      const tile = this.state.tiles[t.y][t.x];
      this.run({ type: tile.open ? 'CloseDoor' : 'OpenDoor', unitId: sel.id, at: t });
    }
  }

  moveAlong(unitId: string, path: Pos[]): void {
    this.ui.busy = true;
    const step = (i: number) => {
      if (i >= path.length || this.state.status !== 'playing') {
        this.ui.busy = false;
        return;
      }
      if (!this.run({ type: 'Move', unitId, to: path[i] })) {
        this.ui.busy = false;
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
    const w = WEAPONS[sel.weapon];
    const hint: Record<Mode, string> = {
      move: '',
      snap: `Snap shot, ${w.snapAp} AP: click an enemy`,
      aimed: `Aimed shot, ${w.aimedAp} AP: click an enemy`,
      throw: 'Grenade, 24 AP: click a tile',
      door: 'Door, 2 AP: click an adjacent door',
    };
    this.say(hint[mode], 4000);
    this.updatePreview();
  }

  pressButton(id: ButtonId): void {
    switch (id) {
      case 'snap': this.setMode('snap'); break;
      case 'aimed': this.setMode('aimed'); break;
      case 'throw': this.setMode('throw'); break;
      case 'door': this.setMode('door'); break;
      case 'pickup': this.pickup(); break;
      case 'end': this.endTurn(); break;
    }
  }

  private pickup(): void {
    const sel = this.selected();
    if (!sel || !this.canAct()) return;
    const item = this.state.items.find((i) => posEq(i.pos, sel.pos));
    if (!item) {
      this.say('Nothing to pick up here');
      return;
    }
    this.run({ type: 'PickUp', unitId: sel.id, itemId: item.id });
  }

  cancel(): void {
    this.ui.mode = 'move';
    this.updatePreview();
  }

  endTurn(): void {
    if (!this.canAct()) return;
    if (!this.run({ type: 'EndTurn' })) return;
    this.ui.mode = 'move';
    this.ui.busy = true;
    setTimeout(this.enemyStep, ENEMY_STEP_MS);
  }

  private enemyStep = (): void => {
    if (this.state.status !== 'playing' || this.state.turn !== 'enemy') {
      this.ui.busy = false;
      return;
    }
    this.run(aiNextCommand(this.state));
    setTimeout(this.enemyStep, ENEMY_STEP_MS);
  };

  key(k: string): boolean {
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower >= '1' && lower <= '4' && lower.length === 1) {
      const target = this.state.units.find((u) => u.id === `p${lower}` && u.alive);
      if (target && this.canAct()) {
        this.ui.selectedId = target.id;
        this.updatePreview();
      }
      return true;
    }
    switch (lower) {
      case 's': this.setMode('snap'); return true;
      case 'a': this.setMode('aimed'); return true;
      case 't': this.setMode('throw'); return true;
      case 'd': this.setMode('door'); return true;
      case 'p': this.pickup(); return true;
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
      case 'Tab': {
        const squad = this.squad();
        const i = squad.findIndex((u) => u.id === this.ui.selectedId);
        if (squad.length > 0 && this.canAct()) this.ui.selectedId = squad[(i + 1) % squad.length].id;
        return true;
      }
      default:
        return false;
    }
  }
}
