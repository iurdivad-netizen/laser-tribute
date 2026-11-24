import { describe, expect, it } from 'vitest';
import { buildingInfo, type InfoId } from '../src/core/world/buildinginfo';
import { rankFor } from '../src/core/ranks';
import { startTraining } from '../src/core/world/barracks';
import { advance, incomePerDay, newWorld, type World } from '../src/core/world/world';
import { unsupportedChars } from '../src/ui/font';

const IDS: InfoId[] = ['lab', 'market', 'barracks', 'training', 'hospital', 'wait'];
const fresh = () => newWorld(1, 'calm');
const withResearch = (done: string[]): World => ({ ...fresh(), research: { done, active: null } });
const text = (id: InfoId, w: World): string => buildingInfo(id, w).lines.join(' ').toUpperCase();

/** Greedy wrap by characters, as the box wraps by pixels (a glyph is 6 px: 64 characters fit about 380 px). */
function rows(line: string, max = 64): number {
  let n = 1;
  let len = 0;
  for (const word of line.split(' ')) {
    if (len === 0) len = word.length;
    else if (len + 1 + word.length <= max) len += 1 + word.length;
    else {
      n += 1;
      len = word.length;
    }
  }
  return n;
}

describe('buildingInfo shape', () => {
  it('has a title and 3 or 4 lines for every building, at most 8 wrapped rows, supported characters', () => {
    const rich = withResearch(['training3', 'hospital2', 'labs2', 'beds3']);
    for (const w of [fresh(), rich]) {
      for (const id of IDS) {
        const info = buildingInfo(id, w);
        expect(info.title.length, id).toBeGreaterThan(0);
        expect(info.lines.length, id).toBeGreaterThanOrEqual(3);
        expect(info.lines.length, id).toBeLessThanOrEqual(4);
        expect(info.lines.reduce((n, l) => n + rows(l), 0), id).toBeLessThanOrEqual(8);
        for (const line of [info.title, ...info.lines]) expect(unsupportedChars(line), `${id}: ${line}`).toEqual([]);
      }
    }
  });
});

describe('buildingInfo reads the live rules', () => {
  it('lab: the labs level shortens projects', () => {
    expect(text('lab', fresh())).toContain('100%');
    expect(text('lab', withResearch(['labs1']))).toContain('75%');
    expect(text('lab', withResearch(['labs1', 'labs2']))).toContain('50%');
  });

  it('barracks: beds, hire cost and the mercenary fee', () => {
    const t = text('barracks', fresh());
    expect(t).toContain('4 OF 6');
    expect(t).toContain('40 CREDITS');
    expect(t).toContain('10 CREDITS');
    expect(text('barracks', withResearch(['beds1']))).toContain('4 OF 8');
  });

  it('market: the premium', () => {
    expect(text('market', fresh())).toContain('150%');
  });

  it('training: not built, then built with its cap and days', () => {
    expect(text('training', fresh())).toContain('NOT BUILT YET');
    const built = text('training', withResearch(['training1']));
    expect(built).toContain('UP TO 2 POINTS');
    expect(built).toContain('4 DAYS');
    expect(text('training', withResearch(['training1', 'training2']))).toContain('UP TO 5 POINTS');
  });

  it('training: says a stint lifts the soldier to the next rank, and matches what training really does', () => {
    for (const [done, cap] of [[['training1'], 2], [['training1', 'training2'], 5], [['training1', 'training2', 'training3'], 9]] as const) {
      const w = withResearch([...done]);
      const t = text('training', w);
      expect(t).toContain('NEXT RANK');
      expect(t).not.toContain('RANK POINT');
      expect(t).toContain(`UP TO ${cap} POINTS (${rankFor(cap).name.toUpperCase()})`);
    }
    // a rookie trained at level 1 really does reach the rank the text names for the cap
    const w = withResearch(['training1']);
    const trained = advance(startTraining(w, 'Alvarez'), 4);
    const s = trained.soldiers.find((x) => x.name === 'Alvarez')!;
    expect(rankFor(s.kills + s.trained).name).toBe('Private');
    expect(text('training', w)).toContain('(PRIVATE)');
  });

  it('hospital: the second chance by level and the wounded days', () => {
    expect(text('hospital', fresh())).toMatch(/(^|[^0-9])0%/); // 0%, not 50% or 100%
    expect(text('hospital', withResearch(['hospital1']))).toContain('25%');
    expect(text('hospital', withResearch(['hospital1', 'hospital2']))).toContain('50%');
    expect(text('hospital', fresh())).toContain('6 DAYS');
  });

  it('wait: the options and today\'s income', () => {
    const w = fresh();
    expect(text('wait', w)).toContain('1 OR 3 DAYS');
    expect(text('wait', w)).toContain(`${incomePerDay(w)} CREDITS A DAY`);
  });
});
