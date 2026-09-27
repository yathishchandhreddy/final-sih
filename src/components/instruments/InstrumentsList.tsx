import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { Instrument } from '../../types.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  Scale,
  Search,
  PlusCircle,
  FileCheck2,
  RefreshCw,
  ArrowRight,
  Filter,
  CheckCircle,
} from 'lucide-react';

interface InstrumentsListProps {
  onOpenRegisterModal: () => void;
  onOpenWorkspace: (testPlanId: string) => void;
}

export const InstrumentsList: React.FC<InstrumentsListProps> = ({
  onOpenRegisterModal,
  onOpenWorkspace,
}) => {
  const { hasRole } = useAuth();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [accuracyClassFilter, setAccuracyClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchInstruments = async () => {
    setLoading(true);
    try {
      const data = await api.getInstruments({
        search: search || undefined,
        accuracy_class: accuracyClassFilter || undefined,
        status: statusFilter || undefined,
      });
      setInstruments(data);
    } catch (err) {
      console.error('Failed to fetch instruments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstruments();
  }, [search, accuracyClassFilter, statusFilter]);

  const handleGeneratePlan = async (instrumentId: string) => {
    setGeneratingId(instrumentId);
    try {
      const res = await api.generateTestPlan(instrumentId);
      await fetchInstruments();
      onOpenWorkspace(res.test_plan_id);
    } catch (err: any) {
      alert(err.message || 'Failed to generate test plan');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div id="instruments-list-view" className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Weighing Instruments Registry</h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
              {instruments.length} Recorded
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registered Non-Automatic Weighing Instruments undergoing OIML R 76-1:2006 metrological type evaluation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInstruments}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {hasRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN') && (
            <button
              id="open-register-modal-btn"
              onClick={onOpenRegisterModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              Register Instrument
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="instruments-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, model, manufacturer..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            id="instruments-class-filter"
            value={accuracyClassFilter}
            onChange={(e) => setAccuracyClassFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
          >
            <option value="">All Accuracy Classes</option>
            <option value="I">Class I (Special)</option>
            <option value="II">Class II (High)</option>
            <option value="III">Class III (Medium)</option>
            <option value="IIII">Class IIII (Ordinary)</option>
          </select>

          <select
            id="instruments-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="CORRECTION_REQUIRED">Correction Required</option>
            <option value="APPROVED">Approved</option>
            <option value="FINALIZED">Finalized</option>
          </select>
        </div>
      </div>

      {/* Instruments Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            Loading instruments from database...
          </div>
        ) : instruments.length === 0 ? (
          <div className="py-12 text-center">
            <Scale className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No instruments found</h3>
            <p className="text-xs text-slate-500 mt-1">Register a new instrument to initiate metrological evaluation.</p>
            {hasRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN') && (
              <button
                id="empty-register-now-btn"
                onClick={onOpenRegisterModal}
                className="mt-4 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Register Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Instrument Code & Ref</th>
                  <th className="px-4 py-3">Applicant & Manufacturer</th>
                  <th className="px-4 py-3">Model & Serial</th>
                  <th className="px-4 py-3">Accuracy Class & Range</th>
                  <th className="px-4 py-3">Workflow State</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {instruments.map((inst) => {
                  let eInCapacityUnit = inst.verification_scale_interval_e;
                  if (inst.scale_interval_unit === 'g' && inst.capacity_unit === 'kg') {
                    eInCapacityUnit = inst.verification_scale_interval_e / 1000;
                  } else if (inst.scale_interval_unit === 'mg' && inst.capacity_unit === 'g') {
                    eInCapacityUnit = inst.verification_scale_interval_e / 1000;
                  }
                  const n = Math.round(inst.max_capacity / (eInCapacityUnit || 1));

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">{inst.instrument_code}</span>
                          {inst.instrument_code.startsWith('DEMO-') && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              DEMONSTRATION DATA
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{inst.application_number}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{inst.applicant_name}</div>
                        <div className="text-[11px] text-slate-500">{inst.manufacturer}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{inst.model_number}</div>
                        <div className="text-[11px] text-slate-500 font-mono">SN: {inst.serial_number}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AccuracyClassBadge accuracyClass={inst.accuracy_class} />
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Max: <span className="font-semibold font-mono">{inst.max_capacity} {inst.capacity_unit}</span> | e: <span className="font-semibold font-mono">{inst.verification_scale_interval_e} {inst.scale_interval_unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">n = {n.toLocaleString()} e</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {inst.test_plan_status ? (
                          <WorkflowBadge status={inst.test_plan_status} size="sm" />
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No test plan yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {inst.test_plan_id ? (
                          <button
                            id={`open-workspace-btn-${inst.id}`}
                            onClick={() => onOpenWorkspace(inst.test_plan_id!)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold border border-sky-200 transition-colors text-xs"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            Open Workspace
                          </button>
                        ) : (
                          <button
                            id={`gen-plan-btn-${inst.id}`}
                            disabled={generatingId === inst.id || !hasRole('APPLICANT', 'INSPECTOR', 'SUB_INSPECTOR', 'ENGINEER', 'EVALUATOR', 'ADMIN')}
                            onClick={() => handleGeneratePlan(inst.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 transition-colors text-xs disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {generatingId === inst.id ? 'Generating...' : 'Generate Plan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
