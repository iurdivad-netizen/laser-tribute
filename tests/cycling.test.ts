import { describe, expect, it } from 'vitest';
import { defaultLoadout } from '../src/core/loadout';
import { emptyStash, stashOf } from '../src/core/stash';
import { actionCost, throwLabel } from '../src/render/panel';
import {
  EQ, applyEquipmentHit, blockReasonFor, cycleThrowable, equipmentHit, nextThrowable, nextWeapon, throwableBlockReason,
} from '../src/screens/equipment';
import { corridorRows, makeState, unit } from './helpers';

const l = () => defaultLoadout();
const withWeapon = (weapon: 'rifle' | 'shotgun') => l().map((s, i) => (i === 2 ? { ...s, weapon } : s));

describe('cycling weapons and throwables', () => {
  it('steps through the weapons unlocked at the level, wrapping around', () => {
    expect(nextWeapon(l(), 2, 1, emptyStash())).toBe('rifle');
    expect(nextWeapon(withWeapon('rifle'), 2, 1, emptyStash())).toBe('pistol');
    expect(nextWeapon(withWeapon('rifle'), 2, 2, emptyStash())).toBe('shotgun');
    expect(nextWeapon(withWeapon('shotgun'), 2, 6, emptyStash())).toBe('smg');
    expect(nextWeapon(withWeapon('shotgun'), 2, 2, emptyStash())).toBe('pistol');
  });

  it('offers a stash weapon even when locked', () => {
    expect(nextWeapon(withWeapon('rifle'), 2, 1, stashOf({ sniper: 1 }))).toBe('sniper');
  });

  it('steps through the unlocked throwables, frag first', () => {
    expect(nextThrowable(l(), 0, 1, emptyStash())).toBe('frag');
    expect(nextThrowable(l(), 0, 2, emptyStash())).toBe('smoke');
    const smoke = l().map((s, i) => (i === 0 ? { ...s, throwable: 'smoke' as const } : s));
    expect(nextThrowable(smoke, 0, 4, emptyStash())).toBe('flash');
    expect(nextThrowable(smoke, 0, 2, emptyStash())).toBe('frag');
  });

  it('the throwable button changes the kind, and refuses when it breaks the budget or nothing else is unlocked', () => {
    const hit = { kind: 'throwable', index: 0 } as const;
    expect(applyEquipmentHit(l(), hit, 999, emptyStash(), 2)[0].throwable).toBe('smoke');
    const three = l().map((s) => ({ ...s, grenades: 3 }));
    expect(blockReasonFor(three, hit, 20, emptyStash(), 2)).not.toBeNull();
    expect(applyEquipmentHit(three, hit, 20, emptyStash(), 2)).toBe(three);
    expect(throwableBlockReason(l(), 0, 999, emptyStash(), 1)).toMatch(/unlocked/);
    expect(cycleThrowable(l(), 0, 999, emptyStash(), 1)).toEqual(l());
  });

  it('the weapon button uses the level', () => {
    const rifle = withWeapon('rifle');
    expect(applyEquipmentHit(rifle, { kind: 'weapon', index: 2 }, 999, emptyStash(), 2)[2].weapon).toBe('shotgun');
  });

  it('hit-tests the throwable button on the weapon row', () => {
    expect(equipmentHit(EQ.throwable.x + 4, 60)).toEqual({ kind: 'throwable', index: 0 });
    expect(equipmentHit(EQ.throwable.x + 4, 60 + 52)).toEqual({ kind: 'throwable', index: 1 });
  });
});

describe('the throw button', () => {
  it('costs the kind AP and is labelled with the kind and the count', () => {
    const s = makeState(corridorRows('P..E'));
    const u = unit(s, 'p1');
    u.throwable = 'smoke';
    u.grenades = 2;
    expect(actionCost(u, 'throw')).toBe(18);
    expect(throwLabel(u)).toBe('SMOKE (2)');
    u.throwable = 'incendiary';
    expect(actionCost(u, 'throw')).toBe(24);
    expect(throwLabel(u)).toBe('INCENDIARY (2)');
  });
});
