import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import {
  applyEquipmentHit, blockReasonFor, changeClips, clipBlockReason, equipmentHit,
} from '../src/screens/equipment';

describe('spare clip controls', () => {
  it('adds clips up to 4 and each extra clip costs 5', () => {
    let l = changeClips(defaultLoadout(), 0, 1);
    expect(l[0].clips).toBe(2);
    expect(loadoutCost(l)).toBe(107);
    l = changeClips(l, 0, 1);
    l = changeClips(l, 0, 1);
    expect(l[0].clips).toBe(4);
    expect(clipBlockReason(l, 0, 1)).toBe('Max 4 spare clips');
    expect(changeClips(l, 0, 1)).toBe(l);
  });

  it('cannot go below one clip', () => {
    const l = defaultLoadout();
    expect(clipBlockReason(l, 0, -1)).toBe('At least 1 spare clip');
    expect(changeClips(l, 0, -1)).toBe(l);
  });

  it('is blocked when the credits run out and says how many are missing', () => {
    let l = changeClips(defaultLoadout(), 0, 1);
    l = changeClips(l, 0, 1);
    l = changeClips(l, 0, 1); // cost 117, 3 credits left
    expect(clipBlockReason(l, 1, 1)).toBe('Need 2 more credits'); // 117 + 5 - 120
    expect(changeClips(l, 1, 1)).toBe(l);
  });

  it('removing a clip is always allowed and gives the credits back', () => {
    const l = changeClips(defaultLoadout(), 0, 1);
    const back = changeClips(l, 0, -1);
    expect(back[0].clips).toBe(1);
    expect(loadoutCost(back)).toBe(102);
  });

  it('does not mutate its input', () => {
    const l = defaultLoadout();
    changeClips(l, 0, 1);
    expect(l[0].clips).toBe(1);
  });

  it('respects the given budget', () => {
    expect(clipBlockReason(defaultLoadout(), 0, 1, 102)).toBe('Need 5 more credits');
    expect(clipBlockReason(defaultLoadout(), 0, 1, 107)).toBeNull();
  });
});

describe('clip buttons', () => {
  it('are hit-tested on a second line under the grenade controls', () => {
    expect(equipmentHit(260, 86)).toEqual({ kind: 'clipMinus', index: 0 });
    expect(equipmentHit(320, 86)).toEqual({ kind: 'clipPlus', index: 0 });
    expect(equipmentHit(260, 242)).toEqual({ kind: 'clipMinus', index: 3 });
    expect(equipmentHit(260, 68)).toEqual({ kind: 'minus', index: 0 }); // the grenade line is unchanged
    expect(equipmentHit(200, 86)).toBeNull();
  });

  it('are explained and applied through the generic hit helpers', () => {
    const l = defaultLoadout();
    expect(blockReasonFor(l, { kind: 'clipMinus', index: 0 })).toBe('At least 1 spare clip');
    expect(blockReasonFor(l, { kind: 'clipPlus', index: 0 })).toBeNull();
    expect(applyEquipmentHit(l, { kind: 'clipPlus', index: 0 })[0].clips).toBe(2);
    expect(applyEquipmentHit(l, { kind: 'clipMinus', index: 0 })).toBe(l);
  });
});
