import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { TestPlan, FinalizedReport, AuditLog } from '../../types.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  ShieldCheck,
  Users,
  FileCheck2,
  Calendar,
  Lock,
  Clock,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FileText,
  UserPlus,
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenWorkspace: (testPlanId: string) => void;
  onOpenReportModal: (reportId: string) => void;
  onOpenRegisterModal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenWorkspace,
  onOpenReportModal,
  onOpenRegisterModal,
}) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [reports, setReports] = useState<FinalizedReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, uData, tpData, repData, audData] = await Promise.all([
        api.getDashboardStats(),
        api.getUsers(),
        api.getTestPlans(),
        api.getReports(),
        api.getAuditLogs({ limit: 6 }),
      ]);
      setStats(statsData);
      setUsersList(uData);
      setTestPlans(tpData);
      setReports(repData);
      setAuditLogs(audData);
    } catch (err: any) {
      console.error('Admin dashboard load error:', err);
      setError(err.message || 'Failed to load administrative analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingAppsCount = testPlans.filter((tp) => tp.status === 'DRAFT' || tp.status === 'APPLICATION_SUBMITTED').length;
  const scheduledCount = testPlans.filter((tp) => tp.status === 'INSPECTION_SCHEDULED' || tp.status === 'SITE_VERIFIED').length;

  return (
    <div id="admin-dashboard-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 uppercase tracking-wider">
            <span>National Metrology Directorate</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-700 font-normal">Executive Authority</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome, {user?.full_name || 'System Administrator'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Complete oversight of Legal Metrology workflows, field inspection assignments, user role access control, cryptographic SHA-256 certificate sealing, and immutable audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh System Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenRegisterModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <span>Register Instrument</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Cards: Total Applications, Pending Applications, Scheduled Inspections, Certificates Issued */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/admin/applications')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Applications</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : testPlans.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Instruments in evaluation</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-medium">Pending Applications</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">
            {loading ? '...' : pendingAppsCount}
          </div>
          <p className="text-[11px] text-amber-600 mt-1">Awaiting scheduling</p>
        </div>

        <div
          onClick={() => navigate('/admin/applications')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-emerald-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-medium">Scheduled Inspections</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-2">
            {loading ? '...' : scheduledCount}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1">Active field operations</p>
        </div>

        <div
          onClick={() => navigate('/admin/certificates')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-medium">Certificates Issued</span>
            <Lock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-950 mt-2">
            {loading ? '...' : stats?.total_finalized_reports || reports.length}
          </div>
          <p className="text-[11px] text-indigo-600 mt-1">SHA-256 sealed</p>
        </div>
      </div>

      {/* Two Column Layout: User / Role Management & Audit Trail Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: User & Role Management */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">User & Persona Role Management</h2>
              </div>
              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Manage all ({usersList.length}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading authorized users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="pb-2">Name & Email</th>
                      <th className="pb-2">Organization</th>
                      <th className="pb-2">Primary Role</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.slice(0, 5).map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5">
                          <div className="font-semibold text-slate-800">{u.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                        </td>
                        <td className="py-2.5 text-slate-600 text-[11px]">
                          {u.organization || 'Legal Metrology'}
                        </td>
                        <td className="py-2.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
                            {u.roles?.[0] || 'USER'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Immutable Audit Trail */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">Live Regulatory Audit Trail</h2>
              </div>
              <button
                onClick={() => navigate('/admin/audit')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
              >
                Full trail <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading audit trail...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No audit events recorded.</div>
            ) : (
              <div className="space-y-2.5 font-mono text-xs">
                {auditLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-150 flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[10px] text-slate-900 px-1.5 py-0.2 rounded bg-slate-200">
                          {log.action}
                        </span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[150px]">
                          {log.user_email}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-sans truncate max-w-xs">
                        {log.reason || `Action on ${log.entity_type}`}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
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
