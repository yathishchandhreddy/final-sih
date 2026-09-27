import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import app, { ensureDbInitialized } from './src/server/app.ts';

async function startServer() {
  const PORT = 3000;

  // Initialize SQLite database and seed required system data
  await ensureDbInitialized();

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NAWI-Report server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NAWI-Report server:', err);
  process.exit(1);
});
