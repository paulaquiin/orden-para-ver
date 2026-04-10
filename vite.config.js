import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        franchise: resolve(__dirname, 'franchise/index.html'),
        contenidos: resolve(__dirname, 'contenidos/index.html'),
        descubrir: resolve(__dirname, 'descubrir/index.html'),
        resultado: resolve(__dirname, 'descubrir/resultado/index.html'),
        novedades: resolve(__dirname, 'novedades/index.html'),
        privacidad: resolve(__dirname, 'privacidad/index.html'),
        terminos: resolve(__dirname, 'terminos/index.html'),
      },
    },
  },
});
