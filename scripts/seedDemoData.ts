import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs from 'sql.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { CalculationEngine, ObservationInput, InstrumentSpecs } from '../src/server/services/calculationEngine.ts';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase server configuration.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Presentation temporary password
const DEMO_PASSWORD = process.env.DEMO_PRESENTATION_PASSWORD || 'DemoPresentation2026!';

const DEMO_ACCOUNTS = [
  {
    email: 'admin.demo@nawi.gov.in',
    full_name: 'Admin Demo',
    role: 'ADMIN',
    designation: 'National Metrology Administrator',
    organization: 'Legal Metrology Department',
  },
  {
    email: 'inspector.demo@nawi.gov.in',
    full_name: 'Lead Inspector Demo',
    role: 'INSPECTOR',
    designation: 'Senior Legal Metrology Inspector',
    organization: 'Legal Metrology Department',
  },
  {
    email: 'tester.demo@nawi.gov.in',
    full_name: 'Sub-Inspector Demo',
    role: 'TESTER',
    designation: 'Legal Metrology Testing Officer',
    organization: 'Legal Metrology Testing Laboratory',
  },
  {
    email: 'engineer.demo@nawi.gov.in',
    full_name: 'Engineer Demo',
    role: 'ENGINEER',
    designation: 'Verification & Calibration Engineer',
    organization: 'Metrological Calibration Services',
  },
  {
    email: 'owner.demo@nawi.gov.in',
    full_name: 'Instrument Owner Demo',
    role: 'OWNER',
    designation: 'Authorized Representative',
    organization: 'Demo Weighing Systems Ltd.',
  },
];

