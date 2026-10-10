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
  '0h': '4e66aa67',
  '1h': 'd38580a4',
  '2h': '13036eca',
  '3h': 'c7fbc57d',
  '4h': '4e866bd8',
  '5h': 'e4039f5e',
  '6h': '7dc34d63',
  '7h': '4293aa0a',
  '8h': '520c5329',
  '9h': '2511ad91',
  '0p': '2f171475',
  '1p': '0364b836',
  '2p': 'eb5070f3',
  '3p': '7d23acf1',
  '4p': '7e71d250',
  '5p': '0a7fe615',
  '6p': '638784bb',
  '7p': '23945d5a',
  '8p': 'e5bf0e9a',
  '9p': '8b9655c0',
};

describe('enemy turns are exactly as recorded (re-record only when the maps change on purpose)', () => {
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
