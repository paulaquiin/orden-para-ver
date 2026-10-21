import { BLOG_CONFIG } from '../../config/blog.js';

export const LIST_FIELDS = ['id', 'slug', 'date', 'modified', 'title', 'excerpt', 'meta', 'yoast_head_json', '_embedded', '_links'];
export const DETAIL_FIELDS = [...LIST_FIELDS, 'content', 'status'];

export class ContentError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export function postLanguage(post, sourceLocale = BLOG_CONFIG.sourceLocale) {
  const value = post.meta?.seo_control_language || post.meta?.replyswipe_language;
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : sourceLocale;
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export function translationRootId(post) {
  return positiveId(post.meta?.seo_control_translation_source_id)
    || positiveId(post.meta?.replyswipe_translation_source_id) || post.id;
}

export function postPath(post, config = BLOG_CONFIG) {
  const prefix = config.localeRoutes[postLanguage(post, config.sourceLocale)];
  if (!prefix || !post.slug) return null;
  // WordPress can return percent-encoded Unicode slugs. Encode exactly once.
  let slug = post.slug;
  try { slug = decodeURIComponent(slug); } catch { /* Encode literal malformed sequences. */ }
  return `${prefix}/${encodeURIComponent(slug)}/`;
}

export function postUrl(post, config = BLOG_CONFIG) {
  const path = postPath(post, config);
  return path ? new URL(path, config.frontendUrl).href : null;
}

export function keyTakeaways(post) {
  const raw = post.meta?.seo_control_key_takeaways || post.meta?.replyswipe_key_takeaways;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(item => item && typeof item === 'object'
      && typeof item.question === 'string' && typeof item.answer === 'string'
      && item.question.trim() && item.answer.trim()) ? parsed : [];
  } catch { return []; }
}

export function categoriesOf(post) {
  return (post._embedded?.['wp:term'] ?? []).flat().filter(term => term?.taxonomy === 'category');
}

