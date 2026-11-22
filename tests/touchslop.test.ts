import { describe, expect, it } from 'vitest';
import { EQ, equipmentHit } from '../src/screens/equipment';
import { endHit, END } from '../src/screens/end';
import { RESULT, resultHit } from '../src/screens/result';
import { TITLE, titleHit } from '../src/screens/title';

describe('touch slop on the menus', () => {
  it('leaves exact mouse hits unchanged and misses beside a button without slop', () => {
    const y = EQ.rowTop + 2;
    expect(equipmentHit(EQ.plus.x + 3, y)).toEqual({ kind: 'plus', index: 0 });
    expect(equipmentHit(EQ.minus.x - 6, y)).toBeNull();
  });

  it('snaps a tap beside a small button to that button', () => {
    const y = EQ.rowTop + 2;
    expect(equipmentHit(EQ.minus.x - 6, y, 9)).toEqual({ kind: 'minus', index: 0 });
    expect(equipmentHit(EQ.minus.x + EQ.minus.w + 4, y, 9)).toEqual({ kind: 'minus', index: 0 });
  });

  it('prefers the nearest button when two are in reach and ignores taps far from any', () => {
    const y = EQ.rowTop + EQ.btnH; // in the 2 px gap between a soldier's two button rows, nearer the upper one
    expect(equipmentHit(EQ.plus.x + 3, y, 9)).toEqual({ kind: 'plus', index: 0 });
    expect(equipmentHit(5, 5, 9)).toBeNull();
  });

  it('widens the title, result and end buttons', () => {
    expect(titleHit(TITLE.campaign.x - 3, TITLE.campaign.y + 5, false)).toBeNull();
    expect(titleHit(TITLE.campaign.x - 3, TITLE.campaign.y + 5, false, 5)).toBe('campaign');
    expect(resultHit(RESULT.again.x - 6, RESULT.again.y + 5)).toBeNull();
    expect(resultHit(RESULT.again.x - 6, RESULT.again.y + 5, 9)).toBe('again');
    expect(endHit(END.again.x - 6, END.again.y + 5)).toBeNull();
    expect(endHit(END.again.x - 6, END.again.y + 5, 9)).toBe('new');
  });
});
