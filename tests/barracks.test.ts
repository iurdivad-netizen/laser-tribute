import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { createMission } from '../src/core/missions';
import { emptyStash } from '../src/core/stash';
import type { GameState } from '../src/core/types';
import { BASE_RULES, storyGearRules } from '../src/core/world/base';
import { canHire, canTrain, deployed, hire, startTraining } from '../src/core/world/barracks';
import { DAYS } from '../src/core/world/difficulty';
import {
  advance, attackable, missionFor, newWorld, resolve, wait, type MissionSpec, type World,
} from '../src/core/world/world';

const fresh = (done: string[] = [], credits = 150): World => ({
  ...newWorld(1, 'calm'),
  credits,
  research: { done, active: null },
});

describe('hiring', () => {
  it('hires up to the bed count for credits and names new soldiers in order', () => {
    let w = fresh();
    expect(canHire(w)).toBe(true);
    w = hire(hire(w));
    expect(w.credits).toBe(150 - 2 * 40);
    expect(w.soldiers.map((s) => s.name).slice(4)).toEqual(['Eriksen', 'Fontaine']);
    expect(w.soldiers.every((s) => s.status === 'ready' || s.daysLeft === 0)).toBe(true);
    expect(w.namesUsed).toBe(6);
    expect(canHire(w)).toBe(false); // six beds are full
    expect(() => hire(w)).toThrow('cannot hire');
  });

  it('needs enough credits', () => {
    expect(canHire(fresh([], 39))).toBe(false);
    expect(canHire(fresh([], 40))).toBe(true);
  });

  it('gets more beds from barracks research', () => {
    let w = fresh(['beds1'], 500);
    w = hire(hire(hire(w))); // 4 + 3 = 7 of 8
    expect(w.soldiers).toHaveLength(7);
    expect(canHire(w)).toBe(true);
    expect(canHire(hire(w))).toBe(false);
  });
});

describe('training', () => {
  it('needs a training facility, a ready soldier, and rank room under the cap', () => {
    expect(canTrain(fresh(), 'Alvarez')).toBe(false);
    expect(canTrain(fresh(['training1']), 'Alvarez')).toBe(true);
    expect(canTrain(fresh(['training1']), 'Nobody')).toBe(false);
  });

  it('takes a soldier out for days, off the squad, and raises him one rank step', () => {
    const w = startTraining(fresh(['training1']), 'Alvarez');
    expect(w.soldiers[0]).toMatchObject({ status: 'training', daysLeft: 4 });
    expect(w.squad).toEqual(['Brandt', 'Chen', 'Dubois']);
    expect(deployed(w).mercs).toBe(1);
    const back = advance(w, 4);
    expect(back.soldiers[0]).toMatchObject({ status: 'ready', daysLeft: 0 });
    expect(back.soldiers[0].kills + back.soldiers[0].trained).toBe(2); // Private
  });

  it('stops at the cap of the facility level and goes further with higher levels', () => {
    const train = (w: World): World => advance(startTraining(w, 'Alvarez'), 4);
    let w = train(fresh(['training1']));
    expect(canTrain(w, 'Alvarez')).toBe(false); // already Private, the level 1 cap
    w = { ...w, research: { done: ['training1', 'training2'], active: null } };
    w = train(w);
    expect(w.soldiers[0].kills + w.soldiers[0].trained).toBe(5);
    expect(canTrain(w, 'Alvarez')).toBe(false);
    w = { ...w, research: { done: ['training1', 'training2', 'training3'], active: null } };
    w = train(w);
    expect(w.soldiers[0].kills + w.soldiers[0].trained).toBe(9);
    expect(canTrain(w, 'Alvarez')).toBe(false);
  });

  it('counts real kills toward the next step', () => {
    const w = { ...fresh(['training1', 'training2']) };
    w.soldiers[0] = { ...w.soldiers[0], kills: 3 };
    const back = advance(startTraining(w, 'Alvarez'), 4);
    expect(back.soldiers[0].kills).toBe(3);
    expect(back.soldiers[0].kills + back.soldiers[0].trained).toBe(5);
  });

  it('trains one soldier at a time', () => {
    const w = startTraining(fresh(['training1']), 'Alvarez');
    expect(canTrain(w, 'Brandt')).toBe(false);
    expect(() => startTraining(w, 'Brandt')).toThrow();
  });
});

