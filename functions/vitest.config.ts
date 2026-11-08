import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration suites talk to the Firestore emulator and are opt-in.
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**', 'lib/**'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/shared/**'],
    },
  },
});
