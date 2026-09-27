import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { TestPlan } from '../../types.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  MapPin,
  FileCheck2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Navigation,
  Scale,
  Calculator,
  PlayCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Camera,
  UserCheck,
} from 'lucide-react';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import { FaceEnrollmentModal } from '../biometrics/FaceEnrollmentModal.tsx';
import { LiveFaceVerificationModal } from '../biometrics/LiveFaceVerificationModal.tsx';

interface SubInspectorDashboardProps {
  onOpenWorkspace: (testPlanId: string) => void;
}

export const SubInspectorDashboard: React.FC<SubInspectorDashboardProps> = ({ onOpenWorkspace }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'TODAY' | 'PENDING' | 'COMPLETED'>('ALL');
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrolledTemplate, setEnrolledTemplate] = useState(user ? demoFaceStore.getStaffTemplate(user.id) : null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTestPlans();
      setTestPlans(data);
    } catch (err: any) {
      console.error('Tester load error:', err);
      setError(err.message || 'Failed to load assigned inspections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Metrics based on exact demo records
  const totalAssignedCount = testPlans.length;
  const todaysInspectionsCount = testPlans.filter((tp) => tp.status === 'INSPECTION_SCHEDULED').length;
  const pendingTestsCount = testPlans.filter((tp) => tp.status === 'SITE_VERIFIED' || tp.status === 'STANDARDS_VERIFIED').length;
  const completedTestsCount = testPlans.filter(
    (tp) =>
      tp.status === 'FIELD_TESTS_COMPLETED' ||
      tp.status === 'INSPECTOR_RECOMMENDED' ||
      tp.status === 'APPROVED' ||
      tp.status === 'FINALIZED'
  ).length;

  const filteredTestPlans = testPlans.filter((tp) => {
    if (filterMode === 'TODAY') return tp.status === 'INSPECTION_SCHEDULED';
    if (filterMode === 'PENDING') return tp.status === 'SITE_VERIFIED' || tp.status === 'STANDARDS_VERIFIED';
    if (filterMode === 'COMPLETED')
      return (
        tp.status === 'FIELD_TESTS_COMPLETED' ||
        tp.status === 'INSPECTOR_RECOMMENDED' ||
        tp.status === 'APPROVED' ||
        tp.status === 'FINALIZED'
      );
    return true;
  });

  return (
    <div id="tester-dashboard-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              Role: TESTER
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Sub-Inspector / Field Testing Specialist</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
            Tester Dashboard
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Logged in as <span className="font-semibold text-slate-800">{user?.full_name || 'Field Metrology Tester'}</span> &bull; Perform physical verification, record OIML test observations, execute automated MPE calculations, and submit proof packages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/sub-inspector/inspections')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Navigation className="w-4 h-4" />
            <span>Assigned Inspections</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {/* 4 Interactive Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Assigned Instruments */}
        <div
          onClick={() => setFilterMode('ALL')}
          className={`bg-white border rounded-2xl p-4.5 shadow-xs cursor-pointer transition-all ${
            filterMode === 'ALL'
              ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-700">Assigned Instruments</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : totalAssignedCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>3 Demo Records</span>
            {filterMode === 'ALL' && <span className="font-semibold text-emerald-600">Active</span>}
          </div>
        </div>

        {/* Card 2: Today's Inspections */}
        <div
          onClick={() => setFilterMode('TODAY')}
          className={`bg-white border rounded-2xl p-4.5 shadow-xs cursor-pointer transition-all ${
            filterMode === 'TODAY'
              ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold text-blue-900">Today's Inspections</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-950 mt-2">
            {loading ? '...' : todaysInspectionsCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-blue-700 mt-1">
            <span>Inspection Scheduled</span>
            {filterMode === 'TODAY' && <span className="font-semibold text-blue-600">Active</span>}
          </div>
        </div>

        {/* Card 3: Pending Tests */}
        <div
          onClick={() => setFilterMode('PENDING')}
          className={`bg-white border rounded-2xl p-4.5 shadow-xs cursor-pointer transition-all ${
            filterMode === 'PENDING'
              ? 'border-amber-500 ring-2 ring-amber-500/10 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold text-amber-900">Pending Tests</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-950 mt-2">
            {loading ? '...' : pendingTestsCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-amber-700 mt-1">
            <span>In testing & proof</span>
            {filterMode === 'PENDING' && <span className="font-semibold text-amber-600">Active</span>}
          </div>
        </div>

        {/* Card 4: Completed Tests */}
        <div
          onClick={() => setFilterMode('COMPLETED')}
          className={`bg-white border rounded-2xl p-4.5 shadow-xs cursor-pointer transition-all ${
            filterMode === 'COMPLETED'
              ? 'border-emerald-500 ring-2 ring-emerald-500/10 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold text-emerald-900">Completed Tests</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-950 mt-2">
            {loading ? '...' : completedTestsCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-700 mt-1">
            <span>Awaiting lead review</span>
            {filterMode === 'COMPLETED' && <span className="font-semibold text-emerald-600">Active</span>}
          </div>
        </div>
      </div>

      {/* Field Officer Identity & Live Verification Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
            enrolledTemplate ? 'bg-emerald-600' : 'bg-amber-500'
          }`}>
            {enrolledTemplate ? <ShieldCheck className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Field Staff Identity Verification
              </h3>
              {enrolledTemplate ? (
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Face Template Active</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Enrollment Required</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live device camera verification unlocks on-site field testing and cryptographically logs officer attendance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFaceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Face Verification</span>
          </button>
          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <span>{enrolledTemplate ? 'Re-enroll Face' : 'Enroll Face'}</span>
          </button>
          <button
            onClick={() => navigate('/tester/identity')}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
          >
            Identity Portal →
          </button>
        </div>
      </div>

      {/* Tester Active Workload: The 3 Demo Records */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-600" />
              <span>Assigned Field Verification Workload</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any instrument to open the test execution workspace, record observations, and verify MPE compliance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {filterMode !== 'ALL' && (
              <button
                onClick={() => setFilterMode('ALL')}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 underline mr-2"
              >
                Clear filter
              </button>
            )}
            <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
              Showing {filteredTestPlans.length} of {testPlans.length} records
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading assigned demo records...</div>
        ) : filteredTestPlans.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No instruments match this filter.{' '}
            <button onClick={() => setFilterMode('ALL')} className="text-blue-600 font-semibold underline">
              View all 3 records
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTestPlans.map((tp) => {
              const tests = tp.test_instances || [];
              const passedTestsCount = tests.filter((t) => t.decision === 'PASS').length;

              return (
                <div
                  key={tp.id}
                  id={`tester-record-${tp.instrument_code?.toLowerCase()}`}
                  onClick={() => onOpenWorkspace(tp.id)}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/10 transition-all cursor-pointer shadow-2xs space-y-4"
                >
                  {/* Top Row: Code, Name, Badges & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 border border-emerald-200 flex items-center justify-center font-mono font-bold text-sm shrink-0">
                        {tp.instrument_code?.slice(-3) || 'NAW'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {tp.instrument_code}
                          </span>
                          <span className="font-semibold text-sm text-slate-900">
                            {tp.manufacturer} &bull; {tp.model_number}
                          </span>
                          <AccuracyClassBadge accuracyClass={tp.accuracy_class} />
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span>Capacity: <strong className="text-slate-700">{tp.max_capacity} {tp.capacity_unit}</strong></span>
                          <span>&bull;</span>
                          <span>Interval (e): <strong className="text-slate-700">{tp.verification_scale_interval_e} {tp.scale_interval_unit}</strong></span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {tp.site_address?.split(',')[0] || 'Target Field Site'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <WorkflowBadge status={tp.status} size="md" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenWorkspace(tp.id);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-all"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Open Test Module</span>
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: 4 Standard OIML Tests Chips */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                        4 OIML Tests:
                      </span>
                      {tests.map((inst) => {
                        const isPass = inst.decision === 'PASS';
                        const isFail = inst.decision === 'FAIL';
                        return (
                          <div
                            key={inst.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenWorkspace(tp.id);
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                              isPass
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isFail
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                            title={`Click to open ${inst.test_name}`}
                          >
                            <span>{inst.test_name.split('.')[1] || inst.test_name}</span>
                            <span className="font-bold text-[10px]">
                              {isPass ? '✓ PASS' : isFail ? '✗ FAIL' : '● PENDING'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-right text-[11px] text-slate-500 font-mono">
                      Completion: <strong className="text-slate-700">{passedTestsCount} / {tests.length || 4} Tests Passed</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guide Card for Metrology Field Protocol */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>OIML R 76-1:2006 Testing Procedure</span>
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            How to Complete Field Test Verification
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            1. Open instrument workspace &rarr; 2. Complete Stage 2 GPS check &rarr; 3. In Stage 4 (OIML Tests & Proof), click each test module, enter or pre-fill raw observations, and run calculation engine &rarr; 4. Advance status to Field Tests Completed for inspector review.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <button
            onClick={() => onOpenWorkspace('tp-demo-002')}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Demo Test (EP-420)</span>
          </button>
        </div>
      </div>

      {/* Biometric Modals */}
      <LiveFaceVerificationModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        inspectionId="tp-demo-001"
        instrumentCode="DEMO-001"
        onVerificationSuccess={() => {
          setEnrolledTemplate(user ? demoFaceStore.getStaffTemplate(user.id) : null);
        }}
        onOpenEnrollment={() => setIsEnrollModalOpen(true)}
      />

      <FaceEnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnrollmentSuccess={() => {
          setEnrolledTemplate(user ? demoFaceStore.getStaffTemplate(user.id) : null);
          setIsEnrollModalOpen(false);
        }}
      />
    </div>
  );
};
