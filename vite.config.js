import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        franchise: resolve(__dirname, 'franchise.html'),
        contenido: resolve(__dirname, 'pages/contenido.html'),
        novedades: resolve(__dirname, 'pages/novedades.html'),
        privacidad: resolve(__dirname, 'pages/privacidad.html'),
        terminos: resolve(__dirname, 'pages/terminos.html'),
      },
    },
  },
});
