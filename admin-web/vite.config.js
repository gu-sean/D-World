import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server: /admin/v1 is proxied to the backend so cookies stay same-origin (docs/12 §8.3).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/admin/v1': 'http://localhost:3000' },
  },
});
