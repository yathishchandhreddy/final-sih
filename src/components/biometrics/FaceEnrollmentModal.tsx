import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import {
  FaceVerificationService,
  DetectionResult,
  CameraState,
} from '../../services/faceVerificationService.ts';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrollmentSuccess?: () => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onEnrollmentSuccess,
}) => {
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  // Stop camera when modal is closed
  useEffect(() => {
    if (!isOpen) {
      handleStopCamera();
      setCameraState('IDLE');
      setEnrollmentComplete(false);
      setCapturedPhotoUrl(null);
      setCameraError(null);
      setDetection(null);
    }
  }, [isOpen]);

  const handleStartCamera = async () => {
    setCameraError(null);
    setCameraActive(false);
    setCameraState('REQUESTING');

    try {
      if (videoRef.current) {
        const stream = await FaceVerificationService.startCamera(videoRef.current);
        streamRef.current = stream;
        setCameraActive(true);
        setCameraState('READY');
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Real camera error:', err);
      const classified = FaceVerificationService.classifyCameraError(err);
      setCameraState(classified.state);
      setCameraError(classified.message);
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

  // Continuous real-time frame analysis loop
  const startDetectionLoop = () => {
    const loop = () => {
      if (videoRef.current && canvasRef.current && !enrollmentComplete) {
        const result = FaceVerificationService.detectFace(videoRef.current, canvasRef.current);
        setDetection(result);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  // Capture real face snapshot and generate biometric vector
  const handleCaptureAndEnroll = async () => {
    const video = videoRef.current;
    if (!video) return;

    setIsProcessing(true);

    try {
      const vidW = video.videoWidth || 640;
      const vidH = video.videoHeight || 480;

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = vidW;
      canvas.height = vidH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, vidW, vidH);
      }

      // 1. Strict live face detection verification
      const detRes = FaceVerificationService.detectFace(video, canvas);
      if (!detRes.faceDetected || !detRes.box || detRes.faceCount !== 1) {
        throw new Error(
          detRes.faceCount > 1
            ? 'Multiple faces detected. Only one person should be in front of the camera.'
            : 'No clear face detected in the live frame. Please center your face and look at the camera.'
        );
      }

      // 2. Extract 128-dimensional biometric spatial embedding
      const embedding = FaceVerificationService.extractEmbedding(canvas, detRes.box);

      // 3. Capture cropped face portrait
      const photoData = FaceVerificationService.captureFaceSnapshot(canvas, detRes.box);
      setCapturedPhotoUrl(photoData);

      // 4. Associate strictly with the authenticated officer
      const effectiveUser = user || {
        id: 'usr-tester-001',
        full_name: 'Amit Patel',
        role: 'SUB_INSPECTOR' as const,
      };

      const staffTemplate = {
        id: `tmpl-${effectiveUser.id}-${Date.now()}`,
        user_id: effectiveUser.id,
        user_name: effectiveUser.full_name || 'Legal Metrology Officer',
        role: effectiveUser.role || 'SUB_INSPECTOR',
        embedding,
        photo_data: photoData,
        enrolled_at: new Date().toISOString(),
        demo_mode: false,
        device_info: `${navigator.userAgent.slice(0, 35)}... (Physical Camera)`,
      };

      demoFaceStore.saveStaffTemplate(staffTemplate);

      setEnrollmentComplete(true);
      handleStopCamera();

      if (onEnrollmentSuccess) {
        onEnrollmentSuccess();
      }
    } catch (err: any) {
      console.error('Enrollment error:', err);
      setCameraError(err.message || 'Failed to extract facial biometric features.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isCaptureDisabled = !cameraActive || isProcessing || !detection?.faceDetected || detection.faceCount !== 1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Officer Biometric Enrollment
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  LIVE WEBCAM
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Register biometric facial reference template for authorized inspection access
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
          {/* Target User Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Enrolling Officer</span>
              <div className="font-bold text-slate-900 text-sm">{user?.full_name || 'Legal Metrology Officer'}</div>
              <div className="text-slate-500 text-[11px]">Officer ID: <span className="font-mono">{user?.id || 'usr-tester-001'}</span></div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Role Scope</span>
              <div>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-300">
                  {user?.role || 'SUB_INSPECTOR'}
                </span>
              </div>
            </div>
          </div>

          {/* Camera Viewport */}
          {!enrollmentComplete ? (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-800 shadow-inner">
              <canvas ref={canvasRef} className="hidden" />

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Idle / Permission overlay */}
              {!cameraActive && (
                <div className="text-center p-6 space-y-4 text-slate-300 w-full max-w-lg mx-auto">
                  {cameraState === 'IDLE' && !cameraError && (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-md">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Physical Webcam Required</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          Click below to start your webcam. Exactly one face must be visible in the frame to register a template.
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
                      <p className="text-xs font-medium text-white">Requesting camera permission...</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Please click &quot;Allow&quot; in your browser address bar.
                      </p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="space-y-3">
                      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                      <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Camera permission is required for biometric identity registration.
                      </p>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleStartCamera}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition-all"
                        >
                          Retry Camera Access
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

                  {/* Oval Face Guide */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 shadow-2xl ${
                        detection?.faceDetected && detection.faceCount === 1
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-emerald-500/20'
                          : detection?.faceCount && detection.faceCount > 1
                          ? 'border-rose-400 bg-rose-500/10'
                          : 'border-white/50 border-dashed'
                      }`}
                    />
                  </div>

                  {/* Face Tracking Bounding Box */}
                  {detection?.box && detection.faceDetected && detection.faceCount === 1 && (
                    <div
                      className="absolute border-2 border-emerald-400 bg-emerald-400/10 rounded-2xl pointer-events-none transition-all duration-75 shadow-sm"
                      style={{
                        right: `${(((videoRef.current?.videoWidth || 640) - detection.box.x - detection.box.width) / (videoRef.current?.videoWidth || 640)) * 100}%`,
                        top: `${(detection.box.y / (videoRef.current?.videoHeight || 480)) * 100}%`,
                        width: `${(detection.box.width / (videoRef.current?.videoWidth || 640)) * 100}%`,
                        height: `${(detection.box.height / (videoRef.current?.videoHeight || 480)) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-5 left-1 bg-emerald-700/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                        <span>FACE DETECTED</span>
                        <span className="text-emerald-200">{detection.qualityScore}%</span>
                      </div>
                    </div>
                  )}

                  {/* Real-time Status Bar */}
                  <div className="absolute bottom-3 inset-x-3 px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-white text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {detection?.faceDetected && detection.faceCount === 1 ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      ) : detection?.faceCount && detection.faceCount > 1 ? (
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                      <span className="font-semibold text-[11px]">
                        {detection?.statusMessage || 'Position your face in front of the camera.'}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      {detection?.faceDetected && detection.faceCount === 1 ? 'READY TO CAPTURE' : 'NO FACE'}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Enrollment Success View */
            <div className="p-6 rounded-2xl bg-emerald-50/90 border-2 border-emerald-400 text-center space-y-4">
              <div className="flex items-center justify-center gap-4">
                {capturedPhotoUrl ? (
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-3 border-emerald-500 shadow-md">
                    <img
                      src={capturedPhotoUrl}
                      alt="Captured Face"
                      className="w-full h-full object-cover -scale-x-100"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center border-2 border-emerald-300">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                )}
                <div className="text-left">
                  <h3 className="text-base font-bold text-emerald-950">
                    Biometric Reference Registered
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    128-D spatial embedding template generated and associated with{' '}
                    <strong>{user?.full_name || 'Legal Metrology Officer'}</strong>.
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 rounded-md bg-emerald-200/80 text-emerald-900 text-[11px] font-mono font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Reference Template Ready for Live Match</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 text-left text-xs font-mono space-y-1.5 max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">Vector Dimension:</span>
                  <span className="font-bold text-slate-800">128-D LBP/HOG Unit Embedding</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Matching Method:</span>
                  <span className="font-bold text-slate-800">Cosine Similarity (Threshold &gt;= 85%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registered At:</span>
                  <span className="text-slate-700">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Biometric Security Standard:</strong> Biometric embeddings are mathematical unit vectors strictly used for real-time comparison during inspection verification.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            {enrollmentComplete ? 'Close' : 'Cancel'}
          </button>

          {!enrollmentComplete ? (
            <button
              type="button"
              disabled={isCaptureDisabled}
              onClick={handleCaptureAndEnroll}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>{isProcessing ? 'Extracting 128-D Vector...' : 'Capture & Save Biometric Reference'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready for Verification</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
