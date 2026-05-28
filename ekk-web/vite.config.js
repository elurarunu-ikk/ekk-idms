import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.trycloudflare.com', 'all'],
    proxy: {
      '/api': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/project-config': 'http://localhost:8000',
      '/reference-data': 'http://localhost:8000',
      '/level-register': 'http://localhost:8000',
      '/ogl': 'http://localhost:8000',
      '/gps': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
});