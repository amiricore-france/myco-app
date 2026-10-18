import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,           // ← écoute sur 0.0.0.0 (toutes les interfaces)
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4400',
      '/uploads': 'http://localhost:4400'
    }
  }
});
