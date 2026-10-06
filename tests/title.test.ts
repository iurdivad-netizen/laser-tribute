import { describe, expect, it } from 'vitest';
import { TITLE, drawTitle, titleHit, titleSummary, type TitleView } from '../src/screens/title';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const saved = { mode: 'campaign' as const, missionNumber: 4, missionCount: 10, soldiers: 4, budget: 215 };
const view = (over: Partial<TitleView> = {}): TitleView => ({ continue: saved, armed: null, ...over });

const left = (r: TextRun): number =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

function texts(v: TitleView): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
  drawTitle(ctx, v);
  stop();
  return runs;
}

describe('title screen', () => {
  it('finds the three buttons and ignores everything else', () => {
    expect(titleHit(240, 144, true)).toBe('continue');
    expect(titleHit(160, 130, true)).toBe('continue');
    expect(titleHit(319, 157, true)).toBe('continue');
    expect(titleHit(240, 184, true)).toBe('campaign');
    expect(titleHit(240, 224, true)).toBe('tutorial');
    expect(titleHit(240, 164, true)).toBeNull(); // between the buttons
    expect(titleHit(159, 144, true)).toBeNull();
    expect(titleHit(320, 144, true)).toBeNull();
    expect(titleHit(10, 10, true)).toBeNull();
  });

  it('has no continue button to hit when there is no save', () => {
    expect(titleHit(240, 144, false)).toBeNull();
    expect(titleHit(240, 184, false)).toBe('campaign');
    expect(titleHit(240, 224, false)).toBe('tutorial');
  });

  it('summarises the saved game with its mode', () => {
    expect(titleSummary(saved)).toBe('CAMPAIGN: MISSION 4 OF 10, 4 SOLDIERS, 215 CR');
    expect(titleSummary({ ...saved, mode: 'tutorial', missionNumber: 2, missionCount: 3, soldiers: 1 })).toBe(
      'TUTORIAL: MISSION 2 OF 3, 1 SOLDIER, 215 CR',
    );
  });

  it('draws the heading, the summary, the three buttons and the hint when a save exists', () => {
    const t = texts(view()).map((r) => r.text);
    expect(t).toContain('LASER TRIBUTE');
    expect(t).toContain('CAMPAIGN: MISSION 4 OF 10, 4 SOLDIERS, 215 CR');
    expect(t).toContain('CONTINUE');
    expect(t).toContain('NEW CAMPAIGN');
    expect(t).toContain('TUTORIAL');
    expect(t.some((s) => s.includes('ENTER') && s.includes('N ') && s.includes('T '))).toBe(true);
  });

  it('draws no CONTINUE, no summary and no ENTER hint without a save', () => {
    const t = texts(view({ continue: null })).map((r) => r.text);
    expect(t).not.toContain('CONTINUE');
    expect(t.some((s) => s.includes('MISSION'))).toBe(false);
    expect(t.some((s) => s.includes('ENTER'))).toBe(false);
    expect(t).toContain('NEW CAMPAIGN');
    expect(t).toContain('TUTORIAL');
  });

  it('shows the confirmation text on the armed button only', () => {
    const c = texts(view({ armed: 'campaign' })).map((r) => r.text);
    expect(c).toContain('REPLACE SAVE? PRESS AGAIN');
    expect(c).not.toContain('NEW CAMPAIGN');
    expect(c).toContain('TUTORIAL');
    const t = texts(view({ armed: 'tutorial' })).map((r) => r.text);
    expect(t).toContain('REPLACE SAVE? PRESS AGAIN');
    expect(t).not.toContain('TUTORIAL');
    expect(t).toContain('NEW CAMPAIGN');
  });

  it('fits every text inside the card, even with big numbers', () => {
    const views = [
      view(), view({ armed: 'campaign' }), view({ armed: 'tutorial' }), view({ continue: null }),
      view({ continue: { ...saved, missionNumber: 10, budget: 9999, soldiers: 12 } }),
      view({ continue: { ...saved, mode: 'tutorial' } }),
    ];
    for (const v of views) {
      for (const r of texts(v)) {
        expect(unsupportedChars(r.text), r.text).toEqual([]);
        expect(left(r), r.text).toBeGreaterThanOrEqual(TITLE.card.x);
        expect(left(r) + r.width, r.text).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      }
    }
  });

  it('keeps the three buttons inside the card and apart', () => {
    const rects = [TITLE.cont, TITLE.campaign, TITLE.tutorial];
    for (const b of rects) {
      expect(b.x).toBeGreaterThanOrEqual(TITLE.card.x);
      expect(b.x + b.w).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      expect(b.y + b.h).toBeLessThan(TITLE.card.y + TITLE.card.h - 20);
    }
    for (let i = 1; i < rects.length; i++) expect(rects[i].y).toBeGreaterThanOrEqual(rects[i - 1].y + rects[i - 1].h + 4);
    expect(textWidth('REPLACE SAVE? PRESS AGAIN')).toBeLessThanOrEqual(TITLE.campaign.w);
  });
});
