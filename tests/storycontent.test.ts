import { describe, expect, it } from 'vitest';
import {
  ORIGINALS, SCENES, nextScene, see, type Scene,
} from '../src/core/world/story';
import { CAPITAL_GATES } from '../src/core/world/planet';
import { newWorld, regionsHeld, type Holder, type World } from '../src/core/world/world';
import { ADVANCE, unsupportedChars } from '../src/ui/font';

const ORDER = [
  'landing', 'first-blood', 'friends', 'first-lab', 'wounded', 'recruits', 'offer',
  'memorial-Alvarez', 'memorial-Brandt', 'memorial-Chen', 'memorial-Dubois',
  'halfway', 'refugees', 'one-left', 'citadel-open', 'deserter', 'victory', 'defeat',
];

const hold = (w: World, ids: number[], holder: Holder = 'player'): World => ({
  ...w,
  regions: w.regions.map((r, i) => (ids.includes(i) ? { ...r, holder } : { ...r })),
});
const fresh = () => newWorld(1, 'calm');
const pending = (w: World): string[] => {
  const out: string[] = [];
  let cur = w;
  for (let s = nextScene(cur); s; s = nextScene(cur)) {
    out.push(s.id);
    cur = see(cur, s.id);
  }
  return out;
};
/** Pending ids once the always-on landing scene is out of the way. */
const extra = (w: World): string[] => pending(w).filter((id) => id !== 'landing');
const ENEMY = [1, 2, 4, 6, 7, 8, 11, 12, 13, 14, 16, 18, 19, 22, 23, 24];

/** Greedy wrap by characters, as the scene screen wraps by pixels (one glyph is ADVANCE px). */
function rows(text: string): number {
  const max = Math.floor(340 / ADVANCE);
  let n = 1;
  let len = 0;
  for (const word of text.split(' ')) {
    if (len === 0) len = word.length;
    else if (len + 1 + word.length <= max) len += 1 + word.length;
    else {
      n += 1;
      len = word.length;
    }
  }
  return n;
}

describe('the scene table', () => {
  it('has the 18 scenes in order, three with a choice', () => {
    expect(SCENES.map((s) => s.id)).toEqual(ORDER);
    expect(SCENES.filter((s) => s.choice).map((s) => s.id)).toEqual(['offer', 'refugees', 'deserter']);
  });

  it('uses only supported characters and short labels', () => {
    for (const s of SCENES) {
      const all = [...s.lines, ...(s.choice ?? []).flatMap((c) => c.reply)];
      for (const l of all) expect(unsupportedChars(l.text), `${s.id}: ${l.text}`).toEqual([]);
      for (const c of s.choice ?? []) {
        expect(unsupportedChars(c.label), c.label).toEqual([]);
        expect(c.label.length, c.label).toBeLessThanOrEqual(14);
      }
    }
  });

  it('fits the text box: at most 6 lines, 3 reply lines, 2 rows per line, only the originals speak', () => {
    for (const s of SCENES as Scene[]) {
      expect(s.lines.length, s.id).toBeLessThanOrEqual(6);
      const all = [...s.lines, ...(s.choice ?? []).flatMap((c) => c.reply)];
      for (const c of s.choice ?? []) expect(c.reply.length, s.id).toBeLessThanOrEqual(3);
      for (const l of all) {
        expect(rows(l.text), `${s.id}: ${l.text}`).toBeLessThanOrEqual(2);
        expect(l.by.length).toBeGreaterThan(0);
        for (const name of l.by) expect(ORIGINALS as readonly string[]).toContain(name);
      }
    }
  });
});

describe('triggers', () => {
  it('shows only the landing on a new world', () => {
    expect(pending(fresh())).toEqual(['landing']);
  });

  it('first-blood, friends, first-lab, wounded and recruits', () => {
    expect(extra(hold(fresh(), [1]))).toEqual(['first-blood']);
    expect(extra(hold(fresh(), [5], 'allied'))).toEqual(['friends']);
    expect(extra({ ...fresh(), research: { done: ['shotgun'], active: null } })).toEqual(['first-lab']);
    const w = fresh();
    const hurt = { ...w, soldiers: w.soldiers.map((s, i) => (i === 0 ? { ...s, status: 'wounded' as const, daysLeft: 3 } : s)) };
    expect(extra(hurt)).toEqual(['wounded']);
    const hired = { ...w, soldiers: [...w.soldiers, { name: 'Eriksen', kills: 0, trained: 0, status: 'ready' as const, daysLeft: 0 }] };
    expect(extra(hired)).toEqual(['recruits']);
  });

  it('offer needs six regions held and day 20', () => {
    const six = hold(fresh(), [1, 2, 4, 6, 7]);
    expect(regionsHeld(six)).toBe(6);
    expect(extra({ ...six, day: 19 })).not.toContain('offer');
    expect(extra({ ...six, day: 20 })).toContain('offer');
  });

  it('a memorial plays for exactly the fallen name', () => {
    for (const name of ORIGINALS) {
      const w = { ...fresh(), fallen: [{ name, kills: 0, trained: 0 }] };
      expect(extra(w)).toEqual([`memorial-${name}`]);
    }
  });

  it('halfway, refugees and one-left', () => {
    const ten = hold(fresh(), ENEMY.slice(0, 9));
    expect(regionsHeld(ten)).toBe(10);
    expect(extra(ten)).toContain('halfway');
    const twelve = hold(hold(fresh(), ENEMY.slice(0, 11)), [5], 'allied');
    expect(regionsHeld(twelve)).toBe(12);
    expect(extra(twelve)).toContain('refugees');
    expect(extra(hold(fresh(), ENEMY.slice(0, 11)))).not.toContain('refugees');
    const lone = fresh();
    expect(extra({ ...lone, day: 9 })).not.toContain('one-left');
    expect(extra({ ...lone, day: 10 })).toContain('one-left');
  });

  it('citadel-open shows first, and the deserter only after it was seen', () => {
    const w = hold(fresh(), CAPITAL_GATES.slice(0, 2));
    const ids = extra(w);
    expect(ids).toContain('citadel-open');
    expect(ids).toContain('deserter');
    expect(ids.indexOf('citadel-open')).toBeLessThan(ids.indexOf('deserter'));
    expect(nextScene(see(w, 'landing'))?.id).not.toBe('deserter');
  });

  it('an ended story shows only its ending scene', () => {
    const rich = { ...hold(fresh(), CAPITAL_GATES.slice(0, 2)), fallen: [{ name: 'Chen', kills: 0, trained: 0 }] };
    expect(pending({ ...rich, status: 'won' })).toEqual(['victory']);
    expect(pending({ ...rich, status: 'lost' })).toEqual(['defeat']);
  });

  it('plays every scene once when several are pending', () => {
    const w = { ...hold(hold(fresh(), ENEMY.slice(0, 11)), [5], 'allied'), day: 30, fallen: [{ name: 'Brandt', kills: 0, trained: 0 }] };
    const ids = pending(w);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(5);
  });
});
