import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuracion de Vite para la SPA de Cuidarte+.
 *
 * El proxy de desarrollo evita exponer la URL del backend en el cliente y
 * mantiene el mismo origen durante el desarrollo, de modo que la politica CORS
 * del servidor se pruebe de forma realista en QA y no quede desactivada.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
