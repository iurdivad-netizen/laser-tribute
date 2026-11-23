import { describe, expect, it } from 'vitest';
import { defaultLoadout } from '../src/core/loadout';
import { BASE_RULES } from '../src/core/world/base';
import { REGIONS } from '../src/core/world/planet';
import { newWorld } from '../src/core/world/world';
import { parseStory } from '../src/storysave';

/** A version 1 story save exactly as project 1 wrote it (a roster of four, no base fields). */
function v1() {
  const w = newWorld(7, 'standard');
  const { credits: _c, research: _r, soldiers, squad: _s, ...rest } = w;
  const roster = soldiers.map((s) => ({ name: s.name, kills: s.kills }));
  return { version: 1, world: { ...rest, roster }, loadout: defaultLoadout() };
}

describe('version 1 story saves', () => {
  it('load into a valid version 2 world with defaults', () => {
    const save = parseStory(JSON.stringify(v1()));
    expect(save).not.toBeNull();
    const w = save!.world;
    expect(w.credits).toBe(BASE_RULES.startCredits);
    expect(w.research).toEqual({ done: [], active: null });
    expect(w.soldiers.map((s) => s.name)).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(w.soldiers.every((s) => s.status === 'ready' && s.trained === 0 && s.daysLeft === 0)).toBe(true);
    expect(w.squad).toEqual(['Alvarez', 'Brandt', 'Chen', 'Dubois']);
    expect(w.regions).toHaveLength(REGIONS.length);
    expect(w.seed).toBe(7);
    expect(w.difficulty).toBe('standard');
  });

  it('keeps veterans\' kills', () => {
    const o = v1();
    o.world.roster[1].kills = 6;
    expect(parseStory(JSON.stringify(o))!.world.soldiers[1].kills).toBe(6);
  });

  it('still rejects a corrupt version 1 save', () => {
    const o = v1();
    o.world.roster.pop();
    expect(parseStory(JSON.stringify(o))).toBeNull();
    const p = v1();
    p.world.planetVersion = 99;
    expect(parseStory(JSON.stringify(p))).toBeNull();
  });
});
