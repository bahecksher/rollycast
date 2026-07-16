import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The worker (wrangler dev) runs on :8787 in development; WebSocket + API calls are proxied
// there so the browser talks to a single origin. Wired up in Milestone 2.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/parties': {
        target: 'http://127.0.0.1:8787',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
