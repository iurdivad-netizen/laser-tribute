import { describe, expect, it } from 'vitest';
import { IMAGE_NAMES, buildImageData, renderImagesModule } from '../scripts/figures-lib.mjs';
import { IMAGE_DATA } from '../src/art/images.generated';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SOLID = ['floor_a', 'floor_b', 'floor_c', 'wall', 'door_closed', 'door_open'] as const;
const LOOSE = ['item_rifle', 'item_pistol', 'item_grenade', 'corpse_player', 'corpse_enemy'] as const;
type Name = (typeof IMAGE_NAMES)[number];

const rowsOf = (n: Name) => IMAGE_DATA[n].rows;
const opaque = (n: Name) => rowsOf(n).join('').replace(/\./g, '').length;
/** Red minus blue over the opaque pixels, a measure of how red an image is. */
function redness(n: Name): number {
  const { palette, rows } = IMAGE_DATA[n];
  let sum = 0;
  for (const row of rows) for (const ch of row) {
    if (ch === '.') continue;
    const hex = palette[DIGITS.indexOf(ch)];
    sum += parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
  }
  return sum;
}

describe('the generated image data', () => {
  it('has the eleven images, each 16x16 with a valid hex palette and valid indexes', () => {
    expect(IMAGE_NAMES).toHaveLength(11);
    expect(Object.keys(IMAGE_DATA).sort()).toEqual([...IMAGE_NAMES].sort());
    for (const name of IMAGE_NAMES) {
      const { palette, rows } = IMAGE_DATA[name];
      expect(rows, name).toHaveLength(16);
      for (const row of rows) expect(row, name).toHaveLength(16);
      expect(palette.length, name).toBeGreaterThan(1);
      expect(palette.length, name).toBeLessThanOrEqual(62);
      for (const hex of palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      for (const row of rows) for (const ch of row) {
        if (ch === '.') continue;
        expect(DIGITS.indexOf(ch), `${name} '${ch}'`).toBeGreaterThanOrEqual(0);
        expect(DIGITS.indexOf(ch), `${name} '${ch}'`).toBeLessThan(palette.length);
      }
    }
  });

  it('floors, wall and doors fill the whole tile', () => {
    for (const name of SOLID) expect(rowsOf(name).join(''), name).not.toMatch(/\./);
  });

  it('items and corpses have a body and a transparent edge', () => {
    for (const name of LOOSE) {
      expect(opaque(name), name).toBeGreaterThanOrEqual(8);
      const border = rowsOf(name).filter((_, y) => y === 0 || y === 15).join('') +
        rowsOf(name).map((r) => r[0] + r[15]).join('');
      expect(border, `${name} has no transparent edge`).toMatch(/\./);
    }
  });

  it('the three floors differ and the doors differ', () => {
    expect(rowsOf('floor_b')).not.toEqual(rowsOf('floor_a'));
    expect(rowsOf('floor_c')).not.toEqual(rowsOf('floor_a'));
    expect(rowsOf('floor_c')).not.toEqual(rowsOf('floor_b'));
    expect(rowsOf('door_closed')).not.toEqual(rowsOf('door_open'));
  });

  it('floor_b is floor_a mirrored and floor_c is floor_a turned 180 degrees', () => {
    const colour = (n: Name, x: number, y: number) => IMAGE_DATA[n].palette[DIGITS.indexOf(rowsOf(n)[y][x])];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      expect(colour('floor_b', x, y)).toBe(colour('floor_a', 15 - x, y));
      expect(colour('floor_c', x, y)).toBe(colour('floor_a', 15 - x, 15 - y));
    }
  });

  it('the enemy corpse is redder than the squad corpse', () => {
    expect(redness('corpse_enemy')).toBeGreaterThan(redness('corpse_player'));
  });

  it('matches what the converter makes from the committed sources', () => {
    const made = buildImageData('art-src/pixellab');
    expect(made.width).toBe(16);
    expect(made.height).toBe(16);
    expect(made.images).toEqual(IMAGE_DATA);
    expect(renderImagesModule(made)).toContain('IMAGE_DATA');
  });
});
