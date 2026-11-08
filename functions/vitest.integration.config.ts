import { defineConfig } from 'vitest/config';

/**
 * Integration suite: runs ONLY *.integration.test.ts, against the Firebase
 * emulator. Launched via `npm run test:integration`, which wraps this in
 * `firebase emulators:exec` so FIRESTORE_EMULATOR_HOST is set. Kept apart from
 * the default `vitest.config.ts` so `npm test` stays hermetic (CLAUDE.md §1.6).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Emulator data is shared per project; keep files serial to avoid races.
    fileParallelism: false,
  },
});
