import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/core/config';
import type { GearRules } from '../src/core/gear';
import { defaultLoadout, loadoutCost, type Loadout } from '../src/core/loadout';
import { emptyStash } from '../src/core/stash';
import {
  applyEquipmentHit, cycleGadget, drawEquipment, nextThrowable, nextWeapon, scopeBlockReason, toggleScope,
  type EquipmentView,
} from '../src/screens/equipment';
import { unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

const rules = (premium: number | null): GearRules => ({
  unlocks: { weapons: ['pistol', 'rifle'], throwables: ['frag'], gadgets: ['medkit'], attachments: [] },
  premium,
});
const kit = (): Loadout => defaultLoadout();

describe('level numbers cycle as before', () => {
  it('cycles weapons by level', () => {
    expect(nextWeapon(kit(), 0, 1, emptyStash())).toBe('pistol');
    expect(nextWeapon(kit(), 0, 6, emptyStash())).toBe('shotgun');
  });

  it('cycles throwables by level', () => {
    expect(nextThrowable(kit(), 0, 1, emptyStash())).toBe('frag');
    expect(nextThrowable(kit(), 0, 2, emptyStash())).toBe('smoke');
  });

  it('cycles every gadget and allows the scope', () => {
    const l = kit().map((s, i) => (i === 0 ? { ...s, gadget: 'medkit' as const } : s));
    expect(cycleGadget(l, 0, 500, emptyStash(), 1)[0].gadget).toBe('armour');
    expect(scopeBlockReason(kit(), 0, 500, emptyStash(), 1)).toBeNull();
  });
});

describe('story rules', () => {
  it('offers locked weapons and throwables only with a premium', () => {
    expect(nextWeapon(kit(), 0, rules(1.5), emptyStash())).toBe('shotgun');
    expect(nextWeapon(kit(), 0, rules(null), emptyStash())).toBe('pistol');
    expect(nextThrowable(kit(), 0, rules(1.5), emptyStash())).toBe('smoke');
    expect(nextThrowable(kit(), 0, rules(null), emptyStash())).toBe('frag');
  });

  it('skips locked gadgets without a premium and offers them with one', () => {
    const l = kit().map((s, i) => (i === 0 ? { ...s, gadget: 'medkit' as const } : s));
    expect(cycleGadget(l, 0, 500, emptyStash(), rules(null))[0].gadget).toBeUndefined();
    expect(cycleGadget(l, 0, 500, emptyStash(), rules(1.5))[0].gadget).toBe('armour');
  });

  it('refuses a locked scope without a premium and lets a premium buy it', () => {
    expect(scopeBlockReason(kit(), 0, 500, emptyStash(), rules(null))).toMatch(/locked/i);
    expect(scopeBlockReason(kit(), 0, 500, emptyStash(), rules(1.5))).toBeNull();
    expect(toggleScope(kit(), 0, 500, emptyStash(), rules(1.5))[0].attachment).toBe('scope');
  });

  it('counts the premium when a weapon swap is paid for', () => {
    // rifle -> shotgun costs more at a premium; a tight budget blocks it
    const tight = applyEquipmentHit(kit(), { kind: 'weapon', index: 0 }, 5, emptyStash(), rules(1.5));
    expect(tight[0].weapon).toBe('rifle');
    const roomy = applyEquipmentHit(kit(), { kind: 'weapon', index: 0 }, 500, emptyStash(), rules(1.5));
    expect(roomy[0].weapon).toBe('shotgun');
  });
});

describe('the weapon cycle under tight credits (story)', () => {
  it('skips a premium weapon it cannot afford instead of getting stuck, so cheap weapons stay reachable', () => {
    const base = kit();
    const budget = loadoutCost(base, emptyStash(), rules(1.5)) + 20;
    let l = base;
    const taps: string[] = [];
    for (let n = 0; n < 5; n++) {
      l = applyEquipmentHit(l, { kind: 'weapon', index: 0 }, budget, emptyStash(), rules(1.5));
      taps.push(l[0].weapon);
    }
    expect(taps.slice(0, 3)).toEqual(['shotgun', 'smg', 'pistol']); // the sniper (60) does not fit, so it is skipped
    expect(taps[3]).toBe('rifle');
  });

  it('is unchanged for level numbers: a refused step still blocks', () => {
    const base = kit().map((s, i) => (i === 0 ? { ...s, weapon: 'smg' as const } : s));
    const budget = loadoutCost(base) + 3;
    const next = applyEquipmentHit(base, { kind: 'weapon', index: 0 }, budget, emptyStash(), 6);
    expect(next[0].weapon).toBe('smg'); // level 6: the sniper costs more than the slack, so the tap is refused, as before
  });
});

describe('drawing with story rules', () => {
  const view = (level: EquipmentView['level']): EquipmentView => ({
    budget: 200, title: 'ASHFALL RIDGE: 4 ENEMIES', breakdown: 'Base', soldiers: [], stash: emptyStash(), level,
  });

  it('shows the premium price of a locked weapon and only supported characters', () => {
    const l = kit().map((s, i) => (i === 0 ? { ...s, weapon: 'sniper' as const } : s));
    const runs: string[] = [];
    const stop = onText((r) => runs.push(r.text));
    drawEquipment(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D, l, null, view(rules(1.5)));
    stop();
    expect(runs).toContain(`${WEAPONS.sniper.name} (${Math.round(WEAPONS.sniper.price * 1.5)})`);
    for (const t of runs) expect(unsupportedChars(t), t).toEqual([]);
  });
});
