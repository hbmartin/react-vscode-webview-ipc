import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.ts', 'src/**/*.stories.tsx'],
    },
    alias: {
      vscode: resolve(__dirname, 'tests/setup/__mocks__/vscode.ts'),
    },
  },
});