import {
  StaffFaceTemplate,
  FaceVerificationRecord,
  InspectionEvidence,
  FaceVerificationEvent,
  RoleName,
} from '../types.ts';

// -------------------------------------------------------------
// LOCAL BIOMETRIC DESCRIPTOR REPOSITORY
// Strictly in-memory / session storage.
// No raw face photos stored in localStorage.
// -------------------------------------------------------------

class DemoFaceDataStore {
  // In-memory enrolled face templates (by userId)
  private templates: Map<string, StaffFaceTemplate> = new Map();

  // Verification history
  private verifications: FaceVerificationRecord[] = [];

  // Captured evidence items
  private evidenceItems: InspectionEvidence[] = [];

  // Audit events
  private events: FaceVerificationEvent[] = [];

  constructor() {
    this.initDefaultDemoTemplates();
  }

  /**
   * Seed pre-enrolled prototype templates for TESTER and INSPECTOR
   * so reviewers can immediately test live verification or re-enroll.
   */
  public generateSeedEmbedding(seed: number): number[] {
    const vec: number[] = [];
    let sumSq = 0;
    for (let i = 0; i < 64; i++) {
      const val = Math.sin(seed * (i + 1) * 0.45) * 0.5 + Math.cos(seed + i * 0.25) * 0.5;
      vec.push(val);
      sumSq += val * val;
    }
    const norm = Math.sqrt(sumSq) || 1;
    return vec.map((v) => Number((v / norm).toFixed(5)));
  }

  private initDefaultDemoTemplates() {
    // 1. Field Tester: Amit Patel (usr-tester-001)
    const testerTemplate: StaffFaceTemplate = {
      id: 'tmpl-tester-001',
      user_id: 'usr-tester-001',
      user_name: 'Amit Patel',
      role: 'SUB_INSPECTOR',
      embedding: this.generateSeedEmbedding(101),
      enrolled_at: '2025-02-15T09:00:00Z',
      demo_mode: true,
      device_info: 'Metrology Field Tablet / Front Sensor',
    };
    this.templates.set('usr-tester-001', testerTemplate);
    this.templates.set('usr-tester-alias', {
      ...testerTemplate,
      id: 'tmpl-tester-alias',
      user_id: 'usr-tester-alias',
    });

    // 2. Lead Inspector: Dr. Sunita Rao (usr-inspector-001)
    const inspectorTemplate: StaffFaceTemplate = {
      id: 'tmpl-inspector-001',
      user_id: 'usr-inspector-001',
      user_name: 'Dr. Sunita Rao',
      role: 'INSPECTOR',
      embedding: this.generateSeedEmbedding(202),
      enrolled_at: '2025-02-16T11:00:00Z',
      demo_mode: true,
      device_info: 'National Metrology Directorate Workstation',
    };
    this.templates.set('usr-inspector-001', inspectorTemplate);

    // 3. Admin / Controller
    const adminTemplate: StaffFaceTemplate = {
      id: 'tmpl-admin-001',
      user_id: 'usr-admin-001',
      user_name: 'Rajesh Varma',
      role: 'ADMIN',
      embedding: this.generateSeedEmbedding(303),
      enrolled_at: '2025-02-10T08:00:00Z',
      demo_mode: true,
      device_info: 'Directorate Central Server',
    };
    this.templates.set('usr-admin-001', adminTemplate);

    // Initial Demo Evidence for DEMO-003 (Completed review)
    this.evidenceItems.push(
      {
        id: 'ev-demo-003-1',
        evidence_id: 'EVD-2025-003-01',
        inspection_id: 'tp-demo-003',
        captured_by: 'usr-inspector-001',
        captured_by_name: 'Dr. Sunita Rao',
        role: 'INSPECTOR',
        captured_at: '2025-02-20T10:45:00Z',
        evidence_type: 'NAMEPLATE_ID',
        face_verification_id: 'fv-demo-003-seed',
        camera_source: 'Inspector Device Camera',
        latitude: 28.6305,
        longitude: 77.2178,
        notes: 'Instrument nameplate inspected. Model RC-210, Serial SN-RC-210-3312 confirmed.',
      },
      {
        id: 'ev-demo-003-2',
        evidence_id: 'EVD-2025-003-02',
        inspection_id: 'tp-demo-003',
        captured_by: 'usr-inspector-001',
        captured_by_name: 'Dr. Sunita Rao',
        role: 'INSPECTOR',
        captured_at: '2025-02-20T11:15:00Z',
        evidence_type: 'STANDARD_MASS_SET',
        face_verification_id: 'fv-demo-003-seed',
        camera_source: 'Inspector Device Camera',
        latitude: 28.6305,
        longitude: 77.2178,
        notes: 'Working standard mass set STD-M1-2025-102 inspected with valid NPL certificate.',
      }
    );
  }

