import { Router } from 'express';
import { queryOne, queryRows } from '../db/database.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { ReportService } from '../services/reportService.ts';

const router = Router();

// Public QR / Verification check endpoint (NO AUTH REQUIRED)
router.get('/verify/:verificationId', async (req, res) => {
  try {
    const { verificationId } = req.params;
    if (!verificationId) {
      return res.status(400).json({ error: 'verificationId is required.' });
    }

    const verificationResult = await ReportService.verifyReport(verificationId);
    if (!verificationResult) {
      return res.status(404).json({
        valid: false,
        error: 'Report with specified verification ID was not found or has been revoked.',
      });
    }

    const isVerified = verificationResult.valid && verificationResult.integrity_status === 'MATCH';
    res.json({
      valid: verificationResult.valid,
      verified: isVerified,
      sha256_hash: verificationResult.sha256_hash,
      integrity_status: verificationResult.integrity_status,
      report: verificationResult,
      ...verificationResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List reports (Authenticated)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT r.*, i.instrument_code, i.applicant_name, i.manufacturer, i.model_number,
             i.accuracy_class, i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit,
             rh.verification_id, rh.sha256_hash, tp.overall_decision
      FROM reports r
      JOIN instruments i ON r.instrument_id = i.id
      JOIN test_plans tp ON r.test_plan_id = tp.id
      LEFT JOIN report_hashes rh ON rh.report_id = r.id
    `;

    const params: any[] = [];
    if (search) {
      sql += ' WHERE (r.report_number LIKE ? OR i.instrument_code LIKE ? OR i.manufacturer LIKE ? OR i.model_number LIKE ? OR rh.verification_id LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY r.finalized_at DESC';

    const reports = await queryRows<any>(sql, params);
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single report details
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const report = await queryOne<any>(
      `SELECT r.*, i.instrument_code, i.applicant_name, i.manufacturer, i.model_number, i.instrument_type,
              i.accuracy_class, i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit,
              i.serial_number, i.indicator_details, i.load_cell_details, i.application_number,
              rh.verification_id, rh.sha256_hash, rh.generated_at as hash_generated_at,
              tp.overall_decision, tp.status as test_plan_status
       FROM reports r
       JOIN instruments i ON r.instrument_id = i.id
       JOIN test_plans tp ON r.test_plan_id = tp.id
       LEFT JOIN report_hashes rh ON rh.report_id = r.id
       WHERE (r.id = ? OR r.report_number = ?)`,
      [req.params.id, req.params.id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Fetch tests
    const testInstances = await queryRows<any>(
      `SELECT ti.*, td.category, td.standard_ref, td.oiml_clause 
       FROM test_instances ti
       JOIN test_definitions td ON ti.test_definition_id = td.id
       WHERE ti.test_plan_id = ?
       ORDER BY ti.execution_order ASC`,
      [report.test_plan_id]
    );

    for (const inst of testInstances) {
      const calc = await queryOne<any>('SELECT * FROM calculations WHERE test_instance_id = ? ORDER BY calculated_at DESC LIMIT 1', [inst.id]);
      const obs = await queryRows<any>('SELECT * FROM observations WHERE test_instance_id = ? ORDER BY run_number ASC, load_point ASC', [inst.id]);
      inst.calculation = calc ? { ...calc, calculation_steps: JSON.parse(calc.calculation_steps_json || '[]') } : null;
      inst.observations = obs;
    }

    res.json({
      ...report,
      test_instances: testInstances,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Finalize Report (Approving Authority, Inspector, or Admin)
router.post(
  '/finalize',
  authenticate,
  requireRole('APPROVING_AUTHORITY', 'INSPECTOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const { test_plan_id, summary_notes } = req.body;
    if (!test_plan_id) {
      return res.status(400).json({ error: 'test_plan_id is required.' });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const appUrl = `${protocol}://${host}`;

    const result = await ReportService.finalizeReport({
      test_plan_id,
      user: req.user!,
      summary_notes,
      app_url: appUrl,
    });

    res.status(201).json({
      message: 'Report successfully finalized, digitally signed, and cryptographically sealed with SHA-256.',
      ...result,
    });
  } catch (err: any) {
    console.error('Finalization error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Generate and stream real PDF
router.get('/:id/pdf', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const appUrl = `${protocol}://${host}`;

    const pdfBuffer = await ReportService.generateReportPdf(req.params.id, appUrl);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="NAWI-Report-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
