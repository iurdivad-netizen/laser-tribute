import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { formatReport, type RunSummary } from '../src/sim/report';

/** Merges the shard files in BALANCE_DIR into one table. */
test.skipIf(!process.env.BALANCE_DIR)('merged balance report', () => {
  const dir = process.env.BALANCE_DIR!;
  const runs: RunSummary[] = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as RunSummary[]);
  console.log(`\n${process.env.BALANCE_LABEL ?? dir}: ${runs.length} campaigns\n${formatReport(runs)}\n`);
});
