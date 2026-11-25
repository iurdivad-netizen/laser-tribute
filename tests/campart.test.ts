import { describe, expect, it } from 'vitest';
import { newWorld, type World } from '../src/core/world/world';
import { CAMP_ART_IDS, CAMP_SPRITE_IDS, SPRITE_SIZE, campLook } from '../src/screens/campart';
import type { BuildingId } from '../src/screens/base';

const fresh = () => newWorld(1, 'calm');
const researched = (done: string[], active: World['research']['active'] = null): World => ({ ...fresh(), research: { done, active } });
const withSoldier = (w: World, status: 'training' | 'wounded', daysLeft = 2): World => ({
  ...w, soldiers: w.soldiers.map((s, i) => (i === 0 ? { ...s, status, daysLeft } : s)),
});
const IDS: BuildingId[] = ['lab', 'barracks', 'market', 'training', 'hospital', 'wait', 'planet'];

describe('campLook', () => {
  it('shows plots and an idle lab on a new world', () => {
    expect(campLook(fresh())).toEqual({
      lab: 'lab_idle', barracks: 'barracks', market: 'market', training: 'training_plot', hospital: 'hospital_plot', wait: null, planet: null,
    });
  });

  it('shows the built facilities and a busy lab', () => {
    const built = campLook(researched(['training1', 'hospital1']));
    expect(built.training).toBe('training_built');
    expect(built.hospital).toBe('hospital_built');
    expect(campLook(researched([], { node: 'shotgun', daysLeft: 3 })).lab).toBe('lab_busy');
  });

  it('shows a soldier training and a wounded one', () => {
    const done = ['training1', 'hospital1'];
    expect(campLook(withSoldier(researched(done), 'training')).training).toBe('training_busy');
    expect(campLook(withSoldier(researched(done), 'wounded')).hospital).toBe('hospital_busy');
  });

  it('keeps a plot while the facility is not built, whoever is training or wounded', () => {
    expect(campLook(withSoldier(fresh(), 'training')).training).toBe('training_plot');
    expect(campLook(withSoldier(fresh(), 'wounded')).hospital).toBe('hospital_plot');
  });

  it('gives a sprite or null for every combination', () => {
    const dones = [[], ['training1'], ['hospital1'], ['training1', 'hospital1']];
    const actives = [null, { node: 'shotgun', daysLeft: 3 }];
    for (const done of dones) for (const active of actives) {
      for (const w of [researched(done, active), withSoldier(researched(done, active), 'training'), withSoldier(researched(done, active), 'wounded')]) {
        const look = campLook(w);
        expect(Object.keys(look).sort()).toEqual([...IDS].sort());
        for (const id of IDS) expect(look[id] === null || (CAMP_SPRITE_IDS as readonly string[]).includes(look[id]!)).toBe(true);
      }
    }
  });
});

describe('the camp art ids', () => {
  it('are the backdrop and 10 sprites with no duplicates', () => {
    expect(CAMP_ART_IDS).toHaveLength(11);
    expect(new Set(CAMP_ART_IDS).size).toBe(11);
    expect(CAMP_ART_IDS[0]).toBe('camp_backdrop');
  });

  it('give every sprite a size', () => {
    for (const id of CAMP_SPRITE_IDS) {
      expect(SPRITE_SIZE[id].w).toBeGreaterThan(0);
      expect(SPRITE_SIZE[id].h).toBeGreaterThan(0);
    }
    expect(SPRITE_SIZE.lab_idle).toEqual({ w: 120, h: 72 });
    expect(SPRITE_SIZE.hospital_busy).toEqual({ w: 120, h: 72 });
    expect(SPRITE_SIZE.training_built).toEqual({ w: 64, h: 64 });
  });
});
