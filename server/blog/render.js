import { BLOG_CONFIG } from '../../config/blog.js';
import { categoriesOf, keyTakeaways, postPath, postUrl } from './content.js';
import { escapeHtml as e, plainText, safeUrl, sanitizeContent } from './html.js';

function imageOf(post) {
  const image = post._embedded?.['wp:featuredmedia']?.[0];
  return image && safeUrl(image.source_url) ? { src: safeUrl(image.source_url), alt: image.alt_text || '' } : null;
}

function dateLabel(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.valueOf()) ? '' : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed);
}

export function categoryPath(category, locale, config = BLOG_CONFIG) {
  return `${config.localeRoutes[locale]}/categoria/${category.id}/`;
}

function categoryLinks(post, locale, config) {
  return categoriesOf(post).map(term => `<a class="wp-blog-tag" href="${e(categoryPath(term, locale, config))}">${e(plainText(term.name))}</a>`).join('');
}

export function renderHead({ title, description, canonical, image, noindex = false, family, type = 'website' }) {
  return `<title>${e(title)}</title>
    <meta name="description" content="${e(description)}">
    <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
    <link rel="canonical" href="${e(canonical)}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="Ordenparaver">
    <meta property="og:locale" content="es_ES">
    <meta property="og:title" content="${e(title)}">
    <meta property="og:description" content="${e(description)}">
    <meta property="og:url" content="${e(canonical)}">
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
    ${image ? `<meta property="og:image" content="${e(image)}"><meta name="twitter:image" content="${e(image)}">` : ''}
    ${(family?.versions ?? []).map(item => `<link rel="alternate" hreflang="${e(item.locale)}" href="${e(item.url)}">`).join('\n')}
    ${family?.xDefault ? `<link rel="alternate" hreflang="x-default" href="${e(family.xDefault)}">` : ''}`;
}

