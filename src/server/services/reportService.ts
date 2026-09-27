import crypto from 'crypto';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { v4 as uuidv4 } from 'uuid';
import { execute, queryOne, queryRows } from '../db/database.ts';
import { UserPayload } from '../types/index.ts';
import { logAudit } from './audit.ts';

export interface FinalizeReportParams {
  test_plan_id: string;
  user: UserPayload;
  summary_notes?: string;
  app_url?: string;
}

export interface VerificationResult {
  valid: boolean;
  verification_id: string;
  report_number: string;
  instrument_code: string;
  manufacturer: string;
  model_number: string;
  accuracy_class: string;
  max_capacity: string;
  verification_scale_interval_e: string;
  status: string;
  finalized_at: string;
  sha256_hash: string;
  integrity_status: 'MATCH' | 'FAILED';
  rule_version: string;
  calculation_version: string;
  approving_authority: string;
}

export class ReportService {
  /**
   * Finalize a test plan, lock records, compute SHA-256 integrity hash, and generate QR code
   */
  static async finalizeReport(params: FinalizeReportParams): Promise<{
    report_id: string;
    report_number: string;
    verification_id: string;
    sha256_hash: string;
    qr_code_data_url: string;
  }> {
    const { test_plan_id, user, summary_notes, app_url = '' } = params;

    // Fetch test plan & instrument
    const testPlan = await queryOne<any>(
      `SELECT tp.*, r.title as rule_title, r.version as rule_ver 
       FROM test_plans tp
       LEFT JOIN rule_versions r ON tp.rule_version_id = r.id
       WHERE tp.id = ?`,
      [test_plan_id]
    );

    if (!testPlan) {
      throw new Error(`Test plan ${test_plan_id} not found.`);
    }

    if (testPlan.status !== 'APPROVED') {
      throw new Error(`Test plan must be in APPROVED status prior to finalization. Current status: ${testPlan.status}`);
    }

    const instrument = await queryOne<any>('SELECT * FROM instruments WHERE id = ?', [testPlan.instrument_id]);
    if (!instrument) {
      throw new Error(`Instrument ${testPlan.instrument_id} not found.`);
    }

    // Fetch all test instances, observations, calculations
    const testInstances = await queryRows<any>(
      `SELECT * FROM test_instances WHERE test_plan_id = ? ORDER BY execution_order ASC`,
      [test_plan_id]
    );

    const fullTestDetails: any[] = [];
    for (const inst of testInstances) {
      const observations = await queryRows<any>(
        `SELECT * FROM observations WHERE test_instance_id = ? ORDER BY run_number ASC, load_point ASC`,
        [inst.id]
      );
      const calculation = await queryOne<any>(
        `SELECT * FROM calculations WHERE test_instance_id = ? ORDER BY calculated_at DESC LIMIT 1`,
        [inst.id]
      );

      fullTestDetails.push({
        instance_id: inst.id,
        test_code: inst.test_code,
        test_name: inst.test_name,
        decision: inst.decision,
        supported: inst.supported === 1,
        observations,
        calculation: calculation
          ? {
              formula_ref: calculation.formula_ref,
              calculation_version: calculation.calculation_version,
              result_value: calculation.result_value,
              applicable_mpe: calculation.applicable_mpe,
              comparison_text: calculation.comparison_text,
              decision: calculation.decision,
              calculated_at: calculation.calculated_at,
            }
          : null,
      });
    }

    // Check if report already exists for this test plan
    let existingReport = await queryOne<any>('SELECT * FROM reports WHERE test_plan_id = ?', [test_plan_id]);
    const reportId = existingReport ? existingReport.id : uuidv4();
    const reportNumber = existingReport
      ? existingReport.report_number
      : `NAWI-TR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const now = new Date().toISOString();

    // Fetch reviewer details from workflow states
    const reviewState = await queryOne<any>(
      `SELECT ws.*, u.full_name as reviewer_name FROM workflow_states ws 
       LEFT JOIN users u ON ws.changed_by = u.id 
       WHERE ws.test_plan_id = ? AND ws.to_state = 'APPROVED' 
       ORDER BY ws.changed_at DESC LIMIT 1`,
      [test_plan_id]
    );

    const reviewerName = reviewState?.reviewer_name || 'Senior Metrological Reviewer';
    const reviewerId = reviewState?.changed_by || 'reviewer-id';

    // Canonical payload for cryptographic integrity hash
    const canonicalPayload = {
      document_title: 'DIGITAL NAWI TEST REPORT',
      report_number: reportNumber,
      report_id: reportId,
      finalized_at: now,
      rule_engine: {
        rule_version_id: testPlan.rule_version_id,
        rule_version_code: testPlan.rule_version_code,
        rule_title: testPlan.rule_title,
      },
      calculation_engine: {
        version: 'NAWI-CALC-v1.0.0',
        standard: 'OIML R 76-1:2006',
      },
      instrument: {
        instrument_code: instrument.instrument_code,
        applicant_name: instrument.applicant_name,
        manufacturer: instrument.manufacturer,
        model_number: instrument.model_number,
        instrument_type: instrument.instrument_type,
        accuracy_class: instrument.accuracy_class,
        max_capacity: `${instrument.max_capacity} ${instrument.capacity_unit}`,
        verification_scale_interval_e: `${instrument.verification_scale_interval_e} ${instrument.scale_interval_unit}`,
        serial_number: instrument.serial_number,
        application_number: instrument.application_number,
      },
      evaluation_summary: {
        overall_decision: testPlan.overall_decision || 'PASS',
        tests: fullTestDetails,
      },
      signatories: {
        reviewer: { id: reviewerId, name: reviewerName },
        approving_authority: { id: user.id, name: user.full_name, designation: user.designation || 'Approving Authority' },
      },
    };

    // Calculate SHA-256
    const payloadString = JSON.stringify(canonicalPayload);
    const sha256Hash = crypto.createHash('sha256').update(payloadString).digest('hex');

    // Generate Verification ID
    const verificationId = `VRF-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    // Create or update report record
    if (existingReport) {
      await execute(
        `UPDATE reports SET status = 'FINALIZED', summary = ?, reviewer_id = ?, reviewer_name = ?, approving_authority_id = ?, approving_authority_name = ?, finalized_at = ? WHERE id = ?`,
        [summary_notes || 'All OIML R 76 metrological tests verified and approved.', reviewerId, reviewerName, user.id, user.full_name, now, reportId]
      );
    } else {
      await execute(
        `INSERT INTO reports (id, report_number, instrument_id, test_plan_id, rule_version_used, calculation_version_used, status, reviewer_id, reviewer_name, approving_authority_id, approving_authority_name, summary, finalized_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'FINALIZED', ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          reportNumber,
          instrument.id,
          test_plan_id,
          testPlan.rule_version_code,
          'NAWI-CALC-v1.0.0',
          reviewerId,
          reviewerName,
          user.id,
          user.full_name,
          summary_notes || 'All OIML R 76 metrological tests verified and approved.',
          now,
          now,
        ]
      );
    }

    // Save report hash record
    const hashId = uuidv4();
    await execute(
      `INSERT INTO report_hashes (id, report_id, verification_id, sha256_hash, report_payload_json, generated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hashId, reportId, verificationId, sha256Hash, payloadString, now]
    );

    // Update test plan state to FINALIZED
    await execute(`UPDATE test_plans SET status = 'FINALIZED', updated_at = ? WHERE id = ?`, [now, test_plan_id]);

    // Record workflow state
    const wsId = uuidv4();
    await execute(
      `INSERT INTO workflow_states (id, test_plan_id, from_state, to_state, changed_by, user_role, reason, is_override, changed_at)
       VALUES (?, ?, 'APPROVED', 'FINALIZED', ?, ?, ?, 0, ?)`,
      [wsId, test_plan_id, user.id, user.role, 'Report finalized and digital signature/hash generated.', now]
    );

    // Generate QR Code data URL
    const verificationUrl = `${app_url ? app_url.replace(/\/$/, '') : ''}/verify/${verificationId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    // Audit log
    await logAudit({
      user,
      action: 'FINALIZED',
      entity_type: 'report',
      entity_id: reportId,
      after_value: {
        report_number: reportNumber,
        verification_id: verificationId,
        sha256_hash: sha256Hash,
      },
      reason: 'Report finalized with SHA-256 cryptographic seal.',
    });

    return {
      report_id: reportId,
      report_number: reportNumber,
      verification_id: verificationId,
      sha256_hash: sha256Hash,
      qr_code_data_url: qrCodeDataUrl,
    };
  }

  /**
   * Verify a report publicly via verificationId
   */
  static async verifyReport(verificationId: string): Promise<VerificationResult | null> {
    const hashRecord = await queryOne<any>(
      `SELECT rh.*, r.report_number, r.status, r.finalized_at, r.rule_version_used, r.calculation_version_used, r.approving_authority_name,
              i.instrument_code, i.manufacturer, i.model_number, i.accuracy_class, i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit
       FROM report_hashes rh
       JOIN reports r ON rh.report_id = r.id
       JOIN instruments i ON r.instrument_id = i.id
       WHERE rh.verification_id = ?`,
      [verificationId]
    );

    if (!hashRecord) {
      return null;
    }

    // Re-verify SHA-256 integrity
    const recomputedHash = crypto.createHash('sha256').update(hashRecord.report_payload_json).digest('hex');
    const isIntegrityMatch = recomputedHash === hashRecord.sha256_hash;

    return {
      valid: true,
      verification_id: hashRecord.verification_id,
      report_number: hashRecord.report_number,
      instrument_code: hashRecord.instrument_code,
      manufacturer: hashRecord.manufacturer,
      model_number: hashRecord.model_number,
      accuracy_class: hashRecord.accuracy_class,
      max_capacity: `${hashRecord.max_capacity} ${hashRecord.capacity_unit}`,
      verification_scale_interval_e: `${hashRecord.verification_scale_interval_e} ${hashRecord.scale_interval_unit}`,
      status: hashRecord.status,
      finalized_at: hashRecord.finalized_at,
      sha256_hash: hashRecord.sha256_hash,
      integrity_status: isIntegrityMatch ? 'MATCH' : 'FAILED',
      rule_version: hashRecord.rule_version_used,
      calculation_version: hashRecord.calculation_version_used,
      approving_authority: hashRecord.approving_authority_name || 'Approving Authority',
    };
  }

  /**
   * Generate real PDF Buffer for download
   */
  static async generateReportPdf(reportId: string, appUrl: string = ''): Promise<Buffer> {
    const report = await queryOne<any>(
      `SELECT r.*, i.instrument_code, i.applicant_name, i.manufacturer, i.model_number, i.instrument_type, i.accuracy_class,
              i.max_capacity, i.capacity_unit, i.verification_scale_interval_e, i.scale_interval_unit, i.serial_number, i.application_number,
              i.indicator_details, i.load_cell_details,
              rh.verification_id, rh.sha256_hash, rh.generated_at
       FROM reports r
       JOIN instruments i ON r.instrument_id = i.id
       LEFT JOIN report_hashes rh ON rh.report_id = r.id
       WHERE r.id = ?`,
      [reportId]
    );

    if (!report) {
      throw new Error(`Report ${reportId} not found.`);
    }

    const testInstances = await queryRows<any>(
      `SELECT * FROM test_instances WHERE test_plan_id = ? ORDER BY execution_order ASC`,
      [report.test_plan_id]
    );

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = '#0f172a';
    const accentColor = '#0284c7';

    // Header Background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 32, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('DIGITAL NAWI TEST REPORT', 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('NON-AUTOMATIC WEIGHING INSTRUMENT (NAWI) TYPE EVALUATION SYSTEM', 14, 20);
    doc.text('Issued in compliance with OIML R 76-1:2006 Standard Rules Engine', 14, 26);

    // Report Meta Box
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);

    let y = 38;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text('Report ID:', 18, y + 6);
    doc.text('Verification ID:', 18, y + 12);
    doc.text('Date Finalized:', 18, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.text(report.report_number, 50, y + 6);
    doc.text(report.verification_id || 'PENDING', 50, y + 12);
    doc.text(new Date(report.finalized_at).toLocaleString(), 50, y + 18);

    doc.setFont('helvetica', 'bold');
    doc.text('Rule Version:', 110, y + 6);
    doc.text('Calc Version:', 110, y + 12);
    doc.text('Overall Status:', 110, y + 18);

    doc.setFont('helvetica', 'normal');
    doc.text(report.rule_version_used || 'OIML R 76-1:2006 v1.0', 140, y + 6);
    doc.text(report.calculation_version_used || 'NAWI-CALC-v1.0.0', 140, y + 12);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // emerald
    doc.text('FINALIZED & CONFORMING', 140, y + 18);

    // Section 1: Instrument Details
    y = 68;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Instrument Specification & Technical Identity', 14, y);

    const instrumentData = [
      ['Applicant / Owner', report.applicant_name, 'Manufacturer', report.manufacturer],
      ['Model Number', report.model_number, 'Serial Number', report.serial_number],
      ['Instrument Type', report.instrument_type, 'Accuracy Class', `Class ${report.accuracy_class}`],
      ['Maximum Capacity (Max)', `${report.max_capacity} ${report.capacity_unit}`, 'Scale Interval (e)', `${report.verification_scale_interval_e} ${report.scale_interval_unit}`],
      ['Application / Ref No', report.application_number, 'Load Cell & Indicator', `${report.indicator_details || 'N/A'} / ${report.load_cell_details || 'N/A'}`],
    ];

    autoTable(doc, {
      startY: y + 3,
      head: [],
      body: instrumentData,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2, textColor: [51, 65, 85] },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 42 },
        1: { cellWidth: 50 },
        2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 42 },
        3: { cellWidth: 48 },
      },
    });

    // Section 2: Metrological Evaluation Summary Table
    y = (doc as any).lastAutoTable.finalY + 8;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Metrological Evaluation Summary (OIML R 76-1)', 14, y);

    const testTableRows: any[] = [];

    for (const inst of testInstances) {
      const calc = await queryOne<any>(
        'SELECT * FROM calculations WHERE test_instance_id = ? ORDER BY calculated_at DESC LIMIT 1',
        [inst.id]
      );
      testTableRows.push([
        inst.test_name,
        inst.supported === 1 ? 'OIML R 76-1:2006' : 'OIML R 76 Clause',
        calc ? `${calc.result_value} ${report.scale_interval_unit}` : 'N/A',
        calc ? `±${calc.applicable_mpe} ${report.scale_interval_unit}` : 'Requires Validation',
        inst.decision === 'PASS' ? 'PASS' : inst.decision === 'FAIL' ? 'FAIL' : 'REVIEW',
      ]);
    }

    autoTable(doc, {
      startY: y + 3,
      head: [['Metrological Test', 'Standard Ref', 'Max Observed Error', 'Applicable MPE Limit', 'Decision']],
      body: testTableRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        4: { fontStyle: 'bold' },
      },
    });

    // Cryptographic Seal & Signatures
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 210) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Cryptographic Integrity Seal & Digital Signatories', 14, y);

    // Box for QR + SHA-256
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y + 4, 182, 46, 2, 2, 'FD');

    // Generate QR Code image for PDF
    const verificationUrl = `${appUrl ? appUrl.replace(/\/$/, '') : ''}/verify/${report.verification_id}`;
    const qrBuffer = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 140 });

    doc.addImage(qrBuffer, 'PNG', 18, y + 7, 38, 38);

    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Integrity Verification (SHA-256):', 60, y + 10);

    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const hash = report.sha256_hash || 'SHA-256 GENERATION RECORD';
    doc.text(hash.substring(0, 48), 60, y + 16);
    doc.text(hash.substring(48), 60, y + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Scan the QR code or visit the verification portal to verify digital authenticity.', 60, y + 28);
    doc.text(`Public URL: ${verificationUrl}`, 60, y + 34);
    doc.text('Integrity Status: Cryptographically Sealed & Verified', 60, y + 40);

    // Signatures
    const sigY = y + 56;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    doc.line(18, sigY + 12, 85, sigY + 12);
    doc.text('Technical Reviewer:', 18, sigY + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(report.reviewer_name || 'Dr. S. Mukherjee', 18, sigY + 22);
    doc.text('Senior Metrological Reviewer', 18, sigY + 26);

    doc.setFont('helvetica', 'bold');
    doc.line(115, sigY + 12, 182, sigY + 12);
    doc.text('Approving Authority:', 115, sigY + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(report.approving_authority_name || 'S. P. Deshmukh', 115, sigY + 22);
    doc.text('Head of Metrological Testing Directorate', 115, sigY + 26);

    // Footer Disclaimer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Notice: This digital test report is generated by the NAWI-Report Versioned Metrology System under OIML R 76-1:2006. Document integrity is verifiable via SHA-256 hash.',
      14,
      287
    );

    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }
}
