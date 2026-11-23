import { describe, expect, it } from 'vitest';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';

const enemies = (s: ReturnType<typeof createMission>) =>
  s.units.filter((u) => u.side === 'enemy').map((u) => `${u.weapon}/${u.role ?? ''}`);

describe('createMission enemy level', () => {
  const def = generateMission(9, 0);

  it('arms enemies by enemyLevel while the player keeps level', () => {
    const high = createMission(def, 7, undefined, undefined, 500, undefined, 1, 10);
    const low = createMission(def, 7, undefined, undefined, 500, undefined, 1);
    expect(enemies(high)).not.toEqual(enemies(low));
  });

  it('defaults enemyLevel to level', () => {
    const a = createMission(def, 7, undefined, undefined, 500, undefined, 5, 5);
    const b = createMission(def, 7, undefined, undefined, 500, undefined, 5);
    expect(a).toEqual(b);
  });
});
