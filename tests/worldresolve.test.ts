import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { createMission } from '../src/core/missions';
import { emptyStash } from '../src/core/stash';
import type { GameState } from '../src/core/types';
import { storyGearRules } from '../src/core/world/base';
import { deployed } from '../src/core/world/barracks';
import { CAPITAL_GATES, CAPITAL_REGION, REGIONS } from '../src/core/world/planet';
import {
  attackable, canAttack, incomePerDay, incomeRegions, missionFor, newWorld, regionsHeld, resolve, visit,
  type Holder, type MissionSpec, type World,
} from '../src/core/world/world';

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});

/** A finished fight for the spec: `dead` lists the indexes of squad members who died; `kills` per soldier. */
function finished(w: World, spec: MissionSpec, status: 'won' | 'lost', dead: number[] = [], kills: number[] = []): GameState {
  const def = generateMission(spec.type, spec.variation, spec.difficulty, true);
  const rules = storyGearRules(w.research.done);
  const s = createMission(def, spec.seed, deployed(w).roster, defaultLoadout(), 999, w.stash, rules, spec.enemyLevel);
  s.units.filter((u) => u.side === 'player').forEach((u, i) => {
    u.alive = !dead.includes(i);
    u.kills = kills[i] ?? 0;
  });
  s.status = status;
  return s;
}
const done = (w: World, spec: MissionSpec, fin: GameState): World =>
  resolve(w, spec, fin, defaultLoadout(), loadoutCost(defaultLoadout(), emptyStash(), storyGearRules(w.research.done)));

const fresh = () => newWorld(1, 'calm');
const target = (w: World) => attackable(w)[0];

describe('resolve: a won fight', () => {
  it('takes the region, keeps the pool without free replacements, and spends days', () => {
    const w = fresh();
    const spec = missionFor(w, target(w));
    const before = JSON.parse(JSON.stringify(w));
    const next = done(w, spec, finished(w, spec, 'won', [1], [2, 1]));
    expect(JSON.parse(JSON.stringify(w))).toEqual(before); // pure
    expect(next.regions[spec.region]).toMatchObject({ holder: 'player', garrison: 0, attempts: 1 });
    expect(regionsHeld(next)).toBe(2);
    expect(next.day).toBe(3);
    expect(next.status).toBe('active');
    expect(next.soldiers.map((s) => s.name)).toEqual(['Alvarez', 'Chen', 'Dubois']);
    expect(next.soldiers[0].kills).toBe(2);
    expect(next.fallen).toEqual([{ name: 'Brandt', kills: 1, trained: 0 }]);
  });

  it('wins the game when the capital falls', () => {
    const w = hold(fresh(), CAPITAL_GATES.slice(0, 2));
    expect(canAttack(w, CAPITAL_REGION)).toBe(true);
    const spec = missionFor(w, CAPITAL_REGION);
    const next = done(w, spec, finished(w, spec, 'won'));
    expect(next.status).toBe('won');
    expect(next.regions[CAPITAL_REGION].holder).toBe('player');
  });
});

describe('resolve: a lost fight', () => {
  it('keeps the region enemy-held and adds the penalty days', () => {
    const w = fresh();
    const spec = missionFor(w, target(w));
    const next = done(w, spec, finished(w, spec, 'lost', [0, 1, 2, 3]));
    expect(next.regions[spec.region].holder).toBe('enemy');
    expect(next.regions[spec.region].attempts).toBe(1);
    expect(next.day).toBe(9);
    expect(next.status).toBe('active');
    expect(next.stash).toEqual(w.stash);
  });

  it('keeps the game going while any region is held, even after losing on the last conquered one', () => {
    const w = hold(fresh(), [target(fresh())]);
    const id = attackable(w)[0];
    const spec = missionFor(w, id);
    expect(done(w, spec, finished(w, spec, 'lost', [0, 1, 2, 3])).status).toBe('active');
  });

  it('ends the game as lost when no region is held', () => {
    const w = hold(hold(fresh(), [0], 'enemy'), [5], 'allied');
    expect(regionsHeld(w)).toBe(0);
    const spec = missionFor(w, 1);
    expect(done(w, spec, finished(w, spec, 'lost', [0, 1, 2, 3])).status).toBe('lost');
    expect(done(w, spec, finished(w, spec, 'won')).status).toBe('active');
  });
});

describe('resolve: guards', () => {
  it('refuses an unfinished fight and a finished world', () => {
    const w = fresh();
    const spec = missionFor(w, target(w));
    const playing = finished(w, spec, 'won');
    playing.status = 'playing';
    expect(() => done(w, spec, playing)).toThrow();
    expect(() => done({ ...w, status: 'won' }, spec, finished(w, spec, 'won'))).toThrow();
  });
});

describe('visit', () => {
  it('makes a neutral region allied, pays income, and costs two days', () => {
    const w = fresh();
    const next = visit(w, 5);
    expect(next.regions[5].holder).toBe('allied');
    expect(next.day).toBe(2);
    expect(incomeRegions(next)).toBe(2);
    expect(next.credits).toBe(w.credits + 2 * incomePerDay(next));
    expect(w.regions[5].holder).toBe('neutral');
  });

  it('gives one stash item from a wilderness once', () => {
    const w = hold(fresh(), [2]);
    const next = visit(w, 3);
    expect(next.regions[3]).toMatchObject({ holder: 'wild', visited: true });
    expect(next.stash.rifle).toBe(1); // region 3: 3 % 3 === 0 -> rifle
    expect(next.day).toBe(2);
    expect(() => visit(next, 3)).toThrow();
  });

  it('refuses other regions and leaves the world untouched', () => {
    const w = fresh();
    const before = JSON.parse(JSON.stringify(w));
    for (const bad of [1, 0, 27, -1, 99]) expect(() => visit(w, bad)).toThrow();
    expect(JSON.parse(JSON.stringify(w))).toEqual(before);
    expect(REGIONS[1].kind).toBe('enemy');
  });
});
