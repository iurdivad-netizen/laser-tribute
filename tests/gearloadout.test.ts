import { describe, expect, it } from 'vitest';
import { ATTACHMENTS, GADGETS, WEAPONS } from '../src/core/config';
import type { GearRules } from '../src/core/gear';
import { generateMission } from '../src/core/gen';
import {
  defaultLoadout, fitLoadout, loadoutCost, netSoldierCost, soldierCost, validateLoadout, type Loadout,
} from '../src/core/loadout';
import { createMission } from '../src/core/missions';
import { emptyStash, stashOf } from '../src/core/stash';

const rules: GearRules = {
  unlocks: { weapons: ['pistol', 'rifle'], throwables: ['frag'], gadgets: ['medkit'], attachments: [] },
  premium: 1.5,
};
const premiumOf = (base: number) => Math.round(base * 1.5);
const sniperKit = (): Loadout => defaultLoadout().map((s, i) => (i === 0 ? { ...s, weapon: 'sniper' as const } : s));

describe('level numbers behave as before', () => {
  it('locks the sniper below level 6 and allows it from level 6', () => {
    expect(validateLoadout(sniperKit(), 500, emptyStash(), 1)).toBe(`Soldier 1: the ${WEAPONS.sniper.name} is locked`);
    expect(validateLoadout(sniperKit(), 500, emptyStash(), 6)).toBeNull();
  });

  it('costs the same with and without a level', () => {
    const kit = sniperKit();
    expect(loadoutCost(kit, emptyStash())).toBe(kit.reduce((sum, s) => sum + soldierCost(s), 0));
  });

  it('keeps a locked weapon out of a fitted kit', () => {
    const fitted = fitLoadout(sniperKit(), 500, emptyStash(), 1);
    expect(fitted[0].weapon).toBe('pistol');
  });
});

describe('premium rules', () => {
  it('prices a locked weapon at the premium and allows it', () => {
    const kit = sniperKit();
    const base = soldierCost(kit[0]);
    expect(soldierCost(kit[0], rules)).toBe(base - WEAPONS.sniper.price + premiumOf(WEAPONS.sniper.price));
    expect(validateLoadout(kit, 500, emptyStash(), rules)).toBeNull();
    expect(validateLoadout(kit, 50, emptyStash(), rules)).toMatch(/budget is 50/);
  });

  it('leaves unlocked gear at base price', () => {
    const rifle = defaultLoadout()[0];
    expect(soldierCost(rifle, rules)).toBe(soldierCost(rifle));
  });

  it('prices a locked scope and armour at the premium', () => {
    const base = { weapon: 'rifle' as const, grenades: 0, clips: 1 };
    expect(soldierCost({ ...base, attachment: 'scope' }, rules)).toBe(soldierCost(base) + premiumOf(ATTACHMENTS.scope.price));
    expect(soldierCost({ ...base, gadget: 'armour' }, rules)).toBe(soldierCost(base) + premiumOf(GADGETS.armour.price));
    expect(soldierCost({ ...base, gadget: 'medkit' }, rules)).toBe(soldierCost(base) + GADGETS.medkit.price);
  });

  it('makes a stash item free at its premium price', () => {
    const kit = sniperKit();
    const without = loadoutCost(kit, emptyStash(), rules);
    const withStash = loadoutCost(kit, stashOf({ sniper: 1 }), rules);
    expect(without - withStash).toBe(premiumOf(WEAPONS.sniper.price));
    expect(netSoldierCost(kit, 0, stashOf({ sniper: 1 }), rules)).toBe(netSoldierCost(kit, 0, emptyStash(), rules) - premiumOf(WEAPONS.sniper.price));
  });

  it('rejects locked gear when there is no premium', () => {
    const noPremium: GearRules = { ...rules, premium: null };
    expect(validateLoadout(sniperKit(), 500, emptyStash(), noPremium)).toBe(`Soldier 1: the ${WEAPONS.sniper.name} is locked`);
    const armour = defaultLoadout().map((s, i) => (i === 0 ? { ...s, gadget: 'armour' as const } : s));
    expect(validateLoadout(armour, 500, emptyStash(), noPremium)).toMatch(/Soldier 1: .* is locked/);
  });

  it('builds a mission with a premium weapon', () => {
    const def = generateMission(0, 0);
    const s = createMission(def, 1, undefined, sniperKit(), 500, undefined, rules, 1);
    const first = s.units.filter((u) => u.side === 'player')[0];
    expect(first.weapon).toBe('sniper');
  });
});
