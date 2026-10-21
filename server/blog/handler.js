import { BLOG_CONFIG } from '../../config/blog.js';
import { ContentError, createContentClient, postUrl } from './content.js';
import { escapeHtml as e } from './html.js';
import { renderArticle, renderHead, renderIndex, renderState } from './render.js';

export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function matchBlogRoute(pathname, config = BLOG_CONFIG) {
  for (const [locale, prefix] of Object.entries(config.localeRoutes)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const segments = pathname.slice(prefix.length).split('/').filter(Boolean);
      if (!segments.length) return { locale, kind: 'index' };
      if (segments.length === 2 && segments[0] === 'categoria' && /^[1-9]\d*$/.test(segments[1])) {
        const category = Number(segments[1]);
        if (Number.isSafeInteger(category)) return { locale, kind: 'index', category };
      }
      if (segments.length === 1 && segments[0] !== 'categoria') {
        try {
          const slug = decodeURIComponent(segments[0]);
          if (!slug.includes('/') && !slug.includes('\\')) return { locale, kind: 'article', slug };
        } catch { /* Invalid percent encoding becomes 404. */ }
      }
      return { locale, kind: '404' };
    }
  }
  return null;
}

function withBody(body, request, status, headers) {
  return new Response(request.method === 'HEAD' ? null : body, { status, headers: { ...NO_CACHE_HEADERS, ...headers } });
}

export async function handleBlogRequest(request, { config = BLOG_CONFIG, client = createContentClient({ config }), loadShell } = {}) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) {
    return withBody('Método no permitido.', request, 405, { Allow: 'GET, HEAD' });
  }
  const route = matchBlogRoute(url.pathname, config);
  if (!route) return null;
  if (!url.pathname.endsWith('/')) {
    return withBody(null, request, 308, { Location: `${url.pathname}/${url.search}` });
  }
  let view;
  let status = 200;
  try {
    if (route.kind === '404') throw new ContentError('Artículo no encontrado.', 404);
    if (route.kind === 'index') {
      const rawPage = url.searchParams.get('page') ?? '1';
      if (!/^[1-9]\d{0,5}$/.test(rawPage)) throw new ContentError('Página no encontrada.', 404);
      const page = Number(rawPage);
      const result = await client.list({ locale: route.locale, page, category: route.category });
      view = renderIndex({ result, locale: route.locale, category: route.category, page, config });
    } else {
      const post = await client.bySlug(route.slug, route.locale);
      if (!post) throw new ContentError('Artículo no encontrado.', 404);
      const family = await client.family(post);
      view = renderArticle({ post, family, locale: route.locale, config });
    }
  } catch (error) {
    status = error instanceof ContentError ? error.status : 502;
    const notFound = status === 404;
    const title = notFound ? 'No encontramos esta historia' : 'El blog no está disponible ahora';
    view = {
      noindex: true,
      head: renderHead({ title: `${title} | Ordenparaver`, description: title, canonical: `${config.frontendUrl}${url.pathname}`, noindex: true }),
      body: renderState(title, notFound ? 'Puede que este artículo haya cambiado de dirección o todavía no esté publicado.' : 'No hemos podido consultar los artículos. Inténtalo de nuevo en unos minutos.', `${config.localeRoutes[route.locale]}/`),
    };
  }
  const preview = url.origin !== config.frontendUrl;
  if (preview) view.head = view.head.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, follow">');
  let html;
  try {
    const shell = await loadShell();
    if (!shell.includes('<!-- BLOG_HEAD_START -->') || !shell.includes('<!-- BLOG_CONTENT -->')) throw new Error('Missing blog shell');
    html = shell.replace(/lang="es"/, `lang="${e(route.locale)}"`)
      .replace(/<!-- BLOG_HEAD_START -->[\s\S]*?<!-- BLOG_HEAD_END -->/, () => view.head)
      .replace('<!-- BLOG_CONTENT -->', () => view.body);
  } catch {
    status = 503;
    html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><title>Blog no disponible | Ordenparaver</title></head><body><h1>El blog no está disponible ahora</h1><p>Inténtalo de nuevo en unos minutos.</p><a href="/">Volver a inicio</a></body></html>';
  }
  return withBody(html, request, status, {
    'Content-Type': 'text/html; charset=utf-8',
    ...(view.noindex || preview || status >= 400 ? { 'X-Robots-Tag': 'noindex, follow' } : {}),
    ...(status >= 500 ? { 'Retry-After': '60' } : {}),
  });
}

const staticPaths = ['/', '/contenidos/', '/explorar/', '/descubrir/', '/novedades/', '/libros/'];

export async function handleSitemap(request, { config = BLOG_CONFIG, client = createContentClient({ config }) } = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) return withBody('Método no permitido.', request, 405, { Allow: 'GET, HEAD' });
  try {
    const entries = staticPaths.map(path => `<url><loc>${e(config.frontendUrl + path)}</loc></url>`);
    for (const [locale, prefix] of Object.entries(config.localeRoutes)) {
      const posts = await client.allPublished(locale);
      // Empty/noindex indexes must not be advertised in the sitemap.
      if (posts.length) entries.push(`<url><loc>${e(config.frontendUrl + prefix + '/')}</loc></url>`);
      for (const post of posts) {
        const modified = new Date(post.modified);
        entries.push(`<url><loc>${e(postUrl(post, config))}</loc>${Number.isNaN(modified.valueOf()) ? '' : `<lastmod>${modified.toISOString()}</lastmod>`}</url>`);
      }
    }
    if (entries.length > 50_000) throw new ContentError('El sitemap requiere dividirse.');
    return withBody(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`, request, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  } catch {
    return withBody('No se puede generar el sitemap ahora.', request, 503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60', 'X-Robots-Tag': 'noindex' });
  }
}

export function handleRobots(request, config = BLOG_CONFIG) {
  const preview = new URL(request.url).origin !== config.frontendUrl;
  return withBody(`User-agent: *\nDisallow: ${preview ? '/' : '/blog-shell'}\n${preview ? '' : `Sitemap: ${config.frontendUrl}/sitemap.xml\n`}`, request, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
}
