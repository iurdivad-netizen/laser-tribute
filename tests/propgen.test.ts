import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, generateMission } from '../src/core/gen';
import { checkMission, expectFor } from '../src/core/gen/check';
import { RECIPES } from '../src/core/gen/recipes';

const OPEN = new Set(['.', 'P', 'E', 'r', 'p', 'g']);

describe('props in generated maps', () => {
  it('every map type and variation still passes the playability checks', () => {
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const def = generateMission(type, v);
        expect(checkMission(def, expectFor(RECIPES[type])), `type ${type} variation ${v}`).toEqual([]);
      }
    }
  });

  it('puts props where the cover blocks were: about two thirds of the blocks, and every prop stands in open floor', () => {
    let props = 0;
    let pillars = 0;
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const rows = generateMission(type, v).rows;
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
          const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => rows[y + dy]?.[x + dx]));
          if (ch === 'x' || ch === 'y') {
            props++;
            expect(around.every((c) => c !== undefined && OPEN.has(c)), `prop at ${x},${y} of ${type}/${v}`).toBe(true);
          } else if (ch === '#' && around.every((c) => c !== undefined && OPEN.has(c))) {
            pillars++; // a lone wall block with open floor all round: a tall pillar
          }
        }));
      }
    }
    expect(props).toBeGreaterThan(50);
    expect(pillars).toBeGreaterThan(10);
    const share = props / (props + pillars);
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.8);
  });

  it('uses both prop variants', () => {
    const all = Array.from({ length: CAMPAIGN_LENGTH }, (_, t) => generateMission(t, 0).rows.join('')).join('');
    expect(all).toMatch(/x/);
    expect(all).toMatch(/y/);
  });
});
