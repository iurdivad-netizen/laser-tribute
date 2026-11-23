import { describe, expect, it } from 'vitest';
import { unlocksOf } from '../src/core/world/base';
import { canResearch, researchOptions, startResearch } from '../src/core/world/research';
import { advance, newWorld } from '../src/core/world/world';

const fresh = () => newWorld(1, 'calm');

describe('starting research', () => {
  it('spends the credits and starts a project with its days', () => {
    const next = startResearch(fresh(), 'shotgun');
    expect(next.credits).toBe(110);
    expect(next.research.active).toEqual({ node: 'shotgun', daysLeft: 4 });
  });

  it('allows only one project at a time', () => {
    const next = startResearch(fresh(), 'shotgun');
    expect(canResearch(next, 'smoke')).toBe(false);
    expect(() => startResearch(next, 'smoke')).toThrow('cannot research smoke');
  });

  it('needs the prerequisites, enough credits, and a node that is not done', () => {
    const w = fresh();
    expect(canResearch(w, 'smg')).toBe(false); // needs shotgun
    expect(canResearch({ ...w, credits: 39 }, 'shotgun')).toBe(false);
    expect(canResearch({ ...w, research: { done: ['shotgun'], active: null } }, 'shotgun')).toBe(false);
    expect(canResearch(w, 'warp-drive')).toBe(false);
    expect(canResearch({ ...w, status: 'won' }, 'shotgun')).toBe(false);
  });

  it('leaves the world untouched when a start is refused', () => {
    const w = fresh();
    const before = JSON.parse(JSON.stringify(w));
    expect(() => startResearch(w, 'smg')).toThrow();
    expect(JSON.parse(JSON.stringify(w))).toEqual(before);
  });

  it('is not undone by waiting: the credits are gone for good', () => {
    const next = advance(startResearch(fresh(), 'shotgun'), 1);
    expect(next.research.active?.daysLeft).toBe(3);
    expect(next.credits).toBe(110 + 4);
  });
});

describe('research options', () => {
  it('lists every affordable root of the tree in table order on a new world', () => {
    expect(researchOptions(fresh())).toEqual([
      'shotgun', 'smoke', 'armour', 'scanner', 'scope', 'beds1', 'labs1', 'contracts1', 'hospital1', 'training1',
    ]);
  });

  it('is empty while a project runs, and opens the next node once its prerequisite is done', () => {
    const running = startResearch(fresh(), 'shotgun');
    expect(researchOptions(running)).toEqual([]);
    const finished = advance(running, 4);
    expect(finished.research.done).toEqual(['shotgun']);
    expect(researchOptions({ ...finished, credits: 500 })).toContain('smg');
    expect(unlocksOf(finished.research.done).weapons).toContain('shotgun');
  });

  it('shortens a project with labs built', () => {
    const w = { ...fresh(), credits: 500, research: { done: ['labs1'], active: null } };
    expect(startResearch(w, 'scanner').research.active?.daysLeft).toBe(3); // ceil(4 * 0.75)
  });
});
