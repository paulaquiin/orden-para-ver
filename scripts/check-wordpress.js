import { BLOG_CONFIG } from '../config/blog.js';

const listFields = [
  'id', 'slug', 'date', 'modified', 'title', 'excerpt', 'meta',
  'yoast_head_json', '_embedded', '_links',
];
const pending = [];

function postsUrl({ slug, localized = true } = {}) {
  const url = new URL('/wp-json/wp/v2/posts', BLOG_CONFIG.wordpressUrl);
  url.searchParams.set('status', 'publish');
  if (localized) url.searchParams.set('seo_locale', BLOG_CONFIG.sourceLocale);
  url.searchParams.set('per_page', slug ? '1' : String(BLOG_CONFIG.pageSize));
  url.searchParams.set('page', '1');
  url.searchParams.set('_embed', 'wp:featuredmedia,wp:term');
  url.searchParams.set('_fields', slug ? [...listFields, 'content', 'status'].join(',') : listFields.join(','));
  if (slug) url.searchParams.set('slug', slug);
  return url;
}

async function request(url, method = 'GET') {
  const response = await fetch(url, {
    method,
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(BLOG_CONFIG.requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`WordPress devolvió HTTP ${response.status} (${method}).`);
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('La respuesta no es JSON; comprueba WordPress y las reglas de acceso.');
  }
  return { response, data: await response.json() };
}

function language(post) {
  return post.meta?.seo_control_language || post.meta?.replyswipe_language || BLOG_CONFIG.sourceLocale;
}

function list(data) {
  if (!Array.isArray(data)) throw new Error('El endpoint de artículos no devolvió una lista.');
  return data;
}

async function main() {
  console.log(`Backend: ${BLOG_CONFIG.wordpressUrl}`);
  console.log(`Frontend: ${BLOG_CONFIG.frontendUrl}${BLOG_CONFIG.localeRoutes.es}/ (solo español)`);
  console.log('Comprobación pública de solo lectura; no utiliza credenciales.');

  const { data: index } = await request(new URL('/wp-json/', BLOG_CONFIG.wordpressUrl));
  if (!index.namespaces?.includes('wp/v2') || !index.routes?.['/wp/v2/posts']) {
    throw new Error('No se encuentra la API REST de artículos de WordPress.');
  }
  if (new URL(index.url).origin !== BLOG_CONFIG.wordpressUrl) {
    throw new Error('La API declara una instalación de WordPress de otro dominio.');
  }
  console.log(`OK HTTPS y API REST: ${index.name}`);

  const { data: schema } = await request(new URL('/wp-json/wp/v2/posts', BLOG_CONFIG.wordpressUrl), 'OPTIONS');
  const readEndpoint = schema.endpoints?.find(endpoint => endpoint.methods?.includes('GET'));
  const declaredFilter = Boolean(readEndpoint?.args?.seo_locale);
  const metaFields = Object.keys(schema.schema?.properties?.meta?.properties ?? {});
  console.log(`Filtro seo_locale anunciado: ${declaredFilter ? 'sí' : 'no'}`);
  console.log(`Campos meta públicos: ${metaFields.join(', ') || '(ninguno anunciado)'}`);
  if (!declaredFilter) console.log('AVISO: seo_locale no aparece en el esquema; esto no demuestra que se ignore. El cliente comprueba los idiomas devueltos y activa el fallback solo si encuentra otro idioma.');
  for (const field of ['language', 'key_takeaways']) {
    if (!metaFields.includes(`seo_control_${field}`) && !metaFields.includes(`replyswipe_${field}`)) {
      pending.push(`El esquema público no anuncia el campo de Monitor SEO para ${field}.`);
    }
  }
  console.log(`Yoast anunciado (opcional): ${schema.schema?.properties?.yoast_head_json ? 'sí' : 'no'}`);

  const localized = await request(postsUrl());
  const posts = list(localized.data);
  console.log(`OK listado ligero es: HTTP ${localized.response.status}, total declarado ${localized.response.headers.get('x-wp-total') ?? 'desconocido'}, páginas ${localized.response.headers.get('x-wp-totalpages') ?? 'desconocidas'}`);
  if (posts.some(post => Object.hasOwn(post, 'content'))) {
    throw new Error('El listado incluye content pese a la selección ligera de campos.');
  }
  if (posts.some(post => language(post) !== BLOG_CONFIG.sourceLocale)) {
    pending.push('seo_locale devuelve otros idiomas: será necesario el fallback de paginación global de la fase 2.');
  }

  if (posts.length === 0) {
    const global = await request(postsUrl({ localized: false }));
    const globalPosts = list(global.data);
    console.log(`Publicaciones globales: ${global.response.headers.get('x-wp-total') ?? 'total desconocido'}`);
    pending.push(globalPosts.length === 0
      ? 'No hay artículos publicados. Falta validar un artículo real de Monitor SEO en español con imagen, categoría y puntos clave.'
      : 'No hay resultados para español. Falta un artículo real en ese idioma y validar el filtro.');
  } else {
    const sample = posts.find(post => language(post) === BLOG_CONFIG.sourceLocale);
    if (sample) {
      const { data } = await request(postsUrl({ slug: sample.slug }));
      const detail = list(data).find(post => post.id === sample.id && language(post) === BLOG_CONFIG.sourceLocale);
      if (!detail || detail.status !== 'publish' || typeof detail.content?.rendered !== 'string') {
        throw new Error('El detalle por slug no devuelve el mismo artículo publicado en español con content.rendered.');
      }
      console.log(`OK detalle por slug: id=${detail.id}, slug=${detail.slug}`);
      console.log(`URL prevista: ${BLOG_CONFIG.frontendUrl}${BLOG_CONFIG.localeRoutes.es}/${encodeURIComponent(detail.slug)}/`);
      if (!detail.content.rendered.trim()) pending.push('El artículo de muestra no tiene contenido.');
      const explicitLocale = detail.meta?.seo_control_language || detail.meta?.replyswipe_language;
      if (!explicitLocale) pending.push('La muestra usa el fallback a español; falta verificar el idioma explícito de Monitor SEO.');
      const image = detail._embedded?.['wp:featuredmedia']?.[0];
      console.log(`Imagen destacada: ${image?.source_url ? 'sí' : 'no'}; alt: ${image?.alt_text ? 'sí' : 'no'}`);
      const categories = (detail._embedded?.['wp:term'] ?? []).flat().filter(term => term.taxonomy === 'category');
      console.log(`Categorías incrustadas: ${categories.length}`);
      if (!image?.source_url || !categories.length) pending.push('Falta una muestra con imagen destacada y categoría incrustadas.');
      const takeaways = detail.meta?.seo_control_key_takeaways || detail.meta?.replyswipe_key_takeaways;
      let parsed;
      try { parsed = JSON.parse(takeaways); } catch { /* Se registra como pendiente sin imprimir contenido. */ }
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(item => item && typeof item.question === 'string' && typeof item.answer === 'string')) {
        pending.push('Falta una muestra de puntos clave con JSON válido [{ question, answer }].');
      }
    }
  }

  if (pending.length) {
    console.log('\nCONEXIÓN OK. Contrato de Monitor SEO pendiente:');
    for (const item of pending) console.log(`- ${item}`);
    process.exitCode = 2;
  } else {
    console.log('\nCONEXIÓN Y MUESTRA OK. Revisión limitada al esquema y primera página de español.');
  }
}

main().catch(error => {
  console.error(`ERROR: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`);
  process.exitCode = 1;
});
