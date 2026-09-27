export type RoleName =
  | 'ADMIN'
  | 'INSPECTOR'
  | 'TESTER'
  | 'SUB_INSPECTOR'
  | 'ENGINEER'
  | 'OWNER'
  | 'APPLICANT'
  | 'EVALUATOR'
  | 'REVIEWER'
  | 'APPROVING_AUTHORITY'
  | 'READ_ONLY';

export type WorkflowStatus =
  | 'DRAFT'
  | 'APPLICATION_SUBMITTED'
  | 'INSPECTION_SCHEDULED'
  | 'SITE_VERIFIED'
  | 'STANDARDS_VERIFIED'
  | 'FIELD_TESTS_COMPLETED'
  | 'INSPECTOR_RECOMMENDED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'APPROVED'
  | 'FINALIZED'
  | 'REJECTED';

export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';

export interface StandardWeightSet {
  class_type: string;
  serial_number: string;
  cert_number: string;
  expiry_date: string;
  uncertainty_value: number;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: RoleName;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | string;
  created_at: string;
  updated_at: string;
  designation?: string;
  organization?: string;
}

export interface User {
  id: string;
  user_id?: string;
  email: string;
  full_name: string;
  designation?: string;
  organization?: string;
  role: RoleName;
  roles: RoleName[];
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Instrument {
  id: string;
  instrument_code: string;
  applicant_name: string;
  manufacturer: string;
  model_number: string;
  instrument_type: string;
  accuracy_class: AccuracyClass;
  max_capacity: number;
  capacity_unit: string;
  verification_scale_interval_e: number;
  scale_interval_unit: string;
  serial_number: string;
  indicator_details?: string;
  load_cell_details?: string;
  application_number: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  test_plan_id?: string;
  test_plan_status?: WorkflowStatus;
  test_plan_code?: string;
}

export interface Observation {
  id?: string;
  test_instance_id?: string;
  load_point: number;
  reference_mass: number;
  mass_unit: string;
  indication_increasing?: number | null;
  indication_decreasing?: number | null;
  delta_l?: number;
  position_corner?: string;
  run_number?: number;
  tare_applied?: number;
  temp_celsius?: number;
  timestamp?: string;
}

export interface CalculationStep {
  step_number: number;
  label: string;
  description: string;
  formula: string;
  values: Record<string, any>;
  result: string | number;
}

export interface Calculation {
  id: string;
  test_instance_id: string;
  input_values: Record<string, any>;
  formula_ref: string;
  calculation_version: string;
  rule_version: string;
  result_value: number;
  applicable_mpe: number;
  comparison_text: string;
  decision: 'PASS' | 'FAIL' | 'REVIEW';
  calculation_steps: CalculationStep[];
  calculated_by?: string;
  calculated_at: string;
}

export interface TestInstance {
  id: string;
  test_plan_id: string;
  test_definition_id: string;
  test_code: string;
  test_name: string;
  category?: string;
  standard_ref?: string;
  oiml_clause?: string;
  definition_desc?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  supported: boolean | number;
  execution_order: number;
  decision: 'PENDING' | 'PASS' | 'FAIL' | 'REVIEW';
  observations?: Observation[];
  calculation?: Calculation | null;
}

export interface WorkflowStateHistory {
  id: string;
  test_plan_id: string;
  from_state: string;
  to_state: WorkflowStatus;
  changed_by: string;
  changed_by_name?: string;
  user_role: string;
  reason?: string;
  is_override: number | boolean;
  changed_at: string;
}

export interface TestPlan {
  id: string;
  test_plan_code: string;
  instrument_id: string;
  instrument_code?: string;
  applicant_name?: string;
  manufacturer?: string;
  model_number?: string;
  instrument_type?: string;
  accuracy_class?: AccuracyClass;
  max_capacity?: number;
  capacity_unit?: string;
  verification_scale_interval_e?: number;
  scale_interval_unit?: string;
  serial_number?: string;
  indicator_details?: string;
  load_cell_details?: string;
  application_number?: string;
  rule_version_id: string;
  rule_version_code: string;
  rule_title?: string;
  requirement_text?: string;
  status: WorkflowStatus;
  overall_decision: 'PENDING' | 'PASS' | 'FAIL';
  generated_by?: string;
  evaluator_name?: string;
  generated_at: string;
  updated_at: string;
  scheduled_date?: string;
  site_address?: string;
  target_latitude?: number;
  target_longitude?: number;
  geofence_radius_m?: number;
  assigned_inspector_id?: string;
  assigned_inspector_name?: string;
  assigned_sub_inspector_id?: string;
  assigned_sub_inspector_name?: string;
  assigned_engineer_id?: string;
  assigned_engineer_name?: string;
  verified_latitude?: number;
  verified_longitude?: number;
  verified_distance_m?: number;
  gps_verified_at?: string;
  gps_status?: 'IN_GEOFENCE' | 'OUT_OF_RANGE' | 'PENDING';
  photo_verification_url?: string;
  photo_verified_at?: string;
  standard_weights?: StandardWeightSet[];
  standards_verified_by?: string;
  standards_verified_name?: string;
  standards_verified_at?: string;
  inspector_recommendation?: 'RECOMMEND_APPROVAL' | 'RECOMMEND_REJECT' | 'CORRECTION_REQUIRED';
  inspector_notes?: string;
  inspector_reviewed_at?: string;
  test_instances?: TestInstance[];
  workflow_history?: WorkflowStateHistory[];
}

export interface FinalizedReport {
  id: string;
  report_number: string;
  instrument_id: string;
  test_plan_id: string;
  rule_version_used: string;
  calculation_version_used: string;
  status: 'FINALIZED';
  reviewer_id?: string;
  reviewer_name?: string;
  approving_authority_id?: string;
  approving_authority_name?: string;
  summary?: string;
  finalized_at: string;
  created_at: string;
  instrument_code?: string;
  applicant_name?: string;
  manufacturer?: string;
  model_number?: string;
  instrument_type?: string;
  accuracy_class?: AccuracyClass;
  max_capacity?: number;
  capacity_unit?: string;
  verification_scale_interval_e?: number;
  scale_interval_unit?: string;
  serial_number?: string;
  application_number?: string;
  indicator_details?: string;
  load_cell_details?: string;
  verification_id?: string;
  sha256_hash?: string;
  overall_decision?: 'PASS' | 'FAIL';
  test_instances?: TestInstance[];
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_value_json?: string;
  after_value_json?: string;
  reason?: string;
  ip_address?: string;
  timestamp: string;
}

export interface RuleVersion {
  id: string;
  rule_id?: string;
  version_code?: string;
  version?: string;
  name?: string;
  title?: string;
  description?: string;
  effective_from?: string;
  effective_date?: string;
  standard_code?: string;
  instrument_type?: string;
  accuracy_class?: AccuracyClass;
  test_type?: string;
  requirement_text?: string;
  calculation_ref?: string;
  formula_definition?: any;
  is_active?: number | boolean;
  active?: number | boolean;
}

export interface TestDefinition {
  id: string;
  test_code: string;
  test_name: string;
  category: string;
  standard_ref: string;
  oiml_clause: string;
  description: string;
  supported: boolean | number;
  execution_order: number;
}

// -------------------------------------------------------------
// BIOMETRIC & LIVE IDENTITY VERIFICATION TYPES
// -------------------------------------------------------------
export interface StaffFaceTemplate {
  id: string;
  user_id: string;
  user_name: string;
  role: RoleName;
  embedding: number[];
  enrolled_at: string;
  demo_mode: boolean;
  device_info?: string;
  photo_data?: string;
}

export interface FaceVerificationRecord {
  id: string;
  user_id: string;
  user_name: string;
  role: RoleName;
  inspection_id: string;
  verification_type: 'ENROLLMENT' | 'PRE_INSPECTION' | 'EVIDENCE_CAPTURE';
  verified: boolean;
  face_match: boolean;
  live_camera_check: boolean;
  confidence_score?: number;
  timestamp: string;
  attempt_number: number;
  demo_mode: boolean;
  photo_data?: string;
}

export type EvidenceCategory =
  | 'INSTRUMENT_FRONT'
  | 'INSTRUMENT_DISPLAY'
  | 'NAMEPLATE_ID'
  | 'STANDARD_MASS_SET'
  | 'INSPECTION_SITE'
  | 'OTHER_EVIDENCE';

export interface InspectionEvidence {
  id: string;
  evidence_id: string;
  inspection_id: string;
  captured_by: string;
  captured_by_name: string;
  role: RoleName;
  captured_at: string;
  evidence_type: EvidenceCategory;
  face_verification_id: string;
  camera_source: string;
  latitude?: number;
  longitude?: number;
  image_reference?: string;
  notes?: string;
}

export interface FaceVerificationEvent {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string;
  role: RoleName;
  inspection_id?: string;
  action: 'ENROLLMENT_SUCCESS' | 'ENROLLMENT_FAILED' | 'VERIFICATION_SUCCESS' | 'VERIFICATION_FAILED';
  details: string;
}
