import { handleRevalidation } from '../../server/blog/revalidate.js';

export const onRequest = context => handleRevalidation(context.request, { env: context.env });
