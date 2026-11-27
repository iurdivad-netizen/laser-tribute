import { describe, expect, it } from 'vitest';
import { preparePortraits, renderFacesModule } from '../scripts/build-faces.mjs';
import { PORTRAITS } from '../src/art/portraits';

describe('the generated face data', () => {
  it('bakes the portraits the PNG files give', () => {
    expect(PORTRAITS).toEqual(preparePortraits());
  });

  it('refuses a portrait with more colours than the format holds', () => {
    const portraits = preparePortraits();
    for (let i = 0; i < 63; i++) portraits.chen.rgba.set([i, 0, 0, 255], i * 4);
    expect(() => renderFacesModule(portraits)).toThrow('colours');
  });
});
