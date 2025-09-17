import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/lib/**/*'],
      rollupTypes: true,
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        host: resolve(__dirname, 'src/lib/host.ts'),
        client: resolve(__dirname, 'src/lib/client.ts'),
      },
      formats: ['es', 'cjs'],
      name: 'ReactVSCodeWebviewIPC',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'vscode'],
      output: {
        preserveModules: false,
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },
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
