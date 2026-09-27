import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { TestPlan } from '../../types.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  FileCheck2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Eye,
  Send,
  Scale,
  ShieldCheck,
  Camera,
} from 'lucide-react';

interface InspectorDashboardProps {
  onOpenWorkspace: (testPlanId: string) => void;
}

export const InspectorDashboard: React.FC<InspectorDashboardProps> = ({ onOpenWorkspace }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTestPlans();
      setTestPlans(data);
    } catch (err: any) {
      console.error('Inspector dashboard load error:', err);
      setError(err.message || 'Failed to load inspector cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingScheduleCount = testPlans.filter((tp) => tp.status === 'DRAFT' || tp.status === 'APPLICATION_SUBMITTED').length;
  const pendingReviewCount = testPlans.filter(
    (tp) => tp.status === 'FIELD_TESTS_COMPLETED' || tp.status === 'SUBMITTED' || tp.status === 'UNDER_REVIEW'
  ).length;
  const recommendedCount = testPlans.filter((tp) => tp.status === 'INSPECTOR_RECOMMENDED' || tp.status === 'APPROVED').length;
  const finalizedCount = testPlans.filter((tp) => tp.status === 'FINALIZED').length;

  return (
    <div id="inspector-dashboard-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <span>Lead Legal Metrology Inspector</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span className="text-blue-700 font-normal">Supervisory & Technical Review</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome, {user?.full_name || 'Lead Inspector'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {user?.designation || 'Lead Legal Metrology Inspector'} &bull; Review instrument applications, assign field officers, review on-site GPS verification and calculation compliance, and recommend approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/inspector/inspections')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Eye className="w-4 h-4" />
            <span>Inspection Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Cards: Assigned Inspections, Pending Reviews, Completed Inspections, Pending Approvals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/inspector/inspections')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Applications to Schedule</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : pendingScheduleCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Assign date & personnel</p>
        </div>

        <div
          onClick={() => navigate('/inspector/review')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-amber-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-medium">Pending Technical Reviews</span>
            <Eye className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">
            {loading ? '...' : pendingReviewCount}
          </div>
          <p className="text-[11px] text-amber-600 mt-1">Audit field test data</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">Recommended for Approval</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-950 mt-2">
            {loading ? '...' : recommendedCount}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">Forwarded to Approving Authority</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-medium">Certificates Issued</span>
            <FileCheck2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-950 mt-2">
            {loading ? '...' : finalizedCount}
          </div>
          <p className="text-[11px] text-indigo-600 mt-1">Sealed & finalized records</p>
        </div>
      </div>

      {/* Two Column Layout: Technical Review Queue & Quick Inspector Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Review Queue */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Technical Review Queue</h2>
              </div>
              <button
                onClick={() => navigate('/inspector/review')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Review all ({pendingReviewCount}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading test cases...</div>
            ) : testPlans.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No inspection cases in queue.</div>
            ) : (
              <div className="space-y-3">
                {testPlans.slice(0, 5).map((tp) => (
                  <div
                    key={tp.id}
                    onClick={() => onOpenWorkspace(tp.id)}
                    className="p-3.5 rounded-xl border border-slate-150 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{tp.test_plan_code}</span>
                        <AccuracyClassBadge accuracyClass={tp.accuracy_class} />
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5 font-medium">
                        {tp.applicant_name} &bull; {tp.manufacturer} ({tp.model_number})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Capacity: {tp.max_capacity} {tp.capacity_unit} | Interval e: {tp.verification_scale_interval_e} {tp.scale_interval_unit}
                      </div>
                    </div>

                    <div className="text-right">
                      <WorkflowBadge status={tp.status} size="sm" />
                      <div className="mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenWorkspace(tp.id);
                          }}
                          className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          Review & Audit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Regulatory Responsibilities Checklist */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Lead Inspector Checklist</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-800">1. Stage 1: Schedule Inspection</div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Assign inspection date, target coordinates, field sub-inspector, and calibration specialist.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-800">2. Stage 2 & 3: Evidence Audit</div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Verify geofence distance calculation, photo selfie metadata, and standard weights calibration expiry.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="font-semibold text-slate-800">3. Stage 5: Final Recommendation</div>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Submit formal recommendation (RECOMMEND_APPROVAL / CORRECTION_REQUIRED / REJECT) with technical notes.
              </p>
            </div>
          </div>

          {/* Biometric Verification Card */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Inspector Face Identity</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Dr. Sunita Rao face template is enrolled. Used for cryptographic sign-off on inspection approvals.
            </p>
            <button
              onClick={() => navigate('/inspector/identity')}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Open Face Identity Portal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
