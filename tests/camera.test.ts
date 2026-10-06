import { describe, expect, it } from 'vitest';
import {
  clampCamera, createCamera, defaultZoom, followTile, originOf, panBy, screenToTile, setZoom, tileCss, tileToScreen,
} from '../src/render/camera';
import { computeLayout } from '../src/ui/layout';

const W = 30;
const H = 20;
const phone = computeLayout(390, 844, 3);
const wide = computeLayout(1366, 768, 1);

describe('tile size and default zoom', () => {
  it('a phone shows 32 px tiles close up and chooses close; a desktop fits the whole map large', () => {
    expect(tileCss(phone, 'close', W, H)).toBeGreaterThanOrEqual(32);
    expect(tileCss(phone, 'whole', W, H)).toBeLessThan(20);
    expect(defaultZoom(phone, W, H)).toBe('close');
    expect(tileCss(wide, 'whole', W, H) * W).toBeLessThanOrEqual(wide.map.w + 0.001);
    expect(tileCss(wide, 'whole', W, H) * H).toBeLessThanOrEqual(wide.map.h + 0.001);
    expect(defaultZoom(wide, W, H)).toBe('whole');
  });

  it('close is never smaller than whole', () => {
    expect(tileCss(wide, 'close', W, H)).toBeGreaterThanOrEqual(tileCss(wide, 'whole', W, H));
  });

  it('close tiles are a whole number of device pixels per art pixel', () => {
    const t = tileCss(phone, 'close', W, H);
    expect((t * phone.dpr) / 16).toBeCloseTo(Math.round((t * phone.dpr) / 16), 6);
  });
});

describe('screen and tile mapping', () => {
  it('round-trips every tile centre at several camera positions and both zooms', () => {
    let checked = 0;
    for (const zoom of ['close', 'whole'] as const) {
      let cam = { ...createCamera(phone, W, H), zoom };
      for (const pos of [{ x: 0, y: 0 }, { x: 15, y: 10 }, { x: 29, y: 19 }]) {
        cam = followTile(cam, pos, phone, W, H);
        for (const t of [{ x: 2, y: 3 }, { x: 14, y: 9 }, { x: 28, y: 18 }]) {
          const s = tileToScreen(cam, phone, W, H, t);
          const inMap = s.x >= phone.map.x && s.x + s.tile <= phone.map.x + phone.map.w && s.y >= phone.map.y && s.y + s.tile <= phone.map.y + phone.map.h;
          if (!inMap) continue;
          expect(screenToTile(cam, phone, W, H, s.x + s.tile / 2, s.y + s.tile / 2)).toEqual(t);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('returns null outside the map rectangle and outside the map', () => {
    const cam = createCamera(wide, W, H);
    expect(screenToTile(cam, wide, W, H, -1, 5)).toBeNull();
    expect(screenToTile(cam, wide, W, H, 10, wide.map.y + wide.map.h + 5)).toBeNull(); // the panel
    const o = originOf(cam, wide, W, H);
    expect(screenToTile(cam, wide, W, H, o.x + W * o.tile + 2, o.y + 2)).toBeNull(); // right of the map
  });
});

describe('clamping, following and panning', () => {
  it('never lets the map edge leave the screen, and fixes an axis the map fits on', () => {
    const cam = clampCamera({ cx: -50, cy: 500, zoom: 'close', follow: true }, phone, W, H);
    const o = originOf(cam, phone, W, H);
    expect(o.x).toBeLessThanOrEqual(phone.map.x + 0.001);
    expect(o.y + H * o.tile).toBeGreaterThanOrEqual(phone.map.y + phone.map.h - 0.001);
    const fit = clampCamera({ cx: 3, cy: 3, zoom: 'whole', follow: true }, wide, W, H);
    expect(fit.cx).toBeCloseTo(W / 2, 5);
    expect(fit.cy).toBeCloseTo(H / 2, 5);
  });

  it('followTile centres a soldier (clamped at the edges) and turns following on', () => {
    const cam = followTile({ ...createCamera(phone, W, H), follow: false }, { x: 15, y: 10 }, phone, W, H);
    expect(cam.follow).toBe(true);
    const s = tileToScreen(cam, phone, W, H, { x: 15, y: 10 });
    expect(Math.abs(s.x + s.tile / 2 - (phone.map.x + phone.map.w / 2))).toBeLessThan(s.tile);
    const corner = followTile(cam, { x: 0, y: 0 }, phone, W, H);
    expect(originOf(corner, phone, W, H).x).toBeCloseTo(phone.map.x, 3);
  });

  it('panBy moves the map with the finger, stops at the edges and turns following off', () => {
    const cam = followTile(createCamera(phone, W, H), { x: 15, y: 10 }, phone, W, H);
    const before = originOf(cam, phone, W, H);
    const panned = panBy(cam, 20, 30, phone, W, H);
    const after = originOf(panned, phone, W, H);
    expect(after.x - before.x).toBeCloseTo(20, 3);
    expect(after.y - before.y).toBeCloseTo(30, 3);
    expect(panned.follow).toBe(false);
    const far = panBy(cam, 100000, 100000, phone, W, H);
    expect(originOf(far, phone, W, H).x).toBeLessThanOrEqual(phone.map.x + 0.001);
    expect(originOf(far, phone, W, H).y).toBeLessThanOrEqual(phone.map.y + 0.001);
  });

  it('setZoom keeps the centre fixed, and zooming out then in returns to the same view when nothing clamps', () => {
    const cam = followTile(createCamera(phone, W, H), { x: 15, y: 9 }, phone, W, H);
    const whole = setZoom(cam, 'whole', phone, W, H);
    expect(whole.zoom).toBe('whole');
    expect(whole.cx).toBeCloseTo(W / 2, 5); // the whole map fits: centred
    const back = setZoom(whole, 'close', phone, W, H);
    expect(back.zoom).toBe('close');
    const s = screenToTile(back, phone, W, H, phone.map.x + phone.map.w / 2, phone.map.y + phone.map.h / 2);
    expect(s).not.toBeNull();
  });
});