export function renderIndex({ result, locale, page, category, config = BLOG_CONFIG }) {
  const base = category ? `${config.localeRoutes[locale]}/categoria/${category}/` : `${config.localeRoutes[locale]}/`;
  const terms = new Map(result.posts.flatMap(categoriesOf).map(term => [term.id, term]));
  const categoryName = category ? plainText(terms.get(category)?.name || 'Artículos por categoría') : '';
  const canonical = `${config.frontendUrl}${base}${page > 1 ? `?page=${page}` : ''}`;
  const title = `${categoryName || 'Blog de cine, series y libros'}${page > 1 ? ` · Página ${page}` : ''} | Ordenparaver`;
  const description = category
    ? `Descubre nuestras guías y artículos de ${categoryName.toLowerCase()}.`
    : 'Guías de lectura, historias de cine y series, y nuevas formas de explorar tus universos favoritos.';
  const cards = result.posts.map((post, index) => {
    const image = imageOf(post);
    return `<article class="wp-blog-card ${page === 1 && index === 0 ? 'wp-blog-featured' : ''}">
      <a class="wp-blog-card-image" href="${e(postPath(post, config))}" tabindex="-1" aria-hidden="true">
        ${image ? `<img src="${e(image.src)}" alt="${e(image.alt)}" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">` : '<span class="wp-blog-image-placeholder">Una historia por descubrir</span>'}
      </a>
      <div class="wp-blog-card-body"><div class="wp-blog-tags">${categoryLinks(post, locale, config)}</div>
        <h2><a href="${e(postPath(post, config))}">${e(plainText(post.title?.rendered) || 'Sin título')}</a></h2>
        <p>${e(plainText(post.excerpt?.rendered))}</p>
        <div class="wp-blog-card-footer"><time datetime="${e(post.date)}">${e(dateLabel(post.date))}</time><a href="${e(postPath(post, config))}" aria-label="${e(`Leer ${plainText(post.title?.rendered)}`)}">Leer artículo <span aria-hidden="true">↗</span></a></div>
      </div></article>`;
  }).join('');
  const pageLink = value => `${base}${value > 1 ? `?page=${value}` : ''}`;
  const body = `<section class="wp-blog-intro page-heading"><span class="eyebrow type-label">EL BLOG DE ORDENPARAVER</span>
      <h1 class="page-heading-title">${category ? e(categoryName) : 'Siempre hay otra <span class="heading-accent">historia.</span>'}</h1><p class="page-heading-description">${e(description)}</p></section>
    <nav class="wp-blog-filters" aria-label="Categorías del blog"><a href="${e(config.localeRoutes[locale])}/" ${!category ? 'aria-current="page"' : ''}>Todos los artículos</a>
      ${[...terms.values()].map(term => `<a href="${e(categoryPath(term, locale, config))}" ${category === term.id ? 'aria-current="page"' : ''}>${e(plainText(term.name))}</a>`).join('')}</nav>
    ${result.posts.length ? `<div class="wp-blog-grid">${cards}</div>` : renderState('Próximamente, nuevas historias', 'Estamos preparando artículos en español para acompañar tu próxima lectura o maratón.', `${config.localeRoutes[locale]}/`, 'Ver el blog')}
    ${result.totalPages > 1 ? `<nav class="wp-blog-pagination" aria-label="Paginación del blog">${page > 1 ? `<a rel="prev" href="${e(pageLink(page - 1))}">← Anterior</a>` : '<span></span>'}<span>Página ${page} de ${result.totalPages}</span>${page < result.totalPages ? `<a rel="next" href="${e(pageLink(page + 1))}">Siguiente →</a>` : '<span></span>'}</nav>` : ''}`;
  return { body, head: renderHead({ title, description, canonical, noindex: !result.posts.length }), noindex: !result.posts.length };
}

export function renderArticle({ post, family, locale, config = BLOG_CONFIG }) {
  const title = plainText(post.title?.rendered) || 'Sin título';
  const seo = post.yoast_head_json ?? {};
  const description = plainText(seo.description || post.excerpt?.rendered).slice(0, 320);
  const image = imageOf(post);
  const social = safeUrl(seo.og_image?.[0]?.url) || image?.src;
  const takeaways = keyTakeaways(post);
  const content = sanitizeContent(post.content?.rendered, config);
  const words = plainText(content).split(/\s+/).filter(Boolean).length;
  const body = `<nav class="wp-blog-breadcrumb" aria-label="Ruta de navegación"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="${e(config.localeRoutes[locale])}/">Blog</a></nav>
    <article class="wp-blog-article"><header class="wp-blog-article-heading page-heading"><span class="eyebrow type-label">EL BLOG DE ORDENPARAVER</span>
      <h1 class="page-heading-title">${e(title)}</h1><p class="page-heading-description">${e(plainText(post.excerpt?.rendered))}</p>
      <div class="wp-blog-tags wp-blog-article-categories">${categoryLinks(post, locale, config)}</div>
      <p class="wp-blog-date"><time datetime="${e(post.date)}">${e(dateLabel(post.date))}</time><span aria-hidden="true"> · </span>${Math.max(1, Math.ceil(words / 220))} min de lectura</p>
      ${family.versions.length > 1 ? `<nav aria-label="Idiomas del artículo" class="wp-blog-languages">${family.versions.map(item => `<a href="${e(item.url)}" hreflang="${e(item.locale)}" lang="${e(item.locale)}" ${item.locale === locale ? 'aria-current="page"' : ''}>${e(item.locale.toUpperCase())}</a>`).join('')}</nav>` : ''}
    </header>
    ${image ? `<figure class="wp-blog-cover"><img src="${e(image.src)}" alt="${e(image.alt)}" fetchpriority="high" decoding="async"></figure>` : ''}
    <div class="wp-blog-reading">
      ${takeaways.length ? `<aside class="wp-blog-takeaways section-heading" aria-labelledby="takeaways-title"><span class="eyebrow type-label">ANTES DE EMPEZAR</span><h2 id="takeaways-title" class="section-heading-title">Las claves de esta historia</h2>${takeaways.map(item => `<details><summary>${e(item.question)}</summary><p>${e(item.answer)}</p></details>`).join('')}</aside>` : ''}
      <div class="wp-blog-content">${content}</div>
      <a class="wp-blog-back" href="${e(config.localeRoutes[locale])}/">← Volver a todas las historias</a>
    </div></article>`;
  return { body, head: renderHead({ title: plainText(seo.title) || `${title} | Ordenparaver`, description, canonical: postUrl(post, config), image: social, family, type: 'article' }), noindex: false };
}

export function renderState(title, message, href = '/blog/', label = 'Volver al blog') {
  return `<section class="wp-blog-state" role="status"><span class="wp-blog-state-mark" aria-hidden="true">✦</span><h2>${e(title)}</h2><p>${e(message)}</p><a class="wp-blog-button" href="${e(href)}">${e(label)}</a></section>`;
}
