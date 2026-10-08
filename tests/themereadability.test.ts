import { describe, expect, it } from 'vitest';
import type { Figure } from '../src/art/figure';
import { imageOf } from '../src/art/image';
import { luminance } from '../src/art/recolour';
import { THEMES, tileImage } from '../src/art/theme';
import { THEME_IDS } from '../src/core/themes';

const SQUAD = '#174fa2';
const ENEMY = '#852131';
const METAL = '#d0d0d0';
const BLOOD = '#b3262c';

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const meanLum = (f: Figure) => {
  const px = f.pixels.filter((p): p is string => p !== null);
  return px.reduce((s, p) => s + luminance(p), 0) / px.length;
};
const meanRgb = (f: Figure): [number, number, number] => {
  const px = f.pixels.filter((p): p is string => p !== null);
  const sum = [0, 0, 0];
  for (const p of px) [1, 3, 5].forEach((i, k) => { sum[k] += parseInt(p.slice(i, i + 2), 16); });
  return sum.map((v) => v / px.length) as [number, number, number];
};
const hue = ([r, g, b]: [number, number, number]) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

const floors = (id: string) => [0, 1, 2].map((v) => tileImage(id, 'floor', false, v, 0)).concat(tileImage(id, 'floor', false, 1, 1));
const worst = (id: string, against: string) => Math.min(...floors(id).map((f) => contrast(meanLum(f), luminance(against))));

describe('every theme keeps the map readable', () => {
  const baseSquad = worst('base', SQUAD);
  const baseEnemy = worst('base', ENEMY);

  for (const id of THEME_IDS) {
    describe(THEMES[id].name, () => {
      it('keeps soldiers and enemies readable against its floors (at least 80% of the base contrast)', () => {
        expect(worst(id, SQUAD)).toBeGreaterThanOrEqual(baseSquad * 0.8);
        expect(worst(id, ENEMY)).toBeGreaterThanOrEqual(baseEnemy * 0.8);
      });

      it('keeps the item icons and the blood pool visible on its floors', () => {
        expect(worst(id, METAL)).toBeGreaterThanOrEqual(3);
        expect(worst(id, BLOOD)).toBeGreaterThanOrEqual(1.6);
      });

      it('tells wall, door and floor apart', () => {
        const floor = floors(id)[0];
        const wall = tileImage(id, 'wall', false, 0, 0);
        const door = tileImage(id, 'door', false, 0, 0);
        expect(Math.abs(meanLum(wall) - meanLum(floor))).toBeGreaterThanOrEqual(0.04);
        for (const other of [floor, wall]) {
          const dl = Math.abs(meanLum(door) - meanLum(other));
          const dh = hueGap(hue(meanRgb(door)), hue(meanRgb(other)));
          expect(dl >= 0.04 || dh >= 40, `door against ${other.name}: lum ${dl.toFixed(3)} hue ${dh.toFixed(0)}`).toBe(true);
        }
      });
    });
  }

  it('records the base numbers the rules compare against', () => {
    expect(baseSquad).toBeGreaterThan(1);
    expect(baseEnemy).toBeGreaterThan(1);
    expect(worst('base', BLOOD)).toBeGreaterThanOrEqual(1.8);
    void imageOf;
  });
});
