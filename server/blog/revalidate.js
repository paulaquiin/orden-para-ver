import { BLOG_CONFIG } from '../../config/blog.js';
import { createContentClient, postLanguage, postPath } from './content.js';
import { NO_CACHE_HEADERS } from './handler.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...NO_CACHE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });
}

async function sameToken(received, expected) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([received, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function readPayload(request) {
  if (!request.body) throw new Error('empty');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      throw new Error('large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function matchesSite(value, config) {
  try {
    const url = new URL(value);
    return [config.wordpressUrl, config.frontendUrl].includes(url.origin)
      && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}

export async function handleRevalidation(request, { env = {}, config = BLOG_CONFIG, client = createContentClient({ config }) } = {}) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...NO_CACHE_HEADERS, Allow: 'POST' } });
  const projectId = config.monitorSeoProjectId || env.MONITOR_SEO_PROJECT_ID;
  if (!env.BLOG_REVALIDATION_TOKEN || !projectId) {
    return json({ error: 'La revalidación no está configurada en el servidor.' }, 503);
  }
  if (env.MONITOR_SEO_PROJECT_ID && String(env.MONITOR_SEO_PROJECT_ID) !== String(projectId)) {
    return json({ error: 'La configuración del proyecto no coincide.' }, 503);
  }
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!match || !await sameToken(match[1], String(env.BLOG_REVALIDATION_TOKEN))) return json({ error: 'No autorizado.' }, 401);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Se requiere JSON.' }, 415);
  let payload;
  try { payload = await readPayload(request); } catch (error) {
    return json({ error: 'Cuerpo JSON inválido o demasiado grande.' }, error.message === 'large' ? 413 : 400);
  }
  if (!payload || !['post.published', 'post.scheduled'].includes(payload.type)
    || !Number.isSafeInteger(payload.postId) || payload.postId < 1
    || !Object.hasOwn(config.localeRoutes, payload.locale)
    || !['string', 'number'].includes(typeof payload.projectId)
    || String(payload.projectId) !== String(projectId)
    || !matchesSite(payload.siteUrl, config)) {
    return json({ error: 'Evento, proyecto, sitio o idioma inválidos.' }, 400);
  }
  try {
    // Only query published posts, even when Monitor SEO notifies a scheduled one.
    const post = await client.byId(payload.postId, payload.locale);
    if (post && postLanguage(post, config.sourceLocale) !== payload.locale) return json({ error: 'El idioma no coincide con el artículo.' }, 400);
    const prefix = config.localeRoutes[payload.locale];
    const paths = new Set([`${prefix}/`, `${prefix}/*`, `${prefix}/categoria/*`, '/sitemap.xml']);
    if (post) {
      paths.add(postPath(post, config));
      const family = await client.family(post);
      for (const version of family.versions) paths.add(new URL(version.url).pathname);
    }
    // There is no stored HTML/content cache to purge. Every path above, including
    // category, sitemap and hreflang, is derived from fresh WordPress queries.
    return json({ ok: true, strategy: 'ssr-no-store', published: Boolean(post), paths: [...paths] });
  } catch {
    return json({ error: 'No se ha podido comprobar WordPress. Reintenta el evento.' }, 502);
  }
}
