import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, queryOne, execute } from './database.ts';

export async function seedInitialData(): Promise<void> {
  const db = await getDb();

  // 1. Roles
  const roles = [
    { id: 'role-admin', name: 'ADMIN', description: 'System Administrator: User management, rule engine configuration, audit oversight' },
    { id: 'role-inspector', name: 'INSPECTOR', description: 'Lead Legal Metrology Inspector: Application review, inspection scheduling, decision recommendation' },
    { id: 'role-subinspector', name: 'SUB_INSPECTOR', description: 'Field Legal Metrology Officer: On-site GPS verification, identity capture, metrological observation entry' },
    { id: 'role-engineer', name: 'ENGINEER', description: 'Calibration Engineer / Standard Specialist: Standard weight verification, uncertainty checks' },
    { id: 'role-applicant', name: 'APPLICANT', description: 'Instrument Owner / Manufacturer: Instrument registration & verification application submission' },
    { id: 'role-evaluator', name: 'EVALUATOR', description: 'Metrology Evaluator: Register instruments, capture observations, execute calculations, submit test plans' },
    { id: 'role-reviewer', name: 'REVIEWER', description: 'Technical Reviewer: Review submitted tests, verify calculations, request corrections' },
    { id: 'role-approver', name: 'APPROVING_AUTHORITY', description: 'Approving Authority: Final review, seal & issue digital certificates' },
    { id: 'role-readonly', name: 'READ_ONLY', description: 'Auditor / Field Inspector: Public verification, certificate search & hash audit' },
  ];

  for (const r of roles) {
    const existing = await queryOne('SELECT id FROM roles WHERE name = ?', [r.name]);
    if (!existing) {
      await execute('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)', [r.id, r.name, r.description]);
    }
  }

  // 2. Default System Users
  const defaultUsers = [
    {
      email: 'admin@nawi.gov.in',
      password: 'AdminPassword123!',
      full_name: 'Dr. A. Verma',
      designation: 'Director of Legal Metrology',
      organization: 'National Metrology Center',
      role: 'ADMIN',
    },
    {
      email: 'inspector@nawi.gov.in',
      password: 'InspectorPassword123!',
      full_name: 'Dr. S. Mukherjee',
      designation: 'Lead Legal Metrology Inspector',
      organization: 'Central Legal Metrology Directorate',
      role: 'INSPECTOR',
    },
    {
      email: 'subinspector@nawi.gov.in',
      password: 'SubInspectorPassword123!',
      full_name: 'K. Ramanathan',
      designation: 'Field Legal Metrology Officer',
      organization: 'Regional Metrology Office',
      role: 'SUB_INSPECTOR',
    },
    {
      email: 'engineer@nawi.gov.in',
      password: 'EngineerPassword123!',
      full_name: 'P. Deshmukh',
      designation: 'Senior Calibration Engineer',
      organization: 'National Standards Testing Lab',
      role: 'ENGINEER',
    },
    {
      email: 'owner@nawi.gov.in',
      password: 'OwnerPassword123!',
      full_name: 'M. Sharma',
      designation: 'Quality Assurance Manager',
      organization: 'Apex Industrial Scales Pvt Ltd',
      role: 'APPLICANT',
    },
    {
      email: 'evaluator@nawi.gov.in',
      password: 'EvaluatorPassword123!',
      full_name: 'K. Ramanathan',
      designation: 'Metrology Type Evaluator',
      organization: 'Regional Standards Laboratory',
      role: 'EVALUATOR',
    },
    {
      email: 'reviewer@nawi.gov.in',
      password: 'ReviewerPassword123!',
      full_name: 'Dr. S. Mukherjee',
      designation: 'Senior Metrological Reviewer',
      organization: 'National Metrology Center',
      role: 'REVIEWER',
    },
    {
      email: 'approver@nawi.gov.in',
      password: 'ApproverPassword123!',
      full_name: 'S. P. Deshmukh',
      designation: 'Approving Authority & Head of Testing',
      organization: 'National Metrology Directorate',
      role: 'APPROVING_AUTHORITY',
    },
    {
      email: 'readonly@nawi.gov.in',
      password: 'ReadOnlyPassword123!',
      full_name: 'Inspector M. Sharma',
      designation: 'Legal Metrology Auditor',
      organization: 'Department of Consumer Affairs',
      role: 'READ_ONLY',
    },
  ];

  const now = new Date().toISOString();
  for (const u of defaultUsers) {
    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [u.email]);
    let userId = existing?.id;
    if (!existing) {
      userId = uuidv4();
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(u.password, salt);
      await execute(
        `INSERT INTO users (id, email, password_hash, full_name, designation, organization, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [userId, u.email, hash, u.full_name, u.designation, u.organization, now, now]
      );
    }

    // Link user role
    const roleRow = await queryOne<{ id: string }>('SELECT id FROM roles WHERE name = ?', [u.role]);
    if (roleRow && userId) {
      const existingUserRole = await queryOne('SELECT user_id FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleRow.id]);
      if (!existingUserRole) {
        await execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleRow.id]);
      }
    }
  }

  // 3. Test Definitions (OIML R 76-1:2006)
  const testDefs = [
    {
      id: 'def-acc-01',
      test_code: 'ACC_WEIGHING',
      name: 'Weighing Performance & Accuracy Test',
      category: 'Metrological Performance',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.4',
      description: 'Evaluation of instrument error across loading range (Min to Max) in increasing and decreasing directions against Maximum Permissible Error (MPE) limits.',
      supported_in_mvp: 1,
    },
    {
      id: 'def-rep-02',
      test_code: 'REPEATABILITY',
      name: 'Repeatability Test',
      category: 'Metrological Performance',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.6',
      description: 'Verification that the difference between the maximum and minimum indications obtained from multiple weighings of the same load does not exceed the absolute MPE for that load.',
      supported_in_mvp: 1,
    },
    {
      id: 'def-ecc-03',
      test_code: 'ECCENTRICITY',
      name: 'Eccentricity (Off-Center Load) Test',
      category: 'Metrological Performance',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.7',
      description: 'Assessment of the effect of eccentric loading on a load receptor (1/3 Max applied at corners and center positions) against MPE limits.',
      supported_in_mvp: 1,
    },
    {
      id: 'def-temp-04',
      test_code: 'TEMPERATURE_EFFECT',
      name: 'Static Temperature Influence on Span',
      category: 'Environmental Factors',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.5.3',
      description: 'Evaluation of zero and span shifts under controlled operating temperature ranges (-10°C to +40°C or specified range).',
      supported_in_mvp: 0,
    },
    {
      id: 'def-volt-05',
      test_code: 'VOLTAGE_VARIATION',
      name: 'Power Supply Voltage Variation Test',
      category: 'Electrical Factors',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.5.4',
      description: 'Testing instrument metrological stability under AC/DC mains voltage fluctuations (-15% to +10% of nominal voltage).',
      supported_in_mvp: 0,
    },
    {
      id: 'def-creep-06',
      test_code: 'CREEP_EVALUATION',
      name: 'Creep and Zero Return Test',
      category: 'Metrological Stability',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.8',
      description: 'Measurement of indication drift under sustained maximum load for 4 hours and return to zero.',
      supported_in_mvp: 0,
    },
  ];

  for (const td of testDefs) {
    const existing = await queryOne('SELECT id FROM test_definitions WHERE test_code = ?', [td.test_code]);
    if (!existing) {
      await execute(
        `INSERT INTO test_definitions (id, test_code, name, category, standard_ref, oiml_clause, description, supported_in_mvp, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [td.id, td.test_code, td.name, td.category, td.standard_ref, td.oiml_clause, td.description, td.supported_in_mvp]
      );
    }
  }

  // 4. Rule Versions (Database-driven, versioned, explainable)
  const ruleVersions = [
    {
      id: 'rule-oiml-r76-v1-class3',
      rule_id: 'OIML-R76-2006-GEN-III',
      version: 'v1.0.0',
      title: 'OIML R 76-1 (2006) - Class III Medium Accuracy Rules',
      effective_date: '2006-10-15',
      standard_code: 'OIML R 76-1:2006',
      instrument_type: 'ALL_NON_AUTOMATIC',
      accuracy_class: 'III',
      test_type: 'METROLOGICAL_VERIFICATION',
      requirement_text: 'For Class III instruments on initial verification: MPE = ±0.5e for 0 ≤ m ≤ 500e; MPE = ±1.0e for 500e < m ≤ 2000e; MPE = ±1.5e for 2000e < m ≤ 10000e.',
      calculation_ref: 'OIML_R76_TABLE_6_CLASS_III',
      formula_definition: JSON.stringify({
        standard: 'OIML R 76-1:2006',
        class: 'III',
        intervals: [
          { min_e: 0, max_e: 500, mpe_factor: 0.5 },
          { min_e: 500, max_e: 2000, mpe_factor: 1.0 },
          { min_e: 2000, max_e: 10000, mpe_factor: 1.5 },
        ],
        formulas: {
          error: 'E = I - L',
          corrected_error: 'E_c = I + 0.5e - dL - L',
          repeatability_limit: 'E_max - E_min <= |MPE|',
          eccentricity_limit: '|E_i| <= |MPE(L_ecc)|'
        }
      }),
      active: 1,
    },
    {
      id: 'rule-oiml-r76-v1-class2',
      rule_id: 'OIML-R76-2006-GEN-II',
      version: 'v1.0.0',
      title: 'OIML R 76-1 (2006) - Class II High Accuracy Rules',
      effective_date: '2006-10-15',
      standard_code: 'OIML R 76-1:2006',
      instrument_type: 'ALL_NON_AUTOMATIC',
      accuracy_class: 'II',
      test_type: 'METROLOGICAL_VERIFICATION',
      requirement_text: 'For Class II instruments on initial verification: MPE = ±0.5e for 0 ≤ m ≤ 5000e; MPE = ±1.0e for 5000e < m ≤ 20000e; MPE = ±1.5e for 20000e < m ≤ 100000e.',
      calculation_ref: 'OIML_R76_TABLE_6_CLASS_II',
      formula_definition: JSON.stringify({
        standard: 'OIML R 76-1:2006',
        class: 'II',
        intervals: [
          { min_e: 0, max_e: 5000, mpe_factor: 0.5 },
          { min_e: 5000, max_e: 20000, mpe_factor: 1.0 },
          { min_e: 20000, max_e: 100000, mpe_factor: 1.5 },
        ],
        formulas: {
          error: 'E = I - L',
          corrected_error: 'E_c = I + 0.5e - dL - L',
          repeatability_limit: 'E_max - E_min <= |MPE|',
          eccentricity_limit: '|E_i| <= |MPE(L_ecc)|'
        }
      }),
      active: 1,
    },
    {
      id: 'rule-oiml-r76-v1-class4',
      rule_id: 'OIML-R76-2006-GEN-IIII',
      version: 'v1.0.0',
      title: 'OIML R 76-1 (2006) - Class IIII Ordinary Accuracy Rules',
      effective_date: '2006-10-15',
      standard_code: 'OIML R 76-1:2006',
      instrument_type: 'ALL_NON_AUTOMATIC',
      accuracy_class: 'IIII',
      test_type: 'METROLOGICAL_VERIFICATION',
      requirement_text: 'For Class IIII instruments on initial verification: MPE = ±0.5e for 0 ≤ m ≤ 50e; MPE = ±1.0e for 50e < m ≤ 200e; MPE = ±1.5e for 200e < m ≤ 1000e.',
      calculation_ref: 'OIML_R76_TABLE_6_CLASS_IIII',
      formula_definition: JSON.stringify({
        standard: 'OIML R 76-1:2006',
        class: 'IIII',
        intervals: [
          { min_e: 0, max_e: 50, mpe_factor: 0.5 },
          { min_e: 50, max_e: 200, mpe_factor: 1.0 },
          { min_e: 200, max_e: 1000, mpe_factor: 1.5 },
        ],
        formulas: {
          error: 'E = I - L',
          corrected_error: 'E_c = I + 0.5e - dL - L',
          repeatability_limit: 'E_max - E_min <= |MPE|',
          eccentricity_limit: '|E_i| <= |MPE(L_ecc)|'
        }
      }),
      active: 1,
    },
    {
      id: 'rule-oiml-r76-v1-class1',
      rule_id: 'OIML-R76-2006-GEN-I',
      version: 'v1.0.0',
      title: 'OIML R 76-1 (2006) - Class I Special Accuracy Rules',
      effective_date: '2006-10-15',
      standard_code: 'OIML R 76-1:2006',
      instrument_type: 'ALL_NON_AUTOMATIC',
      accuracy_class: 'I',
      test_type: 'METROLOGICAL_VERIFICATION',
      requirement_text: 'For Class I instruments on initial verification: MPE = ±0.5e for 0 ≤ m ≤ 50000e; MPE = ±1.0e for 50000e < m ≤ 200000e; MPE = ±1.5e for m > 200000e.',
      calculation_ref: 'OIML_R76_TABLE_6_CLASS_I',
      formula_definition: JSON.stringify({
        standard: 'OIML R 76-1:2006',
        class: 'I',
        intervals: [
          { min_e: 0, max_e: 50000, mpe_factor: 0.5 },
          { min_e: 50000, max_e: 200000, mpe_factor: 1.0 },
          { min_e: 200000, max_e: 1000000, mpe_factor: 1.5 },
        ],
        formulas: {
          error: 'E = I - L',
          corrected_error: 'E_c = I + 0.5e - dL - L',
          repeatability_limit: 'E_max - E_min <= |MPE|',
          eccentricity_limit: '|E_i| <= |MPE(L_ecc)|'
        }
      }),
      active: 1,
    }
  ];

  for (const rv of ruleVersions) {
    const existing = await queryOne('SELECT id FROM rule_versions WHERE id = ?', [rv.id]);
    if (!existing) {
      await execute(
        `INSERT INTO rule_versions (id, rule_id, version, title, effective_date, standard_code, instrument_type, accuracy_class, test_type, requirement_text, calculation_ref, formula_definition, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rv.id, rv.rule_id, rv.version, rv.title, rv.effective_date, rv.standard_code, rv.instrument_type, rv.accuracy_class, rv.test_type, rv.requirement_text, rv.calculation_ref, rv.formula_definition, rv.active, now]
      );
    }
  }

  console.log('Database schema & system seed data initialized successfully.');
}
