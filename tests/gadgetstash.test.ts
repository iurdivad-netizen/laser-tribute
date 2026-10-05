import { describe, expect, it } from 'vitest';
import {
  applyLoadout, defaultLoadout, fitLoadout, loadoutCost, netSoldierCost, soldierCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { addStash, capStash, lootFrom } from '../src/core/loot';
import { coverage, describeStash, emptyStash, nextStash } from '../src/core/stash';
import { corridorRows, makeState, unit } from './helpers';

const withGadget = (g: 'medkit' | 'armour' | 'scanner' | undefined, i = 0): Loadout =>
  defaultLoadout().map((s, j) => (j === i ? { ...s, gadget: g } : s));

describe('gadget prices', () => {
  it('add to the soldier and the loadout cost', () => {
    const base = soldierCost(defaultLoadout()[0]);
    expect(soldierCost(withGadget('medkit')[0])).toBe(base + 12);
    expect(soldierCost(withGadget('armour')[0])).toBe(base + 20);
    expect(soldierCost(withGadget('scanner')[0])).toBe(base + 15);
    expect(loadoutCost(withGadget('armour'))).toBe(loadoutCost(defaultLoadout()) + 20);
  });

  it('a stashed gadget is free, and the row prices still add up to the total', () => {
    const stash = { ...emptyStash(), armour: 1 };
    const l = withGadget('armour');
    expect(coverage(l, stash)[0].gadget).toBe(true);
    expect(loadoutCost(l, stash)).toBe(loadoutCost(defaultLoadout()));
    const rows = l.reduce((sum, _s, i) => sum + netSoldierCost(l, i, stash), 0);
    expect(rows).toBe(loadoutCost(l, stash));
  });

  it('the stash is handed out in soldier order', () => {
    const l = defaultLoadout().map((s) => ({ ...s, gadget: 'medkit' as const }));
    const cover = coverage(l, { ...emptyStash(), medkit: 2 });
    expect(cover.map((c) => c.gadget)).toEqual([true, true, false, false]);
  });
});

describe('validateLoadout and fitLoadout', () => {
  it('accepts no gadget and each known gadget, rejects an unknown id', () => {
    for (const g of [undefined, 'medkit', 'armour', 'scanner'] as const) {
      expect(validateLoadout(withGadget(g), 200)).toBeNull();
    }
    const bad = defaultLoadout().map((s) => ({ ...s, gadget: 'laser' as never }));
    expect(validateLoadout(bad, 200)).toMatch(/gadget/i);
  });

  it('drops gadgets after extra clips and before falling back to the cheap kit', () => {
    const l = defaultLoadout().map((s) => ({ ...s, gadget: 'armour' as const })); // 102 + 80 = 182
    const fitted = fitLoadout(l, 120);
    expect(fitted.every((s) => s.gadget === undefined)).toBe(true);
    expect(fitted.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
  });
});

describe('applyLoadout', () => {
  it('gives each soldier the chosen gadget', () => {
    const state = makeState(corridorRows('PPPPE'));
    const l = defaultLoadout();
    l[0].gadget = 'medkit';
    l[2] = { ...l[2], gadget: 'armour' };
    const next = applyLoadout(state, l, 200);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).gadget)).toEqual(['medkit', null, 'armour', null]);
  });
});

describe('stash with gadgets', () => {
  const finished = () => {
    const s = makeState(corridorRows('PPPPE'));
    s.status = 'won';
    return s;
  };

  it('starts empty and lists gadgets', () => {
    expect(emptyStash()).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
    expect(describeStash({ ...emptyStash(), medkit: 2, armour: 1, scanner: 1 })).toBe('2 medkits, 1 armour, 1 scanner');
  });

  it('returns an unused medkit or scanner and worn armour of survivors, bought or lent', () => {
    const used = defaultLoadout();
    used[0].gadget = 'medkit';
    used[1] = { ...used[1], gadget: 'armour' };
    used[2] = { ...used[2], gadget: 'scanner' };
    const s = finished();
    unit(s, 'p1').gadget = 'medkit';
    unit(s, 'p2').gadget = 'armour';
    unit(s, 'p3').gadget = 'scanner';
    const next = nextStash(emptyStash(), used, s);
    expect(next).toMatchObject({ medkit: 1, armour: 1, scanner: 1 });
  });

  it('a used gadget is gone, and a dead soldier loses theirs', () => {
    const used = defaultLoadout();
    used[0].gadget = 'medkit';
    used[1] = { ...used[1], gadget: 'armour' };
    const s = finished();
    unit(s, 'p1').gadget = null; // used up
    unit(s, 'p2').gadget = 'armour';
    unit(s, 'p2').alive = false;
    expect(nextStash(emptyStash(), used, s)).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
  });

  it('a lent gadget leaves the stash and comes back only if still carried', () => {
    const used = withGadget('medkit');
    const stash = { ...emptyStash(), medkit: 1 };
    const kept = finished();
    unit(kept, 'p1').gadget = 'medkit';
    expect(nextStash(stash, used, kept).medkit).toBe(1);
    const spent = finished();
    unit(spent, 'p1').gadget = null;
    expect(nextStash(stash, used, spent).medkit).toBe(0);
  });

  it('caps each gadget at 4 and loot carries no gadgets', () => {
    const big = { ...emptyStash(), medkit: 9, armour: 9, scanner: 9 };
    expect(capStash(big)).toMatchObject({ medkit: 4, armour: 4, scanner: 4 });
    expect(lootFrom(finished())).toMatchObject({ medkit: 0, armour: 0, scanner: 0 });
    expect(addStash(big, big)).toMatchObject({ medkit: 18, armour: 18, scanner: 18 });
  });
});