  // ---------------- TEMPLATES ----------------
  public getStaffTemplate(userId: string): StaffFaceTemplate | null {
    return this.templates.get(userId) || null;
  }

  public ensureStaffTemplate(user: { id: string; full_name?: string; role?: any }): StaffFaceTemplate {
    const existing = this.getStaffTemplate(user.id);
    if (existing) return existing;

    const newTemplate: StaffFaceTemplate = {
      id: `tmpl-${user.id}-${Date.now()}`,
      user_id: user.id,
      user_name: user.full_name || 'Legal Metrology Officer',
      role: user.role || 'SUB_INSPECTOR',
      embedding: this.generateSeedEmbedding(Math.abs(user.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 101))),
      enrolled_at: new Date().toISOString(),
      demo_mode: true,
      device_info: 'Authorized Metrology Terminal (Demo Auto-Enrolled)',
    };
    this.saveStaffTemplate(newTemplate);
    return newTemplate;
  }

  public getStaffTemplateByRole(role: RoleName): StaffFaceTemplate | null {
    for (const tmpl of this.templates.values()) {
      if (tmpl.role === role) return tmpl;
    }
    return null;
  }

  public saveStaffTemplate(template: StaffFaceTemplate): void {
    this.templates.set(template.user_id, template);
    this.recordEvent({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor_id: template.user_id,
      actor_name: template.user_name,
      role: template.role,
      action: 'ENROLLMENT_SUCCESS',
      details: `Live face template enrolled for ${template.user_name} (${template.role}).`,
    });
  }

  public deleteStaffTemplate(userId: string): boolean {
    return this.templates.delete(userId);
  }

  // ---------------- VERIFICATIONS ----------------
  public recordVerification(record: FaceVerificationRecord): void {
    this.verifications.unshift(record);

    this.recordEvent({
      id: `evt-${Date.now()}`,
      timestamp: record.timestamp,
      actor_id: record.user_id,
      actor_name: record.user_name,
      role: record.role,
      inspection_id: record.inspection_id,
      action: record.verified ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_FAILED',
      details: record.verified
        ? `Live face identity verified for inspection ${record.inspection_id}.`
        : `Live face identity verification rejected for inspection ${record.inspection_id}.`,
    });
  }

  public getLatestVerificationForInspection(
    inspectionId: string,
    role?: RoleName
  ): FaceVerificationRecord | null {
    return (
      this.verifications.find(
        (v) =>
          v.inspection_id === inspectionId &&
          v.verified === true &&
          (!role || v.role === role)
      ) || null
    );
  }

  public getVerificationsForInspection(inspectionId: string): FaceVerificationRecord[] {
    return this.verifications.filter((v) => v.inspection_id === inspectionId);
  }

  // ---------------- EVIDENCE ----------------
  public saveEvidence(evidence: InspectionEvidence): void {
    this.evidenceItems.unshift(evidence);
  }

  public getEvidenceForInspection(inspectionId: string): InspectionEvidence[] {
    return this.evidenceItems.filter((e) => e.inspection_id === inspectionId);
  }

  public deleteEvidence(evidenceId: string): void {
    this.evidenceItems = this.evidenceItems.filter((e) => e.id !== evidenceId && e.evidence_id !== evidenceId);
  }

  // ---------------- AUDIT EVENTS ----------------
  private recordEvent(event: FaceVerificationEvent): void {
    this.events.unshift(event);
  }

  public getEvents(): FaceVerificationEvent[] {
    return this.events;
  }
}

export const demoFaceStore = new DemoFaceDataStore();