export function createContentClient({ config = BLOG_CONFIG, fetchImpl = fetch } = {}) {
  // Request-scoped only: this never leaves stale state between HTTP requests.
  const legacyLocales = new Set();
  const legacyCollections = new Map();
  const maxPages = 500;

  async function query({ locale, page = 1, pageSize = config.pageSize, slug, include, category, localized = true, detail = false }) {
    const url = new URL('/wp-json/wp/v2/posts', config.wordpressUrl);
    url.searchParams.set('status', 'publish');
    if (localized) url.searchParams.set('seo_locale', locale);
    url.searchParams.set('per_page', String(pageSize));
    url.searchParams.set('page', String(page));
    url.searchParams.set('_embed', 'wp:featuredmedia,wp:term');
    url.searchParams.set('_fields', (detail ? DETAIL_FIELDS : LIST_FIELDS).join(','));
    if (slug) url.searchParams.set('slug', slug);
    if (include) url.searchParams.set('include', String(include));
    if (category) url.searchParams.set('categories', String(category));

    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store', redirect: 'manual',
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      });
    } catch (error) {
      // Only public fetch diagnostics; never log headers, bodies or credentials.
      console.warn('wordpress-fetch-failed', error.name, error.message);
      throw new ContentError('No se puede conectar con WordPress.');
    }
    let data;
    try { data = await response.json(); } catch { throw new ContentError('WordPress no ha devuelto JSON válido.'); }
    if (!response.ok) {
      if (response.status === 400 && data?.code === 'rest_post_invalid_page_number') {
        throw new ContentError('Página no encontrada.', 404);
      }
      throw new ContentError('WordPress no está disponible.', response.status === 429 ? 503 : 502);
    }
    if (!Array.isArray(data)) throw new ContentError('La respuesta de WordPress no es una colección.');
    if (data.some(post => !positiveId(post.id) || typeof post.slug !== 'string')) {
      throw new ContentError('WordPress ha devuelto artículos inválidos.');
    }
    const total = Number(response.headers.get('x-wp-total'));
    const totalPages = Number(response.headers.get('x-wp-totalpages'));
    if (!response.headers.has('x-wp-total') || !response.headers.has('x-wp-totalpages')
      || !Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(totalPages) || totalPages < 0) {
      throw new ContentError('Faltan las cabeceras de paginación de WordPress.');
    }
    return { posts: data, total, totalPages };
  }

  async function legacyList(locale, category) {
    // Only called after observing another language in a seo_locale response.
    const first = await query({ locale, pageSize: 100, localized: false, category });
    if (first.totalPages > maxPages) throw new ContentError('La colección requiere una paginación mayor que el límite de seguridad.');
    const all = [...first.posts];
    for (let page = 2; page <= first.totalPages; page++) {
      const result = await query({ locale, page, pageSize: 100, localized: false, category });
      all.push(...result.posts);
    }
    return all.filter(post => postLanguage(post, config.sourceLocale) === locale);
  }

  async function list({ locale = config.sourceLocale, page = 1, pageSize = config.pageSize, category } = {}) {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ContentError('Paginación inválida.', 404);
    }
    let result;
    if (!legacyLocales.has(locale)) {
      result = await query({ locale, page, pageSize, category });
      if (result.posts.every(post => postLanguage(post, config.sourceLocale) === locale)) {
        if (page > Math.max(1, result.totalPages)) throw new ContentError('Página no encontrada.', 404);
        return { ...result, legacy: false };
      }
      legacyLocales.add(locale);
    }
    const key = `${locale}:${category ?? ''}`;
    if (!legacyCollections.has(key)) legacyCollections.set(key, legacyList(locale, category));
    const filtered = await legacyCollections.get(key);
    const totalPages = Math.ceil(filtered.length / pageSize);
    if (page > Math.max(1, totalPages)) throw new ContentError('Página no encontrada.', 404);
    return { posts: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, totalPages, legacy: true };
  }

  async function allPublished(locale = config.sourceLocale) {
    const first = await list({ locale, pageSize: 100 });
    if (first.totalPages > maxPages) throw new ContentError('El sitemap supera el límite de artículos.');
    const posts = [...first.posts];
    for (let page = 2; page <= first.totalPages; page++) {
      const result = await list({ locale, page, pageSize: 100 });
      posts.push(...result.posts);
    }
    return [...new Map(posts.map(post => [post.id, post])).values()];
  }

  async function bySlug(slug, locale = config.sourceLocale) {
    const result = await query({ locale, slug, pageSize: 100, detail: true });
    const comparable = value => { try { return decodeURIComponent(value); } catch { return value; } };
    return result.posts.find(post => post.status === 'publish'
      && comparable(post.slug) === comparable(slug)
      && postLanguage(post, config.sourceLocale) === locale) ?? null;
  }

  async function byId(id, locale = config.sourceLocale) {
    const result = await query({ locale, include: id, pageSize: 1, detail: true });
    return result.posts.find(post => post.id === id && post.status === 'publish') ?? null;
  }

  async function family(post) {
    const rootId = translationRootId(post);
    const root = rootId === post.id ? post : await byId(rootId);
    const candidates = new Map([[postLanguage(post, config.sourceLocale), post]]);
    if (root && translationRootId(root) === rootId) {
      candidates.set(postLanguage(root, config.sourceLocale), root);
      await Promise.all(Object.keys(config.localeRoutes).map(async locale => {
        if (candidates.has(locale)) return;
        const id = positiveId(root.meta?.[`seo_control_translation_${locale}_id`])
          || positiveId(root.meta?.[`replyswipe_translation_${locale}_id`]);
        if (!id) return;
        const translated = await byId(id, locale);
        if (translated && postLanguage(translated, config.sourceLocale) === locale && translationRootId(translated) === rootId) {
          candidates.set(locale, translated);
        }
      }));
    }
    const versions = [...candidates.entries()].filter(([locale]) => config.localeRoutes[locale])
      .map(([locale, item]) => ({ locale, post: item, url: postUrl(item, config) }));
    return { rootId, versions, xDefault: versions.find(item => item.locale === config.sourceLocale)?.url ?? null };
  }

  return { list, allPublished, bySlug, byId, family };
}
