import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const proxyTarget = env.VITE_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
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
    },
  };
});
