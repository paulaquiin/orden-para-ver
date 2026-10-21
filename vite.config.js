import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { Readable } from 'node:stream';
import { parse } from 'dotenv';

// Render the same server modules in Vite development and Cloudflare production.
function wordpressBlogDev() {
  return {
    name: 'wordpress-blog-dev',
    configureServer(server) {
      server.middlewares.use(async (incoming, outgoing, next) => {
        const path = new URL(incoming.url, 'http://localhost').pathname;
        if (!(path === '/blog' || path.startsWith('/blog/') || ['/sitemap.xml', '/robots.txt', '/api/revalidate-blog'].includes(path))) return next();
        try {
          const handlers = await server.ssrLoadModule('/server/blog/handler.js');
          const method = incoming.method || 'GET';
          const request = new Request(new URL(incoming.url, `http://${incoming.headers.host || 'localhost:5173'}`), {
            method, headers: incoming.headers,
            ...(!['GET', 'HEAD'].includes(method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
          });
          let response;
          if (path === '/sitemap.xml') response = await handlers.handleSitemap(request);
          else if (path === '/robots.txt') response = handlers.handleRobots(request);
          else if (path === '/api/revalidate-blog') {
            const { handleRevalidation } = await server.ssrLoadModule('/server/blog/revalidate.js');
            const varsFile = resolve(__dirname, '.dev.vars');
            const env = { ...process.env, ...(existsSync(varsFile) ? parse(readFileSync(varsFile)) : {}) };
            response = await handleRevalidation(request, { env });
          } else response = await handlers.handleBlogRequest(request, {
            loadShell: () => server.transformIndexHtml('/blog-shell.html', readFileSync(resolve(__dirname, 'blog-shell.html'), 'utf8')),
          });
          outgoing.statusCode = response.status;
          response.headers.forEach((value, key) => outgoing.setHeader(key, value));
          outgoing.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) { next(error); }
      });
    },
  };
}

export default defineConfig({
  plugins: [wordpressBlogDev()],
  server: {
    fs: {
      deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/.dev.vars', '**/.dev.vars.*'],
    },
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
        explorar: resolve(__dirname, 'explorar/index.html'),
        descubrir: resolve(__dirname, 'descubrir/index.html'),
        resultado: resolve(__dirname, 'descubrir/resultado/index.html'),
        novedades: resolve(__dirname, 'novedades/index.html'),
        libros: resolve(__dirname, 'libros/index.html'),
        privacidad: resolve(__dirname, 'privacidad/index.html'),
        terminos: resolve(__dirname, 'terminos/index.html'),
        blogShell: resolve(__dirname, 'blog-shell.html'),
      },
    },
  },
});
