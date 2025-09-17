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
        index: resolve(__dirname, 'src/lib/index.ts'),
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
});
