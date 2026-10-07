import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { WEAPON_IDS, WEAPONS } from '../src/core/config';
import { generateMission } from '../src/core/gen';
import { checkMission, expectFor } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';
import { createMission } from '../src/core/missions';
import type { GameState, WeaponId } from '../src/core/types';
import { corridorRows, makeState } from './helpers';

/**
 * Two soldiers face each other across `gap` tiles and shoot aimed shots in turn (the first shooter alternates with the
 * seed); returns whether `a` won, or null when nobody died within 40 rounds.
 */
function duel(a: WeaponId, b: WeaponId, gap: number, seed: number): boolean | null {
  let s: GameState = makeState(corridorRows('P' + '.'.repeat(gap - 1) + 'E'));
  s.rngState = seed;
  s.critState = seed * 7 + 1;
  const pa = s.units.find((u) => u.id === 'p1')!;
  const eb = s.units.find((u) => u.id === 'e1')!;
  pa.weapon = a; eb.weapon = b;
  pa.ammo = WEAPONS[a].magazine; eb.ammo = WEAPONS[b].magazine;
  pa.clips = 99; eb.clips = 99;
  pa.facing = 2; eb.facing = 6;
  const order = seed % 2 === 0 ? (['player', 'enemy'] as const) : (['enemy', 'player'] as const);
  for (let round = 0; round < 40; round++) {
    for (const side of order) {
      const id = side === 'player' ? 'p1' : 'e1';
      const target = side === 'player' ? 'e1' : 'p1';
      s.turn = side;
      const u = s.units.find((x) => x.id === id)!;
      u.ap = u.maxAp;
      for (let i = 0; i < 8; i++) {
        const cmd = u.ammo < 1
          ? { type: 'Reload' as const, unitId: id }
          : u.ap >= WEAPONS[u.weapon].aimedAp
            ? { type: 'AimedShot' as const, unitId: id, targetId: target }
            : { type: 'SnapShot' as const, unitId: id, targetId: target };
        const r = applyCommand(s, cmd);
        if (!r.ok) break;
        s = r.state;
        if (s.status !== 'playing') return s.status === 'won';
      }
    }
  }
  return null;
}

function winRate(a: WeaponId, b: WeaponId, gap: number): number {
  let wins = 0;
  let played = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const r = duel(a, b, gap, seed);
    if (r === null) continue;
    played++;
    if (r) wins++;
  }
  return wins / Math.max(1, played);
}

describe('weapon balance (aimed duels)', () => {
  it('no weapon beats every other weapon at every range', () => {
    for (const a of WEAPON_IDS) {
      let beatsAll = true;
      for (const gap of [2, 5, 9]) {
        for (const b of WEAPON_IDS) {
          if (a !== b && winRate(a, b, gap) < 0.5) beatsAll = false;
        }
      }
      expect(beatsAll, `${a} beat every other weapon at every range`).toBe(false);
    }
  }, 120000);

  it('the shotgun beats the sniper up close and loses to it far away', () => {
    expect(winRate('shotgun', 'sniper', 2)).toBeGreaterThan(0.5);
    expect(winRate('sniper', 'shotgun', 9)).toBeGreaterThan(0.5);
  });
});

describe('generated missions with weapon draws', () => {
  it('still pass checkMission and carry only weapons unlocked at their level', () => {
    for (let type = 0; type < RECIPES.length; type++) {
      const def = generateMission(type, 0);
      expect(checkMission(def, expectFor(RECIPES[type]))).toEqual([]);
      const state = createMission(def, 3, undefined, undefined, undefined, undefined, type + 1);
      for (const u of state.units.filter((x) => x.side === 'enemy')) {
        expect(WEAPONS[u.weapon].unlockAt).toBeLessThanOrEqual(type + 1);
      }
    }
  });
});
