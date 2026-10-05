import { describe, expect, it } from 'vitest';
import { drawCampaignEnd } from '../src/screens/end';
import { RESULT, drawResult } from '../src/screens/result';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText } from '../src/ui/text';

function collect(draw: (ctx: CanvasRenderingContext2D) => void) {
  const runs: { text: string; x: number; y: number; width: number; align: string }[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  draw(ctx);
  stop();
  return runs;
}

const left = (r: { x: number; width: number; align: string }) =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

describe('result card', () => {
  it('closes the gap when there is no loot line, and keeps the button label off the bevel', () => {
    const view = (loot: string) => ({
      result: { won: true, survivors: 4, squadSize: 4, enemiesKilled: 8, enemyCount: 8, turns: 12 },
      missionName: 'Compound', fallen: [], nextBudget: 215, loot, promoted: ['Alvarez (Captain)'],
    });
    const promo = (loot: string) => collect((ctx) => drawResult(ctx, view(loot))).find((r) => r.text.includes('CAPTAIN') || r.text.includes('Captain'))!;
    expect(promo('1 rifle').y - promo('').y).toBe(12);
    const button = collect((ctx) => drawResult(ctx, view(''))).find((r) => r.text.startsWith('CONTINUE'))!;
    expect(button.width + 6).toBeLessThanOrEqual(RESULT.again.w);
  });

  it('keeps every line inside the card, with four promotions and long fallen names', () => {
    const runs = collect((ctx) => drawResult(ctx, {
      result: { won: true, survivors: 2, squadSize: 4, enemiesKilled: 8, enemyCount: 8, turns: 12 },
      missionName: 'Compound',
      fallen: ['Lindqvist 2', 'Kowalski', 'Fontaine', 'Eriksen'],
      nextBudget: 215,
      loot: '2 rifles, 2 pistols, 4 clips',
      promoted: ['Lindqvist 2 (Sergeant)', 'Alvarez (Captain)', 'Brandt (Private)', 'Chen (Sergeant)'],
    }));
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(110);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(370 - 8);
    }
    expect(runs.filter((r) => r.text.startsWith('Promoted:'))).toHaveLength(4);
    expect(runs.some((r) => r.text === 'Loot: 2 rifles, 2 pistols, 4 clips')).toBe(true);
    expect(runs.some((r) => r.text.includes('CONTINUE'))).toBe(true);
  });
});

describe('end screen', () => {
  it('keeps every line inside the card, with long survivor and fallen lists', () => {
    const runs = collect((ctx) => drawCampaignEnd(ctx, {
      won: true, missionsWon: 3, missionCount: 3, totalKills: 31,
      survivors: ['Alvarez', 'Brandt', 'Chen', 'Dubois', 'Eriksen', 'Fontaine'],
      fallen: ['Garcia', 'Haddad', 'Ivanov', 'Jensen', 'Kowalski', 'Lindqvist'],
    }));
    for (const r of runs) {
      expect(unsupportedChars(r.text), r.text).toEqual([]);
      expect(left(r), r.text).toBeGreaterThanOrEqual(90);
      expect(left(r) + r.width, r.text).toBeLessThanOrEqual(390 - 8);
    }
    const button = runs.find((r) => r.text.includes('NEW CAMPAIGN'))!;
    expect(textWidth(button.text) + 6).toBeLessThanOrEqual(130);
    expect(runs.some((r) => r.text.includes('CAMPAIGN COMPLETE'))).toBe(true);
  });
});
