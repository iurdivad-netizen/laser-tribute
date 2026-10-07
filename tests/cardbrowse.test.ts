import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { createMission } from '../src/core/missions';
import { soldierCard } from '../src/core/stats';
import { squadAt } from '../src/render/panel';
import { makeState, unit } from './helpers';

function inMission() {
  let t = 0;
  const app = new App({
    clock: () => t,
    skipTitle: true,
    store: null,
    createMission: (def, seed, roster, loadout, budget, stash) => createMission(def, seed, roster, loadout, budget, stash),
  });
  app.click({ x: 240, y: 345 });
  t += 500;
  return app;
}
const centre = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe('browsing soldiers on the card', () => {
  it('Tab and Shift+Tab move to the next and the previous soldier with the card open', () => {
    const app = inMission();
    const c = app.controller!;
    expect(c.ui.selectedId).toBe('p1');
    app.key('i');
    app.key('Tab');
    expect(c.ui.selectedId).toBe('p2');
    expect(c.ui.card).toBe(true);
    app.key('Tab');
    expect(c.ui.selectedId).toBe('p3');
    app.key('Shift+Tab');
    expect(c.ui.selectedId).toBe('p2');
    app.key('Shift+Tab');
    app.key('Shift+Tab');
    expect(c.ui.selectedId).toBe('p4'); // wraps around
    expect(c.ui.card).toBe(true);
  });

  it('the number keys pick a soldier, and the card stays', () => {
    const app = inMission();
    const c = app.controller!;
    app.key('i');
    app.key('3');
    expect(c.ui.selectedId).toBe('p3');
    expect(c.ui.card).toBe(true);
  });

  it('skips a dead soldier', () => {
    const app = inMission();
    const c = app.controller!;
    c.state.units.find((u) => u.id === 'p2')!.alive = false;
    app.key('i');
    app.key('Tab');
    expect(c.ui.selectedId).toBe('p3');
  });

  it('a tap on a squad button switches the card to that soldier; any other tap closes it', () => {
    const app = inMission();
    const c = app.controller!;
    app.key('i');
    const strip = app.layout.squad[2];
    expect(squadAt(app.layout, centre(strip).x, centre(strip).y)).toBe(2);
    app.click(centre(strip));
    expect(c.ui.selectedId).toBe('p3');
    expect(c.ui.card).toBe(true);
    app.click({ x: 10, y: 10 });
    expect(c.ui.card).toBe(false);
  });

  it('other game keys are still ignored while it is open', () => {
    const app = inMission();
    const c = app.controller!;
    app.key('i');
    app.key('s');
    expect(c.ui.mode).toBe('move');
  });

  it('a held I does not flicker the card', () => {
    const app = inMission();
    const c = app.controller!;
    app.key('i', true);
    expect(c.ui.card).toBe(false);
    app.key('i');
    app.key('i', true);
    expect(c.ui.card).toBe(true);
  });

  it('names the soldier on the card', () => {
    const s = makeState(['#####', '#P.E#', '#####']);
    const p = unit(s, 'p1');
    p.name = 'Alvarez';
    expect(soldierCard(p)[0].rows[0]).toEqual(['NAME', 'ALVAREZ']);
  });
});
