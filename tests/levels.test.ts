import { describe, expect, it } from 'vitest';
import { levelOf, newCampaign } from '../src/core/campaign';
import { defaultLoadout, fitLoadout, validateLoadout } from '../src/core/loadout';
import { stashOf } from '../src/core/stash';

const withWeapon = (weapon: 'shotgun' | 'smg' | 'sniper') => defaultLoadout().map((s, i) => (i === 0 ? { ...s, weapon } : s));
const withThrowable = (throwable: 'smoke' | 'flash' | 'incendiary') => defaultLoadout().map((s, i) => (i === 0 ? { ...s, throwable } : s));

describe('unlock levels', () => {
  it('the tutorial is level 1 and a campaign mission is its number', () => {
    expect(levelOf(newCampaign('tutorial'))).toBe(1);
    const c = newCampaign('campaign', Array(10).fill(0));
    expect(levelOf(c)).toBe(1);
    expect(levelOf({ ...c, missionIndex: 5 })).toBe(6);
    const t = newCampaign('tutorial');
    expect(levelOf({ ...t, missionIndex: 2 })).toBe(1);
  });

  it('rejects a locked weapon and throwable, accepts them at their level', () => {
    expect(validateLoadout(withWeapon('shotgun'), 999)).toMatch(/shotgun|locked/i);
    expect(validateLoadout(withWeapon('shotgun'), 999, undefined, 2)).toBeNull();
    expect(validateLoadout(withWeapon('smg'), 999, undefined, 3)).not.toBeNull();
    expect(validateLoadout(withWeapon('smg'), 999, undefined, 4)).toBeNull();
    expect(validateLoadout(withWeapon('sniper'), 999, undefined, 5)).not.toBeNull();
    expect(validateLoadout(withWeapon('sniper'), 999, undefined, 6)).toBeNull();
    expect(validateLoadout(withThrowable('smoke'), 999, undefined, 1)).not.toBeNull();
    expect(validateLoadout(withThrowable('smoke'), 999, undefined, 2)).toBeNull();
    expect(validateLoadout(withThrowable('incendiary'), 999, undefined, 5)).not.toBeNull();
  });

  it('allows a locked item when the stash holds one', () => {
    expect(validateLoadout(withWeapon('sniper'), 999, stashOf({ sniper: 1 }), 1)).toBeNull();
    expect(validateLoadout(withThrowable('flash'), 999, stashOf({ flash: 1 }), 1)).toBeNull();
  });

  it('fitLoadout drops a locked item the level no longer allows', () => {
    const fitted = fitLoadout(withWeapon('sniper'), 999, undefined, 1);
    expect(validateLoadout(fitted, 999, undefined, 1)).toBeNull();
    expect(fitted[0].weapon).not.toBe('sniper');
  });
});
