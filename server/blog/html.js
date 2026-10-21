import sanitizeHtml from 'sanitize-html';
import { decode } from 'he';
import { BLOG_CONFIG } from '../../config/blog.js';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function plainText(value = '') {
  return decode(sanitizeHtml(String(value), { allowedTags: [], allowedAttributes: {} })).trim();
}

export function safeUrl(value, base = BLOG_CONFIG.frontendUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function sanitizeContent(value = '', config = BLOG_CONFIG) {
  return sanitizeHtml(String(value), {
    allowedTags: ['p', 'br', 'hr', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'blockquote', 'pre', 'code', 'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'div', 'span', 'sup', 'sub', 'details', 'summary'],
    allowedAttributes: {
      a: ['href', 'title', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
      ol: ['start'], th: ['scope', 'colspan', 'rowspan'], td: ['colspan', 'rowspan'],
      h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    nonTextTags: ['script', 'style', 'textarea', 'option', 'iframe', 'form', 'button', 'select', 'noscript'],
    transformTags: {
      h1: 'h2',
      a(tagName, attributes) {
        let href = attributes.href ?? '';
        try {
          const url = new URL(href, config.frontendUrl);
          if (url.origin === config.wordpressUrl && /^\/[^/]+\/?$/.test(url.pathname)
            && !url.pathname.startsWith('/wp-') && !url.search) {
            href = `${config.frontendUrl}${config.localeRoutes[config.sourceLocale]}${url.pathname.replace(/\/$/, '')}/`;
          }
        } catch { /* The sanitizer removes unsafe schemes. */ }
        return { tagName, attribs: { href, title: attributes.title ?? '', rel: 'noopener noreferrer' } };
      },
      img(tagName, attributes) {
        return { tagName, attribs: { ...attributes, loading: 'lazy', decoding: 'async' } };
      },
    },
  });
}
