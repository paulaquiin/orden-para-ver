import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOG_CONFIG } from '../../config/blog.js';
import { ContentError, createContentClient, keyTakeaways, postLanguage, postPath, translationRootId } from '../../server/blog/content.js';
import { plainText, sanitizeContent } from '../../server/blog/html.js';
import { handleBlogRequest, handleSitemap } from '../../server/blog/handler.js';
import { renderArticle } from '../../server/blog/render.js';
import { handleRevalidation } from '../../server/blog/revalidate.js';

const config = { ...BLOG_CONFIG, localeRoutes: { es: '/blog', en: '/en/guides', 'pt-br': '/pt-br/guias' } };
const shell = '<!doctype html><html lang="es"><head><!-- BLOG_HEAD_START --><title>Shell</title><!-- BLOG_HEAD_END --></head><body><main><!-- BLOG_CONTENT --></main></body></html>';
const loadShell = async () => shell;
const post = (id = 1, locale = 'es', extra = {}) => ({ id, slug: `post-${id}`, status: 'publish', date: '2026-10-19T10:00:00', modified: '2026-10-20T10:00:00', title: { rendered: 'Cine &amp; libros' }, excerpt: { rendered: '<p>Una historia &amp; mucho más.</p>' }, content: { rendered: '<p>Contenido seguro</p>' }, meta: { seo_control_language: locale }, ...extra });
function response(posts, total = posts.length, totalPages = total ? 1 : 0) {
  return new Response(JSON.stringify(posts), { headers: { 'content-type': 'application/json', 'x-wp-total': String(total), 'x-wp-totalpages': String(totalPages) } });
}
function clientWith(resolver, options = {}) {
  return createContentClient({ config, fetchImpl: async (url, init) => {
    assert.equal(url.origin, BLOG_CONFIG.wordpressUrl);
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
    assert.equal(url.searchParams.get('status'), 'publish');
    assert.equal(url.searchParams.get('_embed'), 'wp:featuredmedia,wp:term');
    return resolver(url, init);
  }, ...options });
}
const req = path => new Request(`${BLOG_CONFIG.frontendUrl}${path}`);

test('listado envía seo_locale y paginación sin solicitar content', async () => {
  const calls = [];
  const client = clientWith(url => {
    calls.push(url);
    assert.equal(url.searchParams.get('seo_locale'), 'es');
    assert.equal(url.searchParams.get('per_page'), '12');
    assert.equal(url.searchParams.get('page'), '2');
    assert.deepEqual(url.searchParams.get('_fields').split(','), ['id', 'slug', 'date', 'modified', 'title', 'excerpt', 'meta', 'yoast_head_json', '_embedded', '_links']);
    return response([post()], 13, 2);
  });
  assert.equal((await client.list({ page: 2 })).total, 13);
  assert.equal(calls.length, 1);
});

test('fallback antiguo recorre páginas de 100 y pagina después de filtrar', async () => {
  const calls = [];
  const global = Array.from({ length: 102 }, (_, index) => post(index + 1, index < 100 && index % 2 ? 'en' : 'es'));
  const client = clientWith(url => {
    calls.push(url);
    assert.ok(!url.searchParams.get('_fields').split(',').includes('content'));
    if (url.searchParams.has('seo_locale')) return response(global.slice(2, 4), 102, 51);
    assert.equal(url.searchParams.get('per_page'), '100');
    const page = Number(url.searchParams.get('page'));
    return response(global.slice((page - 1) * 100, page * 100), 102, 2);
  });
  const result = await client.list({ page: 2, pageSize: 2 });
  assert.deepEqual(result.posts.map(item => item.id), [5, 7]);
  assert.equal(result.total, 52);
  assert.equal(result.totalPages, 26);
  assert.equal(result.legacy, true);
  assert.equal(calls.length, 3);
  await client.list({ page: 3, pageSize: 2 });
  assert.equal(calls.length, 3, 'solo reutiliza la colección durante esta petición');
});

test('no recorre colección global por una respuesta vacía ni por falta de anuncio del conector', async () => {
  let calls = 0;
  const client = clientWith(url => { calls++; assert.equal(url.searchParams.get('seo_locale'), 'es'); return response([]); });
  assert.equal((await client.list()).total, 0);
  assert.equal(calls, 1);
});

test('idioma y source_id admiten metadatos antiguos y fallback al idioma fuente', () => {
  assert.equal(postLanguage({ meta: { replyswipe_language: 'pt-br' } }), 'pt-br');
  assert.equal(postLanguage({ meta: {} }), 'es');
  assert.equal(translationRootId({ id: 8, meta: { replyswipe_translation_source_id: '4' } }), 4);
  assert.equal(translationRootId({ id: 8, meta: { seo_control_translation_source_id: 0 } }), 8);
});

test('slug propio localizado y Unicode codificado una sola vez', () => {
  assert.equal(postPath(post(2, 'en', { slug: 'reading-order' }), config), '/en/guides/reading-order/');
  assert.equal(postPath(post(2, 'es', { slug: 'ficci%C3%B3n' }), config), '/blog/ficci%C3%B3n/');
});

