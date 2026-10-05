import { describe, expect, it } from 'vitest';
import { VOLUME, soundsFor } from '../src/audio/mapping';
import type { GameEvent } from '../src/core/types';
import { corridorRows, makeState, unit } from './helpers';

const state = () => makeState(corridorRows('P..E'));
const at = { x: 2, y: 1 };
const shot = (hit: boolean, unitId = 'p1', targetId = 'e1'): GameEvent => ({
  type: 'shot', unitId, targetId, mode: 'snap', hit, crit: false, damage: hit ? 30 : 0, from: { x: 1, y: 1 }, impact: at,
});

describe('soundsFor: shots', () => {
  it('a visible rifle hit is the rifle then a thud', () => {
    expect(soundsFor(shot(true), state(), true)).toEqual([
      { name: 'rifle', volume: 1 },
      { name: 'hit', volume: 0.8 },
    ]);
  });

  it('a visible pistol miss is the pistol then a ricochet', () => {
    const s = state();
    unit(s, 'p1').weapon = 'pistol';
    expect(soundsFor(shot(false), s, true)).toEqual([
      { name: 'pistol', volume: 1 },
      { name: 'ricochet', volume: 0.8 },
    ]);
  });

  it('out of sight only the gunshot is heard, quietly', () => {
    expect(soundsFor(shot(true, 'e1', 'p1'), state(), false)).toEqual([{ name: 'rifle', volume: 0.35 }]);
  });
});

describe('soundsFor: other events', () => {
  it('a stab hit is the stab then a thud; a miss is only the stab', () => {
    const stab = (hit: boolean): GameEvent => ({
      type: 'stab', unitId: 'p1', targetId: 'e1', hit, damage: hit ? 60 : 0, from: { x: 1, y: 1 }, at,
    });
    expect(soundsFor(stab(true), state(), true)).toEqual([
      { name: 'stab', volume: 1 },
      { name: 'hit', volume: 0.8 },
    ]);
    expect(soundsFor(stab(false), state(), true)).toEqual([{ name: 'stab', volume: 1 }]);
    expect(soundsFor(stab(true), state(), false)).toEqual([]);
  });

  it('a grenade is an explosion, quieter out of sight', () => {
    const ev: GameEvent = { type: 'grenade', unitId: 'p1', at, hits: [], doorsDestroyed: [] };
    expect(soundsFor(ev, state(), true)).toEqual([{ name: 'explosion', volume: 1 }]);
    expect(soundsFor(ev, state(), false)).toEqual([{ name: 'explosion', volume: 0.35 }]);
  });

  it('a death sounds different for a soldier and an enemy, quieter out of sight', () => {
    const died = (unitId: string): GameEvent => ({ type: 'died', unitId, at });
    expect(soundsFor(died('p1'), state(), true)).toEqual([{ name: 'deathSoldier', volume: 1 }]);
    expect(soundsFor(died('e1'), state(), true)).toEqual([{ name: 'deathEnemy', volume: 1 }]);
    expect(soundsFor(died('e1'), state(), false)).toEqual([{ name: 'deathEnemy', volume: 0.35 }]);
  });

  it('a door is heard far away, quietly', () => {
    const ev: GameEvent = { type: 'doorChanged', at, open: true };
    expect(soundsFor(ev, state(), true)).toEqual([{ name: 'door', volume: 1 }]);
    expect(soundsFor(ev, state(), false)).toEqual([{ name: 'door', volume: 0.35 }]);
  });

  it('footsteps are very quiet and only when audible', () => {
    const ev: GameEvent = { type: 'moved', unitId: 'p1', from: { x: 1, y: 1 }, to: at };
    expect(soundsFor(ev, state(), true)).toEqual([{ name: 'step', volume: 0.25 }]);
    expect(soundsFor(ev, state(), false)).toEqual([]);
  });

  it('reload, pickup and alert-on play only when audible; alert-off never plays', () => {
    const reloaded: GameEvent = { type: 'reloaded', unitId: 'p1', ammo: 5, at };
    const picked: GameEvent = { type: 'pickedUp', unitId: 'p1', itemId: 'i1', kind: 'rifle' };
    const on: GameEvent = { type: 'alert', unitId: 'p1', on: true };
    const off: GameEvent = { type: 'alert', unitId: 'p1', on: false };
    expect(soundsFor(reloaded, state(), true)).toEqual([{ name: 'reload', volume: 1 }]);
    expect(soundsFor(picked, state(), true)).toEqual([{ name: 'pickup', volume: 1 }]);
    expect(soundsFor(on, state(), true)).toEqual([{ name: 'alert', volume: 1 }]);
    for (const ev of [reloaded, picked, on]) expect(soundsFor(ev, state(), false)).toEqual([]);
    expect(soundsFor(off, state(), true)).toEqual([]);
  });

  it('the end of the mission plays a jingle regardless of sight', () => {
    expect(soundsFor({ type: 'gameOver', winner: 'player' }, state(), false)).toEqual([{ name: 'win', volume: 0.9 }]);
    expect(soundsFor({ type: 'gameOver', winner: 'enemy' }, state(), false)).toEqual([{ name: 'lose', volume: 0.9 }]);
  });

  it('turns and turn changes are silent', () => {
    expect(soundsFor({ type: 'turned', unitId: 'p1', facing: 2 }, state(), true)).toEqual([]);
    expect(soundsFor({ type: 'turnEnded', side: 'player' }, state(), true)).toEqual([]);
  });

  it('exposes the volume levels', () => {
    expect(VOLUME).toEqual({ full: 1, far: 0.35, step: 0.25, impact: 0.8, ui: 0.9 });
  });
});

describe('gadget sounds', () => {
  it('a heal chimes at full volume when audible, quietly otherwise; a scan pings only for the player', () => {
    const s = state();
    const heal = { type: 'healed', unitId: 'p1', targetId: 'p2', amount: 25, at } as const;
    expect(soundsFor(heal, s, true)).toEqual([{ name: 'heal', volume: 1 }]);
    expect(soundsFor(heal, s, false)).toEqual([{ name: 'heal', volume: 0.35 }]);
    const scan: GameEvent = { type: 'scanned', unitId: 'p1', found: [] };
    expect(soundsFor(scan, s, true)).toEqual([{ name: 'scan', volume: 1 }]);
    expect(soundsFor(scan, s, false)).toEqual([]);
  });
});
