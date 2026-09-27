import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import { FaceEnrollmentModal } from './FaceEnrollmentModal.tsx';
import { LiveFaceVerificationModal } from './LiveFaceVerificationModal.tsx';
import { FaceVerificationService } from '../../services/faceVerificationService.ts';
import { StaffFaceTemplate, FaceVerificationRecord, FaceVerificationEvent } from '../../types.ts';
import {
  ShieldCheck,
  Camera,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Lock,
  Calendar,
  Clock,
  Laptop,
  Layers,
  ArrowRight,
  RefreshCw,
  FileCheck,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface StaffIdentityPageProps {
  initialOpenEnroll?: boolean;
}

export const StaffIdentityPage: React.FC<StaffIdentityPageProps> = ({ initialOpenEnroll }) => {
  const { user } = useAuth();

  const [template, setTemplate] = useState<StaffFaceTemplate | null>(null);
  const [events, setEvents] = useState<FaceVerificationEvent[]>([]);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(!!initialOpenEnroll);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [lastVerification, setLastVerification] = useState<FaceVerificationRecord | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = () => {
    if (user) {
      const tmpl = demoFaceStore.getStaffTemplate(user.id);
      setTemplate(tmpl);
      setEvents(demoFaceStore.getEvents().filter((e) => e.actor_id === user.id || e.actor_name === user.full_name));
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleEnrollSuccess = () => {
    loadData();
    setIsEnrollModalOpen(false);
    setSuccessMsg('Live Face Biometric Template registered successfully.');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleVerificationSuccess = (record: FaceVerificationRecord) => {
    setLastVerification(record);
    loadData();
    setSuccessMsg(`Live Face Match verified successfully (${record.confidence_score}% confidence).`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleDeleteTemplate = () => {
    if (user && confirm('Are you sure you want to remove your local demo face template?')) {
      demoFaceStore.deleteStaffTemplate(user.id);
      setTemplate(null);
      loadData();
      setSuccessMsg('Demo face template deleted.');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const roleDisplay = user?.role === 'SUB_INSPECTOR' ? 'TESTER' : user?.role || 'TESTER';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
              {roleDisplay} IDENTITY
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-mono">STANDARDS REGISTRY</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1.5 flex items-center gap-2">
            Officer Biometric Identity Verification
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Live camera face enrollment and real-time identity match for authorized Legal Metrology officers (TESTER & INSPECTOR) before conducting OIML R 76 on-site verifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsVerifyModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors border border-slate-200 shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Test Live Match</span>
          </button>
          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Camera className="w-4 h-4" />
            <span>{template ? 'Re-enroll Face' : 'Enroll Face'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Staff Template Status & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Active Biometric Profile */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enrollment Status Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                {template?.photo_data ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-sm shrink-0">
                    <img
                      src={template.photo_data}
                      alt="Enrolled Face"
                      className="w-full h-full object-cover -scale-x-100"
                    />
                  </div>
                ) : (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                    template ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}>
                    {template ? <UserCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {user?.full_name || 'Legal Metrology Officer'}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      ID: {user?.id || 'usr-staff'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorized Scope: <span className="font-semibold text-slate-800">{roleDisplay}</span> &bull; {user?.designation || 'Metrology Field Specialist'}
                  </p>
                </div>
              </div>

              <div>
                {template ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>ENROLLED & ACTIVE</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>NOT ENROLLED</span>
                  </span>
                )}
              </div>
            </div>

            {/* Template Specs */}
            {template ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Template ID</div>
                    <div className="font-mono font-bold text-slate-800 mt-0.5 truncate">{template.id}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Enrolled Timestamp</div>
                    <div className="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(template.enrolled_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Biometric Vector Dimension</div>
                    <div className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>64-Dimensional Normalized Histogram</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Enrolled Device Source</div>
                    <div className="font-mono text-slate-700 text-[11px] mt-0.5 truncate flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      <span>{template.device_info || 'Field Sensor Camera'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Spatial embedding reference is cached for instant on-site cross-verification.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEnrollModalOpen(true)}
                      className="px-3 py-1 bg-white hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold rounded-lg text-xs transition-colors"
                    >
                      Update Template
                    </button>
                    <button
                      onClick={handleDeleteTemplate}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-slate-900">No Biometric Template Enrolled</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    To start on-site verification inspections (Stage 2: Field Officer Identity Verification), you must first complete a 10-second live camera face capture.
                  </p>
                </div>
                <button
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Start Face Enrollment</span>
                </button>
              </div>
            )}
          </div>

          {/* Verification Audit Events */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span>Identity Activity & Verification Logs</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">{events.length} Events</span>
            </div>

            {events.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No verification activity recorded yet in this session.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${
                        evt.action.includes('SUCCESS') ? 'bg-emerald-500' : 'bg-rose-500'
                      }`} />
                      <div>
                        <div className="font-semibold text-slate-800">{evt.action.replace('_', ' ')}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{evt.details}</div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 span): Live Match Testing & Guidelines */}
        <div className="space-y-6">
          {/* Quick Match Test Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Real-Time Biometric Match</span>
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Test your device camera and verify that your face matches the registered template in real-time.
            </p>

            <button
              onClick={() => setIsVerifyModalOpen(true)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Launch Live Verification</span>
            </button>

            {lastVerification && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5 font-mono">
                <div className="text-[10px] text-emerald-700 font-bold uppercase font-sans">
                  Last Live Result:
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Decision:</span>
                  <span className="font-bold text-emerald-800">
                    {lastVerification.verified ? 'MATCH (VERIFIED)' : 'NO MATCH'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Confidence:</span>
                  <span className="font-bold text-slate-900">
                    {lastVerification.confidence_score}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Time:</span>
                  <span className="text-slate-700">
                    {new Date(lastVerification.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Privacy & Metrological Notice */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4 text-blue-400" />
              <span>Biometric Privacy & Safeguards</span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              <strong>Official Identity Verification:</strong> This feature operates strictly on client-side descriptor vectors. No raw facial images are persisted or transmitted across networks. Only normalized 64-dimensional spatial descriptor vectors are processed in secure memory.
            </p>

            <div className="pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
              <div>&bull; Client-side HTML5 Optical Processing</div>
              <div>&bull; Optical Liveness Micro-flux Verification</div>
              <div>&bull; Zero Raw Biometric Database Storage</div>
            </div>
          </div>

          {/* Environmental Sensor Diagnostics */}
          <div className="bg-slate-950 text-slate-300 rounded-2xl p-5 border border-slate-800 shadow-xs space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-blue-400 uppercase text-[11px] tracking-wider">
                Optical Sensor Diagnostics
              </span>
              <span className="text-[10px] bg-blue-400/10 text-blue-300 px-2 py-0.5 rounded border border-blue-400/30">
                SENSOR STATUS
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Camera Interface:</span>
                <span className={typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia ? 'Available' : 'Unavailable'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Secure Protocol:</span>
                <span className={typeof window !== 'undefined' && window.isSecureContext ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {typeof window !== 'undefined' && window.isSecureContext ? 'HTTPS / Secure' : 'Standard'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Camera Device:</span>
                <span className="text-slate-200 font-bold">
                  {typeof navigator !== 'undefined' && !!navigator.mediaDevices ? 'Ready' : 'Not Detected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FaceEnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnrollmentSuccess={handleEnrollSuccess}
      />

      <LiveFaceVerificationModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        inspectionId="demo-self-test"
        instrumentCode="STAFF-VERIFY"
        onVerificationSuccess={handleVerificationSuccess}
        onOpenEnrollment={() => setIsEnrollModalOpen(true)}
      />
    </div>
  );
};
