import { describe, expect, it } from 'vitest';
import { screenToTile } from '../src/render/layout';

describe('screenToTile', () => {
  it('maps logical pixels to tiles', () => {
    expect(screenToTile(0, 0, 30, 20)).toEqual({ x: 0, y: 0 });
    expect(screenToTile(479, 319, 30, 20)).toEqual({ x: 29, y: 19 });
    expect(screenToTile(17, 33, 30, 20)).toEqual({ x: 1, y: 2 });
  });

  it('returns null over the panel, outside the canvas or beyond the map', () => {
    expect(screenToTile(100, 330, 30, 20)).toBeNull();
    expect(screenToTile(-1, 5, 30, 20)).toBeNull();
    expect(screenToTile(100, 0, 5, 5)).toBeNull();
  });
});
