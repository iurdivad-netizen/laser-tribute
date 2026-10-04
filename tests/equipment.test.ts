import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';
import {
  applyEquipmentHit, blockReasonFor, changeGrenades, drawEquipment, equipmentHit, grenadeBlockReason,
  toggleBlockReason, toggleWeapon,
} from '../src/screens/equipment';

describe('weapon toggle', () => {
  it('swaps pistol to rifle when there are enough credits', () => {
    const l = toggleWeapon(defaultLoadout(), 2); // +15: 102 -> 117
    expect(l[2].weapon).toBe('rifle');
    expect(loadoutCost(l)).toBe(117);
  });

  it('blocks a swap that would break the budget and returns the same loadout', () => {
    const l = toggleWeapon(defaultLoadout(), 2);
    expect(toggleBlockReason(l, 3)).toBe('Need 12 more credits');
    expect(toggleWeapon(l, 3)).toBe(l);
  });

  it('always allows rifle to pistol and frees credits', () => {
    const l = toggleWeapon(defaultLoadout(), 0);
    expect(l[0].weapon).toBe('pistol');
    expect(loadoutCost(l)).toBe(87);
  });

  it('does not mutate the input', () => {
    const l = defaultLoadout();
    toggleWeapon(l, 2);
    expect(l[2].weapon).toBe('pistol');
  });
});

describe('grenades', () => {
  it('adds grenades up to the cap of 3', () => {
    let l = changeGrenades(defaultLoadout(), 0, 1); // 2 grenades, cost 110
    l = changeGrenades(l, 0, 1); // 3 grenades, cost 118
    expect(l[0].grenades).toBe(3);
    expect(grenadeBlockReason(l, 0, 1)).toBe('Max 3 grenades');
    expect(changeGrenades(l, 0, 1)).toBe(l);
  });

  it('is blocked when the credits run out', () => {
    let l = changeGrenades(defaultLoadout(), 0, 1);
    l = changeGrenades(l, 0, 1); // cost 118
    expect(grenadeBlockReason(l, 1, 1)).toBe('Need 6 more credits');
    expect(changeGrenades(l, 1, 1)).toBe(l);
  });

  it('cannot go below zero', () => {
    const l = changeGrenades(defaultLoadout(), 0, -1);
    expect(l[0].grenades).toBe(0);
    expect(grenadeBlockReason(l, 0, -1)).toBe('No grenades to remove');
    expect(changeGrenades(l, 0, -1)).toBe(l);
  });
});

describe('equipmentHit', () => {
  it('finds the weapon, minus, plus and start buttons', () => {
    expect(equipmentHit(100, 68)).toEqual({ kind: 'weapon', index: 0 });
    expect(equipmentHit(100, 120)).toEqual({ kind: 'weapon', index: 1 });
    expect(equipmentHit(270, 172)).toEqual({ kind: 'minus', index: 2 });
    expect(equipmentHit(330, 224)).toEqual({ kind: 'plus', index: 3 });
    expect(equipmentHit(240, 345)).toEqual({ kind: 'start' });
  });

  it('returns null over empty space', () => {
    expect(equipmentHit(5, 5)).toBeNull();
    expect(equipmentHit(200, 68)).toBeNull();
  });
});

describe('blockReasonFor and applyEquipmentHit', () => {
  it('explains a blocked control and applies an allowed one', () => {
    const l = toggleWeapon(defaultLoadout(), 2);
    expect(blockReasonFor(l, { kind: 'weapon', index: 3 })).toBe('Need 12 more credits');
    expect(blockReasonFor(l, { kind: 'weapon', index: 0 })).toBeNull();
    expect(applyEquipmentHit(l, { kind: 'weapon', index: 3 })).toBe(l);
    expect(applyEquipmentHit(l, { kind: 'minus', index: 0 })[0].grenades).toBe(0);
    expect(blockReasonFor(l, { kind: 'plus', index: 0 })).toBe('Need 5 more credits'); // 117 + 8
    expect(applyEquipmentHit(l, { kind: 'plus', index: 0 })).toBe(l);
    const base = defaultLoadout();
    expect(applyEquipmentHit(base, { kind: 'plus', index: 0 })[0].grenades).toBe(2);
  });

  it('start is allowed for a valid loadout and leaves it unchanged', () => {
    const l = defaultLoadout();
    expect(blockReasonFor(l, { kind: 'start' })).toBeNull();
    expect(applyEquipmentHit(l, { kind: 'start' })).toBe(l);
  });

  it('start is blocked for an invalid loadout', () => {
    const l = defaultLoadout();
    l[0].grenades = 9;
    expect(blockReasonFor(l, { kind: 'start' })).toMatch(/grenades/);
  });
});

describe('with a bigger budget', () => {
  it('lets more weapons be swapped and grenades added', () => {
    let l = toggleWeapon(defaultLoadout(), 2, 160); // 117
    l = toggleWeapon(l, 3, 160); // 132
    expect(l.map((s) => s.weapon)).toEqual(['rifle', 'rifle', 'rifle', 'rifle']);
    expect(toggleBlockReason(defaultLoadout(), 2, 160)).toBeNull();
    l = changeGrenades(l, 0, 1, 160); // 140
    expect(l[0].grenades).toBe(2);
    expect(grenadeBlockReason(l, 1, 1, 130)).toBe('Need 18 more credits'); // 140 + 8 - 130
  });

  it('reports the start block against the given budget', () => {
    const l = defaultLoadout();
    l[0].grenades = 3;
    l[1].grenades = 3;
    l[2].weapon = 'rifle';
    l[3].weapon = 'rifle'; // cost 164
    expect(blockReasonFor(l, { kind: 'start' }, 120)).toMatch(/budget/);
    expect(blockReasonFor(l, { kind: 'start' }, 200)).toBeNull();
  });
});

describe('drawEquipment', () => {
  it('draws only supported text and keeps every label inside its button', () => {
    const runs: { text: string; x: number; y: number; width: number; align: string }[] = [];
    const stop = onText((r) => runs.push(r));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawEquipment(ctx, defaultLoadout(), null, {
      budget: 200,
      title: 'MISSION 3 OF 3: COMPOUND',
      breakdown: 'Base 120 + wins 40 + kills 40',
      soldiers: [
        { name: 'Lindqvist 2', kills: 99, rank: 'Sergeant' },
        { name: 'Alvarez', kills: 0, rank: 'Rookie' },
        { name: 'Brandt', kills: 4, rank: 'Private' },
        { name: 'Chen', kills: 12, rank: 'Captain' },
      ],
      stash: { rifle: 2, pistol: 1, grenade: 3 },
    });
    stop();
    for (const r of runs) expect(unsupportedChars(r.text), r.text).toEqual([]);
    const name = runs.find((r) => r.text === 'Lindqvist 2')!;
    expect(name.x + textWidth(name.text)).toBeLessThanOrEqual(76); // clear of the weapon button at x 76
    const start = runs.find((r) => r.text.startsWith('START MISSION'))!;
    expect(textWidth(start.text) + 6).toBeLessThanOrEqual(140);
  });
});
