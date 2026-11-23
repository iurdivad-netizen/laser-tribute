import { expect, test } from 'vitest';
import { DIFFICULTY_IDS, type DifficultyId } from '../src/core/world/difficulty';
import type { BotMode } from '../src/sim/bot';
import { playWithBot, runStory } from '../src/sim/story';

const RUNS = Number(process.env.STORY_RUNS ?? 4);
const FIRST = Number(process.env.STORY_SEED ?? 1);
const MODE = (process.env.BOT ?? 'careful') as BotMode;
const PRESETS = (process.env.STORY_DIFFICULTY ? [process.env.STORY_DIFFICULTY] : ['calm']) as DifficultyId[];

/** `npm run balance`: the bot plays the story world with "attack the lowest legal region". Prints one line per run. */
test('story smoke run', () => {
  const lines: string[] = [];
  for (const difficulty of PRESETS) {
    expect(DIFFICULTY_IDS).toContain(difficulty);
    for (let seed = FIRST; seed < FIRST + RUNS; seed++) {
      const run = runStory(seed, difficulty, playWithBot(MODE));
      lines.push(
        `${difficulty} seed ${seed}: ${run.status} in ${run.steps} steps, day ${run.day}, held ${run.held}, losses ${run.losses}`,
      );
      expect(run.steps).toBeLessThanOrEqual(300);
    }
  }
  console.log(`\nstory bot: ${MODE}\n${lines.join('\n')}\n`);
});
