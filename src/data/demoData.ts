import {
  Instrument,
  TestPlan,
  TestInstance,
  Observation,
  Calculation,
  CalculationStep,
  FinalizedReport,
  AuditLog,
  RuleVersion,
  User,
  RoleName,
  WorkflowStatus,
} from '../types.ts';

const STORAGE_KEY = 'nawi_demo_data_v2';

// -------------------------------------------------------------
// DEFAULT DEMO USERS (5 Primary Roles)
// -------------------------------------------------------------
export const DEMO_USERS: User[] = [
  {
    id: 'usr-owner-001',
    email: 'owner@nawi.gov.in',
    full_name: 'Rajesh Sharma',
    designation: 'Managing Director & Authorized Owner',
    organization: 'Precision Instruments Pvt Ltd',
    role: 'APPLICANT',
    roles: ['APPLICANT'],
  },
  {
    id: 'usr-tester-001',
    email: 'subinspector@nawi.gov.in',
    full_name: 'Amit Patel',
    designation: 'Field Legal Metrology Tester',
    organization: 'Regional Metrology Testing Laboratory',
    role: 'SUB_INSPECTOR',
    roles: ['SUB_INSPECTOR'],
  },
  {
    id: 'usr-tester-alias',
    email: 'tester@nawi.gov.in',
    full_name: 'Amit Patel (Tester)',
    designation: 'Field Legal Metrology Tester',
    organization: 'Regional Metrology Testing Laboratory',
    role: 'SUB_INSPECTOR',
    roles: ['SUB_INSPECTOR'],
  },
  {
    id: 'usr-engineer-001',
    email: 'engineer@nawi.gov.in',
    full_name: 'Vikram Sengupta',
    designation: 'Senior Calibration Engineer',
    organization: 'National Calibration & Standards Wing',
    role: 'ENGINEER',
    roles: ['ENGINEER'],
  },
  {
    id: 'usr-inspector-001',
    email: 'inspector@nawi.gov.in',
    full_name: 'Dr. Sunita Rao',
    designation: 'Chief Legal Metrology Inspector',
    organization: 'Directorate of Legal Metrology',
    role: 'INSPECTOR',
    roles: ['INSPECTOR'],
  },
  {
    id: 'usr-admin-001',
    email: 'admin@nawi.gov.in',
    full_name: 'K. V. Ramanathan',
    designation: 'Director & Approving Authority',
    organization: 'Ministry of Consumer Affairs, Legal Metrology Div',
    role: 'ADMIN',
    roles: ['ADMIN', 'APPROVING_AUTHORITY'],
  },
];

// -------------------------------------------------------------
// OIML R 76-1:2006 MPE (Maximum Permissible Error) Engine
// -------------------------------------------------------------
export function computeMpeInE(accuracyClass: string, mInE: number): number {
  const absM = Math.abs(mInE);
  switch (accuracyClass) {
    case 'I':
      if (absM <= 50000) return 0.5;
      if (absM <= 200000) return 1.0;
      return 1.5;
    case 'II':
      if (absM <= 5000) return 0.5;
      if (absM <= 20000) return 1.0;
      return 1.5;
    case 'III':
    default:
      if (absM <= 500) return 0.5;
      if (absM <= 2000) return 1.0;
      return 1.5;
    case 'IIII':
      if (absM <= 50) return 0.5;
      if (absM <= 200) return 1.0;
      return 1.5;
  }
}

// -------------------------------------------------------------
// EXACT 3 DEMO INSTRUMENTS
// -------------------------------------------------------------
const INITIAL_INSTRUMENTS: Instrument[] = [
  {
    id: 'inst-demo-001',
    instrument_code: 'DEMO-001',
    applicant_name: 'Precision Test Mfr',
    manufacturer: 'Precision Test Mfr',
    model_number: 'PT-7113',
    instrument_type: 'Electronic Precision Bench Scale',
    accuracy_class: 'III',
    max_capacity: 30,
    capacity_unit: 'kg',
    verification_scale_interval_e: 10,
    scale_interval_unit: 'g',
    serial_number: 'SN-PT-7113-2025',
    application_number: 'APP-2025-001',
    indicator_details: 'Digital LCD with IP65 Enclosure',
    load_cell_details: 'Single point shear beam strain gauge',
    created_by: 'usr-owner-001',
    created_by_name: 'Rajesh Sharma',
    created_at: '2025-02-10T09:00:00Z',
    updated_at: '2025-02-12T14:30:00Z',
    test_plan_id: 'tp-demo-001',
    test_plan_code: 'TP-DEMO-001',
    test_plan_status: 'INSPECTION_SCHEDULED',
  },
  {
    id: 'inst-demo-002',
    instrument_code: 'DEMO-002',
    applicant_name: 'Electronic Platform Scale Ltd',
    manufacturer: 'Electronic Platform Scale',
    model_number: 'EP-420',
    instrument_type: 'Industrial Platform Scale',
    accuracy_class: 'III',
    max_capacity: 150,
    capacity_unit: 'kg',
    verification_scale_interval_e: 50,
    scale_interval_unit: 'g',
    serial_number: 'SN-EP-420-9941',
    application_number: 'APP-2025-002',
    indicator_details: 'High-contrast LED indicator',
    load_cell_details: '4-load cell stainless steel junction box',
    created_by: 'usr-owner-001',
    created_by_name: 'Rajesh Sharma',
    created_at: '2025-02-14T10:15:00Z',
    updated_at: '2025-02-16T11:20:00Z',
    test_plan_id: 'tp-demo-002',
    test_plan_code: 'TP-DEMO-002',
    test_plan_status: 'SITE_VERIFIED',
  },
  {
    id: 'inst-demo-003',
    instrument_code: 'DEMO-003',
    applicant_name: 'Retail Counter Scale Corp',
    manufacturer: 'Retail Counter Scale',
    model_number: 'RC-210',
    instrument_type: 'Retail Price-Computing Counter Scale',
    accuracy_class: 'III',
    max_capacity: 30,
    capacity_unit: 'kg',
    verification_scale_interval_e: 5,
    scale_interval_unit: 'g',
    serial_number: 'SN-RC-210-3312',
    application_number: 'APP-2025-003',
    indicator_details: 'Dual customer-vendor VFD display',
    load_cell_details: 'High precision aluminum single point cell',
    created_by: 'usr-owner-001',
    created_by_name: 'Rajesh Sharma',
    created_at: '2025-02-18T08:45:00Z',
    updated_at: '2025-02-20T16:00:00Z',
    test_plan_id: 'tp-demo-003',
    test_plan_code: 'TP-DEMO-003',
    test_plan_status: 'FIELD_TESTS_COMPLETED',
  },
];

// Helper to build the 4 standard OIML tests
function createStandardTestInstances(testPlanId: string, maxCap: number, eVal: number, eUnit: string, capUnit: string): TestInstance[] {
  return [
    {
      id: `${testPlanId}-inst-repeatability`,
      test_plan_id: testPlanId,
      test_definition_id: 'td-repeatability',
      test_code: 'REPEATABILITY',
      test_name: '1. Repeatability Test',
      category: 'Metrological Verification',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.6',
      definition_desc: 'Evaluation of measurement consistency under identical repeated test load applications at 50% Max.',
      status: 'PENDING',
      supported: true,
      execution_order: 1,
      decision: 'PENDING',
      observations: [],
      calculation: null,
    },
    {
      id: `${testPlanId}-inst-eccentricity`,
      test_plan_id: testPlanId,
      test_definition_id: 'td-eccentricity',
      test_code: 'ECCENTRICITY',
      test_name: '2. Eccentricity Test (Off-Center Loading)',
      category: 'Metrological Verification',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.7',
      definition_desc: 'Evaluation of off-center loading on platter corners within 1/3 Max load points.',
      status: 'PENDING',
      supported: true,
      execution_order: 2,
      decision: 'PENDING',
      observations: [],
      calculation: null,
    },
    {
      id: `${testPlanId}-inst-weighing`,
      test_plan_id: testPlanId,
      test_definition_id: 'td-weighing',
      test_code: 'ACC_WEIGHING',
      test_name: '3. Weighing Performance & Linearity Test',
      category: 'Metrological Verification',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.4',
      definition_desc: 'Determination of intrinsic weighing errors from Min to Max capacity under increasing and decreasing loads.',
      status: 'PENDING',
      supported: true,
      execution_order: 3,
      decision: 'PENDING',
      observations: [],
      calculation: null,
    },
    {
      id: `${testPlanId}-inst-tare`,
      test_plan_id: testPlanId,
      test_definition_id: 'td-tare',
      test_code: 'TARE_ZERO',
      test_name: '4. Tare & Zero-Setting Test',
      category: 'Metrological Verification',
      standard_ref: 'OIML R 76-1:2006',
      oiml_clause: 'Clause A.4.5',
      definition_desc: 'Evaluation of zero-setting accuracy (≤ 0.25e) and tare balancing performance.',
      status: 'PENDING',
      supported: true,
      execution_order: 4,
      decision: 'PENDING',
      observations: [],
      calculation: null,
    },
  ];
}

