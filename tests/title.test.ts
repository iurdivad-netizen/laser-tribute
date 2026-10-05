import { describe, expect, it } from 'vitest';
import { TITLE, drawTitle, titleHit, titleSummary, type TitleView } from '../src/screens/title';
import { textWidth, unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const view = (over: Partial<TitleView> = {}): TitleView => ({
  missionNumber: 2, missionCount: 3, soldiers: 4, budget: 215, armed: false, ...over,
});

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
  it('finds the two buttons and ignores everything else', () => {
    expect(titleHit(240, 174)).toBe('continue');
    expect(titleHit(160, 160)).toBe('continue');
    expect(titleHit(319, 187)).toBe('continue');
    expect(titleHit(240, 214)).toBe('new');
    expect(titleHit(160, 200)).toBe('new');
    expect(titleHit(240, 195)).toBeNull(); // between the buttons
    expect(titleHit(159, 174)).toBeNull();
    expect(titleHit(320, 174)).toBeNull();
    expect(titleHit(10, 10)).toBeNull();
  });

  it('summarises the saved campaign', () => {
    expect(titleSummary(view())).toBe('MISSION 2 OF 3, 4 SOLDIERS, 215 CR');
    expect(titleSummary(view({ soldiers: 1 }))).toBe('MISSION 2 OF 3, 1 SOLDIER, 215 CR');
  });

  it('draws the heading, the summary, both buttons and the hint', () => {
    const t = texts(view()).map((r) => r.text);
    expect(t).toContain('LASER TRIBUTE');
    expect(t).toContain('MISSION 2 OF 3, 4 SOLDIERS, 215 CR');
    expect(t).toContain('CONTINUE');
    expect(t).toContain('NEW CAMPAIGN');
    expect(t.some((s) => s.includes('ENTER') && s.includes('N'))).toBe(true);
  });

  it('shows the confirmation text on the New campaign button when armed', () => {
    const t = texts(view({ armed: true })).map((r) => r.text);
    expect(t).toContain('REPLACE SAVE? PRESS AGAIN');
    expect(t).not.toContain('NEW CAMPAIGN');
  });

  it('fits every text inside the card and every label inside its button, even with big numbers', () => {
    for (const v of [view(), view({ armed: true }), view({ missionNumber: 3, budget: 9999 })]) {
      for (const r of texts(v)) {
        expect(unsupportedChars(r.text), r.text).toEqual([]);
        expect(left(r), r.text).toBeGreaterThanOrEqual(TITLE.card.x);
        expect(left(r) + r.width, r.text).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      }
    }
    expect(textWidth('REPLACE SAVE? PRESS AGAIN') + 6).toBeLessThanOrEqual(TITLE.fresh.w);
    expect(textWidth('CONTINUE') + 6).toBeLessThanOrEqual(TITLE.cont.w);
  });
});
