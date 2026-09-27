import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import { FaceVerificationService } from '../../services/faceVerificationService.ts';
import { EvidenceCategory, InspectionEvidence } from '../../types.ts';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Trash2,
  Plus,
  ShieldCheck,
  Tag,
  MapPin,
  Upload,
  Sparkles,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface EvidenceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionId: string;
  faceVerificationId: string;
  onEvidenceCaptured?: (evidence: InspectionEvidence) => void;
}

const EVIDENCE_CATEGORIES: { type: EvidenceCategory; label: string; desc: string }[] = [
  { type: 'INSTRUMENT_FRONT', label: '1. Instrument Front', desc: 'Full frontal overview of weighing instrument setup' },
  { type: 'INSTRUMENT_DISPLAY', label: '2. Instrument Display', desc: 'Close-up of load indicator terminal & tare reading' },
  { type: 'NAMEPLATE_ID', label: '3. Nameplate / Identification', desc: 'Manufacturer metallic plate with Max, Min, e, serial number' },
  { type: 'STANDARD_MASS_SET', label: '4. Standard Mass Set', desc: 'Traceable reference weights in use with calibration seals' },
  { type: 'INSPECTION_SITE', label: '5. Inspection Site', desc: 'Physical environment, vibration isolation & leveling bubble' },
  { type: 'OTHER_EVIDENCE', label: '6. Other Evidence', desc: 'Seals, load receptors, corner junctions, or wiring' },
];

