import { afterEach, describe, expect, it, vi } from 'vitest';
import { mixFace, shrinkFace, type Pixels } from '../src/art/facemix';
import { PORTRAITS } from '../src/art/portraits';
import { newWorld } from '../src/core/world/world';
import { drawPanel } from '../src/screens/basepanels';
import { faceImage } from '../src/screens/faces';
import { fakeDocument } from './helpers';
import { drawScene } from '../src/screens/scene';

const tagged = (p: Pixels) => ({ made: p.w }) as unknown as CanvasImageSource;
const sizeOf = (s: CanvasImageSource | null) => (s as unknown as { made?: number } | null)?.made;

describe('faceImage', () => {
  it('makes a face of the right size for every name, including the originals and RECRUIT, once per name and size', () => {
    let made = 0;
    const make = (p: Pixels) => { made++; return tagged(p); };
    expect(sizeOf(faceImage('Haddad', false, make))).toBe(64);
    expect(sizeOf(faceImage('Haddad', true, make))).toBe(16);
    expect(faceImage('Haddad', false, make)).toBe(faceImage('Haddad', false, make));
    expect(made).toBe(2);
    for (const name of ['Alvarez', 'Chen', 'RECRUIT']) expect(sizeOf(faceImage(name, false, make)), name).toBe(64);
    expect(made).toBe(5);
  });

  it('draws the painted face the name picks, at both sizes', () => {
    const seen: Pixels[] = [];
    const make = (p: Pixels) => { seen.push(p); return tagged(p); };
    faceImage('Chen', false, make);
    faceImage('Chen', true, make);
    const chen = mixFace(PORTRAITS, { head: 'chen', eyes: 'chen', mouth: 'chen', clothes: 'chen' });
    expect(seen).toEqual([chen, shrinkFace(chen)]);
  });

  it('gives null when nothing can be made', () => {
    expect(faceImage('Haddad', true, () => null)).toBeNull();
  });
});

describe('shrinkFace', () => {
  it('shrinks the middle 48 x 48 of a face, three pixels to one', () => {
    const big = { w: 64, h: 64, rgba: new Uint8ClampedArray(64 * 64 * 4).fill(255) };
    big.rgba.set([0, 0, 0, 255], (6 * 64 + 8) * 4); // top left pixel of the window
    big.rgba.set([0, 0, 0, 255], (5 * 64 + 7) * 4); // just outside it
    const small = shrinkFace(big);
    expect([small.w, small.h, small.rgba.length]).toEqual([16, 16, 1024]);
    expect([...small.rgba.slice(0, 4)]).toEqual([227, 227, 227, 255]); // round(255 * 8 / 9)
    expect([...small.rgba.slice(4, 8)]).toEqual([255, 255, 255, 255]);
  });
});

describe('faces without a canvas (node)', () => {
  it('draw no face and keep the initial in a scene and the label in place in the barracks', () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_t, name: string) => () => { calls.push(name); }, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawScene(ctx, { speaker: 'RECRUIT', text: 'Hold.', choices: null, skippable: false });
    drawPanel(ctx, 'barracks', newWorld(1, 'calm'), null, 0, '');
    expect(calls).not.toContain('drawImage');
  });
});

describe('faces with a canvas', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('are drawn for every soldier and speaker', () => {
    vi.stubGlobal('document', fakeDocument());
    const calls: unknown[][] = [];
    const ctx = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { if (name === 'drawImage') calls.push(args); }, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawScene(ctx, { speaker: 'Alvarez', text: 'Hold.', choices: null, skippable: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].slice(3)).toEqual([64, 64]);
    calls.length = 0;
    drawPanel(ctx, 'barracks', newWorld(1, 'calm'), null, 0, '');
    expect(calls).toHaveLength(4);
    for (const c of calls) expect(c.slice(3)).toEqual([16, 16]);
  });
});
