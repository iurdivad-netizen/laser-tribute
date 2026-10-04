import { describe, expect, it } from 'vitest';
import { ADVANCE, FALLBACK, GLYPHS, GLYPH_H, GLYPH_W, glyphFor, isSupported, textWidth, unsupportedChars } from '../src/ui/font';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?\'"-+=/()[]<>%*#_&@$~|';

describe('glyph data', () => {
  it('has exactly the character set, every glyph 7 rows of 5 characters from # and .', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...CHARSET].sort());
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(GLYPH_H);
      for (const row of rows) expect(row, ch).toMatch(/^[#.]{5}$/);
    }
    expect(GLYPH_W).toBe(5);
    expect(ADVANCE).toBe(6);
  });

  it('draws something for every character but the space, and no two characters look the same', () => {
    const seen = new Map<string, string>();
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      const key = rows.join('/');
      if (ch === ' ') {
        expect(key).toBe(Array(7).fill('.....').join('/'));
        continue;
      }
      expect(key.includes('#'), ch).toBe(true);
      expect(seen.get(key), `${ch} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, ch);
    }
  });

  it('shows lower case as the capital', () => {
    expect(glyphFor('a')).toBe(GLYPHS.A);
    expect(glyphFor('z')).toBe(GLYPHS.Z);
    expect(isSupported('q')).toBe(true);
  });

  it('draws a visible box for an unsupported character instead of throwing', () => {
    expect(glyphFor('é')).toBe(FALLBACK);
    expect(FALLBACK).toEqual(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####']);
    expect(isSupported('é')).toBe(false);
  });

  it('reports unsupported characters once each, in order', () => {
    expect(unsupportedChars('Need 24 AP, have 15')).toEqual([]);
    expect(unsupportedChars('aébéü')).toEqual(['é', 'ü']);
  });

  it('measures text: 6 pixels per character minus the trailing gap', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('A')).toBe(5);
    expect(textWidth('AB')).toBe(11);
    expect(textWidth('HP 80/80')).toBe(47);
  });
});
