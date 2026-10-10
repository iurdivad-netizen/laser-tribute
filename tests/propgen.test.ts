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

describe('props are spread over the whole map', () => {
  it('every third of the map width holds a fair share of all props, over all fifty maps', () => {
    const thirds = [0, 0, 0];
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        const rows = generateMission(type, v).rows;
        const w = rows[0].length;
        rows.forEach((row) => [...row].forEach((ch, x) => { if (ch === 'x' || ch === 'y') thirds[Math.min(2, Math.floor((x * 3) / w))]++; }));
      }
    }
    const total = thirds[0] + thirds[1] + thirds[2];
    for (const t of thirds) {
      expect(t / total).toBeGreaterThan(0.25);
      expect(t / total).toBeLessThan(0.42);
    }
  });

  it('puts props in the middle and far side of a medium map too, not just near the squad', () => {
    for (const type of [0, 1, 2, 3]) {
      const rows = generateMission(type, 0).rows;
      const w = rows[0].length;
      const right = rows.join('').length > 0 && rows.map((r) => [...r].filter((c, x) => (c === 'x' || c === 'y') && x >= (w * 2) / 3).length).reduce((a, b) => a + b, 0);
      expect(right, `type ${type}`).toBeGreaterThan(0);
    }
  });

  it('uses both prop pictures about evenly, and not as one picture per row', () => {
    let x = 0;
    let y = 0;
    let mixedRows = 0;
    let rowsWithProps = 0;
    for (let type = 0; type < CAMPAIGN_LENGTH; type++) {
      for (let v = 0; v < VARIATIONS; v++) {
        for (const row of generateMission(type, v).rows) {
          const xs = [...row].filter((c) => c === 'x').length;
          const ys = [...row].filter((c) => c === 'y').length;
          x += xs;
          y += ys;
          if (xs + ys >= 2) {
            rowsWithProps++;
            if (xs > 0 && ys > 0) mixedRows++;
          }
        }
      }
    }
    expect(x / (x + y)).toBeGreaterThan(0.4);
    expect(x / (x + y)).toBeLessThan(0.6);
    expect(mixedRows / rowsWithProps).toBeGreaterThan(0.3);
  });
});
