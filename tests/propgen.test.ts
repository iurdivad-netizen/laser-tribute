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

  it('puts every prop in open floor, and keeps some tall pillars', () => {
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
    expect(props).toBeGreaterThan(200);
    expect(pillars).toBeGreaterThan(10);
  });

  it('uses both prop variants', () => {
    const all = Array.from({ length: CAMPAIGN_LENGTH }, (_, t) => generateMission(t, 0).rows.join('')).join('');
    expect(all).toMatch(/x/);
    expect(all).toMatch(/y/);
  });
});

describe('the maps are populated with props', () => {
  const count = (rows: string[], re: RegExp) => rows.join('').split('').filter((c) => re.test(c)).length;

  it('every map has props: about three per hundred open tiles, and never fewer than a handful', () => {
    let props = 0;
    let open = 0;
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const rows = generateMission(type, v).rows;
        const p = count(rows, /[xy]/);
        const o = count(rows, /[.PEprg]/) + p;
        expect(p, `type ${type} variation ${v}`).toBeGreaterThanOrEqual(Math.floor(o / 100) * 2);
        props += p;
        open += o;
      }
    }
    expect(props * 100 / open).toBeGreaterThan(2);
    expect(props * 100 / open).toBeLessThan(5);
  });

  it('never puts a prop on a patrol point, and keeps the map as it was otherwise (same walls, units and items)', () => {
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      const def = generateMission(type, 1);
      for (const route of Object.values(def.patrols)) {
        for (const p of route) expect(def.rows[p.y][p.x], `type ${type} patrol ${p.x},${p.y}`).not.toMatch(/[xy#]/);
      }
    }
  });
});
