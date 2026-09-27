import app, { ensureDbInitialized } from '../src/server/app.ts';

// Pre-initialize DB on cold start
ensureDbInitialized().catch((err) => {
  console.warn('[Vercel Serverless] DB init warning:', err);
});

export default app;
