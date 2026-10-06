import { describe, expect, it } from 'vitest';
import { checkMission, expectFor } from '../src/core/gen/check';
import { buildLayout } from '../src/core/gen/layout';
import { populate } from '../src/core/gen/populate';
import { RECIPES } from '../src/core/gen/recipes';
import { seededRandom } from '../src/core/rng';

function attempt(i: number, seed: number) {
  const r = RECIPES[i];
  const rnd = seededRandom(seed);
  return populate(buildLayout(r, rnd), rnd, r, r.enemies);
}

describe.each(RECIPES.map((r, i) => [r.name, i] as const))('populate %s', (_name, i) => {
  const r = RECIPES[i];

  it('fills in a playable mission for at least some seeds, and every one it returns passes the check', () => {
    let made = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const def = attempt(i, seed);
      if (!def) continue;
      made++;
      expect(checkMission(def, expectFor(r)), `seed ${seed}`).toEqual([]);
      expect(def.id).toBe(r.id);
      expect(def.name).toBe(r.name);
    }
    expect(made).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic for a seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = attempt(i, seed);
      if (!a) continue;
      expect(attempt(i, seed)).toEqual(a);
      return;
    }
    throw new Error('no seed produced a map');
  });
});

describe('populate details', () => {
  it('starts the squad in the bottom-left corner area', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const def = attempt(0, seed);
      if (!def) continue;
      const squad: { x: number; y: number }[] = [];
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'P') squad.push({ x, y }); }));
      expect(squad).toHaveLength(4);
      for (const p of squad) {
        expect(p.x).toBeLessThan(15);
        expect(p.y).toBeGreaterThan(9);
      }
      return;
    }
    throw new Error('no seed produced a map');
  });

  it('numbers enemies in reading order and keys the patrols the same way', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const def = attempt(2, seed);
      if (!def) continue;
      const foes: { x: number; y: number }[] = [];
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'E') foes.push({ x, y }); }));
      foes.forEach((f, n) => expect(def.patrols[`e${n + 1}`][1], `e${n + 1}`).toEqual(f)); // the second point is the start
      return;
    }
    throw new Error('no seed produced a map');
  });

  it('returns null when the layout has too little floor', () => {
    const r = RECIPES[0];
    const rnd = seededRandom(1);
    const g = buildLayout(r, rnd);
    for (const row of g) row.fill('#', 1, row.length - 1); // wall everything inside
    expect(populate(g, rnd, r, r.enemies)).toBeNull();
  });
});
