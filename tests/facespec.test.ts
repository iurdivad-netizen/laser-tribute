import { describe, expect, it } from 'vitest';
import { FACE_PARTS, faceSpec, type FaceSpec } from '../src/core/world/faces';
import { RECRUIT_SURNAMES } from '../src/core/world/names';

const PARTS = Object.keys(FACE_PARTS) as (keyof FaceSpec)[];
const NAMES = [...RECRUIT_SURNAMES, ...RECRUIT_SURNAMES.map((n) => `${n} 2`), ...RECRUIT_SURNAMES.map((n) => `${n} 3`)];

describe('faceSpec', () => {
  it('keeps every part inside its range', () => {
    for (const name of [...NAMES, '', 'Eriksen', 'Alvarez 2']) {
      const spec = faceSpec(name);
      for (const part of PARTS) {
        expect(Number.isInteger(spec[part]), `${name} ${part}`).toBe(true);
        expect(spec[part], `${name} ${part}`).toBeGreaterThanOrEqual(0);
        expect(spec[part], `${name} ${part}`).toBeLessThan(FACE_PARTS[part]);
      }
    }
  });

  it('is the same for the same name, whatever was asked before', () => {
    const first = faceSpec('Haddad');
    faceSpec('Zhou');
    expect(faceSpec('Haddad')).toEqual(first);
  });

  it('gives nearly every name its own face', () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(300);
    const distinct = new Set(NAMES.map((n) => JSON.stringify(faceSpec(n))));
    expect(distinct.size).toBeGreaterThanOrEqual(NAMES.length - 8);
  });

  it('uses every value of every part', () => {
    for (const part of PARTS) {
      const seen = new Set(NAMES.map((n) => faceSpec(n)[part]));
      expect(seen.size, part).toBe(FACE_PARTS[part]);
    }
  });
});
