import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { AuditLog } from '../../types.ts';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Filter,
  Lock,
  Clock,
  User,
  Layers,
} from 'lucide-react';

export const AuditTrailViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs({
        search: search || undefined,
        entity_type: entityFilter || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, entityFilter]);

  return (
    <div id="audit-trail-view" className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">System Immutable Audit Trail</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              Traceability Enforced
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete, tamper-evident chronological event log capturing user actions, workflow transitions, calculations, and cryptographic seals.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 self-start md:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="audit-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, reason, user..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            id="audit-entity-filter"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium"
          >
            <option value="">All Entities</option>
            <option value="test_plans">Test Plans</option>
            <option value="instruments">Instruments</option>
            <option value="reports">Reports</option>
            <option value="observations">Observations</option>
            <option value="auth">Authentication</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No audit records matching query.
          </div>
        ) : (
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">User & Role</th>
                  <th className="px-4 py-3">Entity & ID</th>
                  <th className="px-4 py-3">Traceability Justification / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 font-sans">
                        {log.user_email || 'System'}
                      </div>
                      <div className="text-[10px] text-sky-700">{log.user_role}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{log.entity_type}</div>
                      {log.entity_id && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {log.entity_id}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-700 text-xs">
                      {log.reason || 'Standard operation logged.'}
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
