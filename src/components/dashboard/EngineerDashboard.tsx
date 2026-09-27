import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { TestPlan } from '../../types.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  Cpu,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface EngineerDashboardProps {
  onOpenWorkspace: (testPlanId: string) => void;
}

export const EngineerDashboard: React.FC<EngineerDashboardProps> = ({ onOpenWorkspace }) => {
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
      console.error('Engineer dashboard load error:', err);
      setError(err.message || 'Failed to load calibration queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingStandardsCount = testPlans.filter(
    (tp) => tp.status === 'SITE_VERIFIED' || tp.status === 'INSPECTION_SCHEDULED'
  ).length;

  const pendingReviewCount = testPlans.filter(
    (tp) => tp.status === 'FIELD_TESTS_COMPLETED' || tp.status === 'SUBMITTED' || tp.status === 'UNDER_REVIEW'
  ).length;

  const correctionsCount = testPlans.filter((tp) => tp.status === 'CORRECTION_REQUIRED').length;
  const completedCount = testPlans.filter((tp) => tp.status === 'APPROVED' || tp.status === 'FINALIZED').length;

  return (
    <div id="engineer-dashboard-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 uppercase tracking-wider">
            <span>Metrology Engineer / Calibrator</span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            <span className="text-purple-700 font-normal">Technical Standards Authority</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome, {user?.full_name || 'Calibration Specialist'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {user?.organization || 'National Metrology Laboratory'} &bull; Verify working standard mass sets, check certificate traceability and uncertainty limits, and audit mathematical proof calculations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/engineer/calibration')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Cpu className="w-4 h-4" />
            <span>Calibration Queue</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Cards: Pending Calibration, Pending Reviews, Corrections, Completed Reviews */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/engineer/calibration')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-purple-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-xs font-medium">Pending Calibration</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-900 mt-2">
            {loading ? '...' : pendingStandardsCount}
          </div>
          <p className="text-[11px] text-purple-600 mt-1">Mass sets awaiting verification</p>
        </div>

        <div
          onClick={() => navigate('/engineer/review')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-medium">Pending Reviews</span>
            <FileCheck2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2">
            {loading ? '...' : pendingReviewCount}
          </div>
          <p className="text-[11px] text-blue-600 mt-1">Calculations to be verified</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-medium">Correction Requests</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-900 mt-2">
            {loading ? '...' : correctionsCount}
          </div>
          <p className="text-[11px] text-rose-600 mt-1">Active remediation tickets</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">Completed Reviews</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-950 mt-2">
            {loading ? '...' : completedCount}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">Approved metrology proofs</p>
        </div>
      </div>

      {/* Two Column Layout: Calibration Queue & Technical Test Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Calibration Queue */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-600" />
                <h2 className="text-base font-bold text-slate-900">Standard Weights Verification Queue</h2>
              </div>
              <button
                onClick={() => navigate('/engineer/calibration')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                View all queue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading queue...</div>
            ) : testPlans.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No test plans requiring standard verification.</div>
            ) : (
              <div className="space-y-3">
                {testPlans.slice(0, 5).map((tp) => (
                  <div
                    key={tp.id}
                    onClick={() => onOpenWorkspace(tp.id)}
                    className="p-3.5 rounded-xl border border-slate-150 hover:border-purple-300 hover:bg-purple-50/20 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{tp.test_plan_code}</span>
                        <AccuracyClassBadge accuracyClass={tp.accuracy_class} />
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5 font-medium">
                        {tp.manufacturer} ({tp.model_number}) &bull; Max {tp.max_capacity} {tp.capacity_unit}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Required standard: Class F1 / E2 weights with valid NABL certificate
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
                          className="px-2.5 py-1 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 inline-flex items-center gap-1 shadow-2xs"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Verify Standards
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Mathematical Calculation Audits */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">OIML R 76 Proof Standards</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900 font-mono text-[11px]">Formula A.4.4.3: Corrected Error (Ec)</div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-mono">
                E = I + 0.5e - ΔL - L<br />
                Ec = E - E0 &le; MPE
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900 font-mono text-[11px]">Clause A.4.6: Repeatability (Range)</div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-mono">
                Emax - Emin &le; |MPE| for 3 runs at 0.5 Max and 1.0 Max.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900 font-mono text-[11px]">Clause A.4.7: Eccentricity Loading</div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-mono">
                Maximum error at 4 corners at 1/3 Max &le; Table 6 MPE limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
