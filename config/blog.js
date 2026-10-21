// Configuración pública de este proyecto. Los secretos se guardan en Cloudflare.
export const BLOG_CONFIG = Object.freeze({
  wordpressUrl: 'https://api.ordenparaver.net',
  frontendUrl: 'https://ordenparaver.net',
  sourceLocale: 'es',
  localeRoutes: Object.freeze({ es: '/blog' }),
  monitorSeoProjectId: '97bac6fa-f320-4809-b936-ffb11e085b22',
  pageSize: 12,
  requestTimeoutMs: 15_000,
});
