import { describe, expect, it } from 'vitest';
import { actionCost } from '../src/render/panel';
import { corridorRows, makeState, unit } from './helpers';

describe('actionCost', () => {
  it('shows each action cost for the selected soldier', () => {
    const s = makeState(corridorRows('P..E'));
    const u = unit(s, 'p1');
    u.weapon = 'rifle';
    expect(actionCost(u, 'snap')).toBe(15);
    expect(actionCost(u, 'aimed')).toBe(30);
    u.weapon = 'pistol';
    expect(actionCost(u, 'snap')).toBe(12);
    expect(actionCost(u, 'aimed')).toBe(24);
    expect(actionCost(u, 'throw')).toBe(24);
    expect(actionCost(u, 'door')).toBe(2);
    expect(actionCost(u, 'pickup')).toBe(3);
    expect(actionCost(u, 'alert')).toBeNull();
    expect(actionCost(u, 'end')).toBeNull();
  });
});