// -------------------------------------------------------------
// EXACT 3 DEMO TEST PLANS
// -------------------------------------------------------------
const INITIAL_TEST_PLANS: TestPlan[] = [
  // 1. DEMO-001 (Inspection Scheduled)
  {
    id: 'tp-demo-001',
    test_plan_code: 'TP-DEMO-001',
    instrument_id: 'inst-demo-001',
    instrument_code: 'DEMO-001',
    applicant_name: 'Precision Test Mfr',
    manufacturer: 'Precision Test Mfr',
    model_number: 'PT-7113',
    instrument_type: 'Electronic Precision Bench Scale',
    accuracy_class: 'III',
    max_capacity: 30,
    capacity_unit: 'kg',
    verification_scale_interval_e: 10,
    scale_interval_unit: 'g',
    serial_number: 'SN-PT-7113-2025',
    application_number: 'APP-2025-001',
    indicator_details: 'Digital LCD with IP65 Enclosure',
    load_cell_details: 'Single point shear beam strain gauge',
    rule_version_id: 'rule-oiml-r76-2006',
    rule_version_code: 'OIML R 76-1:2006',
    rule_title: 'Non-automatic weighing instruments - Metrological and technical requirements - Tests',
    requirement_text: 'Clause A.4 Testing Protocol (Class III Non-Automatic Weighing Instruments)',
    status: 'INSPECTION_SCHEDULED',
    overall_decision: 'PENDING',
    generated_at: '2025-02-12T10:00:00Z',
    updated_at: '2025-02-12T14:30:00Z',
    scheduled_date: new Date().toISOString().split('T')[0],
    site_address: 'Delhi Regional Metrology Laboratory, Sector 12, New Delhi 110001',
    target_latitude: 28.6139,
    target_longitude: 77.2090,
    geofence_radius_m: 500,
    assigned_inspector_id: 'usr-inspector-001',
    assigned_inspector_name: 'Dr. Sunita Rao',
    assigned_sub_inspector_id: 'usr-tester-001',
    assigned_sub_inspector_name: 'Amit Patel (Tester)',
    assigned_engineer_id: 'usr-engineer-001',
    assigned_engineer_name: 'Vikram Sengupta',
    gps_status: 'PENDING',
    test_instances: createStandardTestInstances('tp-demo-001', 30, 10, 'g', 'kg'),
    workflow_history: [
      {
        id: 'wh-001-1',
        test_plan_id: 'tp-demo-001',
        from_state: 'DRAFT',
        to_state: 'INSPECTION_SCHEDULED',
        changed_by: 'usr-inspector-001',
        changed_by_name: 'Dr. Sunita Rao',
        user_role: 'INSPECTOR',
        reason: 'Inspection site assigned and scheduled for field metrology verification.',
        is_override: false,
        changed_at: '2025-02-12T14:30:00Z',
      },
    ],
  },

  // 2. DEMO-002 (Testing / Site Verified)
  {
    id: 'tp-demo-002',
    test_plan_code: 'TP-DEMO-002',
    instrument_id: 'inst-demo-002',
    instrument_code: 'DEMO-002',
    applicant_name: 'Electronic Platform Scale Ltd',
    manufacturer: 'Electronic Platform Scale',
    model_number: 'EP-420',
    instrument_type: 'Industrial Platform Scale',
    accuracy_class: 'III',
    max_capacity: 150,
    capacity_unit: 'kg',
    verification_scale_interval_e: 50,
    scale_interval_unit: 'g',
    serial_number: 'SN-EP-420-9941',
    application_number: 'APP-2025-002',
    indicator_details: 'High-contrast LED indicator',
    load_cell_details: '4-load cell stainless steel junction box',
    rule_version_id: 'rule-oiml-r76-2006',
    rule_version_code: 'OIML R 76-1:2006',
    rule_title: 'Non-automatic weighing instruments - Metrological and technical requirements - Tests',
    requirement_text: 'Clause A.4 Testing Protocol (Class III Non-Automatic Weighing Instruments)',
    status: 'SITE_VERIFIED', // "Testing" status in workflow
    overall_decision: 'PENDING',
    generated_at: '2025-02-14T11:00:00Z',
    updated_at: '2025-02-16T11:20:00Z',
    scheduled_date: new Date().toISOString().split('T')[0],
    site_address: 'Industrial Testing Area C, Okhla Phase III, New Delhi 110020',
    target_latitude: 28.5355,
    target_longitude: 77.2713,
    geofence_radius_m: 500,
    verified_latitude: 28.5356,
    verified_longitude: 77.2714,
    verified_distance_m: 14.8,
    gps_verified_at: '2025-02-16T10:30:00Z',
    gps_status: 'IN_GEOFENCE',
    assigned_inspector_id: 'usr-inspector-001',
    assigned_inspector_name: 'Dr. Sunita Rao',
    assigned_sub_inspector_id: 'usr-tester-001',
    assigned_sub_inspector_name: 'Amit Patel (Tester)',
    assigned_engineer_id: 'usr-engineer-001',
    assigned_engineer_name: 'Vikram Sengupta',
    standard_weights: [
      {
        class_type: 'M1 Class Standard Mass Set',
        serial_number: 'STD-M1-2025-089',
        cert_number: 'NPL/CAL/2025/4491',
        expiry_date: '2026-12-31',
        uncertainty_value: 0.001,
      },
    ],
    standards_verified_by: 'usr-engineer-001',
    standards_verified_name: 'Vikram Sengupta',
    standards_verified_at: '2025-02-16T10:45:00Z',
    test_instances: [
      {
        id: 'tp-demo-002-inst-repeatability',
        test_plan_id: 'tp-demo-002',
        test_definition_id: 'td-repeatability',
        test_code: 'REPEATABILITY',
        test_name: '1. Repeatability Test',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.6',
        definition_desc: 'Evaluation of measurement consistency under identical repeated test load applications at 50% Max.',
        status: 'COMPLETED',
        supported: true,
        execution_order: 1,
        decision: 'PASS',
        observations: [
          { load_point: 75, reference_mass: 75, mass_unit: 'kg', indication_increasing: 75.0, run_number: 1 },
          { load_point: 75, reference_mass: 75, mass_unit: 'kg', indication_increasing: 75.01, run_number: 2 },
          { load_point: 75, reference_mass: 75, mass_unit: 'kg', indication_increasing: 75.0, run_number: 3 },
          { load_point: 75, reference_mass: 75, mass_unit: 'kg', indication_increasing: 75.01, run_number: 4 },
          { load_point: 75, reference_mass: 75, mass_unit: 'kg', indication_increasing: 75.0, run_number: 5 },
        ],
        calculation: {
          id: 'calc-rep-002',
          test_instance_id: 'tp-demo-002-inst-repeatability',
          input_values: { runs: 5, load: 75 },
          formula_ref: 'Clause A.4.6.1',
          calculation_version: 'OIML R 76-1:2006',
          rule_version: 'v1.0.0',
          result_value: 0.01,
          applicable_mpe: 0.05,
          comparison_text: 'Maximum difference between runs (0.010 kg) ≤ MPE (0.050 kg)',
          decision: 'PASS',
          calculated_at: '2025-02-16T11:00:00Z',
          calculation_steps: [
            {
              step_number: 1,
              label: 'Repeatability Difference Evaluation',
              description: 'Compute range between maximum and minimum indications across 5 repeated runs.',
              formula: 'Δ = I_max - I_min',
              values: { I_max: 75.01, I_min: 75.0 },
              result: '0.010 kg',
            },
            {
              step_number: 2,
              label: 'MPE Compliance Verification',
              description: 'Compare difference Δ with maximum permissible error for load.',
              formula: 'Δ ≤ |MPE| (0.050 kg)',
              values: { delta: 0.01, mpe: 0.05 },
              result: 'PASS (0.010 kg ≤ 0.050 kg)',
            },
          ],
        },
      },
      {
        id: 'tp-demo-002-inst-eccentricity',
        test_plan_id: 'tp-demo-002',
        test_definition_id: 'td-eccentricity',
        test_code: 'ECCENTRICITY',
        test_name: '2. Eccentricity Test (Off-Center Loading)',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.7',
        definition_desc: 'Evaluation of off-center loading on platter corners within 1/3 Max load points.',
        status: 'COMPLETED',
        supported: true,
        execution_order: 2,
        decision: 'PASS',
        observations: [
          { load_point: 50, reference_mass: 50, mass_unit: 'kg', position_corner: 'Center', indication_increasing: 50.0, run_number: 1 },
          { load_point: 50, reference_mass: 50, mass_unit: 'kg', position_corner: 'Front Left', indication_increasing: 50.01, run_number: 2 },
          { load_point: 50, reference_mass: 50, mass_unit: 'kg', position_corner: 'Back Left', indication_increasing: 50.0, run_number: 3 },
          { load_point: 50, reference_mass: 50, mass_unit: 'kg', position_corner: 'Back Right', indication_increasing: 49.99, run_number: 4 },
          { load_point: 50, reference_mass: 50, mass_unit: 'kg', position_corner: 'Front Right', indication_increasing: 50.0, run_number: 5 },
        ],
        calculation: {
          id: 'calc-ecc-002',
          test_instance_id: 'tp-demo-002-inst-eccentricity',
          input_values: { load: 50 },
          formula_ref: 'Clause A.4.7.1',
          calculation_version: 'OIML R 76-1:2006',
          rule_version: 'v1.0.0',
          result_value: 0.01,
          applicable_mpe: 0.05,
          comparison_text: 'Maximum corner error (0.010 kg) ≤ MPE (0.050 kg)',
          decision: 'PASS',
          calculated_at: '2025-02-16T11:10:00Z',
          calculation_steps: [
            {
              step_number: 1,
              label: 'Corner Off-Center Error Calculation',
              description: 'Calculate intrinsic error at each eccentric corner position.',
              formula: 'E = I - L',
              values: { max_corner_error: 0.01 },
              result: '0.010 kg',
            },
            {
              step_number: 2,
              label: 'MPE Boundary Check',
              description: 'Verify all corner errors are within maximum permissible error.',
              formula: '|E| ≤ MPE',
              values: { max_error: 0.01, mpe: 0.05 },
              result: 'PASS (0.010 kg ≤ 0.050 kg)',
            },
          ],
        },
      },
      {
        id: 'tp-demo-002-inst-weighing',
        test_plan_id: 'tp-demo-002',
        test_definition_id: 'td-weighing',
        test_code: 'ACC_WEIGHING',
        test_name: '3. Weighing Performance & Linearity Test',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.4',
        definition_desc: 'Determination of intrinsic weighing errors from Min to Max capacity under increasing and decreasing loads.',
        status: 'IN_PROGRESS',
        supported: true,
        execution_order: 3,
        decision: 'PENDING',
        observations: [
          { load_point: 1, reference_mass: 1, mass_unit: 'kg', indication_increasing: 1.0, indication_decreasing: 1.0, run_number: 1 },
          { load_point: 25, reference_mass: 25, mass_unit: 'kg', indication_increasing: 25.01, indication_decreasing: 25.01, run_number: 2 },
          { load_point: 75, reference_mass: 75, mass_unit: 'kg', indication_increasing: 75.02, indication_decreasing: 75.02, run_number: 3 },
          { load_point: 100, reference_mass: 100, mass_unit: 'kg', indication_increasing: 100.02, indication_decreasing: 100.02, run_number: 4 },
          { load_point: 150, reference_mass: 150, mass_unit: 'kg', indication_increasing: 150.03, indication_decreasing: 150.03, run_number: 5 },
        ],
        calculation: null,
      },
      {
        id: 'tp-demo-002-inst-tare',
        test_plan_id: 'tp-demo-002',
        test_definition_id: 'td-tare',
        test_code: 'TARE_ZERO',
        test_name: '4. Tare & Zero-Setting Test',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.5',
        definition_desc: 'Evaluation of zero-setting accuracy (≤ 0.25e) and tare balancing performance.',
        status: 'PENDING',
        supported: true,
        execution_order: 4,
        decision: 'PENDING',
        observations: [],
        calculation: null,
      },
    ],
    workflow_history: [
      {
        id: 'wh-002-1',
        test_plan_id: 'tp-demo-002',
        from_state: 'INSPECTION_SCHEDULED',
        to_state: 'SITE_VERIFIED',
        changed_by: 'usr-tester-001',
        changed_by_name: 'Amit Patel (Tester)',
        user_role: 'SUB_INSPECTOR',
        reason: 'GPS coordinates verified within 14.8m. On-site field testing initialized.',
        is_override: false,
        changed_at: '2025-02-16T10:30:00Z',
      },
    ],
  },

  // 3. DEMO-003 (Field Tests Completed / Pending Review)
  {
    id: 'tp-demo-003',
    test_plan_code: 'TP-DEMO-003',
    instrument_id: 'inst-demo-003',
    instrument_code: 'DEMO-003',
    applicant_name: 'Retail Counter Scale Corp',
    manufacturer: 'Retail Counter Scale',
    model_number: 'RC-210',
    instrument_type: 'Retail Price-Computing Counter Scale',
    accuracy_class: 'III',
    max_capacity: 30,
    capacity_unit: 'kg',
    verification_scale_interval_e: 5,
    scale_interval_unit: 'g',
    serial_number: 'SN-RC-210-3312',
    application_number: 'APP-2025-003',
    indicator_details: 'Dual customer-vendor VFD display',
    load_cell_details: 'High precision aluminum single point cell',
    rule_version_id: 'rule-oiml-r76-2006',
    rule_version_code: 'OIML R 76-1:2006',
    rule_title: 'Non-automatic weighing instruments - Metrological and technical requirements - Tests',
    requirement_text: 'Clause A.4 Testing Protocol (Class III Non-Automatic Weighing Instruments)',
    status: 'FIELD_TESTS_COMPLETED', // "Pending Review" status in workflow
    overall_decision: 'PASS',
    generated_at: '2025-02-18T09:00:00Z',
    updated_at: '2025-02-20T16:00:00Z',
    scheduled_date: '2025-02-20',
    site_address: 'Central Retail Market, Connaught Place, New Delhi 110001',
    target_latitude: 28.6304,
    target_longitude: 77.2177,
    geofence_radius_m: 500,
    verified_latitude: 28.6305,
    verified_longitude: 77.2178,
    verified_distance_m: 12.2,
    gps_verified_at: '2025-02-20T10:15:00Z',
    gps_status: 'IN_GEOFENCE',
    assigned_inspector_id: 'usr-inspector-001',
    assigned_inspector_name: 'Dr. Sunita Rao',
    assigned_sub_inspector_id: 'usr-tester-001',
    assigned_sub_inspector_name: 'Amit Patel (Tester)',
    assigned_engineer_id: 'usr-engineer-001',
    assigned_engineer_name: 'Vikram Sengupta',
    standard_weights: [
      {
        class_type: 'M1 Class Standard Mass Set',
        serial_number: 'STD-M1-2025-102',
        cert_number: 'NPL/CAL/2025/5512',
        expiry_date: '2026-12-31',
        uncertainty_value: 0.001,
      },
    ],
    standards_verified_by: 'usr-engineer-001',
    standards_verified_name: 'Vikram Sengupta',
    standards_verified_at: '2025-02-20T10:30:00Z',
    inspector_recommendation: 'RECOMMEND_APPROVAL',
    inspector_notes: 'All 4 Clause A.4 tests completed with 100% compliance within OIML R 76 Table 6 MPE limits.',
    test_instances: [
      {
        id: 'tp-demo-003-inst-repeatability',
        test_plan_id: 'tp-demo-003',
        test_definition_id: 'td-repeatability',
        test_code: 'REPEATABILITY',
        test_name: '1. Repeatability Test',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.6',
        definition_desc: 'Evaluation of measurement consistency under identical repeated test load applications at 50% Max.',
        status: 'COMPLETED',
        supported: true,
        execution_order: 1,
        decision: 'PASS',
        observations: [
          { load_point: 15, reference_mass: 15, mass_unit: 'kg', indication_increasing: 15.0, run_number: 1 },
          { load_point: 15, reference_mass: 15, mass_unit: 'kg', indication_increasing: 15.002, run_number: 2 },
          { load_point: 15, reference_mass: 15, mass_unit: 'kg', indication_increasing: 15.0, run_number: 3 },
          { load_point: 15, reference_mass: 15, mass_unit: 'kg', indication_increasing: 15.002, run_number: 4 },
          { load_point: 15, reference_mass: 15, mass_unit: 'kg', indication_increasing: 15.0, run_number: 5 },
        ],
        calculation: {
          id: 'calc-rep-003',
          test_instance_id: 'tp-demo-003-inst-repeatability',
          input_values: { runs: 5, load: 15 },
          formula_ref: 'Clause A.4.6.1',
          calculation_version: 'OIML R 76-1:2006',
          rule_version: 'v1.0.0',
          result_value: 0.002,
          applicable_mpe: 0.005,
          comparison_text: 'Maximum difference (0.002 kg) ≤ MPE (0.005 kg)',
          decision: 'PASS',
          calculated_at: '2025-02-20T11:00:00Z',
          calculation_steps: [
            {
              step_number: 1,
              label: 'Range Determination',
              description: 'Calculate span between max and min recorded indications.',
              formula: 'Δ = I_max - I_min',
              values: { I_max: 15.002, I_min: 15.0 },
              result: '0.002 kg',
            },
            {
              step_number: 2,
              label: 'MPE Tolerance Verification',
              description: 'Verify repeatability error does not exceed maximum permissible error.',
              formula: 'Δ ≤ MPE',
              values: { delta: 0.002, mpe: 0.005 },
              result: 'PASS (0.002 kg ≤ 0.005 kg)',
            },
          ],
        },
      },
      {
        id: 'tp-demo-003-inst-eccentricity',
        test_plan_id: 'tp-demo-003',
        test_definition_id: 'td-eccentricity',
        test_code: 'ECCENTRICITY',
        test_name: '2. Eccentricity Test (Off-Center Loading)',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.7',
        definition_desc: 'Evaluation of off-center loading on platter corners within 1/3 Max load points.',
        status: 'COMPLETED',
        supported: true,
        execution_order: 2,
        decision: 'PASS',
        observations: [
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', position_corner: 'Center', indication_increasing: 10.0, run_number: 1 },
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', position_corner: 'Front Left', indication_increasing: 10.002, run_number: 2 },
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', position_corner: 'Back Left', indication_increasing: 10.0, run_number: 3 },
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', position_corner: 'Back Right', indication_increasing: 9.999, run_number: 4 },
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', position_corner: 'Front Right', indication_increasing: 10.0, run_number: 5 },
        ],
        calculation: {
          id: 'calc-ecc-003',
          test_instance_id: 'tp-demo-003-inst-eccentricity',
          input_values: { load: 10 },
          formula_ref: 'Clause A.4.7.1',
          calculation_version: 'OIML R 76-1:2006',
          rule_version: 'v1.0.0',
          result_value: 0.002,
          applicable_mpe: 0.005,
          comparison_text: 'Maximum corner deviation (0.002 kg) ≤ MPE (0.005 kg)',
          decision: 'PASS',
          calculated_at: '2025-02-20T11:15:00Z',
          calculation_steps: [
            {
              step_number: 1,
              label: 'Corner Off-Center Error',
              description: 'Calculate intrinsic error for each quadrant corner.',
              formula: 'E = I - L',
              values: { max_error: 0.002 },
              result: '0.002 kg',
            },
            {
              step_number: 2,
              label: 'Tolerance Verification',
              description: 'Ensure corner errors do not exceed applicable MPE at 1/3 Max.',
              formula: '|E| ≤ MPE',
              values: { max_error: 0.002, mpe: 0.005 },
              result: 'PASS (0.002 kg ≤ 0.005 kg)',
            },
          ],
        },
      },
      {
        id: 'tp-demo-003-inst-weighing',
        test_plan_id: 'tp-demo-003',
        test_definition_id: 'td-weighing',
        test_code: 'ACC_WEIGHING',
        test_name: '3. Weighing Performance & Linearity Test',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.4',
        definition_desc: 'Determination of intrinsic weighing errors from Min to Max capacity under increasing and decreasing loads.',
        status: 'COMPLETED',
        supported: true,
        execution_order: 3,
        decision: 'PASS',
        observations: [
          { load_point: 0.1, reference_mass: 0.1, mass_unit: 'kg', indication_increasing: 0.1, indication_decreasing: 0.1, run_number: 1 },
          { load_point: 2.5, reference_mass: 2.5, mass_unit: 'kg', indication_increasing: 2.501, indication_decreasing: 2.501, run_number: 2 },
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', indication_increasing: 10.002, indication_decreasing: 10.002, run_number: 3 },
          { load_point: 20, reference_mass: 20, mass_unit: 'kg', indication_increasing: 20.003, indication_decreasing: 20.003, run_number: 4 },
          { load_point: 30, reference_mass: 30, mass_unit: 'kg', indication_increasing: 30.003, indication_decreasing: 30.003, run_number: 5 },
        ],
        calculation: {
          id: 'calc-weigh-003',
          test_instance_id: 'tp-demo-003-inst-weighing',
          input_values: { points: 5 },
          formula_ref: 'Clause A.4.4.1',
          calculation_version: 'OIML R 76-1:2006',
          rule_version: 'v1.0.0',
          result_value: 0.003,
          applicable_mpe: 0.0075,
          comparison_text: 'Maximum observed error (0.003 kg) ≤ MPE (0.0075 kg)',
          decision: 'PASS',
          calculated_at: '2025-02-20T11:40:00Z',
          calculation_steps: [
            {
              step_number: 1,
              label: 'Load Point Intrinsic Error Evaluation',
              description: 'Evaluate error E = I - L for increasing and decreasing test loads.',
              formula: 'E = I - L (Clause A.4.4.1)',
              values: { max_observed_error: 0.003 },
              result: '0.003 kg',
            },
            {
              step_number: 2,
              label: 'OIML Table 6 MPE Comparison',
              description: 'Verify errors fall within stepped MPE limits across 0-500e, 500e-2000e, and >2000e.',
              formula: '|E| ≤ MPE(m)',
              values: { max_error: 0.003, mpe: 0.0075 },
              result: 'PASS (All 5 points within MPE)',
            },
          ],
        },
      },
      {
        id: 'tp-demo-003-inst-tare',
        test_plan_id: 'tp-demo-003',
        test_definition_id: 'td-tare',
        test_code: 'TARE_ZERO',
        test_name: '4. Tare & Zero-Setting Test',
        category: 'Metrological Verification',
        standard_ref: 'OIML R 76-1:2006',
        oiml_clause: 'Clause A.4.5',
        definition_desc: 'Evaluation of zero-setting accuracy (≤ 0.25e) and tare balancing performance.',
        status: 'COMPLETED',
        supported: true,
        execution_order: 4,
        decision: 'PASS',
        observations: [
          { load_point: 0, reference_mass: 0, mass_unit: 'kg', position_corner: 'Zero Setting Check', indication_increasing: 0.0, tare_applied: 0, run_number: 1 },
          { load_point: 5, reference_mass: 5, mass_unit: 'kg', position_corner: 'Tare Preset 1 (16% Max)', indication_increasing: 5.001, tare_applied: 5, run_number: 2 },
          { load_point: 10, reference_mass: 10, mass_unit: 'kg', position_corner: 'Tare Preset 2 (33% Max)', indication_increasing: 10.001, tare_applied: 10, run_number: 3 },
        ],
        calculation: {
          id: 'calc-tare-003',
          test_instance_id: 'tp-demo-003-inst-tare',
          input_values: { tare_steps: 3 },
          formula_ref: 'Clause A.4.5.1',
          calculation_version: 'OIML R 76-1:2006',
          rule_version: 'v1.0.0',
          result_value: 0.001,
          applicable_mpe: 0.005,
          comparison_text: 'Zero-setting error (0.000 kg) ≤ 0.25e (0.00125 kg); Tare error ≤ MPE',
          decision: 'PASS',
          calculated_at: '2025-02-20T12:00:00Z',
          calculation_steps: [
            {
              step_number: 1,
              label: 'Zero-Setting Error Evaluation',
              description: 'Ensure zero indication deviation does not exceed 0.25e.',
              formula: 'E_zero ≤ 0.25 * e',
              values: { zero_error: 0.0, limit: 0.00125 },
              result: 'PASS (0.000 kg ≤ 0.00125 kg)',
            },
            {
              step_number: 2,
              label: 'Tare Balancing Verification',
              description: 'Verify net indications conform to MPE limits under preset tare.',
              formula: '|E_net| ≤ MPE',
              values: { max_tare_error: 0.001, mpe: 0.005 },
              result: 'PASS (0.001 kg ≤ 0.005 kg)',
            },
          ],
        },
      },
    ],
    workflow_history: [
      {
        id: 'wh-003-1',
        test_plan_id: 'tp-demo-003',
        from_state: 'INSPECTION_SCHEDULED',
        to_state: 'SITE_VERIFIED',
        changed_by: 'usr-tester-001',
        changed_by_name: 'Amit Patel (Tester)',
        user_role: 'SUB_INSPECTOR',
        reason: 'GPS on-site presence verified.',
        is_override: false,
        changed_at: '2025-02-20T10:15:00Z',
      },
      {
        id: 'wh-003-2',
        test_plan_id: 'tp-demo-003',
        from_state: 'SITE_VERIFIED',
        to_state: 'FIELD_TESTS_COMPLETED',
        changed_by: 'usr-tester-001',
        changed_by_name: 'Amit Patel (Tester)',
        user_role: 'SUB_INSPECTOR',
        reason: 'All 4 standard OIML tests executed and recorded. Ready for inspector recommendation.',
        is_override: false,
        changed_at: '2025-02-20T12:30:00Z',
      },
    ],
  },
];

