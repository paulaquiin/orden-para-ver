import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BLOG_CONFIG } from '../config/blog.js';
import { createContentClient, keyTakeaways, postLanguage, postPath } from '../server/blog/content.js';
import { escapeHtml, plainText } from '../server/blog/html.js';
import { handleBlogRequest, handleSitemap } from '../server/blog/handler.js';
import { handleRevalidation } from '../server/blog/revalidate.js';

let requests = 0;
const fetchImpl = async (url, init) => {
  requests++;
  assert.equal(url.origin, BLOG_CONFIG.wordpressUrl);
  assert.equal(url.searchParams.get('status'), 'publish');
  if (!url.searchParams.has('slug') && !url.searchParams.has('include')) {
    assert.ok(!url.searchParams.get('_fields').split(',').includes('content'));
  }
  return fetch(url, init);
};
const shell = await readFile(new URL('../blog-shell.html', import.meta.url), 'utf8');
const loadShell = async () => shell;
const request = path => new Request(BLOG_CONFIG.frontendUrl + path);

try {
  console.log(`Verificación con datos públicos de ${BLOG_CONFIG.wordpressUrl}`);
  const client = createContentClient({ fetchImpl });
  for (const [locale, prefix] of Object.entries(BLOG_CONFIG.localeRoutes)) {
    const result = await client.list({ locale });
    const index = await handleBlogRequest(request(`${prefix}/`), { client, loadShell });
    assert.equal(index.status, 200);
    const indexHtml = await index.text();
    if (!result.posts.length) {
      assert.match(indexHtml, /name="robots" content="noindex, follow"/);
      console.log(`OK ${locale}: índice vacío con noindex (sin artículos para probar detalle).`);
      continue;
    }
    assert.match(indexHtml, /name="robots" content="index, follow/);
    for (const post of result.posts) {
      assert.equal(postLanguage(post), locale);
      assert.ok(indexHtml.includes(escapeHtml(postPath(post))));
    }
    const sample = result.posts[0];
    const detail = await handleBlogRequest(request(postPath(sample)), { client, loadShell });
    assert.equal(detail.status, 200);
    const detailHtml = await detail.text();
    assert.ok(detailHtml.includes(`<h1 class="page-heading-title">${escapeHtml(plainText(sample.title.rendered))}</h1>`));
    assert.ok(detailHtml.includes(`rel="canonical" href="${BLOG_CONFIG.frontendUrl}${postPath(sample)}"`));
    assert.ok(detailHtml.includes(`hreflang="${locale}"`));
    assert.ok(detailHtml.includes('hreflang="x-default"'));
    const full = await client.bySlug(sample.slug, locale);
    assert.ok(full.content?.rendered?.length > 0);
    assert.ok(full._embedded?.['wp:featuredmedia']?.[0]?.source_url);
    assert.ok(keyTakeaways(full).length > 0);
    console.log(`OK ${locale}: ${result.total} artículo(s), índice y detalle HTTP 200. Muestra: id=${sample.id}, ${postPath(sample)}`);
    console.log(`OK muestra: contenido, imagen, puntos clave, canonical y hreflang de español.`);

    // Exercise the actual webhook handler with real content, but ephemeral local
    // credentials. No event is sent to production or Monitor SEO.
    const env = { BLOG_REVALIDATION_TOKEN: crypto.randomUUID(), MONITOR_SEO_PROJECT_ID: BLOG_CONFIG.monitorSeoProjectId };
    const eventRequest = new Request(`${BLOG_CONFIG.frontendUrl}/api/revalidate-blog`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.BLOG_REVALIDATION_TOKEN}` },
      body: JSON.stringify({ type: 'post.published', postId: sample.id, locale, projectId: env.MONITOR_SEO_PROJECT_ID, siteUrl: BLOG_CONFIG.wordpressUrl }),
    });
    const event = await handleRevalidation(eventRequest, { env, client });
    assert.equal(event.status, 200);
    assert.equal((await event.json()).published, true);
    console.log('OK receptor de eventos con el artículo real (ejecución local, credenciales efímeras).');
  }
  const sitemap = await handleSitemap(request('/sitemap.xml'), { client });
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /<urlset/);
  console.log('OK sitemap dinámico HTTP 200.');

  // An isolated test configuration, never a public route or an active language.
  // This verifies the empty-language requirement against REAL WordPress data.
  const emptyLocale = process.argv.find(arg => arg.startsWith('--empty-locale='))?.split('=')[1] || 'en';
  assert.ok(!Object.hasOwn(BLOG_CONFIG.localeRoutes, emptyLocale), 'El idioma de prueba debe estar inactivo.');
  const testConfig = { ...BLOG_CONFIG, localeRoutes: { ...BLOG_CONFIG.localeRoutes, [emptyLocale]: '/__verification/empty' } };
  const emptyClient = createContentClient({ config: testConfig, fetchImpl });
  const empty = await emptyClient.list({ locale: emptyLocale });
  assert.equal(empty.posts.length, 0, `El idioma ${emptyLocale} ya tiene publicaciones: elige otro con --empty-locale.`);
  const emptyPage = await handleBlogRequest(request('/__verification/empty/'), { config: testConfig, client: emptyClient, loadShell });
  assert.equal(emptyPage.status, 200);
  const emptyHtml = await emptyPage.text();
  assert.match(emptyHtml, /Próximamente, nuevas historias/);
  assert.match(emptyHtml, /name="robots" content="noindex, follow"/);
  assert.equal(emptyPage.headers.get('x-robots-tag'), 'noindex, follow');
  console.log(`OK idioma sin publicaciones (${emptyLocale}): estado vacío + noindex, datos reales${empty.legacy ? ', fallback antiguo activado' : ''}. Configuración aislada; solo es sigue activo.`);
  console.log(`Verificación terminada: ${requests} consultas públicas de solo lectura.`);
} catch (error) {
  console.error(`Verificación fallida: ${error.message}`);
  process.exitCode = 1;
}
