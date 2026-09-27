import React, { useState, useEffect } from 'react';
import { api, getStoredToken } from '../../api/client.ts';
import { FinalizedReport } from '../../types.ts';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import QRCode from 'qrcode';
import {
  Scale,
  X,
  Download,
  Lock,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  FileText,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface ReportViewerModalProps {
  reportId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToVerify?: (verificationId: string) => void;
}

export const ReportViewerModal: React.FC<ReportViewerModalProps> = ({
  reportId,
  isOpen,
  onClose,
  onNavigateToVerify,
}) => {
  const [report, setReport] = useState<FinalizedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && reportId) {
      setLoading(true);
      setDownloadError(null);
      api
        .getReportById(reportId)
        .then(async (data) => {
          setReport(data);
          if (data.verification_id) {
            const host = window.location.origin;
            const url = `${host}/verify/${data.verification_id}`;
            const qr = await QRCode.toDataURL(url, { width: 180, margin: 1 });
            setQrDataUrl(qr);
          }
        })
        .catch((err) => console.error('Failed to load report:', err))
        .finally(() => setLoading(false));
    } else {
      setReport(null);
      setQrDataUrl(null);
      setCopiedHash(false);
      setDownloadError(null);
    }
  }, [isOpen, reportId]);

  if (!isOpen || !reportId) return null;

  const handleCopyHash = () => {
    if (report?.sha256_hash) {
      navigator.clipboard.writeText(report.sha256_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportId) return;
    setDownloadError(null);
    try {
      await api.downloadReportPdf(reportId, report?.report_number || reportId);
    } catch (err: any) {
      console.error('PDF download error:', err);
      setDownloadError(err.message || 'Failed to download certificate PDF. Please ensure you are authenticated.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="report-viewer-modal"
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">DIGITAL NAWI TEST REPORT</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                  FINALIZED & SEALED
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Standard: OIML R 76-1:2006 | Cryptographic SHA-256 Verified
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="modal-download-pdf-btn"
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading || !report ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading digital test report...</div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6">
            {downloadError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
                <span>{downloadError}</span>
                <button onClick={() => setDownloadError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">
                  Dismiss
                </button>
              </div>
            )}
            {/* Metadata Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-mono uppercase text-[10px]">Report Number</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{report.report_number}</div>
              </div>
              <div>
                <div className="text-slate-400 font-mono uppercase text-[10px]">Verification ID</div>
                <div className="font-mono font-bold text-sky-700 mt-0.5">{report.verification_id}</div>
              </div>
              <div>
                <div className="text-slate-400 font-mono uppercase text-[10px]">Date Finalized</div>
                <div className="font-medium text-slate-800 mt-0.5">
                  {new Date(report.finalized_at).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-mono uppercase text-[10px]">Rule Engine Version</div>
                <div className="font-mono text-slate-800 mt-0.5">{report.rule_version_used}</div>
              </div>
            </div>

            {/* Section 1: Instrument Specification */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                <span>1. Instrument Specification & Technical Identity</span>
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Applicant / Owner:</span>
                      <span className="font-semibold text-slate-900">{report.applicant_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Manufacturer:</span>
                      <span className="font-semibold text-slate-900">{report.manufacturer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Model / Type:</span>
                      <span className="font-semibold text-slate-900">{report.model_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Serial Number:</span>
                      <span className="font-mono font-semibold text-slate-900">{report.serial_number}</span>
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Accuracy Class:</span>
                      <AccuracyClassBadge accuracyClass={report.accuracy_class || 'III'} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Maximum Capacity (Max):</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {report.max_capacity} {report.capacity_unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Scale Interval (e):</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {report.verification_scale_interval_e} {report.scale_interval_unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Application Ref:</span>
                      <span className="font-mono text-slate-700">{report.application_number}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Metrological Evaluation Summary */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                2. Metrological Evaluation Summary (OIML R 76-1:2006)
              </h3>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Test Clause & Description</th>
                      <th className="px-3.5 py-2.5">Standard Ref</th>
                      <th className="px-3.5 py-2.5">Max Observed Error</th>
                      <th className="px-3.5 py-2.5">Applicable MPE</th>
                      <th className="px-3.5 py-2.5">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-mono">
                    {report.test_instances?.map((inst) => (
                      <tr key={inst.id} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2.5 font-sans font-medium text-slate-800">
                          {inst.test_name}
                          <div className="text-[10px] text-slate-400 font-mono">{inst.oiml_clause}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500">{inst.standard_ref}</td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">
                          {inst.calculation ? `${inst.calculation.result_value} ${report.scale_interval_unit}` : 'N/A'}
                        </td>
                        <td className="px-3.5 py-2.5 text-sky-800">
                          {inst.calculation ? `±${inst.calculation.applicable_mpe} ${report.scale_interval_unit}` : 'Requires validation'}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {inst.decision === 'PASS' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-sans">
                              PASS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-sans">
                              {inst.decision}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Cryptographic Integrity Seal & QR */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                3. Cryptographic Integrity Seal & Public Verification
              </h3>

              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center gap-5 border border-slate-800">
                {qrDataUrl && (
                  <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                    <img src={qrDataUrl} alt="Report Verification QR Code" className="w-32 h-32" />
                  </div>
                )}

                <div className="space-y-2 text-xs flex-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    Cryptographic SHA-256 Hash Seal:
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-[11px] text-amber-300 break-all flex items-center justify-between gap-2">
                    <span>{report.sha256_hash}</span>
                    <button
                      onClick={handleCopyHash}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white shrink-0"
                      title="Copy SHA-256 Hash"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Anyone can scan this QR code or visit the public verification portal to mathematically verify that this report has not been tampered with or altered since finalization.
                  </div>

                  {onNavigateToVerify && report.verification_id && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToVerify(report.verification_id!);
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 mt-1"
                    >
                      Open Public QR Verifier Simulator <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Signatories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-400 font-mono uppercase text-[10px]">Technical Reviewer</div>
                <div className="font-bold text-slate-900 mt-1">{report.reviewer_name || 'Dr. S. Mukherjee'}</div>
                <div className="text-[11px] text-slate-500">Senior Metrological Reviewer, NMC</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-slate-400 font-mono uppercase text-[10px]">Approving Authority</div>
                <div className="font-bold text-slate-900 mt-1">{report.approving_authority_name || 'S. P. Deshmukh'}</div>
                <div className="text-[11px] text-slate-500">Directorate of Legal Metrology</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