test('detalle solicita content por slug y responde 404 si el idioma no coincide', async () => {
  const client = clientWith(url => {
    assert.equal(url.searchParams.get('slug'), 'reading-order');
    assert.ok(url.searchParams.get('_fields').split(',').includes('content'));
    return response([post(2, 'en', { slug: 'reading-order' })]);
  });
  const result = await handleBlogRequest(req('/blog/reading-order/'), { client, loadShell });
  assert.equal(result.status, 404);
  assert.match(result.headers.get('x-robots-tag'), /noindex/);
  assert.match(await result.text(), /No encontramos esta historia/);
});

test('borradores y programados nunca se renderizan como detalles publicados', async () => {
  for (const status of ['draft', 'future']) {
    const client = clientWith(() => response([post(1, 'es', { status })]));
    assert.equal(await client.bySlug('post-1'), null);
  }
});

test('familia parcial verifica publicación, pertenencia y slugs de cada versión', async () => {
  const original = post(1, 'es', { slug: 'orden-lectura', meta: { seo_control_language: 'es', seo_control_translation_en_id: 2, seo_control_translation_pt_br_id: 0, 'seo_control_translation_pt-br_id': 3 } });
  const english = post(2, 'en', { slug: 'reading-order', meta: { seo_control_language: 'en', seo_control_translation_source_id: 1 } });
  const client = clientWith(url => {
    const id = Number(url.searchParams.get('include'));
    return response(id === 1 ? [original] : id === 2 ? [english] : []);
  });
  const family = await client.family(english);
  assert.deepEqual(family.versions.map(item => item.locale).sort(), ['en', 'es']);
  assert.equal(family.xDefault, 'https://ordenparaver.net/blog/orden-lectura/');
  const view = renderArticle({ post: english, family, locale: 'en', config });
  assert.match(view.head, /canonical" href="https:\/\/ordenparaver.net\/en\/guides\/reading-order\//);
  assert.match(view.head, /hreflang="es"/);
  assert.doesNotMatch(view.head, /hreflang="pt-br"/);
});

test('descarta traducción publicada de otra familia y no fabrica x-default', async () => {
  const english = post(2, 'en', { meta: { seo_control_language: 'en', seo_control_translation_source_id: 1 } });
  const missingRoot = clientWith(() => response([]));
  const family = await missingRoot.family(english);
  assert.equal(family.xDefault, null);
  assert.deepEqual(family.versions.map(item => item.locale), ['en']);
  const root = post(1, 'es', { meta: { seo_control_language: 'es', seo_control_translation_en_id: 2 } });
  const unrelated = clientWith(() => response([post(2, 'en', { meta: { seo_control_language: 'en', seo_control_translation_source_id: 99 } })]));
  assert.deepEqual((await unrelated.family(root)).versions.map(item => item.locale), ['es']);
});

test('puntos clave: JSON inválido, objetos incorrectos y fallback antiguo', () => {
  for (const raw of ['not-json', '{}', '[null]', '[{"question":4,"answer":"texto"}]', '[{"question":"","answer":"texto"}]']) {
    assert.deepEqual(keyTakeaways({ meta: { seo_control_key_takeaways: raw } }), []);
  }
  assert.deepEqual(keyTakeaways({ meta: { replyswipe_key_takeaways: '[{"question":"¿Orden?","answer":"Publicación"}]' } }), [{ question: '¿Orden?', answer: 'Publicación' }]);
});

test('sanitización elimina scripts, eventos, formularios, iframe y URLs peligrosas', () => {
  const html = sanitizeContent('<p>Cine &amp; libros</p><script>alert(1)</script><iframe src="https://youtube.com/embed/x">frame</iframe><form><input name="x"><p>form</p></form><svg onload="alert(1)"></svg><a href="jav&#x61;script:alert(1)" onclick="alert(1)">Enlace</a><img src="data:text/html,evil" onerror="alert(1)"><img src="//evil.test/x"><p>&lt;script&gt;texto&lt;/script&gt;</p>');
  assert.doesNotMatch(html, /<script|<iframe|<form|<input|<svg|onload|onclick|onerror|javascript:|data:text|src="\/\//i);
  assert.match(html, /Cine &amp; libros/);
  assert.match(html, /&lt;script&gt;texto&lt;\/script&gt;/);
  assert.equal(plainText('Cine &amp; &quot;libros&quot;'), 'Cine & "libros"');
});

test('metadatos Yoast se usan sin heredar el canonical del backend', () => {
  const item = post(1, 'es', { yoast_head_json: { title: 'Título SEO', description: 'Descripción SEO', canonical: 'https://api.ordenparaver.net/post-1/', og_image: [{ url: 'https://api.ordenparaver.net/image.jpg' }] } });
  const view = renderArticle({ post: item, family: { versions: [], xDefault: null }, locale: 'es' });
  assert.match(view.head, /<title>Título SEO<\/title>/);
  assert.match(view.head, /canonical" href="https:\/\/ordenparaver.net\/blog\/post-1\//);
  assert.match(view.head, /property="og:image"/);
  assert.doesNotMatch(view.head, /canonical" href="https:\/\/api/);
});

test('índice sin publicaciones tiene estado vacío y noindex', async () => {
  const result = await handleBlogRequest(req('/blog/'), { client: clientWith(() => response([])), loadShell });
  assert.equal(result.status, 200);
  const html = await result.text();
  assert.match(html, /Próximamente, nuevas historias/);
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('fallo de WordPress devuelve error real con noindex y Retry-After', async () => {
  const client = clientWith(() => { throw new Error('network'); });
  const result = await handleBlogRequest(req('/blog/'), { client, loadShell });
  assert.equal(result.status, 502);
  assert.equal(result.headers.get('retry-after'), '60');
  assert.match(await result.text(), /El blog no está disponible ahora/);
});

test('página fuera de rango devuelve 404 y no una página vacía indexable', async () => {
  const client = clientWith(() => new Response(JSON.stringify({ code: 'rest_post_invalid_page_number' }), { status: 400 }));
  const result = await handleBlogRequest(req('/blog/?page=999'), { client, loadShell });
  assert.equal(result.status, 404);
});

test('categorías se extraen de wp:term y se consultan en WordPress', async () => {
  const client = clientWith(url => {
    assert.equal(url.searchParams.get('categories'), '4');
    return response([post(1, 'es', { _embedded: { 'wp:term': [[{ id: 4, name: 'Libros', taxonomy: 'category' }], [{ id: 5, name: 'Etiqueta oculta', taxonomy: 'post_tag' }]] } })]);
  });
  const result = await handleBlogRequest(req('/blog/categoria/4/'), { client, loadShell });
  const html = await result.text();
  assert.match(html, /Libros/);
  assert.doesNotMatch(html, /Etiqueta oculta/);
});

test('sitemap usa slugs públicos, sin solicitar contenido', async () => {
  const client = clientWith(url => {
    assert.ok(!url.searchParams.get('_fields').split(',').includes('content'));
    return response([post()]);
  }, { config: BLOG_CONFIG });
  const result = await handleSitemap(req('/sitemap.xml'), { client });
  assert.equal(result.status, 200);
  assert.match(await result.text(), /<loc>https:\/\/ordenparaver.net\/blog\/post-1\/<\/loc>/);
});

const env = { BLOG_REVALIDATION_TOKEN: 'unit-test-only', MONITOR_SEO_PROJECT_ID: BLOG_CONFIG.monitorSeoProjectId };
const event = { type: 'post.published', postId: 1, locale: 'es', projectId: BLOG_CONFIG.monitorSeoProjectId, siteUrl: 'https://api.ordenparaver.net' };
const webhook = (body = event, token = env.BLOG_REVALIDATION_TOKEN) => new Request(`${BLOG_CONFIG.frontendUrl}/api/revalidate-blog`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('revalidación exige configuración, token y proyecto de este sitio', async () => {
  assert.equal((await handleRevalidation(webhook())).status, 503);
  assert.equal((await handleRevalidation(webhook(), { env: { ...env, MONITOR_SEO_PROJECT_ID: 'another-project' } })).status, 503);
  assert.equal((await handleRevalidation(webhook(event, 'wrong'), { env })).status, 401);
  for (const body of [{ ...event, siteUrl: 'https://other-project.test' }, { ...event, projectId: 'other' }, { ...event, locale: 'en' }, { ...event, postId: -1 }, { ...event, type: 'unknown' }]) {
    assert.equal((await handleRevalidation(webhook(body), { env })).status, 400);
  }
});

test('post.scheduled nunca consulta ni publica contenido futuro', async () => {
  const client = clientWith(url => { assert.equal(url.searchParams.get('status'), 'publish'); return response([]); });
  const result = await handleRevalidation(webhook({ ...event, type: 'post.scheduled' }), { env, client });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.published, false);
  assert.equal(body.strategy, 'ssr-no-store');
  assert.ok(body.paths.includes('/sitemap.xml'));
  assert.ok(body.paths.includes('/blog/categoria/*'));
});

test('revalidación incluye artículo e índices y nunca almacena contenido', async () => {
  const client = clientWith(() => response([post()]));
  const result = await handleRevalidation(webhook(), { env, client });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.published, true);
  assert.ok(body.paths.includes('/blog/post-1/'));
  assert.ok(body.paths.includes('/blog/'));
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('revalidación usa el projectId facilitado sin exigir una variable adicional', async () => {
  const client = clientWith(() => response([post()]));
  const result = await handleRevalidation(webhook({ ...event, projectId: BLOG_CONFIG.monitorSeoProjectId }), {
    env: { BLOG_REVALIDATION_TOKEN: env.BLOG_REVALIDATION_TOKEN }, client,
  });
  assert.equal(result.status, 200);
});

test('no sigue redirecciones del backend a otras instalaciones', async () => {
  const client = clientWith(() => new Response(null, { status: 302, headers: { Location: 'https://other-project.test/wp-json/' } }));
  await assert.rejects(client.list(), ContentError);
});

test('revalidación limita el cuerpo recibido', async () => {
  const result = await handleRevalidation(webhook({ ...event, extra: 'x'.repeat(9000) }), { env });
  assert.equal(result.status, 413);
});