// Initial Audit Logs
const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    user_id: 'usr-tester-001',
    user_email: 'subinspector@nawi.gov.in',
    user_role: 'SUB_INSPECTOR',
    action: 'TEST_CALCULATION_EXECUTED',
    entity_type: 'test_plan',
    entity_id: 'tp-demo-003',
    reason: 'Executed OIML R 76 Table 6 MPE calculations on Retail Counter Scale RC-210. Result: PASS.',
    ip_address: '10.0.4.12',
    timestamp: '2025-02-20T12:00:00Z',
  },
  {
    id: 'log-002',
    user_id: 'usr-tester-001',
    user_email: 'subinspector@nawi.gov.in',
    user_role: 'SUB_INSPECTOR',
    action: 'GPS_GEOFENCE_VERIFIED',
    entity_type: 'test_plan',
    entity_id: 'tp-demo-002',
    reason: 'Verified on-site GPS coordinates for Electronic Platform Scale EP-420. Distance: 14.8m.',
    ip_address: '10.0.4.12',
    timestamp: '2025-02-16T10:30:00Z',
  },
  {
    id: 'log-003',
    user_id: 'usr-inspector-001',
    user_email: 'inspector@nawi.gov.in',
    user_role: 'INSPECTOR',
    action: 'INSPECTION_SCHEDULED',
    entity_type: 'test_plan',
    entity_id: 'tp-demo-001',
    reason: 'Scheduled field inspection for Precision Test Mfr PT-7113. Assigned: Amit Patel (Tester).',
    ip_address: '10.0.2.88',
    timestamp: '2025-02-12T14:30:00Z',
  },
];

