import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutCost } from '../src/core/loadout';
import { emptyStash } from '../src/core/stash';
import {
  EQ, applyEquipmentHit, blockReasonFor, drawEquipment, equipmentHit, scopeBlockReason, toggleScope,
} from '../src/screens/equipment';
import { onText } from '../src/ui/text';

describe('SCOPE toggle on the equipment screen', () => {
  it('sits at the right end of the second line of each row and is found by equipmentHit', () => {
    for (let i = 0; i < 4; i++) {
      const y = EQ.rowTop + i * EQ.rowStep + EQ.clipDy + 2;
      expect(equipmentHit(EQ.scope.x + 2, y)).toEqual({ kind: 'scope', index: i });
    }
  });

  it('toggles on and off', () => {
    const on = toggleScope(defaultLoadout(), 1, 500, emptyStash());
    expect(on[1].attachment).toBe('scope');
    const off = toggleScope(on, 1, 500, emptyStash());
    expect(off[1].attachment).toBeUndefined();
  });

  it('stays off when the budget cannot pay 18, and says why on hover', () => {
    const l = defaultLoadout();
    const budget = loadoutCost(l) + 17;
    expect(toggleScope(l, 0, budget, emptyStash())).toBe(l);
    expect(scopeBlockReason(l, 0, budget, emptyStash())).toBe('Need 1 more credits');
    expect(blockReasonFor(l, { kind: 'scope', index: 0 }, budget, emptyStash())).toBe('Need 1 more credits');
    expect(scopeBlockReason(l, 0, budget + 1, emptyStash())).toBeNull();
  });

  it('turning a scope off is always allowed, and applyEquipmentHit toggles', () => {
    const l = toggleScope(defaultLoadout(), 2, 500, emptyStash());
    expect(scopeBlockReason(l, 2, 0, emptyStash())).toBeNull();
    expect(applyEquipmentHit(defaultLoadout(), { kind: 'scope', index: 3 }, 500, emptyStash())[3].attachment).toBe('scope');
  });

  it('shows the label, the price and FREE from the stash, and found scopes in the line', () => {
    const l = toggleScope(defaultLoadout(), 0, 500, emptyStash());
    const texts: string[] = [];
    const stop = onText((r) => texts.push(r.text));
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    const view = { budget: 500, title: 'T', breakdown: '', soldiers: [] };
    drawEquipment(ctx, l, null, { ...view, stash: emptyStash() });
    expect(texts).toContain('SCOPE (18)');
    expect(texts).toContain('NO SCOPE');
    texts.length = 0;
    drawEquipment(ctx, l, null, { ...view, stash: { ...emptyStash(), scope: 2 } });
    stop();
    expect(texts).toContain('SCOPE (FREE)');
    expect(texts.some((t) => t.includes('2 scopes'))).toBe(true);
  });
});
