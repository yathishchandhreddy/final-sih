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

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: RoleName;
  status: string;
  created_at: string;
  updated_at: string;
  designation?: string;
  organization?: string;
}

export interface UserPayload {
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

export interface InstrumentRecord {
  id: string;
  instrument_code: string;
  applicant_name: string;
  manufacturer: string;
  model_number: string;
  instrument_type: string;
  accuracy_class: 'I' | 'II' | 'III' | 'IIII';
  max_capacity: number;
  capacity_unit: string;
  verification_scale_interval_e: number;
  scale_interval_unit: string;
  serial_number: string;
  indicator_details?: string;
  load_cell_details?: string;
  application_number: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CalculationStep {
  step_number: number;
  label: string;
  description: string;
  formula: string;
  values: Record<string, any>;
  result: string | number;
}

export interface CalculationResponse {
  test_instance_id: string;
  test_code: string;
  input_values: Record<string, any>;
  calculation_version: string;
  rule_version: string;
  calculation_steps: CalculationStep[];
  result_value: number;
  applicable_limit: number;
  limit_description: string;
  comparison: string;
  decision: 'PASS' | 'FAIL' | 'REVIEW';
  regulatory_status: 'VERIFIED_OIML_R76' | 'REQUIRES_REGULATORY_VALIDATION';
}
