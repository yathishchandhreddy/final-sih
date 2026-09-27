import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { Instrument, TestPlan, FinalizedReport } from '../../types.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  Scale,
  PlusCircle,
  FileCheck2,
  FileText,
  Clock,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Send,
} from 'lucide-react';

interface OwnerDashboardProps {
  onOpenRegisterModal: () => void;
  onOpenWorkspace: (testPlanId: string) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  onOpenRegisterModal,
  onOpenWorkspace,
}) => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [reports, setReports] = useState<FinalizedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instData, tpData, repData] = await Promise.all([
        api.getInstruments({ created_by: user?.id }),
        api.getTestPlans({ created_by: user?.id }),
        api.getReports(),
      ]);
      setInstruments(instData);
      setTestPlans(tpData);
      setReports(repData);
    } catch (err: any) {
      console.error('Owner dashboard data load error:', err);
      setError(err.message || 'Failed to load instrument records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const pendingCount = testPlans.filter(
    (tp) => tp.status === 'DRAFT' || tp.status === 'CORRECTION_REQUIRED' || tp.status === 'SUBMITTED'
  ).length;

  return (
    <div id="owner-dashboard-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <span>Instrument Owner Portal</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-700 font-normal">Active Session</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome, {user?.full_name || 'Instrument Owner'}
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            {user?.organization || 'Apex Industrial Scales'} &bull; Register weighing instruments, submit applications for official metrological inspection, and download certified reports.
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
            id="owner-register-instrument-btn"
            onClick={onOpenRegisterModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
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

      {/* 4 Cards: My Instruments, Applications, Pending Actions, Certificates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/owner/instruments')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">My Instruments</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : instruments.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Registered weighing devices</p>
        </div>

        <div
          onClick={() => navigate('/owner/applications')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-medium">Applications</span>
            <Send className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2">
            {loading ? '...' : testPlans.length}
          </div>
          <p className="text-[11px] text-blue-600 mt-1">Submitted & scheduled</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-medium">Pending Actions</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-2">
            {loading ? '...' : pendingCount}
          </div>
          <p className="text-[11px] text-amber-600 mt-1">Awaiting inspection / review</p>
        </div>

        <div
          onClick={() => navigate('/admin/certificates')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-300 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-xs font-medium">Certificates</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-950 mt-2">
            {loading ? '...' : reports.length}
          </div>
          <p className="text-[11px] text-indigo-600 mt-1">SHA-256 sealed & verified</p>
        </div>
      </div>

      {/* Main Sections: Instruments Table & Recent Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Instruments List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">My Registered Instruments</h2>
              </div>
              <button
                onClick={() => navigate('/owner/instruments')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all ({instruments.length}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading instruments...</div>
            ) : instruments.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Scale className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-600">No instruments registered yet.</p>
                <button
                  onClick={onOpenRegisterModal}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium inline-flex items-center gap-1 mt-2"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Register First Instrument
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="pb-2">Instrument Code</th>
                      <th className="pb-2">Model & Serial</th>
                      <th className="pb-2">Class</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {instruments.slice(0, 5).map((inst) => (
                      <tr key={inst.id} className="hover:bg-slate-50/80">
                        <td className="py-3 font-mono font-semibold text-slate-900">
                          {inst.instrument_code}
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-slate-800">{inst.model_number}</div>
                          <div className="text-[10px] text-slate-500 font-mono">SN: {inst.serial_number}</div>
                        </td>
                        <td className="py-3">
                          <AccuracyClassBadge accuracyClass={inst.accuracy_class} />
                        </td>
                        <td className="py-3 text-right">
                          {inst.test_plan_id ? (
                            <button
                              onClick={() => onOpenWorkspace(inst.test_plan_id!)}
                              className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <FileCheck2 className="w-3 h-3" />
                              Workspace
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No plan yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Applications Status Track */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">Application Status Tracker</h2>
              </div>
              <button
                onClick={() => navigate('/owner/applications')}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
              >
                Track all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading status...</div>
            ) : testPlans.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active inspection applications recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {testPlans.slice(0, 5).map((tp) => (
                  <div
                    key={tp.id}
                    onClick={() => onOpenWorkspace(tp.id)}
                    className="p-3 rounded-lg border border-slate-150 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">{tp.test_plan_code}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {tp.manufacturer} ({tp.model_number})
                      </div>
                    </div>
                    <WorkflowBadge status={tp.status} size="sm" />
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
