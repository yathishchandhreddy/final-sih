import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryRows, execute } from '../db/database.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { RuleEngine } from '../services/ruleEngine.ts';
import { CalculationEngine, ObservationInput } from '../services/calculationEngine.ts';
import { WorkflowEngine } from '../services/workflowEngine.ts';
import { logAudit } from '../services/audit.ts';
import { WorkflowStatus } from '../types/index.ts';

const router = Router();

// List test plans
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, search, assigned_sub_inspector_id, assigned_inspector_id, assigned_engineer_id, created_by } = req.query;

    let sql = `
      SELECT tp.*, i.instrument_code, i.applicant_name, i.manufacturer, i.model_number,
             i.accuracy_class, i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit,
             u.full_name as evaluator_name, r.title as rule_title
      FROM test_plans tp
      JOIN instruments i ON tp.instrument_id = i.id
      LEFT JOIN users u ON tp.generated_by = u.id
      LEFT JOIN rule_versions r ON tp.rule_version_id = r.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push('tp.status = ?');
      params.push(status);
    }

    if (assigned_sub_inspector_id) {
      conditions.push('tp.assigned_sub_inspector_id = ?');
      params.push(assigned_sub_inspector_id);
    }

    if (assigned_inspector_id) {
      conditions.push('tp.assigned_inspector_id = ?');
      params.push(assigned_inspector_id);
    }

    if (assigned_engineer_id) {
      conditions.push('tp.assigned_engineer_id = ?');
      params.push(assigned_engineer_id);
    }

    if (created_by) {
      conditions.push('(i.created_by = ? OR tp.generated_by = ?)');
      params.push(created_by, created_by);
    }

    if (search) {
      conditions.push('(tp.test_plan_code LIKE ? OR i.instrument_code LIKE ? OR i.manufacturer LIKE ? OR i.model_number LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY tp.generated_at DESC';

    const testPlans = await queryRows<any>(sql, params);
    res.json(testPlans);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single test plan with full instances, observations, calculations, workflow history
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const testPlan = await queryOne<any>(
      `SELECT tp.*, i.instrument_code, i.applicant_name, i.manufacturer, i.model_number, i.instrument_type,
              i.accuracy_class, i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit,
              i.serial_number, i.indicator_details, i.load_cell_details, i.application_number,
              u.full_name as evaluator_name, r.title as rule_title, r.version as rule_version_code, r.requirement_text
       FROM test_plans tp
       JOIN instruments i ON tp.instrument_id = i.id
       LEFT JOIN users u ON tp.generated_by = u.id
       LEFT JOIN rule_versions r ON tp.rule_version_id = r.id
       WHERE (tp.id = ? OR tp.test_plan_code = ?)`,
      [req.params.id, req.params.id]
    );

    if (!testPlan) {
      return res.status(404).json({ error: 'Test plan not found.' });
    }

    // Test instances
    const instances = await queryRows<any>(
      `SELECT ti.*, td.category, td.standard_ref, td.oiml_clause, td.description as definition_desc, td.supported_in_mvp
       FROM test_instances ti
       JOIN test_definitions td ON ti.test_definition_id = td.id
       WHERE ti.test_plan_id = ?
       ORDER BY ti.execution_order ASC`,
      [testPlan.id]
    );

    // Populate observations and calculations for each instance
    for (const inst of instances) {
      const observations = await queryRows<any>(
        'SELECT * FROM observations WHERE test_instance_id = ? ORDER BY run_number ASC, load_point ASC, timestamp ASC',
        [inst.id]
      );
      const calculation = await queryOne<any>(
        'SELECT * FROM calculations WHERE test_instance_id = ? ORDER BY calculated_at DESC LIMIT 1',
        [inst.id]
      );

      inst.observations = observations;
      if (calculation) {
        inst.calculation = {
          ...calculation,
          input_values: typeof calculation.input_values_json === 'string' ? JSON.parse(calculation.input_values_json) : calculation.input_values_json,
          calculation_steps: typeof calculation.calculation_steps_json === 'string' ? JSON.parse(calculation.calculation_steps_json) : calculation.calculation_steps_json,
        };
      } else {
        inst.calculation = null;
      }
    }

    // Workflow state history
    const workflowHistory = await queryRows<any>(
      `SELECT ws.*, u.full_name as changed_by_name 
       FROM workflow_states ws
       LEFT JOIN users u ON ws.changed_by = u.id
       WHERE ws.test_plan_id = ?
       ORDER BY ws.changed_at ASC`,
      [testPlan.id]
    );

    res.json({
      ...testPlan,
      test_instances: instances,
      workflow_history: workflowHistory,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate applicable test plan for an instrument
router.post(
  '/generate',
  authenticate,
  requireRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const { instrument_id } = req.body;
    if (!instrument_id) {
      return res.status(400).json({ error: 'instrument_id is required.' });
    }

    const instrument = await queryOne<any>('SELECT * FROM instruments WHERE id = ?', [instrument_id]);
    if (!instrument) {
      return res.status(404).json({ error: 'Instrument not found.' });
    }

    // Check if test plan already exists
    const existing = await queryOne<any>('SELECT id FROM test_plans WHERE instrument_id = ?', [instrument_id]);
    if (existing) {
      return res.json({
        message: 'Test plan already generated for this instrument.',
        test_plan_id: existing.id,
      });
    }

    // Evaluate applicable rule using RuleEngine
    const applicable = await RuleEngine.evaluateApplicableTestPlan({
      accuracy_class: instrument.accuracy_class,
      max_capacity: instrument.max_capacity,
      capacity_unit: instrument.capacity_unit,
      verification_scale_interval_e: instrument.verification_scale_interval_e,
      scale_interval_unit: instrument.scale_interval_unit,
      instrument_type: instrument.instrument_type,
    });

    const testPlanId = uuidv4();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const testPlanCode = `TP-${new Date().getFullYear()}-${randNum}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO test_plans (id, test_plan_code, instrument_id, rule_version_id, rule_version_code, status, overall_decision, generated_by, generated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'DRAFT', 'PENDING', ?, ?, ?)`,
      [
        testPlanId,
        testPlanCode,
        instrument.id,
        applicable.rule_version.id,
        applicable.rule_version.version,
        req.user!.id,
        now,
        now,
      ]
    );

    // Insert test instances based on applicable test definitions
    let order = 1;
    for (const testDef of applicable.applicable_tests) {
      const instanceId = uuidv4();
      await execute(
        `INSERT INTO test_instances (id, test_plan_id, test_definition_id, test_code, test_name, status, supported, execution_order, decision, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, 'PENDING', ?)`,
        [instanceId, testPlanId, testDef.id, testDef.test_code, testDef.name, testDef.supported_in_mvp ? 1 : 0, order++, now]
      );
    }

    // Initial workflow state entry
    const wsId = uuidv4();
    await execute(
      `INSERT INTO workflow_states (id, test_plan_id, from_state, to_state, changed_by, user_role, reason, is_override, changed_at)
       VALUES (?, ?, 'NONE', 'DRAFT', ?, ?, 'Test plan generated based on versioned OIML R 76 rules.', 0, ?)`,
      [wsId, testPlanId, req.user!.id, req.user!.role, now]
    );

    await logAudit({
      user: req.user,
      action: 'TEST_PLAN_GENERATED',
      entity_type: 'test_plan',
      entity_id: testPlanId,
      after_value: {
        test_plan_code: testPlanCode,
        instrument_id: instrument.id,
        rule_version: applicable.rule_version.version,
        tests_count: applicable.applicable_tests.length,
      },
      reason: 'Evaluator generated an applicable test plan via versioned RuleEngine.',
    });

    res.status(201).json({
      message: 'Applicable test plan generated successfully.',
      test_plan_id: testPlanId,
      test_plan_code: testPlanCode,
      applicable_rule: applicable.rule_version,
      applicable_tests_count: applicable.applicable_tests.length,
    });
  } catch (err: any) {
    console.error('Error generating test plan:', err);
    res.status(500).json({ error: err.message });
  }
});

// Record observations for a test instance
router.post(
  '/:id/observations',
  authenticate,
  requireRole('SUB_INSPECTOR', 'INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const { test_instance_id, observations } = req.body;

    if (!test_instance_id || !Array.isArray(observations)) {
      return res.status(400).json({ error: 'test_instance_id and observations array are required.' });
    }

    const testPlan = await queryOne<any>('SELECT * FROM test_plans WHERE id = ?', [req.params.id]);
    if (!testPlan) return res.status(404).json({ error: 'Test plan not found.' });

    if (testPlan.status === 'FINALIZED') {
      return res.status(403).json({ error: 'Observations cannot be modified on a FINALIZED test plan (Immutable record).' });
    }

    if (testPlan.status !== 'DRAFT' && testPlan.status !== 'CORRECTION_REQUIRED' && !req.user!.roles.includes('ADMIN')) {
      return res.status(403).json({ error: `Cannot edit observations in status: ${testPlan.status}. Must be DRAFT or CORRECTION_REQUIRED.` });
    }

    const testInstance = await queryOne<any>('SELECT * FROM test_instances WHERE id = ? AND test_plan_id = ?', [test_instance_id, testPlan.id]);
    if (!testInstance) return res.status(404).json({ error: 'Test instance not found.' });

    // Clear old observations for this test instance to avoid duplicates
    await execute('DELETE FROM observations WHERE test_instance_id = ?', [test_instance_id]);

    const now = new Date().toISOString();
    for (const obs of observations) {
      const obsId = uuidv4();
      await execute(
        `INSERT INTO observations (id, test_instance_id, load_point, reference_mass, mass_unit, indication_increasing, indication_decreasing, delta_l, position_corner, run_number, tare_applied, temp_celsius, recorded_by, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          obsId,
          test_instance_id,
          Number(obs.load_point ?? obs.reference_mass),
          Number(obs.reference_mass),
          obs.mass_unit || 'kg',
          obs.indication_increasing !== undefined ? Number(obs.indication_increasing) : null,
          obs.indication_decreasing !== undefined ? Number(obs.indication_decreasing) : null,
          obs.delta_l !== undefined ? Number(obs.delta_l) : 0,
          obs.position_corner || null,
          obs.run_number ? Number(obs.run_number) : 1,
          obs.tare_applied ? Number(obs.tare_applied) : 0,
          obs.temp_celsius ? Number(obs.temp_celsius) : null,
          req.user!.id,
          now,
        ]
      );
    }

    await logAudit({
      user: req.user,
      action: 'OBSERVATION_ADDED',
      entity_type: 'test_instance',
      entity_id: test_instance_id,
      after_value: { observations_count: observations.length },
      reason: 'Evaluator saved raw metrological observations.',
    });

    res.json({
      message: 'Observations saved successfully.',
      count: observations.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Execute backend calculations and explainable evaluation
router.post(
  '/:id/calculate',
  authenticate,
  requireRole('SUB_INSPECTOR', 'INSPECTOR', 'ENGINEER', 'EVALUATOR', 'REVIEWER', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const { test_instance_id } = req.body;
    if (!test_instance_id) {
      return res.status(400).json({ error: 'test_instance_id is required.' });
    }

    const testPlan = await queryOne<any>(
      `SELECT tp.*, i.accuracy_class, i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit,
              r.version as rule_version_code
       FROM test_plans tp
       JOIN instruments i ON tp.instrument_id = i.id
       LEFT JOIN rule_versions r ON tp.rule_version_id = r.id
       WHERE tp.id = ?`,
      [req.params.id]
    );

    if (!testPlan) return res.status(404).json({ error: 'Test plan not found.' });

    if (testPlan.status === 'FINALIZED') {
      return res.status(403).json({ error: 'Calculations are locked and immutable on a FINALIZED test plan.' });
    }

    const testInstance = await queryOne<any>('SELECT * FROM test_instances WHERE id = ? AND test_plan_id = ?', [test_instance_id, testPlan.id]);
    if (!testInstance) return res.status(404).json({ error: 'Test instance not found.' });

    // Fetch observations from DB
    const observations = await queryRows<ObservationInput>(
      'SELECT * FROM observations WHERE test_instance_id = ? ORDER BY run_number ASC, load_point ASC',
      [test_instance_id]
    );

    if (observations.length === 0) {
      return res.status(400).json({ error: 'No observations found. Please enter observation values before calculating.' });
    }

    // Execute backend calculation
    const calcResult = CalculationEngine.calculate(
      testInstance.test_code,
      observations,
      {
        accuracy_class: testPlan.accuracy_class,
        max_capacity: testPlan.max_capacity,
        capacity_unit: testPlan.capacity_unit,
        verification_scale_interval_e: testPlan.verification_scale_interval_e,
        scale_interval_unit: testPlan.scale_interval_unit,
      },
      testPlan.rule_version_code || 'v1.0.0'
    );

    calcResult.test_instance_id = test_instance_id;

    // Persist calculation in DB
    const calcId = uuidv4();
    const now = new Date().toISOString();

    // Remove any previous calculation record for this instance
    await execute('DELETE FROM calculations WHERE test_instance_id = ?', [test_instance_id]);

    await execute(
      `INSERT INTO calculations (id, test_instance_id, input_values_json, formula_ref, calculation_version, rule_version, result_value, applicable_mpe, comparison_text, decision, calculation_steps_json, calculated_by, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        calcId,
        test_instance_id,
        JSON.stringify(calcResult.input_values),
        testInstance.test_code,
        calcResult.calculation_version,
        calcResult.rule_version,
        calcResult.result_value,
        calcResult.applicable_limit,
        calcResult.comparison,
        calcResult.decision,
        JSON.stringify(calcResult.calculation_steps),
        req.user!.id,
        now,
      ]
    );

    // Update test instance decision and status
    await execute('UPDATE test_instances SET status = ?, decision = ? WHERE id = ?', [
      calcResult.decision === 'PASS' ? 'COMPLETED' : 'FAILED',
      calcResult.decision,
      test_instance_id,
    ]);

    // Check all test instances to update overall test plan decision
    const allInstances = await queryRows<any>('SELECT decision, supported FROM test_instances WHERE test_plan_id = ?', [testPlan.id]);
    const verified = allInstances.filter((i) => i.supported === 1);
    const anyFail = verified.some((i) => i.decision === 'FAIL');
    const allPass = verified.length > 0 && verified.every((i) => i.decision === 'PASS');

    const overallDecision = anyFail ? 'FAIL' : allPass ? 'PASS' : 'PENDING';
    await execute('UPDATE test_plans SET overall_decision = ?, updated_at = ? WHERE id = ?', [overallDecision, now, testPlan.id]);

    await logAudit({
      user: req.user,
      action: 'CALCULATION_EXECUTED',
      entity_type: 'test_instance',
      entity_id: test_instance_id,
      after_value: {
        test_code: testInstance.test_code,
        result_value: calcResult.result_value,
        applicable_limit: calcResult.applicable_limit,
        decision: calcResult.decision,
      },
      reason: 'Backend calculation engine executed OIML R 76 formula and generated explainable proof.',
    });

    res.json(calcResult);
  } catch (err: any) {
    console.error('Calculation error:', err);
    res.status(500).json({ error: err.message });
  }
});

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Schedule Inspection & Assign Personnel
router.post('/:id/schedule', authenticate, requireRole('INSPECTOR', 'EVALUATOR', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { scheduled_date, site_address, target_latitude, target_longitude, geofence_radius_m = 500, assigned_sub_inspector_id, assigned_engineer_id } = req.body;
    const testPlanId = req.params.id;

    const testPlan = await queryOne('SELECT * FROM test_plans WHERE id = ?', [testPlanId]);
    if (!testPlan) return res.status(404).json({ error: 'Test plan not found.' });

    const now = new Date().toISOString();
    await execute(
      `UPDATE test_plans SET 
        scheduled_date = ?,
        site_address = ?,
        target_latitude = ?,
        target_longitude = ?,
        geofence_radius_m = ?,
        assigned_sub_inspector_id = ?,
        assigned_engineer_id = ?,
        assigned_inspector_id = ?,
        status = 'INSPECTION_SCHEDULED',
        updated_at = ?
       WHERE id = ?`,
      [
        scheduled_date || now.split('T')[0],
        site_address || 'Regional Verification Site',
        target_latitude || 28.6139,
        target_longitude || 77.209,
        Number(geofence_radius_m),
        assigned_sub_inspector_id || req.user!.id,
        assigned_engineer_id || null,
        req.user!.id,
        now,
        testPlanId,
      ]
    );

    await logAudit({
      user: req.user,
      action: 'INSPECTION_SCHEDULED',
      entity_type: 'test_plan',
      entity_id: testPlanId,
      after_value: { scheduled_date, site_address, target_latitude, target_longitude },
      reason: 'Lead Inspector scheduled field inspection and assigned personnel.',
    });

    res.json({ message: 'Inspection successfully scheduled and personnel assigned.', status: 'INSPECTION_SCHEDULED' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GPS Site Verification
router.post('/:id/verify-site', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required.' });
    }

    const testPlan = await queryOne<any>('SELECT * FROM test_plans WHERE id = ?', [req.params.id]);
    if (!testPlan) return res.status(404).json({ error: 'Test plan not found.' });

    const targetLat = testPlan.target_latitude ?? 28.6139;
    const targetLng = testPlan.target_longitude ?? 77.2090;
    const allowedRadius = testPlan.geofence_radius_m ?? 500;

    const distanceMeters = calculateHaversineDistance(Number(latitude), Number(longitude), targetLat, targetLng);
    const isWithinFence = distanceMeters <= allowedRadius;
    const gpsStatus = isWithinFence ? 'IN_GEOFENCE' : 'OUT_OF_RANGE';
    const now = new Date().toISOString();

    await execute(
      `UPDATE test_plans SET 
        verified_latitude = ?,
        verified_longitude = ?,
        verified_distance_m = ?,
        gps_verified_at = ?,
        gps_status = ?,
        status = 'SITE_VERIFIED',
        updated_at = ?
       WHERE id = ?`,
      [Number(latitude), Number(longitude), distanceMeters, now, gpsStatus, now, req.params.id]
    );

    await logAudit({
      user: req.user,
      action: 'SITE_GPS_VERIFIED',
      entity_type: 'test_plan',
      entity_id: req.params.id,
      after_value: { latitude, longitude, distance_m: distanceMeters, gpsStatus },
      reason: `GPS location verified on site (${distanceMeters}m from target).`,
    });

    res.json({
      message: isWithinFence ? 'GPS site verification successful! Within geofence range.' : 'GPS location captured (Outside standard geofence).',
      verified_latitude: Number(latitude),
      verified_longitude: Number(longitude),
      verified_distance_m: distanceMeters,
      gps_status: gpsStatus,
      geofence_radius_m: allowedRadius,
      is_within_geofence: isWithinFence,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Identity Photo Selfie Verification
router.post('/:id/verify-photo', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { photo_url } = req.body;
    if (!photo_url) return res.status(400).json({ error: 'photo_url or selfie data URL is required.' });

    const now = new Date().toISOString();
    await execute(
      `UPDATE test_plans SET photo_verification_url = ?, photo_verified_at = ?, updated_at = ? WHERE id = ?`,
      [photo_url, now, now, req.params.id]
    );

    res.json({ message: 'Inspector identity photo verification captured successfully.', photo_verified_at: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Standard Weights Verification (Calibrator / Engineer)
router.post('/:id/verify-standards', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { standard_weights } = req.body;
    if (!Array.isArray(standard_weights) || standard_weights.length === 0) {
      return res.status(400).json({ error: 'standard_weights array is required.' });
    }

    const now = new Date().toISOString();
    await execute(
      `UPDATE test_plans SET standard_weights_json = ?, standards_verified_by = ?, standards_verified_at = ?, status = 'STANDARDS_VERIFIED', updated_at = ? WHERE id = ?`,
      [JSON.stringify(standard_weights), req.user!.id, now, now, req.params.id]
    );

    await logAudit({
      user: req.user,
      action: 'STANDARDS_VERIFIED',
      entity_type: 'test_plan',
      entity_id: req.params.id,
      after_value: { standard_weights_count: standard_weights.length },
      reason: 'Calibrator/Engineer verified standard weight sets and calibration certificate validity.',
    });

    res.json({ message: 'Standard weights and calibration uncertainty verified successfully.', count: standard_weights.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Lead Inspector Review & Recommendation
router.post('/:id/inspector-review', authenticate, requireRole('INSPECTOR', 'REVIEWER', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { recommendation, notes } = req.body;
    if (!recommendation) {
      return res.status(400).json({ error: 'recommendation is required (RECOMMEND_APPROVAL | RECOMMEND_REJECT | CORRECTION_REQUIRED).' });
    }

    const now = new Date().toISOString();
    const newStatus = recommendation === 'RECOMMEND_APPROVAL' ? 'INSPECTOR_RECOMMENDED' : recommendation === 'CORRECTION_REQUIRED' ? 'CORRECTION_REQUIRED' : 'REJECTED';

    await execute(
      `UPDATE test_plans SET inspector_recommendation = ?, inspector_notes = ?, inspector_reviewed_at = ?, status = ?, updated_at = ? WHERE id = ?`,
      [recommendation, notes || '', now, newStatus, now, req.params.id]
    );

    await logAudit({
      user: req.user,
      action: 'INSPECTOR_REVIEWED',
      entity_type: 'test_plan',
      entity_id: req.params.id,
      after_value: { recommendation, notes, newStatus },
      reason: 'Lead Inspector completed technical review of field inspection data.',
    });

    res.json({ message: `Inspection recommendation submitted: ${recommendation}`, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// State transition
router.post('/:id/transition', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { to_state, reason, is_override } = req.body;
    if (!to_state) {
      return res.status(400).json({ error: 'to_state is required.' });
    }

    const result = await WorkflowEngine.transition(
      req.params.id,
      to_state as WorkflowStatus,
      req.user!,
      reason,
      Boolean(is_override)
    );

    res.json(result);
  } catch (err: any) {
    console.error('Workflow transition error:', err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
