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
  ArrowRight,
  Lock,
  UserCheck,
  AlertTriangle,
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Verification pipeline states — Default is ALWAYS NOT VERIFIED
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [stage, setStage] = useState<'IDLE' | 'DETECTING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [liveMatchResult, setLiveMatchResult] = useState<MatchResult | null>(null);
  const [verificationRecord, setVerificationRecord] = useState<FaceVerificationRecord | null>(null);
  const [liveCapturedPhoto, setLiveCapturedPhoto] = useState<string | null>(null);

  // Consecutive matches required to confirm identity
  const consecutiveMatchCountRef = useRef(0);

  // Enrolled profile for the active user
  const [enrolledTemplate, setEnrolledTemplate] = useState(user ? demoFaceStore.getStaffTemplate(user.id) : null);

  useEffect(() => {
    if (!isOpen) {
      handleStopCamera();
      setCameraState('IDLE');
      setStage('IDLE');
      setVerificationRecord(null);
      setLiveMatchResult(null);
      setCameraError(null);
      setLiveCapturedPhoto(null);
      setDetection(null);
      consecutiveMatchCountRef.current = 0;
      return;
    }

    // Refresh enrolled template state upon opening
    const tmpl = user ? demoFaceStore.getStaffTemplate(user.id) : null;
    setEnrolledTemplate(tmpl);

    setStage('IDLE');
    setCameraState('IDLE');
    setVerificationRecord(null);
    setLiveMatchResult(null);
    consecutiveMatchCountRef.current = 0;
  }, [isOpen, user?.id]);

  const handleStartCamera = async () => {
    setCameraError(null);
    setCameraActive(false);
    setCameraState('REQUESTING');
    setStage('DETECTING');
    consecutiveMatchCountRef.current = 0;

    try {
      if (videoRef.current) {
        const stream = await FaceVerificationService.startCamera(videoRef.current);
        streamRef.current = stream;
        setCameraActive(true);
        setCameraState('READY');
        startVerificationLoop();
      }
    } catch (err: any) {
      console.warn('Physical camera start error:', err);
      const classified = FaceVerificationService.classifyCameraError(err);
      setCameraState(classified.state);
      setCameraError(classified.message);
      setStage('FAILED');
    }
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

  // Real-time verification loop: runs per frame directly from hardware camera
  const startVerificationLoop = () => {
    let lastComparisonTime = 0;

    const loop = (timestamp: number) => {
      if (videoRef.current && canvasRef.current && stage !== 'SUCCESS') {
        // 1. Detect face in current live video frame
        const result = FaceVerificationService.detectFace(videoRef.current, canvasRef.current);
        setDetection(result);

        // 2. Strict branching based on real face presence
        if (!result.faceDetected || result.faceCount === 0) {
          // NO FACE IN FRAME: strictly reset and fail
          setLiveMatchResult({
            match: false,
            decision: 'NO_FACE',
            similarityPercentage: null,
            cosineSimilarity: 0,
            euclideanDistance: 2.0,
            thresholdUsed: FaceVerificationService.COSINE_MATCH_THRESHOLD,
            message: 'No face detected in camera view.',
          });
          consecutiveMatchCountRef.current = 0;
        } else if (result.faceCount > 1) {
          // MULTIPLE FACES: strictly fail
          setLiveMatchResult({
            match: false,
            decision: 'MULTIPLE_FACES',
            similarityPercentage: null,
            cosineSimilarity: 0,
            euclideanDistance: 2.0,
            thresholdUsed: FaceVerificationService.COSINE_MATCH_THRESHOLD,
            message: 'Multiple faces detected. Only the assigned officer must be in view.',
          });
          consecutiveMatchCountRef.current = 0;
        } else if (result.box && enrolledTemplate) {
          // EXACTLY ONE FACE DETECTED: run comparison throttled to ~10 fps for smooth performance
          if (timestamp - lastComparisonTime > 100) {
            lastComparisonTime = timestamp;

            // Extract live 128D embedding vector from the exact live webcam frame
            const liveVec = FaceVerificationService.extractEmbedding(canvasRef.current, result.box);

            // Compare live embedding with enrolled template
            const matchRes = FaceVerificationService.compareFaceTemplates(
              liveVec,
              enrolledTemplate.embedding
            );
            setLiveMatchResult(matchRes);

            if (matchRes.match) {
              consecutiveMatchCountRef.current++;
              // Require 3 consecutive live matching frames to prevent transient noise
              if (consecutiveMatchCountRef.current >= 3) {
                const livePhoto = FaceVerificationService.captureFaceSnapshot(canvasRef.current, result.box);
                setLiveCapturedPhoto(livePhoto);
                confirmVerificationSuccess(matchRes, livePhoto);
                return; // stop loop
              }
            } else {
              consecutiveMatchCountRef.current = 0;
            }
          }
        }
      }

      if (stage !== 'SUCCESS') {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const confirmVerificationSuccess = (matchRes: MatchResult, livePhoto?: string) => {
    const effectiveUser = user || {
      id: 'usr-tester-001',
      full_name: 'Amit Patel',
      role: 'SUB_INSPECTOR' as const,
    };

    const record = FaceVerificationService.createVerificationRecord({
      userId: effectiveUser.id,
      userName: effectiveUser.full_name || 'Legal Metrology Officer',
      role: effectiveUser.role || 'SUB_INSPECTOR',
      inspectionId,
      verified: true,
      confidenceScore: matchRes.similarityPercentage || 90.0,
      photoData: livePhoto,
    });

    demoFaceStore.recordVerification(record);
    setVerificationRecord(record);
    setStage('SUCCESS');
    handleStopCamera();
    onVerificationSuccess(record);
  };

  const handleRetry = () => {
    setStage('DETECTING');
    setLiveMatchResult(null);
    consecutiveMatchCountRef.current = 0;
    handleStartCamera();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-xs text-white ${
              stage === 'SUCCESS' ? 'bg-emerald-600' : 'bg-blue-600'
            }`}>
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Live Face Identity Verification
                </h2>
              </div>
              <p className="text-[11px] text-slate-500">
                OIML R 76-1:2006 Field Officer Real-Time Biometric Confirmation
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
          {/* Enrolled Profile Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {enrolledTemplate?.photo_data ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-blue-500 shadow-xs shrink-0">
                  <img
                    src={enrolledTemplate.photo_data}
                    alt="Enrolled Template"
                    className="w-full h-full object-cover -scale-x-100"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Authorized Officer Reference</span>
                <div className="font-bold text-slate-900 text-sm">{user?.full_name || 'Legal Metrology Officer'}</div>
                <div className="text-slate-500 font-mono text-[11px]">Inspection: {instrumentCode}</div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Enrolled Reference</span>
              <div>
                {enrolledTemplate ? (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    ENROLLED
                  </span>
                ) : (
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    NOT ENROLLED
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Missing Enrollment Notice */}
          {!enrolledTemplate && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-700" />
                <span>Biometric Template Not Found</span>
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed">
                You must first enroll your face using the physical webcam before performing biometric verification.
              </p>
              {onOpenEnrollment && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEnrollment();
                  }}
                  className="mt-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Enroll Face Now</span>
                </button>
              )}
            </div>
          )}

          {/* Real Camera Viewport */}
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

              {/* Idle / Starting Overlay */}
              {!cameraActive && (
                <div className="text-center p-6 space-y-4 text-slate-300 w-full max-w-lg mx-auto">
                  {cameraState === 'IDLE' && !cameraError && (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-md">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Live Physical Webcam Verification</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          Click below to start your webcam. Position your face in the oval to perform genuine 128-D biometric comparison.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleStartCamera}
                          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          <span>START PHYSICAL CAMERA</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraState === 'REQUESTING' && (
                    <div className="space-y-3">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
                      <p className="text-xs font-medium text-white">Connecting physical webcam...</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Please grant webcam permission in your browser prompt.
                      </p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="space-y-4">
                      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                      <div>
                        <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>
                        <p className="text-[11px] text-slate-300 mt-1">
                          Camera permission is required for identity verification.
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleStartCamera}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
                        >
                          Retry Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Overlays */}
              {cameraActive && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[10px] font-mono border border-slate-700 backdrop-blur-xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span>LIVE WEBCAM ACTIVE</span>
                  </div>

                  {/* Face Oval Frame Guide */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 ${
                        liveMatchResult?.match
                          ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                          : detection?.faceDetected
                          ? 'border-blue-400 bg-blue-500/5'
                          : 'border-white/50 border-dashed'
                      }`}
                    />
                  </div>

                  {/* Dynamic Face Tracking Reticle */}
                  {detection?.box && detection.faceDetected && (
                    <div
                      className={`absolute border-2 rounded-xl pointer-events-none transition-all duration-75 shadow-sm ${
                        liveMatchResult?.match
                          ? 'border-emerald-400 bg-emerald-400/15'
                          : 'border-blue-400 bg-blue-400/10'
                      }`}
                      style={{
                        right: `${(((videoRef.current?.videoWidth || 640) - detection.box.x - detection.box.width) / (videoRef.current?.videoWidth || 640)) * 100}%`,
                        top: `${(detection.box.y / (videoRef.current?.videoHeight || 480)) * 100}%`,
                        width: `${(detection.box.width / (videoRef.current?.videoWidth || 640)) * 100}%`,
                        height: `${(detection.box.height / (videoRef.current?.videoHeight || 480)) * 100}%`,
                      }}
                    >
                      <div className={`absolute -top-5 left-1 text-white text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs ${
                        liveMatchResult?.match ? 'bg-emerald-700/95' : 'bg-blue-700/95'
                      }`}>
                        <span>{liveMatchResult?.match ? 'MATCH CONFIRMED' : 'FACE TRACK'}</span>
                        {liveMatchResult?.similarityPercentage !== null && (
                          <span className="text-white font-bold">{liveMatchResult?.similarityPercentage}%</span>
                        )}
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
                        <span>
                          {detection?.faceDetected
                            ? liveMatchResult?.message || 'Analyzing face...'
                            : 'NO FACE DETECTED — Position face in camera'}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-300">
                        {liveMatchResult?.similarityPercentage !== null
                          ? `SIMILARITY: ${liveMatchResult?.similarityPercentage}%`
                          : 'SIMILARITY: N/A'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Verification Progress Steps — Real Metrics */}
          {enrolledTemplate && stage !== 'SUCCESS' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    detection?.faceDetected && detection.faceCount === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    1
                  </span>
                  <span>Face detected in frame</span>
                </span>
                <span className={`font-bold ${
                  detection?.faceDetected && detection.faceCount === 1 ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {detection?.faceDetected && detection.faceCount === 1
                    ? '✓ DETECTED'
                    : detection?.faceCount && detection.faceCount > 1
                    ? 'MULTIPLE FACES'
                    : 'NO FACE'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    liveMatchResult?.match ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </span>
                  <span>128-D Biometric Match</span>
                </span>
                <span className={`font-bold ${
                  liveMatchResult?.match ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {liveMatchResult?.match
                    ? `✓ MATCHED (${liveMatchResult.similarityPercentage}%)`
                    : liveMatchResult?.similarityPercentage !== null && liveMatchResult?.similarityPercentage !== undefined
                    ? `NOT MATCHED (${liveMatchResult.similarityPercentage}% < 85%)`
                    : 'PENDING'}
                </span>
              </div>
            </div>
          )}

          {/* Verification Success Card */}
          {stage === 'SUCCESS' && verificationRecord && (
            <div className="p-6 rounded-2xl bg-emerald-50/90 border-2 border-emerald-400 text-slate-900 space-y-4 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950 uppercase tracking-wider">
                      BIOMETRIC IDENTITY VERIFIED
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Live physical webcam face matched against enrolled officer template.
                    </p>
                  </div>
                </div>

                {/* Real Live Captured Photo Crop */}
                {liveCapturedPhoto && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md">
                    <img
                      src={liveCapturedPhoto}
                      alt="Verified Live Face"
                      className="w-full h-full object-cover -scale-x-100"
                    />
                  </div>
                )}
              </div>

              {/* Structured Metadata Box */}
              <div className="p-4 bg-white rounded-xl border border-emerald-300/80 font-mono text-xs space-y-2 text-slate-800">
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Officer Name:</span>
                  <strong className="text-slate-900">{verificationRecord.user_name}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Role:</span>
                  <span className="font-bold text-blue-700">{verificationRecord.role}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Biometric Similarity:</span>
                  <span className="font-bold text-emerald-700">VERIFIED ({verificationRecord.confidence_score}%)</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 uppercase font-sans text-[11px]">Algorithm:</span>
                  <span className="text-slate-700">128-D LBP/HOG Cosine Metric</span>
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

          {/* Privacy Notice */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
            <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Biometric Authentication:</strong> Facial biometric comparison is strictly computed in real time from live camera frames to authenticate the legal metrology officer.
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
            {/* When Camera is idle */}
            {!cameraActive && stage !== 'SUCCESS' && enrolledTemplate && (
              <button
                type="button"
                onClick={handleStartCamera}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Start Live Camera</span>
              </button>
            )}

            {/* When Camera is active but not verified */}
            {cameraActive && stage !== 'SUCCESS' && (
              <button
                type="button"
                onClick={handleStopCamera}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                Stop Camera
              </button>
            )}

            {/* When Verified Successfully */}
            {stage === 'SUCCESS' && (
              <button
                type="button"
                id="continue-to-inspection-btn"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Continue to Inspection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* When Not Verified: Continue button is DISABLED */}
            {stage !== 'SUCCESS' && (
              <button
                type="button"
                disabled={true}
                className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                title="Face biometric match must pass before proceeding"
              >
                <span>Continue to Inspection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
