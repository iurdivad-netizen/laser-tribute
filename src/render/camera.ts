import type { Pos } from '../core/types';
import type { Layout } from '../ui/layout';

export type Zoom = 'close' | 'whole';

/** The map view: the centre in tile units, the zoom level, and whether the camera follows the selected soldier. */
export interface Camera {
  cx: number;
  cy: number;
  zoom: Zoom;
  follow: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The largest tile (in CSS px, a multiple of one device pixel) at which the whole map fits the map rectangle. */
function wholeTile(layout: Layout, mapW: number, mapH: number): number {
  const fit = Math.min(layout.map.w / mapW, layout.map.h / mapH);
  return Math.max(4, Math.floor(fit * layout.dpr) / layout.dpr);
}

/** CSS pixels per tile: 'whole' fits the map; 'close' is about 32 px (more on big screens) in whole device-pixel steps. */
export function tileCss(layout: Layout, zoom: Zoom, mapW: number, mapH: number): number {
  const whole = wholeTile(layout, mapW, mapH);
  if (zoom === 'whole') return whole;
  const factor = clamp(Math.floor(Math.min(layout.width, layout.height) / 400), 1, 3);
  const close = (Math.round((32 * factor * layout.dpr) / 16) * 16) / layout.dpr;
  return Math.max(whole, close);
}

/** The whole map when its tiles come out at 28 px or more, otherwise close. */
export function defaultZoom(layout: Layout, mapW: number, mapH: number): Zoom {
  return wholeTile(layout, mapW, mapH) >= 28 ? 'whole' : 'close';
}

export function clampCamera(cam: Camera, layout: Layout, mapW: number, mapH: number): Camera {
  const tile = tileCss(layout, cam.zoom, mapW, mapH);
  const halfW = layout.map.w / 2 / tile;
  const halfH = layout.map.h / 2 / tile;
  const cx = mapW <= halfW * 2 ? mapW / 2 : clamp(cam.cx, halfW, mapW - halfW);
  const cy = mapH <= halfH * 2 ? mapH / 2 : clamp(cam.cy, halfH, mapH - halfH);
  return { ...cam, cx, cy };
}

export function createCamera(layout: Layout, mapW: number, mapH: number): Camera {
  return clampCamera({ cx: mapW / 2, cy: mapH / 2, zoom: defaultZoom(layout, mapW, mapH), follow: true }, layout, mapW, mapH);
}

/** Centres the camera on a tile (clamped at the map edges) and turns following on. */
export function followTile(cam: Camera, pos: Pos, layout: Layout, mapW: number, mapH: number): Camera {
  return clampCamera({ ...cam, cx: pos.x + 0.5, cy: pos.y + 0.5, follow: true }, layout, mapW, mapH);
}

/** Moves the map with the finger by (dx, dy) CSS px, clamped to the map, and turns following off. */
export function panBy(cam: Camera, dx: number, dy: number, layout: Layout, mapW: number, mapH: number): Camera {
  const tile = tileCss(layout, cam.zoom, mapW, mapH);
  return clampCamera({ ...cam, cx: cam.cx - dx / tile, cy: cam.cy - dy / tile, follow: false }, layout, mapW, mapH);
}

/** Changes the zoom around the current centre. */
export function setZoom(cam: Camera, zoom: Zoom, layout: Layout, mapW: number, mapH: number): Camera {
  return clampCamera({ ...cam, zoom }, layout, mapW, mapH);
}

/** The screen position of tile (0, 0) and the tile size, in CSS px. */
export function originOf(cam: Camera, layout: Layout, mapW: number, mapH: number): { x: number; y: number; tile: number } {
  const tile = tileCss(layout, cam.zoom, mapW, mapH);
  return {
    x: layout.map.x + layout.map.w / 2 - cam.cx * tile,
    y: layout.map.y + layout.map.h / 2 - cam.cy * tile,
    tile,
  };
}

export function tileToScreen(
  cam: Camera, layout: Layout, mapW: number, mapH: number, t: Pos,
): { x: number; y: number; tile: number } {
  const o = originOf(cam, layout, mapW, mapH);
  return { x: o.x + t.x * o.tile, y: o.y + t.y * o.tile, tile: o.tile };
}

/** The tile under a screen position, or null outside the map rectangle or the map. */
export function screenToTile(
  cam: Camera, layout: Layout, mapW: number, mapH: number, px: number, py: number,
): Pos | null {
  const m = layout.map;
  if (px < m.x || py < m.y || px >= m.x + m.w || py >= m.y + m.h) return null;
  const o = originOf(cam, layout, mapW, mapH);
  const x = Math.floor((px - o.x) / o.tile);
  const y = Math.floor((py - o.y) / o.tile);
  if (x < 0 || y < 0 || x >= mapW || y >= mapH) return null;
  return { x, y };
}
