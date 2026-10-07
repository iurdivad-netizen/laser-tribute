import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/apply';
import { CONFIG, THROWABLES } from '../src/core/config';
import type { GameState } from '../src/core/types';
import { corridorRows, makeState, ok, reason, unit } from './helpers';

function room(kind: 'frag' | 'smoke' | 'flash' | 'incendiary', gap = 5) {
  const rows = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
  const s = makeState(rows);
  s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[0]), id: 'p1', pos: { x: 1, y: 2 } });
  s.units.push({ ...structuredClone(makeState(corridorRows('PE')).units[1]), id: 'e1', pos: { x: 1 + gap, y: 2 } });
  const p = unit(s, 'p1');
  p.facing = 2; p.throwable = kind; p.grenades = 2;
  return { s, p, e: unit(s, 'e1') };
}
const throwAt = (s: GameState, x: number, y: number) => applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x, y } });

describe('throwing the new kinds', () => {
  it('uses the kind AP cost and range', () => {
    const { s, p } = room('smoke');
    const r = ok(throwAt(s, 6, 2));
    expect(unit(r.state, 'p1').ap).toBe(CONFIG.maxAp - THROWABLES.smoke.apCost);
    expect(unit(r.state, 'p1').grenades).toBe(1);
    p.throwable = 'frag';
    const far = makeState(corridorRows('P' + '.'.repeat(12)));
    unit(far, 'p1').grenades = 1;
    expect(reason(applyCommand(far, { type: 'Throw', unitId: 'p1', at: { x: 11, y: 1 } }))).toMatch(/range/i);
  });

  it('frag still hurts everyone in radius 1 and breaks doors; smoke and flash do no damage', () => {
    const f = room('frag', 3);
    const hit = ok(throwAt(f.s, 4, 2));
    expect(unit(hit.state, 'e1').hp).toBe(f.e.hp - 40);
    const sm = room('smoke', 3);
    expect(unit(ok(throwAt(sm.s, 4, 2)).state, 'e1').hp).toBe(sm.e.hp);
    const fl = room('flash', 3);
    expect(unit(ok(throwAt(fl.s, 4, 2)).state, 'e1').hp).toBe(fl.e.hp);
  });

  it('flash sets an AP penalty on every unit in radius 2, on either side', () => {
    const { s } = room('flash', 3);
    const r = ok(throwAt(s, 3, 2)); // lands between them: both within 2
    expect(unit(r.state, 'e1').apPenalty).toBe(30);
    expect(unit(r.state, 'p1').apPenalty).toBe(30);
    const ev = r.events.find((x) => x.type === 'grenade')!;
    expect(ev).toMatchObject({ kind: 'flash', stunned: expect.arrayContaining(['e1', 'p1']) });
  });

  it('incendiary does 15 on landing and leaves fire on the blast tiles', () => {
    const { s } = room('incendiary', 3);
    const r = ok(throwAt(s, 4, 2));
    expect(unit(r.state, 'e1').hp).toBe(40 - 15);
    expect(r.state.hazards.filter((h) => h.kind === 'fire')).toHaveLength(9);
    expect(r.state.hazards.every((h) => h.turnsLeft === 3)).toBe(true);
  });

  it('smoke leaves 25 tiles of smoke (radius 2) minus walls, and a second throw refreshes rather than doubles', () => {
    const { s } = room('smoke');
    const r = ok(throwAt(s, 4, 2));
    const tiles = r.state.hazards.filter((h) => h.kind === 'smoke');
    expect(tiles.length).toBe(15); // x 2..6, y 1..3 inside the 3-row room
    const again = structuredClone(r.state);
    again.hazards.forEach((h) => (h.turnsLeft = 1));
    const r2 = ok(throwAt(again, 4, 2));
    expect(r2.state.hazards.filter((h) => h.kind === 'smoke')).toHaveLength(15);
    expect(r2.state.hazards.every((h) => h.turnsLeft === 3)).toBe(true);
  });

  it('only frag destroys doors', () => {
    const rows = ['#####', '#.+.#', '#####'];
    for (const [kind, gone] of [['frag', true], ['smoke', false], ['incendiary', false]] as const) {
      const s = makeState(['#######', '#P....#', '#######']);
      s.tiles[1][3] = { kind: 'door', open: false };
      const p = unit(s, 'p1'); p.throwable = kind; p.grenades = 1; p.facing = 2;
      const r = ok(applyCommand(s, { type: 'Throw', unitId: 'p1', at: { x: 3, y: 1 } }));
      expect(r.state.tiles[1][3].kind === 'floor').toBe(gone);
    }
    void rows;
  });

  it('a thrown smoke is not stopped by smoke already in the way', () => {
    const { s } = room('smoke');
    s.hazards.push({ pos: { x: 3, y: 2 }, kind: 'smoke', turnsLeft: 3 });
    ok(throwAt(s, 6, 2));
  });

  it('picking up a floor frag while carrying smoke is refused, but works with none left', () => {
    const s = makeState(['#####', '#P..#', '#####']);
    s.items.push({ id: 'g1', pos: { x: 1, y: 1 }, kind: 'grenade' });
    const p = unit(s, 'p1'); p.throwable = 'smoke'; p.grenades = 1;
    expect(reason(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'g1' }))).toMatch(/another throwable/i);
    p.grenades = 0;
    const r = ok(applyCommand(s, { type: 'PickUp', unitId: 'p1', itemId: 'g1' }));
    expect(unit(r.state, 'p1').throwable).toBe('frag');
    expect(unit(r.state, 'p1').grenades).toBe(1);
  });
});
