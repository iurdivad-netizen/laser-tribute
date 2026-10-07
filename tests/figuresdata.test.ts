import { describe, expect, it } from 'vitest';
import { buildFigureData, renderModule } from '../scripts/figures-lib.mjs';
import { FIGURE_DATA, FIGURE_HEIGHT, FIGURE_WIDTH } from '../src/art/figures.generated';

const SIDES = ['squad', 'enemy'] as const;
const VIEWS = ['n', 'ne', 'e', 'se', 's'] as const;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('the generated figure data', () => {
  it('is 16 wide and at least 30 tall, for both sides and all five views', () => {
    expect(FIGURE_WIDTH).toBe(16);
    expect(FIGURE_HEIGHT).toBeGreaterThanOrEqual(30);
    for (const side of SIDES) {
      for (const view of VIEWS) {
        const rows = FIGURE_DATA[side].views[view];
        expect(rows, `${side} ${view}`).toHaveLength(FIGURE_HEIGHT);
        for (const row of rows) expect(row).toHaveLength(FIGURE_WIDTH);
      }
    }
  });

  it('uses only valid hex colours and palette indexes, with the feet on the bottom row of every view', () => {
    for (const side of SIDES) {
      const { palette, views } = FIGURE_DATA[side];
      expect(palette.length).toBeGreaterThan(3);
      expect(palette.length).toBeLessThanOrEqual(62);
      for (const hex of palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      for (const view of VIEWS) {
        for (const row of views[view]) {
          for (const ch of row) {
            if (ch === '.') continue;
            expect(DIGITS.indexOf(ch), `${side} ${view} '${ch}'`).toBeGreaterThanOrEqual(0);
            expect(DIGITS.indexOf(ch), `${side} ${view} '${ch}'`).toBeLessThan(palette.length);
          }
        }
        expect(views[view][FIGURE_HEIGHT - 1].replace(/\./g, ''), `${side} ${view} feet`).not.toBe('');
      }
    }
  });

  it('the squad is bluer than red and the enemy redder than blue', () => {
    const balance = (side: (typeof SIDES)[number]) => {
      const { palette, views } = FIGURE_DATA[side];
      let sum = 0;
      for (const view of VIEWS) {
        for (const row of views[view]) {
          for (const ch of row) {
            if (ch === '.') continue;
            const hex = palette[DIGITS.indexOf(ch)];
            sum += parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16); // red minus blue
          }
        }
      }
      return sum;
    };
    expect(balance('squad')).toBeLessThan(0);
    expect(balance('enemy')).toBeGreaterThan(0);
  });

  it('matches what the converter makes from the committed PNGs', () => {
    const made = buildFigureData('art-src/pixellab');
    expect(made.width).toBe(FIGURE_WIDTH);
    expect(made.height).toBe(FIGURE_HEIGHT);
    expect(made.sides).toEqual(FIGURE_DATA);
    expect(renderModule(made)).toContain('FIGURE_DATA');
  });
});
