import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { defaultLoadout } from '../src/core/loadout';
import { MISSIONS, createMission } from '../src/core/missions';
import { corridorRows, makeState, ok, seedForCrit, seedForRoll, unit } from './helpers';

describe('critical shots and the scope in a mission', () => {
  it('a scoped soldier with a forced crit kills a full-health enemy in one rifle shot', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').attachment = 'scope';
    unit(s, 'p1').facing = 2;
    s.rngState = seedForRoll((n) => n < 0.05);
    s.critState = seedForCrit((n) => n < 0.01);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').alive).toBe(false); // 45 >= 40 HP
    expect(r.state.status).toBe('won');
  });

  it('without a crit the same shot leaves the enemy alive', () => {
    const s = makeState(corridorRows('P..E'));
    unit(s, 'p1').facing = 2;
    s.rngState = seedForRoll((n) => n < 0.05);
    s.critState = seedForCrit((n) => n >= 0.5);
    const r = ok(applyCommand(s, { type: 'SnapShot', unitId: 'p1', targetId: 'e1' }));
    expect(unit(r.state, 'e1').hp).toBe(10);
  });

  it('a scope helps a long shot hit: more hits over many seeds than the same shooter without one', () => {
    const hits = (scope: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const s = makeState(corridorRows('P' + '.'.repeat(9) + 'E'));
        unit(s, 'p1').facing = 2;
        unit(s, 'p1').attachment = scope ? 'scope' : null;
        s.rngState = seed;
        const r = ok(applyCommand(s, { type: 'AimedShot', unitId: 'p1', targetId: 'e1' }));
        if (r.events.some((e) => e.type === 'shot' && e.hit)) n += 1;
      }
      return n;
    };
    expect(hits(true)).toBeGreaterThan(hits(false));
  });

  it('missions start without scopes and with a seeded crit stream', () => {
    const a = createMission(MISSIONS[0], 7, undefined, defaultLoadout());
    const b = createMission(MISSIONS[0], 7, undefined, defaultLoadout());
    expect(a.units.every((u) => u.attachment === null)).toBe(true);
    expect(a.critState).toBe(b.critState);
    expect(createMission(MISSIONS[0], 8, undefined, defaultLoadout()).critState).not.toBe(a.critState);
  });
});