// Initial Certificate for demo-003
const INITIAL_REPORTS: FinalizedReport[] = [
  {
    id: 'rep-demo-003',
    report_number: 'DLM-CERT-2025-003',
    instrument_id: 'inst-demo-003',
    test_plan_id: 'tp-demo-003',
    rule_version_used: 'OIML R 76-1:2006',
    calculation_version_used: 'NAWI-CALC-v1.0.0',
    status: 'FINALIZED',
    reviewer_id: 'usr-inspector-001',
    reviewer_name: 'Dr. Sunita Rao',
    approving_authority_id: 'usr-admin-001',
    approving_authority_name: 'K. V. Ramanathan',
    summary: 'Conforms to Legal Metrology Act and OIML R 76-1:2006 standards for Class III Non-Automatic Weighing Instruments.',
    finalized_at: '2025-02-21T10:00:00Z',
    created_at: '2025-02-21T10:00:00Z',
    instrument_code: 'DEMO-003',
    applicant_name: 'Retail Counter Scale Corp',
    manufacturer: 'Retail Counter Scale',
    model_number: 'RC-210',
    instrument_type: 'Retail Price-Computing Counter Scale',
    accuracy_class: 'III',
    max_capacity: 30,
    capacity_unit: 'kg',
    verification_scale_interval_e: 5,
    scale_interval_unit: 'g',
    serial_number: 'SN-RC-210-3312',
    application_number: 'APP-2025-003',
    indicator_details: 'Dual customer-vendor VFD display',
    load_cell_details: 'High precision aluminum single point cell',
    verification_id: 'V-2025-003-RC210',
    sha256_hash: '9a5c812d3b4e7f601a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
    overall_decision: 'PASS',
  },
];

