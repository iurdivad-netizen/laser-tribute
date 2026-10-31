import { describe, expect, it } from 'vitest';
import { App } from '../src/app';
import { computeVisible, visibleGrid } from '../src/core/vision';
import { corridorRows, makeState } from './helpers';

describe('visibleGrid', () => {
  it('has the same cells as computeVisible', () => {
    const s = makeState(corridorRows('P....E'));
    expect(visibleGrid(s, 'player')).toEqual(computeVisible(s, 'player'));
    expect(visibleGrid(s, 'enemy')).toEqual(computeVisible(s, 'enemy'));
  });

  it('works out each state once and asks again for a new state', () => {
    const s = makeState(corridorRows('P....E'));
    expect(visibleGrid(s, 'player')).toBe(visibleGrid(s, 'player'));
    expect(visibleGrid(s, 'player')).not.toBe(visibleGrid(s, 'enemy'));
    const next = structuredClone(s);
    expect(visibleGrid(next, 'player')).not.toBe(visibleGrid(s, 'player'));
  });
});

describe('needsFrame', () => {
  function started() {
    let t = 0;
    const app = new App({ clock: () => t, skipTitle: true });
    return { app, at: (ms: number) => { t = ms; } };
  }

  it('a still screen is drawn only on the slow beat', () => {
    const { app, at } = started();
    at(5000);
    expect(app.needsFrame(5000)).toBe(true); // the first frame
    expect(app.needsFrame(5016)).toBe(false);
    expect(app.needsFrame(5240)).toBe(false);
    expect(app.needsFrame(5251)).toBe(true); // the beat is due
    expect(app.needsFrame(5267)).toBe(false);
  });

  it('input wakes it for a while, then it goes back to the beat', () => {
    const { app, at } = started();
    at(5000);
    app.needsFrame(5000);
    app.move({ x: 10, y: 10 });
    expect(app.needsFrame(5016)).toBe(true);
    expect(app.needsFrame(5032)).toBe(true);
    at(7000);
    app.needsFrame(7000);
    expect(app.needsFrame(7016)).toBe(false);
  });
});
