import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { TestPlan } from '../../types.ts';
import { WorkflowBadge } from '../common/WorkflowBadge.tsx';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  FileCheck2,
  Search,
  RefreshCw,
  ArrowRight,
  Filter,
  PlusCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface TestPlansListProps {
  onSelectPlan: (id: string) => void;
  onOpenRegisterModal: () => void;
  initialStatusFilter?: string;
}

export const TestPlansList: React.FC<TestPlansListProps> = ({
  onSelectPlan,
  onOpenRegisterModal,
  initialStatusFilter = '',
}) => {
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);

  const fetchTestPlans = async () => {
    setLoading(true);
    try {
      const data = await api.getTestPlans({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setTestPlans(data);
    } catch (err) {
      console.error('Failed to fetch test plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestPlans();
  }, [search, statusFilter]);

  return (
    <div id="test-plans-list-view" className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Type Evaluation Test Workspace</h1>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold">
              {testPlans.length} Plans Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard OIML R 76-1:2006 evaluation plans, test instances, observation capture, and review workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTestPlans}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="testplans-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test plan or instrument..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            id="testplans-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium"
          >
            <option value="">All Workflow States</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="CORRECTION_REQUIRED">Correction Required</option>
            <option value="APPROVED">Approved</option>
            <option value="FINALIZED">Finalized & Sealed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            Loading test plans...
          </div>
        ) : testPlans.length === 0 ? (
          <div className="py-12 text-center">
            <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No test plans found</h3>
            <p className="text-xs text-slate-500 mt-1">Register an instrument to generate an initial test plan.</p>
            <button
              onClick={onOpenRegisterModal}
              className="mt-4 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Register Instrument
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Test Plan Code</th>
                  <th className="px-4 py-3">Instrument & Manufacturer</th>
                  <th className="px-4 py-3">Class & Capacity</th>
                  <th className="px-4 py-3">Rule Version</th>
                  <th className="px-4 py-3">Workflow State</th>
                  <th className="px-4 py-3">Overall Verdict</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {testPlans.map((tp) => (
                  <tr key={tp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      {tp.test_plan_code}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {new Date(tp.generated_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{tp.model_number}</div>
                      <div className="text-[11px] text-slate-500">{tp.manufacturer}</div>
                      <div className="text-[10px] font-mono text-slate-400">{tp.instrument_code}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="mb-1">
                        <AccuracyClassBadge accuracyClass={tp.accuracy_class || 'III'} />
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        Max: {tp.max_capacity} {tp.capacity_unit} (e: {tp.verification_scale_interval_e} {tp.scale_interval_unit})
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {tp.rule_version_code || 'OIML R 76-1'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <WorkflowBadge status={tp.status} size="sm" />
                    </td>
                    <td className="px-4 py-3.5">
                      {tp.overall_decision === 'PASS' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      )}
                      {tp.overall_decision === 'FAIL' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          FAIL
                        </span>
                      )}
                      {tp.overall_decision === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        id={`open-plan-${tp.id}`}
                        onClick={() => onSelectPlan(tp.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold border border-sky-200 transition-colors text-xs"
                      >
                        Open Workspace <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
