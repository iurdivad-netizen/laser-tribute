import { describe, expect, it } from 'vitest';
import type { SoundName } from '../src/audio/effects';
import type { SoundPlayer } from '../src/audio/sound';
import { Controller } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { corridorRows, makeState, seedForRoll, unit } from './helpers';

class RecordingSound implements SoundPlayer {
  played: { name: SoundName; volume: number }[] = [];
  muted = false;
  volume = 0.5;
  play(name: SoundName, volume = 1) { this.played.push({ name, volume }); }
  unlock() {}
  toggleMute() { return ''; }
  changeVolume() { return ''; }
  names() { return this.played.map((p) => p.name); }
}

function make(rows: string[], seed?: number) {
  const s = makeState(rows);
  if (seed !== undefined) s.rngState = seed;
  const sound = new RecordingSound();
  return { c: new Controller(s, createUiState('p1'), new Effects(), sound), sound };
}

describe('controller sounds', () => {
  it('a visible rifle kill plays the shot, the thud, the death and the win jingle in order', () => {
    const { c, sound } = make(corridorRows('P..E'), seedForRoll((n) => n < 0.05));
    unit(c.state, 'e1').hp = 30; // one rifle hit (30 damage) kills
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(sound.played).toEqual([
      { name: 'rifle', volume: 1 },
      { name: 'hit', volume: 0.8 },
      { name: 'deathEnemy', volume: 1 },
      { name: 'win', volume: 0.9 },
    ]);
  });

  it('a refused shot with an empty gun plays the dry click, once', () => {
    const { c, sound } = make(corridorRows('P..E'));
    unit(c.state, 'p1').ammo = 0;
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(sound.played).toEqual([{ name: 'empty', volume: 0.9 }]);
  });

  it('any other rejected command plays the error buzz, once', () => {
    const { c, sound } = make(corridorRows('P..E'));
    expect(c.run({ type: 'Reload', unitId: 'p1' })).toBe(false); // the magazine is already full
    expect(sound.played).toEqual([{ name: 'error', volume: 0.9 }]);
  });

  it('a successful command never plays the error buzz', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.key('q'); // turn left: no sound
    unit(c.state, 'p1').ammo = 1;
    c.key('r'); // reload
    expect(sound.names()).toEqual(['reload']);
  });

  it('the player own pickup is audible even though the visibility test ignores it', () => {
    const { c, sound } = make(corridorRows('P..E'));
    const p = unit(c.state, 'p1');
    p.weapon = 'pistol';
    c.state.items.push({ id: 'i1', pos: { ...p.pos }, kind: 'rifle' });
    c.key('p');
    expect(sound.played).toEqual([{ name: 'pickup', volume: 1 }]);
  });

  it('going on alert makes the alert sound', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.key('l');
    expect(sound.played).toEqual([{ name: 'alert', volume: 1 }]);
  });

  it('a door opened by an enemy out of sight is heard quietly', () => {
    const s = makeState(corridorRows('P....E+.'));
    unit(s, 'p1').facing = 6; // facing west: the door behind him is out of sight
    s.turn = 'enemy';
    const sound = new RecordingSound();
    const c = new Controller(s, createUiState('p1'), new Effects(), sound);
    expect(c.run({ type: 'OpenDoor', unitId: 'e1', at: { x: 7, y: 1 } })).toBe(true);
    expect(sound.played).toEqual([{ name: 'door', volume: 0.35 }]);
  });

  it('out-of-sight enemy footsteps are silent', () => {
    const s = makeState(corridorRows('P...E.'));
    unit(s, 'p1').facing = 6;
    s.turn = 'enemy';
    const sound = new RecordingSound();
    const c = new Controller(s, createUiState('p1'), new Effects(), sound);
    expect(c.run({ type: 'Move', unitId: 'e1', to: { x: 4, y: 1 } })).toBe(true);
    expect(sound.played).toEqual([]);
  });

  it('works without a sound player', () => {
    const c = new Controller(makeState(corridorRows('P..E')), createUiState('p1'), new Effects());
    expect(() => { c.key('q'); c.run({ type: 'Reload', unitId: 'p1' }); }).not.toThrow();
  });
});

describe('refusals made by the interface also buzz', () => {
  it('a move that costs more AP than the soldier has', () => {
    const { c, sound } = make(corridorRows('P......E'));
    unit(c.state, 'p1').ap = 4;
    c.clickTile({ x: 6, y: 1 });
    expect(c.ui.message).toMatch(/Need .* AP/);
    expect(sound.played).toEqual([{ name: 'error', volume: 0.9 }]);
  });

  it('a click with no path', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.clickTile({ x: 0, y: 0 }); // a wall
    expect(c.ui.message).toBe('No path there');
    expect(sound.names()).toEqual(['error']);
  });

  it('choosing a target that is not an enemy', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.key('s');
    c.clickTile({ x: 2, y: 1 }); // empty floor
    expect(c.ui.message).toBe('Click an enemy');
    c.key('k');
    c.clickTile({ x: 2, y: 1 });
    expect(c.ui.message).toBe('Click an adjacent enemy');
    expect(sound.names()).toEqual(['error', 'error']);
  });

  it('pressing pick up with nothing underfoot', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.key('p');
    expect(c.ui.message).toBe('Nothing to pick up here');
    expect(sound.names()).toEqual(['error']);
  });

  it('a successful move, "Enemy spotted" and "Your turn" stay silent', () => {
    const { c, sound } = make(corridorRows('P..E'));
    c.clickTile({ x: 2, y: 1 }); // a valid one-step move (a footstep sounds, but no error buzz)
    expect(sound.names()).not.toContain('error');
  });

  it('a rejected command during the enemy turn does not buzz', () => {
    const s = makeState(corridorRows('P..E'));
    s.turn = 'enemy';
    const sound = new RecordingSound();
    const c = new Controller(s, createUiState('p1'), new Effects(), sound);
    expect(c.run({ type: 'Reload', unitId: 'e1' })).toBe(false); // full magazine
    expect(sound.played).toEqual([]);
  });
});

