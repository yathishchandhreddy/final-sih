import {
  StaffFaceTemplate,
  FaceVerificationRecord,
  InspectionEvidence,
  FaceVerificationEvent,
  RoleName,
} from '../types.ts';

// -------------------------------------------------------------
// SECURE LOCAL BIOMETRIC DESCRIPTOR REPOSITORY
// Stores actual 128-D normalized face recognition embeddings
// Associated strictly with authenticated officer user profiles.
// -------------------------------------------------------------

class DemoFaceDataStore {
  private templates: Map<string, StaffFaceTemplate> = new Map();
  private verifications: FaceVerificationRecord[] = [];
  private evidenceItems: InspectionEvidence[] = [];
  private events: FaceVerificationEvent[] = [];

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storedTmpls = localStorage.getItem('nawi_face_templates');
      if (storedTmpls) {
        const parsed: StaffFaceTemplate[] = JSON.parse(storedTmpls);
        parsed.forEach((t) => this.templates.set(t.user_id, t));
      }
      const storedVerifs = localStorage.getItem('nawi_face_verifications');
      if (storedVerifs) {
        const parsedV: FaceVerificationRecord[] = JSON.parse(storedVerifs);
        this.verifications = [...parsedV, ...this.verifications];
      }
    } catch (e) {
      console.warn('Could not read face biometrics from storage:', e);
    }
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const tmplArr = Array.from(this.templates.values());
      localStorage.setItem('nawi_face_templates', JSON.stringify(tmplArr));
      localStorage.setItem('nawi_face_verifications', JSON.stringify(this.verifications.slice(0, 30)));
    } catch (e) {
      console.warn('Could not save face biometrics to storage:', e);
    }
  }

  // ---------------- TEMPLATES ----------------
  public getStaffTemplate(userId: string): StaffFaceTemplate | null {
    return this.templates.get(userId) || null;
  }

  public getStaffTemplateByRole(role: RoleName): StaffFaceTemplate | null {
    for (const tmpl of this.templates.values()) {
      if (tmpl.role === role) return tmpl;
    }
    return null;
  }

  public saveStaffTemplate(template: StaffFaceTemplate): void {
    this.templates.set(template.user_id, template);
    this.saveToLocalStorage();
    this.recordEvent({
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor_id: template.user_id,
      actor_name: template.user_name,
      role: template.role,
      action: 'ENROLLMENT_SUCCESS',
      details: `Physical camera face template enrolled for ${template.user_name} (${template.role}).`,
    });
  }

  public deleteStaffTemplate(userId: string): boolean {
    const res = this.templates.delete(userId);
    this.saveToLocalStorage();
    return res;
  }

  // ---------------- VERIFICATIONS ----------------
  public recordVerification(record: FaceVerificationRecord): void {
    this.verifications.unshift(record);
    this.saveToLocalStorage();

    this.recordEvent({
      id: `evt-${Date.now()}`,
      timestamp: record.timestamp,
      actor_id: record.user_id,
      actor_name: record.user_name,
      role: record.role,
      inspection_id: record.inspection_id,
      action: record.verified ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_FAILED',
      details: record.verified
        ? `Biometric identity match confirmed for inspection ${record.inspection_id} (${record.confidence_score}% similarity).`
        : `Biometric identity verification rejected for inspection ${record.inspection_id} (${record.confidence_score !== undefined ? record.confidence_score + '%' : 'No face/mismatch'}).`,
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
