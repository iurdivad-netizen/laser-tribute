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
  '0h': '840bb1c5',
  '1h': '57629478',
  '2h': 'e5f7c65b',
  '3h': '36f0bdd6',
  '4h': '7d895657',
  '5h': 'f3629c76',
  '6h': '57c6549c',
  '7h': '0011f270',
  '8h': 'feaa6949',
  '9h': '85766395',
  '0p': '70fdb6c7',
  '1p': 'afbd1e52',
  '2p': 'ac8c9a55',
  '3p': '6bd6d0a2',
  '4p': '71953975',
  '5p': '025d6a8d',
  '6p': '0fbbb89b',
  '7p': '9604aee2',
  '8p': '4efc3aba',
  '9p': 'f0b1cdb4',
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
