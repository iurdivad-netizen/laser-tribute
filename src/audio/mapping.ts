import type { GameEvent, GameState } from '../core/types';
import type { SoundName } from './effects';

export interface SoundHit {
  name: SoundName;
  volume: number;
}

export const VOLUME = { full: 1, far: 0.35, step: 0.25, impact: 0.8, ui: 0.9 } as const;

const hit = (name: SoundName, volume: number): SoundHit => ({ name, volume });

/**
 * The sounds one game event makes. `audible` is true when the player can see the event or it is one of
 * the player's own soldiers; `state` is the state after the command (to look up a weapon or a side).
 * Gunfire, explosions, doors and deaths out of sight are still heard, quietly.
 */
export function soundsFor(ev: GameEvent, state: GameState, audible: boolean): SoundHit[] {
  const loud = audible ? VOLUME.full : VOLUME.far;
  switch (ev.type) {
    case 'shot': {
      const weapon = state.units.find((u) => u.id === ev.unitId)?.weapon;
      const out = [hit(weapon === 'pistol' || weapon === 'smg' ? 'pistol' : 'rifle', loud)];
      if (audible) out.push(hit(ev.hit ? 'hit' : 'ricochet', VOLUME.impact));
      if (audible && ev.hit && ev.crit) out.push(hit('crit', VOLUME.impact));
      return out;
    }
    case 'stab':
      if (!audible) return [];
      return ev.hit ? [hit('stab', VOLUME.full), hit('hit', VOLUME.impact)] : [hit('stab', VOLUME.full)];
    case 'grenade':
      return [hit('explosion', loud)];
    case 'died': {
      const side = state.units.find((u) => u.id === ev.unitId)?.side;
      return [hit(side === 'player' ? 'deathSoldier' : 'deathEnemy', loud)];
    }
    case 'doorChanged':
      return [hit('door', loud)];
    case 'healed':
      return [hit('heal', loud)];
    case 'scanned':
      return audible ? [hit('scan', VOLUME.full)] : [];
    case 'moved':
      return audible ? [hit('step', VOLUME.step)] : [];
    case 'reloaded':
      return audible ? [hit('reload', VOLUME.full)] : [];
    case 'pickedUp':
      return audible ? [hit('pickup', VOLUME.full)] : [];
    case 'alert':
      return audible && ev.on ? [hit('alert', VOLUME.full)] : [];
    case 'gameOver':
      return [hit(ev.winner === 'player' ? 'win' : 'lose', VOLUME.ui)];
    default:
      return [];
  }
}
