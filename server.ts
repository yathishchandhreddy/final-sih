import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './src/server/db/database.ts';
import { seedInitialData } from './src/server/db/seed.ts';

import authRoutes from './src/server/routes/auth.routes.ts';
import instrumentsRoutes from './src/server/routes/instruments.routes.ts';
import rulesRoutes from './src/server/routes/rules.routes.ts';
import testPlansRoutes from './src/server/routes/testPlans.routes.ts';
import reportsRoutes from './src/server/routes/reports.routes.ts';
import auditRoutes from './src/server/routes/audit.routes.ts';
import dashboardRoutes from './src/server/routes/dashboard.routes.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Set camera permissions policy for the application's own origin
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(self)');
    next();
  });

  // Initialize SQLite database and seed required system data
  await getDb();
  await seedInitialData();

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'NAWI-Report Metrology Type Evaluation Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/instruments', instrumentsRoutes);
  app.use('/api/rules', rulesRoutes);
  app.use('/api/test-plans', testPlansRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/dashboard', dashboardRoutes);

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
