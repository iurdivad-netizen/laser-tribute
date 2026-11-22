import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from 'vitest';
import type { BotMode } from '../src/sim/bot';
import { runCampaign } from '../src/sim/campaign';
import { formatReport, type RunSummary } from '../src/sim/report';

const RUNS = Number(process.env.BALANCE_RUNS ?? 20);
const FIRST = Number(process.env.BALANCE_SEED ?? 1);
const MODE = (process.env.BOT ?? 'basic') as BotMode;
const ROLES = process.env.NOROLES !== '1';
const OUT = process.env.BALANCE_OUT;

test('balance report', () => {
  const runs: RunSummary[] = [];
  for (let seed = FIRST; seed < FIRST + RUNS; seed++) {
    const run = runCampaign(seed, MODE, ROLES);
    runs.push({ seed, status: run.status, records: run.records });
  }
  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(runs));
  } else {
    console.log(`\nbot: ${MODE}, roles: ${ROLES ? 'on' : 'off'}\n${formatReport(runs)}\n`);
  }
});
