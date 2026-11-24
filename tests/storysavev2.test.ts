import { describe, expect, it } from 'vitest';
import { defaultLoadout } from '../src/core/loadout';
import { CAPITAL_GATES } from '../src/core/world/planet';
import { nextScene } from '../src/core/world/story';
import { newWorld, type World } from '../src/core/world/world';
import { parseStory } from '../src/storysave';

/** A version 2 story save exactly as project 2 wrote it: no scene record. */
function v2(patch: Partial<World> = {}) {
  const { seen: _s, chosen: _c, ...rest } = { ...newWorld(7, 'standard'), ...patch };
  return { version: 2, world: rest, loadout: defaultLoadout() };
}

describe('version 2 story saves', () => {
  it('load with the scenes that already hold marked as seen', () => {
    const w = parseStory(JSON.stringify(v2()))!.world;
    expect(w.seen).toEqual(['landing']);
    expect(w.chosen).toEqual({});
  });

  it('do not replay a past with the citadel open and a death', () => {
    const base = newWorld(7, 'standard');
    const regions = base.regions.map((r, i) => (CAPITAL_GATES.slice(0, 2).includes(i) ? { ...r, holder: 'player' as const } : r));
    const w = parseStory(JSON.stringify(v2({
      regions,
      fallen: [{ name: 'Brandt', kills: 1, trained: 0 }],
      soldiers: base.soldiers.filter((x) => x.name !== 'Brandt'),
      squad: ['Alvarez', 'Chen', 'Dubois'],
      namesUsed: 4,
    })))!.world;
    expect(w.seen).toEqual(expect.arrayContaining(['landing', 'first-blood', 'memorial-Brandt', 'citadel-open', 'deserter']));
    expect(nextScene(w)).toBeNull();
    expect(w.chosen).toEqual({});
  });
});

describe('version 1 story saves and scenes', () => {
  it('also start with the past marked as seen', () => {
    const w = newWorld(7, 'standard');
    const { credits: _c, research: _r, soldiers, squad: _s, seen: _se, chosen: _ch, ...rest } = w;
    const roster = soldiers.map((s) => ({ name: s.name, kills: s.kills }));
    const loaded = parseStory(JSON.stringify({ version: 1, world: { ...rest, roster }, loadout: defaultLoadout() }))!.world;
    expect(loaded.seen).toEqual(['landing']);
  });
});
