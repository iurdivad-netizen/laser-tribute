import { describe, expect, it } from 'vitest';
import { NO_ART, type Art } from '../src/art/planetimages';
import type { Pixels } from '../src/art/facegen';
import { newWorld } from '../src/core/world/world';
import { drawPanel } from '../src/screens/basepanels';
import { CAMP_ART_IDS, type CampArtId } from '../src/screens/campart';
import { faceImage } from '../src/screens/faces';
import { drawScene } from '../src/screens/scene';

const art: Art<CampArtId> = { image: (id) => (CAMP_ART_IDS.includes(id) ? ({ id } as unknown as CanvasImageSource) : null) };
const tagged = (p: Pixels) => ({ made: p.w }) as unknown as CanvasImageSource;
const idOf = (s: CanvasImageSource | null) => (s as unknown as { id?: string; made?: number } | null);

describe('faceImage', () => {
  it('gives an original the painted face and never makes one', () => {
    let made = 0;
    const make = (p: Pixels) => { made++; return tagged(p); };
    expect(idOf(faceImage(art, 'Alvarez', false, make))).toEqual({ id: 'face_alvarez' });
    expect(idOf(faceImage(art, 'Chen', true, make))).toEqual({ id: 'face_chen_s' });
    expect(made).toBe(0);
  });

  it('gives anyone else a made face of the right size, made once per name and size', () => {
    let made = 0;
    const make = (p: Pixels) => { made++; return tagged(p); };
    expect(idOf(faceImage(art, 'Haddad', false, make))).toEqual({ made: 64 });
    expect(idOf(faceImage(art, 'Haddad', true, make))).toEqual({ made: 16 });
    const again = faceImage(art, 'Haddad', false, make);
    expect(again).toBe(faceImage(art, 'Haddad', false, make));
    expect(made).toBe(2);
    faceImage(art, 'Zhou', false, make);
    expect(made).toBe(3);
  });

  it('falls back to the recruit images when nothing can be made, and to null when those are missing', () => {
    expect(idOf(faceImage(art, 'Haddad', false, () => null))).toEqual({ id: 'face_recruit' });
    expect(idOf(faceImage(art, 'Haddad', true, () => null))).toEqual({ id: 'face_recruit_s' });
    expect(faceImage(NO_ART, 'Haddad', true, () => null)).toBeNull();
  });
});

describe('faces in node (no canvas)', () => {
  it('still draws the recruit images in the scene and the barracks', () => {
    const calls: { name: string; args: unknown[] }[] = [];
    const ctx = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push({ name, args }); }, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawScene(ctx, { speaker: 'RECRUIT', text: 'Hold.', choices: null, skippable: false }, art);
    let w = newWorld(1, 'calm');
    w = { ...w, soldiers: [...w.soldiers, { name: 'Haddad', kills: 0, trained: 0, status: 'ready', daysLeft: 0 }] };
    drawPanel(ctx, 'barracks', w, null, 0, '', art);
    const ids = calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { id: string }).id);
    expect(ids).toEqual(['face_recruit', 'face_alvarez_s', 'face_brandt_s', 'face_chen_s', 'face_dubois_s', 'face_recruit_s']);
  });
});
