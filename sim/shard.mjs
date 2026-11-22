// Usage: node sim/shard.mjs <label> <first seed> <total seeds> <shards>   (env BOT=basic|careful, NOROLES=1)
// Runs the shards as parallel vitest processes, then prints one merged table.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [label, first, total, shards] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5])];
const dir = join('sim', 'out', label);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const per = Math.ceil(total / shards);
const run = (env) => new Promise((resolve) => {
  const p = spawn('npx', ['vitest', 'run', '--config', 'vitest.sim.config.ts', '--disableConsoleIntercept', ...(env.FILE ? [env.FILE] : [])],
    { env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'inherit'], shell: true });
  p.on('exit', resolve);
});
const jobs = [];
for (let i = 0; i < shards; i++) {
  const start = first + i * per;
  const runs = Math.min(per, first + total - start);
  if (runs <= 0) break;
  jobs.push(run({ FILE: 'sim/balance.sim.ts', BALANCE_SEED: String(start), BALANCE_RUNS: String(runs), BALANCE_OUT: join(dir, `${start}.json`) }));
}
await Promise.all(jobs);
await run({ FILE: 'sim/report.sim.ts', BALANCE_DIR: dir, BALANCE_LABEL: label });
