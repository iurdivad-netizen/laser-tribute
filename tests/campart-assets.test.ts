import { describe, expect, it } from 'vitest';
import { CAMP_ART_IDS, CAMP_SPRITE_IDS, FACE_IDS, SPRITE_SIZE, type CampSpriteId } from '../src/screens/campart';

const files = import.meta.glob('../art-src/camp/*.png', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const byId = (id: string): string | undefined => files[`../art-src/camp/${id}.png`];

/** Width and height from the PNG header (IHDR), read out of a data uri. */
function sizeOf(uri: string): { w: number; h: number } {
  const raw = atob(uri.slice(uri.indexOf(',') + 1));
  const at = (i: number) => (raw.charCodeAt(i) << 24) | (raw.charCodeAt(i + 1) << 16) | (raw.charCodeAt(i + 2) << 8) | raw.charCodeAt(i + 3);
  return { w: at(16), h: at(20) };
}

/** What is painted so far; the rest of `CAMP_ART_IDS` falls back to the plain look until it is. */
const PAINTED = [
  'camp_backdrop', 'lab_idle', 'barracks', 'market', 'training_built', 'hospital_built', 'training_plot', 'hospital_plot',
  'face_alvarez', 'face_alvarez_s', 'face_brandt', 'face_brandt_s', 'face_chen', 'face_chen_s', 'face_dubois', 'face_dubois_s',
];

describe('the camp art files', () => {
  it('has only known ids, and at least what is painted so far', () => {
    const names = Object.keys(files).map((p) => p.split('/').pop()!.replace('.png', ''));
    for (const n of names) expect(CAMP_ART_IDS as readonly string[], n).toContain(n);
    for (const id of PAINTED) expect(names, id).toContain(id);
  });

  it('has the backdrop at the screen size, sprites at their size, faces at 64 px and small faces at 16 px', () => {
    for (const id of CAMP_ART_IDS) {
      const uri = byId(id);
      if (!uri) continue;
      const { w, h } = sizeOf(uri);
      if (id === 'camp_backdrop') expect([w, h], id).toEqual([480, 400]);
      else if ((CAMP_SPRITE_IDS as readonly string[]).includes(id)) expect([w, h], id).toEqual([SPRITE_SIZE[id as CampSpriteId].w, SPRITE_SIZE[id as CampSpriteId].h]);
      else if (id.endsWith('_s')) expect([w, h], id).toEqual([16, 16]);
      else expect((FACE_IDS as readonly string[]).includes(id)).toBe(true), expect([w, h], id).toEqual([64, 64]);
    }
  });

  it('stays under 250 KB in all, as it ships (base64 text in the bundle)', () => {
    const total = CAMP_ART_IDS.reduce((sum, id) => sum + (byId(id)?.length ?? 0), 0);
    expect(total).toBeLessThan(250_000);
  });
});