async function seedPresentationData() {
  console.log('--- Step 1: Provisioning Supabase Auth Accounts ---');
  const userMap: Record<string, any> = {};

  const { data: existingUsersRes } = await supabaseAdmin.auth.admin.listUsers();
  const existingList = existingUsersRes?.users || [];

  for (const acc of DEMO_ACCOUNTS) {
    const existing = existingList.find((u: any) => u.email?.toLowerCase() === acc.email.toLowerCase());
    let userId: string;

    if (existing) {
      userId = existing.id;
      console.log(`User ${acc.email} exists (${userId}). Updating credentials & metadata...`);
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: acc.full_name,
          role: acc.role,
          designation: acc.designation,
          organization: acc.organization,
        },
      });
      if (updErr) console.warn(`Update user warning for ${acc.email}:`, updErr.message);
    } else {
      console.log(`Creating user ${acc.email} in Supabase Auth...`);
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: acc.full_name,
          role: acc.role,
          designation: acc.designation,
          organization: acc.organization,
        },
      });

      if (createErr || !createData.user) {
        console.error(`Failed to create ${acc.email}:`, createErr?.message);
        process.exit(1);
      }
      userId = createData.user.id;
      console.log(`Created ${acc.email} successfully.`);
    }

    userMap[acc.role] = { ...acc, id: userId };

    // Try updating public.profiles if table exists
    try {
      await supabaseAdmin.from('profiles').upsert(
        {
          id: userId,
          user_id: userId,
          email: acc.email,
          full_name: acc.full_name,
          role: acc.role,
          status: 'ACTIVE',
          designation: acc.designation,
          organization: acc.organization,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // Ignored if profiles table pending migration
    }
  }

  console.log('--- Step 2: Synchronizing SQLite Users & Roles ---');
  const DB_PATH = path.join(process.cwd(), 'data', 'nawi_report.sqlite');
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  const nowIso = new Date().toISOString();

  // Ensure roles exist in SQLite
  const rolesToEnsure = [
    ['role-admin', 'ADMIN', 'System Administrator'],
    ['role-inspector', 'INSPECTOR', 'Lead Metrology Inspector'],
    ['role-tester', 'TESTER', 'Field Testing Officer'],
    ['role-sub-inspector', 'SUB_INSPECTOR', 'Field Testing Officer (Sub-Inspector)'],
    ['role-engineer', 'ENGINEER', 'Metrology Calibration Engineer'],
    ['role-owner', 'OWNER', 'Instrument Owner / Applicant'],
    ['role-applicant', 'APPLICANT', 'Instrument Owner / Applicant'],
  ];

  for (const [rId, rName, rDesc] of rolesToEnsure) {
    db.run(
      `INSERT INTO roles (id, name, description) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET description = excluded.description`,
      [rId, rName, rDesc]
    );
  }

  // Insert or update SQLite users with exact Supabase Auth UUIDs
  for (const acc of DEMO_ACCOUNTS) {
    const u = userMap[acc.role];
    db.run(
      `INSERT INTO users (id, email, password_hash, full_name, designation, organization, active, created_at, updated_at)
       VALUES (?, ?, 'SUPABASE_AUTH_MANAGED', ?, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         full_name = excluded.full_name,
         designation = excluded.designation,
         organization = excluded.organization,
         active = 1,
         updated_at = excluded.updated_at`,
      [u.id, u.email, u.full_name, u.designation, u.organization, nowIso, nowIso]
    );

    // Link in user_roles
    const roleRow = db.exec(`SELECT id FROM roles WHERE name = '${acc.role}'`);
    if (roleRow && roleRow[0] && roleRow[0].values.length > 0) {
      const roleId = roleRow[0].values[0][0];
      db.run(
        `INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
        [u.id, roleId]
      );
    }
  }

  console.log('--- Step 3: Creating DEMO-NAWI-001 Instrument ---');
  const instId = 'demo-inst-001-uuid';
  const instCode = 'DEMO-NAWI-001';
  const ownerUser = userMap['OWNER'];
  const adminUser = userMap['ADMIN'];
  const inspectorUser = userMap['INSPECTOR'];
  const testerUser = userMap['TESTER'];
  const engineerUser = userMap['ENGINEER'];

  db.run(
    `INSERT INTO instruments (
       id, instrument_code, applicant_name, manufacturer, model_number, instrument_type,
       accuracy_class, max_capacity, capacity_unit, verification_scale_interval_e,
       scale_interval_unit, serial_number, indicator_details, load_cell_details,
       application_number, created_by, created_at, updated_at,
       installation_address, contact_email, contact_phone, latitude, longitude
     ) VALUES (
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, NULL, NULL
     )
     ON CONFLICT(instrument_code) DO UPDATE SET
       applicant_name = excluded.applicant_name,
       manufacturer = excluded.manufacturer,
       model_number = excluded.model_number,
       serial_number = excluded.serial_number,
       max_capacity = excluded.max_capacity,
       verification_scale_interval_e = excluded.verification_scale_interval_e,
       indicator_details = excluded.indicator_details,
       load_cell_details = excluded.load_cell_details,
       installation_address = excluded.installation_address,
       contact_email = excluded.contact_email,
       contact_phone = excluded.contact_phone,
       created_by = excluded.created_by,
       updated_at = excluded.updated_at`,
    [
      instId,
      instCode,
      'Instrument Owner Demo',
      'Demo Weighing Systems',
      'DWS-300',
      'Non-Automatic Weighing Instrument',
      'III',
      300,
      'kg',
      100,
      'g',
      'DEMO-SN-001',
      'Digital Metrology Indicator DI-300 (DEMONSTRATION DATA)',
      'Strain Gauge Sensor LC-300C3 (DEMONSTRATION DATA)',
      'DEMO-APP-001',
      ownerUser.id,
      nowIso,
      nowIso,
      'DEMO LOCATION — NOT A FIELD OBSERVATION',
      'owner.demo@nawi.gov.in',
      '+91 98765 43210',
    ]
  );

  // Instrument config
  db.run(
    `INSERT OR REPLACE INTO instrument_configs (
       id, instrument_id, config_version, min_capacity, tare_capacity,
       temperature_range_min, temperature_range_max, power_supply, active, created_at
     ) VALUES (
       'config-demo-001', ?, 1, 2.0, 300.0,
       -10.0, 40.0, '230V AC / 50Hz Standard', 1, ?
     )`,
    [instId, nowIso]
  );

  console.log('--- Step 4: Creating DEMO-APP-001 / DEMO-INSP-001 Inspection & Test Plan ---');
  const testPlanId = 'demo-test-plan-001-uuid';
  const testPlanCode = 'DEMO-INSP-001';

  // Delete prior demo test plan dependencies if re-running
  db.run(`DELETE FROM calculations WHERE test_instance_id IN (SELECT id FROM test_instances WHERE test_plan_id = ?)`, [testPlanId]);
  db.run(`DELETE FROM observations WHERE test_instance_id IN (SELECT id FROM test_instances WHERE test_plan_id = ?)`, [testPlanId]);
  db.run(`DELETE FROM test_instances WHERE test_plan_id = ?`, [testPlanId]);
  db.run(`DELETE FROM workflow_states WHERE test_plan_id = ?`, [testPlanId]);
  db.run(`DELETE FROM test_plans WHERE id = ?`, [testPlanId]);

  db.run(
    `INSERT INTO test_plans (
       id, test_plan_code, instrument_id, rule_version_id, rule_version_code,
       status, overall_decision, summary_notes, generated_by, generated_at, updated_at,
       scheduled_date, site_address, assigned_inspector_id, assigned_sub_inspector_id,
       assigned_engineer_id, gps_status, verified_distance_m, inspector_recommendation,
       inspector_notes, inspector_reviewed_at, standards_verified_by, standards_verified_at,
       standard_weights_json
     ) VALUES (
       ?, ?, ?, 'rule-oiml-r76-v1-class3', 'OIML-R76-2006-GEN-III',
       'UNDER_REVIEW', 'PASS', ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, 'VERIFIED (DEMONSTRATION LOCATION)', 0.0, 'RECOMMENDED_FOR_VERIFICATION',
       ?, ?, ?, ?,
       ?
     )`,
    [
      testPlanId,
      testPlanCode,
      instId,
      'OIML R 76-1:2006 field verification completed. In calibration engineer review queue. (DEMONSTRATION DATA)',
      ownerUser.id,
      nowIso,
      nowIso,
      '2026-09-27 10:00:00',
      'DEMO LOCATION — NOT A FIELD OBSERVATION',
      inspectorUser.id,
      testerUser.id,
      engineerUser.id,
      'All on-site preliminary OIML R 76-1 tests executed satisfactorily by Sub-Inspector Demo. Forwarded for Calibration Engineer review. (DEMONSTRATION DATA)',
      nowIso,
      engineerUser.id,
      nowIso,
      JSON.stringify([
        { weight_id: 'STD-M1-100KG', nominal: '100 kg', class: 'M1', cert_no: 'NPLI-CAL-2026-001', verified: true },
        { weight_id: 'STD-M1-200KG', nominal: '200 kg', class: 'M1', cert_no: 'NPLI-CAL-2026-002', verified: true },
      ]),
    ]
  );

  console.log('--- Step 5: Recording Observations & Running Calculation Engine ---');
  const specs: InstrumentSpecs = {
    accuracy_class: 'III',
    max_capacity: 300,
    capacity_unit: 'kg',
    verification_scale_interval_e: 100,
    scale_interval_unit: 'g',
  };

  // Test 1: ACC_WEIGHING (Clause A.4.4)
  const tiAccId = 'demo-ti-acc-001';
  db.run(
    `INSERT INTO test_instances (
       id, test_plan_id, test_definition_id, test_code, test_name, status, supported, execution_order, decision, created_at
     ) VALUES (
       ?, ?, 'def-acc-01', 'ACC_WEIGHING', 'Weighing Performance & Accuracy Test', 'COMPLETED', 1, 1, 'PASS', ?
     )`,
    [tiAccId, testPlanId, nowIso]
  );

  const accObservations: ObservationInput[] = [
    { load_point: 10, reference_mass: 10, mass_unit: 'kg', indication_increasing: 10.0, indication_decreasing: 10.0, run_number: 1 },
    { load_point: 50, reference_mass: 50, mass_unit: 'kg', indication_increasing: 50.0, indication_decreasing: 50.0, run_number: 1 },
    { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.0, indication_decreasing: 100.0, run_number: 1 },
    { load_point: 200, reference_mass: 200, mass_unit: 'kg', indication_increasing: 200.0, indication_decreasing: 199.9, run_number: 1 },
    { load_point: 300, reference_mass: 300, mass_unit: 'kg', indication_increasing: 300.0, indication_decreasing: 300.0, run_number: 1 },
  ];

  accObservations.forEach((obs, idx) => {
    db.run(
      `INSERT INTO observations (
         id, test_instance_id, load_point, reference_mass, mass_unit,
         indication_increasing, indication_decreasing, delta_l, run_number, recorded_by, timestamp
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, 0, ?, ?, ?
       )`,
      [
        `demo-obs-acc-${idx + 1}`,
        tiAccId,
        obs.load_point,
        obs.reference_mass,
        obs.mass_unit,
        obs.indication_increasing,
        obs.indication_decreasing,
        obs.run_number,
        testerUser.id,
        nowIso,
      ]
    );
  });

  const accCalc = CalculationEngine.calculateAccuracyTest(accObservations, specs, 'v1.0.0');
  db.run(
    `INSERT INTO calculations (
       id, test_instance_id, input_values_json, formula_ref, calculation_version,
       rule_version, result_value, applicable_mpe, comparison_text, decision,
       calculation_steps_json, calculated_by, calculated_at
     ) VALUES (
       'demo-calc-acc-001', ?, ?, 'OIML R 76-1:2006 Table 6', 'NAWI-CALC-v1.0.0',
       'v1.0.0', ?, ?, ?, ?,
       ?, ?, ?
     )`,
    [
      tiAccId,
      JSON.stringify(accCalc.input_values),
      accCalc.result_value,
      accCalc.applicable_limit,
      accCalc.comparison,
      accCalc.decision,
      JSON.stringify(accCalc.calculation_steps),
      testerUser.id,
      nowIso,
    ]
  );

  // Test 2: REPEATABILITY (Clause A.4.6)
  const tiRepId = 'demo-ti-rep-002';
  db.run(
    `INSERT INTO test_instances (
       id, test_plan_id, test_definition_id, test_code, test_name, status, supported, execution_order, decision, created_at
     ) VALUES (
       ?, ?, 'def-rep-02', 'REPEATABILITY', 'Repeatability Test', 'COMPLETED', 1, 2, 'PASS', ?
     )`,
    [tiRepId, testPlanId, nowIso]
  );

  const repObservations: ObservationInput[] = [
    { load_point: 200, reference_mass: 200, mass_unit: 'kg', indication_increasing: 200.0, run_number: 1 },
    { load_point: 200, reference_mass: 200, mass_unit: 'kg', indication_increasing: 200.0, run_number: 2 },
    { load_point: 200, reference_mass: 200, mass_unit: 'kg', indication_increasing: 200.0, run_number: 3 },
  ];

  repObservations.forEach((obs, idx) => {
    db.run(
      `INSERT INTO observations (
         id, test_instance_id, load_point, reference_mass, mass_unit,
         indication_increasing, run_number, recorded_by, timestamp
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?
       )`,
      [
        `demo-obs-rep-${idx + 1}`,
        tiRepId,
        obs.load_point,
        obs.reference_mass,
        obs.mass_unit,
        obs.indication_increasing,
        obs.run_number,
        testerUser.id,
        nowIso,
      ]
    );
  });

  const repCalc = CalculationEngine.calculateRepeatabilityTest(repObservations, specs, 'v1.0.0');
  db.run(
    `INSERT INTO calculations (
       id, test_instance_id, input_values_json, formula_ref, calculation_version,
       rule_version, result_value, applicable_mpe, comparison_text, decision,
       calculation_steps_json, calculated_by, calculated_at
     ) VALUES (
       'demo-calc-rep-002', ?, ?, 'OIML R 76-1:2006 Clause A.4.6', 'NAWI-CALC-v1.0.0',
       'v1.0.0', ?, ?, ?, ?,
       ?, ?, ?
     )`,
    [
      tiRepId,
      JSON.stringify(repCalc.input_values),
      repCalc.result_value,
      repCalc.applicable_limit,
      repCalc.comparison,
      repCalc.decision,
      JSON.stringify(repCalc.calculation_steps),
      testerUser.id,
      nowIso,
    ]
  );

  // Test 3: ECCENTRICITY (Clause A.4.7)
  const tiEccId = 'demo-ti-ecc-003';
  db.run(
    `INSERT INTO test_instances (
       id, test_plan_id, test_definition_id, test_code, test_name, status, supported, execution_order, decision, created_at
     ) VALUES (
       ?, ?, 'def-ecc-03', 'ECCENTRICITY', 'Eccentricity (Off-Center Load) Test', 'COMPLETED', 1, 3, 'PASS', ?
     )`,
    [tiEccId, testPlanId, nowIso]
  );

  const eccObservations: ObservationInput[] = [
    { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.0, position_corner: 'Center', run_number: 1 },
    { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.0, position_corner: 'Pos 1 (Front Left)', run_number: 2 },
    { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.0, position_corner: 'Pos 2 (Front Right)', run_number: 3 },
    { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.0, position_corner: 'Pos 3 (Back Left)', run_number: 4 },
    { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.0, position_corner: 'Pos 4 (Back Right)', run_number: 5 },
  ];

  eccObservations.forEach((obs, idx) => {
    db.run(
      `INSERT INTO observations (
         id, test_instance_id, load_point, reference_mass, mass_unit,
         indication_increasing, position_corner, run_number, recorded_by, timestamp
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?
       )`,
      [
        `demo-obs-ecc-${idx + 1}`,
        tiEccId,
        obs.load_point,
        obs.reference_mass,
        obs.mass_unit,
        obs.indication_increasing,
        obs.position_corner,
        obs.run_number,
        testerUser.id,
        nowIso,
      ]
    );
  });

  const eccCalc = CalculationEngine.calculateEccentricityTest(eccObservations, specs, 'v1.0.0');
  db.run(
    `INSERT INTO calculations (
       id, test_instance_id, input_values_json, formula_ref, calculation_version,
       rule_version, result_value, applicable_mpe, comparison_text, decision,
       calculation_steps_json, calculated_by, calculated_at
     ) VALUES (
       'demo-calc-ecc-003', ?, ?, 'OIML R 76-1:2006 Clause A.4.7', 'NAWI-CALC-v1.0.0',
       'v1.0.0', ?, ?, ?, ?,
       ?, ?, ?
     )`,
    [
      tiEccId,
      JSON.stringify(eccCalc.input_values),
      eccCalc.result_value,
      eccCalc.applicable_limit,
      eccCalc.comparison,
      eccCalc.decision,
      JSON.stringify(eccCalc.calculation_steps),
      testerUser.id,
      nowIso,
    ]
  );

  console.log('--- Step 6: Recording Workflow State Transitions ---');
  const transitions = [
    { from: 'DRAFT', to: 'APPLICATION_SUBMITTED', by: ownerUser.id, role: 'OWNER', reason: 'DEMO APPLICATION CREATED by applicant.' },
    { from: 'APPLICATION_SUBMITTED', to: 'INSPECTION_SCHEDULED', by: adminUser.id, role: 'ADMIN', reason: 'DEMO INSPECTION ASSIGNED to Sub-Inspector Demo.' },
    { from: 'INSPECTION_SCHEDULED', to: 'FIELD_TESTS_COMPLETED', by: testerUser.id, role: 'TESTER', reason: 'DEMO TEST DATA RECORDED across OIML modules.' },
    { from: 'FIELD_TESTS_COMPLETED', to: 'UNDER_REVIEW', by: inspectorUser.id, role: 'INSPECTOR', reason: 'DEMO ENGINEER REVIEW CREATED: Passed preliminary review, awaiting engineer review.' },
  ];

  transitions.forEach((t, i) => {
    db.run(
      `INSERT INTO workflow_states (id, test_plan_id, from_state, to_state, changed_by, user_role, reason, is_override, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [`demo-ws-${i + 1}`, testPlanId, t.from, t.to, t.by, t.role, t.reason, nowIso]
    );
  });

  console.log('--- Step 7: Creating Demonstration Certificate (DEMO-CERT-001) & SHA-256 Hash ---');
  const reportId = 'demo-report-001-uuid';
  const reportNumber = 'DEMO-CERT-001';
  const verificationId = 'VRF-DEMO-001';

  db.run(`DELETE FROM report_hashes WHERE report_id = ?`, [reportId]);
  db.run(`DELETE FROM reports WHERE id = ?`, [reportId]);

  const canonicalPayload = {
    document_title: 'DEMONSTRATION NAWI TEST CERTIFICATE',
    disclaimer: 'DEMONSTRATION CERTIFICATE — NOT A LEGALLY VALID CERTIFICATE',
    report_number: reportNumber,
    report_id: reportId,
    status: 'DEMONSTRATION ONLY',
    finalized_at: nowIso,
    rule_engine: {
      rule_version_id: 'rule-oiml-r76-v1-class3',
      rule_version_code: 'OIML-R76-2006-GEN-III',
      rule_title: 'OIML R 76-1 (2006) - Class III Medium Accuracy Rules',
    },
    calculation_engine: {
      version: 'NAWI-CALC-v1.0.0',
      standard: 'OIML R 76-1:2006',
    },
    instrument: {
      instrument_code: instCode,
      applicant_name: 'Instrument Owner Demo',
      manufacturer: 'Demo Weighing Systems',
      model_number: 'DWS-300',
      instrument_type: 'Non-Automatic Weighing Instrument',
      accuracy_class: 'III',
      max_capacity: '300 kg',
      verification_scale_interval_e: '100 g',
      serial_number: 'DEMO-SN-001',
      application_number: 'DEMO-APP-001',
    },
    evaluation_summary: {
      overall_decision: 'PASS',
      note: 'Controlled presentation dataset — verification engine demonstrated successfully.',
    },
    signatories: {
      reviewer: { id: engineerUser.id, name: engineerUser.full_name },
      approving_authority: { id: adminUser.id, name: adminUser.full_name },
    },
  };

  const payloadString = JSON.stringify(canonicalPayload);
  const sha256Hash = crypto.createHash('sha256').update(payloadString).digest('hex');

  db.run(
    `INSERT INTO reports (
       id, report_number, instrument_id, test_plan_id, rule_version_used,
       calculation_version_used, status, reviewer_id, reviewer_name,
       approving_authority_id, approving_authority_name, summary, finalized_at, created_at
     ) VALUES (
       ?, ?, ?, ?, 'OIML-R76-2006-GEN-III',
       'NAWI-CALC-v1.0.0', 'DEMONSTRATION ONLY', ?, ?,
       ?, ?, 'DEMONSTRATION CERTIFICATE — NOT A LEGALLY VALID CERTIFICATE. Prepared for presentation and workflow verification.', ?, ?
     )`,
    [
      reportId,
      reportNumber,
      instId,
      testPlanId,
      engineerUser.id,
      engineerUser.full_name,
      adminUser.id,
      adminUser.full_name,
      nowIso,
      nowIso,
    ]
  );

  db.run(
    `INSERT INTO report_hashes (
       id, report_id, verification_id, sha256_hash, report_payload_json, generated_at
     ) VALUES (
       'demo-hash-001', ?, ?, ?, ?, ?
     )`,
    [reportId, verificationId, sha256Hash, payloadString, nowIso]
  );

  console.log('--- Step 8: Creating Demonstration Audit Trail ---');
  const auditEvents = [
    {
      action: 'DEMO APPLICATION CREATED',
      user: ownerUser,
      entity_type: 'application',
      entity_id: 'DEMO-APP-001',
      reason: 'Controlled demonstration application registered by applicant for Initial Verification. (DEMONSTRATION DATA)',
    },
    {
      action: 'DEMO INSPECTION ASSIGNED',
      user: adminUser,
      entity_type: 'inspection',
      entity_id: 'DEMO-INSP-001',
      reason: 'Controlled demonstration inspection assigned to Sub-Inspector Demo and Lead Inspector Demo. (DEMONSTRATION DATA)',
    },
    {
      action: 'DEMO TEST DATA RECORDED',
      user: testerUser,
      entity_type: 'test_plan',
      entity_id: 'DEMO-INSP-001',
      reason: 'Field test observations recorded for Weighing Performance, Repeatability, and Eccentricity tests. (DEMONSTRATION DATA)',
    },
    {
      action: 'DEMO ENGINEER REVIEW CREATED',
      user: inspectorUser,
      entity_type: 'inspection',
      entity_id: 'DEMO-INSP-001',
      reason: 'Inspector recommended verification and submitted inspection to Calibration Engineer review queue. (DEMONSTRATION DATA)',
    },
  ];

  auditEvents.forEach((ev, idx) => {
    db.run(
      `INSERT INTO audit_logs (
         id, user_id, user_email, user_role, action, entity_type, entity_id,
         before_value_json, after_value_json, reason, ip_address, timestamp
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?,
         NULL, ?, ?, '127.0.0.1', ?
       )`,
      [
        `demo-audit-${idx + 1}`,
        ev.user.id,
        ev.user.email,
        ev.user.role,
        ev.action,
        ev.entity_type,
        ev.entity_id,
        JSON.stringify({ status: 'DEMONSTRATION_RECORD', reference: ev.entity_id }),
        ev.reason,
        nowIso,
      ]
    );
  });

  // Save SQLite
  const exported = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(exported));
  console.log('SQLite database updated successfully.');

  console.log('--- All Controlled Demonstration Data Created Successfully ---');
}

seedPresentationData().catch((err) => {
  console.error('Seed exception:', err);
  process.exit(1);
});
