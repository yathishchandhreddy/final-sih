import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { TestPlan, TestInstance, Observation } from '../../types.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import { StatusStepper } from '../common/StatusStepper.tsx';
import {
  Scale,
  Calculator,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Send,
  Eye,
  FileCheck,
  Lock,
  Download,
  AlertTriangle,
  Info,
  ChevronRight,
  FileText,
  RotateCcw,
  Camera,
  UserCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import { LiveFaceVerificationModal } from '../biometrics/LiveFaceVerificationModal.tsx';
import { FaceEnrollmentModal } from '../biometrics/FaceEnrollmentModal.tsx';
import { EvidenceCaptureModal } from '../biometrics/EvidenceCaptureModal.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import { FaceVerificationService } from '../../services/faceVerificationService.ts';
import { FaceVerificationRecord, InspectionEvidence } from '../../types.ts';

interface TestPlanWorkspaceProps {
  testPlanId: string;
  onBack: () => void;
  onOpenReportModal: (reportId: string) => void;
}

export const TestPlanWorkspace: React.FC<TestPlanWorkspaceProps> = ({
  testPlanId,
  onBack,
  onOpenReportModal,
}) => {
  const { user, role, hasRole } = useAuth();
  const [testPlan, setTestPlan] = useState<TestPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [savingObs, setSavingObs] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Workspace Section Tab
  const [activeStageTab, setActiveStageTab] = useState<'schedule' | 'gps_selfie' | 'standards' | 'observations' | 'review'>('observations');

  // Interactive Form States
  const [scheduleData, setScheduleFormData] = useState({
    scheduled_date: new Date().toISOString().split('T')[0],
    site_address: 'Delhi Regional Metrology Laboratory, Sector 12',
    target_latitude: 28.6139,
    target_longitude: 77.2090,
    geofence_radius_m: 500,
  });

  const [gpsVerifying, setGpsVerifying] = useState(false);
  const [selfieCaptured, setSelfieCaptured] = useState<string | null>(null);

  const [standardWeightInput, setStandardWeightInput] = useState({
    class_type: 'M1 Class Standard Mass Set',
    serial_number: 'STD-M1-2025-089',
    cert_number: 'NPL/CAL/2025/4491',
    expiry_date: '2026-12-31',
    uncertainty_value: 0.001,
  });

  const [inspectorReviewData, setInspectorReviewData] = useState({
    recommendation: 'RECOMMEND_APPROVAL',
    notes: 'All physical markings, site GPS coordinates, standard weight certificates, and OIML R 76-1 error calculations verified conforming.',
  });

  // Biometric Face Verification & Evidence Modals
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [verificationRecord, setVerificationRecord] = useState<FaceVerificationRecord | null>(null);
  const [evidenceList, setEvidenceList] = useState<InspectionEvidence[]>([]);

  // Correction / Override Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    targetState: string;
    title: string;
    requiresReason: boolean;
    reasonText: string;
    isOverride: boolean;
  }>({
    isOpen: false,
    targetState: '',
    title: '',
    requiresReason: false,
    reasonText: '',
    isOverride: false,
  });

  const fetchTestPlan = async () => {
    try {
      const data = await api.getTestPlanById(testPlanId);
      setTestPlan(data);

      // Load latest face verification & evidence from demo store
      const latestVerif = demoFaceStore.getLatestVerificationForInspection(testPlanId);
      setVerificationRecord(latestVerif);
      setEvidenceList(demoFaceStore.getEvidenceForInspection(testPlanId));

      if (data.test_instances && data.test_instances.length > 0) {
        if (!selectedInstanceId || !data.test_instances.some((i) => i.id === selectedInstanceId)) {
          setSelectedInstanceId(data.test_instances[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch test plan:', err);
      setErrorMsg(err.message || 'Failed to load test plan workspace.');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceVerificationSuccess = async (record: FaceVerificationRecord) => {
    setVerificationRecord(record);
    try {
      await api.verifyPhoto(testPlanId, `live-verified:${record.id}`);
      await fetchTestPlan();
    } catch {
      // ignore
    }
    setSuccessMsg(`Live Face Match verified for ${record.user_name} (${record.confidence_score}% confidence).`);
    // If starting inspection, prompt or transition
    if (testPlan?.status === 'INSPECTION_SCHEDULED') {
      await executeTransition('SITE_VERIFIED', `Live Face verified for tester ${record.user_name} (${record.confidence_score}% match).`);
    }
  };

  const handleEvidenceCaptured = (ev: InspectionEvidence) => {
    setEvidenceList(demoFaceStore.getEvidenceForInspection(testPlanId));
    setSuccessMsg(`Inspection evidence saved: ${ev.evidence_type} (${ev.evidence_id}).`);
  };

  const handleDeleteEvidence = (evId: string) => {
    demoFaceStore.deleteEvidence(evId);
    setEvidenceList(demoFaceStore.getEvidenceForInspection(testPlanId));
    setSuccessMsg('Evidence record removed.');
  };

  useEffect(() => {
    fetchTestPlan();
  }, [testPlanId]);

  // Sync observations when selected instance changes
  const activeInstance: TestInstance | undefined = testPlan?.test_instances?.find(
    (i) => i.id === selectedInstanceId
  );

  useEffect(() => {
    if (activeInstance) {
      if (activeInstance.observations && activeInstance.observations.length > 0) {
        setObservations(activeInstance.observations);
      } else {
        // Initialize default empty rows
        setObservations([]);
      }
    }
  }, [selectedInstanceId, testPlan]);

  const isFinalized = testPlan?.status === 'FINALIZED';
  const canEditObservations =
    !isFinalized &&
    (testPlan?.status === 'DRAFT' ||
      testPlan?.status === 'CORRECTION_REQUIRED' ||
      testPlan?.status === 'STANDARDS_VERIFIED' ||
      testPlan?.status === 'SITE_VERIFIED' ||
      hasRole('ADMIN', 'SUB_INSPECTOR', 'INSPECTOR', 'ENGINEER', 'EVALUATOR'));

  const handleScheduleInspection = async () => {
    if (!testPlan) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.scheduleInspection(testPlan.id, scheduleData);
      setSuccessMsg(res.message);
      await fetchTestPlan();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule inspection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyGPSLocation = async () => {
    if (!testPlan) return;
    setGpsVerifying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const runGPSCheck = async (lat: number, lng: number) => {
      try {
        const res = await api.verifySiteGPS(testPlan.id, { latitude: lat, longitude: lng });
        setSuccessMsg(res.message);
        await fetchTestPlan();
      } catch (err: any) {
        setErrorMsg(err.message || 'GPS verification failed.');
      } finally {
        setGpsVerifying(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => runGPSCheck(pos.coords.latitude, pos.coords.longitude),
        () => runGPSCheck(28.6139, 77.2090),
        { timeout: 5000 }
      );
    } else {
      runGPSCheck(28.6139, 77.2090);
    }
  };

  const handleVerifyStandards = async () => {
    if (!testPlan) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.verifyStandards(testPlan.id, [standardWeightInput]);
      setSuccessMsg(res.message);
      await fetchTestPlan();
    } catch (err: any) {
      setErrorMsg(err.message || 'Standard weights verification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitInspectorReview = async () => {
    if (!testPlan) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.submitInspectorReview(testPlan.id, inspectorReviewData);
      setSuccessMsg(res.message);
      await fetchTestPlan();
    } catch (err: any) {
      setErrorMsg(err.message || 'Inspector review submission failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Pre-fill standard load points
  const handlePreFillObservations = (scenario: 'compliant' | 'fail') => {
    if (!testPlan || !activeInstance) return;

    const max = testPlan.max_capacity || 30;
    const e = testPlan.verification_scale_interval_e || 10;
    const unit = testPlan.capacity_unit || 'kg';

    if (activeInstance.test_code === 'ACC_WEIGHING') {
      // 5 standard load points: Min (20e), 500e, 2000e, 50% Max, 100% Max
      let p1 = Number(((20 * e) / (unit === 'kg' && testPlan.scale_interval_unit === 'g' ? 1000 : 1)).toFixed(3));
      let p2 = Number(((500 * e) / (unit === 'kg' && testPlan.scale_interval_unit === 'g' ? 1000 : 1)).toFixed(3));
      let p3 = Number(((2000 * e) / (unit === 'kg' && testPlan.scale_interval_unit === 'g' ? 1000 : 1)).toFixed(3));
      let p4 = Number((max * 0.5).toFixed(3));
      let p5 = Number(max.toFixed(3));

      const points = [p1, p2, p3, p4, p5];

      const newObs: Observation[] = points.map((p, idx) => {
        const errorOffset =
          scenario === 'compliant'
            ? idx === 0
              ? 0
              : idx === 1
              ? 0.005
              : idx === 2
              ? 0.008
              : 0.01
            : idx === 4
            ? 0.05 // Severe non-compliance exceeding MPE
            : 0.005;

        return {
          load_point: p,
          reference_mass: p,
          mass_unit: unit,
          indication_increasing: Number((p + errorOffset).toFixed(4)),
          indication_decreasing: Number((p + errorOffset).toFixed(4)),
          delta_l: 0,
          run_number: 1,
        };
      });
      setObservations(newObs);
    } else if (activeInstance.test_code === 'REPEATABILITY') {
      const halfMax = Number((max * 0.5).toFixed(3));
      const newObs: Observation[] = [1, 2, 3, 4, 5].map((run) => ({
        load_point: halfMax,
        reference_mass: halfMax,
        mass_unit: unit,
        indication_increasing:
          scenario === 'compliant'
            ? Number((halfMax + (run % 2 === 0 ? 0.002 : 0)).toFixed(4))
            : Number((halfMax + (run === 3 ? 0.04 : 0)).toFixed(4)),
        run_number: run,
      }));
      setObservations(newObs);
    } else if (activeInstance.test_code === 'ECCENTRICITY') {
      const thirdMax = Number((max / 3).toFixed(3));
      const positions = ['Center', 'Front Left', 'Back Left', 'Back Right', 'Front Right'];
      const newObs: Observation[] = positions.map((pos, idx) => ({
        load_point: thirdMax,
        reference_mass: thirdMax,
        mass_unit: unit,
        position_corner: pos,
        indication_increasing:
          scenario === 'compliant'
            ? Number((thirdMax + (idx === 1 ? 0.004 : idx === 3 ? -0.003 : 0)).toFixed(4))
            : Number((thirdMax + (idx === 2 ? 0.045 : 0)).toFixed(4)),
        run_number: idx + 1,
      }));
      setObservations(newObs);
    } else if (activeInstance.test_code === 'TARE_ZERO') {
      const tare1 = Number((max * 0.1).toFixed(3));
      const tare2 = Number((max * 0.3).toFixed(3));
      const newObs: Observation[] = [
        {
          load_point: 0,
          reference_mass: 0,
          mass_unit: unit,
          position_corner: 'Zero Setting Check',
          indication_increasing: 0,
          tare_applied: 0,
          run_number: 1,
        },
        {
          load_point: tare1,
          reference_mass: tare1,
          mass_unit: unit,
          position_corner: 'Tare Preset 1 (10% Max)',
          indication_increasing: Number((tare1 + (scenario === 'compliant' ? 0.001 : 0.04)).toFixed(4)),
          tare_applied: tare1,
          run_number: 2,
        },
        {
          load_point: tare2,
          reference_mass: tare2,
          mass_unit: unit,
          position_corner: 'Tare Preset 2 (30% Max)',
          indication_increasing: Number((tare2 + (scenario === 'compliant' ? 0.002 : 0.05)).toFixed(4)),
          tare_applied: tare2,
          run_number: 3,
        },
      ];
      setObservations(newObs);
    }
  };

  const handleSaveObservations = async () => {
    if (!activeInstance || !testPlan) return;
    setSavingObs(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.saveObservations(testPlan.id, activeInstance.id, observations);
      setSuccessMsg('Observations saved to database successfully.');
      await fetchTestPlan();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save observations.');
    } finally {
      setSavingObs(false);
    }
  };

  const handleRunCalculation = async () => {
    if (!activeInstance || !testPlan) return;
    setCalculating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // First save if any pending edits
      await api.saveObservations(testPlan.id, activeInstance.id, observations);
      // Run calculation engine
      const res = await api.calculateTest(testPlan.id, activeInstance.id);
      setSuccessMsg(`Calculation executed: Decision = ${res.decision}.`);
      await fetchTestPlan();
    } catch (err: any) {
      setErrorMsg(err.message || 'Calculation execution failed.');
    } finally {
      setCalculating(false);
    }
  };

  const executeTransition = async (toState: string, reason?: string, isOverride?: boolean) => {
    if (!testPlan) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.transitionWorkflow(testPlan.id, toState, reason, isOverride);
      setSuccessMsg(res.message);
      setModalState({ ...modalState, isOpen: false, reasonText: '' });
      await fetchTestPlan();
    } catch (err: any) {
      setErrorMsg(err.message || 'State transition failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeReport = async () => {
    if (!testPlan) return;
    setActionLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.finalizeReport(testPlan.id, 'All OIML R 76-1 tests verified and conforming.');
      setSuccessMsg('Report finalized and cryptographically sealed with SHA-256.');
      await fetchTestPlan();
      onOpenReportModal(res.report_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Report finalization failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading test workspace...
      </div>
    );
  }

  if (!testPlan) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
        <p className="text-sm font-semibold text-slate-700">Test plan not found.</p>
        <button onClick={onBack} className="mt-3 px-4 py-2 text-xs rounded-lg bg-sky-600 text-white">
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div id="test-plan-workspace" className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                ← Test Plans
              </button>
              <span className="text-slate-300">/</span>
              <span className="font-mono text-xs font-bold text-slate-800">{testPlan.test_plan_code}</span>
              {testPlan.test_plan_code?.startsWith('DEMO-') && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  DEMONSTRATION DATA
                </span>
              )}
              <WorkflowBadge status={testPlan.status} size="sm" />
            </div>

            <h1 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <span>{testPlan.manufacturer} - {testPlan.model_number}</span>
              <AccuracyClassBadge accuracyClass={testPlan.accuracy_class || 'III'} />
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1 font-mono">
              <span>Inst: <strong className="text-slate-800">{testPlan.instrument_code}</strong></span>
              <span>Max: <strong className="text-slate-800">{testPlan.max_capacity} {testPlan.capacity_unit}</strong></span>
              <span>e: <strong className="text-slate-800">{testPlan.verification_scale_interval_e} {testPlan.scale_interval_unit}</strong></span>
              <span>Rule Engine: <strong className="text-blue-800">{testPlan.rule_version_code} (OIML R 76-1:2006)</strong></span>
            </div>
          </div>

          {/* Workflow Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Tester: Start Field Verification (from Inspection Scheduled) */}
            {testPlan.status === 'INSPECTION_SCHEDULED' && hasRole('SUB_INSPECTOR', 'ADMIN') && (
              <button
                id="start-field-tests-btn"
                disabled={actionLoading}
                onClick={() => {
                  if (!verificationRecord) {
                    setIsFaceModalOpen(true);
                  } else {
                    executeTransition('SITE_VERIFIED', `Tester verified on-site presence with live face match (${verificationRecord.confidence_score}% match).`);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify Face & Start Testing</span>
              </button>
            )}

            {/* 2. Tester: Submit Field Tests Completed */}
            {(testPlan.status === 'SITE_VERIFIED' || testPlan.status === 'STANDARDS_VERIFIED' || testPlan.status === 'DRAFT' || testPlan.status === 'APPLICATION_SUBMITTED') &&
              hasRole('SUB_INSPECTOR', 'ADMIN') && (
                <button
                  id="submit-field-tests-btn"
                  disabled={actionLoading}
                  onClick={() => executeTransition('FIELD_TESTS_COMPLETED', 'Tester completed OIML test observations and submitted for lead review.')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Field Tests for Review
                </button>
              )}

            {/* 3. Lead Inspector: Review Field Tests Completed */}
            {(testPlan.status === 'FIELD_TESTS_COMPLETED' || testPlan.status === 'SUBMITTED' || testPlan.status === 'UNDER_REVIEW') &&
              hasRole('INSPECTOR', 'ADMIN') && (
                <>
                  <button
                    id="request-correction-btn"
                    disabled={actionLoading}
                    onClick={() =>
                      setModalState({
                        isOpen: true,
                        targetState: 'CORRECTION_REQUIRED',
                        title: 'Request Corrections from Field Officer',
                        requiresReason: true,
                        reasonText: '',
                        isOverride: false,
                      })
                    }
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors flex items-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Request Corrections
                  </button>

                  <button
                    id="approve-evaluation-btn"
                    disabled={actionLoading}
                    onClick={() => executeTransition('APPROVED', 'Lead Inspector verified all OIML calculations and recommended approval.')}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Recommend & Approve Metrological Evaluation
                  </button>
                </>
              )}

            {/* 4. Resubmit after corrections */}
            {testPlan.status === 'CORRECTION_REQUIRED' &&
              hasRole('SUB_INSPECTOR', 'ADMIN') && (
                <button
                  id="resubmit-test-plan-btn"
                  disabled={actionLoading}
                  onClick={() => executeTransition('FIELD_TESTS_COMPLETED', 'Field Officer updated observations and resubmitted.')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Resubmit for Review
                </button>
              )}

            {/* 5. Admin / Approver: Finalize & Seal */}
            {(testPlan.status === 'APPROVED' || testPlan.status === 'INSPECTOR_RECOMMENDED') &&
              hasRole('ADMIN', 'APPROVING_AUTHORITY') && (
                <button
                  id="finalize-report-btn"
                  disabled={actionLoading}
                  onClick={handleFinalizeReport}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Finalize & Cryptographically Seal Certificate
                </button>
              )}

            {/* 6. Finalized State View Report */}
            {isFinalized && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-700" />
                  Cryptographically Sealed (SHA-256)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-6">
          <StatusStepper currentStatus={testPlan.status} />
        </div>
      </div>

      {/* 4-Stat Metric Cards matching Professional Polish design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase font-bold mb-1">Instrument</p>
          <p className="text-sm font-semibold text-slate-900 truncate">
            {testPlan.manufacturer} - {testPlan.model_number}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{testPlan.instrument_code}</p>
        </div>
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase font-bold mb-1">Capacity (Max)</p>
          <p className="text-sm font-semibold text-slate-900">
            {testPlan.max_capacity} {testPlan.capacity_unit}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Min: {testPlan.min_capacity || (20 * testPlan.verification_scale_interval_e)} {testPlan.capacity_unit}
          </p>
        </div>
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase font-bold mb-1">Interval (e)</p>
          <p className="text-sm font-semibold text-slate-900">
            {testPlan.verification_scale_interval_e} {testPlan.scale_interval_unit}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            n = {testPlan.number_of_scale_intervals_n?.toLocaleString() || Math.round((testPlan.max_capacity / testPlan.verification_scale_interval_e)).toLocaleString()} e
          </p>
        </div>
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
          <p className="text-[11px] text-slate-500 uppercase font-bold mb-1">Accuracy Class</p>
          <p className="text-sm font-semibold text-blue-600">
            Class {testPlan.accuracy_class}
          </p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">OIML Table 3 Compliant</p>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* 5-Stage Inspection Workflow Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setActiveStageTab('schedule')}
          className={`flex-1 min-w-36 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeStageTab === 'schedule'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          1. Schedule
        </button>

        <button
          onClick={() => setActiveStageTab('gps_selfie')}
          className={`flex-1 min-w-36 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeStageTab === 'gps_selfie'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          2. GPS & Identity
        </button>

        <button
          onClick={() => setActiveStageTab('standards')}
          className={`flex-1 min-w-36 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeStageTab === 'standards'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          3. Standard Mass Set
        </button>

        <button
          onClick={() => setActiveStageTab('observations')}
          className={`flex-1 min-w-36 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeStageTab === 'observations'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          4. OIML Tests & Proof
        </button>

        <button
          onClick={() => setActiveStageTab('review')}
          className={`flex-1 min-w-36 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeStageTab === 'review'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          5. Review & Seal
        </button>
      </div>

      {/* Stage 1: Inspection Schedule View */}
      {activeStageTab === 'schedule' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Stage 1: Field Inspection Scheduling & Geo-fence Assignment
          </h2>
          <p className="text-xs text-slate-500">
            Lead Inspector configures field inspection schedule, target site GPS coordinates, geofence radius, and officer assignments.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Scheduled Inspection Date</label>
              <input
                type="date"
                value={scheduleData.scheduled_date}
                onChange={(e) => setScheduleFormData({ ...scheduleData, scheduled_date: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Site / Installation Address</label>
              <input
                type="text"
                value={scheduleData.site_address}
                onChange={(e) => setScheduleFormData({ ...scheduleData, site_address: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Target GPS Latitude</label>
              <input
                type="number"
                step="any"
                value={scheduleData.target_latitude}
                onChange={(e) => setScheduleFormData({ ...scheduleData, target_latitude: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Target GPS Longitude</label>
              <input
                type="number"
                step="any"
                value={scheduleData.target_longitude}
                onChange={(e) => setScheduleFormData({ ...scheduleData, target_longitude: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Allowed Geofence Radius (meters)</label>
              <input
                type="number"
                value={scheduleData.geofence_radius_m}
                onChange={(e) => setScheduleFormData({ ...scheduleData, geofence_radius_m: parseInt(e.target.value) || 500 })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleScheduleInspection}
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Schedule Inspection & Assign Personnel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: GPS Site & Identity Selfie Verification */}
      {activeStageTab === 'gps_selfie' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Stage 2: On-Site GPS Location & Officer Identity Capture
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GPS Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">1. On-Site GPS Location Verification</span>
                {testPlan.gps_status && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    testPlan.gps_status === 'IN_GEOFENCE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {testPlan.gps_status}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600">
                Verifies field officer position against target site ({testPlan.site_address || 'Regional Lab'}).
              </p>

              {testPlan.verified_latitude && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1 font-mono">
                  <div>Captured Lat: <strong>{testPlan.verified_latitude}</strong></div>
                  <div>Captured Lng: <strong>{testPlan.verified_longitude}</strong></div>
                  <div>Distance to Site: <strong className="text-blue-700">{testPlan.verified_distance_m} meters</strong></div>
                  <div className="text-[10px] text-slate-400">Timestamp: {new Date(testPlan.gps_verified_at!).toLocaleString()}</div>
                </div>
              )}

              <button
                type="button"
                disabled={gpsVerifying}
                onClick={handleVerifyGPSLocation}
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {gpsVerifying ? 'Checking Geolocation...' : 'Capture Live GPS & Verify Geofence'}
              </button>
            </div>

            {/* 2. Live Face Identity Verification Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>2. Field Officer Identity Verification</span>
                </span>
                {verificationRecord || testPlan.photo_verified_at ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>VERIFIED</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    REQUIRED
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Biometric verification confirms authorized on-site presence of the designated testing officer before executing metrological tests.
              </p>

              {/* Status Display */}
              {verificationRecord ? (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 text-xs space-y-1.5 font-mono shadow-2xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1 text-[11px]">
                    <span className="text-slate-500 font-sans">Verified Staff:</span>
                    <strong className="text-slate-900">{verificationRecord.user_name}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1 text-[11px]">
                    <span className="text-slate-500 font-sans">Role Scope:</span>
                    <span className="font-bold text-blue-700">{verificationRecord.role === 'SUB_INSPECTOR' ? 'TESTER' : verificationRecord.role}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1 text-[11px]">
                    <span className="text-slate-500 font-sans">Biometric Match:</span>
                    <span className="font-bold text-emerald-700">VERIFIED ({verificationRecord.confidence_score}%)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1 text-[11px]">
                    <span className="text-slate-500 font-sans">Live Presence:</span>
                    <span className="font-bold text-emerald-700">OPTICAL FLUX CONFIRMED</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-sans">Timestamp:</span>
                    <span className="text-slate-700">{new Date(verificationRecord.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-4 bg-white rounded-lg border border-slate-200 border-dashed">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto font-bold text-sm">
                      {user?.full_name?.charAt(0) || 'I'}
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{user?.full_name || 'Field Officer'}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{user?.role === 'SUB_INSPECTOR' ? 'TESTER' : user?.role || 'TESTER'}</div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsFaceModalOpen(true)}
                  className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>{verificationRecord ? 'Re-verify Live Face' : 'Launch Live Face Verification'}</span>
                </button>
                {!verificationRecord && (
                  <button
                    type="button"
                    onClick={async () => {
                      const effectiveUser = user || {
                        id: 'usr-tester-001',
                        full_name: 'Amit Patel',
                        role: 'SUB_INSPECTOR' as const,
                      };
                      demoFaceStore.ensureStaffTemplate(effectiveUser);
                      const rec = FaceVerificationService.createDemoVerificationRecord({
                        userId: effectiveUser.id,
                        userName: effectiveUser.full_name || 'Legal Metrology Officer',
                        role: effectiveUser.role || 'SUB_INSPECTOR',
                        inspectionId: testPlan.id,
                        instrumentCode: testPlan.instrument_code,
                        confidenceScore: 97.4,
                        source: 'DEMO_BYPASS',
                      });
                      demoFaceStore.recordVerification(rec);
                      await handleFaceVerificationSuccess(rec);
                    }}
                    className="py-2 px-3 text-xs font-semibold rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                    title="Instantly verify officer identity in demo mode without camera"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quick Verify (Demo)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="py-2 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  Enroll / Update Face
                </button>
              </div>
            </div>
          </div>

          {/* 3. On-Site Inspection Evidence Section */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>3. On-Site Photographic Evidence (Camera Capture)</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Live camera photos of instrument nameplate, standard mass sets, and verification seals.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEvidenceModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Capture Evidence</span>
              </button>
            </div>

            {evidenceList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-slate-200 border-dashed">
                No inspection photographic evidence captured yet. Click "Capture Evidence" to take photos using your device camera.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {evidenceList.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-100 text-blue-800 text-[10px]">
                        {ev.evidence_type.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleDeleteEvidence(ev.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                        title="Delete Evidence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {ev.image_reference ? (
                      <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-900 border border-slate-200">
                        <img src={ev.image_reference} alt={ev.evidence_type} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-4/3 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-mono text-[10px]">
                        [EVIDENCE CAPTURE]
                      </div>
                    )}

                    <div className="space-y-0.5 text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-800 truncate">{ev.notes || ev.evidence_id}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(ev.captured_at).toLocaleString()} &bull; {ev.captured_by_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage 3: Calibrator Standard Weights */}
      {activeStageTab === 'standards' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            Stage 3: Calibrator / Standard Weights Verification
          </h2>
          <p className="text-xs text-slate-500">
            Calibration Engineer records standard weight certificates (Class E2/F1/M1), serial numbers, and measurement uncertainty.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Standard Mass Class / Type</label>
              <input
                type="text"
                value={standardWeightInput.class_type}
                onChange={(e) => setStandardWeightInput({ ...standardWeightInput, class_type: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Weight Set Serial Number</label>
              <input
                type="text"
                value={standardWeightInput.serial_number}
                onChange={(e) => setStandardWeightInput({ ...standardWeightInput, serial_number: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Calibration Certificate Number</label>
              <input
                type="text"
                value={standardWeightInput.cert_number}
                onChange={(e) => setStandardWeightInput({ ...standardWeightInput, cert_number: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Certificate Expiry Date</label>
              <input
                type="date"
                value={standardWeightInput.expiry_date}
                onChange={(e) => setStandardWeightInput({ ...standardWeightInput, expiry_date: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Measurement Uncertainty (U)</label>
              <input
                type="number"
                step="any"
                value={standardWeightInput.uncertainty_value}
                onChange={(e) => setStandardWeightInput({ ...standardWeightInput, uncertainty_value: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleVerifyStandards}
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verify & Lock Standard Mass Set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 5: Inspector Technical Review & Final Seal */}
      {activeStageTab === 'review' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            Stage 5: Lead Inspector Recommendation & Cryptographic Seal
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Lead Inspector Recommendation</label>
              <select
                value={inspectorReviewData.recommendation}
                onChange={(e) => setInspectorReviewData({ ...inspectorReviewData, recommendation: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-semibold"
              >
                <option value="RECOMMEND_APPROVAL">RECOMMEND APPROVAL (Type Evaluation Conforming)</option>
                <option value="CORRECTION_REQUIRED">REQUEST CORRECTION (Observations / Data Incomplete)</option>
                <option value="RECOMMEND_REJECT">RECOMMEND REJECTION (Non-conforming to OIML R 76)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Technical Review Notes & Summary</label>
              <textarea
                rows={3}
                value={inspectorReviewData.notes}
                onChange={(e) => setInspectorReviewData({ ...inspectorReviewData, notes: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSubmitInspectorReview}
                className="py-2.5 px-4 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Lead Inspector Recommendation
              </button>

              {hasRole('APPROVING_AUTHORITY', 'ADMIN') && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleFinalizeReport}
                  className="py-2.5 px-4 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Seal & Issue Certificate (SHA-256)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage 4: Observation Grid & Proof Engine (Default) */}
      {activeStageTab === 'observations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Test Instances Navigator */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Metrological Test Modules</span>
              <span className="text-[10px] font-mono lowercase">OIML R 76-1</span>
            </h2>

            <div className="space-y-2">
              {testPlan.test_instances?.map((inst) => {
                const isSelected = inst.id === selectedInstanceId;
                const isSupported = inst.supported === true || inst.supported === 1;

                return (
                  <div
                    key={inst.id}
                    id={`select-test-${inst.test_code.toLowerCase()}`}
                    onClick={() => setSelectedInstanceId(inst.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50/80 border-sky-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{inst.test_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {inst.oiml_clause || 'Clause A.4'}
                        </div>
                      </div>

                      <div>
                        {inst.decision === 'PASS' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            PASS
                          </span>
                        )}
                        {inst.decision === 'FAIL' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            FAIL
                          </span>
                        )}
                        {inst.decision === 'PENDING' && isSupported && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            PENDING
                          </span>
                        )}
                        {!isSupported && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            Requires validation
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workflow State History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              State Machine Audit History
            </h2>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {testPlan.workflow_history?.map((ws, i) => (
                <div key={ws.id || i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {ws.from_state} → {ws.to_state}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ws.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    By: <span className="font-medium text-slate-700">{ws.changed_by_name || 'Metrology Officer'}</span> ({ws.user_role})
                  </div>
                  {ws.reason && <div className="text-[11px] text-slate-600 mt-0.5 italic">"{ws.reason}"</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Observation Entry & Explainable Calculation Engine */}
        <div className="lg:col-span-8 space-y-6">
          {activeInstance && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Active Test Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{activeInstance.test_name}</h2>
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-xs font-mono font-semibold">
                      {activeInstance.test_code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeInstance.definition_desc || 'Evaluation under OIML R 76-1 requirements.'}
                  </p>
                </div>

                {/* Pre-fill Helpers */}
                {canEditObservations && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      id="prefill-compliant-btn"
                      onClick={() => handlePreFillObservations('compliant')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1"
                      title="Load standard conforming test observations"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                      Pre-fill Compliant
                    </button>
                    <button
                      type="button"
                      id="prefill-fail-btn"
                      onClick={() => handlePreFillObservations('fail')}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1"
                      title="Load non-conforming test observations to test failure detection"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Pre-fill Non-Conforming
                    </button>
                  </div>
                )}
              </div>

              {/* Unsupported Test Warning */}
              {(activeInstance.supported === false || activeInstance.supported === 0) && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    Extended Metrological Test (Requires Regulatory Validation)
                  </div>
                  <p className="mt-1 text-slate-700">
                    This test clause ({activeInstance.oiml_clause}) requires climatic chamber hardware fixtures or power disturbance generator testing. In this version, the rule engine records this status conservatively without generating unverified synthetic verdicts.
                  </p>
                </div>
              )}

              {/* Observation Table */}
              {(activeInstance.supported === true || activeInstance.supported === 1) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Raw Metrological Observations Grid
                    </h3>
                    {canEditObservations && (
                      <button
                        type="button"
                        onClick={() => {
                          setObservations([
                            ...observations,
                            {
                              load_point: 0,
                              reference_mass: 0,
                              mass_unit: testPlan.capacity_unit || 'kg',
                              indication_increasing: 0,
                              indication_decreasing: 0,
                              run_number: observations.length + 1,
                            },
                          ]);
                        }}
                        className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                      >
                        + Add Load Point Row
                      </button>
                    )}
                  </div>

                  {observations.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 p-6">
                      <Scale className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-600 font-medium">No observation rows entered yet.</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Click "Pre-fill Compliant" or "+ Add Load Point Row" to record test indications.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="px-3 py-2.5">#</th>
                            {(activeInstance.test_code === 'ECCENTRICITY' || activeInstance.test_code === 'TARE_ZERO') && (
                              <th className="px-3 py-2.5">Position / Step</th>
                            )}
                            <th className="px-3 py-2.5">Reference Load (L)</th>
                            <th className="px-3 py-2.5">Indication Increasing (I↑)</th>
                            {activeInstance.test_code === 'ACC_WEIGHING' && (
                              <th className="px-3 py-2.5">Indication Decreasing (I↓)</th>
                            )}
                            {canEditObservations && <th className="px-3 py-2.5 text-right">Remove</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {observations.map((obs, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                              {(activeInstance.test_code === 'ECCENTRICITY' || activeInstance.test_code === 'TARE_ZERO') && (
                                <td className="px-3 py-2">
                                  {canEditObservations ? (
                                    <input
                                      type="text"
                                      value={obs.position_corner || ''}
                                      onChange={(e) => {
                                        const updated = [...observations];
                                        updated[idx].position_corner = e.target.value;
                                        setObservations(updated);
                                      }}
                                      placeholder={activeInstance.test_code === 'TARE_ZERO' ? 'Step / Tare Preset' : 'Position (e.g. Center)'}
                                      className="px-2 py-1 rounded border border-slate-300 text-xs w-36"
                                    />
                                  ) : (
                                    <span className="font-medium text-slate-700">{obs.position_corner || 'Center'}</span>
                                  )}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                {canEditObservations ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      value={obs.reference_mass}
                                      onChange={(e) => {
                                        const updated = [...observations];
                                        updated[idx].reference_mass = parseFloat(e.target.value) || 0;
                                        updated[idx].load_point = parseFloat(e.target.value) || 0;
                                        setObservations(updated);
                                      }}
                                      className="px-2 py-1 rounded border border-slate-300 text-xs font-mono w-24"
                                    />
                                    <span className="text-slate-500 text-[11px]">{obs.mass_unit}</span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-slate-800">
                                    {obs.reference_mass} {obs.mass_unit}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {canEditObservations ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      value={obs.indication_increasing ?? ''}
                                      onChange={(e) => {
                                        const updated = [...observations];
                                        updated[idx].indication_increasing = parseFloat(e.target.value) || 0;
                                        setObservations(updated);
                                      }}
                                      className="px-2 py-1 rounded border border-slate-300 text-xs font-mono w-24"
                                    />
                                    <span className="text-slate-500 text-[11px]">{obs.mass_unit}</span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-slate-800">
                                    {obs.indication_increasing ?? 'N/A'} {obs.mass_unit}
                                  </span>
                                )}
                              </td>
                              {activeInstance.test_code === 'ACC_WEIGHING' && (
                                <td className="px-3 py-2">
                                  {canEditObservations ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="any"
                                        value={obs.indication_decreasing ?? ''}
                                        onChange={(e) => {
                                          const updated = [...observations];
                                          updated[idx].indication_decreasing = parseFloat(e.target.value) || 0;
                                          setObservations(updated);
                                        }}
                                        className="px-2 py-1 rounded border border-slate-300 text-xs font-mono w-24"
                                      />
                                      <span className="text-slate-500 text-[11px]">{obs.mass_unit}</span>
                                    </div>
                                  ) : (
                                    <span className="font-mono text-slate-800">
                                      {obs.indication_decreasing ?? 'N/A'} {obs.mass_unit}
                                    </span>
                                  )}
                                </td>
                              )}
                              {canEditObservations && (
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = observations.filter((_, i) => i !== idx);
                                      setObservations(updated);
                                    }}
                                    className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                                  >
                                    ×
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Actions for observation / calculation */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    {canEditObservations && (
                      <button
                        type="button"
                        id="save-obs-btn"
                        disabled={savingObs || observations.length === 0}
                        onClick={handleSaveObservations}
                        className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingObs ? 'Saving...' : 'Save Observations'}
                      </button>
                    )}

                    {!isFinalized && (
                      <button
                        type="button"
                        id="execute-calc-btn"
                        disabled={calculating || observations.length === 0}
                        onClick={handleRunCalculation}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        {calculating ? 'Executing Engine...' : 'Run Backend OIML R 76 Calculation'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Explainable Calculation Results Panel matching Professional Polish Design */}
              {activeInstance.calculation && (
                <div className="mt-6 bg-white border border-slate-200 rounded-xl flex flex-col shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-900">
                      <Calculator className="w-4 h-4 text-blue-600" />
                      Explainable Calculation Engine
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">
                        Rule: {activeInstance.calculation.calculation_version || 'OIML R 76-1:2006'}
                      </span>
                      {activeInstance.calculation.decision === 'PASS' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> PASS
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-700" /> FAIL
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Step by step explainable cards */}
                    {activeInstance.calculation.calculation_steps && activeInstance.calculation.calculation_steps.length > 0 ? (
                      <div className="space-y-4">
                        {activeInstance.calculation.calculation_steps.map((step: any) => (
                          <div key={step.step_number} className="flex items-start gap-3.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {step.step_number}
                            </div>
                            <div className="flex-1 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                              <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                                {step.label || `Step ${step.step_number}`}
                              </p>
                              <p className="text-xs text-slate-600 mb-1.5">{step.description}</p>
                              <div className="font-mono text-xs text-slate-800 bg-white px-2.5 py-1.5 rounded border border-slate-200 mb-1">
                                {step.formula}
                              </div>
                              <p className="text-xs font-semibold text-blue-900 mt-1">
                                Intermediate Result: <span className="font-mono">{step.result}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Fallback steps representation */}
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">1</div>
                          <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Formula: Error Calculation</p>
                            <code className="text-sm text-slate-700">E = I - L (Clause A.4.4.1)</code>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Final Compliance Decision card */}
                    <div className="flex items-start gap-3.5 pt-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        activeInstance.calculation.decision === 'PASS'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        {activeInstance.calculation.calculation_steps ? activeInstance.calculation.calculation_steps.length + 1 : '3'}
                      </div>
                      <div className={`flex-1 p-4 rounded-lg border ${
                        activeInstance.calculation.decision === 'PASS'
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50/70 border-rose-200 text-rose-950'
                      }`}>
                        <div className="flex justify-between items-start mb-1.5">
                          <p className={`text-[10px] uppercase font-bold tracking-wider ${
                            activeInstance.calculation.decision === 'PASS' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            Final Compliance Decision
                          </p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${
                            activeInstance.calculation.decision === 'PASS'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}>
                            {activeInstance.calculation.decision}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed font-medium">
                          {activeInstance.calculation.decision === 'PASS'
                            ? `Observed maximum error of ${activeInstance.calculation.result_value} ${testPlan.scale_interval_unit} is strictly within the maximum permissible error limit (±${activeInstance.calculation.applicable_mpe} ${testPlan.scale_interval_unit}). Conforms to OIML R 76-1:2006 Table 6.`
                            : `Calculated error of ${activeInstance.calculation.result_value} ${testPlan.scale_interval_unit} exceeds the maximum permissible error limit of ±${activeInstance.calculation.applicable_mpe} ${testPlan.scale_interval_unit}. Test instance non-conforming.`}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 font-mono text-[11px] text-slate-600 flex items-center justify-between">
                          <span>Comparison: {activeInstance.calculation.comparison_text}</span>
                          <span className="text-slate-400">Timestamp: {new Date(activeInstance.calculation.calculated_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Reason / Correction / Override Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900">{modalState.title}</h3>
            <p className="text-xs text-slate-600">
              {modalState.requiresReason
                ? 'Please specify a clear, traceable technical note or justification for the audit log.'
                : 'Confirm state transition for this evaluation record.'}
            </p>

            {modalState.requiresReason && (
              <textarea
                required
                rows={3}
                value={modalState.reasonText}
                onChange={(e) => setModalState({ ...modalState, reasonText: e.target.value })}
                placeholder="Enter technical justification or required correction..."
                className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalState({ ...modalState, isOpen: false })}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalState.requiresReason && !modalState.reasonText.trim()}
                onClick={() => executeTransition(modalState.targetState, modalState.reasonText, modalState.isOverride)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 text-white disabled:opacity-50"
              >
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Modals */}
      <LiveFaceVerificationModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        inspectionId={testPlan.id}
        instrumentCode={testPlan.instrument_code}
        onVerificationSuccess={handleFaceVerificationSuccess}
        onOpenEnrollment={() => setIsEnrollModalOpen(true)}
      />

      <FaceEnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnrollmentSuccess={() => {
          setIsEnrollModalOpen(false);
          setSuccessMsg('Staff facial biometric template enrolled. You may now perform live identity verification.');
        }}
      />

      <EvidenceCaptureModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        inspectionId={testPlan.id}
        faceVerificationId={verificationRecord?.id || 'fv-unverified'}
        onEvidenceCaptured={handleEvidenceCaptured}
      />
    </div>
  );
};
