import { Router } from 'express';
import { queryRows } from '../db/database.ts';
import { RuleEngine } from '../services/ruleEngine.ts';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

// Get all versioned rules
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const rules = await queryRows<any>('SELECT * FROM rule_versions ORDER BY accuracy_class ASC, version DESC');
    res.json(
      rules.map((r) => ({
        ...r,
        formula_definition: typeof r.formula_definition === 'string' ? JSON.parse(r.formula_definition) : r.formula_definition,
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get test definitions
router.get('/definitions', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const definitions = await queryRows<any>('SELECT * FROM test_definitions ORDER BY supported_in_mvp DESC, id ASC');
    res.json(definitions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Evaluate applicable rule and test plan
router.get('/applicable', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { accuracy_class, max_capacity, capacity_unit, verification_scale_interval_e, scale_interval_unit, instrument_type } = req.query;

    if (!accuracy_class || !max_capacity || !verification_scale_interval_e) {
      return res.status(400).json({ error: 'Missing required query parameters: accuracy_class, max_capacity, verification_scale_interval_e.' });
    }

    const evaluation = await RuleEngine.evaluateApplicableTestPlan({
      accuracy_class: String(accuracy_class),
      max_capacity: Number(max_capacity),
      capacity_unit: String(capacity_unit || 'kg'),
      verification_scale_interval_e: Number(verification_scale_interval_e),
      scale_interval_unit: String(scale_interval_unit || 'g'),
      instrument_type: instrument_type ? String(instrument_type) : undefined,
    });

    res.json(evaluation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
