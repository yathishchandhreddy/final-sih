import express, { Request, Response, NextFunction } from 'express';
import { getDb } from './db/database.ts';
import { seedInitialData } from './db/seed.ts';

import authRoutes from './routes/auth.routes.ts';
import instrumentsRoutes from './routes/instruments.routes.ts';
import rulesRoutes from './routes/rules.routes.ts';
import testPlansRoutes from './routes/testPlans.routes.ts';
import reportsRoutes from './routes/reports.routes.ts';
import auditRoutes from './routes/audit.routes.ts';
import dashboardRoutes from './routes/dashboard.routes.ts';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set camera permissions policy for the application's own origin
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', 'camera=(self)');
  next();
});

// Lazy DB initialization guarantee for serverless / edge invocations
let dbInitPromise: Promise<void> | null = null;
export async function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        await getDb();
        await seedInitialData();
      } catch (err) {
        console.warn('[Server] DB init notice:', err);
      }
    })();
  }
  return dbInitPromise;
}

// Ensure DB is ready before handling any API request
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    await ensureDbInitialized();
  }
  next();
});

// Health check
app.get(['/api/health', '/health'], (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'NAWI-Report Metrology Type Evaluation Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes (supports both /api/* and direct /* prefixes for Vercel serverless rewrites)
const routeModules = [
  { path: 'auth', handler: authRoutes },
  { path: 'instruments', handler: instrumentsRoutes },
  { path: 'rules', handler: rulesRoutes },
  { path: 'test-plans', handler: testPlansRoutes },
  { path: 'reports', handler: reportsRoutes },
  { path: 'audit', handler: auditRoutes },
  { path: 'audit-logs', handler: auditRoutes },
  { path: 'dashboard', handler: dashboardRoutes },
];

for (const { path: p, handler } of routeModules) {
  app.use(`/api/${p}`, handler);
  app.use(`/${p}`, handler);
}

// Global error handler guaranteeing JSON responses
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Server Error]:', err);
  res.status(500).json({
    error: err?.message || 'Metrology service encountered an internal error.',
  });
});

export default app;
