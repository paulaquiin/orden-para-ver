import { handleRobots } from '../server/blog/handler.js';

export const onRequest = context => handleRobots(context.request);
