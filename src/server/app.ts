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
app.get('/api/health', (req: Request, res: Response) => {
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

export default app;
