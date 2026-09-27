import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.ts';
import { AccuracyClassBadge } from '../common/AccuracyClassBadge.tsx';
import QRCode from 'qrcode';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  Lock,
  ExternalLink,
  Scale,
  Sparkles,
} from 'lucide-react';

interface PublicVerifierProps {
  initialVerificationId?: string;
}

export const PublicVerifier: React.FC<PublicVerifierProps> = ({ initialVerificationId = '' }) => {
  const [verificationInput, setVerificationInput] = useState(initialVerificationId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const handleVerify = async (idToVerify?: string) => {
    const id = idToVerify || verificationInput.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.verifyReportPublic(id);
      setResult(data);

      if (data.report?.verification_id) {
        const qr = await QRCode.toDataURL(window.location.href, { width: 140, margin: 1 });
        setQrDataUrl(qr);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Report verification failed. Invalid ID or tampered record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialVerificationId) {
      setVerificationInput(initialVerificationId);
      handleVerify(initialVerificationId);
    }
  }, [initialVerificationId]);

  return (
    <div id="public-verifier-view" className="space-y-6 max-w-4xl mx-auto">
      {/* Verification Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm mb-3">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">National Metrology Public Report Verifier</h1>
        <p className="text-xs text-slate-600 mt-1 max-w-xl mx-auto">
          Verify authenticity and cryptographic SHA-256 seal integrity for official Non-Automatic Weighing Instrument (NAWI) test reports issued under OIML R 76-1:2006.
        </p>

        {/* Search / Verification Input */}
        <div className="mt-6 max-w-lg mx-auto flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="verifier-input"
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value)}
              placeholder="Enter Verification ID (e.g. VRF-2026-0001)"
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <button
            type="button"
            id="verify-submit-btn"
            disabled={loading || !verificationInput.trim()}
            onClick={() => handleVerify()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? 'Verifying Hash...' : 'Verify Authenticity'}
          </button>
        </div>

        {/* Quick Demo Verification Buttons */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <span>Quick check demo record:</span>
          <button
            type="button"
            onClick={() => {
              setVerificationInput('VRF-DEMO-001');
              handleVerify('VRF-DEMO-001');
            }}
            className="font-mono font-semibold text-blue-700 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
          >
            VRF-DEMO-001
          </button>
        </div>
      </div>

      {/* Error / Not Found */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <div className="font-bold">Verification Failed / Record Not Found</div>
            <div className="text-slate-600 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Verification Success Result */}
      {result && result.verified && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-6 p-6">
          {/* Certificate Banner */}
          {result.report?.status === 'DEMONSTRATION ONLY' || result.report?.report_number === 'DEMO-CERT-001' ? (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <span>DEMONSTRATION CERTIFICATE — NOT A LEGALLY VALID CERTIFICATE</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-mono font-bold">
                      DEMONSTRATION ONLY
                    </span>
                  </div>
                  <div className="text-xs text-amber-900 mt-0.5">
                    Certificate <strong className="font-mono">{result.report.report_number}</strong> verified against database cryptographic SHA-256 seal. Prepared exclusively for demonstration.
                  </div>
                </div>
              </div>

              <div className="hidden sm:block text-right text-xs font-mono text-slate-500">
                <div>Sealed on: {new Date(result.report.finalized_at).toLocaleDateString()}</div>
                <div className="text-amber-700 font-semibold">Integrity: Verified 100%</div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <span>AUTHENTIC & CRYPTOGRAPHICALLY SEALED</span>
                    <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-200 text-emerald-900 font-mono">
                      VALID
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 mt-0.5">
                    Report <strong className="font-mono">{result.report.report_number}</strong> matches official database seal perfectly. No alteration detected.
                  </div>
                </div>
              </div>

              <div className="hidden sm:block text-right text-xs font-mono text-slate-500">
                <div>Sealed on: {new Date(result.report.finalized_at).toLocaleDateString()}</div>
                <div className="text-emerald-700 font-semibold">Status: Immutable</div>
              </div>
            </div>
          )}

          {/* Cryptographic Hash Verification Box */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> SHA-256 Digest Cryptographic Proof
              </span>
              <span className="text-[10px] font-mono text-slate-400">Algorithm: SHA-256 (FIPS 180-4)</span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-amber-300 break-all">
              {result.sha256_hash}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Signatory Authority: {result.report.approving_authority_name || 'Legal Metrology Officer'}</span>
              <span className="text-emerald-400 font-semibold">Integrity Verified 100%</span>
            </div>
          </div>

          {/* Instrument Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Verified Metrological Type Specification
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <div className="text-[10px] uppercase font-mono text-slate-400">Manufacturer</div>
                <div className="font-bold text-slate-900 mt-0.5">{result.report.manufacturer}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-slate-400">Model & Serial</div>
                <div className="font-semibold text-slate-900 mt-0.5">{result.report.model_number}</div>
                <div className="text-[10px] font-mono text-slate-500">SN: {result.report.serial_number}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-slate-400">Accuracy Class</div>
                <div className="mt-1">
                  <AccuracyClassBadge accuracyClass={result.report.accuracy_class || 'III'} />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-slate-400">Capacity & Scale (e)</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  Max: {result.report.max_capacity} {result.report.capacity_unit}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  e: {result.report.verification_scale_interval_e} {result.report.scale_interval_unit}
                </div>
              </div>
            </div>
          </div>

          {/* Test Evaluation Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Metrological Evaluation Findings (OIML R 76-1:2006)
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-3.5 py-2">Test Clause</th>
                    <th className="px-3.5 py-2">Max Observed Error</th>
                    <th className="px-3.5 py-2">Applicable MPE</th>
                    <th className="px-3.5 py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-mono">
                  {result.report.test_instances?.map((ti: any) => (
                    <tr key={ti.id}>
                      <td className="px-3.5 py-2.5 font-sans font-medium text-slate-900">
                        {ti.test_name} ({ti.oiml_clause})
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900">
                        {ti.calculation ? `${ti.calculation.result_value} ${result.report.scale_interval_unit}` : 'N/A'}
                      </td>
                      <td className="px-3.5 py-2.5 text-sky-800">
                        {ti.calculation ? `±${ti.calculation.applicable_mpe} ${result.report.scale_interval_unit}` : 'Requires validation'}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-sans">
                          {ti.decision}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
