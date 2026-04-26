import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';

// Helper to dynamically get all HTML files from the blog directory
function getBlogInputs() {
  const inputs = {};
  const blogDir = resolve(__dirname, 'blog');
  
  if (existsSync(blogDir)) {
    // Add blog index
    inputs['blog'] = resolve(blogDir, 'index.html');
    
    // Add all blog posts
    const files = readdirSync(blogDir);
    for (const file of files) {
      const fullPath = resolve(blogDir, file);
      if (statSync(fullPath).isDirectory() && existsSync(resolve(fullPath, 'index.html'))) {
         inputs[`blog_${file}`] = resolve(fullPath, 'index.html');
      }
    }
  }
  return inputs;
}

export default defineConfig({
  server: {
    historyApiFallback: {
      rewrites: [
        { from: /^\/contenidos\/.*$/, to: '/franchise/index.html' }
      ]
    }
  },
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
        ...getBlogInputs(),
      },
    },
  },
});
