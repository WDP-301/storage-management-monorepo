import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const require = createRequire(import.meta.url);
// pnpm can materialize hoisted deps as real directories, which leaves
// node_modules/react as a second physical copy next to the one react-dom
// resolves through .pnpm. Pin `react` to react-dom's instance so hooks work.
const reactDir = path.dirname(
  fs.realpathSync(
    require.resolve('react/package.json', {
      paths: [path.dirname(fs.realpathSync(require.resolve('react-dom/package.json')))],
    }),
  ),
);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const proxyTarget = env.VITE_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // Keep hoisted dependencies on the same React instance as the web app.
      dedupe: ['react', 'react-dom'],
      alias: {
        react: reactDir,
        '@': path.resolve(import.meta.dirname, './src'),
        '@storage/types': path.resolve(import.meta.dirname, '../../packages/types/src/index.ts'),
      },
    },
    server: {
      port: 3000,
      host: true,
      ...(proxyTarget && {
        proxy: {
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
        },
      }),
    },
    preview: {
      port: 3000,
      host: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      testTimeout: 15000,
    },
  };
});
