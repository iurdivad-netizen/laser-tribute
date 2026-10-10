import { describe, expect, it } from 'vitest';
import { runEnemyTurn } from '../src/core/ai';
import { generateMission } from '../src/core/gen';
import { createMission } from '../src/core/missions';

/** FNV-1a over a string: a short fingerprint of everything an enemy turn did and left behind. */
function fingerprint(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** One enemy turn on map type `type` (variation 0); `hunting` tells the enemies where the squad is. */
function turn(type: number, hunting: boolean): string {
  const s = createMission(generateMission(type, 0), type + 1);
  if (hunting) s.enemyMemory = { ...s.units.filter((u) => u.side === 'player')[0].pos };
  s.turn = 'enemy';
  const r = runEnemyTurn(s);
  return fingerprint(JSON.stringify({ events: r.events, state: r.state }));
}

// recorded from the code before the performance work and re-recorded when the maps got props (milestone 26): every change since must reproduce them exactly
const GOLDEN: Record<string, string> = {
  '0h': 'a08d107d',
  '1h': '0e65e39c',
  '2h': '75161cd4',
  '3h': '21ce4875',
  '4h': '9f9e67e2',
  '5h': '1cae8ee3',
  '6h': '05a225ec',
  '7h': '8e12c843',
  '8h': '85588a79',
  '9h': 'd1a04799',
  '0p': '515f48ff',
  '1p': '9787e6ae',
  '2p': '90e75841',
  '3p': '4a139b0c',
  '4p': 'f80d3286',
  '5p': 'b1bde140',
  '6p': '3c2efffe',
  '7p': 'f5ce7d36',
  '8p': '974e3eea',
  '9p': 'a1b97258',
};

describe('enemy turns are exactly as they were before the performance work', () => {
  for (const hunting of [true, false]) {
    for (let type = 0; type < 10; type++) {
      const key = `${type}${hunting ? 'h' : 'p'}`;
      it(`map type ${type}, ${hunting ? 'hunting' : 'patrolling'}`, () => {
        const got = turn(type, hunting);
        if (!(key in GOLDEN)) console.log(`GOLDEN ${key}: '${got}',`);
        expect(got).toBe(GOLDEN[key]);
      }, 120000);
    }
  }
});
