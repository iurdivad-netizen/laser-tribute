import { describe, expect, it } from 'vitest';
import { FOOTPRINT, PLANET_ART_IDS, type EmblemId } from '../src/screens/planetart';

const files = import.meta.glob('../art-src/planet/*.png', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const byId = (id: string): string | undefined => files[`../art-src/planet/${id}.png`];

/** Width and height from the PNG header (IHDR), read out of a data uri. */
function sizeOf(uri: string): { w: number; h: number; bytes: number } {
  const raw = atob(uri.slice(uri.indexOf(',') + 1));
  const at = (i: number) => (raw.charCodeAt(i) << 24) | (raw.charCodeAt(i + 1) << 16) | (raw.charCodeAt(i + 2) << 8) | raw.charCodeAt(i + 3);
  return { w: at(16), h: at(20), bytes: raw.length };
}

describe('the planet art files', () => {
  it('has every art id and nothing else', () => {
    const names = Object.keys(files).map((p) => p.split('/').pop()!.replace('.png', '')).sort();
    expect(names).toEqual([...PLANET_ART_IDS].sort());
  });

  it('has the backdrop at the map size, the emblems at their footprint and the stamps at 48 px', () => {
    expect(sizeOf(byId('backdrop')!)).toMatchObject({ w: 330, h: 372 });
    for (const id of PLANET_ART_IDS) {
      if (id === 'backdrop') continue;
      const { w, h } = sizeOf(byId(id)!);
      if (id.startsWith('stamp_')) expect([w, h], id).toEqual([48, 48]);
      else expect([w, h], id).toEqual([FOOTPRINT[id as EmblemId], FOOTPRINT[id as EmblemId]]);
    }
  });

  it('stays under 250 KB in all', () => {
    const total = PLANET_ART_IDS.reduce((sum, id) => sum + sizeOf(byId(id)!).bytes, 0);
    expect(total).toBeLessThan(250_000);
  });
});
