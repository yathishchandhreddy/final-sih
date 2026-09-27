import React, { useState, useEffect } from 'react';
import { api, getStoredToken } from '../../api/client.ts';
import { FinalizedReport } from '../../types.ts';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import {
  FileText,
  Search,
  RefreshCw,
  Download,
  Lock,
  ExternalLink,
  ShieldCheck,
  QrCode,
} from 'lucide-react';

interface ReportsListProps {
  onOpenReportModal: (reportId: string) => void;
  onNavigateToVerify: (verificationId: string) => void;
}

export const ReportsList: React.FC<ReportsListProps> = ({
  onOpenReportModal,
  onNavigateToVerify,
}) => {
  const [reports, setReports] = useState<FinalizedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await api.getReports(search || undefined);
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [search]);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadPdf = async (e: React.MouseEvent, reportId: string, reportNum: string) => {
    e.stopPropagation();
    setDownloadError(null);
    try {
      await api.downloadReportPdf(reportId, reportNum);
    } catch (err: any) {
      console.error('PDF download error:', err);
      setDownloadError(err.message || 'Failed to download certificate PDF. Please ensure you have an active session.');
    }
  };

  return (
    <div id="reports-list-view" className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Finalized NAWI Test Reports</h1>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-xs font-bold">
              {reports.length} Sealed Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-proof digital type evaluation reports sealed with SHA-256 cryptographic hashes and verifiable via public QR.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
          <span>{downloadError}</span>
          <button onClick={() => setDownloadError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="reports-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search report number, verification ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
            Loading finalized reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center">
            <Lock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No finalized reports found</h3>
            <p className="text-xs text-slate-500 mt-1">
              Complete evaluation and approval of an instrument test plan to generate a finalized sealed report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Report Number & Ref</th>
                  <th className="px-4 py-3">Instrument & Applicant</th>
                  <th className="px-4 py-3">Class & Capacity</th>
                  <th className="px-4 py-3">Cryptographic SHA-256 Seal</th>
                  <th className="px-4 py-3">Date Finalized</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {reports.map((rep) => (
                  <tr
                    key={rep.id}
                    onClick={() => onOpenReportModal(rep.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-indigo-950 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        {rep.report_number}
                      </div>
                      <div className="text-[11px] font-mono text-sky-700 font-semibold mt-0.5">
                        ID: {rep.verification_id}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{rep.model_number}</div>
                      <div className="text-[11px] text-slate-500">{rep.applicant_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SN: {rep.serial_number}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="mb-1">
                        <AccuracyClassBadge accuracyClass={rep.accuracy_class || 'III'} />
                      </div>
                      <div className="text-[11px] font-mono text-slate-600">
                        {rep.max_capacity} {rep.capacity_unit} (e={rep.verification_scale_interval_e} {rep.scale_interval_unit})
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-800 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[160px]">{rep.sha256_hash}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">Immutable database record</div>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-slate-600">
                      {new Date(rep.finalized_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenReportModal(rep.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200 text-xs transition-colors"
                        >
                          View Report
                        </button>
                        <button
                          onClick={(e) => handleDownloadPdf(e, rep.id, rep.report_number)}
                          className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
