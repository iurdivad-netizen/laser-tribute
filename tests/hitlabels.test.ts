import { describe, expect, it } from 'vitest';
import { hitChance } from '../src/core/combat';
import { hitLabels } from '../src/render/ranges';
import { corridorRows, makeState, unit } from './helpers';

describe('hitLabels', () => {
  it('lists the percentage for each visible enemy in reach, matching the core hit chance', () => {
    const s = makeState(corridorRows('P...E'));
    const p = unit(s, 'p1');
    const e = unit(s, 'e1');
    const labels = hitLabels(s, p, 'aimed');
    expect(labels).toHaveLength(1);
    expect(labels[0].unit.id).toBe('e1');
    expect(labels[0].pct).toBe(Math.round(hitChance(s, p, e, 'aimed') * 100));
  });

  it('shows a lower chance for a snap shot than an aimed shot', () => {
    const s = makeState(corridorRows('P...E'));
    const p = unit(s, 'p1');
    expect(hitLabels(s, p, 'snap')[0].pct).toBeLessThan(hitLabels(s, p, 'aimed')[0].pct);
  });

  it('shows nothing for an enemy beyond the weapon range', () => {
    const s = makeState(corridorRows('P' + '.'.repeat(30) + 'E'));
    expect(hitLabels(s, unit(s, 'p1'), 'aimed')).toEqual([]);
  });
});
