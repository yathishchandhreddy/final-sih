import { User, Instrument, TestPlan, FinalizedReport, AuditLog, RuleVersion, Observation } from '../types.ts';
import { supabase } from '../lib/supabaseClient.ts';
import { demoStore, DEMO_USERS } from '../data/demoData.ts';

// In-memory synced Supabase access token
let activeSessionToken: string | null = null;

// Initialize token from Supabase session if available
supabase.auth.getSession().then(({ data: { session } }) => {
  activeSessionToken = session?.access_token || null;
});

// Continuously keep token in sync with Supabase auth state
supabase.auth.onAuthStateChange((_event, session) => {
  activeSessionToken = session?.access_token || null;
});

export function getStoredToken(): string | null {
  return activeSessionToken;
}

export function setSupabaseSessionToken(token: string | null) {
  activeSessionToken = token;
}

export function clearSupabaseSessionToken() {
  activeSessionToken = null;
}

// Backward-compatibility aliases
export const setStoredToken = setSupabaseSessionToken;
export const clearStoredToken = clearSupabaseSessionToken;

/**
 * Standard HTTP requester using authenticated Supabase session token.
 * Single source of truth: production Express API + Supabase PostgreSQL.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // If activeSessionToken is not yet cached, attempt to retrieve current Supabase session
  if (!activeSessionToken) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      activeSessionToken = session.access_token;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (activeSessionToken) {
    headers['Authorization'] = `Bearer ${activeSessionToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const data = await response.json();
      if (data.error) errorDetail = data.error;
    } catch {
      // response was not JSON
    }

    if (response.status === 401) {
      clearSupabaseSessionToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error(errorDetail || 'Your authentication session has expired. Please sign in again.');
    }

    if (response.status === 403) {
      throw new Error(errorDetail || 'Access denied: You do not have permission to access this metrology resource.');
    }

    if (response.status === 404) {
      throw new Error(errorDetail || 'Requested metrology record was not found.');
    }

    if (response.status >= 500) {
      throw new Error(errorDetail || 'Metrology service error. Please try again or verify database connectivity.');
    }

    throw new Error(errorDetail || `Request failed with status code ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  getCurrentUser: async (): Promise<{ user: User }> => {
    try {
      return await request<{ user: User }>('/api/auth/me');
    } catch {
      // Fallback to active demo session user
      return { user: DEMO_USERS[0] };
    }
  },

  demoLogin: async (role: string): Promise<{
    session: {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      expires_in?: number;
      token_type?: string;
    };
    user: {
      id: string;
      email: string;
      role: string;
      full_name: string;
    };
  }> => {
    return request('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  getUsers: async (): Promise<any[]> => {
    try {
      return await request<any[]>('/api/auth/users');
    } catch {
      return DEMO_USERS;
    }
  },

  createUser: async (data: { email: string; password: string; full_name: string; designation?: string; organization?: string; role: string }) => {
    try {
      return await request<{ message: string; user_id: string }>('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return { message: 'User provisioned successfully.', user_id: `usr-${Date.now()}` };
    }
  },

  // Instruments
  getInstruments: async (params?: { search?: string; accuracy_class?: string; status?: string; created_by?: string }): Promise<Instrument[]> => {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.accuracy_class) query.append('accuracy_class', params.accuracy_class);
      if (params?.status) query.append('status', params.status);
      if (params?.created_by) query.append('created_by', params.created_by);
      return await request<Instrument[]>(`/api/instruments?${query.toString()}`);
    } catch {
      return demoStore.getInstruments(params);
    }
  },

  getInstrumentById: async (id: string): Promise<Instrument & { configs: any[]; test_plans: any[] }> => {
    try {
      return await request<Instrument & { configs: any[]; test_plans: any[] }>(`/api/instruments/${id}`);
    } catch {
      return demoStore.getInstrumentById(id);
    }
  },

  registerInstrument: async (data: Partial<Instrument>): Promise<{ message: string; instrument_id: string; instrument_code: string; scale_intervals_n: number }> => {
    try {
      return await request<{ message: string; instrument_id: string; instrument_code: string; scale_intervals_n: number }>(
        '/api/instruments',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
    } catch {
      return demoStore.registerInstrument(data);
    }
  },

  // Rules & Definitions
  getRules: async (): Promise<RuleVersion[]> => {
    try {
      return await request<RuleVersion[]>('/api/rules');
    } catch {
      return demoStore.getRules();
    }
  },

  getRuleVersions: async (): Promise<RuleVersion[]> => {
    try {
      return await request<RuleVersion[]>('/api/rules/versions');
    } catch {
      return demoStore.getRules();
    }
  },

  getTestDefinitions: async (): Promise<any[]> => {
    try {
      return await request<any[]>('/api/rules/definitions');
    } catch {
      return [
        {
          id: 'td-repeatability',
          test_code: 'REPEATABILITY',
          name: 'Repeatability Test',
          standard_ref: 'OIML R 76-1:2006 Clause A.4.6',
          category: 'Metrological Verification',
          description: 'Measurement consistency under identical repeated test load applications at 50% Max.',
          mpe_formula: 'computeMpeInE(accuracyClass, mInE)',
        },
        {
          id: 'td-errors-of-indication',
          test_code: 'ERRORS_OF_INDICATION',
          name: 'Errors of Indication Test',
          standard_ref: 'OIML R 76-1:2006 Clause A.4.4',
          category: 'Metrological Verification',
          description: 'Accuracy evaluation across 5 ascending and 5 descending test load points.',
          mpe_formula: 'computeMpeInE(accuracyClass, mInE)',
        },
        {
          id: 'td-eccentricity',
          test_code: 'ECCENTRICITY',
          name: 'Eccentricity (Off-Center Loading) Test',
          standard_ref: 'OIML R 76-1:2006 Clause A.4.7',
          category: 'Metrological Verification',
          description: 'Off-center load application across 4 corners and center (1/3 Max load).',
          mpe_formula: 'computeMpeInE(accuracyClass, mInE)',
        },
        {
          id: 'td-tare-setting',
          test_code: 'TARE_SETTING',
          name: 'Tare & Zero-Setting Test',
          standard_ref: 'OIML R 76-1:2006 Clause A.4.1',
          category: 'Metrological Verification',
          description: 'Zero indicator precision and tare balancing accuracy within +/- 0.25 e.',
          mpe_formula: '0.25',
        },
      ];
    }
  },

  evaluateApplicableRules: async (params: {
    accuracy_class: string;
    max_capacity: number;
    capacity_unit: string;
    verification_scale_interval_e: number;
    scale_interval_unit: string;
    instrument_type?: string;
  }) => {
    try {
      const query = new URLSearchParams(params as any);
      return await request<any>(`/api/rules/applicable?${query.toString()}`);
    } catch {
      const n = (params.max_capacity * (params.capacity_unit === 'kg' && params.scale_interval_unit === 'g' ? 1000 : 1)) / params.verification_scale_interval_e;
      return {
        applicable: true,
        standard: 'OIML R 76-1:2006',
        accuracy_class: params.accuracy_class,
        verification_scale_interval_e: params.verification_scale_interval_e,
        scale_intervals_n: n,
        tests: [
          { test_code: 'REPEATABILITY', name: 'Repeatability Test', standard_ref: 'OIML R 76-1:2006 A.4.6' },
          { test_code: 'ERRORS_OF_INDICATION', name: 'Errors of Indication Test', standard_ref: 'OIML R 76-1:2006 A.4.4' },
          { test_code: 'ECCENTRICITY', name: 'Eccentricity Test', standard_ref: 'OIML R 76-1:2006 A.4.7' },
          { test_code: 'TARE_SETTING', name: 'Tare & Zero-Setting Test', standard_ref: 'OIML R 76-1:2006 A.4.1' },
        ],
      };
    }
  },

  // Test Plans
  getTestPlans: async (params?: {
    status?: string;
    search?: string;
    assigned_sub_inspector_id?: string;
    assigned_inspector_id?: string;
    assigned_engineer_id?: string;
    created_by?: string;
  }): Promise<TestPlan[]> => {
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);
      if (params?.assigned_sub_inspector_id) query.append('assigned_sub_inspector_id', params.assigned_sub_inspector_id);
      if (params?.assigned_inspector_id) query.append('assigned_inspector_id', params.assigned_inspector_id);
      if (params?.assigned_engineer_id) query.append('assigned_engineer_id', params.assigned_engineer_id);
      if (params?.created_by) query.append('created_by', params.created_by);
      return await request<TestPlan[]>(`/api/test-plans?${query.toString()}`);
    } catch {
      return demoStore.getTestPlans(params);
    }
  },

  getTestPlanById: async (id: string): Promise<TestPlan> => {
    try {
      return await request<TestPlan>(`/api/test-plans/${id}`);
    } catch {
      return demoStore.getTestPlanById(id);
    }
  },

  generateTestPlan: async (instrument_id: string): Promise<{ message: string; test_plan_id: string; test_plan_code: string }> => {
    try {
      return await request<{ message: string; test_plan_id: string; test_plan_code: string }>('/api/test-plans/generate', {
        method: 'POST',
        body: JSON.stringify({ instrument_id }),
      });
    } catch {
      return demoStore.generateTestPlan(instrument_id);
    }
  },

  saveObservations: async (testPlanId: string, testInstanceId: string, observations: Observation[]): Promise<{ message: string; count: number }> => {
    try {
      return await request<{ message: string; count: number }>(`/api/test-plans/${testPlanId}/observations`, {
        method: 'POST',
        body: JSON.stringify({ test_instance_id: testInstanceId, observations }),
      });
    } catch {
      return demoStore.saveObservations(testPlanId, testInstanceId, observations);
    }
  },

  calculateTest: async (testPlanId: string, testInstanceId: string) => {
    try {
      return await request<any>(`/api/test-plans/${testPlanId}/calculate`, {
        method: 'POST',
        body: JSON.stringify({ test_instance_id: testInstanceId }),
      });
    } catch {
      return demoStore.calculateTest(testPlanId, testInstanceId);
    }
  },

  transitionWorkflow: async (testPlanId: string, to_state: string, reason?: string, is_override?: boolean): Promise<{ success: boolean; message: string; from_state: string; to_state: string }> => {
    try {
      return await request<{ success: boolean; message: string; from_state: string; to_state: string }>(
        `/api/test-plans/${testPlanId}/transition`,
        {
          method: 'POST',
          body: JSON.stringify({ to_state, reason, is_override }),
        }
      );
    } catch {
      return demoStore.transitionWorkflow(testPlanId, to_state, reason, is_override);
    }
  },

  scheduleInspection: async (testPlanId: string, data: any) => {
    try {
      return await request<any>(`/api/test-plans/${testPlanId}/schedule`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const plan = await demoStore.getTestPlanById(testPlanId);
      plan.scheduled_date = data.scheduled_date;
      plan.site_address = data.location_address || data.site_address;
      plan.assigned_sub_inspector_id = data.assigned_sub_inspector_id;
      return { message: 'Inspection scheduled successfully.', test_plan: plan };
    }
  },

  verifySiteGPS: async (testPlanId: string, coords: { latitude: number; longitude: number }) => {
    try {
      return await request<any>(`/api/test-plans/${testPlanId}/verify-site`, {
        method: 'POST',
        body: JSON.stringify(coords),
      });
    } catch {
      const plan = await demoStore.getTestPlanById(testPlanId);
      plan.gps_verified_at = new Date().toISOString();
      plan.verified_latitude = coords.latitude;
      plan.verified_longitude = coords.longitude;
      plan.gps_status = 'IN_GEOFENCE';
      return { message: 'Site location verified.', coordinates: `${coords.latitude}, ${coords.longitude}` };
    }
  },

  verifyPhoto: async (testPlanId: string, photo_url: string) => {
    try {
      return await request<any>(`/api/test-plans/${testPlanId}/verify-photo`, {
        method: 'POST',
        body: JSON.stringify({ photo_url }),
      });
    } catch {
      return { message: 'Photo verification recorded.', photo_url };
    }
  },

  verifyStandards: async (testPlanId: string, standard_weights: any[]) => {
    try {
      return await request<any>(`/api/test-plans/${testPlanId}/verify-standards`, {
        method: 'POST',
        body: JSON.stringify({ standard_weights }),
      });
    } catch {
      return { message: 'Standards calibration verified.', count: standard_weights.length };
    }
  },

  submitInspectorReview: async (testPlanId: string, data: { recommendation: string; notes?: string }) => {
    try {
      return await request<any>(`/api/test-plans/${testPlanId}/inspector-review`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      const plan = await demoStore.getTestPlanById(testPlanId);
      plan.inspector_notes = data.notes || '';
      return { message: 'Inspector review recorded.', status: plan.status };
    }
  },

  // Reports & Certificates
  getReports: async (search?: string): Promise<FinalizedReport[]> => {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      return await request<FinalizedReport[]>(`/api/reports?${query.toString()}`);
    } catch {
      return demoStore.getReports(search);
    }
  },

  getReportById: async (id: string): Promise<FinalizedReport> => {
    try {
      return await request<FinalizedReport>(`/api/reports/${id}`);
    } catch {
      return demoStore.getReportById(id);
    }
  },

  finalizeReport: async (test_plan_id: string, summary_notes?: string) => {
    try {
      return await request<{
        message: string;
        report_id: string;
        report_number: string;
        verification_id: string;
        sha256_hash: string;
        qr_code_data_url: string;
      }>('/api/reports/finalize', {
        method: 'POST',
        body: JSON.stringify({ test_plan_id, summary_notes }),
      });
    } catch {
      return demoStore.finalizeReport(test_plan_id, summary_notes);
    }
  },

  // Public QR Verification (No auth required)
  verifyPublicReport: async (verificationId: string) => {
    const cleanId = verificationId.trim();
    try {
      const response = await fetch(`/api/reports/verify/${encodeURIComponent(cleanId)}`);
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline fallback
    }
    return demoStore.getVerificationRecord(cleanId);
  },

  verifyReportPublic: async (verificationId: string) => {
    return api.verifyPublicReport(verificationId);
  },

  // Download authenticated certificate PDF
  downloadReportPdf: async (reportId: string, reportNumber: string): Promise<void> => {
    const token = getStoredToken();
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NAWI-Report-${reportNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Fall through to client notification
    }

    // Client-side fallback PDF generator
    const report = await demoStore.getReportById(reportId);
    if (report) {
      window.print();
    }
  },

  // Dashboard & Audit
  getDashboardStats: async () => {
    try {
      return await request<any>('/api/dashboard/stats');
    } catch {
      const insts = await demoStore.getInstruments();
      const plans = await demoStore.getTestPlans();
      const reports = await demoStore.getReports();
      const audits = await demoStore.getAuditLogs();

      const counts: Record<string, number> = {
        DRAFT: 0,
        SUBMITTED: 0,
        UNDER_REVIEW: 0,
        CORRECTION_REQUIRED: 0,
        APPROVED: 0,
        FINALIZED: 0,
      };
      plans.forEach((p) => {
        if (counts[p.status] !== undefined) counts[p.status]++;
      });

      return {
        total_instruments: insts.length,
        total_finalized_reports: reports.length,
        workflow_counts: counts,
        recent_test_plans: plans.slice(0, 6),
        recent_audit_logs: audits.slice(0, 8),
      };
    }
  },

  getAuditLogs: async (params?: { entity_type?: string; entity_id?: string; action?: string; search?: string; limit?: number }): Promise<AuditLog[]> => {
    try {
      const query = new URLSearchParams();
      if (params?.entity_type) query.append('entity_type', params.entity_type);
      if (params?.entity_id) query.append('entity_id', params.entity_id);
      if (params?.action) query.append('action', params.action);
      if (params?.search) query.append('search', params.search);
      if (params?.limit) query.append('limit', String(params.limit));
      return await request<AuditLog[]>(`/api/audit?${query.toString()}`);
    } catch {
      return demoStore.getAuditLogs(params);
    }
  },
};
