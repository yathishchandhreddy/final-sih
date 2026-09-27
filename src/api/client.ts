import { User, Instrument, TestPlan, FinalizedReport, AuditLog, RuleVersion, Observation } from '../types.ts';
import { supabase } from '../lib/supabaseClient.ts';

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
    return request<{ user: User }>('/api/auth/me');
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
    return request<any[]>('/api/auth/users');
  },

  createUser: async (data: { email: string; password: string; full_name: string; designation?: string; organization?: string; role: string }) => {
    return request<{ message: string; user_id: string }>('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Instruments
  getInstruments: async (params?: { search?: string; accuracy_class?: string; status?: string; created_by?: string }): Promise<Instrument[]> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.accuracy_class) query.append('accuracy_class', params.accuracy_class);
    if (params?.status) query.append('status', params.status);
    if (params?.created_by) query.append('created_by', params.created_by);
    return request<Instrument[]>(`/api/instruments?${query.toString()}`);
  },

  getInstrumentById: async (id: string): Promise<Instrument & { configs: any[]; test_plans: any[] }> => {
    return request<Instrument & { configs: any[]; test_plans: any[] }>(`/api/instruments/${id}`);
  },

  registerInstrument: async (data: Partial<Instrument>): Promise<{ message: string; instrument_id: string; instrument_code: string; scale_intervals_n: number }> => {
    return request<{ message: string; instrument_id: string; instrument_code: string; scale_intervals_n: number }>(
      '/api/instruments',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  // Rules & Definitions
  getRules: async (): Promise<RuleVersion[]> => {
    return request<RuleVersion[]>('/api/rules');
  },

  getRuleVersions: async (): Promise<RuleVersion[]> => {
    return request<RuleVersion[]>('/api/rules/versions');
  },

  getTestDefinitions: async (): Promise<any[]> => {
    return request<any[]>('/api/rules/definitions');
  },

  evaluateApplicableRules: async (params: {
    accuracy_class: string;
    max_capacity: number;
    capacity_unit: string;
    verification_scale_interval_e: number;
    scale_interval_unit: string;
    instrument_type?: string;
  }) => {
    const query = new URLSearchParams(params as any);
    return request<any>(`/api/rules/applicable?${query.toString()}`);
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
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.assigned_sub_inspector_id) query.append('assigned_sub_inspector_id', params.assigned_sub_inspector_id);
    if (params?.assigned_inspector_id) query.append('assigned_inspector_id', params.assigned_inspector_id);
    if (params?.assigned_engineer_id) query.append('assigned_engineer_id', params.assigned_engineer_id);
    if (params?.created_by) query.append('created_by', params.created_by);
    return request<TestPlan[]>(`/api/test-plans?${query.toString()}`);
  },

  getTestPlanById: async (id: string): Promise<TestPlan> => {
    return request<TestPlan>(`/api/test-plans/${id}`);
  },

  generateTestPlan: async (instrument_id: string): Promise<{ message: string; test_plan_id: string; test_plan_code: string }> => {
    return request<{ message: string; test_plan_id: string; test_plan_code: string }>('/api/test-plans/generate', {
      method: 'POST',
      body: JSON.stringify({ instrument_id }),
    });
  },

  saveObservations: async (testPlanId: string, testInstanceId: string, observations: Observation[]): Promise<{ message: string; count: number }> => {
    return request<{ message: string; count: number }>(`/api/test-plans/${testPlanId}/observations`, {
      method: 'POST',
      body: JSON.stringify({ test_instance_id: testInstanceId, observations }),
    });
  },

  calculateTest: async (testPlanId: string, testInstanceId: string) => {
    return request<any>(`/api/test-plans/${testPlanId}/calculate`, {
      method: 'POST',
      body: JSON.stringify({ test_instance_id: testInstanceId }),
    });
  },

  transitionWorkflow: async (testPlanId: string, to_state: string, reason?: string, is_override?: boolean): Promise<{ success: boolean; message: string; from_state: string; to_state: string }> => {
    return request<{ success: boolean; message: string; from_state: string; to_state: string }>(
      `/api/test-plans/${testPlanId}/transition`,
      {
        method: 'POST',
        body: JSON.stringify({ to_state, reason, is_override }),
      }
    );
  },

  scheduleInspection: async (testPlanId: string, data: any) => {
    return request<any>(`/api/test-plans/${testPlanId}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  verifySiteGPS: async (testPlanId: string, coords: { latitude: number; longitude: number }) => {
    return request<any>(`/api/test-plans/${testPlanId}/verify-site`, {
      method: 'POST',
      body: JSON.stringify(coords),
    });
  },

  verifyPhoto: async (testPlanId: string, photo_url: string) => {
    return request<any>(`/api/test-plans/${testPlanId}/verify-photo`, {
      method: 'POST',
      body: JSON.stringify({ photo_url }),
    });
  },

  verifyStandards: async (testPlanId: string, standard_weights: any[]) => {
    return request<any>(`/api/test-plans/${testPlanId}/verify-standards`, {
      method: 'POST',
      body: JSON.stringify({ standard_weights }),
    });
  },

  submitInspectorReview: async (testPlanId: string, data: { recommendation: string; notes?: string }) => {
    return request<any>(`/api/test-plans/${testPlanId}/inspector-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Reports & Certificates
  getReports: async (search?: string): Promise<FinalizedReport[]> => {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    return request<FinalizedReport[]>(`/api/reports?${query.toString()}`);
  },

  getReportById: async (id: string): Promise<FinalizedReport> => {
    return request<FinalizedReport>(`/api/reports/${id}`);
  },

  finalizeReport: async (test_plan_id: string, summary_notes?: string) => {
    return request<{
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
  },

  // Public QR Verification (No auth required)
  verifyPublicReport: async (verificationId: string) => {
    const cleanId = verificationId.trim();
    const response = await fetch(`/api/reports/verify/${encodeURIComponent(cleanId)}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Verification failed: Certificate not found or revoked.');
    }
    return response.json();
  },

  verifyReportPublic: async (verificationId: string) => {
    return api.verifyPublicReport(verificationId);
  },

  // Download authenticated certificate PDF
  downloadReportPdf: async (reportId: string, reportNumber: string): Promise<void> => {
    const token = getStoredToken();
    const res = await fetch(`/api/reports/${reportId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      let errMsg = 'Failed to download certificate PDF.';
      try {
        const errJson = await res.json();
        if (errJson.error) errMsg = errJson.error;
      } catch {
        // response was not JSON
      }
      throw new Error(errMsg);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NAWI-Report-${reportNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Dashboard & Audit
  getDashboardStats: async () => {
    return request<any>('/api/dashboard/stats');
  },

  getAuditLogs: async (params?: { entity_type?: string; entity_id?: string; action?: string; search?: string; limit?: number }): Promise<AuditLog[]> => {
    const query = new URLSearchParams();
    if (params?.entity_type) query.append('entity_type', params.entity_type);
    if (params?.entity_id) query.append('entity_id', params.entity_id);
    if (params?.action) query.append('action', params.action);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    return request<AuditLog[]>(`/api/audit?${query.toString()}`);
  },
};
