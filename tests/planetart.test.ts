import { describe, expect, it } from 'vitest';
import { CAPITAL_REGION, REGIONS } from '../src/core/world/planet';
import { newWorld, type Holder, type World } from '../src/core/world/world';
import {
  EMBLEM_IDS, FOOTPRINT, PLANET_ART_IDS, STAMP_IDS, regionLook,
} from '../src/screens/planetart';
import { UI } from '../src/ui/frame';

const fresh = () => newWorld(1, 'calm');
const hold = (w: World, ids: number[], holder: Holder): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});

describe('regionLook on a new world', () => {
  it('shows the landing ship, enemy outposts, a neutral settlement, wilderness and the citadel', () => {
    const w = fresh();
    expect(regionLook(w, 0)).toMatchObject({ emblem: 'start_ship', stamp: 'cleared' });
    expect(regionLook(w, 1)).toMatchObject({ emblem: 'outpost_enemy', stamp: 'scorch' });
    expect(regionLook(w, 5)).toMatchObject({ emblem: 'settlement_neutral', stamp: null });
    expect(regionLook(w, 3)).toMatchObject({ emblem: 'wild_b', stamp: null });
    expect(regionLook(w, 10)).toMatchObject({ emblem: 'wild_a', stamp: null });
    expect(regionLook(w, CAPITAL_REGION)).toMatchObject({ emblem: 'citadel_enemy', stamp: 'scorch' });
  });
});

describe('regionLook after conquest', () => {
  it('changes the land when a place is taken, allied or picked over', () => {
    const w = fresh();
    expect(regionLook(hold(w, [1], 'player'), 1)).toMatchObject({ emblem: 'outpost_taken', stamp: 'cleared' });
    expect(regionLook(hold(w, [5], 'allied'), 5)).toMatchObject({ emblem: 'settlement_allied', stamp: 'fields' });
    const picked = { ...w, regions: w.regions.map((r, i) => (i === 3 ? { ...r, visited: true } : r)) };
    expect(regionLook(picked, 3)).toMatchObject({ emblem: 'wild_visited', stamp: null });
    expect(regionLook(hold(w, [CAPITAL_REGION], 'player'), CAPITAL_REGION)).toMatchObject({ emblem: 'citadel_taken', stamp: 'cleared' });
  });

  it('tints by holder', () => {
    const w = fresh();
    expect(regionLook(w, 1).tint).toBe(UI.red);
    expect(regionLook(hold(w, [1], 'player'), 1).tint).toBe(UI.green);
    expect(regionLook(hold(w, [5], 'allied'), 5).tint).toBe(UI.blue);
    expect(regionLook(w, 5).tint).toBe(UI.accent);
    expect(regionLook(w, 3).tint).toBe(UI.dim);
  });
});

describe('every place always has a look', () => {
  const holders: Record<string, Holder[]> = {
    start: ['player', 'enemy'], enemy: ['enemy', 'player'], neutral: ['neutral', 'allied'], wild: ['wild'],
  };
  it('gives a known emblem and stamp for every region, holder and visited state', () => {
    for (const r of REGIONS) {
      for (const holder of holders[r.kind]) {
        for (const visited of [false, true]) {
          const w = fresh();
          const world = { ...w, regions: w.regions.map((s, i) => (i === r.id ? { ...s, holder, visited } : s)) };
          const look = regionLook(world, r.id);
          expect(EMBLEM_IDS, `${r.name} ${holder}`).toContain(look.emblem);
          if (look.stamp !== null) expect(STAMP_IDS).toContain(look.stamp);
          expect(FOOTPRINT[look.emblem]).toBeLessThanOrEqual(32);
        }
      }
    }
  });
});

describe('the art ids', () => {
  it('are the backdrop, 10 emblems and 3 stamps with no duplicates', () => {
    expect(PLANET_ART_IDS).toHaveLength(14);
    expect(new Set(PLANET_ART_IDS).size).toBe(14);
    expect(PLANET_ART_IDS).toContain('backdrop');
    expect(PLANET_ART_IDS).toContain('stamp_scorch');
    expect(PLANET_ART_IDS).toContain('citadel_taken');
  });
});
