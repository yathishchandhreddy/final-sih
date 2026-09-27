import { Router } from 'express';
import { getAuditLogs } from '../services/audit.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// List audit logs (All authenticated roles can inspect legal metrology audit trail)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { entity_id, action, limit } = req.query;
    const logs = await getAuditLogs({
      entity_id: entity_id ? String(entity_id) : undefined,
      action: action ? String(action) : undefined,
      limit: limit ? Number(limit) : 200,
    });

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
