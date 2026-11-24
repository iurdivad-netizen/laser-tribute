import { describe, expect, it } from 'vitest';
import { NO_ART, createPlanetArt } from '../src/art/planetimages';

interface Fake { src: string; onload: (() => void) | null; onerror: (() => void) | null; complete: boolean; naturalWidth: number }
const factory = () => {
  const made: Fake[] = [];
  const make = (): Fake => {
    const f: Fake = { src: '', onload: null, onerror: null, complete: false, naturalWidth: 0 };
    made.push(f);
    return f;
  };
  return { made, make };
};
const data = { backdrop: 'data:image/png;base64,AAAA', stamp_scorch: 'data:image/png;base64,BBBB' };

describe('the planet art loader', () => {
  it('returns an image only once it has decoded, and says so once', () => {
    const { made, make } = factory();
    let loaded = 0;
    const art = createPlanetArt(data, () => { loaded += 1; }, make);
    expect(art.image('backdrop')).toBeNull();
    expect(made).toHaveLength(1);
    expect(made[0].src).toBe(data.backdrop);
    made[0].complete = true;
    made[0].naturalWidth = 1;
    made[0].onload?.();
    expect(art.image('backdrop')).toBe(made[0]);
    expect(loaded).toBe(1);
  });

  it('keeps null for a failed decode and for an id with no data, and creates each image once', () => {
    const { made, make } = factory();
    let loaded = 0;
    const art = createPlanetArt(data, () => { loaded += 1; }, make);
    art.image('stamp_scorch');
    art.image('stamp_scorch');
    expect(made).toHaveLength(1);
    made[0].onerror?.();
    expect(art.image('stamp_scorch')).toBeNull();
    expect(art.image('wild_a')).toBeNull();
    expect(made).toHaveLength(1);
    expect(loaded).toBe(0);
  });

  it('has no art at all in a node test, and NO_ART is always empty', () => {
    expect(createPlanetArt(data, () => undefined).image('backdrop')).toBeNull();
    expect(NO_ART.image('backdrop')).toBeNull();
  });
});
