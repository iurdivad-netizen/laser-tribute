import { describe, expect, it } from 'vitest';
import { ATTACHMENT_IDS, GADGET_IDS, unlockedThrowables, unlockedWeapons } from '../src/core/config';
import { gearRulesOf, priceFactor, unlocked, unlocksFromLevel, type GearRules } from '../src/core/gear';

describe('unlocksFromLevel', () => {
  it('reproduces today\'s sets for every level 1 to 10', () => {
    for (let level = 1; level <= 10; level++) {
      const u = unlocksFromLevel(level);
      expect(u.weapons).toEqual(unlockedWeapons(level));
      expect(u.throwables).toEqual(unlockedThrowables(level));
      expect(u.gadgets).toEqual(GADGET_IDS);
      expect(u.attachments).toEqual(ATTACHMENT_IDS);
    }
  });
});

describe('gearRulesOf', () => {
  it('turns a level into rules with no premium', () => {
    const r = gearRulesOf(3);
    expect(r.premium).toBeNull();
    expect(r.unlocks).toEqual(unlocksFromLevel(3));
  });

  it('returns rules unchanged', () => {
    const rules: GearRules = { unlocks: unlocksFromLevel(1), premium: 1.5 };
    expect(gearRulesOf(rules)).toBe(rules);
  });
});

describe('unlocked and priceFactor', () => {
  const rules: GearRules = {
    unlocks: { weapons: ['pistol', 'rifle'], throwables: ['frag'], gadgets: ['medkit'], attachments: [] },
    premium: 1.5,
  };

  it('knows what is unlocked', () => {
    expect(unlocked(rules, 'weapon', 'rifle')).toBe(true);
    expect(unlocked(rules, 'weapon', 'sniper')).toBe(false);
    expect(unlocked(rules, 'throwable', 'smoke')).toBe(false);
    expect(unlocked(rules, 'gadget', 'medkit')).toBe(true);
    expect(unlocked(rules, 'attachment', 'scope')).toBe(false);
  });

  it('charges the premium only for locked gear', () => {
    expect(priceFactor(rules, 'weapon', 'sniper')).toBe(1.5);
    expect(priceFactor(rules, 'weapon', 'rifle')).toBe(1);
    expect(priceFactor(rules, 'attachment', 'scope')).toBe(1.5);
  });

  it('never charges a premium without one', () => {
    const none: GearRules = { ...rules, premium: null };
    expect(priceFactor(none, 'weapon', 'sniper')).toBe(1);
    expect(priceFactor(none, 'attachment', 'scope')).toBe(1);
  });
});
