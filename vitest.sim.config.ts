import { defineConfig } from 'vitest/config';

/** `npm run balance`: plays the whole campaign with a bot over many seeds and prints win rates per mission. */
export default defineConfig({
  test: { include: ['sim/**/*.sim.ts'], testTimeout: 3_600_000, hookTimeout: 3_600_000 },
});
