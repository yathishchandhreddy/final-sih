import { Router } from 'express';
import { queryOne, queryRows } from '../db/database.ts';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/stats', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    // Total instruments count
    const totalInst = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM instruments');

    // Counts by workflow status
    const statusRows = await queryRows<{ status: string; count: number }>(
      'SELECT status, COUNT(*) as count FROM test_plans GROUP BY status'
    );

    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      CORRECTION_REQUIRED: 0,
      APPROVED: 0,
      FINALIZED: 0,
    };

    statusRows.forEach((r) => {
      if (statusCounts[r.status] !== undefined) {
        statusCounts[r.status] = Number(r.count);
      }
    });

    // Total finalized reports
    const totalReports = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM reports WHERE status = "FINALIZED"');

    // Recent test plans
    const recentTestPlans = await queryRows<any>(
      `SELECT tp.*, i.instrument_code, i.manufacturer, i.model_number, i.accuracy_class, i.max_capacity, i.capacity_unit
       FROM test_plans tp
       JOIN instruments i ON tp.instrument_id = i.id
       ORDER BY tp.updated_at DESC
       LIMIT 6`
    );

    // Recent audit logs
    const recentAudits = await queryRows<any>('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 8');

    res.json({
      total_instruments: Number(totalInst?.count || 0),
      total_finalized_reports: Number(totalReports?.count || 0),
      workflow_counts: statusCounts,
      recent_test_plans: recentTestPlans,
      recent_audit_logs: recentAudits,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
