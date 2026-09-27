import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import {
  FaceVerificationService,
  DetectionResult,
  FaceBoundingBox,
  CameraState,
} from '../../services/faceVerificationService.ts';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  UserCheck,
  AlertTriangle,
  ExternalLink,
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
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [guidedStep, setGuidedStep] = useState<'LOOK_STRAIGHT' | 'CENTER_FACE' | 'HOLD_STILL' | 'READY_TO_CAPTURE' | 'CAPTURING' | 'ENROLLED'>('LOOK_STRAIGHT');
  const [holdStillCount, setHoldStillCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);

  // Stop camera when modal is closed
  useEffect(() => {
    if (!isOpen) {
      handleStopCamera();
      setCameraState('IDLE');
      setEnrollmentComplete(false);
      setGuidedStep('LOOK_STRAIGHT');
      setHoldStillCount(0);
      setCameraError(null);
    }
  }, [isOpen]);

  const handleStartCamera = async (forceSimulated?: boolean) => {
    setCameraError(null);
    setCameraActive(false);
    setCameraState('REQUESTING');

    const useSim = forceSimulated ?? (sensorMode === 'SIMULATED');

    try {
      if (videoRef.current) {
        const stream = await FaceVerificationService.startCamera(videoRef.current, useSim);
        streamRef.current = stream;
        setCameraActive(true);
        setCameraState('READY');
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      const classified = FaceVerificationService.classifyCameraError(err);
      setCameraState(classified.state);
      setCameraError(classified.message);
    }
  };

  const handleSwitchToSimulated = () => {
    setSensorMode('SIMULATED');
    setGuidedStep('LOOK_STRAIGHT');
    setHoldStillCount(0);
    handleStartCamera(true);
  };

  const handleQuickEnroll = () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const tmpl = demoFaceStore.ensureStaffTemplate(user);
      setEnrollmentComplete(true);
      setGuidedStep('ENROLLED');
      handleStopCamera();
      if (onEnrollmentSuccess) {
        onEnrollmentSuccess();
      }
    } catch (e: any) {
      setCameraError(e.message || 'Quick enrollment failed.');
    } finally {
      setIsProcessing(false);
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

  // Continuous frame analysis loop
  const startDetectionLoop = () => {
    const loop = () => {
      if (videoRef.current && canvasRef.current && !enrollmentComplete) {
        const result = FaceVerificationService.detectFace(videoRef.current, canvasRef.current);
        setDetection(result);

        // Update guided step based on real detection
        if (!result.faceDetected) {
          setGuidedStep('LOOK_STRAIGHT');
          setHoldStillCount(0);
        } else {
          // Face detected in camera! Enable capture immediately
          setGuidedStep('READY_TO_CAPTURE');
          setHoldStillCount((prev) => prev + 1);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handleCaptureAndEnroll = async () => {
    const video = videoRef.current;
    if (!video) return;

    setIsProcessing(true);
    setGuidedStep('CAPTURING');

    try {
      // 1. Draw crisp high-res frame
      const vidW = video.videoWidth || 640;
      const vidH = video.videoHeight || 480;

      // Use canvasRef or fallback canvas element
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = vidW;
      canvas.height = vidH;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, vidW, vidH);
      }

      // Safe target bounding box (use detection box or centered facial ellipse fallback)
      const targetBox: FaceBoundingBox = detection?.box || {
        x: Math.round(vidW * 0.2),
        y: Math.round(vidH * 0.15),
        width: Math.round(vidW * 0.6),
        height: Math.round(vidH * 0.7),
      };

      // 2. Extract 64-dimensional biometric spatial embedding vector
      const embedding = FaceVerificationService.extractEmbedding(canvas, targetBox);

      // 3. Save to isolated demo biometric repository (NO raw photos in storage!)
      const staffTemplate = {
        id: `tmpl-${user?.id || 'staff'}-${Date.now()}`,
        user_id: user?.id || 'usr-tester-001',
        user_name: user?.full_name || 'Legal Metrology Officer',
        role: user?.role || 'SUB_INSPECTOR',
        embedding,
        enrolled_at: new Date().toISOString(),
        demo_mode: true,
        device_info: `${navigator.userAgent.slice(0, 40)}... (Live Camera)`,
      };

      demoFaceStore.saveStaffTemplate(staffTemplate);

      setEnrollmentComplete(true);
      setGuidedStep('ENROLLED');
      handleStopCamera();

      if (onEnrollmentSuccess) {
        onEnrollmentSuccess();
      }
    } catch (err: any) {
      console.error('Enrollment error:', err);
      setCameraError(err.message || 'Failed to generate facial embedding template.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
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
                  Live Face Enrollment
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  METROLOGY ID
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Authorized Legal Metrology Staff Identity Template Registration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
              HARDWARE WEBCAM
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
          {/* Staff Info Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Staff Identity</div>
              <div className="font-bold text-slate-900 text-sm mt-0.5">{user?.full_name || 'Metrology Officer'}</div>
              <div className="text-slate-500 font-mono text-[11px]">{user?.designation || 'Field Legal Metrology Officer'}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Authorized Role</div>
              <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
                {user?.role === 'SUB_INSPECTOR' ? 'TESTER' : user?.role || 'TESTER'}
              </span>
            </div>
          </div>

          {/* Guidelines */}
          {!enrollmentComplete && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Enrollment Instructions:
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div>&bull; Allow device camera access</div>
                <div>&bull; Position face inside the oval guide</div>
                <div>&bull; Look directly at the camera</div>
                <div>&bull; Remove sunglasses or masks</div>
                <div>&bull; Ensure adequate front lighting</div>
                <div>&bull; Hold still for automated capture</div>
              </div>
            </div>
          )}

          {/* Camera Viewport Area */}
          {!enrollmentComplete ? (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border-2 border-slate-800 shadow-inner">
              {/* Hidden offscreen canvas for computer vision */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${
                  cameraActive ? 'block' : 'hidden'
                }`}
              />

              {/* Camera Starting / Error Overlay */}
              {!cameraActive && (
                <div className="text-center p-6 space-y-4 text-slate-300 max-w-md mx-auto">
                  {cameraState === 'IDLE' && !cameraError && (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-md">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Live Camera Enrollment</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Click below to start your device camera and register your authorized officer template.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartCamera(false)}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Live Camera</span>
                      </button>
                    </div>
                  )}

                  {cameraState === 'REQUESTING' && (
                    <div className="space-y-3">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
                      <p className="text-xs font-medium text-white">Requesting camera permission...</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Please click &quot;Allow&quot; if prompted by your browser.
                      </p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="space-y-3">
                      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                      <p className="text-xs text-rose-300 font-semibold">{cameraError}</p>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Please ensure camera access permissions are enabled in your browser settings.
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleStartCamera(false)}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition-all"
                        >
                          Retry Camera
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Overlay Guides */}
              {cameraActive && (
                <>
                  {/* Top Live Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[10px] font-mono border border-slate-700 backdrop-blur-xs">
                    <span className={`w-2 h-2 rounded-full ${sensorMode === 'SIMULATED' ? 'bg-blue-400' : 'bg-rose-500'} animate-pulse`} />
                    <span>{sensorMode === 'SIMULATED' ? 'OPTICAL SENSOR' : 'LIVE CAMERA'}</span>
                  </div>

                  {/* Center Oval Face Guide */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 shadow-2xl ${
                        detection?.faceDetected
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-emerald-500/20'
                          : 'border-white/50 border-dashed'
                      }`}
                    />
                  </div>

                  {/* Dynamic Face Tracking Reticle */}
                  {detection?.box && detection.faceDetected && (
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

                  {/* Status Bar Overlay */}
                  <div className="absolute bottom-3 inset-x-3 px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-white text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {detection?.faceDetected ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                      <span className="font-semibold text-[11px]">
                        {detection?.faceDetected
                          ? 'Face detected in frame — Ready to capture!'
                          : (detection?.statusMessage || 'Position yourself in front of the camera')}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      {detection?.faceDetected ? 'READY TO CAPTURE' : 'POSITIONING'}
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Enrollment Success View */
            <div className="p-6 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Live Face Enrollment Completed
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Biometric spatial embedding template generated and registered for{' '}
                  <strong>{user?.full_name}</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 text-left text-xs font-mono space-y-1.5 max-w-md mx-auto">
                <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">
                  Biometric Descriptor Metadata:
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vector Dimension:</span>
                  <span className="font-bold text-slate-800">64-d Normalized Spatial Histogram</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Raw Photo Stored:</span>
                  <span className="font-bold text-emerald-700">NO (Zero Raw Biometric Storage)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-700">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Access Scope:</span>
                  <span className="font-bold text-blue-700">{user?.role} Restricted</span>
                </div>
              </div>
            </div>
          )}

          {/* Official Privacy & Regulatory Notice */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Official Identity Verification:</strong> Biometric template registration verifies the authorized legal metrology officer in compliance with Legal Metrology rules and data protection standards.
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickEnroll}
                className="px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Instantly enroll authorized profile in demo mode"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Enroll Profile</span>
              </button>

              <button
                type="button"
                disabled={!cameraActive || isProcessing}
                onClick={handleCaptureAndEnroll}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>{isProcessing ? 'Generating Template...' : 'Capture & Enroll Face'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready for Inspection Verification</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