export const EvidenceCaptureModal: React.FC<EvidenceCaptureModalProps> = ({
  isOpen,
  onClose,
  inspectionId,
  faceVerificationId,
  onEvidenceCaptured,
}) => {
  const { user } = useAuth();

  const isIframe = FaceVerificationService.isIframeEnvironment();
  const directAppUrl = FaceVerificationService.getDirectAppUrl();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<EvidenceCategory>('INSTRUMENT_FRONT');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      handleStopCamera();
      setCapturedDataUrl(null);
      setNotes('');
      return;
    }

    handleStartCamera();

    return () => {
      handleStopCamera();
    };
  }, [isOpen]);

  const handleStartCamera = async () => {
    setCameraError(null);
    setCameraActive(false);

    try {
      if (videoRef.current) {
        const stream = await FaceVerificationService.startCamera(videoRef.current);
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(err.message || 'Camera permission is required to capture evidence. You can use sample photos or upload an image.');
    }
  };

  const handleStopCamera = () => {
    FaceVerificationService.stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraActive(false);
  };

  const handleSnap = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedDataUrl(dataUrl);
    }
  };

  const generateSampleEvidence = (category: EvidenceCategory) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 640, 480);
    bg.addColorStop(0, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 640, 480);

    // Workbench line
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 360, 640, 120);

    if (category === 'INSTRUMENT_FRONT') {
      // Weighing Scale Front View
      ctx.fillStyle = '#64748b';
      ctx.fillRect(160, 240, 320, 120);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(140, 210, 360, 30); // stainless platter
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(260, 270, 120, 50); // display unit
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('0.000 kg', 270, 302);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.fillText('LEGAL METROLOGY VERIFICATION CLASS III', 190, 180);
    } else if (category === 'INSTRUMENT_DISPLAY') {
      // Close up digital display
      ctx.fillStyle = '#020617';
      ctx.fillRect(80, 80, 480, 320);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 4;
      ctx.strokeRect(80, 80, 480, 320);

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 64px monospace';
      ctx.fillText('0.000 kg', 160, 240);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('● STABLE   ● NET 0   [Max 30kg  e=1g]', 160, 280);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText('DIGITAL TARE INDICATOR TERMINAL - OIML R 76-1', 140, 130);
    } else if (category === 'NAMEPLATE_ID') {
      // Metallic Nameplate
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(100, 100, 440, 280);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.strokeRect(100, 100, 440, 280);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('METROLOGICAL IDENTIFICATION PLATE', 130, 140);
      ctx.font = '14px monospace';
      ctx.fillText('MANUFACTURER: METRO-TECH INSTRUMENTS', 130, 180);
      ctx.fillText('MODEL: EP-420-III   TYPE: NAWI CLASS III', 130, 210);
      ctx.fillText('SERIAL NUMBER: SN-2025-IND-8841', 130, 240);
      ctx.fillText('Max = 30 kg   Min = 100 g   e = 1 g', 130, 270);
      ctx.fillText('OIML R 76-1:2006 CERTIFICATE #IN-2025-09', 130, 300);
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('★ NATIONAL VERIFICATION SEAL AFFIXED ★', 145, 340);
    } else if (category === 'STANDARD_MASS_SET') {
      // Standard Mass Weights
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(120, 220, 400, 140); // Box
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(200, 220, 35, 0, Math.PI * 2);
      ctx.arc(280, 220, 28, 0, Math.PI * 2);
      ctx.arc(350, 220, 22, 0, Math.PI * 2);
      ctx.arc(410, 220, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('10 kg', 188, 225);
      ctx.fillText('5 kg', 270, 225);
      ctx.fillText('2 kg', 340, 225);
      ctx.fillText('1 kg', 400, 225);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('TRACEABLE CLASS M1 WORKING STANDARDS', 150, 140);
      ctx.font = '12px monospace';
      ctx.fillText('NPL Calibration Cert #CAL-2025-M1-771', 170, 170);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`FIELD INSPECTION EVIDENCE: ${category}`, 120, 200);
      ctx.font = '12px monospace';
      ctx.fillText('Location & Environmental Verification Timestamped', 120, 230);
    }

    // Watermark
    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`OIML R 76 EVIDENCE CAPTURE • ${new Date().toLocaleDateString()}`, 20, 30);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);
    setNotes(`Verified ${category.toLowerCase().replace('_', ' ')} for inspection record ${inspectionId}.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCapturedDataUrl(result);
        setNotes(`Uploaded evidence photo: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  const handleConfirmEvidence = () => {
    if (!capturedDataUrl) return;

    setSaving(true);
    try {
      const count = demoFaceStore.getEvidenceForInspection(inspectionId).length + 1;
      const newEvidence: InspectionEvidence = {
        id: `ev-${Date.now()}`,
        evidence_id: `EVD-${new Date().getFullYear()}-${String(count).padStart(2, '0')}`,
        inspection_id: inspectionId,
        captured_by: user?.id || 'usr-inspector-001',
        captured_by_name: user?.full_name || 'Legal Metrology Inspector',
        role: user?.role || 'INSPECTOR',
        captured_at: new Date().toISOString(),
        evidence_type: selectedType,
        face_verification_id: faceVerificationId,
        camera_source: 'Inspection Optical Sensor / Upload',
        image_reference: capturedDataUrl,
        notes: notes.trim() || undefined,
      };

      demoFaceStore.saveEvidence(newEvidence);

      if (onEvidenceCaptured) {
        onEvidenceCaptured(newEvidence);
      }

      setCapturedDataUrl(null);
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Evidence save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Camera className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Capture Inspection Evidence
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  LIVE OPTICAL
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Authorized Officer: {user?.full_name || 'Legal Metrology Officer'} &bull; Linked to Face Verification
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Category Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Select Evidence Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EVIDENCE_CATEGORIES.map((cat) => (
                <button
                  key={cat.type}
                  type="button"
                  onClick={() => setSelectedType(cat.type)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    selectedType === cat.type
                      ? 'border-blue-500 bg-blue-50 text-blue-950 font-semibold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-bold">{cat.label}</div>
                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Viewport: Live Camera vs Captured Frame */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-800 shadow-inner">
            {!capturedDataUrl ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />

                {!cameraActive && (
                  <div className="text-center p-6 space-y-3 text-slate-300 max-w-sm">
                    {cameraError ? (
                      <div className="space-y-3">
                        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                        <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>

                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          {directAppUrl && (
                            <a
                              href={directAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open in Direct Window</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => generateSampleEvidence(selectedType)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Use Sample Photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload File</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleStartCamera}
                            className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
                          >
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs">Connecting evidence camera...</p>
                    )}
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[10px] font-mono border border-slate-700 backdrop-blur-xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>LIVE EVIDENCE CAM</span>
                  </div>
                )}
              </>
            ) : (
              /* Review Captured Snap */
              <div className="relative w-full h-full">
                <img
                  src={capturedDataUrl}
                  alt="Captured inspection evidence"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 text-[10px] font-mono border border-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>FRAME ATTACHED</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick preset triggers under viewport */}
          {!capturedDataUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Quick Photo Options:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateSampleEvidence(selectedType)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Sample Inspection Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-semibold flex items-center gap-1"
                >
                  <Upload className="w-3 h-3 text-blue-600" />
                  <span>Upload Image</span>
                </button>
              </div>
            </div>
          )}

          {/* Notes input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Field Notes / Identification Details (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Model number verified against type approval certificate"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>

          {!capturedDataUrl ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => generateSampleEvidence(selectedType)}
                className="px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Preset Frame</span>
              </button>
              <button
                type="button"
                disabled={!cameraActive}
                onClick={handleSnap}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Frame</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmEvidence}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Attach</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
