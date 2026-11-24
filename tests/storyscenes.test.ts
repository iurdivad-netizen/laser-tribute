import { describe, expect, it } from 'vitest';
import { ORIGINALS, choose, nextScene, see, speakerFor, type Scene } from '../src/core/world/story';
import { newWorld, type World } from '../src/core/world/world';

const line = (text = 'x') => ({ by: ['Alvarez'], text });
const scene = (id: string, when: (w: World) => boolean = () => true, extra: Partial<Scene> = {}): Scene => ({
  id, when, lines: [line()], ...extra,
});
const fresh = () => newWorld(1, 'calm');
const withChoice = (effect: object): Scene =>
  scene('c', () => true, {
    choice: [
      { label: 'A', effect: {}, reply: [line()] },
      { label: 'B', effect, reply: [line()] },
    ],
  });

describe('nextScene', () => {
  it('returns the first unseen scene whose trigger holds, in table order', () => {
    const table = [scene('a', () => false), scene('b'), scene('c')];
    expect(nextScene(fresh(), table)?.id).toBe('b');
  });

  it('skips a seen scene and returns null when nothing is pending', () => {
    const table = [scene('a'), scene('b', () => false)];
    const w = see(fresh(), 'a');
    expect(nextScene(w, table)).toBeNull();
    expect(nextScene(fresh(), [scene('x', () => false)])).toBeNull();
  });
});

describe('see', () => {
  it('appends the id once and leaves the input world untouched', () => {
    const w = fresh();
    const before = JSON.parse(JSON.stringify(w));
    const next = see(see(w, 'a'), 'a');
    expect(next.seen).toEqual(['a']);
    expect(JSON.parse(JSON.stringify(w))).toEqual(before);
  });
});

describe('choose', () => {
  it('records the option, marks the scene seen and applies credits and days', () => {
    const w = fresh();
    const next = choose(w, withChoice({ credits: 60, days: 3 }), 1);
    expect(next.chosen).toEqual({ c: 1 });
    expect(next.seen).toEqual(['c']);
    expect(next.day).toBe(w.day + 3);
    expect(next.credits).toBeGreaterThanOrEqual(w.credits + 60);
    expect(w.seen).toEqual([]);
  });

  it('never lets credits go below zero', () => {
    expect(choose(fresh(), withChoice({ credits: -999 }), 1).credits).toBe(0);
  });

  it('adds one stash item', () => {
    const w = fresh();
    expect(choose(w, withChoice({ stash: 'medkit' }), 1).stash.medkit).toBe(w.stash.medkit + 1);
  });

  it('refuses a scene without a choice', () => {
    expect(() => choose(fresh(), scene('p'), 0)).toThrow('scene has no choice');
  });
});

describe('speakerFor', () => {
  it('picks the first preferred name that is in the barracks', () => {
    const w = fresh();
    expect(speakerFor(w, { by: ['Chen', 'Alvarez'], text: '' })).toBe('Chen');
    const noAlvarez = { ...w, soldiers: w.soldiers.filter((s) => s.name !== 'Alvarez') };
    expect(speakerFor(noAlvarez, { by: ['Alvarez', 'Brandt'], text: '' })).toBe('Brandt');
  });

  it('falls back to RECRUIT and never returns a name outside the originals', () => {
    const w = { ...fresh(), soldiers: [{ name: 'Eriksen', kills: 0, trained: 0, status: 'ready' as const, daysLeft: 0 }] };
    expect(speakerFor(w, { by: ['Alvarez', 'Eriksen'], text: '' })).toBe('RECRUIT');
    expect(ORIGINALS).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
  });
});

describe('new world', () => {
  it('starts with no scenes seen and survives a JSON round trip', () => {
    const w = fresh();
    expect(w.seen).toEqual([]);
    expect(w.chosen).toEqual({});
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });
});
