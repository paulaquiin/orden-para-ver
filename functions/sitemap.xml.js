import { handleSitemap } from '../server/blog/handler.js';

export const onRequest = context => handleSitemap(context.request);
