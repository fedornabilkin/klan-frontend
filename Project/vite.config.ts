import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const { VITE_API_TARGET = 'http://127.0.0.1:3001', VITE_DEV_PORT = '5173' } = loadEnv(mode, process.cwd(), 'VITE_');
  const port = Number(VITE_DEV_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('VITE_DEV_PORT must be an integer from 1 to 65535');
  return {
    plugins: [vue({ template: { preprocessOptions: { doctype: 'html' } } })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      },
    },
    server: {
      host: 'localhost',
      port,
      strictPort: true,
      proxy: {
        '/api': { target: VITE_API_TARGET, changeOrigin: false },
        '/ws': { target: VITE_API_TARGET, ws: true },
      },
    },
    build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  };
});
