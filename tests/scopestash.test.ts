import { describe, expect, it } from 'vitest';
import {
  applyLoadout, defaultLoadout, fitLoadout, loadoutCost, netSoldierCost, soldierCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { addStash, capStash, lootFrom } from '../src/core/loot';
import { coverage, describeStash, emptyStash, nextStash } from '../src/core/stash';
import { corridorRows, makeState, unit } from './helpers';

const scoped = (i = 0): Loadout =>
  defaultLoadout().map((s, j) => (j === i ? { ...s, attachment: 'scope' as const } : s));

describe('scope price and cover', () => {
  it('adds 18 to the soldier and the loadout, and a gadget keeps its own price', () => {
    const base = soldierCost(defaultLoadout()[0]);
    expect(soldierCost(scoped()[0])).toBe(base + 18);
    expect(loadoutCost(scoped())).toBe(loadoutCost(defaultLoadout()) + 18);
    const both = defaultLoadout().map((s, j) => (j === 0 ? { ...s, gadget: 'armour' as const, attachment: 'scope' as const } : s));
    expect(soldierCost(both[0])).toBe(base + 20 + 18);
  });

  it('a stashed scope is free and the row prices still add up to the total', () => {
    const stash = { ...emptyStash(), scope: 1 };
    const l = scoped();
    expect(coverage(l, stash)[0].attachment).toBe(true);
    expect(loadoutCost(l, stash)).toBe(loadoutCost(defaultLoadout()));
    const rows = l.reduce((sum, _s, i) => sum + netSoldierCost(l, i, stash), 0);
    expect(rows).toBe(loadoutCost(l, stash));
  });

  it('the stash is handed out in soldier order', () => {
    const l = defaultLoadout().map((s) => ({ ...s, attachment: 'scope' as const }));
    expect(coverage(l, { ...emptyStash(), scope: 2 }).map((c) => c.attachment)).toEqual([true, true, false, false]);
  });
});

describe('validate, fit and apply', () => {
  it('accepts none and the scope, rejects an unknown id', () => {
    expect(validateLoadout(scoped(), 200)).toBeNull();
    const bad = defaultLoadout().map((s) => ({ ...s, attachment: 'laser' as never }));
    expect(validateLoadout(bad, 200)).toMatch(/attachment/i);
  });

  it('fitLoadout drops scopes (with gadgets) before the cheap kit, keeping weapons', () => {
    const l = defaultLoadout().map((s) => ({ ...s, attachment: 'scope' as const })); // 102 + 72 = 174
    const fitted = fitLoadout(l, 120);
    expect(fitted.every((s) => s.attachment === undefined)).toBe(true);
    expect(fitted.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'pistol', 'pistol']);
  });

  it('applyLoadout gives the chosen soldiers a scope', () => {
    const state = makeState(corridorRows('PPPPE'));
    const l = defaultLoadout();
    l[1] = { ...l[1], attachment: 'scope' };
    l[3] = { ...l[3], attachment: 'scope' };
    const next = applyLoadout(state, l, 200);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => unit(next, id).attachment)).toEqual([null, 'scope', null, 'scope']);
  });
});

describe('stash with scopes', () => {
  const finished = () => {
    const s = makeState(corridorRows('PPPPE'));
    s.status = 'won';
    return s;
  };

  it('starts empty and lists scopes', () => {
    expect(emptyStash().scope).toBe(0);
    expect(describeStash({ ...emptyStash(), scope: 1 })).toBe('1 scope');
    expect(describeStash({ ...emptyStash(), scope: 3 })).toBe('3 scopes');
  });

  it('a survivor returns the scope, bought or lent; a dead soldier loses it', () => {
    const used = scoped();
    const alive = finished();
    unit(alive, 'p1').attachment = 'scope';
    expect(nextStash(emptyStash(), used, alive).scope).toBe(1);
    const lent = nextStash({ ...emptyStash(), scope: 1 }, used, alive);
    expect(lent.scope).toBe(1);
    const dead = finished();
    unit(dead, 'p1').attachment = 'scope';
    unit(dead, 'p1').alive = false;
    expect(nextStash({ ...emptyStash(), scope: 1 }, used, dead).scope).toBe(0);
    expect(nextStash(emptyStash(), used, dead).scope).toBe(0);
  });

  it('caps scopes at 4, adds them, and loot carries none', () => {
    const big = { ...emptyStash(), scope: 9 };
    expect(capStash(big).scope).toBe(4);
    expect(addStash(big, big).scope).toBe(18);
    expect(lootFrom(finished()).scope).toBe(0);
  });
});