describe('waiting', () => {
  it('advances 1 or 3 days and pays income', () => {
    const w = fresh();
    expect(wait(w, 1).day).toBe(1);
    expect(wait(w, 3).day).toBe(3);
    expect(wait(w, 3).credits).toBe(150 + 3 * 4);
  });

  it('refuses other lengths and finished stories', () => {
    expect(() => wait(fresh(), 2)).toThrow(RangeError);
    expect(() => wait({ ...fresh(), status: 'won' }, 1)).toThrow();
  });

  it('keeps the pressure of time: two 3-day waits equal six days', () => {
    const w = newWorld(4, 'pressure');
    expect(wait(wait(w, 3), 3)).toEqual(advance(w, 6));
  });
});

describe('the hospital second chance', () => {
  const base = newWorld(1, 'calm');
  const spec: MissionSpec = missionFor(base, attackable(base)[0]);
  const fight = (status: 'won' | 'lost', roster: string[]): GameState => {
    const def = generateMission(spec.type, spec.variation, spec.difficulty);
    const s = createMission(def, spec.seed, roster.map((name) => ({ name, kills: 0 })), defaultLoadout(), 999, undefined, storyGearRules([]), spec.enemyLevel);
    s.units.filter((u) => u.side === 'player').forEach((u) => { u.alive = false; });
    s.status = status;
    return s;
  };
  const wiped = (done: string[], status: 'won' | 'lost', seed: number): World => {
    const w = { ...newWorld(seed, 'calm'), research: { done, active: null } };
    return resolve(w, missionFor(w, attackable(w)[0]), fight(status, ['Alvarez', 'Brandt', 'Chen', 'Dubois']), defaultLoadout(), loadoutCost(defaultLoadout(), emptyStash(), storyGearRules(done)));
  };

  it('saves about half of the fallen at hospital level 2, deterministically', () => {
    let wounded = 0;
    for (let seed = 1; seed <= 200; seed++) wounded += wiped(['hospital1', 'hospital2'], 'won', seed).soldiers.length;
    expect(wounded).toBeGreaterThan(300);
    expect(wounded).toBeLessThan(500);
    expect(wiped(['hospital1', 'hospital2'], 'won', 7)).toEqual(wiped(['hospital1', 'hospital2'], 'won', 7));
  }, 60_000);

  it('keeps a recovered soldier wounded for days, with rank and name intact, then returns him', () => {
    let found: World | null = null;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const w = wiped(['hospital1', 'hospital2'], 'won', seed);
      if (w.soldiers.length > 0) found = w;
    }
    expect(found).not.toBeNull();
    const first = found!.soldiers[0];
    expect(first).toMatchObject({ status: 'wounded', daysLeft: BASE_RULES.woundedDays - DAYS.attack });
    expect(found!.fallen.some((f) => f.name === first.name)).toBe(false);
    const healed = advance(found!, 6);
    expect(healed.soldiers.find((s) => s.name === first.name)).toMatchObject({ status: 'ready', daysLeft: 0 });
  });

  it('saves nobody without a hospital, and nobody after a lost mission', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(wiped([], 'won', seed).soldiers).toEqual([]);
      expect(wiped(['hospital1', 'hospital2'], 'lost', seed).soldiers).toEqual([]);
    }
  });

  it('never saves or records a loaned mercenary', () => {
    const w = { ...newWorld(1, 'calm'), squad: [] as string[], soldiers: [], research: { done: ['hospital1', 'hospital2'], active: null } };
    const next = resolve(w, spec, fight('won', ['Loan 1', 'Loan 2', 'Loan 3', 'Loan 4']), defaultLoadout(), 0);
    expect(next.soldiers).toEqual([]);
    expect(next.fallen).toEqual([]);
  });
});
