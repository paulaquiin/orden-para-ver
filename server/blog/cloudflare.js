import { handleBlogRequest } from './handler.js';

export function serveCloudflareBlog(context) {
  return handleBlogRequest(context.request, {
    loadShell: async () => {
      const response = await context.env.ASSETS.fetch(new URL('/blog-shell', context.request.url));
      if (!response.ok) throw new Error('Blog shell unavailable');
      return response.text();
    },
  });
}
