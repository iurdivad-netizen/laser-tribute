import { describe, expect, it } from 'vitest';
import { RESULT, promotionLines } from '../src/screens/result';

describe('promotion lines on the result card', () => {
  it('gives every promotion its own line so no name is cut off', () => {
    expect(promotionLines(['Alvarez (Private)', 'Fontaine (Sergeant)', 'Chen (Captain)'])).toEqual([
      'Promoted: Alvarez (Private)',
      'Promoted: Fontaine (Sergeant)',
      'Promoted: Chen (Captain)',
    ]);
  });

  it('shows nothing when nobody was promoted, and at most four lines', () => {
    expect(promotionLines([])).toEqual([]);
    expect(promotionLines(['A (Private)', 'B (Private)', 'C (Private)', 'D (Private)', 'E (Private)'])).toHaveLength(4);
  });

  it('leaves room for four lines above the Continue button, inside the card', () => {
    const firstLineY = RESULT.card.y + 128;
    expect(RESULT.again.y).toBeGreaterThanOrEqual(firstLineY + 4 * 10);
    expect(RESULT.again.y + RESULT.again.h).toBeLessThanOrEqual(RESULT.card.y + RESULT.card.h);
  });
});
