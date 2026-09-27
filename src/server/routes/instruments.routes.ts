import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryRows, execute } from '../db/database.ts';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { logAudit } from '../services/audit.ts';

const router = Router();

// List instruments (with optional search)
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, accuracy_class, status, created_by } = req.query;

    let sql = `
      SELECT i.*, u.full_name as created_by_name,
             tp.id as test_plan_id, tp.status as test_plan_status, tp.test_plan_code
      FROM instruments i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN test_plans tp ON tp.instrument_id = i.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (created_by) {
      conditions.push('i.created_by = ?');
      params.push(created_by);
    }

    if (search) {
      conditions.push('(i.instrument_code LIKE ? OR i.manufacturer LIKE ? OR i.model_number LIKE ? OR i.applicant_name LIKE ? OR i.serial_number LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (accuracy_class) {
      conditions.push('i.accuracy_class = ?');
      params.push(accuracy_class);
    }

    if (status) {
      conditions.push('tp.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY i.created_at DESC';

    const instruments = await queryRows<any>(sql, params);
    res.json(instruments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single instrument with full configurations & test plans
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const instrument = await queryOne<any>(
      `SELECT i.*, u.full_name as created_by_name 
       FROM instruments i
       LEFT JOIN users u ON i.created_by = u.id
       WHERE (i.id = ? OR i.instrument_code = ?)`,
      [req.params.id, req.params.id]
    );

    if (!instrument) {
      return res.status(404).json({ error: 'Instrument not found.' });
    }

    const configs = await queryRows<any>('SELECT * FROM instrument_configs WHERE instrument_id = ? ORDER BY config_version DESC', [instrument.id]);
    const testPlans = await queryRows<any>('SELECT * FROM test_plans WHERE instrument_id = ? ORDER BY generated_at DESC', [instrument.id]);

    res.json({
      ...instrument,
      configs,
      test_plans: testPlans,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register new instrument (Instrument Owner / Applicant, Evaluator, Inspector, Admin)
router.post(
  '/',
  authenticate,
  requireRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN'),
  async (req: AuthenticatedRequest, res) => {
  try {
    const {
      applicant_name,
      manufacturer,
      model_number,
      instrument_type,
      accuracy_class,
      max_capacity,
      capacity_unit = 'kg',
      verification_scale_interval_e,
      scale_interval_unit = 'g',
      serial_number,
      indicator_details,
      load_cell_details,
      application_number,
      min_capacity,
      tare_capacity,
      temperature_range_min = -10,
      temperature_range_max = 40,
      power_supply = '230V AC, 50Hz',
    } = req.body;

    // Server-side validation
    if (!applicant_name?.trim()) return res.status(400).json({ error: 'Applicant name is required.' });
    if (!manufacturer?.trim()) return res.status(400).json({ error: 'Manufacturer name is required.' });
    if (!model_number?.trim()) return res.status(400).json({ error: 'Model number is required.' });
    if (!instrument_type?.trim()) return res.status(400).json({ error: 'Instrument type is required.' });
    if (!['I', 'II', 'III', 'IIII'].includes(accuracy_class)) {
      return res.status(400).json({ error: 'Accuracy class must be one of: Class I, II, III, IIII.' });
    }
    const maxVal = Number(max_capacity);
    const eVal = Number(verification_scale_interval_e);
    if (isNaN(maxVal) || maxVal <= 0) return res.status(400).json({ error: 'Maximum capacity (Max) must be a positive number.' });
    if (isNaN(eVal) || eVal <= 0) return res.status(400).json({ error: 'Verification scale interval (e) must be a positive number.' });
    if (!serial_number?.trim()) return res.status(400).json({ error: 'Serial number is required.' });
    if (!application_number?.trim()) return res.status(400).json({ error: 'Application / Reference number is required.' });

    // Calculate n = Max / e
    let eInCapacityUnit = eVal;
    if (scale_interval_unit === 'g' && capacity_unit === 'kg') {
      eInCapacityUnit = eVal / 1000;
    } else if (scale_interval_unit === 'mg' && capacity_unit === 'g') {
      eInCapacityUnit = eVal / 1000;
    }
    const n = Math.round(maxVal / eInCapacityUnit);

    // Validate n range under OIML R 76
    if (accuracy_class === 'III' && (n < 100 || n > 10000)) {
      // Return warning/error if n is out of standard bounds
      if (n > 10000) {
        return res.status(400).json({
          error: `Scale intervals count n = ${n} exceeds Class III maximum allowed limit (n ≤ 10,000) under OIML R 76 Table 3.`,
        });
      }
    }

    const instrumentId = uuidv4();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const instrumentCode = `NAWI-INST-${new Date().getFullYear()}-${randNum}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO instruments (id, instrument_code, applicant_name, manufacturer, model_number, instrument_type, accuracy_class, max_capacity, capacity_unit, verification_scale_interval_e, scale_interval_unit, serial_number, indicator_details, load_cell_details, application_number, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        instrumentId,
        instrumentCode,
        applicant_name.trim(),
        manufacturer.trim(),
        model_number.trim(),
        instrument_type.trim(),
        accuracy_class,
        maxVal,
        capacity_unit,
        eVal,
        scale_interval_unit,
        serial_number.trim(),
        indicator_details?.trim() || null,
        load_cell_details?.trim() || null,
        application_number.trim(),
        req.user!.id,
        now,
        now,
      ]
    );

    // Insert configuration record
    const configId = uuidv4();
    await execute(
      `INSERT INTO instrument_configs (id, instrument_id, config_version, min_capacity, tare_capacity, temperature_range_min, temperature_range_max, power_supply, active, created_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, 1, ?)`,
      [
        configId,
        instrumentId,
        min_capacity ? Number(min_capacity) : eVal * 20, // Min is standard 20e if unspecified
        tare_capacity ? Number(tare_capacity) : maxVal,
        Number(temperature_range_min),
        Number(temperature_range_max),
        power_supply,
        now,
      ]
    );

    await logAudit({
      user: req.user,
      action: 'INSTRUMENT_CREATED',
      entity_type: 'instrument',
      entity_id: instrumentId,
      after_value: {
        instrument_code: instrumentCode,
        applicant_name,
        manufacturer,
        model_number,
        accuracy_class,
        max_capacity: `${maxVal} ${capacity_unit}`,
        verification_scale_interval_e: `${eVal} ${scale_interval_unit}`,
        scale_intervals_n: n,
      },
      reason: 'Evaluator registered a new NAWI instrument for type evaluation.',
    });

    res.status(201).json({
      message: 'Instrument successfully registered in system.',
      instrument_id: instrumentId,
      instrument_code: instrumentCode,
      scale_intervals_n: n,
    });
  } catch (err: any) {
    console.error('Error registering instrument:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
