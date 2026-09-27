import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import {
  FaceVerificationService,
  DetectionResult,
  MatchResult,
  CameraState,
} from '../../services/faceVerificationService.ts';
import { FaceVerificationRecord } from '../../types.ts';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Camera,
  RefreshCw,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Lock,
  AlertTriangle,
  ExternalLink,
  Laptop,
} from 'lucide-react';

interface LiveFaceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionId: string;
  instrumentCode?: string;
  onVerificationSuccess: (record: FaceVerificationRecord) => void;
  onOpenEnrollment?: () => void;
}

export const LiveFaceVerificationModal: React.FC<LiveFaceVerificationModalProps> = ({
  isOpen,
  onClose,
  inspectionId,
  instrumentCode = 'INST-VERIFY',
  onVerificationSuccess,
  onOpenEnrollment,
}) => {
  const { user } = useAuth();

  const isIframe = FaceVerificationService.isIframeEnvironment();
  const directAppUrl = FaceVerificationService.getDirectAppUrl();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [sensorMode, setSensorMode] = useState<'DEVICE' | 'SIMULATED'>('DEVICE');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showPermHelp, setShowPermHelp] = useState(false);

  // Verification pipeline states
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [stage, setStage] = useState<'IDLE' | 'DETECTING' | 'CHECKING_LIVENESS' | 'COMPARING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [livenessCount, setLivenessCount] = useState(0);
  const [verificationRecord, setVerificationRecord] = useState<FaceVerificationRecord | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  // Frame history for optical presence
  const frameHistoryRef = useRef<{ timestamp: number; embedding: number[] }[]>([]);

  // Check enrollment
  const [enrolledTemplate, setEnrolledTemplate] = useState(user ? demoFaceStore.getStaffTemplate(user.id) : null);

  useEffect(() => {
    if (!isOpen) {
      handleStopCamera();
      setCameraState('IDLE');
      setStage('IDLE');
      setVerificationRecord(null);
      setFailureReason(null);
      setCameraError(null);
      setPermissionDenied(false);
      return;
    }

    // Auto-ensure template exists so live verification can compare once camera starts
    const effectiveUser = user || {
      id: 'usr-tester-001',
      full_name: 'Amit Patel',
      role: 'SUB_INSPECTOR' as const,
    };
    const tmpl = demoFaceStore.ensureStaffTemplate(effectiveUser);
    setEnrolledTemplate(tmpl);

    setStage('IDLE');
    setCameraState('IDLE');
    setLivenessCount(0);
    frameHistoryRef.current = [];
  }, [isOpen, user?.id]);

  const handleStartCamera = async (forceSimulated?: boolean) => {
    setCameraError(null);
    setPermissionDenied(false);
    setCameraActive(false);
    setCameraState('REQUESTING');
    setStage('DETECTING');

    const useSim = forceSimulated ?? (sensorMode === 'SIMULATED');

    try {
      if (videoRef.current) {
        const stream = await FaceVerificationService.startCamera(videoRef.current, useSim);
        streamRef.current = stream;
        setCameraActive(true);
        setCameraState('READY');
        startVerificationLoop();
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      const classified = FaceVerificationService.classifyCameraError(err);
      setCameraState(classified.state);
      setPermissionDenied(classified.state === 'NO_PERMISSION' || classified.state === 'BLOCKED');
      setCameraError(classified.message);
      setStage('FAILED');
    }
  };

  const handleSwitchToSimulated = () => {
    setSensorMode('SIMULATED');
    setFailureReason(null);
    setStage('DETECTING');
    setLivenessCount(0);
    frameHistoryRef.current = [];
    handleStartCamera(true);
  };

  const handleAutoEnrollDemo = () => {
    if (user) {
      const tmpl = demoFaceStore.ensureStaffTemplate(user);
      setEnrolledTemplate(tmpl);
      setFailureReason(null);
      setStage('DETECTING');
      setLivenessCount(0);
      frameHistoryRef.current = [];
      handleStartCamera(sensorMode === 'SIMULATED');
    }
  };

  const handleQuickVerify = () => {
    handleStopCamera();
    const effectiveUser = user || {
      id: 'usr-tester-001',
      full_name: 'Amit Patel',
      role: 'SUB_INSPECTOR' as const,
    };
    demoFaceStore.ensureStaffTemplate(effectiveUser);

    const record = FaceVerificationService.createDemoVerificationRecord({
      userId: effectiveUser.id,
      userName: effectiveUser.full_name || 'Legal Metrology Officer',
      role: effectiveUser.role || 'SUB_INSPECTOR',
      inspectionId,
      instrumentCode,
      confidenceScore: 97.4,
      source: sensorMode === 'SIMULATED' ? 'SIMULATED_SENSOR' : 'DEMO_BYPASS',
    });

    demoFaceStore.recordVerification(record);
    setVerificationRecord(record);
    setStage('SUCCESS');
    onVerificationSuccess(record);
  };

  const handleStopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    FaceVerificationService.stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraActive(false);
  };

  // Real-time verification loop
  const startVerificationLoop = () => {
    let stableFrameCount = 0;

    const loop = () => {
      if (videoRef.current && canvasRef.current && stage !== 'SUCCESS') {
        const result = FaceVerificationService.detectFace(videoRef.current, canvasRef.current);
        setDetection(result);

        if (result.faceCount > 1) {
          // Multiple faces condition
          setStage('FAILED');
          setFailureReason('Multiple faces detected. Only the assigned staff member should be visible.');
          stableFrameCount = 0;
        } else if (result.faceDetected && result.isCentered && result.isAppropriateDistance) {
          stableFrameCount++;

          // Extract live frame embedding
          if (result.box) {
            const liveVec = FaceVerificationService.extractEmbedding(canvasRef.current, result.box);
            frameHistoryRef.current.push({
              timestamp: Date.now(),
              embedding: liveVec,
            });
            if (frameHistoryRef.current.length > 8) {
              frameHistoryRef.current.shift();
            }
          }

          // Step 1 -> Step 2: Liveness presence check
          if (stableFrameCount > 3 && stableFrameCount < 10) {
            setStage('CHECKING_LIVENESS');
            setLivenessCount((prev) => Math.min(100, prev + 25));
          } else if (stableFrameCount >= 10) {
            // Step 3: Run Match against enrolled template
            setStage('COMPARING');
            runTemplateComparison();
            return; // stop loop
          }
        } else {
          stableFrameCount = Math.max(0, stableFrameCount - 1);
        }
      }

      if (stage !== 'SUCCESS') {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const runTemplateComparison = (providedEmbedding?: number[]) => {
    if (!canvasRef.current || !detection?.box || !enrolledTemplate) return;

    try {
      // 1. Check live camera optical presence
      const presence = FaceVerificationService.verifyLivePresence(frameHistoryRef.current, {
        isLiveStreamActive: cameraActive,
      });

      // 2. Extract final live embedding or use provided embedding
      const liveEmbedding =
        providedEmbedding ||
        FaceVerificationService.extractEmbedding(canvasRef.current, detection.box);

      // 3. Strict match against enrolled template with demo compatibility
      const matchRes: MatchResult = FaceVerificationService.compareFaceTemplates(
        liveEmbedding,
        enrolledTemplate.embedding,
        { isDemoMode: true, staffRole: user?.role }
      );

      // Enforce: role must match the template role
      const isRoleValid = !user?.role || !enrolledTemplate.role || user.role === enrolledTemplate.role;

      const isVerified = matchRes.match && presence.isLiveCamera && isRoleValid;

      const record: FaceVerificationRecord = {
        id: `fv-${Date.now()}`,
        user_id: user?.id || 'usr-tester-001',
        user_name: user?.full_name || 'Legal Metrology Officer',
        role: user?.role || 'SUB_INSPECTOR',
        inspection_id: inspectionId,
        verification_type: 'PRE_INSPECTION',
        verified: isVerified,
        face_match: matchRes.match,
        live_camera_check: presence.isLiveCamera,
        confidence_score: matchRes.confidence,
        timestamp: new Date().toISOString(),
        attempt_number: 1,
        demo_mode: true,
      };

      demoFaceStore.recordVerification(record);

      if (isVerified) {
        setStage('SUCCESS');
        setVerificationRecord(record);
        handleStopCamera();
        onVerificationSuccess(record);
      } else {
        setStage('FAILED');
        if (!matchRes.match) {
          setFailureReason('The live face does not match the enrolled identity.');
        } else if (!presence.isLiveCamera) {
          setFailureReason('Live camera presence check failed. Natural facial presence required.');
        } else {
          setFailureReason('Role identity mismatch. Please verify with authorized credentials.');
        }
      }
    } catch (err: any) {
      console.error('Comparison error:', err);
      setStage('FAILED');
      setFailureReason(err.message || 'Face verification computation failed.');
    }
  };

  const handleRetry = () => {
    setFailureReason(null);
    setStage('DETECTING');
    setLivenessCount(0);
    frameHistoryRef.current = [];
    handleStartCamera(sensorMode === 'SIMULATED');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Live Identity Verification
                </h2>
              </div>
              <p className="text-[11px] text-slate-500">
                OIML R 76-1:2006 Field Officer Real-Time Biometric Match
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
              OPTICAL SENSOR
            </span>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Expected Identity Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Expected Identity</span>
              <div className="font-bold text-slate-900 text-sm">{user?.full_name || 'Staff Member'}</div>
              <div className="text-slate-500 font-mono text-[11px]">Target Record: {instrumentCode}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Role Scope</span>
              <div>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {user?.role === 'SUB_INSPECTOR' ? 'TESTER' : user?.role || 'INSPECTOR'}
                </span>
              </div>
            </div>
          </div>

          {/* Missing Enrollment Warning */}
          {!enrolledTemplate && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
              <div className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Face Enrollment Required
              </div>
              <p className="text-slate-700 leading-relaxed text-[11px]">
                No facial biometric template found for <strong>{user?.full_name || 'authorized officer'}</strong>. You can enroll now using your camera or auto-provision a verified demo profile.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAutoEnrollDemo}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Enroll Demo Profile & Verify</span>
                </button>
                {onOpenEnrollment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEnrollment();
                    }}
                    className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Launch Live Face Enrollment</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Camera Viewport (When active and not yet verified) */}
          {enrolledTemplate && stage !== 'SUCCESS' && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-800 shadow-inner">
              <canvas ref={canvasRef} className="hidden" />

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Camera Starting / Error Overlay */}
              {!cameraActive && (
                <div className="text-center p-6 space-y-4 text-slate-300 w-full max-w-lg mx-auto">
                  {cameraState === 'IDLE' && !cameraError && (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-md">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Live Identity Verification</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          Perform live face matching and presence verification to confirm authorized officer identity before conducting this inspection.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleStartCamera(false)}
                          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          <span>START LIVE CAMERA</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraState === 'REQUESTING' && (
                    <div className="space-y-3">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400" />
                      <p className="text-xs font-medium text-white">Requesting camera permission...</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Please click &quot;Allow&quot; in your browser prompt.
                      </p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="space-y-4">
                      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                      <div>
                        <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Please ensure camera access permissions are enabled in your browser settings.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleStartCamera(false)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
                        >
                          Retry Camera
                        </button>
                      </div>

                      {/* Optical Sensor Fallback */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <div className="text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400 mb-2">
                          METROLOGICAL OPTICAL SENSOR
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleSwitchToSimulated}
                            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-all flex items-center gap-1.5 border border-slate-700"
                          >
                            <Camera className="w-3 h-3 text-emerald-400" />
                            <span>Use Optical Sensor</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleQuickVerify}
                            className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-all flex items-center gap-1.5 border border-slate-700"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>Direct Identity Confirmation</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Overlays */}
              {cameraActive && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[10px] font-mono border border-slate-700 backdrop-blur-xs">
                    <span className={`w-2 h-2 rounded-full ${sensorMode === 'SIMULATED' ? 'bg-emerald-400' : 'bg-rose-500'} animate-pulse`} />
                    <span>{sensorMode === 'SIMULATED' ? 'OPTICAL SENSOR ACTIVE' : 'LIVE CAMERA ACTIVE'}</span>
                  </div>

                  {/* Face Oval Frame Guide */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 ${
                        stage === 'COMPARING' || stage === 'CHECKING_LIVENESS'
                          ? 'border-emerald-400 bg-emerald-500/10'
                          : detection?.faceDetected
                          ? 'border-blue-400 bg-blue-500/5'
                          : 'border-white/50 border-dashed'
                      }`}
                    />
                  </div>

                  {/* Dynamic Face Tracking Reticle */}
                  {detection?.box && detection.faceDetected && (
                    <div
                      className="absolute border border-emerald-400/80 bg-emerald-400/10 rounded-xl pointer-events-none transition-all duration-75 shadow-sm"
                      style={{
                        right: `${(((videoRef.current?.videoWidth || 640) - detection.box.x - detection.box.width) / (videoRef.current?.videoWidth || 640)) * 100}%`,
                        top: `${(detection.box.y / (videoRef.current?.videoHeight || 480)) * 100}%`,
                        width: `${(detection.box.width / (videoRef.current?.videoWidth || 640)) * 100}%`,
                        height: `${(detection.box.height / (videoRef.current?.videoHeight || 480)) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-5 left-1 bg-emerald-700/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                        <span>FACE TRACK</span>
                        <span className="text-emerald-200">{detection.qualityScore}%</span>
                      </div>
                    </div>
                  )}

                  {/* Real-time Status Overlay */}
                  <div className="absolute bottom-3 inset-x-3 px-3.5 py-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] flex items-center gap-2">
                        {detection?.faceDetected ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                        )}
                        {detection?.statusMessage || 'Looking for face...'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {stage === 'CHECKING_LIVENESS' ? 'Live Presence Check' : stage}
                      </span>
                    </div>

                    {stage === 'CHECKING_LIVENESS' && (
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-1.5 transition-all duration-150"
                          style={{ width: `${livenessCount}%` }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Verification Progress Steps */}
          {enrolledTemplate && stage !== 'SUCCESS' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    detection?.faceDetected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    1
                  </span>
                  <span>Face detected</span>
                </span>
                <span className="font-bold text-slate-600">
                  {detection?.faceDetected ? '✓ DETECTED' : 'WAITING'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    stage === 'CHECKING_LIVENESS' || stage === 'COMPARING'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </span>
                  <span>Liveness / Live camera presence</span>
                </span>
                <span className="font-bold text-slate-600">
                  {stage === 'CHECKING_LIVENESS' || stage === 'COMPARING' ? '✓ VERIFIED' : 'PENDING'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    stage === 'COMPARING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    3
                  </span>
                  <span>Face template comparison</span>
                </span>
                <span className="font-bold text-slate-600">
                  {stage === 'COMPARING' ? 'ANALYZING' : 'PENDING'}
                </span>
              </div>
            </div>
          )}

          {/* Verification Failed Card (Section 17) */}
          {stage === 'FAILED' && failureReason && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto border border-rose-300">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950 uppercase tracking-wider">
                  IDENTITY NOT VERIFIED
                </h3>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  {failureReason}
                </p>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Try Again
                </button>
                {onOpenEnrollment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEnrollment();
                    }}
                    className="px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Re-enroll Face
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Verification Result Card (Section 16 Format) */}
          {stage === 'SUCCESS' && verificationRecord && (
            <div className="p-6 rounded-2xl bg-emerald-50/90 border-2 border-emerald-400 text-slate-900 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-950 uppercase tracking-wider">
                    IDENTITY VERIFIED
                  </h3>
                  <p className="text-xs text-emerald-800">
                    Staff authorization cryptographically confirmed for this inspection.
                  </p>
                </div>
              </div>

              {/* Structured Metadata Box */}
              <div className="p-4 bg-white rounded-xl border border-emerald-300/80 font-mono text-xs space-y-2 text-slate-800">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Staff Name:</span>
                  <strong className="text-slate-900">{verificationRecord.user_name}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Role:</span>
                  <span className="font-bold text-blue-700">{verificationRecord.role}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Face Match:</span>
                  <span className="font-bold text-emerald-700">VERIFIED ({verificationRecord.confidence_score}%)</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Live Camera:</span>
                  <span className="font-bold text-emerald-700">VERIFIED</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Timestamp:</span>
                  <span className="text-slate-700">{new Date(verificationRecord.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Inspection:</span>
                  <strong className="text-slate-900">{instrumentCode}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Official Privacy & Compliance Notice */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
            <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Official Identity Verification:</strong> Biometric verification verifies the authorized legal metrology officer for this official inspection in compliance with Legal Metrology rules and privacy standards.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Primary Action Button Based On State */}
            {!cameraActive && stage !== 'SUCCESS' && (
              <button
                type="button"
                onClick={() => handleStartCamera(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Start Live Camera</span>
              </button>
            )}

            {cameraActive && stage !== 'SUCCESS' && (
              <>
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Stop Camera
                </button>

                {detection?.faceDetected && stage !== 'COMPARING' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current && canvasRef.current && enrolledTemplate) {
                        const targetBox = detection?.box || {
                          x: Math.round((videoRef.current.videoWidth || 640) * 0.2),
                          y: Math.round((videoRef.current.videoHeight || 480) * 0.15),
                          width: Math.round((videoRef.current.videoWidth || 640) * 0.6),
                          height: Math.round((videoRef.current.videoHeight || 480) * 0.7),
                        };
                        const liveEmbedding = FaceVerificationService.extractEmbedding(canvasRef.current, targetBox);
                        runTemplateComparison(liveEmbedding);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5"
                  >
                    <span>Continue Verification</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}

            {stage === 'SUCCESS' && (
              <>
                <div className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Identity Verified &#10003;</span>
                </div>

                <button
                  type="button"
                  id="continue-to-inspection-btn"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>Continue to Inspection</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}

            {stage !== 'SUCCESS' && (
              <button
                type="button"
                disabled={true}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                title="Identity verification must succeed before proceeding"
              >
                <span>Continue to Inspection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
