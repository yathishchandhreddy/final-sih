import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne, queryRows } from '../db/database.ts';
import { WorkflowStatus, UserPayload, RoleName } from '../types/index.ts';
import { logAudit } from './audit.ts';

export interface StateTransitionResult {
  success: boolean;
  message: string;
  from_state: WorkflowStatus;
  to_state: WorkflowStatus;
}

export class WorkflowEngine {
  /**
   * Validate if a state transition is permitted by workflow rules and role permissions
   */
  static validateTransition(
    fromState: WorkflowStatus,
    toState: WorkflowStatus,
    userRoles: RoleName[]
  ): { allowed: boolean; reason?: string } {
    const isAdmin = userRoles.includes('ADMIN');

    // Admin can perform any transition in emergency/test override
    if (isAdmin) {
      return { allowed: true };
    }

    // 1. DRAFT / APPLICATION_SUBMITTED -> INSPECTION_SCHEDULED
    if (
      (fromState === 'DRAFT' || fromState === 'APPLICATION_SUBMITTED') &&
      (toState === 'INSPECTION_SCHEDULED' || toState === 'SUBMITTED')
    ) {
      if (userRoles.some((r) => ['INSPECTOR', 'EVALUATOR', 'APPLICANT'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Inspector or Applicant can schedule/submit inspection.' };
    }

    // 2. INSPECTION_SCHEDULED -> SITE_VERIFIED
    if (fromState === 'INSPECTION_SCHEDULED' && toState === 'SITE_VERIFIED') {
      if (userRoles.some((r) => ['SUB_INSPECTOR', 'INSPECTOR', 'EVALUATOR'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Field Sub-Inspector or Lead Inspector can verify site location.' };
    }

    // 3. SITE_VERIFIED -> STANDARDS_VERIFIED
    if (fromState === 'SITE_VERIFIED' && toState === 'STANDARDS_VERIFIED') {
      if (userRoles.some((r) => ['ENGINEER', 'SUB_INSPECTOR', 'INSPECTOR', 'EVALUATOR'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Calibrator / Engineer or Field Officer can verify standard weights.' };
    }

    // 4. STANDARDS_VERIFIED / SITE_VERIFIED / DRAFT -> FIELD_TESTS_COMPLETED or SUBMITTED
    if (
      ['STANDARDS_VERIFIED', 'SITE_VERIFIED', 'DRAFT', 'CORRECTION_REQUIRED'].includes(fromState) &&
      ['FIELD_TESTS_COMPLETED', 'SUBMITTED'].includes(toState)
    ) {
      if (userRoles.some((r) => ['SUB_INSPECTOR', 'ENGINEER', 'INSPECTOR', 'EVALUATOR'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Field Officer or Evaluator can submit field test observations.' };
    }

    // 5. FIELD_TESTS_COMPLETED / SUBMITTED -> INSPECTOR_RECOMMENDED or UNDER_REVIEW or APPROVED
    if (
      ['FIELD_TESTS_COMPLETED', 'SUBMITTED', 'UNDER_REVIEW'].includes(fromState) &&
      ['INSPECTOR_RECOMMENDED', 'UNDER_REVIEW', 'APPROVED'].includes(toState)
    ) {
      if (userRoles.some((r) => ['INSPECTOR', 'REVIEWER', 'APPROVING_AUTHORITY'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Lead Inspector or Reviewer can evaluate field tests and recommend approval.' };
    }

    // 6. INSPECTOR_RECOMMENDED / UNDER_REVIEW -> CORRECTION_REQUIRED or REJECTED
    if (
      ['FIELD_TESTS_COMPLETED', 'INSPECTOR_RECOMMENDED', 'SUBMITTED', 'UNDER_REVIEW'].includes(fromState) &&
      ['CORRECTION_REQUIRED', 'REJECTED'].includes(toState)
    ) {
      if (userRoles.some((r) => ['INSPECTOR', 'REVIEWER', 'APPROVING_AUTHORITY'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Inspector or Reviewer can reject or request corrections.' };
    }

    // 7. CORRECTION_REQUIRED -> FIELD_TESTS_COMPLETED or SUBMITTED
    if (fromState === 'CORRECTION_REQUIRED' && ['FIELD_TESTS_COMPLETED', 'SUBMITTED'].includes(toState)) {
      if (userRoles.some((r) => ['SUB_INSPECTOR', 'EVALUATOR', 'ENGINEER'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Field Officer or Evaluator can re-submit after corrections.' };
    }

    // 8. INSPECTOR_RECOMMENDED / APPROVED -> FINALIZED
    if (['INSPECTOR_RECOMMENDED', 'APPROVED'].includes(fromState) && toState === 'FINALIZED') {
      if (userRoles.some((r) => ['APPROVING_AUTHORITY', 'INSPECTOR'].includes(r))) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Only Approving Authority or Lead Inspector can seal and issue certificate.' };
    }

    return {
      allowed: true, // Allow flexible transition for legal metrology workflow
    };
  }

  /**
   * Execute state transition on a test plan
   */
  static async transition(
    testPlanId: string,
    toState: WorkflowStatus,
    user: UserPayload,
    reason?: string,
    isOverride: boolean = false
  ): Promise<StateTransitionResult> {
    const testPlan = await queryOne<{ id: string; status: WorkflowStatus; test_plan_code: string; instrument_id: string }>(
      'SELECT id, status, test_plan_code, instrument_id FROM test_plans WHERE id = ?',
      [testPlanId]
    );

    if (!testPlan) {
      throw new Error(`Test plan ${testPlanId} not found.`);
    }

    if (testPlan.status === 'FINALIZED') {
      throw new Error('Test plan is FINALIZED and immutable. No state transitions are allowed on finalized records.');
    }

    const validation = this.validateTransition(testPlan.status, toState, user.roles);
    if (!validation.allowed) {
      throw new Error(validation.reason || 'Transition not allowed.');
    }

    // Pre-transition data integrity checks
    if (toState === 'SUBMITTED') {
      const instances = await queryRows<{ id: string; test_code: string; decision: string; supported: number }>(
        'SELECT id, test_code, decision, supported FROM test_instances WHERE test_plan_id = ?',
        [testPlanId]
      );

      if (instances.length === 0) {
        throw new Error('Cannot submit test plan: No test instances generated.');
      }

      // Check if at least one supported test has observations and calculation
      const supportedTests = instances.filter((i) => i.supported === 1);
      const calculatedTests = supportedTests.filter((i) => i.decision !== 'PENDING');
      if (calculatedTests.length === 0 && !isOverride) {
        throw new Error('Cannot submit test plan: At least one metrological test must be calculated with a conclusive decision.');
      }
    }

    const now = new Date().toISOString();
    const fromState = testPlan.status;

    // Update test plan status
    await execute('UPDATE test_plans SET status = ?, updated_at = ? WHERE id = ?', [toState, now, testPlanId]);

    // Record workflow state entry
    const wsId = uuidv4();
    await execute(
      `INSERT INTO workflow_states (id, test_plan_id, from_state, to_state, changed_by, user_role, reason, is_override, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [wsId, testPlanId, fromState, toState, user.id, user.role, reason || null, isOverride ? 1 : 0, now]
    );

    // Audit log
    await logAudit({
      user,
      action: isOverride ? 'OVERRIDE_CREATED' : toState,
      entity_type: 'test_plan',
      entity_id: testPlanId,
      before_value: { status: fromState },
      after_value: { status: toState },
      reason: reason || `Transition from ${fromState} to ${toState}`,
    });

    return {
      success: true,
      message: `Workflow successfully transitioned from ${fromState} to ${toState}.`,
      from_state: fromState,
      to_state: toState,
    };
  }
}
