import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/core/gen/recipes';

describe('the ten recipes', () => {
  it('are in campaign order with the agreed names, sizes and enemy counts', () => {
    expect(RECIPES.map((r) => r.name)).toEqual([
      'Outpost', 'Warehouse', 'Compound', 'Bunker', 'Village', 'Factory', 'Station', 'Mine', 'Fortress', 'Citadel',
    ]);
    expect(RECIPES.map((r) => `${r.width}x${r.height}`)).toEqual([
      '30x20', '30x20', '30x20', '32x22', '36x24', '38x26', '40x26', '42x28', '46x30', '48x32',
    ]);
    expect(RECIPES.map((r) => r.enemies)).toEqual([4, 5, 6, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('have unique ids and a yard that fits inside the walls', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(10);
    for (const r of RECIPES) {
      if (r.yard) {
        expect(r.yard.w, r.name).toBeLessThanOrEqual(r.width - 2);
        expect(r.yard.h, r.name).toBeLessThanOrEqual(r.height - 2);
      }
      expect(r.minW, r.name).toBeGreaterThanOrEqual(4);
      expect(r.minH, r.name).toBeGreaterThanOrEqual(4);
    }
  });

  it('never get smaller as the campaign goes on', () => {
    for (let i = 1; i < RECIPES.length; i++) {
      expect(RECIPES[i].width).toBeGreaterThanOrEqual(RECIPES[i - 1].width);
      expect(RECIPES[i].height).toBeGreaterThanOrEqual(RECIPES[i - 1].height);
    }
  });
});
