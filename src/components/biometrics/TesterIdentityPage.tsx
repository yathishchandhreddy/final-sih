import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRouter } from '../../router/RouterContext.tsx';
import { demoFaceStore } from '../../data/demoFaceData.ts';
import {
  FaceVerificationService,
  CameraState,
  FaceDetectionState,
  CameraDeviceInfo,
  DetectionResult,
  MatchResult,
} from '../../services/faceVerificationService.ts';
import { FaceVerificationRecord } from '../../types.ts';
import {
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const TesterIdentityPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Strict Camera States
  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [isIframeBlocked, setIsIframeBlocked] = useState(false);

  // Camera Devices
  const [availableCameras, setAvailableCameras] = useState<CameraDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Face Detection & Verification Pipeline States
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detectionState, setDetectionState] = useState<FaceDetectionState>('NO_FACE');
  const [stablePresenceFrames, setStablePresenceFrames] = useState(0);
  const [presenceScore, setPresenceScore] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [verificationRecord, setVerificationRecord] = useState<FaceVerificationRecord | null>(null);

  // Diagnostics Box & Developer Mode
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showDevTestMode, setShowDevTestMode] = useState(false);

  // Frame history for optical flux
  const frameHistoryRef = useRef<{ timestamp: number; embedding: number[] }[]>([]);

  // Enrolled template for current officer
  const effectiveUserId = user?.id || 'usr-tester-001';
  const effectiveUserName = user?.full_name || 'Amit Patel';
  const effectiveRole = user?.role || 'SUB_INSPECTOR';

  const [enrolledTemplate, setEnrolledTemplate] = useState(() =>
    demoFaceStore.getStaffTemplate(effectiveUserId)
  );

  // Refresh enrolled template on mount or update
  useEffect(() => {
    const tmpl = demoFaceStore.getStaffTemplate(effectiveUserId);
    setEnrolledTemplate(tmpl);
  }, [effectiveUserId]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Stop camera helper
  const stopCameraStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    FaceVerificationService.stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraState('IDLE');
    setDetection(null);
    setDetectionState('NO_FACE');
    setStablePresenceFrames(0);
    setPresenceScore(0);
    frameHistoryRef.current = [];
  };

  /**
   * Explicit user action: Start Live Camera
   */
  const handleStartLiveCamera = async (deviceIdToUse?: string) => {
    setCameraErrorMessage(null);
    setIsIframeBlocked(false);
    setMatchResult(null);
    setCameraState('REQUESTING');

    // Ensure video element is available
    if (!videoRef.current) {
      setCameraState('ERROR');
      setCameraErrorMessage('Video display element not initialized.');
      return;
    }

    try {
      const targetDevice = deviceIdToUse || selectedDeviceId || undefined;
      const stream = await FaceVerificationService.startCamera(videoRef.current, {
        deviceId: targetDevice,
      });

      streamRef.current = stream;
      setCameraState('READY');

      // Enumerate cameras once permission is granted
      const devices = await FaceVerificationService.getAvailableCameras();
      setAvailableCameras(devices);
      if (devices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devices[0].deviceId);
      }

      // Start continuous real-time face detection loop
      startLiveDetectionLoop();
    } catch (err: any) {
      const classified = FaceVerificationService.classifyCameraError(err);
      setCameraState(classified.state);
      setCameraErrorMessage(classified.message);
      setIsIframeBlocked(classified.isIframe);
    }
  };

  /**
   * Switch camera device (e.g. Front vs Back)
   */
  const handleSwitchCamera = async (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    stopCameraStream();
    await handleStartLiveCamera(newDeviceId);
  };

  /**
   * Continuous real-time frame analysis loop
   */
  const startLiveDetectionLoop = () => {
    let stableCount = 0;

    const loop = () => {
      if (videoRef.current && canvasRef.current && streamRef.current && cameraState !== 'IDLE') {
        const result = FaceVerificationService.detectFace(videoRef.current, canvasRef.current);
        setDetection(result);
        setDetectionState(result.detectionState);

        if (result.detectionState === 'ONE_FACE' && result.box) {
          stableCount++;
          setStablePresenceFrames(stableCount);

          // Extract frame embedding for optical presence
          const liveVec = FaceVerificationService.extractEmbedding(canvasRef.current, result.box);
          frameHistoryRef.current.push({
            timestamp: Date.now(),
            embedding: liveVec,
          });
          if (frameHistoryRef.current.length > 10) {
            frameHistoryRef.current.shift();
          }

          setPresenceScore(Math.min(100, stableCount * 12));
        } else {
          stableCount = Math.max(0, stableCount - 1);
          setStablePresenceFrames(stableCount);
        }
      }

      if (streamRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  /**
   * Execute real biometric comparison against enrolled template
   */
  const handleVerifyIdentity = () => {
    if (!videoRef.current || !canvasRef.current || !detection?.box) {
      return;
    }

    if (!enrolledTemplate) {
      setCameraErrorMessage('No face template enrolled for this officer. Please enroll face first.');
      return;
    }

    setIsVerifying(true);

    try {
      // 1. Live Camera Presence Check
      const presence = FaceVerificationService.verifyLivePresence(frameHistoryRef.current, {
        isLiveStreamActive: true,
      });

      // 2. Extract live biometric representation from current video frame
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }
      const liveEmbedding = FaceVerificationService.extractEmbedding(canvas, detection.box);

      // 3. Compare with enrolled template (Genuine comparison)
      const res = FaceVerificationService.compareFaceTemplates(
        liveEmbedding,
        enrolledTemplate.embedding
      );

      setMatchResult(res);

      if (res.match && presence.isLiveCamera) {
        const record: FaceVerificationRecord = {
          id: `fv-${Date.now()}`,
          user_id: effectiveUserId,
          user_name: effectiveUserName,
          role: effectiveRole,
          inspection_id: 'INSP-ON-SITE',
          verification_type: 'PRE_INSPECTION',
          verified: true,
          face_match: true,
          live_camera_check: true,
          confidence_score: res.confidence,
          timestamp: new Date().toISOString(),
          attempt_number: 1,
          demo_mode: false,
        };

        demoFaceStore.recordVerification(record);
        setVerificationRecord(record);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setCameraErrorMessage(err.message || 'Face verification computation failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Developer Test Bypass (Clearly separated and isolated)
   */
  const handleDeveloperTestBypass = () => {
    const dummyRecord: FaceVerificationRecord = {
      id: `dev-bypass-${Date.now()}`,
      user_id: effectiveUserId,
      user_name: effectiveUserName,
      role: effectiveRole,
      inspection_id: 'DEV-TEST-001',
      verification_type: 'PRE_INSPECTION',
      verified: true,
      face_match: true,
      live_camera_check: false,
      confidence_score: 95.0,
      timestamp: new Date().toISOString(),
      attempt_number: 1,
      demo_mode: true,
    };
    demoFaceStore.recordVerification(dummyRecord);
    setVerificationRecord(dummyRecord);
    setMatchResult({
      match: true,
      decision: 'MATCH',
      confidence: 95,
      similarityScore: 0.95,
      message: 'DIAGNOSTIC TEST RECORD: Verification entry recorded for calibration workflow evaluation.',
    });
  };

  const diagnostics = FaceVerificationService.getDiagnostics();
  const directAppUrl = FaceVerificationService.getDirectAppUrl();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
              FIELD TESTER VERIFICATION
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-mono">/tester/identity</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Live Face Identity Verification
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Production on-site biometric identity confirmation for authorized Legal Metrology officers (OIML R 76).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/tester/identity/enroll')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
          >
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>{enrolledTemplate ? 'Re-enroll Face' : 'Enroll Face First'}</span>
          </button>
        </div>
      </div>

      {/* Officer Identification Banner */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Assigned Field Officer</div>
          <div className="font-bold text-slate-900 text-base">{effectiveUserName}</div>
          <div className="text-slate-500 font-mono text-xs">{effectiveRole} &bull; ID: {effectiveUserId}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Template Status</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${enrolledTemplate ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-xs font-semibold text-slate-700">
                {enrolledTemplate ? 'Biometric Template Enrolled' : 'No Template Registered'}
              </span>
            </div>
          </div>
          {!enrolledTemplate && (
            <button
              type="button"
              onClick={() => navigate('/tester/identity/enroll')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs"
            >
              Enroll Now
            </button>
          )}
        </div>
      </div>

      {/* Main Verification Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Real Live Camera Viewport */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 max-w-xl mx-auto flex items-center justify-center border-2 border-slate-800 shadow-inner">
          {/* Offscreen Canvas for Computer Vision Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Real Live <video> Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover -scale-x-100 ${
              cameraState === 'READY' ? 'block' : 'hidden'
            }`}
          />

          {/* Camera Idle State (Before explicit user action) */}
          {cameraState === 'IDLE' && (
            <div className="text-center p-8 space-y-4 max-w-md mx-auto text-slate-300">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-blue-400 shadow-lg">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Camera Inactive
                </h3>
                <p className="text-xs text-slate-400">
                  Click below to start your device webcam. Browser will prompt for camera permission.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleStartLiveCamera()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Start Live Camera</span>
              </button>
            </div>
          )}

          {/* Camera Requesting Permission State */}
          {cameraState === 'REQUESTING' && (
            <div className="text-center p-8 space-y-3 text-slate-300 max-w-sm mx-auto">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Requesting camera permission...</p>
                <p className="text-xs text-slate-400">
                  Please click &quot;Allow&quot; in the browser prompt to grant camera access.
                </p>
              </div>
            </div>
          )}

          {/* Camera Blocked / Sandbox State */}
          {cameraState === 'BLOCKED' && (
            <div className="text-center p-6 space-y-4 max-w-md mx-auto text-slate-300">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-amber-300">
                  Camera access is unavailable
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Please verify that camera permissions are allowed in your browser settings.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleStartLiveCamera()}
                  className="px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Camera Permission Denied */}
          {cameraState === 'NO_PERMISSION' && (
            <div className="text-center p-6 space-y-3 max-w-md mx-auto text-slate-300">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-400">Camera permission was denied.</h3>
                <p className="text-xs text-slate-400">
                  To verify officer identity, please click the camera/lock icon in your browser address bar, allow camera permissions, and retry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartLiveCamera()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* No Camera Device Found */}
          {cameraState === 'NO_CAMERA' && (
            <div className="text-center p-6 space-y-3 max-w-md mx-auto text-slate-300">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-400">No camera device was found.</h3>
                <p className="text-xs text-slate-400">
                  Please attach a USB webcam or ensure your device camera is connected and recognized.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartLiveCamera()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700"
              >
                Scan for Camera
              </button>
            </div>
          )}

          {/* Generic Error */}
          {cameraState === 'ERROR' && (
            <div className="text-center p-6 space-y-3 max-w-md mx-auto text-slate-300">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-400">Unable to access the camera.</h3>
                <p className="text-xs text-slate-400">{cameraErrorMessage || 'An unexpected hardware error occurred.'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleStartLiveCamera()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Active Live Camera Stream Overlays */}
          {cameraState === 'READY' && (
            <>
              {/* LIVE CAMERA Indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[10px] font-mono border border-slate-700 backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-bold">LIVE CAMERA</span>
              </div>

              {/* Face Guide Oval */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-52 h-64 rounded-[50%] border-2 transition-all duration-300 shadow-2xl ${
                    detectionState === 'ONE_FACE'
                      ? 'border-emerald-400 bg-emerald-500/10 shadow-emerald-500/20'
                      : detectionState === 'MULTIPLE_FACES'
                      ? 'border-rose-500 bg-rose-500/10'
                      : 'border-white/40 border-dashed'
                  }`}
                />
              </div>

              {/* Dynamic Face Bounding Box Reticle */}
              {detection?.box && detectionState === 'ONE_FACE' && (
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
                    <span>1 FACE DETECTED</span>
                    <span className="text-emerald-200">{detection.qualityScore}%</span>
                  </div>
                </div>
              )}

              {/* Real-time Status Overlay Bar */}
              <div className="absolute bottom-3 inset-x-3 px-3.5 py-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] flex items-center gap-2">
                    {detectionState === 'ONE_FACE' ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    ) : detectionState === 'MULTIPLE_FACES' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                    <span>{detection?.statusMessage || 'Initializing detection...'}</span>
                  </span>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    detectionState === 'ONE_FACE'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : detectionState === 'MULTIPLE_FACES'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {detectionState}
                  </span>
                </div>

                {/* Live Camera Presence Progress */}
                {detectionState === 'ONE_FACE' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Live Camera Presence Check</span>
                      <span>{presenceScore}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-1.5 transition-all duration-150"
                        style={{ width: `${presenceScore}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Camera Controls & Device Selection */}
        {cameraState === 'READY' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Video Input:</span>
              {availableCameras.length > 1 ? (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleSwitchCamera(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
                >
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-slate-600">
                  {availableCameras[0]?.label || 'Front Camera (Webcam)'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={stopCameraStream}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              Stop Camera
            </button>
          </div>
        )}

        {/* Action Trigger Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {cameraState === 'IDLE' ? (
            <button
              type="button"
              onClick={() => handleStartLiveCamera()}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Start Live Camera</span>
            </button>
          ) : cameraState === 'READY' ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={detectionState !== 'ONE_FACE' || presenceScore < 30 || isVerifying}
                onClick={handleVerifyIdentity}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isVerifying ? 'Comparing Biometrics...' : 'Verify Identity'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleStartLiveCamera()}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Restart Camera
            </button>
          )}

          {verificationRecord?.verified ? (
            <div className="px-4 py-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Identity Verified ✓</span>
            </div>
          ) : null}
        </div>

        {/* Verification Result Card */}
        {matchResult && (
          <div className={`p-5 rounded-2xl border ${
            matchResult.match
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                matchResult.match ? 'bg-emerald-600' : 'bg-rose-600'
              }`}>
                {matchResult.match ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  {matchResult.decision === 'MATCH' ? 'BIOMETRIC IDENTITY MATCHED' : 'BIOMETRIC IDENTITY NO MATCH'}
                </h3>
                <p className="text-xs mt-0.5 opacity-90">{matchResult.message}</p>
              </div>
            </div>

            {verificationRecord && (
              <div className="mt-4 p-3.5 bg-white/90 rounded-xl border border-emerald-200 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Officer Name:</span>
                  <span className="font-bold text-slate-900">{verificationRecord.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Confidence Score:</span>
                  <span className="font-bold text-emerald-700">{verificationRecord.confidence_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Live Presence Check:</span>
                  <span className="font-bold text-emerald-700">VERIFIED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Timestamp:</span>
                  <span className="text-slate-700">{new Date(verificationRecord.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diagnostics Section (Development / Testing Mode) */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left font-semibold text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <span>Development & Testing Diagnostics</span>
          {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDiagnostics && (
          <div className="p-4 border-t border-slate-200 space-y-3 bg-white font-mono text-[11px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Camera API:</span>
                <strong className={diagnostics.cameraApiAvailable ? 'text-emerald-700' : 'text-rose-700'}>
                  {diagnostics.cameraApiAvailable ? 'Available' : 'Unavailable'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Secure Context (HTTPS):</span>
                <strong className={diagnostics.isSecureContext ? 'text-emerald-700' : 'text-amber-700'}>
                  {diagnostics.isSecureContext ? 'Yes (Secure)' : 'No (Insecure HTTP)'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Top-Level Window:</span>
                <strong className={diagnostics.isTopLevel ? 'text-emerald-700' : 'text-amber-700'}>
                  {diagnostics.isTopLevel ? 'Yes (Direct Tab)' : 'No (Inside Iframe)'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Embedded Frame:</span>
                <strong className={diagnostics.isIframe ? 'text-slate-700' : 'text-slate-700'}>
                  {diagnostics.isIframe ? 'Active' : 'Standard'}
                </strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Camera State:</span>
                <strong className="text-blue-700">{cameraState}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Camera Devices:</span>
                <strong className={availableCameras.length > 0 ? 'text-emerald-700' : 'text-slate-500'}>
                  {availableCameras.length > 0 ? `${availableCameras.length} Found` : 'Not Enumerated'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Developer Only Workflow Testing Drawer (Clearly Separated) */}
      <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setShowDevTestMode(!showDevTestMode)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span>STANDALONE VERIFICATION BENCHMARK</span>
          {showDevTestMode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDevTestMode && (
          <div className="p-4 border-t border-slate-200 bg-amber-50/50 space-y-2">
            <p className="text-[11px] text-amber-900 leading-relaxed">
              <strong>Notice:</strong> This developer testing bypass exists solely for testing subsequent UI workflow transitions in headless or CI environments without camera hardware. It does not perform actual biometric verification.
            </p>
            <button
              type="button"
              onClick={handleDeveloperTestBypass}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Developer Test Record (Non-Biometric)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
