import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../api/client.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  Scale,
  PlusCircle,
  FileCheck2,
  FileText,
  ShieldCheck,
  Clock,
  Send,
  Eye,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenRegisterModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenRegisterModal }) => {
  const { user, role, hasRole } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard metrics:', err);
      setError(err.message || 'Failed to load live database metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const counts = stats?.workflow_counts || {
    DRAFT: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    CORRECTION_REQUIRED: 0,
    APPROVED: 0,
    FINALIZED: 0,
  };

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <span>National Metrology Evaluation Dashboard</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-700">Live Database Connected</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome, {user?.full_name || 'Metrology Officer'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Non-Automatic Weighing Instrument (NAWI) type evaluation platform under standard{' '}
            <strong className="text-slate-800">OIML R 76-1:2006</strong>. Backend rule engine, multi-role review, and SHA-256 report verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="dashboard-refresh-btn"
            onClick={fetchDashboardStats}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>

          {hasRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN') && (
            <button
              id="dashboard-register-btn"
              onClick={onOpenRegisterModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              Register Instrument
            </button>
          )}
        </div>
      </div>

      {/* Role-Specific Action Prompt */}
      <div className="bg-[#0F172A] text-white rounded-xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono text-blue-400 uppercase">
              Current Persona Role: {role}
            </div>
            <div className="text-sm font-semibold text-white mt-0.5">
              {role === 'APPLICANT' && 'Instrument Owner: Register weighing instruments, submit applications for metrological inspection, and track certificate status.'}
              {role === 'SUB_INSPECTOR' && 'Field Sub-Inspector: Perform live on-site GPS verification, capture inspector selfies, and record raw test observations.'}
              {role === 'ENGINEER' && 'Calibrator / Specialist: Verify standard weight sets, calibration certificate validity, and uncertainty values.'}
              {role === 'INSPECTOR' && 'Lead Inspector: Schedule field inspections, review field observations, and submit approval recommendations.'}
              {role === 'APPROVING_AUTHORITY' && 'Approving Authority: Final technical audit, sign off approved evaluations, generate SHA-256 seals & issue certificates.'}
              {role === 'ADMIN' && 'System Administrator: Full privilege across all workflow states, rule versions, user management, and overrides.'}
              {role === 'EVALUATOR' && 'Evaluator (Legacy): Record test observations and execute automated OIML R 76 calculations.'}
              {role === 'REVIEWER' && 'Reviewer (Legacy): Technical verification, correction requests, and approval recommendations.'}
              {role === 'READ_ONLY' && 'Auditor View: Access reports, verify SHA-256 integrity, and inspect audit logs.'}
            </div>
          </div>
        </div>

        <button
          id="dashboard-primary-role-action"
          onClick={() => {
            if (role === 'APPROVING_AUTHORITY' || role === 'READ_ONLY') {
              onNavigate('reports');
            } else {
              onNavigate('testplans');
            }
          }}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap shadow-xs flex items-center gap-1.5 self-end sm:self-auto"
        >
          {role === 'APPROVING_AUTHORITY' ? 'View Approved Reports' : 'Open Test Workspace'}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Real Live Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Instruments */}
        <div
          onClick={() => onNavigate('instruments')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Instruments</span>
            <Scale className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : stats?.total_instruments || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            Registered records
          </div>
        </div>

        {/* Draft State */}
        <div
          onClick={() => onNavigate('testplans', { status: 'DRAFT' })}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-slate-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Draft</span>
            <Clock className="w-4 h-4 text-slate-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">
            {loading ? '...' : counts.DRAFT + (counts.CORRECTION_REQUIRED || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {counts.CORRECTION_REQUIRED ? `${counts.CORRECTION_REQUIRED} in correction` : 'Initial testing'}
          </div>
        </div>

        {/* Submitted State */}
        <div
          onClick={() => onNavigate('testplans', { status: 'SUBMITTED' })}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700">Submitted</span>
            <Send className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2">
            {loading ? '...' : counts.SUBMITTED}
          </div>
          <div className="text-[11px] text-blue-600 mt-1">Ready for review</div>
        </div>

        {/* Under Review */}
        <div
          onClick={() => onNavigate('testplans', { status: 'UNDER_REVIEW' })}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-amber-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">Under Review</span>
            <Eye className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">
            {loading ? '...' : counts.UNDER_REVIEW}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Technical audit</div>
        </div>

        {/* Approved State */}
        <div
          onClick={() => onNavigate('testplans', { status: 'APPROVED' })}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2">
            {loading ? '...' : counts.APPROVED}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Ready for sign-off</div>
        </div>

        {/* Finalized & Sealed */}
        <div
          onClick={() => onNavigate('reports')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-400 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-700">Finalized</span>
            <Lock className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-indigo-950 mt-2">
            {loading ? '...' : stats?.total_finalized_reports || counts.FINALIZED}
          </div>
          <div className="text-[11px] text-indigo-600 mt-1">SHA-256 Sealed</div>
        </div>
      </div>

      {/* Two Column Layout: Recent Test Plans & Live Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Test Plans */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Active Test Plans</h3>
              </div>
              <button
                onClick={() => onNavigate('testplans')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading test plans...</div>
            ) : !stats?.recent_test_plans || stats.recent_test_plans.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-600">No test plans found in database.</p>
                <p className="text-xs text-slate-400 mt-1">Register an instrument to generate an initial OIML R 76 test plan.</p>
                {hasRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN') && (
                  <button
                    id="dashboard-empty-register-btn"
                    onClick={onOpenRegisterModal}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Register Now
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.recent_test_plans.map((tp: any) => (
                  <div
                    key={tp.id}
                    onClick={() => onNavigate('testplans', { testPlanId: tp.id })}
                    className="p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {tp.test_plan_code}
                        </span>
                        <AccuracyClassBadge accuracyClass={tp.accuracy_class} />
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {tp.manufacturer} - {tp.model_number} (Max: {tp.max_capacity} {tp.capacity_unit})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <WorkflowBadge status={tp.status} size="sm" />
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Immutable Audit Stream */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">System Audit Trail</h3>
              </div>
              <button
                onClick={() => onNavigate('audit')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
              >
                View full audit log <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading audit logs...</div>
            ) : !stats?.recent_audit_logs || stats.recent_audit_logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No audit events recorded yet.</div>
            ) : (
              <div className="space-y-2 font-mono">
                {stats.recent_audit_logs.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-150 text-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 px-1.5 py-0.2 rounded bg-slate-200 text-[10px]">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[180px]">
                          {log.user_email} ({log.user_role})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">
                        {log.reason || `Action on ${log.entity_type}`}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
