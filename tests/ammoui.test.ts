import { describe, expect, it } from 'vitest';
import { Controller } from '../src/controller';
import { CONFIG } from '../src/core/config';
import { createUiState } from '../src/input/uiState';
import { Effects } from '../src/render/effects';
import { actionBlocked, actionCost } from '../src/render/panel';
import { corridorRows, makeState, unit } from './helpers';

function make(inner = 'P..E') {
  return new Controller(makeState(corridorRows(inner)), createUiState('p1'), new Effects());
}

describe('reload in the controller', () => {
  it('R reloads the selected soldier at once', () => {
    const c = make();
    unit(c.state, 'p1').ammo = 1;
    expect(c.key('r')).toBe(true);
    expect(unit(c.state, 'p1')).toMatchObject({ ammo: 5, clips: 0, ap: 45 });
    expect(c.ui.message).toBe('P1 reloaded');
  });

  it('the LOAD button does the same', () => {
    const c = make();
    unit(c.state, 'p1').ammo = 2;
    c.pressButton('reload');
    expect(unit(c.state, 'p1').ammo).toBe(5);
  });

  it('says why a reload is refused', () => {
    const c = make();
    c.key('r');
    expect(c.ui.message).toBe('Magazine is already full');
    unit(c.state, 'p1').ammo = 0;
    unit(c.state, 'p1').clips = 0;
    c.key('r');
    expect(c.ui.message).toBe('No spare clips');
  });

  it('a refused shot says Out of ammo', () => {
    const c = make();
    unit(c.state, 'p1').ammo = 0;
    c.key('s');
    c.clickTile({ x: 4, y: 1 });
    expect(c.ui.message).toBe('Out of ammo');
    expect(unit(c.state, 'p1').ap).toBe(60);
  });
});

describe('panel ammo helpers', () => {
  it('reload costs 15 AP', () => {
    const s = makeState(corridorRows('P..E'));
    expect(actionCost(unit(s, 'p1'), 'reload')).toBe(CONFIG.reloadAp);
  });

  it('marks buttons the soldier cannot use right now', () => {
    const s = makeState(corridorRows('P..E'));
    const p = unit(s, 'p1');
    expect(actionBlocked(p, 'reload')).toBe(true); // magazine full
    p.ammo = 2;
    expect(actionBlocked(p, 'reload')).toBe(false);
    p.ap = 14;
    expect(actionBlocked(p, 'reload')).toBe(true);
    p.ap = 60;
    p.clips = 0;
    expect(actionBlocked(p, 'reload')).toBe(true); // no clips
    p.ammo = 0;
    expect(actionBlocked(p, 'snap')).toBe(true); // empty gun
    expect(actionBlocked(p, 'stab')).toBe(false); // the knife needs no ammo
    expect(actionBlocked(p, 'end')).toBe(false);
  });
});

describe('reload effect', () => {
  it('flashes at the soldier when a reloaded event arrives', () => {
    const fx = new Effects();
    fx.add([{ type: 'reloaded', unitId: 'p1', ammo: 5, at: { x: 1, y: 1 } }], 0);
    let fills = 0;
    const ctx = {
      fillRect() { fills += 1; },
      set fillStyle(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
    fx.draw(ctx, 50);
    expect(fills).toBe(1);
    fills = 0;
    fx.draw(ctx, 5000);
    expect(fills).toBe(0);
  });
});
