import { describe, expect, it } from 'vitest';
import { Controller } from '../src/controller';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { corridorRows, makeState, seedForRoll, unit } from './helpers';

function make(inner: string, seeded = true) {
  const s = makeState(corridorRows(inner));
  if (seeded) s.rngState = seedForRoll((n) => n < 0.9); // the first roll is a knife hit
  return new Controller(s, createUiState('p1'), new Effects());
}

describe('stab in the controller', () => {
  it('K enters stab mode with a hint', () => {
    const c = make('PE');
    expect(c.key('k')).toBe(true);
    expect(c.ui.mode).toBe('stab');
    expect(c.ui.message).toMatch(/Stab, 20 AP/);
  });

  it('clicking an adjacent enemy stabs it and returns to move mode', () => {
    const c = make('PE');
    c.key('k');
    c.clickTile({ x: 2, y: 1 });
    expect(c.state.units.find((u) => u.id === 'e1')!.alive).toBe(false);
    expect(unit(c.state, 'p1').ap).toBe(40);
    expect(c.ui.mode).toBe('move');
  });

  it('the STAB button does the same as the key', () => {
    const c = make('PE');
    c.pressButton('stab');
    expect(c.ui.mode).toBe('stab');
  });

  it('clicking an enemy two tiles away says it needs an adjacent enemy and spends nothing', () => {
    const c = make('P.E');
    c.key('k');
    c.clickTile({ x: 3, y: 1 });
    expect(c.ui.message).toBe('Stab needs an adjacent enemy');
    expect(unit(c.state, 'p1').ap).toBe(60);
    expect(c.ui.mode).toBe('move');
  });

  it('clicking an empty tile says to click an adjacent enemy', () => {
    const c = make('P.E');
    c.key('k');
    c.clickTile({ x: 2, y: 1 });
    expect(c.ui.message).toBe('Click an adjacent enemy');
    expect(c.ui.mode).toBe('move');
  });

  it('Escape leaves stab mode', () => {
    const c = make('PE');
    c.key('k');
    c.key('Escape');
    expect(c.ui.mode).toBe('move');
  });
});

describe('stab effects', () => {
  it('shows a slash for a stab event and removes it afterwards', () => {
    const fx = new Effects();
    fx.add(
      [{ type: 'stab', unitId: 'p1', targetId: 'e1', hit: true, damage: 60, from: { x: 1, y: 1 }, at: { x: 2, y: 1 } }],
      0,
    );
    expect(fx.frames(50).some((d) => d.type === 'sprite' && d.name.startsWith('slash'))).toBe(true);
    expect(fx.frames(5000)).toEqual([]);
  });
});
