import { describe, expect, it } from 'vitest';
import { TITLE, drawTitle, titleHit, type TitleView } from '../src/screens/title';
import { unsupportedChars } from '../src/ui/font';
import { onText, type TextRun } from '../src/ui/text';

const left = (r: TextRun): number =>
  r.align === 'left' ? r.x : r.align === 'right' ? r.x - r.width : r.x - Math.floor(r.width / 2);

function texts(v: TitleView): TextRun[] {
  const runs: TextRun[] = [];
  const stop = onText((r) => runs.push(r));
  drawTitle(new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D, v);
  stop();
  return runs;
}

describe('STORY on the title', () => {
  it('hits the story button and still hits the others', () => {
    expect(titleHit(240, 264, false)).toBe('story');
    expect(titleHit(240, 264, true)).toBe('story');
    expect(titleHit(240, 184, false)).toBe('campaign');
    expect(titleHit(240, 224, false)).toBe('tutorial');
    expect(titleHit(240, 144, true)).toBe('continue');
    expect(titleHit(240, 244, true)).toBeNull(); // the gap above it
  });

  it('keeps the story button inside the card and clear of the tutorial button', () => {
    const b = TITLE.story;
    expect(b.x).toBeGreaterThanOrEqual(TITLE.card.x);
    expect(b.x + b.w).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
    expect(b.y).toBeGreaterThanOrEqual(TITLE.tutorial.y + TITLE.tutorial.h + 4);
    expect(b.y + b.h).toBeLessThan(TITLE.card.y + TITLE.card.h - 20);
  });

  it('labels the button STORY, or with the day and regions held when a story can continue', () => {
    const none = texts({ continue: null, armed: null, story: null }).map((r) => r.text);
    expect(none).toContain('STORY');
    const saved = texts({ continue: null, armed: null, story: { day: 12, held: 4 } }).map((r) => r.text);
    expect(saved).toContain('STORY: DAY 12, 4 HELD');
    expect(texts({ continue: null, armed: null }).map((r) => r.text)).toContain('STORY'); // story is optional
  });

  it('fits every text inside the card, even with big numbers', () => {
    for (const story of [null, { day: 99999, held: 30 }]) {
      for (const r of texts({ continue: null, armed: null, story })) {
        expect(unsupportedChars(r.text), r.text).toEqual([]);
        expect(left(r), r.text).toBeGreaterThanOrEqual(TITLE.card.x);
        expect(left(r) + r.width, r.text).toBeLessThanOrEqual(TITLE.card.x + TITLE.card.w);
      }
    }
  });
});
