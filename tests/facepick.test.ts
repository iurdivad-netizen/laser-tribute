import { describe, expect, it } from 'vitest';
import { isAllowed, type FaceName, type FacePick } from '../src/art/facemix';
import { facePick } from '../src/art/facepick';
import { RECRUIT_SURNAMES } from '../src/core/world/names';
import { ORIGINALS } from '../src/core/world/story';

const HIRE_HEADS = ['woman', 'veteran', 'man', 'blonde'];
const own = (n: FaceName) => ({ head: n, eyes: n, mouth: n, clothes: n });
const hire = (p: FacePick) => HIRE_HEADS.includes(p.head)
  && !(p.head === 'veteran' && p.clothes === 'woman') && !(p.head === 'man' && p.clothes === 'man') && isAllowed(p);

describe('facePick', () => {
  it('gives the originals their fixed faces', () => {
    expect(facePick('Alvarez')).toEqual({ head: 'veteran', eyes: 'veteran', mouth: 'veteran', clothes: 'woman' });
    expect(facePick('Brandt')).toEqual({ head: 'man', eyes: 'man', mouth: 'veteran', clothes: 'man' });
    expect(facePick('Chen')).toEqual(own('chen'));
    expect(facePick('Dubois')).toEqual(own('dubois'));
  });

  it('gives everyone else an allowed hire face, the same every time', () => {
    const names = [...RECRUIT_SURNAMES.filter((n) => !(ORIGINALS as readonly string[]).includes(n)),
      'RECRUIT', 'Alvarez 2', 'alvarez', 'constructor', '__proto__', 'toString', ''];
    for (const n of names) {
      expect(hire(facePick(n)), n).toBe(true);
      expect(facePick(n), n).toEqual(facePick(n));
    }
  });

  it('picks each head about equally often and reaches all 180 hire faces', () => {
    const picks = Array.from({ length: 20_000 }, (_, i) => facePick(`Hire ${i}`));
    for (const head of HIRE_HEADS) {
      const share = picks.filter((p) => p.head === head).length / picks.length;
      expect(share, head).toBeGreaterThan(0.22);
      expect(share, head).toBeLessThan(0.28);
    }
    expect(new Set(picks.map((p) => JSON.stringify(p))).size).toBe(180);
  });
});
