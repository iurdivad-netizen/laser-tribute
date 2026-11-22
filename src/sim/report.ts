import type { MissionRecord } from './campaign';

export interface RunSummary {
  seed: number;
  status: 'active' | 'won' | 'lost';
  records: MissionRecord[];
}

/** A Wilson 95% interval for a win rate, as "lo-hi" percent, so a small sample does not pass for a firm number. */
export function interval(wins: number, n: number): string {
  if (n === 0) return '-';
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return `${Math.round((100 * (c - m)) / d)}-${Math.round((100 * (c + m)) / d)}`;
}

/** The per-mission table: how many campaigns reached each mission, the win rate (with its 95% interval), timeouts, casualties, turns. */
export function formatReport(runs: RunSummary[]): string {
  const rows: MissionRecord[][] = Array.from({ length: 10 }, () => []);
  for (const run of runs) for (const r of run.records) rows[r.mission - 1].push(r);
  const lines = ['mission  reached  win%  (95% range)  timeouts  avg casualties  avg turns  enemies  budget'];
  for (const [i, rs] of rows.entries()) {
    if (rs.length === 0) continue;
    const avg = (f: (r: MissionRecord) => number) => (rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1);
    const wins = rs.filter((r) => r.won).length;
    lines.push(
      `${String(i + 1).padStart(7)}  ${String(rs.length).padStart(7)}  ${String(Math.round((100 * wins) / rs.length)).padStart(3)}%  ` +
        `${interval(wins, rs.length).padStart(11)}  ${String(rs.filter((r) => r.timedOut).length).padStart(8)}  ` +
        `${avg((r) => r.casualties).padStart(14)}  ${avg((r) => r.turns).padStart(9)}  ${avg((r) => r.enemies).padStart(7)}  ${avg((r) => r.budget).padStart(6)}`,
    );
  }
  const done = runs.filter((r) => r.status === 'won').length;
  lines.push(`campaigns completed: ${done}/${runs.length} (${Math.round((100 * done) / Math.max(1, runs.length))}%, 95% range ${interval(done, runs.length)})`);
  return lines.join('\n');
}
