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

// recorded from the code before the performance work: every change since must reproduce them exactly
const GOLDEN: Record<string, string> = {
  '0h': 'a08d107d',
  '1h': 'df6a06cf',
  '2h': 'df0cbf1e',
  '3h': '21ce4875',
  '4h': '7441643d',
  '5h': 'e6225237',
  '6h': '9c735d4f',
  '7h': '8d721ff3',
  '8h': '97d2e17f',
  '9h': '817b39f6',
  '0p': '515f48ff',
  '1p': 'c0f99dd5',
  '2p': 'bdd66881',
  '3p': '4a139b0c',
  '4p': 'a20c7781',
  '5p': 'bde9502a',
  '6p': 'e1fec8f8',
  '7p': '56f10524',
  '8p': '452520c0',
  '9p': '8b3da79b',
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
