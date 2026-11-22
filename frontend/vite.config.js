import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development open http://localhost:5173 (main site) and http://arun.localhost:5173 (influencer site).
// The proxy keeps the original Host header so the API can resolve the influencer subdomain.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.localhost', '.jencorps.com'],
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: false, xfwd: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: false },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