interface DemoStorageState {
  instruments: Instrument[];
  testPlans: TestPlan[];
  reports: FinalizedReport[];
  auditLogs: AuditLog[];
}

class DemoDataStore {
  private state: DemoStorageState;

  constructor() {
    this.state = this.loadFromStorage();
  }

  private loadFromStorage(): DemoStorageState {
    if (typeof window === 'undefined') {
      return {
        instruments: INITIAL_INSTRUMENTS,
        testPlans: INITIAL_TEST_PLANS,
        reports: INITIAL_REPORTS,
        auditLogs: INITIAL_AUDIT_LOGS,
      };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.instruments) && parsed.instruments.length >= 3) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read demo storage, resetting to initial 3 records.', e);
    }

    const initial = {
      instruments: INITIAL_INSTRUMENTS,
      testPlans: INITIAL_TEST_PLANS,
      reports: INITIAL_REPORTS,
      auditLogs: INITIAL_AUDIT_LOGS,
    };
    this.persist(initial);
    return initial;
  }

  private persist(state: DemoStorageState) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to persist demo state:', e);
      }
    }
  }

  public resetToDefault() {
    this.state = {
      instruments: JSON.parse(JSON.stringify(INITIAL_INSTRUMENTS)),
      testPlans: JSON.parse(JSON.stringify(INITIAL_TEST_PLANS)),
      reports: JSON.parse(JSON.stringify(INITIAL_REPORTS)),
      auditLogs: JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS)),
    };
    this.persist(this.state);
  }

  // ---------------- AUTH ----------------
  public async login(credentials: { email: string; password?: string }): Promise<{ token: string; user: User }> {
    const emailNorm = credentials.email.toLowerCase().trim();
    let found = DEMO_USERS.find((u) => u.email.toLowerCase() === emailNorm);

    // Also support tester alias
    if (!found && (emailNorm === 'tester@nawi.gov.in' || emailNorm.includes('tester') || emailNorm.includes('subinspector'))) {
      found = DEMO_USERS.find((u) => u.role === 'SUB_INSPECTOR');
    }

    if (!found) {
      // Default to owner if email matches owner, otherwise check other prefixes
      if (emailNorm.includes('admin')) found = DEMO_USERS.find((u) => u.role === 'ADMIN');
      else if (emailNorm.includes('inspector')) found = DEMO_USERS.find((u) => u.role === 'INSPECTOR');
      else if (emailNorm.includes('engineer')) found = DEMO_USERS.find((u) => u.role === 'ENGINEER');
      else found = DEMO_USERS[0];
    }

    const token = `demo-token-${found.id}-${Date.now()}`;
    return { token, user: found };
  }

  public async getCurrentUser(token?: string | null): Promise<{ user: User }> {
    if (token) {
      const match = token.match(/demo-token-(usr-[a-z0-9-]+)/);
      if (match) {
        const user = DEMO_USERS.find((u) => u.id === match[1]);
        if (user) return { user };
      }
    }
    // Default to tester or admin
    return { user: DEMO_USERS[1] }; // Default tester
  }

  public async getUsers(): Promise<User[]> {
    return DEMO_USERS;
  }

  // ---------------- INSTRUMENTS ----------------
  public async getInstruments(params?: { search?: string; accuracy_class?: string; status?: string; created_by?: string }): Promise<Instrument[]> {
    let list = [...this.state.instruments];

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.instrument_code.toLowerCase().includes(q) ||
          i.model_number.toLowerCase().includes(q) ||
          i.applicant_name.toLowerCase().includes(q) ||
          i.manufacturer.toLowerCase().includes(q)
      );
    }

    if (params?.accuracy_class) {
      list = list.filter((i) => i.accuracy_class === params.accuracy_class);
    }

    if (params?.status) {
      list = list.filter((i) => i.test_plan_status === params.status);
    }

    return list;
  }

  public async getInstrumentById(id: string): Promise<Instrument & { configs: any[]; test_plans: any[] }> {
    const inst = this.state.instruments.find((i) => i.id === id || i.instrument_code === id);
    if (!inst) {
      throw new Error(`Instrument ${id} not found.`);
    }

    const tp = this.state.testPlans.filter((p) => p.instrument_id === inst.id);
    return {
      ...inst,
      configs: [
        {
          id: `cfg-${inst.id}`,
          instrument_id: inst.id,
          max_capacity: inst.max_capacity,
          capacity_unit: inst.capacity_unit,
          verification_scale_interval_e: inst.verification_scale_interval_e,
          scale_interval_unit: inst.scale_interval_unit,
        },
      ],
      test_plans: tp,
    };
  }

  public async registerInstrument(data: Partial<Instrument>): Promise<{ message: string; instrument_id: string; instrument_code: string; scale_intervals_n: number }> {
    const count = this.state.instruments.length + 1;
    const code = `DEMO-00${count}`;
    const newId = `inst-demo-00${count}`;
    const planId = `tp-demo-00${count}`;

    const maxCap = Number(data.max_capacity) || 30;
    const eVal = Number(data.verification_scale_interval_e) || 10;
    const eUnit = data.scale_interval_unit || 'g';
    const capUnit = data.capacity_unit || 'kg';

    // Scale interval count n = Max / e
    const maxInEUnit = capUnit === 'kg' && eUnit === 'g' ? maxCap * 1000 : maxCap;
    const scaleIntervalsN = Math.round(maxInEUnit / eVal);

    const newInst: Instrument = {
      id: newId,
      instrument_code: code,
      applicant_name: data.applicant_name || 'Authorized Instrument Owner',
      manufacturer: data.manufacturer || 'Metrology Scale Mfr',
      model_number: data.model_number || `MS-${Math.floor(100 + Math.random() * 900)}`,
      instrument_type: data.instrument_type || 'Electronic Weighing Instrument',
      accuracy_class: (data.accuracy_class as any) || 'III',
      max_capacity: maxCap,
      capacity_unit: capUnit,
      verification_scale_interval_e: eVal,
      scale_interval_unit: eUnit,
      serial_number: data.serial_number || `SN-${code}-${Date.now().toString().slice(-4)}`,
      application_number: `APP-2025-00${count}`,
      indicator_details: data.indicator_details || 'Standard Digital Metrology Terminal',
      load_cell_details: data.load_cell_details || 'Certified OIML strain gauge transducer',
      created_by: 'usr-owner-001',
      created_by_name: 'Rajesh Sharma',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      test_plan_id: planId,
      test_plan_code: `TP-${code}`,
      test_plan_status: 'INSPECTION_SCHEDULED',
    };

    const newPlan: TestPlan = {
      id: planId,
      test_plan_code: `TP-${code}`,
      instrument_id: newId,
      instrument_code: code,
      applicant_name: newInst.applicant_name,
      manufacturer: newInst.manufacturer,
      model_number: newInst.model_number,
      instrument_type: newInst.instrument_type,
      accuracy_class: newInst.accuracy_class,
      max_capacity: newInst.max_capacity,
      capacity_unit: newInst.capacity_unit,
      verification_scale_interval_e: newInst.verification_scale_interval_e,
      scale_interval_unit: newInst.scale_interval_unit,
      serial_number: newInst.serial_number,
      application_number: newInst.application_number,
      indicator_details: newInst.indicator_details,
      load_cell_details: newInst.load_cell_details,
      rule_version_id: 'rule-oiml-r76-2006',
      rule_version_code: 'OIML R 76-1:2006',
      rule_title: 'Non-automatic weighing instruments - Metrological requirements',
      requirement_text: 'Clause A.4 Testing Protocol (Class III NAWI)',
      status: 'INSPECTION_SCHEDULED',
      overall_decision: 'PENDING',
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scheduled_date: new Date().toISOString().split('T')[0],
      site_address: 'Delhi Regional Metrology Laboratory, Sector 12, New Delhi 110001',
      target_latitude: 28.6139,
      target_longitude: 77.2090,
      geofence_radius_m: 500,
      assigned_inspector_id: 'usr-inspector-001',
      assigned_inspector_name: 'Dr. Sunita Rao',
      assigned_sub_inspector_id: 'usr-tester-001',
      assigned_sub_inspector_name: 'Amit Patel (Tester)',
      gps_status: 'PENDING',
      test_instances: createStandardTestInstances(planId, maxCap, eVal, eUnit, capUnit),
      workflow_history: [
        {
          id: `wh-${newId}-1`,
          test_plan_id: planId,
          from_state: 'DRAFT',
          to_state: 'INSPECTION_SCHEDULED',
          changed_by: 'usr-owner-001',
          changed_by_name: 'Rajesh Sharma',
          user_role: 'APPLICANT',
          reason: 'Application registered and test plan initialized.',
          is_override: false,
          changed_at: new Date().toISOString(),
        },
      ],
    };

    this.state.instruments.unshift(newInst);
    this.state.testPlans.unshift(newPlan);
    this.persist(this.state);

    return {
      message: 'Instrument and evaluation test plan created successfully.',
      instrument_id: newId,
      instrument_code: code,
      scale_intervals_n: scaleIntervalsN,
    };
  }

  // ---------------- TEST PLANS ----------------
  public async getTestPlans(params?: {
    status?: string;
    search?: string;
    assigned_sub_inspector_id?: string;
    assigned_inspector_id?: string;
    assigned_engineer_id?: string;
    created_by?: string;
  }): Promise<TestPlan[]> {
    let list = [...this.state.testPlans];

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.test_plan_code.toLowerCase().includes(q) ||
          p.instrument_code?.toLowerCase().includes(q) ||
          p.applicant_name?.toLowerCase().includes(q) ||
          p.model_number?.toLowerCase().includes(q)
      );
    }

    if (params?.status) {
      list = list.filter((p) => p.status === params.status);
    }

    return list;
  }

  public async getTestPlanById(id: string): Promise<TestPlan> {
    const plan = this.state.testPlans.find(
      (p) => p.id === id || p.test_plan_code === id || p.instrument_id === id || p.instrument_code === id
    );
    if (!plan) {
      throw new Error(`Test plan ${id} not found.`);
    }
    return plan;
  }

  public async generateTestPlan(instrument_id: string): Promise<{ message: string; test_plan_id: string; test_plan_code: string }> {
    const inst = this.state.instruments.find((i) => i.id === instrument_id || i.instrument_code === instrument_id);
    if (!inst) throw new Error(`Instrument ${instrument_id} not found.`);

    if (inst.test_plan_id) {
      return {
        message: 'Test plan already exists.',
        test_plan_id: inst.test_plan_id,
        test_plan_code: inst.test_plan_code || 'TP-001',
      };
    }

    const planId = `tp-${inst.id}`;
    const planCode = `TP-${inst.instrument_code}`;
    const newPlan: TestPlan = {
      id: planId,
      test_plan_code: planCode,
      instrument_id: inst.id,
      instrument_code: inst.instrument_code,
      applicant_name: inst.applicant_name,
      manufacturer: inst.manufacturer,
      model_number: inst.model_number,
      accuracy_class: inst.accuracy_class,
      max_capacity: inst.max_capacity,
      capacity_unit: inst.capacity_unit,
      verification_scale_interval_e: inst.verification_scale_interval_e,
      scale_interval_unit: inst.scale_interval_unit,
      status: 'INSPECTION_SCHEDULED',
      overall_decision: 'PENDING',
      rule_version_id: 'rule-oiml-r76-2006',
      rule_version_code: 'OIML R 76-1:2006',
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      test_instances: createStandardTestInstances(
        planId,
        inst.max_capacity,
        inst.verification_scale_interval_e,
        inst.scale_interval_unit,
        inst.capacity_unit
      ),
    };

    inst.test_plan_id = planId;
    inst.test_plan_code = planCode;
    inst.test_plan_status = 'INSPECTION_SCHEDULED';

    this.state.testPlans.push(newPlan);
    this.persist(this.state);

    return {
      message: 'Generated OIML R 76-1 applicable test plan.',
      test_plan_id: planId,
      test_plan_code: planCode,
    };
  }

  public async scheduleInspection(testPlanId: string, data: any): Promise<{ message: string }> {
    const plan = await this.getTestPlanById(testPlanId);
    plan.scheduled_date = data.scheduled_date || plan.scheduled_date;
    plan.site_address = data.site_address || plan.site_address;
    plan.target_latitude = data.target_latitude || plan.target_latitude;
    plan.target_longitude = data.target_longitude || plan.target_longitude;
    plan.geofence_radius_m = data.geofence_radius_m || plan.geofence_radius_m;
    plan.updated_at = new Date().toISOString();

    this.persist(this.state);
    return { message: 'Field inspection scheduled and geofence perimeter configured.' };
  }

  public async verifySiteGPS(testPlanId: string, coords: { latitude: number; longitude: number }): Promise<{ message: string; distance_m: number }> {
    const plan = await this.getTestPlanById(testPlanId);
    plan.verified_latitude = coords.latitude;
    plan.verified_longitude = coords.longitude;
    plan.verified_distance_m = 15.4;
    plan.gps_status = 'IN_GEOFENCE';
    plan.gps_verified_at = new Date().toISOString();

    if (plan.status === 'INSPECTION_SCHEDULED') {
      plan.status = 'SITE_VERIFIED';
      // Sync instrument
      const inst = this.state.instruments.find((i) => i.id === plan.instrument_id);
      if (inst) inst.test_plan_status = 'SITE_VERIFIED';

      plan.workflow_history = plan.workflow_history || [];
      plan.workflow_history.push({
        id: `wh-${Date.now()}`,
        test_plan_id: plan.id,
        from_state: 'INSPECTION_SCHEDULED',
        to_state: 'SITE_VERIFIED',
        changed_by: 'usr-tester-001',
        changed_by_name: 'Amit Patel (Tester)',
        user_role: 'SUB_INSPECTOR',
        reason: 'Live GPS geofence match verified (15.4m distance from registered site).',
        is_override: false,
        changed_at: new Date().toISOString(),
      });
    }

    this.persist(this.state);
    return {
      message: 'On-site GPS coordinates verified within permitted 500m geofence.',
      distance_m: 15.4,
    };
  }

  public async verifyPhoto(testPlanId: string, photo_url: string): Promise<{ message: string }> {
    const plan = await this.getTestPlanById(testPlanId);
    plan.photo_verification_url = photo_url;
    plan.photo_verified_at = new Date().toISOString();
    this.persist(this.state);
    return { message: 'Officer on-site identity selfie and instrument photo recorded.' };
  }

  public async verifyStandards(testPlanId: string, standard_weights: any[]): Promise<{ message: string }> {
    const plan = await this.getTestPlanById(testPlanId);
    plan.standard_weights = standard_weights;
    plan.standards_verified_by = 'usr-engineer-001';
    plan.standards_verified_name = 'Vikram Sengupta (Engineer)';
    plan.standards_verified_at = new Date().toISOString();
    this.persist(this.state);
    return { message: 'Standard weights set verified and certified conforming.' };
  }

  public async saveObservations(testPlanId: string, testInstanceId: string, observations: Observation[]): Promise<{ message: string; count: number }> {
    const plan = await this.getTestPlanById(testPlanId);
    const inst = plan.test_instances?.find((i) => i.id === testInstanceId || i.test_code === testInstanceId);
    if (!inst) throw new Error(`Test instance ${testInstanceId} not found.`);

    inst.observations = observations.map((obs, idx) => ({
      ...obs,
      run_number: obs.run_number || idx + 1,
    }));
    inst.status = 'IN_PROGRESS';
    plan.updated_at = new Date().toISOString();

    this.persist(this.state);
    return { message: 'Raw test observations saved to local metrology store.', count: observations.length };
  }

  public async calculateTest(testPlanId: string, testInstanceId: string): Promise<{ decision: 'PASS' | 'FAIL'; calculation: Calculation }> {
    const plan = await this.getTestPlanById(testPlanId);
    const inst = plan.test_instances?.find((i) => i.id === testInstanceId || i.test_code === testInstanceId);
    if (!inst) throw new Error(`Test instance ${testInstanceId} not found.`);

    const obs = inst.observations || [];
    if (obs.length === 0) {
      throw new Error('No observations entered. Please add or pre-fill observation rows first.');
    }

    const accuracyClass = plan.accuracy_class || 'III';
    const eVal = plan.verification_scale_interval_e || 10;
    const eUnit = plan.scale_interval_unit || 'g';
    const capUnit = plan.capacity_unit || 'kg';

    let decision: 'PASS' | 'FAIL' = 'PASS';
    let maxErrorObserved = 0;
    let worstCaseLimit = 0;
    let comparisonText = '';
    const steps: CalculationStep[] = [];

    // Step 1: Instrument parameters
    steps.push({
      step_number: 1,
      label: 'Instrument Metrological Parameter Extraction',
      description: 'Extract Class, Maximum Capacity (Max), and Verification Scale Interval (e).',
      formula: 'e = Verification Scale Interval (OIML R 76-1:2006 Clause 3.2)',
      values: {
        accuracy_class: accuracyClass,
        max_capacity: `${plan.max_capacity} ${capUnit}`,
        verification_scale_interval_e: `${eVal} ${eUnit}`,
      },
      result: `Accuracy Class ${accuracyClass} with e = ${eVal} ${eUnit}`,
    });

    if (inst.test_code === 'REPEATABILITY') {
      // Repeatability calculation: difference between max and min indication at 50% Max
      const values = obs.map((o) => o.indication_increasing ?? o.reference_mass);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const delta = Number((maxVal - minVal).toFixed(4));

      // MPE for repeatability load (50% Max)
      const halfMax = (plan.max_capacity || 30) * 0.5;
      const halfMaxInE = (capUnit === 'kg' && eUnit === 'g' ? halfMax * 1000 : halfMax) / eVal;
      const mpeE = computeMpeInE(accuracyClass, halfMaxInE);
      const mpeInKg = (mpeE * eVal) / (capUnit === 'kg' && eUnit === 'g' ? 1000 : 1);

      maxErrorObserved = delta;
      worstCaseLimit = mpeInKg;
      decision = delta <= mpeInKg ? 'PASS' : 'FAIL';
      comparisonText = `Maximum indication span (${delta} ${capUnit}) ${delta <= mpeInKg ? '≤' : '>'} MPE (${mpeInKg.toFixed(4)} ${capUnit})`;

      steps.push({
        step_number: 2,
        label: 'Repeatability Span Calculation',
        description: 'Calculate span between maximum and minimum recorded indications across runs.',
        formula: 'Δ = I_max - I_min (Clause A.4.6.1)',
        values: { I_max: maxVal, I_min: minVal },
        result: `${delta} ${capUnit}`,
      });
      steps.push({
        step_number: 3,
        label: 'MPE Limit Evaluation',
        description: 'Compare span against maximum permissible error for load.',
        formula: `Δ ≤ |MPE| (${mpeInKg.toFixed(4)} ${capUnit})`,
        values: { delta, mpe: mpeInKg },
        result: `${decision} (${comparisonText})`,
      });
    } else if (inst.test_code === 'ECCENTRICITY') {
      // Eccentricity calculation: error at each corner loaded with 1/3 Max
      const load = obs[0]?.reference_mass || (plan.max_capacity || 30) / 3;
      const loadInE = (capUnit === 'kg' && eUnit === 'g' ? load * 1000 : load) / eVal;
      const mpeE = computeMpeInE(accuracyClass, loadInE);
      const mpeInKg = (mpeE * eVal) / (capUnit === 'kg' && eUnit === 'g' ? 1000 : 1);

      let maxCornerErr = 0;
      obs.forEach((o) => {
        const ind = o.indication_increasing ?? o.reference_mass;
        const err = Math.abs(ind - o.reference_mass);
        if (err > maxCornerErr) maxCornerErr = err;
      });

      maxErrorObserved = Number(maxCornerErr.toFixed(4));
      worstCaseLimit = mpeInKg;
      decision = maxCornerErr <= mpeInKg ? 'PASS' : 'FAIL';
      comparisonText = `Maximum corner error (${maxCornerErr.toFixed(4)} ${capUnit}) ${maxCornerErr <= mpeInKg ? '≤' : '>'} MPE (${mpeInKg.toFixed(4)} ${capUnit})`;

      steps.push({
        step_number: 2,
        label: 'Corner Off-Center Error Analysis',
        description: 'Calculate error E = I - L at each platform corner position.',
        formula: 'E = I - L (Clause A.4.7.1)',
        values: { corners_tested: obs.length, max_error: maxCornerErr },
        result: `${maxCornerErr.toFixed(4)} ${capUnit}`,
      });
      steps.push({
        step_number: 3,
        label: 'OIML R 76 Table 6 MPE Verification',
        description: 'Verify all corner errors are within permitted tolerance at 1/3 Max.',
        formula: '|E| ≤ MPE(1/3 Max)',
        values: { maxCornerErr, mpeInKg },
        result: `${decision} (${comparisonText})`,
      });
    } else if (inst.test_code === 'TARE_ZERO') {
      // Tare & zero setting test
      let maxTareErr = 0;
      obs.forEach((o) => {
        const ind = o.indication_increasing ?? o.reference_mass;
        const err = Math.abs(ind - o.reference_mass);
        if (err > maxTareErr) maxTareErr = err;
      });

      const zeroE = computeMpeInE(accuracyClass, 0) * 0.5; // 0.25e to 0.5e
      const mpeInKg = (zeroE * eVal) / (capUnit === 'kg' && eUnit === 'g' ? 1000 : 1);

      maxErrorObserved = Number(maxTareErr.toFixed(4));
      worstCaseLimit = mpeInKg;
      decision = maxTareErr <= mpeInKg ? 'PASS' : 'FAIL';
      comparisonText = `Tare/Zero error (${maxTareErr.toFixed(4)} ${capUnit}) ${maxTareErr <= mpeInKg ? '≤' : '>'} Limit (${mpeInKg.toFixed(4)} ${capUnit})`;

      steps.push({
        step_number: 2,
        label: 'Zero & Tare Indication Evaluation',
        description: 'Calculate zero balancing and tare preset error deviations.',
        formula: 'E_tare = I_net - L_net (Clause A.4.5.1)',
        values: { maxTareErr },
        result: `${maxTareErr.toFixed(4)} ${capUnit}`,
      });
      steps.push({
        step_number: 3,
        label: 'Zero Tolerance Compliance',
        description: 'Verify zero setting accuracy is within ≤ 0.25e and tare indications within MPE.',
        formula: '|E| ≤ MPE_tare',
        values: { maxTareErr, limit: mpeInKg },
        result: `${decision} (${comparisonText})`,
      });
    } else {
      // Weighing Performance / Linearity (ACC_WEIGHING)
      let overallPass = true;
      let worstDiff = 0;
      let worstMpe = 0;

      obs.forEach((o, idx) => {
        const mass = o.reference_mass;
        const massInE = (capUnit === 'kg' && eUnit === 'g' ? mass * 1000 : mass) / eVal;
        const mpeE = computeMpeInE(accuracyClass, massInE);
        const mpeKg = (mpeE * eVal) / (capUnit === 'kg' && eUnit === 'g' ? 1000 : 1);

        const indInc = o.indication_increasing ?? mass;
        const errInc = Math.abs(indInc - mass);

        const indDec = o.indication_decreasing ?? mass;
        const errDec = Math.abs(indDec - mass);

        const maxPointErr = Math.max(errInc, errDec);
        if (maxPointErr > mpeKg) {
          overallPass = false;
        }

        if (maxPointErr > worstDiff) {
          worstDiff = maxPointErr;
          worstMpe = mpeKg;
        }
      });

      decision = overallPass ? 'PASS' : 'FAIL';
      maxErrorObserved = Number(worstDiff.toFixed(4));
      worstCaseLimit = worstMpe;
      comparisonText = `Maximum observed error (${worstDiff.toFixed(4)} ${capUnit}) ${overallPass ? '≤' : '>'} MPE (${worstMpe.toFixed(4)} ${capUnit})`;

      steps.push({
        step_number: 2,
        label: 'Intrinsic Error Curve Calculation',
        description: 'Calculate error E = I - L for increasing and decreasing test loads across all test points.',
        formula: 'E = I - L (Clause A.4.4.1)',
        values: { points_tested: obs.length, worst_error: worstDiff },
        result: `${worstDiff.toFixed(4)} ${capUnit}`,
      });
      steps.push({
        step_number: 3,
        label: 'OIML R 76-1 Table 6 Stepped MPE Comparison',
        description: 'Check errors against stepped MPE (0-500e: ±0.5e, 500e-2000e: ±1.0e, >2000e: ±1.5e).',
        formula: '|E| ≤ MPE(m)',
        values: { max_error: worstDiff, mpe_limit: worstMpe },
        result: `${decision} (${comparisonText})`,
      });
    }

    const calculation: Calculation = {
      id: `calc-${inst.id}-${Date.now()}`,
      test_instance_id: inst.id,
      input_values: { obsCount: obs.length },
      formula_ref: 'OIML R 76-1:2006 Clause A.4',
      calculation_version: 'OIML R 76-1:2006',
      rule_version: 'v1.0.0',
      result_value: maxErrorObserved,
      applicable_mpe: worstCaseLimit,
      comparison_text: comparisonText,
      decision,
      calculated_at: new Date().toISOString(),
      calculation_steps: steps,
    };

    inst.decision = decision;
    inst.status = 'COMPLETED';
    inst.calculation = calculation;

    // Check if all tests completed
    const allInstances = plan.test_instances || [];
    const allPassed = allInstances.every((i) => i.decision === 'PASS');
    const anyFailed = allInstances.some((i) => i.decision === 'FAIL');

    if (allPassed) {
      plan.overall_decision = 'PASS';
    } else if (anyFailed) {
      plan.overall_decision = 'FAIL';
    }

    this.persist(this.state);
    return { decision, calculation };
  }

  public async transitionWorkflow(
    testPlanId: string,
    toState: string,
    reason?: string,
    isOverride?: boolean
  ): Promise<{ success: boolean; message: string; from_state: string; to_state: string }> {
    const plan = await this.getTestPlanById(testPlanId);
    const fromState = plan.status;

    plan.status = toState as WorkflowStatus;
    plan.updated_at = new Date().toISOString();

    // Sync instrument status
    const inst = this.state.instruments.find((i) => i.id === plan.instrument_id);
    if (inst) {
      inst.test_plan_status = toState as WorkflowStatus;
    }

    plan.workflow_history = plan.workflow_history || [];
    plan.workflow_history.push({
      id: `wh-${Date.now()}`,
      test_plan_id: plan.id,
      from_state: fromState,
      to_state: toState as WorkflowStatus,
      changed_by: 'usr-tester-001',
      changed_by_name: 'Metrology Authorized Officer',
      user_role: 'SUB_INSPECTOR',
      reason: reason || `Workflow advanced from ${fromState} to ${toState}.`,
      is_override: isOverride ? 1 : 0,
      changed_at: new Date().toISOString(),
    });

    this.persist(this.state);
    return {
      success: true,
      message: `Workflow state updated to ${toState}.`,
      from_state: fromState,
      to_state: toState,
    };
  }

  public async submitInspectorReview(testPlanId: string, data: { recommendation: string; notes?: string }): Promise<{ message: string }> {
    const plan = await this.getTestPlanById(testPlanId);
    plan.inspector_recommendation = data.recommendation as any;
    plan.inspector_notes = data.notes;
    plan.inspector_reviewed_at = new Date().toISOString();

    if (data.recommendation === 'RECOMMEND_APPROVAL') {
      plan.status = 'INSPECTOR_RECOMMENDED';
    } else if (data.recommendation === 'CORRECTION_REQUIRED') {
      plan.status = 'CORRECTION_REQUIRED';
    } else {
      plan.status = 'REJECTED';
    }

    const inst = this.state.instruments.find((i) => i.id === plan.instrument_id);
    if (inst) inst.test_plan_status = plan.status;

    this.persist(this.state);
    return { message: 'Lead Inspector recommendation recorded.' };
  }

  // ---------------- REPORTS & CERTIFICATES ----------------
  public async getReports(search?: string): Promise<FinalizedReport[]> {
    let list = [...this.state.reports];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.report_number.toLowerCase().includes(q) ||
          r.instrument_code?.toLowerCase().includes(q) ||
          r.applicant_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public async getReportById(id: string): Promise<FinalizedReport> {
    const rep = this.state.reports.find((r) => r.id === id || r.report_number === id || r.verification_id === id);
    if (!rep) throw new Error(`Report ${id} not found.`);
    return rep;
  }

  public async finalizeReport(testPlanId: string, summaryNotes?: string): Promise<{
    message: string;
    report_id: string;
    report_number: string;
    verification_id: string;
    sha256_hash: string;
    qr_code_data_url: string;
  }> {
    const plan = await this.getTestPlanById(testPlanId);
    const count = this.state.reports.length + 1;
    const reportNum = `DLM-CERT-2025-00${count}`;
    const vId = `V-2025-00${count}-${plan.instrument_code || 'DEMO'}`;
    const repId = `rep-demo-00${count}`;
    const hash = 'a8f5b2c7e19d3042b8e4f1a6c9d2e7f3b8a1c4e6d9f2b5a8c1e4d7f0b3a6c9e2';

    const newReport: FinalizedReport = {
      id: repId,
      report_number: reportNum,
      instrument_id: plan.instrument_id,
      test_plan_id: plan.id,
      rule_version_used: 'OIML R 76-1:2006',
      calculation_version_used: 'NAWI-CALC-v1.0.0',
      status: 'FINALIZED',
      reviewer_id: 'usr-inspector-001',
      reviewer_name: 'Dr. Sunita Rao',
      approving_authority_id: 'usr-admin-001',
      approving_authority_name: 'K. V. Ramanathan',
      summary: summaryNotes || 'Officially verified and sealed under the Legal Metrology Act and OIML R 76-1:2006 requirements.',
      finalized_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      instrument_code: plan.instrument_code,
      applicant_name: plan.applicant_name,
      manufacturer: plan.manufacturer,
      model_number: plan.model_number,
      instrument_type: plan.instrument_type,
      accuracy_class: plan.accuracy_class,
      max_capacity: plan.max_capacity,
      capacity_unit: plan.capacity_unit,
      verification_scale_interval_e: plan.verification_scale_interval_e,
      scale_interval_unit: plan.scale_interval_unit,
      serial_number: plan.serial_number,
      application_number: plan.application_number,
      indicator_details: plan.indicator_details,
      load_cell_details: plan.load_cell_details,
      verification_id: vId,
      sha256_hash: hash,
      overall_decision: 'PASS',
      test_instances: plan.test_instances,
    };

    plan.status = 'FINALIZED';
    const inst = this.state.instruments.find((i) => i.id === plan.instrument_id);
    if (inst) inst.test_plan_status = 'FINALIZED';

    this.state.reports.unshift(newReport);
    this.persist(this.state);

    return {
      message: 'Certificate officially approved and cryptographically sealed.',
      report_id: repId,
      report_number: reportNum,
      verification_id: vId,
      sha256_hash: hash,
      qr_code_data_url: '',
    };
  }

  public async getVerificationRecord(verificationId: string): Promise<any> {
    const rep = this.state.reports.find(
      (r) => r.verification_id?.toLowerCase() === verificationId.toLowerCase() || r.report_number.toLowerCase() === verificationId.toLowerCase()
    );
    if (rep) {
      return {
        valid: true,
        report: rep,
        message: 'Cryptographically Verified Digital Certificate',
      };
    }

    return {
      valid: false,
      message: 'Certificate verification ID was not found in the national registry.',
    };
  }

  // ---------------- AUDIT LOGS ----------------
  public async getAuditLogs(params?: { entity_type?: string; entity_id?: string; action?: string; search?: string; limit?: number }): Promise<AuditLog[]> {
    let list = [...this.state.auditLogs];
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((l) => l.action.toLowerCase().includes(q) || (l.reason && l.reason.toLowerCase().includes(q)));
    }
    return list;
  }

  // ---------------- RULES ----------------
  public async getRules(): Promise<RuleVersion[]> {
    return [
      {
        id: 'rule-oiml-r76-2006',
        version_code: 'OIML R 76-1:2006',
        title: 'Non-automatic weighing instruments - Metrological and technical requirements - Tests',
        description: 'International Recommendation for Non-Automatic Weighing Instruments including Class I, II, III, IIII test procedures.',
        effective_date: '2006-10-01',
        active: 1,
      },
    ];
  }
}

export const demoStore = new DemoDataStore();
