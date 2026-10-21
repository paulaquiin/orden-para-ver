import { serveCloudflareBlog } from '../../server/blog/cloudflare.js';

export const onRequest = serveCloudflareBlog;
