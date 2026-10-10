import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LENGTH, VARIATIONS, generateMission } from '../src/core/gen';

/** A simple hash of a string (FNV-1a), enough to notice any change to any map. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Pins the fifty maps: a saved campaign stores only variation numbers, so a map must not change under a player. */
describe('the fifty maps are pinned', () => {
  const hashes: string[] = [];
  for (let t = 0; t < CAMPAIGN_LENGTH; t++) {
    for (let v = 0; v < VARIATIONS; v++) {
      const def = generateMission(t, v);
      hashes.push(fnv(def.rows.join('\n') + JSON.stringify(def.patrols)));
    }
  }

  it('has fifty hashes', () => {
    expect(hashes).toHaveLength(50);
  });

  // Changing the generator or a recipe changes this on purpose: update it in the same commit and say so in the commit message.
  it('matches the pinned fingerprint', () => {
    expect(fnv(hashes.join(','))).toBe('8d7f1953');
  });
});
