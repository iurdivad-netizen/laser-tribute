import { describe, expect, it } from 'vitest';
import { wantsRotateHint } from '../src/app';

describe('rotate hint', () => {
  it('shows on an upright phone', () => {
    expect(wantsRotateHint(390, 844)).toBe(true);
    expect(wantsRotateHint(360, 740)).toBe(true);
  });
  it('stays away on landscape, desktop and tablet windows', () => {
    expect(wantsRotateHint(844, 390)).toBe(false);
    expect(wantsRotateHint(1280, 800)).toBe(false);
    expect(wantsRotateHint(768, 1024)).toBe(false);
    expect(wantsRotateHint(480, 400)).toBe(false);
  });
});
