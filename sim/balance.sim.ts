import { test } from 'vitest';
import { runCampaign, type MissionRecord } from '../src/sim/campaign';

const RUNS = Number(process.env.BALANCE_RUNS ?? 20);
const FIRST = Number(process.env.BALANCE_SEED ?? 1);

test('balance report', () => {
  const rows: MissionRecord[][] = Array.from({ length: 10 }, () => []);
  let completed = 0;
  for (let seed = FIRST; seed < FIRST + RUNS; seed++) {
    const run = runCampaign(seed);
    if (run.status === 'won') completed++;
    for (const r of run.records) rows[r.mission - 1].push(r);
  }
  const lines = ['mission  reached  win%   timeouts  avg casualties  avg turns  enemies  budget'];
  for (const [i, rs] of rows.entries()) {
    if (rs.length === 0) continue;
    const avg = (f: (r: MissionRecord) => number) => (rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1);
    const wins = rs.filter((r) => r.won).length;
    lines.push(
      `${String(i + 1).padStart(7)}  ${String(rs.length).padStart(7)}  ${String(Math.round((100 * wins) / rs.length)).padStart(3)}%  ` +
        `${String(rs.filter((r) => r.timedOut).length).padStart(8)}  ${avg((r) => r.casualties).padStart(14)}  ` +
        `${avg((r) => r.turns).padStart(9)}  ${avg((r) => r.enemies).padStart(7)}  ${avg((r) => r.budget).padStart(6)}`,
    );
  }
  lines.push(`campaigns completed: ${completed}/${RUNS} (${Math.round((100 * completed) / RUNS)}%)`);
  console.log(`\n${lines.join('\n')}\n`);
});
