import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VOLUME, soundsFor } from '../src/audio/mapping';
import { Controller } from '../src/controller';
import type { GameEvent } from '../src/core/types';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { drawPanel } from '../src/render/panel';
import { onText } from '../src/ui/text';
import { corridorRows, makeState, seedForCrit, seedForRoll, unit } from './helpers';

beforeEach(() => vi.useFakeTimers());

const at = { x: 3, y: 1 };
const shot = (crit: boolean, hit = true): GameEvent => ({
  type: 'shot', unitId: 'p1', targetId: 'e1', mode: 'snap', hit, crit, damage: hit ? 45 : 0, from: { x: 1, y: 1 }, impact: at,
});

describe('crit effects and sound', () => {
  it('a critical hit draws a double-size spark and a yellow flash on the target tile', () => {
    const fx = new Effects();
    fx.add([shot(true)], 1000);
    const frames = fx.frames(1150);
    expect(frames.some((f) => f.type === 'sprite' && f.name === 'spark' && f.scale === 2)).toBe(true);
    expect(frames.some((f) => f.type === 'rect' && f.x === 48 && f.y === 16 && f.color === '255,225,77')).toBe(true);
  });

  it('a normal hit has neither', () => {
    const normal = new Effects();
    normal.add([shot(false)], 1000);
    const frames = normal.frames(1150);
    expect(frames.some((f) => f.type === 'sprite' && f.scale === 2)).toBe(false);
    expect(frames.some((f) => f.type === 'rect' && f.color === '255,225,77')).toBe(false);
  });

  it('a crit adds the crit sound to the shot and thud when audible, and nothing when it is not', () => {
    const s = makeState(corridorRows('P..E'));
    const loud = soundsFor(shot(true), s, true).map((h) => h.name);
    expect(loud).toEqual(['rifle', 'hit', 'crit']);
    expect(soundsFor(shot(true), s, true).at(-1)).toEqual({ name: 'crit', volume: VOLUME.impact });
    expect(soundsFor(shot(true), s, false).map((h) => h.name)).toEqual(['rifle']);
    expect(soundsFor(shot(false), s, true).map((h) => h.name)).toEqual(['rifle', 'hit']);
  });
});

describe('crit messages and the scope tag', () => {
  function duel() {
    const state = makeState(corridorRows('P..EE')); // two enemies, so killing e1 does not end the mission
    unit(state, 'p1').facing = 2;
    state.rngState = seedForRoll((n) => n < 0.05);
    state.critState = seedForCrit((n) => n < 0.01);
    return { state, c: new Controller(state, createUiState('p1'), new Effects()) };
  }

  it('says CRITICAL HIT with the damage when your soldier crits', () => {
    const { c } = duel();
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(c.ui.message).toBe('CRITICAL HIT: 45 DAMAGE');
  });

  it('says ENEMY CRITICAL HIT when an enemy crits a soldier, with the damage after armour', () => {
    const { state, c } = duel();
    state.turn = 'enemy';
    const p = unit(state, 'p1');
    p.hp = p.maxHp = 100;
    p.gadget = 'armour';
    c.run({ type: 'SnapShot', unitId: 'e1', targetId: 'p1' });
    expect(c.ui.message).toBe('ENEMY CRITICAL HIT: 32 DAMAGE');
  });

  it('a normal hit sets no crit message', () => {
    const { state, c } = duel();
    state.critState = seedForCrit((n) => n >= 0.5);
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(c.ui.message).not.toMatch(/CRITICAL/);
  });

  it('the panel shows a SCOPE tag on the name line only for a scoped soldier', () => {
    const run = (scope: boolean) => {
      const state = makeState(corridorRows('P..E'));
      unit(state, 'p1').attachment = scope ? 'scope' : null;
      const runs: { text: string; x: number; y: number }[] = [];
      const stop = onText((r) => runs.push(r));
      const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
      drawPanel(ctx, state, createUiState('p1'), 0);
      stop();
      return runs;
    };
    const tag = run(true).find((r) => r.text === 'SCOPE');
    expect(tag).toMatchObject({ x: 108, y: 328 });
    expect(run(false).some((r) => r.text === 'SCOPE')).toBe(false);
  });
});
