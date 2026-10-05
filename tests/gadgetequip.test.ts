import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { emptyStash } from '../src/core/stash';
import {
  EQ, applyEquipmentHit, blockReasonFor, cycleGadget, drawEquipment, equipmentHit,
} from '../src/screens/equipment';
import { onText } from '../src/ui/text';

describe('gadget button on the equipment screen', () => {
  it('sits under the weapon button of each row and is found by equipmentHit', () => {
    for (let i = 0; i < 4; i++) {
      const y = EQ.rowTop + i * EQ.rowStep + EQ.clipDy + 2;
      expect(equipmentHit(EQ.gadget.x + 2, y)).toEqual({ kind: 'gadget', index: i });
    }
  });

  it('cycles none, medkit, armour, scanner, none', () => {
    let l = defaultLoadout();
    const seen: (string | undefined)[] = [];
    for (let n = 0; n < 5; n++) {
      l = cycleGadget(l, 0, 500, emptyStash());
      seen.push(l[0].gadget);
    }
    expect(seen).toEqual(['medkit', 'armour', 'scanner', undefined, 'medkit']);
  });

  it('skips a gadget the budget cannot pay for', () => {
    const l = defaultLoadout();
    const budget = loadoutCost(l) + 13; // a medkit (12) fits, armour (20) does not, a scanner (15) does not
    const first = cycleGadget(l, 0, budget, emptyStash());
    expect(first[0].gadget).toBe('medkit');
    const second = cycleGadget(first, 0, budget, emptyStash());
    expect(second[0].gadget).toBeUndefined();
  });

  it('applyEquipmentHit cycles, and hovering never shows a block reason for the gadget button', () => {
    const l = defaultLoadout();
    expect(applyEquipmentHit(l, { kind: 'gadget', index: 2 }, 500, emptyStash())[2].gadget).toBe('medkit');
    expect(blockReasonFor(l, { kind: 'gadget', index: 2 }, 500, emptyStash())).toBeNull();
  });

  it('shows the label and price, FREE from the stash, and found gadgets in the line', () => {
    const l = defaultLoadout();
    l[0] = { ...l[0], gadget: 'armour' };
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawEquipment(ctx, l, null, {
      budget: 500, title: 'T', breakdown: '', soldiers: [], stash: { ...emptyStash(), armour: 1, medkit: 1 },
    });
    stop();
    expect(texts).toContain('ARMOUR (FREE)');
    expect(texts).toContain('NO GADGET');
    expect(texts.some((t) => t.includes('1 medkit') && t.includes('1 armour'))).toBe(true);
  });
});
