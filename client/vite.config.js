import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Librairies lourdes dans leurs propres chunks : mises en cache
        // indépendamment et partagées entre les pages qui les utilisent.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-map': ['leaflet', 'react-leaflet'],
        }
      }
    }
  },
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
