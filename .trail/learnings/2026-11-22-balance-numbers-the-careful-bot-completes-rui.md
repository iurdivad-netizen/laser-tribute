---
title: "Balance numbers: the careful bot completes about half the campaigns, and bot stalls count as losses"
author: Rui
date: 2026-11-22
branch: feature/careful-bot
cost: { minutes: 13, tokens: 48372 }
id: l-8a72c858
scope: repo
status: active
src: agent
touches:
  - sim/balance.sim.ts
  - sim/report.sim.ts
  - sim/shard.mjs
  - src/core/enemyArms.ts
  - src/sim/bot.ts
  - src/sim/campaign.ts
  - src/sim/report.ts
  - tests/simbot.test.ts
---

## Decided
The careful bot (sees only what the squad has seen, goes on overwatch, uses medkits) is the fairer yardstick. On 64 seeds it completed the ten-mission campaign 44% of the time with enemy roles and 53% without (95% ranges 32-56 and 41-65, so the roles effect is real but small). Roles bite in missions 8 and 10 (91% vs 98%, 80% vs 92%). The naive bot that knows every enemy position completes only about 15-20%, so the bot's tactics matter far more than the roles do. Squad budget reaches about 440 by mission 10, which roughly buys the best kit for all four soldiers, so late missions get no harder for the squad than mid ones; a human playtest should decide whether to raise late enemy counts before touching the roles.

## Tried and ruled out
Keeping the squad together by making a soldier wait when he is ahead of the others: a soldier standing in a doorway waited, blocked everyone behind him, and nothing moved. Fix: if nobody moved this turn, relax the rule for the rest of the turn, and let moving outrank going on overwatch.

## Watch out
In the code: src/sim/bot.ts (`botTurn`, `relaxed`), `sim/shard.mjs` runs shards in parallel (`BOT=careful node sim/shard.mjs <label> <first seed> <total> <shards>`). A mission that passes 80 turns counts as lost, and about 3% of careful-bot missions do (stalls, not deaths), so win rates are slightly pessimistic, even mission 1 reads 97%. A full 64-seed run takes about 25 minutes on 8 cores.
